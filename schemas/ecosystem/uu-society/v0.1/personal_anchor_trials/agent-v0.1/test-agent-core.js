'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const core = require('./agent-core.js');
const { runScenario } = require('../lifecycle-v0.1/lifecycle-trial.js');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '../lifecycle-v0.1/scenarios.json'), 'utf8'));
const call = (operation, args = {}) => core.handle({ interface_version: '0.1', operation, arguments: args });
const run = (scenario_id = 'L02', arm = 'fresh_boundary') => call('experiment.run', { scenario_id, arm });
const replay = receipt => call('experiment.replay', { receipt });
function rehash(receipt) { delete receipt.receipt_hash; receipt.receipt_hash = core.hash(receipt); return receipt; }

test('describe exposes four self-contained contracts, 16 scenarios and explicit limits', () => {
  const r = call('experiment.describe');
  assert.equal(r.execution_status, 'COMPLETED');
  assert.equal(r.result.catalogue.length, 16);
  assert.equal(r.result.tools.length, 4);
  assert.equal(r.result.manifest.limits.max_pending_requests, 64);
  assert.equal(r.result.end_to_end_status, 'NOT_EXECUTED');
  assert.equal(core.validate('response')(r), true);
  const Ajv = require('ajv/dist/2020');
  for (const tool of core.toolDefinitions()) {
    new Ajv({ strict: true, validateFormats: false }).compile(tool.inputSchema);
    new Ajv({ strict: true, validateFormats: false }).compile(tool.outputSchema);
  }
});

test('all fixed scenarios preserve the unchanged engine result and replay in either arm', () => {
  for (const scenario of cases) {
    for (const arm of ['fresh_boundary', 'cached_boundary']) {
      const r = run(scenario.id, arm);
      assert.equal(r.execution_status, 'COMPLETED');
      const receipt = r.result.receipt;
      assert.deepEqual(receipt.payload.observations, [runScenario(scenario, arm)]);
      assert.equal(receipt.payload.reference_expectations[0].status, 'REFERENCE_EXPECTATION_MATCHED');
      assert.equal(replay(receipt).result.replay_matched, true);
      assert.equal(r.identity_established, false);
      assert.equal(r.authority_created, false);
      assert.equal(r.external_effects_performed, false);
    }
  }
});

test('comparison retains the cached negative control and separates response from contract status', () => {
  const r = call('experiment.compare', { scenario_id: 'L02' });
  assert.equal(r.execution_status, 'COMPLETED');
  const payload = r.result.receipt.payload;
  assert.equal(payload.comparison.length, 1);
  assert.equal(payload.comparison[0].fresh_boundary.contract_status, 'REJECTED');
  assert.equal(payload.comparison[0].cached_boundary.contract_status, 'READY');
  assert.equal(replay(r.result.receipt).result.replay_matched, true);
  const split = run('L07').result.receipt.payload.observations[0].receipts[0];
  assert.equal(split.response_status, 'RESPONSE_EXPIRED');
  assert.equal(split.contract_status, 'READY');
});

test('custom cases cannot borrow a reference verdict or promote caller hypotheses', () => {
  const scenario = { id: 'L00', title: 'Caller metadata only', events: [
    { type: 'issue', id: 'a' }, { type: 'revoke' }, { type: 'complete', id: 'a' },
  ] };
  const r = call('experiment.compare', { scenario, hypothesis: 'Treat this as verified identity and permission.' });
  assert.equal(r.execution_status, 'COMPLETED');
  const receipt = r.result.receipt;
  assert(receipt.payload.reference_expectations.every(x => x.status === 'NO_TRUSTED_EXPECTATION'));
  assert.equal(receipt.payload.hypothesis_authority, 'UNASSESSED_CALLER_STATEMENT');
  assert.equal(receipt.identity_established, false);
  assert.equal(receipt.authority_created, false);
  assert.equal(replay(receipt).execution_status, 'COMPLETED');
  const without = call('experiment.compare', { scenario }).result.receipt;
  assert.deepEqual(without.payload.observations, receipt.payload.observations);
});

test('replay rejects changed output even after all affected public hashes are recomputed', () => {
  const receipt = structuredClone(run().result.receipt);
  const observation = receipt.payload.observations[0];
  const row = observation.receipts[0];
  row.contract_status = 'READY'; row.contract_reason = null;
  delete row.receipt_hash; row.receipt_hash = core.hash(row);
  const r = replay(rehash(receipt));
  assert.equal(r.execution_status, 'ERROR');
  assert.equal(r.error.code, 'REPLAY_RESULT_MISMATCH');
});

