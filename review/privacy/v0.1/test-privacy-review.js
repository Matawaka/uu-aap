'use strict';

const assert = require('node:assert');
const Review = require('./privacy-review.js');
const input = require('./current-boundaries.input.json');

const base = Review.assess(input);
assert.strictEqual(base.outcome, 'INSUFFICIENT_EVIDENCE');
assert.deepStrictEqual(base.failed_dimensions, []);
assert.deepStrictEqual(base.insufficient_evidence_dimensions, [
  'private_audit_retention_deletion',
  'anti_surveillance_authenticity_policy',
  'project_wide_coercive_collection_assessment',
]);
assert.strictEqual(base.p0_mapping.status, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(base.p0_mapping.blocking, false);
assert.strictEqual(base.p0_mapping.explicit_review_outcome, true);
for (const id of ['browser_local_processing','personal_data_minimization','identity_targeting_boundary','profiling_history_minimization']) {
  assert.strictEqual(base.dimensions.find((x) => x.dimension_id === id).status, 'PASS');
}

const defect = JSON.parse(JSON.stringify(input));
defect.observations.identity_resolution_unavailable = false;
const failed = Review.assess(defect);
assert.strictEqual(failed.outcome, 'FAIL');
assert(failed.failed_dimensions.includes('identity_targeting_boundary'));
assert.strictEqual(failed.p0_mapping.blocking, true);

const complete = JSON.parse(JSON.stringify(input));
complete.observations.private_audit_retention_policy_current = true;
complete.observations.private_audit_deletion_policy_current = true;
complete.observations.surveillance_authenticity_escalation_forbidden = true;
complete.observations.repository_wide_coercive_collection_assessed = true;
const passed = Review.assess(complete);
assert.strictEqual(passed.outcome, 'PASS');
assert.strictEqual(passed.p0_mapping.status, 'PASS');
assert.strictEqual(passed.p0_mapping.blocking, false);

const stale = JSON.parse(JSON.stringify(input));
stale.origin_frontier = '0'.repeat(40);
assert.throws(() => Review.assess(stale), /origin_frontier/);

const overclaim = JSON.parse(JSON.stringify(input));
overclaim.claims.absence_of_surveillance_proven = true;
assert.throws(() => Review.assess(overclaim), /must remain false/);

console.log('Privacy / Anti-Coercion Review v0.1 tests: PASS');
