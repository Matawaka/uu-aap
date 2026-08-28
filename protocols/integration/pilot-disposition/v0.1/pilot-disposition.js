'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Admission = require('../../pilot-admission/v0.1/pilot-admission.js');
const AdmissionBinding = require('../../pilot-admission/v0.1/receipt-binding.js');

const PROTOCOL = 'UU-AAP-PRODUCT-PILOT-HUMAN-DISPOSITION';
const VERSION = '0.1';
const INPUT_TYPE = 'ProductPilotHumanDispositionInput';
const RECEIPT_TYPE = 'ProductPilotHumanDispositionReceipt';

const DECISIONS = Object.freeze(['APPROVE', 'DEFER', 'REJECT']);
const DECISION_CONTEXTS = Object.freeze(['synthetic_conformance', 'human_supplied']);
const STATUSES = Object.freeze([
  'HUMAN_ADMISSION_APPROVED_PERMIT_NOT_CREATED',
  'PRODUCT_REVIEW_APPROVED_DATA_PROTECTION_STILL_REQUIRED',
  'HUMAN_REVIEW_DEFERRED',
  'HUMAN_REVIEW_REJECTED'
]);
const NEXT_ACTIONS = Object.freeze({
  HUMAN_ADMISSION_APPROVED_PERMIT_NOT_CREATED: 'SEPARATE_AUTHORITY_BOUND_PILOT_PERMIT_REVIEW_REQUIRED',
  PRODUCT_REVIEW_APPROVED_DATA_PROTECTION_STILL_REQUIRED: 'SEPARATE_DATA_PROTECTION_CONSENT_AND_AUTHORITY_REVIEW_REQUIRED',
  HUMAN_REVIEW_DEFERRED: 'NO_PILOT_ACTION_UNTIL_NEW_HUMAN_REVIEW',
  HUMAN_REVIEW_REJECTED: 'STOP_THIS_PILOT_CANDIDATE_WITHOUT_SANCTION'
});
const REASON_CODES = Object.freeze({
  HUMAN_ADMISSION_APPROVED_PERMIT_NOT_CREATED: ['HUMAN_APPROVE_RECORDED_BUT_PERMIT_REMAINS_SEPARATE'],
  PRODUCT_REVIEW_APPROVED_DATA_PROTECTION_STILL_REQUIRED: ['HUMAN_APPROVE_RECORDED_BUT_DATA_PROTECTION_REVIEW_REMAINS_REQUIRED'],
  HUMAN_REVIEW_DEFERRED: ['HUMAN_DEFER_RECORDED'],
  HUMAN_REVIEW_REJECTED: ['HUMAN_REJECT_RECORDED_WITHOUT_SANCTION']
});

