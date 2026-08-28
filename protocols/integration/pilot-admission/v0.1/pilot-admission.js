'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Marketer = require('../../../../products/marketer-pessimist/v0.1/local-mvp/stress-test.js');
const MarketerBinding = require('../../../../products/marketer-pessimist/v0.1/local-mvp/receipt-binding.js');
const HonestHiring = require('../../../../products/honest-hiring/v0.1/local-mvp/honest-hiring.js');
const HonestHiringBinding = require('../../../../products/honest-hiring/v0.1/local-mvp/result-binding.js');

const PROTOCOL = 'UU-AAP-PRODUCT-PILOT-ADMISSION';
const VERSION = '0.1';
const INPUT_TYPE = 'ProductPilotAdmissionCandidate';
const RECEIPT_TYPE = 'ProductPilotAdmissionPreflightReceipt';

const STATUSES = Object.freeze([
  'READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW',
  'DATA_PROTECTION_REVIEW_REQUIRED',
  'PILOT_BOUNDARY_UNSATISFIED'
]);

const NEXT_ACTIONS = Object.freeze({
  READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW: 'HUMAN_PILOT_ADMISSION_REVIEW_REQUIRED',
  DATA_PROTECTION_REVIEW_REQUIRED: 'DATA_PROTECTION_AND_HUMAN_PILOT_REVIEW_REQUIRED',
  PILOT_BOUNDARY_UNSATISFIED: 'CORRECT_OR_NARROW_PILOT_CANDIDATE'
});

const RUN_ADMISSION_PROFILE = Object.freeze({
  profile_id: 'core-pilot-002-run-admission-v0.1',
  canonical_paths: [
    'pilots/core-pilot-002/run-admission/README.md',
    'pilots/core-pilot-002/run-admission/admission.schema.json',
    'pilots/core-pilot-002/run-admission/validate.py'
  ],
  invariants: [
    'Synthetic fixture != Real participant evidence',
    'Admission != Disposition',
    'No eligible input != Permission to fabricate one',
    'Observed source != Identity / authority / standing'
  ]
});

const PRODUCT_PROFILES = Object.freeze({
  'marketer-pessimist': Object.freeze({
    profile_id: 'marketer-pessimist-v0.1',
    product_id: 'marketer-pessimist',
    product_version: '0.1',
    product_contract_hash: 'sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6',
    local_mvp_source_path: 'products/marketer-pessimist/v0.1/local-mvp/examples/synthetic-onboarding.input.json',
    predecessor_artifact_type: 'MarketerPessimistStressTestReceipt'
  }),
  'honest-hiring': Object.freeze({
    profile_id: 'honest-hiring-v0.1',
    product_id: 'honest-hiring',
    product_version: '0.1',
    product_contract_hash: 'sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae',
    local_mvp_source_path: 'products/honest-hiring/v0.1/local-mvp/examples/synthetic-sap-data-platform-architect.input.json',
    predecessor_artifact_type: 'HonestHiringLocalComparisonResult'
  })
});

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'candidate_id', 'evaluation_frontier',
  'product', 'proposed_pilot', 'requested_reviews', 'controls', 'content_hash'
]);
const FRONTIER_KEYS = Object.freeze(['repository', 'revision']);
const PRODUCT_KEYS = Object.freeze([
  'profile_id', 'product_id', 'product_version', 'product_contract_hash', 'local_mvp_source_path'
]);
const PILOT_KEYS = Object.freeze([
  'pilot_id', 'mode', 'purpose', 'scope', 'data_mode', 'real_data_involved',
  'personal_data_involved', 'sensitive_personal_data_involved',
  'participant_opt_in_required', 'external_effect_requested',
  'irreversible_effect_requested', 'real_world_decision_in_scope',
  'network_access_required', 'provider_invocation_required',
  'account_mutation_required', 'retention_mode', 'retention_boundary',
  'correction_supported', 'deletion_supported'
]);
const REVIEW_KEYS = Object.freeze([
  'human_product_owner_review_required', 'data_protection_review_requested',
  'participant_consent_boundary_required'
]);
const CONTROL_KEYS = Object.freeze([
  'local_only', 'read_only', 'pilot_start_available', 'pilot_permit_creation_available',
  'network_delivery_available', 'provider_invocation_available', 'account_mutation_available',
  'external_effect_available', 'action_permit_available', 'execution_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol', 'version', 'receipt_type', 'receipt_id', 'evaluation_frontier',
  'source_candidate', 'run_admission_predecessor', 'product', 'pilot',
  'required_human_gates', 'claims', 'non_effects', 'next_safe_action', 'content_hash'
]);
const SOURCE_KEYS = Object.freeze(['candidate_id', 'candidate_hash']);
const PREDECESSOR_KEYS = Object.freeze(['profile_id', 'canonical_paths', 'invariants_preserved']);
const RECEIPT_PRODUCT_KEYS = Object.freeze([
  'profile_id', 'product_id', 'product_version', 'product_contract_hash',
  'local_mvp_source_path', 'predecessor_artifact_type', 'predecessor_artifact_id',
  'predecessor_source_hash', 'predecessor_output_hash', 'predecessor_frontier_revision',
  'local_mvp_revalidated'
]);
const RECEIPT_PILOT_KEYS = Object.freeze([
  'pilot_id', 'mode', 'data_mode', 'real_data_involved', 'personal_data_involved',
  'sensitive_personal_data_involved', 'external_effect_requested',
  'irreversible_effect_requested', 'real_world_decision_in_scope', 'status', 'reason_codes'
]);
const GATE_KEYS = Object.freeze([
  'human_product_owner_review_required', 'data_protection_review_required',
  'participant_consent_required', 'pilot_admission_disposition_required'
]);

