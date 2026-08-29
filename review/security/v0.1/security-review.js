'use strict';

const fs = require('node:fs');

const VERSION = '0.1';
const INPUT_TYPE = 'UU-AAP-Security-Review-Input';
const REPORT_TYPE = 'UU-AAP-Security-Review';
const ORIGIN_FRONTIER = 'f58cdf60b76f87fcceb146333e3cb9445596a295';
const REQUIRED_SURFACES = Object.freeze([
  'SECURITY.md',
  'docs/AUDIT-HARDENING-v0.1.md',
  'protocols/integration/ci-dependency-hardening-audit/v0.1/README.md',
]);
const DIMENSIONS = Object.freeze([
  'threat_model',
  'revision_provenance_hardening',
  'ci_dependency_fail_closed',
  'main_write_governance',
  'dependency_vulnerability_assessment',
  'secret_exposure_assessment',
  'deployment_surface_assessment',
  'workflow_supply_chain_assessment',
  'adversarial_surface_assessment',
]);
const REQUIRED_STATUS_CHECKS = Object.freeze([
  'PoAI Genesis validation',
  'PoAI Authority Root validation',
  'CCRP validation',
  'PoAI CCRP pre-materialization validation',
]);
const NON_EFFECTS = Object.freeze([
  'security_review_does_not_certify_security',
  'security_review_does_not_prove_vulnerability_free_state',
  'security_review_does_not_prove_secret_free_state',
  'sampled_hardening_does_not_prove_repository_wide_security',
  'security_review_does_not_establish_legal_compliance',
  'security_review_does_not_release_or_publish',
  'security_review_does_not_create_authority',
  'security_review_does_not_activate_runtime',
]);

class SecurityReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SecurityReviewError';
    this.code = code;
  }
}

function req(condition, code, message) {
  if (!condition) throw new SecurityReviewError(code, message);
}

function isSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

function sameSet(left, right) {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
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
  req(sameSet(paths, REQUIRED_SURFACES), 'SURFACE_SET_MISMATCH', 'reviewed surface set mismatch');
  for (const surface of input.reviewed_surfaces) req(isSha(surface.blob_sha), 'INVALID_SURFACE_BLOB', `invalid blob for ${surface.path}`);

  const o = input.observations;
  req(o && typeof o === 'object', 'INVALID_OBSERVATIONS', 'observations required');
  for (const key of [
    'explicit_threat_model_present','cryptographic_non_overclaim_present','revision_provenance_fail_closed','stale_revision_gate_present',
    'ci_narrowing_fails_closed_on_incomplete_evidence','main_ruleset_active','main_deletion_forbidden','main_non_fast_forward_forbidden',
    'main_pull_request_required','main_squash_only','main_no_bypass_actors','dependency_vulnerability_review_current',
    'secret_exposure_review_current','deployment_surface_security_review_current','workflow_supply_chain_review_current','adversarial_surface_review_current'
  ]) req(typeof o[key] === 'boolean', 'INVALID_OBSERVATION', `${key} must be boolean`);

  req(Array.isArray(o.main_required_status_checks), 'INVALID_STATUS_CHECKS', 'main_required_status_checks must be array');
  req(sameSet(o.main_required_status_checks, REQUIRED_STATUS_CHECKS), 'STATUS_CHECK_SET_MISMATCH', 'required status check set mismatch');
  req(Number.isInteger(o.main_required_approving_review_count) && o.main_required_approving_review_count >= 0, 'INVALID_REVIEW_COUNT', 'main_required_approving_review_count must be non-negative integer');
  req(typeof o.main_strict_required_status_checks_policy === 'boolean', 'INVALID_STRICT_STATUS_POLICY', 'main_strict_required_status_checks_policy must be boolean');

  req(Array.isArray(input.limitations), 'INVALID_LIMITATIONS', 'limitations must be array');
  req(input.claims && typeof input.claims === 'object', 'INVALID_CLAIMS', 'claims required');
  for (const key of ['security_certified','vulnerability_free_proven','secret_free_proven','legal_compliance_established','all_surfaces_tested']) {
    req(input.claims[key] === false, 'PROHIBITED_CLAIM', `${key} must remain false`);
  }
  return input;
}

function assess(input) {
  validateInput(input);
  const o = input.observations;
  const dimensions = [
    { dimension_id: 'threat_model', status: (o.explicit_threat_model_present && o.cryptographic_non_overclaim_present) ? 'PASS' : 'FAIL' },
    { dimension_id: 'revision_provenance_hardening', status: (o.revision_provenance_fail_closed && o.stale_revision_gate_present) ? 'PASS' : 'FAIL' },
    { dimension_id: 'ci_dependency_fail_closed', status: o.ci_narrowing_fails_closed_on_incomplete_evidence ? 'PASS' : 'FAIL' },
    { dimension_id: 'main_write_governance', status: (o.main_ruleset_active && o.main_deletion_forbidden && o.main_non_fast_forward_forbidden && o.main_pull_request_required && o.main_squash_only && o.main_no_bypass_actors && sameSet(o.main_required_status_checks, REQUIRED_STATUS_CHECKS)) ? 'PASS' : 'FAIL' },
    { dimension_id: 'dependency_vulnerability_assessment', status: o.dependency_vulnerability_review_current ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'secret_exposure_assessment', status: o.secret_exposure_review_current ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'deployment_surface_assessment', status: o.deployment_surface_security_review_current ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'workflow_supply_chain_assessment', status: o.workflow_supply_chain_review_current ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'adversarial_surface_assessment', status: o.adversarial_surface_review_current ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
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
    p0_mapping: { status: outcome === 'PASS' ? 'PASS' : 'INSUFFICIENT_EVIDENCE', blocking: outcome === 'FAIL', explicit_review_outcome: true },
    security_certified: false,
    vulnerability_free_proven: false,
    secret_free_proven: false,
    legal_compliance_established: false,
    all_surfaces_tested: false,
    release_authorized: false,
    publication_authorized: false,
    authority_created: false,
    runtime_activated: false,
    non_effects: [...NON_EFFECTS],
  };
}

function runCli(argv = process.argv.slice(2)) {
  req(argv.length === 1, 'USAGE', 'usage: node security-review.js <input.json>');
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

module.exports = { VERSION, INPUT_TYPE, REPORT_TYPE, ORIGIN_FRONTIER, REQUIRED_SURFACES, DIMENSIONS, REQUIRED_STATUS_CHECKS, NON_EFFECTS, SecurityReviewError, validateInput, assess, runCli };
