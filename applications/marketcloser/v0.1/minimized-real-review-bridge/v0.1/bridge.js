'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Deployment = require(path.resolve(__dirname, '../../deployment-observation/v0.1/deployment-observation.js'));
const Marketer = require(path.resolve(__dirname, '../../../../../products/marketer-pessimist/v0.1/real-review-intake/v0.1/real-review-intake.js'));

const PROTOCOL = 'MARKETCLOSER-MINIMIZED-REAL-REVIEW-BRIDGE';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserMinimizedRealReviewBridgeInput';
const RECEIPT_TYPE = 'MarketCloserMinimizedRealReviewBridgeReceipt';
const ORIGIN_FRONTIER = 'b82b16a170c6e8d250735c51f430a39cf3663558';
const NEXT_SAFE_ACTION = 'REAL_REVIEW_RUN_AUTHORITY_GATE_REQUIRED';

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'bridge_id', 'evaluation_frontier',
  'deployment_observation', 'source_mode', 'minimization', 'minimized_case',
  'pressure_context', 'evidence_policy', 'controls', 'content_hash'
]);
const FRONTIER_KEYS = Object.freeze(['repository', 'revision', 'observed_at']);
const MINIMIZATION_KEYS = Object.freeze([
  'human_minimization_reviewed', 'independent_privacy_verification',
  'raw_review_text_included', 'raw_reviewer_identity_included',
  'personal_data_present', 'sensitive_personal_data_present',
  'protected_attribute_data_present', 'psychological_vulnerability_data_present',
  'cross_context_identifiers_present', 'source_identity_inferred'
]);
const CASE_KEYS = Object.freeze([
  'source_claim_epistemic_status', 'claim_package', 'supporting_evidence',
  'decision_constraints', 'raw_review_omitted_from_marketer',
  'pressure_context_omitted_from_marketer'
]);
const EVIDENCE_KEYS = Object.freeze([
  'evidence_id', 'data_class', 'summary', 'provenance_ref',
  'source_epistemic_status', 'quality', 'observed_at',
  'supports_statement_ids', 'contradicts_statement_ids'
]);
const PRESSURE_KEYS = Object.freeze([
  'present', 'platform_dependency_percent', 'reserve_weeks', 'data_age_days',
  'triage_only', 'transferred_to_marketer', 'epistemic_weight'
]);
const EVIDENCE_POLICY_KEYS = Object.freeze([
  'unverified_promoted_to_verified', 'deployment_binding_inferred',
  'business_pressure_transferred'
]);
const CONTROL_KEYS = Object.freeze([
  'local_only', 'read_only', 'network_access_available', 'dns_resolution_available',
  'provider_invocation_available', 'platform_mutation_available',
  'external_publication_available', 'response_publication_available',
  'pilot_permit_available', 'action_permit_available',
  'execution_available', 'external_effect_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol', 'version', 'receipt_type', 'receipt_id', 'source_input',
  'deployment_observation_binding', 'minimization', 'marketer_binding',
  'transfer_boundary', 'status', 'claims', 'non_effects',
  'next_safe_action', 'content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['bridge_id', 'bridge_hash']);
const DEPLOYMENT_BINDING_KEYS = Object.freeze([
  'receipt_id', 'receipt_hash', 'observation_status', 'binding_status',
  'deployment_verified', 'source_provenance_established'
]);
const MARKETER_BINDING_KEYS = Object.freeze([
  'intake_id', 'intake_hash', 'candidate_id', 'candidate_hash',
  'candidate_state', 'source_mode'
]);
const TRANSFER_KEYS = Object.freeze([
  'raw_review_transferred', 'raw_identity_transferred',
  'personal_data_transferred', 'sensitive_personal_data_transferred',
  'protected_attribute_data_transferred',
  'psychological_vulnerability_data_transferred',
  'cross_context_identifiers_transferred',
  'business_pressure_transferred', 'evidence_quality_promoted',
  'deployment_binding_inferred'
]);

const TRUE_CLAIMS = Object.freeze([
  'exact_deployment_observation_revalidated',
  'human_minimization_assertion_recorded',
  'exact_marketer_intake_derived',
  'exact_marketer_candidate_derived',
  'minimized_case_transferred',
  'deployment_binding_insufficiency_preserved'
]);
const FALSE_CLAIMS = Object.freeze([
  'independent_privacy_verified',
  'deployment_verified',
  'source_provenance_established',
  'raw_review_transferred',
  'reviewer_identity_transferred',
  'source_identity_inferred',
  'business_pressure_transferred',
  'evidence_quality_promoted',
  'stress_test_run',
  'stress_test_receipt_created',
  'response_candidate_created',
  'human_disposition_recorded',
  'pilot_permit_created',
  'action_permit_created',
  'execution_admitted',
  'external_effect_performed'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Raw Review != Minimized Claim',
  'Public Review != Non-Personal Data',
  'Human Minimization Review != Independent Privacy Verification',
  'Minimized Non-Personal Packet != Source Identity',
  'Deployment Observation != Deployment Provenance',
  'Deployment Binding Insufficient != Permission to Repair Provenance by Inference',
  'Business Pressure != Epistemic Weight',
  'Triage Context != Marketer Evidence',
  'User-Asserted Evidence Reference != Independently Verified Evidence',
  'Minimized Bridge != Stress-Test Run',
  'Marketer Real Review Candidate != Response Candidate',
  'Marketer Real Review Candidate != PilotPermit',
  'Marketer Real Review Candidate != ActionPermit',
  'Marketer Real Review Candidate != Execution'
]);

class MarketCloserMinimizedRealReviewBridgeError extends Error {}

function requireCondition(condition, message) {
  if (!condition) throw new MarketCloserMinimizedRealReviewBridgeError(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function computeContentHash(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.content_hash;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(copy)), 'utf8').digest('hex')}`;
}

function rehash(value) {
  value.content_hash = computeContentHash(value);
  return value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertExactKeys(value, expected, label) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(wanted), `${label} key mismatch`);
}

function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} format invalid`);
}

