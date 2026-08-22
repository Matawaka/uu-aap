const assert = require('assert');
const {
  ARTIFACT_VERSION,
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
const reviewedAtA = '2026-08-22T15:20:00Z';
const evidenceCutoffA = '2026-08-22T15:10:00Z';
const reviewA = buildReviewSidecar(source, {
  reviewedAt: reviewedAtA,
  evidenceCutoff: evidenceCutoffA,
  purpose: 'operational',
  cueCodes: ['authority_status_unknown', 'evidence_e0', 'authority_status_unknown'],
  reviewerLabel: 'Synthetic reviewer A',
  notes: 'Operational field review',
  sourceValidationStatus: 'PASS'
});

assert.strictEqual(JSON.stringify(source), before, 'building a review sidecar must not mutate the source record');
assert.strictEqual(reviewA.artifact_type, 'PoAIReviewSidecar');
assert.strictEqual(reviewA.artifact_version, ARTIFACT_VERSION);
assert.strictEqual(reviewA.reviewed_record_id, source.record_id);
assert.strictEqual(Date.parse(reviewA.reviewed_at), Date.parse(reviewedAtA));
assert.strictEqual(Date.parse(reviewA.review_horizon.evidence_cutoff), Date.parse(evidenceCutoffA));
assert(Date.parse(reviewA.review_horizon.evidence_cutoff) > Date.parse(source.decision_boundary.knowledge_cutoff), 'review evidence may be later than decision-time knowledge cutoff');
assert.strictEqual(reviewA.review_purpose, 'operational');
assert.deepStrictEqual(reviewA.observed_cues, [
  { code: 'authority_status_unknown' },
  { code: 'evidence_e0' }
]);
assert.deepStrictEqual(reviewA.review_relations, []);
assert.strictEqual(reviewA.reviewer.authority_status, 'unknown');
assert.strictEqual(reviewA.source_validation.status, 'PASS');
assert.strictEqual(reviewA.source_validation.truth_certified, false);
assert.strictEqual(reviewA.claims.truth_certified, false);
assert.strictEqual(reviewA.claims.causal_proof_certified, false);
assert.strictEqual(reviewA.claims.legal_responsibility_determined, false);
assert.strictEqual(reviewA.claims.authority_determined, false);
assert.strictEqual(reviewA.claims.canonical_verdict_established, false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(reviewA, 'decision_boundary'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(reviewA, 'knowledge_cutoff'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(reviewA, 'protocol'), false);
assert.strictEqual(deepHasProhibitedKey(reviewA), false);
assert.deepStrictEqual(validateReviewSidecar(reviewA), []);
assert.strictEqual(JSON.stringify(source), before, 'review-time horizon must not be injected into source record');

const sameMachineSemantics = buildReviewSidecar(source, {
  reviewedAt: reviewedAtA,
  evidenceCutoff: evidenceCutoffA,
  purpose: 'operational',
  cueCodes: ['evidence_e0', 'authority_status_unknown'],
  reviewerLabel: 'Synthetic reviewer A',
  notes: 'Operational field review',
  sourceValidationStatus: 'PASS'
});
assert.deepStrictEqual(sameMachineSemantics, reviewA, 'UI language must not affect sidecar machine semantics');

const reviewedAtB = '2026-08-22T15:30:00Z';
const reviewB = buildReviewSidecar(source, {
  reviewedAt: reviewedAtB,
  evidenceCutoff: '2026-08-22T15:25:00Z',
  purpose: 'publication',
  cueCodes: ['publication_artifact_binding_expected'],
  reviewerLabel: 'Synthetic reviewer B',
  relatedReviewRelation: 'challenges',
  relatedReviewId: reviewA.review_id,
  sourceValidationStatus: 'PASS'
});

assert.strictEqual(JSON.stringify(source), before, 'a second review must not mutate the source record');
assert.strictEqual(reviewB.reviewed_record_id, source.record_id);
assert.strictEqual(reviewB.review_purpose, 'publication');
assert.notStrictEqual(reviewB.review_id, reviewA.review_id, 'independent reviews need independent review IDs');
assert.deepStrictEqual(reviewB.review_relations, [{ relation: 'challenges', target_review_id: reviewA.review_id }]);
assert.strictEqual(reviewB.claims.canonical_verdict_established, false);
assert.deepStrictEqual(validateReviewSidecar(reviewB), []);

const futureCutoff = JSON.parse(JSON.stringify(reviewB));
futureCutoff.review_horizon.evidence_cutoff = '2026-08-22T15:31:00Z';
assert(validateReviewSidecar(futureCutoff).some((message) => message.includes('must not be later than reviewed_at')));

const selfChallenge = JSON.parse(JSON.stringify(reviewB));
selfChallenge.review_relations = [{ relation: 'challenges', target_review_id: selfChallenge.review_id }];
assert(validateReviewSidecar(selfChallenge).some((message) => message.includes('must not target the same review_id')));

const badRelation = JSON.parse(JSON.stringify(reviewB));
badRelation.review_relations = [{ relation: 'canonicalizes', target_review_id: reviewA.review_id }];
assert(validateReviewSidecar(badRelation).some((message) => message.includes('relation is invalid')));

const fakeReviewerAuthority = JSON.parse(JSON.stringify(reviewB));
fakeReviewerAuthority.reviewer.authority_status = 'accepted';
assert(validateReviewSidecar(fakeReviewerAuthority).some((message) => message.includes('authority_status must remain unknown')));

const polluted = JSON.parse(JSON.stringify(reviewA));
polluted.score = 0.84;
assert(validateReviewSidecar(polluted).some((message) => message.includes('prohibited')));

const masquerading = JSON.parse(JSON.stringify(reviewA));
masquerading.protocol = 'PoAI';
assert(validateReviewSidecar(masquerading).some((message) => message.includes('masquerade')));

if (process.argv[2]) {
  require('fs').writeFileSync(process.argv[2], `${JSON.stringify(reviewB, null, 2)}\n`);
}

console.log('PoAI Review Sidecar plurality and review-horizon tests passed.');
