const assert = require('assert');
const {
  buildReviewSidecar,
  validateReviewSidecar,
  deepHasProhibitedKey
} = require('./review-sidecar.js');

const source = {
  protocol: 'PoAI',
  protocol_version: '0.0.1',
  profile: 'T',
  record_id: 'urn:poai:record:test:augmented-routing:1',
  decision_boundary: {
    opened_at: '2026-08-22T13:30:00Z',
    knowledge_cutoff: '2026-08-22T13:40:00Z',
    closed_at: '2026-08-22T13:45:00Z'
  },
  artifact_binding: { status: 'not_bound', sha256: null }
};

const before = JSON.stringify(source);
const reviewedAt = '2026-08-22T15:20:00Z';
const sidecar = buildReviewSidecar(source, {
  reviewedAt,
  purpose: 'operational',
  cueCodes: ['authority_status_unknown', 'evidence_e0', 'authority_status_unknown'],
  reviewerLabel: 'Synthetic reviewer',
  notes: 'Field test',
  sourceValidationStatus: 'PASS'
});

assert.strictEqual(JSON.stringify(source), before, 'building a review sidecar must not mutate the source record');
assert.strictEqual(sidecar.artifact_type, 'PoAIReviewSidecar');
assert.strictEqual(sidecar.reviewed_record_id, source.record_id);
assert.strictEqual(Date.parse(sidecar.reviewed_at), Date.parse(reviewedAt));
assert.strictEqual(sidecar.review_purpose, 'operational');
assert.deepStrictEqual(sidecar.observed_cues, [
  { code: 'authority_status_unknown' },
  { code: 'evidence_e0' }
]);
assert.strictEqual(sidecar.source_validation.status, 'PASS');
assert.strictEqual(sidecar.source_validation.truth_certified, false);
assert.strictEqual(sidecar.claims.truth_certified, false);
assert.strictEqual(sidecar.claims.causal_proof_certified, false);
assert.strictEqual(sidecar.claims.legal_responsibility_determined, false);
assert.strictEqual(sidecar.claims.authority_determined, false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sidecar, 'decision_boundary'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sidecar, 'knowledge_cutoff'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sidecar, 'protocol'), false);
assert.strictEqual(deepHasProhibitedKey(sidecar), false);
assert.deepStrictEqual(validateReviewSidecar(sidecar), []);

const sameMachineSemantics = buildReviewSidecar(source, {
  reviewedAt,
  purpose: 'operational',
  cueCodes: ['evidence_e0', 'authority_status_unknown'],
  reviewerLabel: 'Synthetic reviewer',
  notes: 'Field test',
  sourceValidationStatus: 'PASS'
});
assert.deepStrictEqual(sameMachineSemantics, sidecar, 'UI language must not affect sidecar machine semantics');

const differentPurpose = buildReviewSidecar(source, {
  reviewedAt,
  purpose: 'publication',
  cueCodes: ['publication_artifact_binding_expected'],
  sourceValidationStatus: 'PASS'
});
assert.strictEqual(differentPurpose.reviewed_record_id, source.record_id);
assert.strictEqual(differentPurpose.review_purpose, 'publication');
assert.notStrictEqual(differentPurpose.review_id, sidecar.review_id);

const polluted = JSON.parse(JSON.stringify(sidecar));
polluted.score = 0.84;
assert(validateReviewSidecar(polluted).some((message) => message.includes('prohibited')));

const masquerading = JSON.parse(JSON.stringify(sidecar));
masquerading.protocol = 'PoAI';
assert(validateReviewSidecar(masquerading).some((message) => message.includes('masquerade')));

if (process.argv[2]) {
  require('fs').writeFileSync(process.argv[2], `${JSON.stringify(sidecar, null, 2)}\n`);
}

console.log('PoAI Review Sidecar separation tests passed.');
