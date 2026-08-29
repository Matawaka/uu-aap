'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const Review = require('./contestability-review.js');
const input = JSON.parse(fs.readFileSync(require('node:path').join(__dirname, 'current-boundaries.input.json'), 'utf8'));

const report = Review.assess(input);
assert.strictEqual(report.outcome, 'INSUFFICIENT_EVIDENCE');
assert.deepStrictEqual(report.failed_dimensions, []);
assert.deepStrictEqual(report.insufficient_evidence_dimensions, [
  'private_evidence_challenge',
  'pseudonymous_challenger',
  'reputational_harm_after_correction',
  'unfair_registry_case',
]);
assert.strictEqual(report.p0_mapping.status, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(report.p0_mapping.blocking, false);
assert.strictEqual(report.p0_mapping.explicit_review_outcome, true);

const broken = structuredClone(input);
broken.observations.original_objection_preserved = false;
const brokenReport = Review.assess(broken);
assert.strictEqual(brokenReport.outcome, 'FAIL');
assert.ok(brokenReport.failed_dimensions.includes('objection_preservation'));
assert.strictEqual(brokenReport.p0_mapping.blocking, true);

const complete = structuredClone(input);
complete.observations.private_evidence_challenge_project_wide_covered = true;
complete.observations.pseudonymous_challenger_empirically_exercised = true;
complete.observations.reputational_harm_after_correction_addressed = true;
complete.observations.unfair_registry_case_empirically_exercised = true;
const completeReport = Review.assess(complete);
assert.strictEqual(completeReport.outcome, 'PASS');
assert.strictEqual(completeReport.p0_mapping.status, 'PASS');
assert.strictEqual(completeReport.p0_mapping.blocking, false);

const badClaim = structuredClone(input);
badClaim.claims.universal_contestability_proven = true;
assert.throws(() => Review.assess(badClaim), (error) => error.code === 'PROHIBITED_CLAIM');

const badBlob = structuredClone(input);
badBlob.reviewed_surfaces[0].blob_sha = '0'.repeat(40);
assert.throws(() => Review.assess(badBlob), (error) => error.code === 'SURFACE_BLOB_MISMATCH');

const missingObservation = structuredClone(input);
delete missingObservation.observations.challenge_not_negative_signal;
assert.throws(() => Review.assess(missingObservation), (error) => error.code === 'INVALID_OBSERVATION');

console.log('Contestability Review v0.1: PASS');
