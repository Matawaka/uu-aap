'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { LifecycleTrial, runScenario, alwaysFalse } = require('./lifecycle-trial.js');
const { run } = require('./run-lifecycle-trials.js');
const scenarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios.json'), 'utf8'));

function checkFresh(runner = runScenario) {
  for (const scenario of scenarios) {
    const result = runner(scenario, 'fresh_boundary');
    assert.equal(result.receipts.length, scenario.expected.fresh_boundary.length, scenario.id);
    for (const [index, expected] of scenario.expected.fresh_boundary.entries()) {
      for (const [field, value] of Object.entries(expected)) {
        assert.deepEqual(result.receipts[index][field], value, `${scenario.id}/${field}`);
      }
      for (const [claim, value] of Object.entries(alwaysFalse)) {
        assert.equal(result.receipts[index][claim], value, `${scenario.id}/${claim}`);
      }
    }
  }
}

test('all 16 fixed event tapes satisfy their fresh-boundary expectations', () => {
  checkFresh();
});

test('scenario expectations and prose cannot guide lifecycle decisions', () => {
  for (const scenario of scenarios) {
    const poisoned = structuredClone(scenario);
    poisoned.title = 'Metadata must not influence decisions';
    poisoned.expected = { false_oracle: 'accept everything' };
    poisoned.expected_differential = !scenario.expected_differential;
    for (const arm of ['fresh_boundary', 'cached_boundary']) {
      assert.deepEqual(runScenario(poisoned, arm).receipts, runScenario(scenario, arm).receipts);
    }
  }
});

test('both arms replay deterministically with 11 predeclared unsafe-cache differences', () => {
  const a = run();
  assert.deepEqual(a, run());
  assert.equal(a.scenario_count, 16);
  assert.equal(a.arm_count, 32);
  assert.deepEqual(a.differential_scenarios,
    ['L01', 'L02', 'L03', 'L04', 'L05', 'L06', 'L07', 'L09', 'L11', 'L13', 'L15']);
  assert.equal(a.real_person_count, 0);
  assert.equal(a.biometric_recording_count, 0);
  assert.equal(a.end_to_end_pcc_and_biometrics, 'NOT_EXECUTED');
});

test('client-claimed time cannot refresh an expired request or move the model clock', () => {
  const trial = new LifecycleTrial();
  trial.issue('a');
  trial.advance(65000);
  const receipt = trial.complete('a', trial.response('a', { claimed_at: '2026-11-16T12:00:01Z' }));
  assert.equal(receipt.boundary_clock_ms, 65000);
  assert.equal(receipt.response_status, 'RESPONSE_EXPIRED');
  assert.equal(receipt.contract_reason, 'EXPIRED_SOURCE_BOUND');
  assert.equal(trial.now, 65000);
});

test('the model clock rejects rollback, fractional, non-finite and out-of-horizon changes', () => {
  const trial = new LifecycleTrial();
  trial.advance(10);
  for (const ms of [-1, 0.1, NaN, Infinity, 3600001]) {
    assert.throws(() => trial.advance(ms));
    assert.equal(trial.now, 10);
  }
});

test('a full retained backlog does not postpone expiry checks', () => {
  const trial = new LifecycleTrial();
  for (let i = 0; i < 64; i++) trial.issue(`pending-${i}`);
  trial.advance(65000);
  assert.throws(() => trial.issue('new'), /capacity/);
  const receipt = trial.complete('pending-0', trial.response('pending-0'));
  assert.equal(receipt.response_status, 'RESPONSE_EXPIRED');
  assert.equal(receipt.contract_status, 'REJECTED');
  assert.equal(trial.requests.size, 64);
});

test('current source denial is observed and retained first-phase evidence is unchanged', () => {
  const trial = new LifecycleTrial();
  trial.issue('a');
  const before = structuredClone(trial.requests.get('a'));
  trial.advance(1000);
  trial.revoke();
  const receipt = trial.complete('a', trial.response('a'));
  assert.equal(receipt.source_status_observed, 'denied');
  assert.equal(receipt.source_hash_observed, trial.source.content_hash);
  assert.equal(receipt.contract_reason, 'CURRENT_ADMISSION_DENIED');
  assert.deepEqual(trial.requests.get('a').decision, before.decision);
  assert.deepEqual(trial.requests.get('a').boundary, before.boundary);
});

test('unavailable current source cannot be silently replaced by an old snapshot', () => {
  let calls = 0;
  const trial = new LifecycleTrial('fresh_boundary', () => { calls++; });
  trial.issue('a');
  trial.sourceAvailable = false;
  const receipt = trial.complete('a', trial.response('a'));
  assert.equal(receipt.response_status, 'CURRENT_SOURCE_UNAVAILABLE');
  assert.equal(receipt.contract_status, 'NOT_EVALUATED');
  assert.equal(calls, 0);
});