const CANDIDATE_PROFILES = Object.freeze({
  'protocols/integration/pilot-admission/v0.1/examples/marketer-pessimist-real-non-personal.candidate.json': Object.freeze({
    product_id: 'marketer-pessimist',
    admission_status: 'READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW'
  }),
  'protocols/integration/pilot-admission/v0.1/examples/honest-hiring-real-personal.candidate.json': Object.freeze({
    product_id: 'honest-hiring',
    admission_status: 'DATA_PROTECTION_REVIEW_REQUIRED'
  })
});

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'disposition_id', 'evaluation_frontier',
  'admission_candidate_path', 'expected_product_id', 'decision', 'controls', 'content_hash'
]);
const FRONTIER_KEYS = Object.freeze(['repository', 'revision']);
const DECISION_KEYS = Object.freeze([
  'decision_context', 'decision', 'reviewer_reference', 'rationale', 'recorded_at'
]);
const CONTROL_KEYS = Object.freeze([
  'local_only', 'read_only', 'pilot_permit_creation_available', 'pilot_start_available',
  'network_delivery_available', 'provider_invocation_available', 'account_mutation_available',
  'external_effect_available', 'action_permit_available', 'execution_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol', 'version', 'receipt_type', 'receipt_id', 'evaluation_frontier',
  'source_disposition', 'admission_predecessor', 'product', 'human_decision',
  'disposition', 'required_followup_gates', 'claims', 'non_effects',
  'next_safe_action', 'content_hash'
]);
const SOURCE_KEYS = Object.freeze(['disposition_id', 'disposition_hash', 'decision_context']);
const ADMISSION_KEYS = Object.freeze([
  'candidate_path', 'candidate_id', 'candidate_hash', 'preflight_receipt_type',
  'preflight_receipt_id', 'preflight_receipt_hash', 'preflight_status',
  'data_protection_review_required', 'participant_consent_required'
]);
const PRODUCT_KEYS = Object.freeze(['product_id', 'product_profile_id', 'product_version']);
const HUMAN_DECISION_KEYS = Object.freeze([
  'decision_context', 'decision', 'reviewer_reference', 'rationale', 'recorded_at',
  'reviewer_identity_verified', 'reviewer_authority_verified'
]);
const DISPOSITION_KEYS = Object.freeze(['status', 'reason_codes']);
const FOLLOWUP_KEYS = Object.freeze([
  'reviewer_identity_verification_required_for_reliance',
  'reviewer_authority_verification_required_for_reliance',
  'data_protection_review_required', 'participant_consent_required',
  'pilot_permit_required_before_start'
]);
const CLAIM_KEYS = Object.freeze([
  'exact_admission_candidate_revalidated',
  'exact_admission_preflight_revalidated',
  'human_decision_recorded',
  'human_approval_recorded',
  'human_deferral_recorded',
  'human_rejection_recorded',
  'reviewer_identity_verified',
  'reviewer_authority_verified',
  'product_owner_authority_verified',
  'pilot_admitted',
  'pilot_permit_created',
  'real_pilot_started',
  'participant_consent_recorded',
  'data_protection_approved',
  'external_effect_authorized',
  'external_effect_performed',
  'real_world_decision_authorized',
  'account_mutation_authorized',
  'network_delivery_performed',
  'provider_invoked',
  'authority_created',
  'responsibility_accepted',
  'action_permit_created',
  'execution_admitted',
  'stable_core_promotion_established',
  'successor_authority_created'
]);
const ALWAYS_FALSE_CLAIMS = Object.freeze([
  'reviewer_identity_verified', 'reviewer_authority_verified', 'product_owner_authority_verified',
  'pilot_admitted', 'pilot_permit_created', 'real_pilot_started',
  'participant_consent_recorded', 'data_protection_approved',
  'external_effect_authorized', 'external_effect_performed',
  'real_world_decision_authorized', 'account_mutation_authorized',
  'network_delivery_performed', 'provider_invoked', 'authority_created',
  'responsibility_accepted', 'action_permit_created', 'execution_admitted',
  'stable_core_promotion_established', 'successor_authority_created'
]);
const REQUIRED_NON_EFFECTS = Object.freeze([
  'Human Decision Recorded != Reviewer Identity Verified',
  'Human Decision Recorded != Reviewer Authority Verified',
  'Human Approval != PilotPermit',
  'Human Approval != Pilot Start',
  'Human Approval != ActionPermit',
  'Human Approval != Execution Admission',
  'Product-Owner Approval != Data-Protection Approval',
  'Data-Protection Review Required != Consent Recorded',
  'Reject or Defer != Sanction or Global Prohibition',
  'Disposition Receipt != Successor Authority'
]);

class ProductPilotDispositionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductPilotDispositionError';
  }
}

