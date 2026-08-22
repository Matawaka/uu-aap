const assert = require('assert');
const {
  buildAdjudicationSidecar,
  validateAdjudicationSidecar,
  deepHasProhibitedKey
} = require('./adjudication-sidecar.js');

const source = {
  protocol: 'PoAI',
  protocol_version: '0.0.1',
  profile: 'T',
  record_id: 'urn:poai:record:test:augmented-routing:1',
  decision_boundary: {
    opened_at: '2026-08-22T13:30:00Z',
    knowledge_cutoff: '2026-08-22T13:40:00Z',
    closed_at: '2026-08-22T13:45:00Z'
  }
};

const before = JSON.stringify(source);
const sidecar = buildAdjudicationSidecar(source, {
  appealRequestId: 'urn:poai:appeal:abc12345',
  decidedAt: '2026-08-22T16:10:00Z',
  evidenceCutoff: '2026-08-22T16:05:00Z',
  adjudicatorLabel: 'Synthetic adjudicator',
  disposition: 'accepted',
  directives: ['suspend_pending_review', 'issue_successor_record'],
  targetedReviewRefs: ['urn:poai:review:def67890'],
  notes: 'Synthetic adjudication test',
  sourceValidationStatus: 'PASS'
});

assert.strictEqual(JSON.stringify(source), before, 'building adjudication must not mutate source decision record');
assert.strictEqual(sidecar.artifact_type, 'PoAIAdjudicationSidecar');
assert.strictEqual(sidecar.decision_record_id, source.record_id);
assert.strictEqual(sidecar.appeal_request_id, 'urn:poai:appeal:abc12345');
assert.strictEqual(sidecar.declared_disposition.code, 'accepted');
assert.strictEqual(sidecar.declared_disposition.establishes_implementation, false);
assert.deepStrictEqual(sidecar.declared_directives, [
  { code: 'issue_successor_record', establishes_execution: false },
  { code: 'suspend_pending_review', establishes_execution: false }
]);
assert.strictEqual(sidecar.adjudicator.authority_status, 'unknown');
assert.strictEqual(sidecar.adjudicator.jurisdiction_status, 'unknown');
assert.strictEqual(sidecar.claims.implementation_established, false);
assert.strictEqual(sidecar.claims.execution_established, false);
assert.strictEqual(sidecar.claims.observed_outcome_established, false);
assert.strictEqual(sidecar.claims.legal_effect_established, false);
assert.strictEqual(sidecar.claims.canonical_verdict_established, false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sidecar, 'decision_boundary'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sidecar, 'review_horizon'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sidecar, 'appeal_horizon'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sidecar, 'protocol'), false);
assert.strictEqual(deepHasProhibitedKey(sidecar), false);
assert.deepStrictEqual(validateAdjudicationSidecar(sidecar), []);

const sameMachineSemantics = buildAdjudicationSidecar(source, {
  appealRequestId: 'urn:poai:appeal:abc12345',
  decidedAt: '2026-08-22T16:10:00Z',
  evidenceCutoff: '2026-08-22T16:05:00Z',
  adjudicatorLabel: 'Synthetic adjudicator',
  disposition: 'accepted',
  directives: ['issue_successor_record', 'suspend_pending_review'],
  targetedReviewRefs: ['urn:poai:review:def67890'],
  notes: 'Synthetic adjudication test',
  sourceValidationStatus: 'PASS'
});
assert.deepStrictEqual(sameMachineSemantics, sidecar, 'UI language/order must not alter adjudication machine semantics');

assert.throws(() => buildAdjudicationSidecar(source, {
  appealRequestId: 'urn:poai:appeal:abc12345',
  decidedAt: '2026-08-22T16:10:00Z',
  evidenceCutoff: '2026-08-22T16:11:00Z'
}), /must not be later than decided_at/);

const polluted = JSON.parse(JSON.stringify(sidecar));
polluted.score = 0.9;
assert(validateAdjudicationSidecar(polluted).some((message) => message.includes('prohibited')));

const falseAuthority = JSON.parse(JSON.stringify(sidecar));
falseAuthority.adjudicator.authority_status = 'accepted';
assert(validateAdjudicationSidecar(falseAuthority).some((message) => message.includes('authority_status')));

const falseExecution = JSON.parse(JSON.stringify(sidecar));
falseExecution.claims.execution_established = true;
assert(validateAdjudicationSidecar(falseExecution).some((message) => message.includes('must not establish')));

const masquerading = JSON.parse(JSON.stringify(sidecar));
masquerading.protocol = 'PoAI';
assert(validateAdjudicationSidecar(masquerading).some((message) => message.includes('masquerade')));

if (process.argv[2]) {
  require('fs').writeFileSync(process.argv[2], `${JSON.stringify(sidecar, null, 2)}\n`);
}

console.log('PoAI Adjudication Sidecar separation tests passed.');