const TRUE_CLAIMS = Object.freeze([
  'local_mvp_predecessor_revalidated',
  'exact_product_contract_bound',
  'run_admission_invariants_preserved',
  'data_boundary_explicit',
  'human_pilot_admission_required',
  'no_effect_pilot_boundary_preserved'
]);
const FALSE_CLAIMS = Object.freeze([
  'pilot_admitted', 'pilot_permit_created', 'real_pilot_started',
  'participant_consent_recorded', 'data_protection_approved', 'product_owner_approved',
  'external_effect_authorized', 'external_effect_performed',
  'real_world_decision_authorized', 'account_mutation_authorized',
  'network_delivery_performed', 'provider_invoked', 'authority_created',
  'responsibility_accepted', 'action_permit_created', 'execution_admitted',
  'stable_core_promotion_established', 'successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Synthetic Fixture != Real Participant Evidence',
  'Local MVP Success != Pilot Admission',
  'Admission Candidate != Disposition',
  'Admission Candidate != PilotPermit',
  'Admission Candidate != Pilot Start',
  'Data Protection Review Required != Data Protection Approved',
  'Participant Consent Required != Consent Recorded',
  'Human Pilot Review Required != Pilot Admitted',
  'No External Effect Requested != Execution Authority',
  'Observed Product Evidence != Successor Authority'
]);

class ProductPilotAdmissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductPilotAdmissionError';
  }
}

function fail(message) { throw new ProductPilotAdmissionError(message); }
function requireCondition(condition, message) { if (!condition) fail(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}
function sameCanonical(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}
function computeContentHash(value) {
  const projected = clone(value);
  projected.content_hash = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}
function rehash(value) { value.content_hash = computeContentHash(value); return value; }
function deterministicId(prefix, value) {
  const digest = crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
  return `${prefix}${digest.slice(0, 24)}`;
}
function assertObject(value, label) { requireCondition(isObject(value), `${label} must be an object`); }
function assertExactKeys(value, keys, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch`);
}
function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}
function assertBoolean(value, label) { requireCondition(typeof value === 'boolean', `${label} must be boolean`); }
function assertStringArray(value, label, minItems = 0) {
  requireCondition(Array.isArray(value) && value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${label}[${index}]`);
    requireCondition(!seen.has(item), `${label} must contain unique items`);
    seen.add(item);
  });
}
function assertExactStringSet(value, expected, label) {
  assertStringArray(value, label, expected.length);
  requireCondition(value.length === expected.length, `${label} size mismatch`);
  requireCondition(JSON.stringify([...value].sort()) === JSON.stringify([...expected].sort()), `${label} set mismatch`);
}
function repoRoot() { return path.resolve(__dirname, '../../../..'); }
function readJsonFromRepo(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot(), relativePath), 'utf8'));
}

