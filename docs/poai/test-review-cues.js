const assert = require('assert');
const { PURPOSES, evaluateReviewCues, purposeKey } = require('./review-cues.js');

const record = {
  decision_boundary: {
    opened_at: '2026-08-22T13:30:00Z',
    closed_at: '2026-08-22T13:45:00Z',
    knowledge_cutoff: '2026-08-22T13:40:00Z',
    status: 'live_record'
  },
  authority: [{ actor_id: 'human:test', scopes: ['observe', 'decide'], status: 'unknown' }],
  intelligence_resources: [
    { resource_id: 'r1', resource_type: 'human_judgment' },
    { resource_id: 'r2', resource_type: 'forecasting_model' },
    { resource_id: 'r3', resource_type: 'expert_group' }
  ],
  availability: [
    { resource_id: 'r1', overall_status: 'available' },
    { resource_id: 'r2', overall_status: 'partially_available' },
    { resource_id: 'r3', overall_status: 'unknown' }
  ],
  consideration: [
    { resource_id: 'r1', status: 'relied_upon' },
    { resource_id: 'r2', status: 'unknown' },
    { resource_id: 'r3', status: 'invoked' }
  ],
  evidence: [
    { evidence_id: 'e1', class: 'E0' },
    { evidence_id: 'e2', class: 'E0' },
    { evidence_id: 'e3', class: 'E0' }
  ],
  future_target: null,
  outcome: { status: 'not_applicable' },
  contestability: { channel_available: false, channel: null },
  artifact_binding: { status: 'not_bound', sha256: null }
};

assert.strictEqual(purposeKey('not-a-purpose'), 'generic');
assert(Object.keys(PURPOSES).includes('future_intervention'));

const generic = evaluateReviewCues(record);
const genericCodes = generic.map((item) => item.code);
assert(genericCodes.includes('authority_status_unknown'));
assert(genericCodes.includes('consideration_unknown'));
assert(genericCodes.includes('used_without_established_availability'));
assert(genericCodes.includes('future_target_not_declared'));
assert(genericCodes.includes('evidence_e0'));
assert(genericCodes.includes('artifact_not_bound'));
assert.strictEqual(generic.some((item) => Object.prototype.hasOwnProperty.call(item, 'score')), false, 'review cues must not emit scalar scores');
assert.strictEqual(generic.find((item) => item.code === 'consideration_unknown').meta.count, 1);

const operational = evaluateReviewCues(record, 'operational').map((item) => item.code);
assert(!operational.includes('future_target_not_declared'), 'operational review should not generically require a Future Target');
assert(!operational.includes('artifact_not_bound'), 'operational review should not generically require artifact binding');
assert(!operational.includes('operational_knowledge_cutoff_expected'), 'record already has a Knowledge Cutoff');

const future = evaluateReviewCues(record, 'future_intervention').map((item) => item.code);
assert(future.includes('future_target_expected_for_purpose'));
assert(future.includes('future_outcome_trace_expected'));
assert(future.includes('future_contestability_channel_expected'));
assert(!future.includes('artifact_not_bound'));

const historical = evaluateReviewCues(record, 'historical').map((item) => item.code);
assert(historical.includes('historical_boundary_status_expected'));
assert(!historical.includes('future_target_not_declared'));
assert(!historical.includes('artifact_not_bound'));

const publication = evaluateReviewCues(record, 'publication').map((item) => item.code);
assert(publication.includes('publication_artifact_binding_expected'));
assert(publication.includes('publication_contestability_channel_expected'));
assert(!publication.includes('future_target_not_declared'));

const resolved = {
  decision_boundary: {
    opened_at: '2026-08-22T13:30:00Z',
    closed_at: '2026-08-22T13:45:00Z',
    knowledge_cutoff: '2026-08-22T13:40:00Z',
    status: 'historical_reconstruction'
  },
  authority: [{ actor_id: 'human:test', scopes: ['decide'], status: 'accepted' }],
  intelligence_resources: [{ resource_id: 'r1' }],
  availability: [{ resource_id: 'r1', overall_status: 'available' }],
  consideration: [{ resource_id: 'r1', status: 'considered' }],
  evidence: [{ evidence_id: 'e1', class: 'E2' }],
  future_target: { future_target_id: 'f1', label: 'Future event', epistemic_status: 'probable' },
  outcome: { status: 'not_yet_observable' },
  contestability: { channel_available: true, channel: 'https://example.test/review' },
  artifact_binding: { status: 'bound', sha256: 'a'.repeat(64) }
};
assert.deepStrictEqual(evaluateReviewCues(resolved, 'generic'), []);
assert.deepStrictEqual(evaluateReviewCues(resolved, 'historical'), []);
assert.deepStrictEqual(evaluateReviewCues(resolved, 'publication'), []);
assert.deepStrictEqual(evaluateReviewCues(resolved, 'future_intervention'), []);

console.log('PoAI purpose-relative, non-scalar review cue tests passed.');
