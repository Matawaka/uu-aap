'use strict';

const fs = require('node:fs');

const VERSION = '0.1';
const INPUT_TYPE = 'UU-AAP-Contestability-Review-Input';
const REPORT_TYPE = 'UU-AAP-Contestability-Review';
const ORIGIN_FRONTIER = '7545f9159c360b499f3fce9c70b249edfb707d1a';
const REQUIRED_SURFACES = Object.freeze({
  'review/ISSUE-05-contestability-appeal.md': '6df9c92ac04fc4ba77c1544a5f0ab73ded6e3c38',
  'pilots/core-pilot-002/README.md': '3112d41334a898aaab1af9db24556d6e746c3499',
  'docs/poai/appeal-sidecar.js': 'a18f615226d168e2df860a47fab87e41e7935da8',
  'products/honest-hiring/v0.1/README.ru.md': 'e1be40fdc6f03d17ab2389680322ba27aa56fa64',
});
const DIMENSIONS = Object.freeze([
  'objection_preservation',
  'plurality_non_overwrite',
  'appeal_separation',
  'correction_successor_preservation',
  'challenge_non_retaliation',
  'identity_standing_non_inference',
  'private_evidence_challenge',
  'pseudonymous_challenger',
  'reputational_harm_after_correction',
  'unfair_registry_case',
]);
const NON_EFFECTS = Object.freeze([
  'contestability_review_does_not_establish_legal_due_process',
  'contestability_review_does_not_create_a_legal_appeal_right',
  'contestability_review_does_not_prove_universal_contestability',
  'contestability_review_does_not_guarantee_correction_success',
  'contestability_review_does_not_erase_predecessor_evidence',
  'contestability_review_does_not_release_or_publish',
  'contestability_review_does_not_create_authority',
  'contestability_review_does_not_activate_runtime',
]);

class ContestabilityReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContestabilityReviewError';
    this.code = code;
  }
}

function req(condition, code, message) {
  if (!condition) throw new ContestabilityReviewError(code, message);
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
  req(JSON.stringify([...paths].sort()) === JSON.stringify(Object.keys(REQUIRED_SURFACES).sort()), 'SURFACE_SET_MISMATCH', 'reviewed surface set mismatch');
  for (const surface of input.reviewed_surfaces) {
    req(isSha(surface.blob_sha), 'INVALID_SURFACE_BLOB', `invalid blob for ${surface.path}`);
    req(surface.blob_sha === REQUIRED_SURFACES[surface.path], 'SURFACE_BLOB_MISMATCH', `unexpected blob for ${surface.path}`);
  }
  req(input.observations && typeof input.observations === 'object', 'INVALID_OBSERVATIONS', 'observations required');
  for (const key of [
    'original_objection_preserved','dissent_preserved','disposition_separate_from_mutation',
    'reviewer_identity_authority_separated','competing_interpretations_coexist','plural_reviews_non_overwrite',
    'appeal_request_separate','appellant_authority_standing_unknown','appeal_requested_action_non_effecting','undisclosed_appellant_supported',
    'correction_successor_preserves_predecessor','challenge_not_negative_signal','human_appeal_review_required',
    'private_evidence_challenge_project_wide_covered','pseudonymous_challenger_empirically_exercised',
    'reputational_harm_after_correction_addressed','unfair_registry_case_empirically_exercised'
  ]) req(typeof input.observations[key] === 'boolean', 'INVALID_OBSERVATION', `${key} must be boolean`);
  req(Array.isArray(input.limitations), 'INVALID_LIMITATIONS', 'limitations must be array');
  req(input.claims && typeof input.claims === 'object', 'INVALID_CLAIMS', 'claims required');
  for (const key of ['legal_due_process_established','legal_appeal_right_established','universal_contestability_proven','correction_success_guaranteed','anonymous_pseudonymous_access_proven']) {
    req(input.claims[key] === false, 'PROHIBITED_CLAIM', `${key} must remain false`);
  }
  return input;
}

function assess(input) {
  validateInput(input);
  const o = input.observations;
  const dimensions = [
    { dimension_id: 'objection_preservation', status: (o.original_objection_preserved && o.dissent_preserved && o.disposition_separate_from_mutation) ? 'PASS' : 'FAIL' },
    { dimension_id: 'plurality_non_overwrite', status: (o.competing_interpretations_coexist && o.plural_reviews_non_overwrite) ? 'PASS' : 'FAIL' },
    { dimension_id: 'appeal_separation', status: (o.appeal_request_separate && o.appellant_authority_standing_unknown && o.appeal_requested_action_non_effecting && o.undisclosed_appellant_supported) ? 'PASS' : 'FAIL' },
    { dimension_id: 'correction_successor_preservation', status: o.correction_successor_preserves_predecessor ? 'PASS' : 'FAIL' },
    { dimension_id: 'challenge_non_retaliation', status: (o.challenge_not_negative_signal && o.human_appeal_review_required) ? 'PASS' : 'FAIL' },
    { dimension_id: 'identity_standing_non_inference', status: (o.reviewer_identity_authority_separated && o.appellant_authority_standing_unknown) ? 'PASS' : 'FAIL' },
    { dimension_id: 'private_evidence_challenge', status: o.private_evidence_challenge_project_wide_covered ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'pseudonymous_challenger', status: o.pseudonymous_challenger_empirically_exercised ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'reputational_harm_after_correction', status: o.reputational_harm_after_correction_addressed ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
    { dimension_id: 'unfair_registry_case', status: o.unfair_registry_case_empirically_exercised ? 'PASS' : 'INSUFFICIENT_EVIDENCE' },
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
    legal_due_process_established: false,
    legal_appeal_right_established: false,
    universal_contestability_proven: false,
    correction_success_guaranteed: false,
    anonymous_pseudonymous_access_proven: false,
    release_authorized: false,
    publication_authorized: false,
    authority_created: false,
    runtime_activated: false,
    non_effects: [...NON_EFFECTS],
  };
}

function runCli(argv = process.argv.slice(2)) {
  req(argv.length === 1, 'USAGE', 'usage: node contestability-review.js <input.json>');
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

module.exports = { VERSION, INPUT_TYPE, REPORT_TYPE, ORIGIN_FRONTIER, REQUIRED_SURFACES, DIMENSIONS, NON_EFFECTS, ContestabilityReviewError, validateInput, assess, runCli };
