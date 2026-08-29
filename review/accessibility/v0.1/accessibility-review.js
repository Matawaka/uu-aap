'use strict';

const fs = require('node:fs');

const VERSION = '0.1';
const INPUT_TYPE = 'UU-AAP-Accessibility-Review-Input';
const REPORT_TYPE = 'UU-AAP-Accessibility-Review';
const REQUIRED_SURFACES = Object.freeze([
  'docs/index.html',
  'docs/poai/index.html',
  'docs/poai/accessibility.js',
  'docs/poai/styles.css',
]);
const DIMENSIONS = Object.freeze([
  'scope_coverage',
  'semantic_structure',
  'keyboard_focus',
  'dynamic_status_announcements',
  'color_contrast',
  'zoom_reflow',
  'screen_reader',
  'language_presentation',
]);
const NON_EFFECTS = Object.freeze([
  'accessibility_review_does_not_certify_wcag_conformance',
  'accessibility_review_does_not_prove_universal_accessibility',
  'accessibility_review_does_not_establish_legal_compliance',
  'accessibility_review_does_not_test_every_assistive_technology',
  'accessibility_review_does_not_release_or_publish',
  'accessibility_review_does_not_create_authority',
  'accessibility_review_does_not_activate_runtime',
  'accessibility_review_does_not_execute_product_actions',
]);

class AccessibilityReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AccessibilityReviewError';
    this.code = code;
  }
}

