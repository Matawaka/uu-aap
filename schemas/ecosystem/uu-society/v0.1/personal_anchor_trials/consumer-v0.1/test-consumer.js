'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { checkReceipt, checkClaim, checkReplay, hash } = require('./check-consumer.js');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'reference-report.json'), 'utf8'));
const clone = v => structuredClone(v);
function envelope(receipt) {
  return { interface_version: '0.1', operation: 'experiment.compare', execution_status: 'COMPLETED',
    scope: 'OFFLINE_SYNTHETIC_LIFECYCLE', identity_established: false, authority_created: false,
    external_effects_performed: false, result: { receipt: clone(receipt) }, error: null };
}
function sample(id = 'P02') {
  return { response: envelope(report.results.find(r => r.case_id === id).receipt),
    trialCase: cases.find(c => c.id === id) };
}
function rehash(receipt) { delete receipt.receipt_hash; receipt.receipt_hash = hash(receipt); }

test('all retained custom receipts meet the predeclared oracle, without borrowing catalogue expectations', () => {
  assert.equal(report.results.length, cases.length);
  for (const c of cases) {
    const { response } = sample(c.id);
    const checked = checkReceipt(response, c);
    assert.equal(checkClaim(clone(checked), checked), true);
    assert.equal(checked.action_authorized, false);
    assert.equal(checked.end_to_end_status, 'NOT_EXECUTED');
  }
});

test('recorded evidence under denial remains a model hold in the fresh arm', () => {
  const { response, trialCase } = sample();
  const checked = checkReceipt(response, trialCase);
  assert.equal(checked.statements[0].response_status, 'RECORDED_EVIDENCE_ONLY');
  assert.equal(checked.statements[0].contract_status, 'REJECTED');
  assert.equal(checked.statements[0].disposition, 'MODEL_HOLD');
  assert.equal(checked.statements[1].disposition, 'NEGATIVE_CONTROL_ONLY');
});

test('READY does not turn expired or mismatched-context evidence into a successful challenge', () => {
  for (const id of ['P03', 'P06']) {
    const { response, trialCase } = sample(id);
    const first = checkReceipt(response, trialCase).statements[0];
    assert.equal(first.contract_status, 'READY');
    assert.equal(first.disposition, 'MODEL_HOLD');
  }
});

test('inconsistent evidence is preserved and later modeled recovery does not establish personhood', () => {
  const { response, trialCase } = sample('P10');
  const checked = checkReceipt(response, trialCase);
  assert.equal(checked.statements[0].response_assessment, 'inconsistent');
  assert.equal(checked.statements[1].response_assessment, 'consistent');
  assert.equal(checked.guilt_established, false);
  assert.equal(checked.identity_established, false);
});

test('past READY receipt is retained while a subsequent completion sees revocation', () => {
  const { response, trialCase } = sample('P11');
  const rows = checkReceipt(response, trialCase).statements.filter(r => r.arm === 'fresh_boundary');
  assert.deepEqual(rows.map(r => r.contract_status), ['READY', 'REJECTED']);
  assert.deepEqual(rows.map(r => r.disposition), ['MODEL_EVIDENCE_ONLY', 'MODEL_HOLD']);
  assert.equal(report.preserved_limits.final_effect_boundary, 'NOT_IMPLEMENTED');
});

test('closed conclusions reject positive identity, permission, guilt, safety and independent-review claims', () => {
  const { response, trialCase } = sample('P00');
  const checked = checkReceipt(response, trialCase);
  for (const field of ['identity_established', 'authority_created', 'action_authorized',
    'guilt_established', 'safe_to_act', 'independent_review_performed']) {
    const claim = clone(checked); claim[field] = true;
    assert.throws(() => checkClaim(claim, checked), /consumer conclusion/);
  }
  for (const change of [c => { c.end_to_end_status = 'PASS'; },
    c => { c.statements[0].disposition = 'AUTHORIZED'; },
    c => { c.receipt_hash = 'sha256:' + '0'.repeat(64); },
    c => { c.universal_identity = true; }]) {
    const claim = clone(checked); change(claim);
    assert.throws(() => checkClaim(claim, checked), /consumer conclusion/);
  }
});

test('semantic checker catches a removed denial even after public hashes are recomputed', () => {
  const { response, trialCase } = sample();
  const receipt = response.result.receipt;
  const row = receipt.payload.observations[0].receipts[0];
  row.contract_status = 'READY'; row.contract_reason = null;
  rehash(row); rehash(receipt);
  assert.throws(() => checkReceipt(response, trialCase), /predeclared oracle/);
});

test('missing observations, wrong source, wrong case and changed comparison are refused', () => {
  for (const change of [r => { r.payload.observations[0].receipts = []; },
    r => { r.payload.source.interface_source_hash = 'sha256:' + '0'.repeat(64); },
    r => { r.payload.input.scenario.id = 'P00'; },
    r => { r.payload.comparison = []; },
    r => { r.payload.observations[0].arm = 'cached_boundary'; }]) {
    const { response, trialCase } = sample();
    change(response.result.receipt); rehash(response.result.receipt);
    assert.throws(() => checkReceipt(response, trialCase));
  }
});

test('true non-effects and unknown receipt fields cannot be laundered with new hashes', () => {
  for (const level of ['receipt', 'observation', 'row']) {
    const { response, trialCase } = sample();
    const receipt = response.result.receipt, observation = receipt.payload.observations[0];
    const target = level === 'receipt' ? receipt : level === 'observation' ? observation : observation.receipts[0];
    target.identity_established = true;
    if (level === 'row') rehash(target);
    rehash(receipt);
    assert.throws(() => checkReceipt(response, trialCase));
  }
  const { response, trialCase } = sample();
  response.result.receipt.action_permit = 'invented'; rehash(response.result.receipt);
  assert.throws(() => checkReceipt(response, trialCase), /closed response contract/);
});

test('a false replay or a successful replay for another receipt is refused', () => {
  const receipt = sample().response.result.receipt;
  const good = { interface_version: '0.1', operation: 'experiment.replay', execution_status: 'COMPLETED',
    scope: 'OFFLINE_SYNTHETIC_LIFECYCLE', identity_established: false, authority_created: false,
    external_effects_performed: false, error: null, result: { replay_matched: true,
      verified_receipt_hash: receipt.receipt_hash, verification_scope: 'LOCAL_SAME_SOURCE_REPRODUCTION',
      issuer_authenticity_established: false, independent_review_performed: false } };
  checkReplay(good, receipt);
  for (const change of [r => { r.result.replay_matched = false; },
    r => { r.result.verified_receipt_hash = 'sha256:' + '0'.repeat(64); },
    r => { r.result.issuer_authenticity_established = true; }]) {
    const altered = clone(good); change(altered);
    assert.throws(() => checkReplay(altered, receipt));
  }
});