function assertTime(value, label) {
  assertString(value, label);
  requireCondition(Number.isFinite(Date.parse(value)), `${label} must be an ISO date-time`);
}

function validateMinimizedEvidence(items) {
  requireCondition(Array.isArray(items), 'supporting_evidence must be an array');
  for (const item of items) {
    assertExactKeys(item, EVIDENCE_KEYS, 'minimized evidence');
    requireCondition(
      ['synthetic_conformance', 'user_asserted_evidence_reference', 'independently_verified'].includes(item.source_epistemic_status),
      'unsupported source_epistemic_status'
    );
    requireCondition(['verified', 'unverified', 'stale', 'conflicting'].includes(item.quality), 'unsupported evidence quality');
    if (item.source_epistemic_status !== 'independently_verified') {
      requireCondition(item.quality !== 'verified', 'non-independent evidence cannot be promoted to verified');
    }
  }
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, 'protocol mismatch');
  requireCondition(input.version === VERSION, 'version mismatch');
  requireCondition(input.artifact_type === INPUT_TYPE, 'artifact_type mismatch');
  assertString(input.bridge_id, 'bridge_id',
    /^urn:uu-aap:marketcloser:minimized-real-review-bridge:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'repository mismatch');
  requireCondition(input.evaluation_frontier.revision === ORIGIN_FRONTIER, 'origin frontier mismatch');
  assertTime(input.evaluation_frontier.observed_at, 'evaluation_frontier.observed_at');

  Deployment.validateInput(input.deployment_observation);
  requireCondition(['synthetic_conformance', 'real_non_personal'].includes(input.source_mode), 'unsupported source_mode');
  requireCondition(
    input.source_mode === 'synthetic_conformance'
      ? input.deployment_observation.observation.method === 'synthetic_conformance'
      : input.deployment_observation.observation.method === 'manual_operator_sharing',
    'source_mode/deployment observation method mismatch'
  );

  assertExactKeys(input.minimization, MINIMIZATION_KEYS, 'minimization');
  requireCondition(input.minimization.human_minimization_reviewed === true, 'human minimization review required');
  requireCondition(input.minimization.independent_privacy_verification === false,
    'bridge cannot claim independent privacy verification');
  for (const key of MINIMIZATION_KEYS.filter(key =>
    !['human_minimization_reviewed', 'independent_privacy_verification'].includes(key))) {
    requireCondition(input.minimization[key] === false, `minimization boundary must remain false: ${key}`);
  }

  assertExactKeys(input.minimized_case, CASE_KEYS, 'minimized_case');
  requireCondition(
    input.minimized_case.source_claim_epistemic_status ===
      (input.source_mode === 'synthetic_conformance' ? 'synthetic_claim' : 'unverified_user_claim'),
    'source claim epistemic status/source mode mismatch'
  );
  requireCondition(input.minimized_case.raw_review_omitted_from_marketer === true,
    'raw review must be omitted from Marketer input');
  requireCondition(input.minimized_case.pressure_context_omitted_from_marketer === true,
    'pressure context must be omitted from Marketer input');
  validateMinimizedEvidence(input.minimized_case.supporting_evidence);

  assertExactKeys(input.pressure_context, PRESSURE_KEYS, 'pressure_context');
  requireCondition(typeof input.pressure_context.present === 'boolean', 'pressure_context.present must be boolean');
  requireCondition(Number.isFinite(input.pressure_context.platform_dependency_percent) &&
    input.pressure_context.platform_dependency_percent >= 0 &&
    input.pressure_context.platform_dependency_percent <= 100, 'platform dependency out of range');
  requireCondition(Number.isFinite(input.pressure_context.reserve_weeks) && input.pressure_context.reserve_weeks >= 0,
    'reserve_weeks invalid');
  requireCondition(Number.isFinite(input.pressure_context.data_age_days) && input.pressure_context.data_age_days >= 0,
    'data_age_days invalid');
  requireCondition(input.pressure_context.triage_only === true, 'pressure context must remain triage-only');
  requireCondition(input.pressure_context.transferred_to_marketer === false, 'pressure context cannot cross Marketer boundary');
  requireCondition(input.pressure_context.epistemic_weight === false, 'pressure context cannot gain epistemic weight');

  assertExactKeys(input.evidence_policy, EVIDENCE_POLICY_KEYS, 'evidence_policy');
  for (const key of EVIDENCE_POLICY_KEYS) requireCondition(input.evidence_policy[key] === false,
    `evidence policy must remain false: ${key}`);

  assertExactKeys(input.controls, CONTROL_KEYS, 'controls');
  requireCondition(input.controls.local_only === true && input.controls.read_only === true,
    'bridge must remain local and read-only');
  for (const key of CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) {
    requireCondition(input.controls[key] === false, `effect capability must remain false: ${key}`);
  }

  requireCondition(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function projectEvidence(items) {
  return items.map(item => ({
    evidence_id: item.evidence_id,
    data_class: item.data_class,
    summary: item.summary,
    provenance_ref: item.provenance_ref,
    quality: item.quality,
    observed_at: item.observed_at,
    supports_statement_ids: clone(item.supports_statement_ids),
    contradicts_statement_ids: clone(item.contradicts_statement_ids)
  }));
}

function deriveMarketerIntake(input, deploymentReceipt) {
  const intake = {
    protocol: Marketer.PROTOCOL,
    version: Marketer.VERSION,
    artifact_type: Marketer.INPUT_TYPE,
    intake_id: `urn:uu-aap:marketer-pessimist:real-review-intake:marketcloser-${input.content_hash.slice(-24)}`,
    contract_binding: {
      contract_id: Marketer.CONTRACT_ID,
      product_id: Marketer.PRODUCT_ID,
      product_version: Marketer.PRODUCT_VERSION,
      content_hash: Marketer.CONTRACT_HASH
    },
    evaluation_frontier: clone(input.evaluation_frontier),
    source_context: {
      mode: input.source_mode,
      source_reference: `urn:uu-aap:marketcloser:minimized-bridge-source:${input.content_hash.slice(-24)}`,
      source_observed_at: deploymentReceipt.observation.observed_at,
      classification_basis:
        'Human-reviewed MarketCloser minimization assertion; deployment binding remains insufficient and is not repaired by inference.',
      human_classification_supplied: true,
      personal_data_present: false,
      sensitive_personal_data_present: false,
      identity_resolution_required: false,
      protected_attribute_data_present: false,
      psychological_vulnerability_data_present: false,
      retention_mode: 'session',
      deletion_supported: true,
      correction_supported: true
    },
    claim_package: clone(input.minimized_case.claim_package),
    supporting_evidence: projectEvidence(input.minimized_case.supporting_evidence),
    decision_constraints: clone(input.minimized_case.decision_constraints),
    controls: {
      real_non_personal_input_available: true,
      local_only: true,
      read_only: true,
      network_access_required: false,
      filesystem_write_required: false,
      provider_invocation_available: false,
      publication_available: false,
      campaign_send_available: false,
      advertising_account_access_available: false,
      spend_available: false,
      audience_upload_available: false,
      personal_targeting_available: false,
      cross_context_correlation_available: false,
      external_system_mutation_available: false,
      human_disposition_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      execution_available: false,
      external_effect_available: false
    },
    content_hash: ''
  };
  Marketer.rehash(intake);
  return Marketer.validateInput(intake);
}

function deriveReceipt(input) {
  validateInput(input);
  const deploymentReceipt = Deployment.deriveReceipt(input.deployment_observation);
  requireCondition(deploymentReceipt.binding_status === 'DEPLOYMENT_BINDING_INSUFFICIENT',
    'deployment binding insufficiency must be preserved');

  const marketerIntake = deriveMarketerIntake(input, deploymentReceipt);
  const marketerCandidate = Marketer.deriveCandidate(marketerIntake);

  const claims = {};
  TRUE_CLAIMS.forEach(key => { claims[key] = true; });
  FALSE_CLAIMS.forEach(key => { claims[key] = false; });

  const transferBoundary = {
    raw_review_transferred: false,
    raw_identity_transferred: false,
    personal_data_transferred: false,
    sensitive_personal_data_transferred: false,
    protected_attribute_data_transferred: false,
    psychological_vulnerability_data_transferred: false,
    cross_context_identifiers_transferred: false,
    business_pressure_transferred: false,
    evidence_quality_promoted: false,
    deployment_binding_inferred: false
  };

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:minimized-real-review-bridge-receipt:${input.content_hash.slice(-24)}`,
    source_input: { bridge_id: input.bridge_id, bridge_hash: input.content_hash },
    deployment_observation_binding: {
      receipt_id: deploymentReceipt.receipt_id,
      receipt_hash: deploymentReceipt.content_hash,
      observation_status: deploymentReceipt.observation_status,
      binding_status: deploymentReceipt.binding_status,
      deployment_verified: false,
      source_provenance_established: false
    },
    minimization: clone(input.minimization),
    marketer_binding: {
      intake_id: marketerIntake.intake_id,
      intake_hash: marketerIntake.content_hash,
      candidate_id: marketerCandidate.candidate_id,
      candidate_hash: marketerCandidate.content_hash,
      candidate_state: marketerCandidate.state,
      source_mode: input.source_mode
    },
    transfer_boundary: transferBoundary,
    status: input.source_mode === 'real_non_personal'
      ? 'REAL_MINIMIZED_REVIEW_CANDIDATE_READY'
      : 'SYNTHETIC_MINIMIZED_BRIDGE_READY',
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  assertExactKeys(receipt, RECEIPT_KEYS, 'receipt');
  requireCondition(receipt.protocol === PROTOCOL, 'receipt protocol mismatch');
  requireCondition(receipt.version === VERSION, 'receipt version mismatch');
  requireCondition(receipt.receipt_type === RECEIPT_TYPE, 'receipt type mismatch');
  assertString(receipt.receipt_id, 'receipt.receipt_id',
    /^urn:uu-aap:marketcloser:minimized-real-review-bridge-receipt:[0-9a-f]{24}$/);

  assertExactKeys(receipt.source_input, SOURCE_INPUT_KEYS, 'receipt.source_input');
  assertString(receipt.source_input.bridge_id, 'receipt.source_input.bridge_id');
  assertString(receipt.source_input.bridge_hash, 'receipt.source_input.bridge_hash', /^sha256:[0-9a-f]{64}$/);

  assertExactKeys(receipt.deployment_observation_binding, DEPLOYMENT_BINDING_KEYS,
    'receipt.deployment_observation_binding');
  requireCondition(receipt.deployment_observation_binding.binding_status === 'DEPLOYMENT_BINDING_INSUFFICIENT',
    'receipt deployment binding must remain insufficient');
  requireCondition(receipt.deployment_observation_binding.deployment_verified === false,
    'receipt cannot verify deployment');
  requireCondition(receipt.deployment_observation_binding.source_provenance_established === false,
    'receipt cannot establish source provenance');

  assertExactKeys(receipt.minimization, MINIMIZATION_KEYS, 'receipt.minimization');
  requireCondition(receipt.minimization.human_minimization_reviewed === true,
    'receipt minimization review must be recorded');
  requireCondition(receipt.minimization.independent_privacy_verification === false,
    'receipt cannot claim independent privacy verification');

  assertExactKeys(receipt.marketer_binding, MARKETER_BINDING_KEYS, 'receipt.marketer_binding');
  requireCondition(['synthetic_conformance', 'real_non_personal'].includes(receipt.marketer_binding.source_mode),
    'receipt source mode invalid');
  requireCondition(
    receipt.marketer_binding.candidate_state ===
      (receipt.marketer_binding.source_mode === 'real_non_personal'
        ? 'REAL_REVIEW_CANDIDATE_READY'
        : 'SYNTHETIC_CONFORMANCE_CANDIDATE_READY'),
    'receipt Marketer candidate state mismatch'
  );

  assertExactKeys(receipt.transfer_boundary, TRANSFER_KEYS, 'receipt.transfer_boundary');
  Object.entries(receipt.transfer_boundary).forEach(([key, value]) =>
    requireCondition(value === false, `transfer boundary must remain false: ${key}`));

  requireCondition(
    receipt.status === (receipt.marketer_binding.source_mode === 'real_non_personal'
      ? 'REAL_MINIMIZED_REVIEW_CANDIDATE_READY'
      : 'SYNTHETIC_MINIMIZED_BRIDGE_READY'),
    'receipt status/source mode mismatch'
  );

  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  TRUE_CLAIMS.forEach(key => requireCondition(receipt.claims[key] === true, `required claim ${key} must be true`));
  FALSE_CLAIMS.forEach(key => requireCondition(receipt.claims[key] === false, `prohibited claim ${key} must remain false`));

  requireCondition(Array.isArray(receipt.non_effects), 'receipt.non_effects must be an array');
  requireCondition(
    receipt.non_effects.length === REQUIRED_NON_EFFECTS.length &&
    JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()),
    'receipt non_effect set mismatch'
  );
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'receipt next_safe_action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserMinimizedRealReviewBridgeInputValidationReceipt',
    bridge_id: input.bridge_id,
    bridge_hash: input.content_hash,
    valid: true,
    raw_review_transferred: false,
    business_pressure_transferred: false,
    external_effect_available: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserMinimizedRealReviewBridgeError(`invalid JSON: ${error.message}`); }
}

function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function usage() {
  return [
    'MarketCloser Minimized Real Review Bridge v0.1',
    '',
    'Usage:',
    '  node applications/marketcloser/v0.1/minimized-real-review-bridge/v0.1/bridge.js validate <file|->',
    '  node applications/marketcloser/v0.1/minimized-real-review-bridge/v0.1/bridge.js receipt <file|->',
    '  node applications/marketcloser/v0.1/minimized-real-review-bridge/v0.1/bridge.js help',
    '',
    'The bridge is local, read-only and no-effect. It revalidates deployment observation and derives a Marketer Pessimist review candidate without running a stress-test.'
  ].join('\n');
}

function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  requireCondition(['validate', 'receipt'].includes(command), `unsupported command: ${command}`);
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or -`);
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
    process.stderr.write(`${JSON.stringify({
      error: 'MARKETCLOSER_MINIMIZED_REAL_REVIEW_BRIDGE_REJECTED',
      message: error.message || String(error)
    })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  MarketCloserMinimizedRealReviewBridgeError,
  PROTOCOL,
  VERSION,
  INPUT_TYPE,
  RECEIPT_TYPE,
  ORIGIN_FRONTIER,
  NEXT_SAFE_ACTION,
  INPUT_KEYS,
  RECEIPT_KEYS,
  TRUE_CLAIMS,
  FALSE_CLAIMS,
  CLAIM_KEYS,
  REQUIRED_NON_EFFECTS,
  canonicalize,
  computeContentHash,
  rehash,
  validateInput,
  deriveMarketerIntake,
  deriveReceipt,
  validateReceipt,
  validationReceipt,
  parseText,
  readInput,
  usage,
  runCli
};