function req(condition, code, message) {
  if (!condition) throw new AccessibilityReviewError(code, message);
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function channel(value) {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  req(/^#[0-9a-fA-F]{6}$/.test(hex), 'INVALID_COLOR', `invalid color ${hex}`);
  const r = channel(parseInt(hex.slice(1, 3), 16));
  const g = channel(parseInt(hex.slice(3, 5), 16));
  const b = channel(parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

function validateInput(input) {
  req(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INPUT', 'input must be object');
  req(input.artifact_type === INPUT_TYPE, 'INVALID_ARTIFACT_TYPE', `artifact_type must be ${INPUT_TYPE}`);
  req(input.version === VERSION, 'INVALID_VERSION', `version must be ${VERSION}`);
  req(isSha(input.origin_frontier), 'INVALID_ORIGIN', 'origin_frontier must be 40-hex');
  req(isSha(input.reviewed_revision), 'INVALID_REVIEWED_REVISION', 'reviewed_revision must be 40-hex');
  req(input.surface_equivalence_verified === true, 'UNVERIFIED_SURFACE_EQUIVALENCE', 'reviewed surface equivalence must be externally verified');
  req(Array.isArray(input.reviewed_surfaces), 'INVALID_SURFACES', 'reviewed_surfaces must be array');
  const paths = input.reviewed_surfaces.map((x) => x && x.path);
  req(new Set(paths).size === paths.length, 'DUPLICATE_SURFACE', 'duplicate reviewed surface');
  req(JSON.stringify([...paths].sort()) === JSON.stringify([...REQUIRED_SURFACES].sort()), 'SURFACE_SET_MISMATCH', 'reviewed surface set mismatch');
  for (const surface of input.reviewed_surfaces) {
    req(typeof surface.blob_sha === 'string' && /^[0-9a-f]{40}$/.test(surface.blob_sha), 'INVALID_SURFACE_BLOB', `invalid blob for ${surface.path}`);
  }
  req(input.observations && typeof input.observations === 'object', 'INVALID_OBSERVATIONS', 'observations required');
  for (const key of [
    'scope_coverage_complete', 'semantic_structure_present', 'keyboard_navigation_present', 'focus_visibility_present',
    'dynamic_status_live_region_present', 'responsive_reflow_rules_present', 'zoom_reflow_empirical_tested',
    'screen_reader_empirical_tested', 'language_presentation_controls_present', 'language_accessibility_empirical_tested'
  ]) req(typeof input.observations[key] === 'boolean', 'INVALID_OBSERVATION', `${key} must be boolean`);
  req(Array.isArray(input.contrast_checks) && input.contrast_checks.length > 0, 'INVALID_CONTRAST_CHECKS', 'contrast_checks required');
  for (const check of input.contrast_checks) {
    req(typeof check.id === 'string' && check.id.length > 0, 'INVALID_CONTRAST_ID', 'contrast check id required');
    req(typeof check.threshold === 'number' && check.threshold > 0, 'INVALID_CONTRAST_THRESHOLD', 'contrast threshold must be positive');
    luminance(check.foreground); luminance(check.background);
  }
  req(Array.isArray(input.limitations), 'INVALID_LIMITATIONS', 'limitations must be array');
  req(input.claims && typeof input.claims === 'object', 'INVALID_CLAIMS', 'claims required');
  for (const key of ['wcag_conformance_certified','universal_accessibility_proven','legal_compliance_established','all_assistive_technologies_tested']) {
    req(input.claims[key] === false, 'PROHIBITED_CLAIM', `${key} must remain false`);
  }
  return input;
}

function assess(input) {
  validateInput(input);
  const o = input.observations;
  const contrast = input.contrast_checks.map((check) => {
    const ratio = contrastRatio(check.foreground, check.background);
    return { ...check, ratio, pass: ratio >= check.threshold };
  });
  const dimensions = [
    { dimension_id: 'scope_coverage', status: o.scope_coverage_complete ? 'PASS' : 'FAIL' },
    { dimension_id: 'semantic_structure', status: o.semantic_structure_present ? 'PASS' : 'FAIL' },
    { dimension_id: 'keyboard_focus', status: (o.keyboard_navigation_present && o.focus_visibility_present) ? 'PASS' : 'FAIL' },
    { dimension_id: 'dynamic_status_announcements', status: o.dynamic_status_live_region_present ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'color_contrast', status: contrast.every((x) => x.pass) ? 'PASS' : 'FAIL' },
    { dimension_id: 'zoom_reflow', status: !o.responsive_reflow_rules_present ? 'FAIL' : (o.zoom_reflow_empirical_tested ? 'PASS' : 'INSUFFICIENT_EVIDENCE') },
    { dimension_id: 'screen_reader', status: o.screen_reader_empirical_tested ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'language_presentation', status: !o.language_presentation_controls_present ? 'FAIL' : (o.language_accessibility_empirical_tested ? 'PASS' : 'INSUFFICIENT_EVIDENCE') },
  ];
  req(JSON.stringify(dimensions.map((x) => x.dimension_id)) === JSON.stringify(DIMENSIONS), 'DIMENSION_INTERNAL_MISMATCH', 'dimension order mismatch');
  const failed = dimensions.filter((x) => x.status === 'FAIL').map((x) => x.dimension_id);
  const insufficient = dimensions.filter((x) => x.status === 'INSUFFICIENT_EVIDENCE').map((x) => x.dimension_id);
  let outcome;
  if (failed.length) outcome = 'FAIL';
  else if (insufficient.length) outcome = 'INSUFFICIENT_EVIDENCE';
  else if (input.limitations.length) outcome = 'PASS_WITH_LIMITATIONS';
  else outcome = 'PASS';
  const p0Status = outcome === 'PASS' ? 'PASS' : 'INSUFFICIENT_EVIDENCE';
  return {
    artifact_type: REPORT_TYPE,
    version: VERSION,
    origin_frontier: input.origin_frontier,
    reviewed_revision: input.reviewed_revision,
    reviewed_surfaces: input.reviewed_surfaces,
    dimensions,
    contrast_checks: contrast,
    failed_dimensions: failed,
    insufficient_evidence_dimensions: insufficient,
    limitations: [...input.limitations],
    outcome,
    p0_mapping: {
      status: p0Status,
      blocking: outcome === 'FAIL',
      explicit_review_outcome: true,
    },
    wcag_conformance_certified: false,
    universal_accessibility_proven: false,
    legal_compliance_established: false,
    release_authorized: false,
    authority_created: false,
    runtime_activated: false,
    non_effects: [...NON_EFFECTS],
  };
}

function runCli(argv = process.argv.slice(2)) {
  req(argv.length === 1, 'USAGE', 'usage: node accessibility-review.js <input.json>');
  const input = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  process.stdout.write(`${JSON.stringify(assess(input), null, 2)}\n`);
}

if (require.main === module) {
  try { runCli(); }
  catch (error) {
    process.stderr.write(`${error.code || error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { VERSION, INPUT_TYPE, REPORT_TYPE, REQUIRED_SURFACES, DIMENSIONS, NON_EFFECTS, AccessibilityReviewError, contrastRatio, validateInput, assess, runCli };
