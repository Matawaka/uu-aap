'use strict';

const fs = require('node:fs');
const V01 = require('../v0.1/accessibility-review.js');

const VERSION = '0.2';
const INPUT_TYPE = 'UU-AAP-Accessibility-ReReview-Input';
const REPORT_TYPE = 'UU-AAP-Accessibility-ReReview';
const ORIGIN_FRONTIER = '68b8e166355f91e3541bae4e34a4e9538dd616bf';
const PREDECESSOR_REVIEW_FRONTIER = '588b4643ed86a4835f87ed54f14828e62a3787b2';
const NON_EFFECTS = Object.freeze([
  'accessibility_rereview_does_not_certify_wcag_conformance',
  'accessibility_rereview_does_not_prove_universal_accessibility',
  'accessibility_rereview_does_not_establish_legal_compliance',
  'accessibility_rereview_does_not_test_every_assistive_technology',
  'accessibility_rereview_does_not_release_or_publish',
  'accessibility_rereview_does_not_create_authority',
  'accessibility_rereview_does_not_activate_runtime',
  'accessibility_rereview_does_not_rewrite_predecessor_review',
  'remediation_verification_does_not_imply_accessibility_pass',
]);

class AccessibilityReReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AccessibilityReReviewError';
    this.code = code;
  }
}

function req(condition, code, message) {
  if (!condition) throw new AccessibilityReReviewError(code, message);
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function toV01Input(input) {
  return {
    artifact_type: V01.INPUT_TYPE,
    version: V01.VERSION,
    origin_frontier: input.origin_frontier,
    reviewed_revision: input.reviewed_revision,
    surface_equivalence_verified: input.surface_equivalence_verified,
    reviewed_surfaces: input.reviewed_surfaces,
    observations: input.observations,
    contrast_checks: input.contrast_checks,
    limitations: input.limitations,
    claims: input.claims,
  };
}

function validateInput(input) {
  req(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INPUT', 'input must be object');
  req(input.artifact_type === INPUT_TYPE, 'INVALID_ARTIFACT_TYPE', `artifact_type must be ${INPUT_TYPE}`);
  req(input.version === VERSION, 'INVALID_VERSION', `version must be ${VERSION}`);
  req(input.origin_frontier === ORIGIN_FRONTIER, 'INVALID_ORIGIN', `origin_frontier must be ${ORIGIN_FRONTIER}`);
  req(isSha(input.reviewed_revision), 'INVALID_REVIEWED_REVISION', 'reviewed_revision must be 40-hex');

  const predecessor = input.predecessor_review;
  req(predecessor && typeof predecessor === 'object', 'MISSING_PREDECESSOR_REVIEW', 'predecessor_review required');
  req(predecessor.merge_frontier === PREDECESSOR_REVIEW_FRONTIER, 'PREDECESSOR_FRONTIER_MISMATCH', 'predecessor review frontier mismatch');
  req(predecessor.assessor_blob === '6baf8df3446ce21b32bb295a97e74c4718be81f2', 'PREDECESSOR_ASSESSOR_MISMATCH', 'predecessor assessor blob mismatch');
  req(predecessor.input_blob === 'ec0259c7c8290e7bd183e2ac4091e958b7dc48ba', 'PREDECESSOR_INPUT_MISMATCH', 'predecessor input blob mismatch');
  req(predecessor.outcome === 'FAIL', 'PREDECESSOR_OUTCOME_MISMATCH', 'predecessor outcome must remain FAIL');
  req(Array.isArray(predecessor.blocking_findings) && predecessor.blocking_findings.includes('color_contrast'), 'PREDECESSOR_FINDING_MISSING', 'predecessor color_contrast finding required');

  const remediation = input.remediation;
  req(remediation && typeof remediation === 'object', 'MISSING_REMEDIATION', 'remediation required');
  req(remediation.merge_frontier === ORIGIN_FRONTIER, 'REMEDIATION_FRONTIER_MISMATCH', 'remediation frontier mismatch');
  req(remediation.pull_request === 652, 'REMEDIATION_PR_MISMATCH', 'remediation pull request mismatch');
  req(Array.isArray(remediation.findings) && remediation.findings.length === 2, 'INVALID_REMEDIATION_FINDINGS', 'exactly two remediation findings required');
  req(remediation.findings.includes('color_contrast'), 'MISSING_COLOR_REMEDIATION', 'color_contrast remediation finding required');
  req(remediation.findings.includes('dynamic_status_announcements'), 'MISSING_STATUS_REMEDIATION', 'dynamic_status_announcements remediation finding required');

  V01.validateInput(toV01Input(input));
  return input;
}

function dimension(report, id) {
  return report.dimensions.find((item) => item.dimension_id === id);
}

function assess(input) {
  validateInput(input);
  const base = V01.assess(toV01Input(input));
  const remediationFindings = input.remediation.findings.map((findingId) => {
    const item = dimension(base, findingId);
    req(item, 'UNKNOWN_REMEDIATION_FINDING', `missing dimension ${findingId}`);
    return {
      finding_id: findingId,
      status: item.status === 'PASS' ? 'RESOLVED' : 'UNRESOLVED',
      current_dimension_status: item.status,
    };
  });
  const predecessorBlockingResolved = input.predecessor_review.blocking_findings.every((id) => {
    const item = dimension(base, id);
    return item && item.status === 'PASS';
  });
  return {
    artifact_type: REPORT_TYPE,
    version: VERSION,
    origin_frontier: input.origin_frontier,
    reviewed_revision: input.reviewed_revision,
    predecessor_review: { ...input.predecessor_review },
    remediation: { ...input.remediation },
    reused_assessment_semantics: 'review/accessibility/v0.1/accessibility-review.js',
    reviewed_surfaces: base.reviewed_surfaces,
    dimensions: base.dimensions,
    contrast_checks: base.contrast_checks,
    failed_dimensions: base.failed_dimensions,
    insufficient_evidence_dimensions: base.insufficient_evidence_dimensions,
    remediation_findings: remediationFindings,
    predecessor_blocking_findings_resolved: predecessorBlockingResolved,
    remaining_blocking_findings: [...base.failed_dimensions],
    limitations: base.limitations,
    outcome: base.outcome,
    p0_mapping: { ...base.p0_mapping },
    wcag_conformance_certified: false,
    universal_accessibility_proven: false,
    legal_compliance_established: false,
    release_authorized: false,
    publication_authorized: false,
    authority_created: false,
    runtime_activated: false,
    non_effects: [...NON_EFFECTS],
  };
}

function runCli(argv = process.argv.slice(2)) {
  req(argv.length === 1, 'USAGE', 'usage: node accessibility-rereview.js <input.json>');
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

module.exports = {
  VERSION,
  INPUT_TYPE,
  REPORT_TYPE,
  ORIGIN_FRONTIER,
  PREDECESSOR_REVIEW_FRONTIER,
  NON_EFFECTS,
  AccessibilityReReviewError,
  toV01Input,
  validateInput,
  assess,
  runCli,
};
