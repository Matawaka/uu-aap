'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const ReReview = require('./accessibility-rereview.js');

const input = JSON.parse(fs.readFileSync('review/accessibility/v0.2/current-surfaces.input.json', 'utf8'));
const report = ReReview.assess(input);

assert.strictEqual(report.outcome, 'INSUFFICIENT_EVIDENCE');
assert.deepStrictEqual(report.failed_dimensions, []);
assert.deepStrictEqual(report.insufficient_evidence_dimensions, ['zoom_reflow', 'screen_reader', 'language_presentation']);
assert.strictEqual(report.p0_mapping.status, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(report.p0_mapping.blocking, false);
assert.strictEqual(report.predecessor_blocking_findings_resolved, true);
assert.deepStrictEqual(report.remaining_blocking_findings, []);
assert.deepStrictEqual(
  report.remediation_findings.map((x) => [x.finding_id, x.status]),
  [
    ['color_contrast', 'RESOLVED'],
    ['dynamic_status_announcements', 'RESOLVED'],
  ]
);
assert(report.contrast_checks.every((check) => check.pass));
assert.strictEqual(report.reused_assessment_semantics, 'review/accessibility/v0.1/accessibility-review.js');

const badContrast = structuredClone(input);
badContrast.contrast_checks[2].foreground = '#ffffff';
const failed = ReReview.assess(badContrast);
assert.strictEqual(failed.outcome, 'FAIL');
assert(failed.failed_dimensions.includes('color_contrast'));
assert.strictEqual(failed.p0_mapping.blocking, true);
assert.strictEqual(failed.remediation_findings.find((x) => x.finding_id === 'color_contrast').status, 'UNRESOLVED');

const missingLive = structuredClone(input);
missingLive.observations.dynamic_status_live_region_present = false;
const incomplete = ReReview.assess(missingLive);
assert.strictEqual(incomplete.outcome, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(incomplete.remediation_findings.find((x) => x.finding_id === 'dynamic_status_announcements').status, 'UNRESOLVED');

const fullyTested = structuredClone(input);
fullyTested.observations.zoom_reflow_empirical_tested = true;
fullyTested.observations.screen_reader_empirical_tested = true;
fullyTested.observations.language_accessibility_empirical_tested = true;
fullyTested.limitations = [];
const pass = ReReview.assess(fullyTested);
assert.strictEqual(pass.outcome, 'PASS');
assert.strictEqual(pass.p0_mapping.status, 'PASS');
assert.strictEqual(pass.p0_mapping.blocking, false);

const tamperedPredecessor = structuredClone(input);
tamperedPredecessor.predecessor_review.outcome = 'PASS';
assert.throws(() => ReReview.assess(tamperedPredecessor), /predecessor outcome must remain FAIL/);

const wrongOrigin = structuredClone(input);
wrongOrigin.origin_frontier = '0000000000000000000000000000000000000000';
assert.throws(() => ReReview.assess(wrongOrigin), /origin_frontier/);

const unverified = structuredClone(input);
unverified.surface_equivalence_verified = false;
assert.throws(() => ReReview.assess(unverified), /surface equivalence/);

for (const key of ['wcag_conformance_certified','universal_accessibility_proven','legal_compliance_established','release_authorized','publication_authorized','authority_created','runtime_activated']) {
  assert.strictEqual(report[key], false, `${key} must remain false`);
}

console.log('Accessibility Re-review v0.2 tests: PASS');
