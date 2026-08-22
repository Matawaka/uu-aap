const assert = require('assert');
const {
  buildAppealSidecar,
  validateAppealSidecar,
  deepHasProhibitedKey
} = require('./appeal-sidecar.js');

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
const filedAt = '2026-08-22T16:00:00Z';
const decisionAppeal = buildAppealSidecar(source, {
  filedAt,
  evidenceCutoff: '2026-08-22T15:50:00Z',
  appellantLabel: 'Affected participant',
  grounds: ['future_intervention_dispute'],
  requestedAction: 'suspend_pending_review',
  targets: [{ target_type: 'decision_record', target_id: source.record_id }],
  notes: 'Synthetic pre-event challenge',
  sourceValidationStatus: 'PASS'
});

assert.strictEqual(JSON.stringify(source), before, 'appeal export must not mutate the source record');
assert.strictEqual(decisionAppeal.artifact_type, 'PoAIAppealRequestSidecar');
assert.strictEqual(decisionAppeal.decision_record_id, source.record_id);
assert.strictEqual(decisionAppeal.targets.length, 1);
assert.strictEqual(decisionAppeal.targets[0].target_type, 'decision_record');
assert.strictEqual(decisionAppeal.targets[0].target_id, source.record_id);
assert.strictEqual(decisionAppeal.appellant.authority_status, 'unknown');
assert.strictEqual(decisionAppeal.appellant.standing_status, 'unknown');
assert.strictEqual(decisionAppeal.requested_action.code, 'suspend_pending_review');
assert.strictEqual(decisionAppeal.requested_action.establishes_effect, false);
assert.strictEqual(decisionAppeal.claims.appeal_accepted, false);
assert.strictEqual(decisionAppeal.claims.stay_established, false);
assert.strictEqual(decisionAppeal.claims.decision_reversed, false);
assert.strictEqual(decisionAppeal.claims.review_reversed, false);
assert.strictEqual(decisionAppeal.claims.legal_effect_established, false);
assert.strictEqual(decisionAppeal.claims.authority_determined, false);
assert.strictEqual(decisionAppeal.claims.standing_determined, false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(decisionAppeal, 'decision_boundary'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(decisionAppeal, 'knowledge_cutoff'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(decisionAppeal, 'review_horizon'), false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(decisionAppeal, 'protocol'), false);
assert.strictEqual(deepHasProhibitedKey(decisionAppeal), false);
assert.deepStrictEqual(validateAppealSidecar(decisionAppeal), []);

const reviewId = 'urn:poai:review:abc12345';
const reviewAppeal = buildAppealSidecar(source, {
  filedAt,
  evidenceCutoff: '2026-08-22T15:55:00Z',
  grounds: ['authority_dispute'],
  requestedAction: 'review_authority',
  targets: [{ target_type: 'review_artifact', target_id: reviewId }],
  sourceValidationStatus: 'PASS'
});
assert.strictEqual(reviewAppeal.decision_record_id, source.record_id);
assert.deepStrictEqual(reviewAppeal.targets, [{ target_type: 'review_artifact', target_id: reviewId }]);
assert.deepStrictEqual(validateAppealSidecar(reviewAppeal), []);
assert.notStrictEqual(reviewAppeal.appeal_id, decisionAppeal.appeal_id);

assert.throws(() => buildAppealSidecar(source, {
  filedAt,
  evidenceCutoff: '2026-08-22T16:01:00Z',
  grounds: ['new_evidence']
}), /must not be later than filed_at/);

const badReviewTarget = JSON.parse(JSON.stringify(reviewAppeal));
badReviewTarget.targets = [{ target_type: 'review_artifact', target_id: 'not-a-review-id' }];
assert(validateAppealSidecar(badReviewTarget).some((message) => message.includes('review_artifact')));

const badDecisionTarget = JSON.parse(JSON.stringify(decisionAppeal));
badDecisionTarget.targets = [{ target_type: 'decision_record', target_id: 'urn:poai:record:other:1' }];
assert(validateAppealSidecar(badDecisionTarget).some((message) => message.includes('must match decision_record_id')));

const polluted = JSON.parse(JSON.stringify(decisionAppeal));
polluted.score = 0.5;
assert(validateAppealSidecar(polluted).some((message) => message.includes('prohibited')));

const masquerading = JSON.parse(JSON.stringify(decisionAppeal));
masquerading.protocol = 'PoAI';
assert(validateAppealSidecar(masquerading).some((message) => message.includes('masquerade')));

const fakeStanding = JSON.parse(JSON.stringify(decisionAppeal));
fakeStanding.appellant.standing_status = 'accepted';
assert(validateAppealSidecar(fakeStanding).some((message) => message.includes('standing_status')));

if (process.argv[2]) {
  require('fs').writeFileSync(process.argv[2], `${JSON.stringify(decisionAppeal, null, 2)}\n`);
}

console.log('PoAI Appeal Request Sidecar separation tests passed.');
