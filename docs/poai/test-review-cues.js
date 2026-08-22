const assert = require('assert');
const { evaluateReviewCues } = require('./review-cues.js');

const record = {
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
  artifact_binding: { status: 'not_bound', sha256: null }
};

const cues = evaluateReviewCues(record);
const codes = cues.map((item) => item.code);
assert(codes.includes('authority_status_unknown'));
assert(codes.includes('consideration_unknown'));
assert(codes.includes('used_without_established_availability'));
assert(codes.includes('future_target_not_declared'));
assert(codes.includes('evidence_e0'));
assert(codes.includes('artifact_not_bound'));
assert.strictEqual(cues.some((item) => Object.prototype.hasOwnProperty.call(item, 'score')), false, 'review cues must not emit scalar scores');
assert.strictEqual(cues.find((item) => item.code === 'consideration_unknown').meta.count, 1);

const resolved = evaluateReviewCues({
  authority: [{ actor_id: 'human:test', scopes: ['decide'], status: 'accepted' }],
  intelligence_resources: [{ resource_id: 'r1' }],
  availability: [{ resource_id: 'r1', overall_status: 'available' }],
  consideration: [{ resource_id: 'r1', status: 'considered' }],
  evidence: [{ evidence_id: 'e1', class: 'E2' }],
  future_target: { future_target_id: 'f1', label: 'Future event', epistemic_status: 'probable' },
  artifact_binding: { status: 'bound', sha256: 'a'.repeat(64) }
});
assert.deepStrictEqual(resolved, []);

console.log('PoAI non-scalar review cue tests passed.');
