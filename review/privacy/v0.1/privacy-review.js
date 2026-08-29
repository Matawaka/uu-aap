'use strict';

const fs = require('node:fs');

const VERSION = '0.1';
const INPUT_TYPE = 'UU-AAP-Privacy-Review-Input';
const REPORT_TYPE = 'UU-AAP-Privacy-Review';
const ORIGIN_FRONTIER = '744d2fd12fce012555dfac993921f078c56dc88d';
const REQUIRED_SURFACES = Object.freeze([
  'review/ISSUE-02-privacy-coercion.md',
  'docs/poai/README.md',
  'products/kontur/v0.1/consolidated-demo/README.md',
  'applications/marketcloser/v0.1/README.md',
]);
const DIMENSIONS = Object.freeze([
  'browser_local_processing',
  'personal_data_minimization',
  'identity_targeting_boundary',
  'profiling_history_minimization',
  'private_audit_retention_deletion',
  'anti_surveillance_authenticity_policy',
  'project_wide_coercive_collection_assessment',
]);
const NON_EFFECTS = Object.freeze([
  'privacy_review_does_not_certify_privacy_compliance',
  'privacy_review_does_not_establish_legal_compliance',
  'privacy_review_does_not_prove_absence_of_surveillance',
  'sampled_boundaries_do_not_prove_repository_wide_privacy',
  'privacy_review_does_not_release_or_publish',
  'privacy_review_does_not_create_authority',
  'privacy_review_does_not_activate_runtime',
  'privacy_review_does_not_rewrite_product_policy',
]);

class PrivacyReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PrivacyReviewError';
    this.code = code;
  }
}

function req(condition, code, message) {
  if (!condition) throw new PrivacyReviewError(code, message);
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function validateInput(input) {
  req(input && typeof input === 'object' && !Array.isArray(input), 'INVALID_INPUT', 'input must be object');
  req(input.artifact_type === INPUT_TYPE, 'INVALID_ARTIFACT_TYPE', `artifact_type must be ${INPUT_TYPE}`);
  req(input.version === VERSION, 'INVALID_VERSION', `version must be ${VERSION}`);
  req(input.origin_frontier === ORIGIN_FRONTIER, 'INVALID_ORIGIN', `origin_frontier must be ${ORIGIN_FRONTIER}`);
  req(isSha(input.reviewed_revision), 'INVALID_REVIEWED_REVISION', 'reviewed_revision must be 40-hex');
  req(input.source_equivalence_verified === true, 'UNVERIFIED_SOURCE_EQUIVALENCE', 'source equivalence must be externally verified');
  req(Array.isArray(input.reviewed_surfaces), 'INVALID_SURFACES', 'reviewed_surfaces must be array');
  const paths = input.reviewed_surfaces.map((x) => x && x.path);
  req(new Set(paths).size === paths.length, 'DUPLICATE_SURFACE', 'duplicate reviewed surface');
  req(JSON.stringify([...paths].sort()) === JSON.stringify([...REQUIRED_SURFACES].sort()), 'SURFACE_SET_MISMATCH', 'reviewed surface set mismatch');
  for (const surface of input.reviewed_surfaces) {
    req(isSha(surface.blob_sha), 'INVALID_SURFACE_BLOB', `invalid blob for ${surface.path}`);
  }
  req(input.observations && typeof input.observations === 'object', 'INVALID_OBSERVATIONS', 'observations required');
  for (const key of [
    'browser_local_json_processing','no_upload_endpoint','no_analytics_dependency',
    'raw_personal_data_minimized','sensitive_personal_cross_boundary_forbidden',
    'identity_resolution_unavailable','personal_targeting_unavailable',
    'raw_history_excluded','transcripts_excluded','identity_correlation_excluded','profiling_excluded',
    'private_audit_retention_policy_current','private_audit_deletion_policy_current',
    'surveillance_authenticity_escalation_forbidden','repository_wide_coercive_collection_assessed'
  ]) req(typeof input.observations[key] === 'boolean', 'INVALID_OBSERVATION', `${key} must be boolean`);
  req(Array.isArray(input.limitations), 'INVALID_LIMITATIONS', 'limitations must be array');
  req(input.claims && typeof input.claims === 'object', 'INVALID_CLAIMS', 'claims required');
  for (const key of ['privacy_compliance_certified','legal_compliance_established','absence_of_surveillance_proven','repository_wide_privacy_proven']) {
    req(input.claims[key] === false, 'PROHIBITED_CLAIM', `${key} must remain false`);
  }
  return input;
}

function assess(input) {
  validateInput(input);
  const o = input.observations;
  const dimensions = [
    { dimension_id: 'browser_local_processing', status: (o.browser_local_json_processing && o.no_upload_endpoint && o.no_analytics_dependency) ? 'PASS' : 'FAIL' },
    { dimension_id: 'personal_data_minimization', status: (o.raw_personal_data_minimized && o.sensitive_personal_cross_boundary_forbidden) ? 'PASS' : 'FAIL' },
    { dimension_id: 'identity_targeting_boundary', status: (o.identity_resolution_unavailable && o.personal_targeting_unavailable) ? 'PASS' : 'FAIL' },
    { dimension_id: 'profiling_history_minimization', status: (o.raw_history_excluded && o.transcripts_excluded && o.identity_correlation_excluded && o.profiling_excluded) ? 'PASS' : 'FAIL' },
    { dimension_id: 'private_audit_retention_deletion', status: (o.private_audit_retention_policy_current && o.private_audit_deletion_policy_current) ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'anti_surveillance_authenticity_policy', status: o.surveillance_authenticity_escalation_forbidden ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'project_wide_coercive_collection_assessment', status: o.repository_wide_coercive_collection_assessed ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
  ];
  req(JSON.stringify(dimensions.map((x) => x.dimension_id)) === JSON.stringify(DIMENSIONS), 'DIMENSION_INTERNAL_MISMATCH', 'dimension order mismatch');
  const failed = dimensions.filter((x) => x.status === 'FAIL').map((x) => x.dimension_id);
  const insufficient = dimensions.filter((x) => x.status === 'INSUFFICIENT_EVIDENCE').map((x) => x.dimension_id);
  const outcome = failed.length ? 'FAIL' : (insufficient.length ? 'INSUFFICIENT_EVIDENCE' : 'PASS');
  return {
    artifact_type: REPORT_TYPE,
    version: VERSION,
    origin_frontier: input.origin_frontier,
    reviewed_revision: input.reviewed_revision,
    reviewed_surfaces: input.reviewed_surfaces,
    dimensions,
    failed_dimensions: failed,
    insufficient_evidence_dimensions: insufficient,
    limitations: [...input.limitations],
    outcome,
    p0_mapping: {
      status: outcome === 'PASS' ? 'PASS' : 'INSUFFICIENT_EVIDENCE',
      blocking: outcome === 'FAIL',
      explicit_review_outcome: true,
    },
    privacy_compliance_certified: false,
    legal_compliance_established: false,
    absence_of_surveillance_proven: false,
    repository_wide_privacy_proven: false,
    release_authorized: false,
    publication_authorized: false,
    authority_created: false,
    runtime_activated: false,
    non_effects: [...NON_EFFECTS],
  };
}

function runCli(argv = process.argv.slice(2)) {
  req(argv.length === 1, 'USAGE', 'usage: node privacy-review.js <input.json>');
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

module.exports = { VERSION, INPUT_TYPE, REPORT_TYPE, ORIGIN_FRONTIER, REQUIRED_SURFACES, DIMENSIONS, NON_EFFECTS, PrivacyReviewError, validateInput, assess, runCli };