function profileFor(productId) {
  const profile = PRODUCT_PROFILES[productId];
  requireCondition(profile, `unsupported product pilot profile: ${productId}`);
  return profile;
}

function validateProduct(product) {
  assertExactKeys(product, PRODUCT_KEYS, 'product');
  const profile = profileFor(product.product_id);
  requireCondition(product.profile_id === profile.profile_id, 'product profile id mismatch');
  requireCondition(product.product_version === profile.product_version, 'product version mismatch');
  requireCondition(product.product_contract_hash === profile.product_contract_hash, 'product contract hash mismatch');
  requireCondition(product.local_mvp_source_path === profile.local_mvp_source_path, 'local MVP source path mismatch');
  return profile;
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === INPUT_TYPE, `artifact_type must be ${INPUT_TYPE}`);
  assertString(input.candidate_id, 'candidate_id', /^urn:uu-aap:pilot-admission:candidate:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'evaluation frontier repository mismatch');
  assertString(input.evaluation_frontier.revision, 'evaluation_frontier.revision', /^[0-9a-f]{40}$/);

  validateProduct(input.product);

  assertExactKeys(input.proposed_pilot, PILOT_KEYS, 'proposed_pilot');
  assertString(input.proposed_pilot.pilot_id, 'proposed_pilot.pilot_id');
  requireCondition(input.proposed_pilot.mode === 'bounded_real_no_external_effect', 'pilot mode mismatch');
  assertString(input.proposed_pilot.purpose, 'proposed_pilot.purpose');
  assertStringArray(input.proposed_pilot.scope, 'proposed_pilot.scope', 1);
  requireCondition(['real_non_personal', 'real_personal'].includes(input.proposed_pilot.data_mode), 'pilot data_mode invalid');
  for (const key of [
    'real_data_involved', 'personal_data_involved', 'sensitive_personal_data_involved',
    'participant_opt_in_required', 'external_effect_requested', 'irreversible_effect_requested',
    'real_world_decision_in_scope', 'network_access_required', 'provider_invocation_required',
    'account_mutation_required', 'correction_supported', 'deletion_supported'
  ]) assertBoolean(input.proposed_pilot[key], `proposed_pilot.${key}`);
  requireCondition(input.proposed_pilot.real_data_involved === true, 'Phase E candidate must explicitly concern real data');
  requireCondition(
    input.proposed_pilot.data_mode === (input.proposed_pilot.personal_data_involved ? 'real_personal' : 'real_non_personal'),
    'pilot data_mode/personal_data_involved mismatch'
  );
  requireCondition(['session', 'bounded'].includes(input.proposed_pilot.retention_mode), 'retention_mode invalid');
  assertString(input.proposed_pilot.retention_boundary, 'proposed_pilot.retention_boundary');

  assertExactKeys(input.requested_reviews, REVIEW_KEYS, 'requested_reviews');
  for (const key of REVIEW_KEYS) assertBoolean(input.requested_reviews[key], `requested_reviews.${key}`);

  assertExactKeys(input.controls, CONTROL_KEYS, 'controls');
  for (const key of CONTROL_KEYS) assertBoolean(input.controls[key], `controls.${key}`);
  requireCondition(input.controls.local_only === true, 'controls.local_only must remain true');
  requireCondition(input.controls.read_only === true, 'controls.read_only must remain true');
  for (const key of CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) {
    requireCondition(input.controls[key] === false, `controls.${key} must remain false`);
  }

  requireCondition(input.content_hash === computeContentHash(input), 'input content hash mismatch');
  return input;
}