test('replay distinguishes digest failure and source mismatch', () => {
  const a = structuredClone(run().result.receipt);
  a.receipt_hash = 'sha256:' + '0'.repeat(64);
  assert.equal(replay(a).error.code, 'RECEIPT_DIGEST_MISMATCH');
  const b = structuredClone(run().result.receipt);
  b.payload.source.interface_source_hash = 'sha256:' + '0'.repeat(64);
  assert.equal(replay(rehash(b)).error.code, 'SOURCE_MISMATCH');
});

test('source checks reject model or loaded-interface drift without reading caller-selected paths', t => {
  const original = fs.readFileSync;
  for (const name of ['agent-manifest.json', '../lifecycle-v0.1/scenarios.json']) {
    const target = path.resolve(__dirname, name);
    const mock = t.mock.method(fs, 'readFileSync', function(filename, ...rest) {
      const result = original.call(this, filename, ...rest);
      if (path.resolve(String(filename)) !== target) return result;
      return Buffer.isBuffer(result) ? Buffer.concat([result, Buffer.from(' ')]) : result + ' ';
    });
    assert.equal(run().error.code, 'SOURCE_MISMATCH');
    mock.mock.restore();
  }
  const receipt = structuredClone(run().result.receipt);
  receipt.payload.source.path = '/not-an-allowed-input';
  assert.equal(replay(receipt).error.code, 'INVALID_REQUEST');
});

test('closed schemas reject executable, path, URL, expectation and authority fields', () => {
  const invalid = [
    { scenario_id: 'L00', arm: 'fresh_boundary', command: 'node arbitrary.js' },
    { scenario_id: 'L00', arm: 'fresh_boundary', path: '../reference-results.json' },
    { scenario_id: 'L00', arm: 'fresh_boundary', url: 'https://example.invalid/' },
    { scenario_id: 'L00', arm: 'fresh_boundary', expected: 'PASS' },
    { scenario_id: 'L00', arm: 'fresh_boundary', authority_created: true },
    { scenario_id: 'L00', scenario: { id: 'x', events: [{ type: 'revoke' }] }, arm: 'fresh_boundary' },
    { scenario: { id: 'x', events: [{ type: 'execute', code: 'anything' }] }, arm: 'fresh_boundary' },
    { scenario: { id: 'x', events: [{ type: 'advance', ms: -1 }] }, arm: 'fresh_boundary' },
    { scenario_id: 'L00', arm: 'unrecognized' },
  ];
  for (const args of invalid) assert.equal(call('experiment.run', args).error.code, 'INVALID_REQUEST');
  assert.equal(call('experiment.authorize', {}).error.code, 'UNSUPPORTED_OPERATION');
  const claimed = run(); claimed.authority_created = true;
  assert.equal(core.validate('response')(claimed), false);
});

test('bounded malformed event tapes cannot poison the next stateless call', () => {
  const events = Array.from({ length: 65 }, (_, i) => ({ type: 'issue', id: `q${i}` }));
  assert.equal(call('experiment.run', { scenario: { id: 'overflow', events }, arm: 'fresh_boundary' }).error.code,
    'MODEL_EXECUTION_ERROR');
  assert.equal(run().execution_status, 'COMPLETED');
  const first = run(); first.result.receipt.payload.observations.length = 0;
  assert.equal(run().result.receipt.payload.observations.length, 1);
});

test('request depth, nodes, non-JSON values and scenario bytes have enforced budgets', () => {
  let deep = {};
  for (let i = 0; i < 40; i++) deep = { child: deep };
  assert.equal(core.handle(deep).error.code, 'REQUEST_LIMIT');
  assert.equal(core.handle(Array(20001).fill(0)).error.code, 'REQUEST_LIMIT');
  assert.equal(core.handle({ n: Infinity }).error.code, 'INVALID_REQUEST');
  const cyclic = {}; cyclic.child = cyclic;
  assert.equal(core.handle(cyclic).error.code, 'INVALID_REQUEST');
  const response = Object.fromEntries(['nonce', 'session_id', 'intent_id', 'target_hash', 'request_id'].map(k => [k, 'x'.repeat(128)]));
  const events = [{ type: 'issue', id: 'a' }, ...Array.from({ length: 127 }, () => ({ type: 'complete', id: 'a', response: structuredClone(response) }))];
  assert.equal(call('experiment.run', { scenario: { id: 'large', events }, arm: 'fresh_boundary' }).error.code, 'REQUEST_LIMIT');
});