test('nonce/session/intent/target/epoch mismatches do not consume the valid request', async t => {
  const changes = { nonce: 'other-nonce', session_id: 'other-session', intent_id: 'other-intent',
    target_hash: 'sha256:' + 'f'.repeat(64), control_epoch: 2 };
  for (const [key, value] of Object.entries(changes)) {
    await t.test(key, () => {
      const trial = new LifecycleTrial();
      trial.issue('a');
      const wrong = trial.complete('a', trial.response('a', { [key]: value }));
      assert.equal(wrong.response_status, 'RESPONSE_BINDING_MISMATCH');
      assert.equal(trial.requests.get('a').completed, false);
      assert.equal(trial.complete('a', trial.response('a')).response_status, 'RECORDED_EVIDENCE_ONLY');
    });
  }
});

test('local replay is rejected before a second gate call', () => {
  const { validateDecision } = require(path.join(require('./lifecycle-trial.js').ROOT,
    'protocols/integration/execute-revalidation/v0.1/validate-parameterized-decision.js'));
  let calls = 0;
  const trial = new LifecycleTrial('fresh_boundary', (...args) => { calls++; return validateDecision(...args); });
  trial.issue('a');
  const response = trial.response('a');
  assert.equal(trial.complete('a', response).response_status, 'RECORDED_EVIDENCE_ONLY');
  assert.equal(trial.complete('a', response).response_status, 'LOCAL_REPLAY_REJECTED');
  assert.equal(calls, 1);
});

test('rotation rejects the old context while a newly issued current request remains usable', () => {
  const trial = new LifecycleTrial();
  trial.issue('a');
  trial.rotate();
  const old = trial.complete('a', trial.response('a'));
  assert.equal(old.response_status, 'CURRENT_CONTEXT_CHANGED');
  assert.equal(old.contract_reason, 'CURRENT_FRESHNESS_BINDING_CHANGED');
  trial.issue('b');
  const fresh = trial.complete('b', trial.response('b'));
  assert.equal(fresh.response_status, 'RECORDED_EVIDENCE_ONLY');
  assert.equal(fresh.contract_status, 'READY');
  assert.equal(old.identity_established, false);
  assert.equal(fresh.identity_established, false);
});

test('confidence and inconsistent answers cannot produce identity, guilt or new authority', () => {
  for (const confidence of [0, 0.5, 0.999999, 1]) {
    for (const assessment of ['consistent', 'inconsistent', 'unknown']) {
      const trial = new LifecycleTrial();
      trial.revoke();
      trial.issue('a');
      const receipt = trial.complete('a', trial.response('a', { confidence, assessment }));
      assert.equal(receipt.response_status, 'RECORDED_EVIDENCE_ONLY');
      assert.equal(receipt.contract_reason, 'CURRENT_ADMISSION_DENIED');
      for (const [claim, value] of Object.entries(alwaysFalse)) assert.equal(receipt[claim], value);
    }
  }
});

test('a current contract does not establish a fresh response or a person', () => {
  const trial = new LifecycleTrial();
  trial.issue('a');
  trial.advance(30000);
  const receipt = trial.complete('a', trial.response('a'));
  assert.equal(receipt.response_status, 'RESPONSE_EXPIRED');
  assert.equal(receipt.contract_status, 'READY');
  assert.equal(receipt.causal_continuity_proven, false);
  assert.equal(receipt.authority_created, false);
});

test('unexpected personal-history fields are refused and returned receipts cannot rewrite retained evidence', () => {
  const trial = new LifecycleTrial();
  trial.issue('a');
  assert.throws(() => trial.complete('a', trial.response('a', { raw_history: ['synthetic fact'] })),
    /unexpected response field/);
  assert.equal(trial.receipts.length, 0);
  const receipt = trial.complete('a', trial.response('a'));
  receipt.identity_established = true;
  assert.equal(trial.receipts[0].identity_established, false);
  assert(!JSON.stringify(trial.receipts).includes('raw_history'));
});

test('four authored implementation faults are killed by the fixed expectations', async t => {
  const filename = path.join(__dirname, 'lifecycle-trial.js');
  const source = fs.readFileSync(filename, 'utf8');
  const mutations = [
    ['cached boundary substituted for current state',
      "this.mode === 'fresh_boundary' ? this.boundary() : clone(request.boundary)",
      'clone(request.boundary)'],
    ['clock frozen at issuance',
      'return { now: this.now, source: clone(this.source), context: clone(this.context) };',
      'return { now: 0, source: clone(this.source), context: clone(this.context) };'],
    ['local replay guard disabled', 'if (request?.completed)', 'if (false)'],
    ['confidence promoted to identity', 'input_time_ignored: true, ...alwaysFalse,',
      'input_time_ignored: true, ...alwaysFalse, identity_established: response.confidence > 0.99,'],
  ];
  for (const [name, before, after] of mutations) {
    await t.test(name, () => {
      assert.equal(source.split(before).length, 2, 'mutation must select exactly one reviewed site');
      const mutant = new Module(filename, module);
      mutant.filename = filename;
      mutant.paths = module.paths;
      // Only fixed, locally authored mutations of this repository's source.
      // No input evidence, URLs or user strings are executed.
      mutant._compile(source.replace(before, after), filename);
      assert.throws(() => checkFresh(mutant.exports.runScenario), /L[0-9]{2}/);
    });
  }
});