function revalidateLocalMvp(profile) {
  const source = readJsonFromRepo(profile.local_mvp_source_path);
  if (profile.product_id === 'marketer-pessimist') {
    Marketer.validateInput(source);
    const receipt = Marketer.analyze(source);
    MarketerBinding.validateReceiptAgainstInput(source, receipt);
    requireCondition(receipt.receipt_type === profile.predecessor_artifact_type, 'Marketer predecessor artifact type mismatch');
    requireCondition(receipt.contract_binding.content_hash === profile.product_contract_hash, 'Marketer predecessor contract mismatch');
    requireCondition(receipt.claims.external_effect_performed === false, 'Marketer predecessor external-effect overclaim');
    requireCondition(receipt.claims.human_disposition_still_required === true, 'Marketer predecessor human gate missing');
    return {
      predecessor_artifact_type: receipt.receipt_type,
      predecessor_artifact_id: receipt.receipt_id,
      predecessor_source_hash: source.content_hash,
      predecessor_output_hash: receipt.content_hash,
      predecessor_frontier_revision: receipt.evaluation_frontier.revision
    };
  }

  HonestHiring.validateInput(source);
  const result = HonestHiring.deriveResult(source);
  HonestHiringBinding.validateResultAgainstInput(source, result);
  requireCondition(result.artifact_type === profile.predecessor_artifact_type, 'Honest Hiring predecessor artifact type mismatch');
  requireCondition(result.comparison_receipt.contract_binding.content_hash === profile.product_contract_hash, 'Honest Hiring predecessor contract mismatch');
  requireCondition(result.comparison_receipt.claims.external_effect_performed === false, 'Honest Hiring predecessor external-effect overclaim');
  requireCondition(result.comparison_receipt.claims.human_disposition_still_required === true, 'Honest Hiring predecessor human gate missing');
  return {
    predecessor_artifact_type: result.artifact_type,
    predecessor_artifact_id: result.result_id,
    predecessor_source_hash: source.content_hash,
    predecessor_output_hash: result.content_hash,
    predecessor_frontier_revision: result.comparison_receipt.evaluation_frontier.revision
  };
}

function evaluateBoundary(input) {
  const pilot = input.proposed_pilot;
  const reviews = input.requested_reviews;
  const reasons = [];

  if (pilot.sensitive_personal_data_involved) reasons.push('SENSITIVE_PERSONAL_DATA_NOT_ADMITTED_IN_V0_1');
  if (pilot.external_effect_requested) reasons.push('EXTERNAL_EFFECT_NOT_ADMITTED_IN_V0_1');
  if (pilot.irreversible_effect_requested) reasons.push('IRREVERSIBLE_EFFECT_NOT_ADMITTED_IN_V0_1');
  if (pilot.real_world_decision_in_scope) reasons.push('REAL_WORLD_DECISION_NOT_ADMITTED_IN_V0_1');
  if (pilot.network_access_required) reasons.push('NETWORK_ACCESS_NOT_ADMITTED_IN_V0_1');
  if (pilot.provider_invocation_required) reasons.push('PROVIDER_INVOCATION_NOT_ADMITTED_IN_V0_1');
  if (pilot.account_mutation_required) reasons.push('ACCOUNT_MUTATION_NOT_ADMITTED_IN_V0_1');
  if (!pilot.correction_supported) reasons.push('CORRECTION_BOUNDARY_REQUIRED');
  if (!pilot.deletion_supported) reasons.push('DELETION_BOUNDARY_REQUIRED');
  if (!reviews.human_product_owner_review_required) reasons.push('HUMAN_PRODUCT_OWNER_REVIEW_REQUIRED');
  if (pilot.participant_opt_in_required && !reviews.participant_consent_boundary_required) {
    reasons.push('PARTICIPANT_CONSENT_BOUNDARY_REQUIRED');
  }
  if (pilot.personal_data_involved) {
    if (!reviews.data_protection_review_requested) reasons.push('DATA_PROTECTION_REVIEW_REQUEST_REQUIRED');
    if (!reviews.participant_consent_boundary_required) reasons.push('PARTICIPANT_CONSENT_BOUNDARY_REQUIRED');
  }

  if (reasons.length > 0) {
    return { status: 'PILOT_BOUNDARY_UNSATISFIED', reason_codes: [...new Set(reasons)].sort() };
  }
  if (pilot.personal_data_involved || reviews.data_protection_review_requested) {
    return { status: 'DATA_PROTECTION_REVIEW_REQUIRED', reason_codes: ['REAL_PERSONAL_DATA_REQUIRES_SEPARATE_DATA_PROTECTION_REVIEW'] };
  }
  return { status: 'READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW', reason_codes: ['BOUNDED_REAL_NO_EFFECT_CANDIDATE_REQUIRES_HUMAN_ADMISSION_REVIEW'] };
}

