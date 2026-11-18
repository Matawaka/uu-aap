'use strict';

// Separate consumer checker: never imports the engine or its result constructors.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const agentDir = path.resolve(__dirname, '../agent-v0.1');
const agentRequire = createRequire(path.join(agentDir, 'package.json'));
const Ajv = agentRequire('ajv/dist/2020');
const contract = JSON.parse(fs.readFileSync(path.join(agentDir, 'contract.schema.json'), 'utf8'));
const ajv = new Ajv({ strict: true, validateFormats: false });
ajv.addSchema(contract);
const validResponse = ajv.getSchema(`${contract.$id}#/$defs/response`);
const falseFields = ['identity_established', 'causal_continuity_proven', 'guilt_established',
  'authority_created', 'live_permit_consumed', 'action_performed', 'biometric_model_executed'];
const arms = ['fresh_boundary', 'cached_boundary'];
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort()
    .map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const hash = v => 'sha256:' + crypto.createHash('sha256').update(stable(v)).digest('hex');
const fileHash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
function checkHash(record, field) {
  const copy = structuredClone(record); delete copy[field];
  assert.equal(record[field], hash(copy), `${field} differs`);
}
function expectedSource() {
  const pins = JSON.parse(fs.readFileSync(path.join(__dirname, 'interface-pins.json'), 'utf8'));
  const root = path.resolve(__dirname, '../../../../../..');
  for (const [name, digest] of Object.entries(pins.interface_files)) {
    assert.equal(fileHash(path.join(agentDir, name)), digest, `interface pin ${name}`);
  }
  const engine = JSON.parse(fs.readFileSync(path.join(agentDir, 'engine-pins.json'), 'utf8'));
  for (const [name, digest] of Object.entries(engine.source_sha256)) {
    assert.equal(fileHash(path.join(root, name)), digest, `engine pin ${name}`);
  }
  return { experiment_frontier: engine.frontier,
    experiment_source_hash: hash(engine.source_sha256),
    interface_source_hash: hash(pins.interface_files),
    canonicalization: 'COMPONENT_LOCAL_SORTED_JSON_V0_1' };
}
function project(row) {
  return { response_status: row.response_status, contract_status: row.contract_status,
    contract_reason: row.contract_reason };
}
function nonEffects(value) {
  for (const field of falseFields) assert.equal(value[field], false, field);
}
function checkEnvelope(response, operation) {
  assert.equal(validResponse(response), true, 'closed response contract');
  assert.equal(response.execution_status, 'COMPLETED', 'computation failed');
  assert.equal(response.operation, operation);
  for (const k of ['identity_established', 'authority_created', 'external_effects_performed']) {
    assert.equal(response[k], false, k);
  }
}
function checkReceipt(response, trialCase, operation = 'experiment.compare', arm = null) {
  checkEnvelope(response, operation);
  const receipt = response.result.receipt;
  checkHash(receipt, 'receipt_hash'); nonEffects(receipt);
  const p = receipt.payload;
  assert.equal(p.operation, operation);
  assert.deepEqual(p.source, expectedSource());
  assert.deepEqual(p.input, { scenario: trialCase.scenario }, 'receipt must bind this exact case');
  assert.equal(p.hypothesis, trialCase.hypothesis);
  assert.equal(p.hypothesis_authority, 'UNASSESSED_CALLER_STATEMENT');
  const selected = operation === 'experiment.compare' ? arms : [arm];
  assert.deepEqual(p.arms, selected);
  assert.deepEqual(p.observations.map(o => o.arm), selected);
  assert.deepEqual(p.reference_expectations, selected.map(a => ({ arm: a, status: 'NO_TRUSTED_EXPECTATION' })));
  const statements = [];
  for (const observation of p.observations) {
    assert.equal(observation.scenario_id, trialCase.scenario.id);
    assert.equal(observation.scenario_hash, hash(trialCase.scenario));
    nonEffects(observation);
    assert.deepEqual(observation.receipts.map(project), trialCase.expected[observation.arm],
      `predeclared oracle differs: ${trialCase.id}/${observation.arm}`);
    for (const row of observation.receipts) {
      checkHash(row, 'receipt_hash'); nonEffects(row);
      // Evidence recorded and contract readiness are distinct, and neither is permission.
      const disposition = observation.arm === 'cached_boundary' ? 'NEGATIVE_CONTROL_ONLY' :
        row.response_status === 'RECORDED_EVIDENCE_ONLY' && row.contract_status === 'READY' ?
          'MODEL_EVIDENCE_ONLY' : 'MODEL_HOLD';
      statements.push({ arm: observation.arm, request_id: row.request_id,
        response_status: row.response_status, contract_status: row.contract_status,
        response_assessment: row.response_assessment, disposition });
    }
  }
  if (selected.length === 2) {
    const a = p.observations[0].receipts, b = p.observations[1].receipts;
    const differences = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const fresh = a[i] ? project(a[i]) : null, cached = b[i] ? project(b[i]) : null;
      if (stable(fresh) !== stable(cached)) differences.push({ index: i,
        fresh_boundary: fresh, cached_boundary: cached });
    }
    assert.deepEqual(p.comparison, differences);
  } else assert.equal(p.comparison, null);
  return { receipt_hash: receipt.receipt_hash, statements,
    identity_established: false, authority_created: false, action_authorized: false,
    guilt_established: false, safe_to_act: false, independent_review_performed: false,
    end_to_end_status: 'NOT_EXECUTED' };
}
function checkClaim(claim, checked) {
  // A closed structured statement, not natural-language understanding or authority issuance.
  assert.deepEqual(claim, checked, 'unsupported or incorrectly bound consumer conclusion');
  return true;
}
function checkReplay(response, receipt) {
  checkEnvelope(response, 'experiment.replay');
  assert.deepEqual(response.result, { replay_matched: true,
    verified_receipt_hash: receipt.receipt_hash,
    verification_scope: 'LOCAL_SAME_SOURCE_REPRODUCTION',
    issuer_authenticity_established: false, independent_review_performed: false });
}
module.exports = { checkReceipt, checkClaim, checkReplay, checkEnvelope, expectedSource,
  hash, fileHash, stable, agentDir, agentRequire };