function fail(message) { throw new ProductPilotDispositionError(message); }
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

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === INPUT_TYPE, `artifact_type must be ${INPUT_TYPE}`);
  assertString(input.disposition_id, 'disposition_id', /^urn:uu-aap:pilot-human-disposition:input:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'evaluation frontier repository mismatch');
  assertString(input.evaluation_frontier.revision, 'evaluation_frontier.revision', /^[0-9a-f]{40}$/);

  const profile = CANDIDATE_PROFILES[input.admission_candidate_path];
  requireCondition(profile, 'unsupported admission candidate path');
  requireCondition(input.expected_product_id === profile.product_id, 'expected product does not match candidate profile');

  assertExactKeys(input.decision, DECISION_KEYS, 'decision');
  requireCondition(DECISION_CONTEXTS.includes(input.decision.decision_context), 'decision context invalid');
  requireCondition(DECISIONS.includes(input.decision.decision), 'decision invalid');
  assertString(input.decision.reviewer_reference, 'decision.reviewer_reference');
  assertString(input.decision.rationale, 'decision.rationale');
  assertString(input.decision.recorded_at, 'decision.recorded_at', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  if (input.decision.decision_context === 'synthetic_conformance') {
    requireCondition(input.decision.decision === 'DEFER', 'synthetic conformance fixtures may only record DEFER');
  }

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

function deriveAdmissionPredecessor(input) {
  const profile = CANDIDATE_PROFILES[input.admission_candidate_path];
  const candidate = readJsonFromRepo(input.admission_candidate_path);
  Admission.validateInput(candidate);
  requireCondition(candidate.product.product_id === profile.product_id, 'admission candidate product mismatch');
  requireCondition(candidate.product.product_id === input.expected_product_id, 'admission candidate expected product mismatch');

  const preflight = Admission.deriveReceipt(candidate);
  Admission.validateReceipt(preflight);
  AdmissionBinding.validateReceiptAgainstCandidate(candidate, preflight);
  requireCondition(preflight.pilot.status === profile.admission_status, 'canonical admission status drift');
  requireCondition(preflight.claims.pilot_admitted === false, 'admission predecessor pilot overclaim');
  requireCondition(preflight.claims.pilot_permit_created === false, 'admission predecessor permit overclaim');
  requireCondition(preflight.claims.real_pilot_started === false, 'admission predecessor start overclaim');

  return { candidate, preflight };
}

function expectedDisposition(decision, upstreamStatus) {
  if (decision === 'DEFER') return 'HUMAN_REVIEW_DEFERRED';
  if (decision === 'REJECT') return 'HUMAN_REVIEW_REJECTED';
  requireCondition(decision === 'APPROVE', 'unsupported decision');
  requireCondition(upstreamStatus !== 'PILOT_BOUNDARY_UNSATISFIED', 'cannot approve an unsatisfied pilot boundary');
  if (upstreamStatus === 'READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW') {
    return 'HUMAN_ADMISSION_APPROVED_PERMIT_NOT_CREATED';
  }
  if (upstreamStatus === 'DATA_PROTECTION_REVIEW_REQUIRED') {
    return 'PRODUCT_REVIEW_APPROVED_DATA_PROTECTION_STILL_REQUIRED';
  }
  fail(`unsupported upstream admission status: ${upstreamStatus}`);
}

function deriveReceipt(input) {
  validateInput(input);
  const { candidate, preflight } = deriveAdmissionPredecessor(input);
  const status = expectedDisposition(input.decision.decision, preflight.pilot.status);
  const claims = {
    exact_admission_candidate_revalidated: true,
    exact_admission_preflight_revalidated: true,
    human_decision_recorded: true,
    human_approval_recorded: input.decision.decision === 'APPROVE',
    human_deferral_recorded: input.decision.decision === 'DEFER',
    human_rejection_recorded: input.decision.decision === 'REJECT',
    reviewer_identity_verified: false,
    reviewer_authority_verified: false,
    product_owner_authority_verified: false,
    pilot_admitted: false,
    pilot_permit_created: false,
    real_pilot_started: false,
    participant_consent_recorded: false,
    data_protection_approved: false,
    external_effect_authorized: false,
    external_effect_performed: false,
    real_world_decision_authorized: false,
    account_mutation_authorized: false,
    network_delivery_performed: false,
    provider_invoked: false,
    authority_created: false,
    responsibility_accepted: false,
    action_permit_created: false,
    execution_admitted: false,
    stable_core_promotion_established: false,
    successor_authority_created: false
  };

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: deterministicId('urn:uu-aap:pilot-human-disposition:receipt:', {
      disposition_hash: input.content_hash,
      admission_preflight_hash: preflight.content_hash
    }),
    evaluation_frontier: clone(input.evaluation_frontier),
    source_disposition: {
      disposition_id: input.disposition_id,
      disposition_hash: input.content_hash,
      decision_context: input.decision.decision_context
    },
    admission_predecessor: {
      candidate_path: input.admission_candidate_path,
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.content_hash,
      preflight_receipt_type: preflight.receipt_type,
      preflight_receipt_id: preflight.receipt_id,
      preflight_receipt_hash: preflight.content_hash,
      preflight_status: preflight.pilot.status,
      data_protection_review_required: preflight.required_human_gates.data_protection_review_required,
      participant_consent_required: preflight.required_human_gates.participant_consent_required
    },
    product: {
      product_id: candidate.product.product_id,
      product_profile_id: candidate.product.profile_id,
      product_version: candidate.product.product_version
    },
    human_decision: {
      decision_context: input.decision.decision_context,
      decision: input.decision.decision,
      reviewer_reference: input.decision.reviewer_reference,
      rationale: input.decision.rationale,
      recorded_at: input.decision.recorded_at,
      reviewer_identity_verified: false,
      reviewer_authority_verified: false
    },
    disposition: {
      status,
      reason_codes: [...REASON_CODES[status]]
    },
    required_followup_gates: {
      reviewer_identity_verification_required_for_reliance: true,
      reviewer_authority_verification_required_for_reliance: true,
      data_protection_review_required: preflight.required_human_gates.data_protection_review_required,
      participant_consent_required: preflight.required_human_gates.participant_consent_required,
      pilot_permit_required_before_start: true
    },
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_ACTIONS[status],
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
  assertString(receipt.receipt_id, 'receipt.receipt_id', /^urn:uu-aap:pilot-human-disposition:receipt:[0-9a-f]{24}$/);

  assertExactKeys(receipt.evaluation_frontier, FRONTIER_KEYS, 'receipt.evaluation_frontier');
  requireCondition(receipt.evaluation_frontier.repository === 'Matawaka/uu-aap', 'receipt repository mismatch');
  assertString(receipt.evaluation_frontier.revision, 'receipt.evaluation_frontier.revision', /^[0-9a-f]{40}$/);

  assertExactKeys(receipt.source_disposition, SOURCE_KEYS, 'receipt.source_disposition');
  assertString(receipt.source_disposition.disposition_id, 'receipt.source_disposition.disposition_id');
  assertString(receipt.source_disposition.disposition_hash, 'receipt.source_disposition.disposition_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(DECISION_CONTEXTS.includes(receipt.source_disposition.decision_context), 'receipt decision context invalid');

  assertExactKeys(receipt.admission_predecessor, ADMISSION_KEYS, 'receipt.admission_predecessor');
  const profile = CANDIDATE_PROFILES[receipt.admission_predecessor.candidate_path];
  requireCondition(profile, 'receipt admission candidate path unsupported');
  assertString(receipt.admission_predecessor.candidate_id, 'receipt.admission_predecessor.candidate_id');
  assertString(receipt.admission_predecessor.candidate_hash, 'receipt.admission_predecessor.candidate_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(receipt.admission_predecessor.preflight_receipt_type === Admission.RECEIPT_TYPE, 'receipt admission predecessor type mismatch');
  assertString(receipt.admission_predecessor.preflight_receipt_id, 'receipt.admission_predecessor.preflight_receipt_id');
  assertString(receipt.admission_predecessor.preflight_receipt_hash, 'receipt.admission_predecessor.preflight_receipt_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(receipt.admission_predecessor.preflight_status === profile.admission_status, 'receipt admission status drift');
  assertBoolean(receipt.admission_predecessor.data_protection_review_required, 'receipt.admission_predecessor.data_protection_review_required');
  assertBoolean(receipt.admission_predecessor.participant_consent_required, 'receipt.admission_predecessor.participant_consent_required');

  assertExactKeys(receipt.product, PRODUCT_KEYS, 'receipt.product');
  requireCondition(receipt.product.product_id === profile.product_id, 'receipt product mismatch');
  assertString(receipt.product.product_profile_id, 'receipt.product.product_profile_id');
  requireCondition(receipt.product.product_version === '0.1', 'receipt product version mismatch');

  assertExactKeys(receipt.human_decision, HUMAN_DECISION_KEYS, 'receipt.human_decision');
  requireCondition(receipt.human_decision.decision_context === receipt.source_disposition.decision_context, 'receipt decision context binding mismatch');
  requireCondition(DECISION_CONTEXTS.includes(receipt.human_decision.decision_context), 'receipt human decision context invalid');
  requireCondition(DECISIONS.includes(receipt.human_decision.decision), 'receipt human decision invalid');
  assertString(receipt.human_decision.reviewer_reference, 'receipt.human_decision.reviewer_reference');
  assertString(receipt.human_decision.rationale, 'receipt.human_decision.rationale');
  assertString(receipt.human_decision.recorded_at, 'receipt.human_decision.recorded_at', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  requireCondition(receipt.human_decision.reviewer_identity_verified === false, 'receipt may not verify reviewer identity');
  requireCondition(receipt.human_decision.reviewer_authority_verified === false, 'receipt may not verify reviewer authority');
  if (receipt.human_decision.decision_context === 'synthetic_conformance') {
    requireCondition(receipt.human_decision.decision === 'DEFER', 'synthetic receipt may only record DEFER');
  }

  assertExactKeys(receipt.disposition, DISPOSITION_KEYS, 'receipt.disposition');
  const expectedStatus = expectedDisposition(receipt.human_decision.decision, receipt.admission_predecessor.preflight_status);
  requireCondition(receipt.disposition.status === expectedStatus, 'receipt disposition status mismatch');
  requireCondition(STATUSES.includes(receipt.disposition.status), 'receipt disposition status invalid');
  assertExactStringSet(receipt.disposition.reason_codes, REASON_CODES[expectedStatus], 'receipt.disposition.reason_codes');

  assertExactKeys(receipt.required_followup_gates, FOLLOWUP_KEYS, 'receipt.required_followup_gates');
  for (const key of FOLLOWUP_KEYS) assertBoolean(receipt.required_followup_gates[key], `receipt.required_followup_gates.${key}`);
  requireCondition(receipt.required_followup_gates.reviewer_identity_verification_required_for_reliance === true, 'reviewer identity verification must remain required for reliance');
  requireCondition(receipt.required_followup_gates.reviewer_authority_verification_required_for_reliance === true, 'reviewer authority verification must remain required for reliance');
  requireCondition(receipt.required_followup_gates.pilot_permit_required_before_start === true, 'pilot permit must remain required before start');
  requireCondition(receipt.required_followup_gates.data_protection_review_required === receipt.admission_predecessor.data_protection_review_required, 'data-protection gate mismatch');
  requireCondition(receipt.required_followup_gates.participant_consent_required === receipt.admission_predecessor.participant_consent_required, 'participant-consent gate mismatch');

  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  requireCondition(receipt.claims.exact_admission_candidate_revalidated === true, 'admission candidate revalidation claim required');
  requireCondition(receipt.claims.exact_admission_preflight_revalidated === true, 'admission preflight revalidation claim required');
  requireCondition(receipt.claims.human_decision_recorded === true, 'human decision recorded claim required');
  requireCondition(receipt.claims.human_approval_recorded === (receipt.human_decision.decision === 'APPROVE'), 'human approval claim mismatch');
  requireCondition(receipt.claims.human_deferral_recorded === (receipt.human_decision.decision === 'DEFER'), 'human deferral claim mismatch');
  requireCondition(receipt.claims.human_rejection_recorded === (receipt.human_decision.decision === 'REJECT'), 'human rejection claim mismatch');
  for (const key of ALWAYS_FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited claim ${key} must remain false`);

  assertExactStringSet(receipt.non_effects, REQUIRED_NON_EFFECTS, 'receipt.non_effects');
  requireCondition(receipt.next_safe_action === NEXT_ACTIONS[expectedStatus], 'receipt next_safe_action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  const receipt = deriveReceipt(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'ProductPilotHumanDispositionValidationReceipt',
    disposition_id: input.disposition_id,
    disposition_hash: input.content_hash,
    valid: true,
    status: receipt.disposition.status,
    next_safe_action: receipt.next_safe_action,
    reviewer_identity_verified: false,
    reviewer_authority_verified: false,
    pilot_permit_created: false,
    real_pilot_started: false,
    execution_admitted: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new ProductPilotDispositionError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function usage() {
  return [
    'UU-AAP Product Pilot Human Disposition v0.1', '',
    'Usage:',
    '  node protocols/integration/pilot-disposition/v0.1/pilot-disposition.js validate <file|->',
    '  node protocols/integration/pilot-disposition/v0.1/pilot-disposition.js inspect <file|->',
    '  node protocols/integration/pilot-disposition/v0.1/pilot-disposition.js help', '',
    'Read-only disposition recording only. No authority verification, permit creation, pilot start or execution command exists.'
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
    process.stderr.write(`${JSON.stringify({ error: 'PRODUCT_PILOT_HUMAN_DISPOSITION_REJECTED', message: error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();

module.exports = {
  ProductPilotDispositionError,
  PROTOCOL, VERSION, INPUT_TYPE, RECEIPT_TYPE,
  DECISIONS, DECISION_CONTEXTS, STATUSES, NEXT_ACTIONS, REASON_CODES,
  CANDIDATE_PROFILES, INPUT_KEYS, FRONTIER_KEYS, DECISION_KEYS, CONTROL_KEYS,
  RECEIPT_KEYS, SOURCE_KEYS, ADMISSION_KEYS, PRODUCT_KEYS, HUMAN_DECISION_KEYS,
  DISPOSITION_KEYS, FOLLOWUP_KEYS, CLAIM_KEYS, ALWAYS_FALSE_CLAIMS, REQUIRED_NON_EFFECTS,
  canonicalize, computeContentHash, rehash, validateInput, deriveAdmissionPredecessor,
  expectedDisposition, deriveReceipt, validateReceipt, validationReceipt,
  parseText, readInput, usage, runCli
};