function deriveReceipt(input) {
  validateInput(input);
  const profile = profileFor(input.product.product_id);
  const predecessor = revalidateLocalMvp(profile);
  const boundary = evaluateBoundary(input);

  const claims = {};
  for (const key of TRUE_CLAIMS) claims[key] = true;
  for (const key of FALSE_CLAIMS) claims[key] = false;

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: deterministicId('urn:uu-aap:pilot-admission:preflight:', {
      candidate_hash: input.content_hash,
      predecessor_output_hash: predecessor.predecessor_output_hash
    }),
    evaluation_frontier: clone(input.evaluation_frontier),
    source_candidate: {
      candidate_id: input.candidate_id,
      candidate_hash: input.content_hash
    },
    run_admission_predecessor: {
      profile_id: RUN_ADMISSION_PROFILE.profile_id,
      canonical_paths: [...RUN_ADMISSION_PROFILE.canonical_paths],
      invariants_preserved: [...RUN_ADMISSION_PROFILE.invariants]
    },
    product: {
      profile_id: profile.profile_id,
      product_id: profile.product_id,
      product_version: profile.product_version,
      product_contract_hash: profile.product_contract_hash,
      local_mvp_source_path: profile.local_mvp_source_path,
      ...predecessor,
      local_mvp_revalidated: true
    },
    pilot: {
      pilot_id: input.proposed_pilot.pilot_id,
      mode: input.proposed_pilot.mode,
      data_mode: input.proposed_pilot.data_mode,
      real_data_involved: input.proposed_pilot.real_data_involved,
      personal_data_involved: input.proposed_pilot.personal_data_involved,
      sensitive_personal_data_involved: input.proposed_pilot.sensitive_personal_data_involved,
      external_effect_requested: input.proposed_pilot.external_effect_requested,
      irreversible_effect_requested: input.proposed_pilot.irreversible_effect_requested,
      real_world_decision_in_scope: input.proposed_pilot.real_world_decision_in_scope,
      status: boundary.status,
      reason_codes: boundary.reason_codes
    },
    required_human_gates: {
      human_product_owner_review_required: true,
      data_protection_review_required: input.proposed_pilot.personal_data_involved || input.requested_reviews.data_protection_review_requested,
      participant_consent_required: input.proposed_pilot.personal_data_involved || input.proposed_pilot.participant_opt_in_required,
      pilot_admission_disposition_required: true
    },
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_ACTIONS[boundary.status],
    content_hash: ''
  };
  rehash(receipt);
  validateReceipt(receipt);
  return receipt;
}

