const fs = require('fs');
const assert = require('assert');
const api = require('./execution-verification-sidecar.js');

const outputPath = process.argv[2] || '/tmp/execution-verification-sidecar.json';
const record = {
  protocol: 'PoAI',
  protocol_version: '0.0.1',
  profile: 'T',
  record_id: 'urn:poai:record:test:augmented-routing:1'
};
const before = JSON.stringify(record);

const supported = api.buildVerificationSidecar(record, {
  executionId: 'urn:poai:execution:b6afbc99',
  adjudicationId: 'urn:poai:adjudication:85d81be0',
  appealRequestId: 'urn:poai:appeal:02ff526c',
  verifierLabel: 'Synthetic independent verifier',
  method: 'system_log_review',
  result: 'supported',
  verifiedAt: '2026-08-22T16:40:00Z',
  evidenceCutoff: '2026-08-22T16:39:00Z',
  notes: 'Synthetic verification test.',
  sourceValidationStatus: 'PASS'
});

assert.strictEqual(JSON.stringify(record), before, 'source decision record must remain unchanged');
assert.strictEqual(supported.artifact_type, 'PoAIExecutionVerificationSidecar');
assert.strictEqual(supported.execution_id, 'urn:poai:execution:b6afbc99');
assert.strictEqual(supported.decision_record_id, record.record_id);
assert.strictEqual(supported.verifier.authority_status, 'unknown');
assert.strictEqual(supported.verifier.independence_status, 'unknown');
assert.strictEqual(supported.verification_method.code, 'system_log_review');
assert.strictEqual(supported.declared_verification_result.code, 'supported');
assert.strictEqual(supported.declared_verification_result.establishes_verified_execution, false);
assert.ok(Object.values(supported.claims).every(v => v === false), 'all verification claims must remain false');
assert.deepStrictEqual(api.validateVerificationSidecar(supported), []);
assert.strictEqual(Object.prototype.hasOwnProperty.call(supported, 'protocol'), false);
assert.strictEqual(api.deepHasProhibitedKey(supported), false);

const contradicted = api.buildVerificationSidecar(record, {
  executionId: 'urn:poai:execution:b6afbc99',
  method: 'document_review',
  result: 'contradicted',
  verifiedAt: '2026-08-22T16:41:00Z',
  sourceValidationStatus: 'PASS'
});
assert.strictEqual(contradicted.declared_verification_result.code, 'contradicted');
assert.notStrictEqual(contradicted.verification_id, supported.verification_id, 'plural verification artifacts must coexist');
assert.strictEqual(JSON.stringify(record), before, 'contradicted verification must not overwrite the source record');

assert.throws(() => api.buildVerificationSidecar(record, {
  executionId: 'urn:poai:execution:b6afbc99',
  verifiedAt: '2026-08-22T16:40:00Z',
  evidenceCutoff: '2026-08-22T16:41:00Z'
}), /must not be later than verified_at/);

const tampered = JSON.parse(JSON.stringify(supported));
tampered.verifier.independence_status = 'established';
assert.ok(api.validateVerificationSidecar(tampered).some(e => e.includes('independence_status')));

fs.writeFileSync(outputPath, `${JSON.stringify(supported, null, 2)}\n`);
console.log(`Execution Verification Sidecar tests passed: ${outputPath}`);
