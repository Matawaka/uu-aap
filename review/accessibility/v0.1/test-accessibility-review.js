'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Review = require('./accessibility-review.js');

const input = JSON.parse(fs.readFileSync(path.join(__dirname, 'current-surfaces.input.json'), 'utf8'));
const report = Review.assess(input);

assert.strictEqual(report.outcome, 'FAIL');
assert.strictEqual(report.p0_mapping.status, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(report.p0_mapping.blocking, true);
assert(report.failed_dimensions.includes('color_contrast'));
assert(report.insufficient_evidence_dimensions.includes('dynamic_status_announcements'));
assert(report.insufficient_evidence_dimensions.includes('zoom_reflow'));
assert(report.insufficient_evidence_dimensions.includes('screen_reader'));
assert(report.insufficient_evidence_dimensions.includes('language_presentation'));

const muted = report.contrast_checks.find((x) => x.id === 'light-muted-on-surface-2');
const darkButton = report.contrast_checks.find((x) => x.id === 'dark-active-button-white-on-accent');
assert(muted.ratio > 4.4 && muted.ratio < 4.5);
assert(darkButton.ratio > 2.4 && darkButton.ratio < 2.6);
assert.strictEqual(muted.pass, false);
assert.strictEqual(darkButton.pass, false);

for (const key of ['wcag_conformance_certified','universal_accessibility_proven','legal_compliance_established','release_authorized','authority_created','runtime_activated']) {
  assert.strictEqual(report[key], false);
}

const contrastFixed = JSON.parse(JSON.stringify(input));
contrastFixed.contrast_checks = [
  { id: 'light-muted-on-surface-2', foreground: '#626d7a', background: '#f0f2f5', threshold: 4.5 },
  { id: 'dark-active-button-dark-on-accent', foreground: '#0e1116', background: '#7aa2ff', threshold: 4.5 },
];
const insufficient = Review.assess(contrastFixed);
assert.strictEqual(insufficient.outcome, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(insufficient.p0_mapping.blocking, false);

const allPass = JSON.parse(JSON.stringify(contrastFixed));
allPass.observations.dynamic_status_live_region_present = true;
allPass.observations.zoom_reflow_empirical_tested = true;
allPass.observations.screen_reader_empirical_tested = true;
allPass.observations.language_accessibility_empirical_tested = true;
allPass.limitations = [];
assert.strictEqual(Review.assess(allPass).outcome, 'PASS');
assert.strictEqual(Review.assess(allPass).p0_mapping.status, 'PASS');

const limited = JSON.parse(JSON.stringify(allPass));
limited.limitations = ['host_mediated_terminal_surface'];
assert.strictEqual(Review.assess(limited).outcome, 'PASS_WITH_LIMITATIONS');
assert.strictEqual(Review.assess(limited).p0_mapping.status, 'INSUFFICIENT_EVIDENCE');

const staleSurface = JSON.parse(JSON.stringify(input));
staleSurface.surface_equivalence_verified = false;
assert.throws(() => Review.assess(staleSurface), /surface equivalence/);

const duplicateSurface = JSON.parse(JSON.stringify(input));
duplicateSurface.reviewed_surfaces[1].path = duplicateSurface.reviewed_surfaces[0].path;
assert.throws(() => Review.assess(duplicateSurface), /duplicate reviewed surface/);

const overclaim = JSON.parse(JSON.stringify(input));
overclaim.claims.wcag_conformance_certified = true;
assert.throws(() => Review.assess(overclaim), /must remain false/);

const semanticFailure = JSON.parse(JSON.stringify(contrastFixed));
semanticFailure.observations.semantic_structure_present = false;
assert.strictEqual(Review.assess(semanticFailure).outcome, 'FAIL');

console.log('Accessibility Review v0.1 tests: PASS');