function validateReceipt(receipt) {
  assertExactKeys(receipt, RECEIPT_KEYS, 'receipt');
  requireCondition(receipt.protocol === PROTOCOL, 'receipt protocol mismatch');
  requireCondition(receipt.version === VERSION, 'receipt version mismatch');
  requireCondition(receipt.receipt_type === RECEIPT_TYPE, 'receipt type mismatch');
  assertString(receipt.receipt_id, 'receipt.receipt_id', /^urn:uu-aap:pilot-admission:preflight:[0-9a-f]{24}$/);
  assertExactKeys(receipt.evaluation_frontier, FRONTIER_KEYS, 'receipt.evaluation_frontier');
  requireCondition(receipt.evaluation_frontier.repository === 'Matawaka/uu-aap', 'receipt repository mismatch');
  assertString(receipt.evaluation_frontier.revision, 'receipt.evaluation_frontier.revision', /^[0-9a-f]{40}$/);

  assertExactKeys(receipt.source_candidate, SOURCE_KEYS, 'receipt.source_candidate');
  assertString(receipt.source_candidate.candidate_id, 'receipt.source_candidate.candidate_id');
  assertString(receipt.source_candidate.candidate_hash, 'receipt.source_candidate.candidate_hash', /^sha256:[0-9a-f]{64}$/);

  assertExactKeys(receipt.run_admission_predecessor, PREDECESSOR_KEYS, 'receipt.run_admission_predecessor');
  requireCondition(receipt.run_admission_predecessor.profile_id === RUN_ADMISSION_PROFILE.profile_id, 'run-admission predecessor profile mismatch');
  assertExactStringSet(receipt.run_admission_predecessor.canonical_paths, RUN_ADMISSION_PROFILE.canonical_paths, 'receipt.run_admission_predecessor.canonical_paths');
  assertExactStringSet(receipt.run_admission_predecessor.invariants_preserved, RUN_ADMISSION_PROFILE.invariants, 'receipt.run_admission_predecessor.invariants_preserved');

  assertExactKeys(receipt.product, RECEIPT_PRODUCT_KEYS, 'receipt.product');
  const profile = profileFor(receipt.product.product_id);
  requireCondition(receipt.product.profile_id === profile.profile_id, 'receipt product profile mismatch');
  requireCondition(receipt.product.product_version === profile.product_version, 'receipt product version mismatch');
  requireCondition(receipt.product.product_contract_hash === profile.product_contract_hash, 'receipt product contract mismatch');
  requireCondition(receipt.product.local_mvp_source_path === profile.local_mvp_source_path, 'receipt local MVP path mismatch');
  requireCondition(receipt.product.predecessor_artifact_type === profile.predecessor_artifact_type, 'receipt predecessor type mismatch');
  assertString(receipt.product.predecessor_artifact_id, 'receipt.product.predecessor_artifact_id');
  assertString(receipt.product.predecessor_source_hash, 'receipt.product.predecessor_source_hash', /^sha256:[0-9a-f]{64}$/);
  assertString(receipt.product.predecessor_output_hash, 'receipt.product.predecessor_output_hash', /^sha256:[0-9a-f]{64}$/);
  assertString(receipt.product.predecessor_frontier_revision, 'receipt.product.predecessor_frontier_revision', /^[0-9a-f]{40}$/);
  requireCondition(receipt.product.local_mvp_revalidated === true, 'receipt local MVP must be revalidated');

  assertExactKeys(receipt.pilot, RECEIPT_PILOT_KEYS, 'receipt.pilot');
  assertString(receipt.pilot.pilot_id, 'receipt.pilot.pilot_id');
  requireCondition(receipt.pilot.mode === 'bounded_real_no_external_effect', 'receipt pilot mode mismatch');
  requireCondition(['real_non_personal', 'real_personal'].includes(receipt.pilot.data_mode), 'receipt pilot data_mode invalid');
  for (const key of [
    'real_data_involved', 'personal_data_involved', 'sensitive_personal_data_involved',
    'external_effect_requested', 'irreversible_effect_requested', 'real_world_decision_in_scope'
  ]) assertBoolean(receipt.pilot[key], `receipt.pilot.${key}`);
  requireCondition(receipt.pilot.real_data_involved === true, 'receipt must concern real data');
  requireCondition(
    receipt.pilot.data_mode === (receipt.pilot.personal_data_involved ? 'real_personal' : 'real_non_personal'),
    'receipt data_mode/personal_data_involved mismatch'
  );
  requireCondition(STATUSES.includes(receipt.pilot.status), 'receipt pilot status invalid');
  assertStringArray(receipt.pilot.reason_codes, 'receipt.pilot.reason_codes', 1);

  assertExactKeys(receipt.required_human_gates, GATE_KEYS, 'receipt.required_human_gates');
  for (const key of GATE_KEYS) assertBoolean(receipt.required_human_gates[key], `receipt.required_human_gates.${key}`);
  requireCondition(receipt.required_human_gates.human_product_owner_review_required === true, 'human product-owner review must remain required');
  requireCondition(receipt.required_human_gates.pilot_admission_disposition_required === true, 'pilot admission disposition must remain required');

  const unsafePilotBoundary =
    receipt.pilot.sensitive_personal_data_involved ||
    receipt.pilot.external_effect_requested ||
    receipt.pilot.irreversible_effect_requested ||
    receipt.pilot.real_world_decision_in_scope;
  if (unsafePilotBoundary) {
    requireCondition(
      receipt.pilot.status === 'PILOT_BOUNDARY_UNSATISFIED',
      'unsafe pilot boundary must remain PILOT_BOUNDARY_UNSATISFIED'
    );
  }
  if (receipt.pilot.personal_data_involved) {
    requireCondition(
      receipt.required_human_gates.data_protection_review_required === true,
      'personal-data receipt requires data-protection review gate'
    );
    requireCondition(
      receipt.required_human_gates.participant_consent_required === true,
      'personal-data receipt requires participant-consent gate'
    );
  }
  if (receipt.pilot.status === 'READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW') {
    requireCondition(receipt.pilot.personal_data_involved === false, 'READY status cannot carry personal data');
    requireCondition(
      receipt.required_human_gates.data_protection_review_required === false,
      'READY status cannot claim a pending data-protection gate'
    );
    requireCondition(unsafePilotBoundary === false, 'READY status cannot carry an unsafe pilot boundary');
  }
  if (receipt.pilot.status === 'DATA_PROTECTION_REVIEW_REQUIRED') {
    requireCondition(
      receipt.required_human_gates.data_protection_review_required === true,
      'DATA_PROTECTION_REVIEW_REQUIRED status requires data-protection gate'
    );
    requireCondition(unsafePilotBoundary === false, 'data-protection review status cannot mask an unsafe pilot boundary');
  }

  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  for (const key of TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required claim ${key} must be true`);
  for (const key of FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited claim ${key} must remain false`);
  assertExactStringSet(receipt.non_effects, REQUIRED_NON_EFFECTS, 'receipt.non_effects');
  requireCondition(receipt.next_safe_action === NEXT_ACTIONS[receipt.pilot.status], 'receipt next_safe_action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  const receipt = deriveReceipt(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'ProductPilotAdmissionValidationReceipt',
    candidate_id: input.candidate_id,
    candidate_hash: input.content_hash,
    valid: true,
    status: receipt.pilot.status,
    next_safe_action: receipt.next_safe_action,
    pilot_admitted: false,
    pilot_permit_created: false,
    real_pilot_started: false,
    execution_admitted: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new ProductPilotAdmissionError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function usage() {
  return [
    'UU-AAP Product Pilot Admission Profile v0.1', '',
    'Usage:',
    '  node protocols/integration/pilot-admission/v0.1/pilot-admission.js validate <file|->',
    '  node protocols/integration/pilot-admission/v0.1/pilot-admission.js inspect <file|->',
    '  node protocols/integration/pilot-admission/v0.1/pilot-admission.js help', '',
    'Read-only pre-admission only. No approve, admit, permit, pilot start, provider call or external effect command exists.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  requireCondition(['validate', 'inspect'].includes(command), `unsupported command: ${command}; allowed commands are validate, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : deriveReceipt(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: 'PRODUCT_PILOT_ADMISSION_REJECTED', message: error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();

module.exports = {
  ProductPilotAdmissionError,
  PROTOCOL, VERSION, INPUT_TYPE, RECEIPT_TYPE, STATUSES, NEXT_ACTIONS,
  RUN_ADMISSION_PROFILE, PRODUCT_PROFILES, INPUT_KEYS, FRONTIER_KEYS, PRODUCT_KEYS,
  PILOT_KEYS, REVIEW_KEYS, CONTROL_KEYS, RECEIPT_KEYS, SOURCE_KEYS, PREDECESSOR_KEYS,
  RECEIPT_PRODUCT_KEYS, RECEIPT_PILOT_KEYS, GATE_KEYS, TRUE_CLAIMS, FALSE_CLAIMS,
  CLAIM_KEYS, REQUIRED_NON_EFFECTS, canonicalize, computeContentHash, rehash,
  validateInput, revalidateLocalMvp, evaluateBoundary, deriveReceipt, validateReceipt,
  validationReceipt, parseText, readInput, usage, runCli
};
