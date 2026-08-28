'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'MARKETER-PESSIMIST-REAL-REVIEW-INTAKE';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketerPessimistRealReviewIntake';
const CANDIDATE_TYPE = 'MarketerPessimistRealReviewCandidate';
const CONTRACT_ID = 'marketer-pessimist-product-contract';
const PRODUCT_ID = 'marketer-pessimist';
const PRODUCT_VERSION = '0.1';
const CONTRACT_HASH = 'sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6';
const NEXT_SAFE_ACTION = 'AUTHORITY_VERIFICATION_AND_REAL_REVIEW_RUN_GATE_REQUIRED';

const SOURCE_MODES = Object.freeze(['synthetic_conformance', 'real_non_personal']);
const CLASSIFICATIONS = Object.freeze([
  'observed_evidence',
  'interpretation',
  'assumption',
  'hypothesis',
  'declared_objective'
]);
const EVIDENCE_QUALITY = Object.freeze(['verified', 'unverified', 'stale', 'conflicting']);

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'intake_id', 'contract_binding',
  'evaluation_frontier', 'source_context', 'claim_package', 'supporting_evidence',
  'decision_constraints', 'controls', 'content_hash'
]);
const CONTRACT_KEYS = Object.freeze(['contract_id', 'product_id', 'product_version', 'content_hash']);
const FRONTIER_KEYS = Object.freeze(['repository', 'revision', 'observed_at']);
const SOURCE_KEYS = Object.freeze([
  'mode', 'source_reference', 'source_observed_at', 'classification_basis',
  'human_classification_supplied', 'personal_data_present',
  'sensitive_personal_data_present', 'identity_resolution_required',
  'protected_attribute_data_present', 'psychological_vulnerability_data_present',
  'retention_mode', 'deletion_supported', 'correction_supported'
]);
const CLAIM_PACKAGE_KEYS = Object.freeze([
  'claim_id', 'data_class', 'claim_text', 'review_purpose', 'scope', 'material_statements'
]);
const STATEMENT_KEYS = Object.freeze([
  'statement_id', 'data_class', 'text', 'classification', 'material',
  'evidence_refs', 'falsification_probe'
]);
const FALSIFICATION_KEYS = Object.freeze(['status', 'kind', 'description', 'unavailable_reason']);
const EVIDENCE_KEYS = Object.freeze([
  'evidence_id', 'data_class', 'summary', 'provenance_ref', 'quality',
  'observed_at', 'supports_statement_ids', 'contradicts_statement_ids'
]);
const DECISION_KEYS = Object.freeze([
  'data_class', 'objectives', 'constraints', 'unacceptable_outcomes', 'success_conditions'
]);
const CONTROL_KEYS = Object.freeze([
  'real_non_personal_input_available', 'local_only', 'read_only',
  'network_access_required', 'filesystem_write_required', 'provider_invocation_available',
  'publication_available', 'campaign_send_available', 'advertising_account_access_available',
  'spend_available', 'audience_upload_available', 'personal_targeting_available',
  'cross_context_correlation_available', 'external_system_mutation_available',
  'human_disposition_available', 'pilot_permit_available', 'action_permit_available',
  'execution_available', 'external_effect_available'
]);

const CANDIDATE_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'candidate_id', 'state', 'contract_binding',
  'evaluation_frontier', 'source_binding', 'bounded_case', 'safety_boundary',
  'claims', 'non_effects', 'next_safe_action', 'content_hash'
]);
const SOURCE_BINDING_KEYS = Object.freeze([
  'intake_id', 'intake_hash', 'mode', 'source_reference', 'source_observed_at',
  'classification_basis_hash'
]);
const BOUNDED_CASE_KEYS = Object.freeze(['claim_package', 'supporting_evidence', 'decision_constraints']);
const SAFETY_KEYS = Object.freeze([
  'human_classification_supplied', 'personal_data_present', 'sensitive_personal_data_present',
  'identity_resolution_required', 'protected_attribute_data_present',
  'psychological_vulnerability_data_present', 'local_only', 'read_only',
  'network_access_required', 'provider_invocation_available', 'publication_available',
  'campaign_send_available', 'spend_available', 'personal_targeting_available',
  'external_system_mutation_available', 'pilot_permit_available',
  'action_permit_available', 'execution_available', 'external_effect_available'
]);

const TRUE_CLAIMS = Object.freeze([
  'intake_validated',
  'exact_contract_bound',
  'source_mode_recorded',
  'human_data_classification_recorded',
  'bounded_review_candidate_created',
  'claim_structure_preserved',
  'evidence_lineage_preserved',
  'external_effect_boundary_preserved'
]);
const FALSE_CLAIMS = Object.freeze([
  'source_identity_inferred',
  'reviewer_identity_verified',
  'reviewer_authority_verified',
  'non_personal_status_inferred',
  'local_mvp_runtime_invoked',
  'stress_test_receipt_created',
  'human_disposition_recorded',
  'pilot_admitted',
  'pilot_permit_created',
  'publication_authorized',
  'campaign_send_authorized',
  'campaign_sent',
  'advertising_account_accessed',
  'funds_spent',
  'audience_uploaded',
  'personal_targeting_performed',
  'protected_attribute_inferred',
  'psychological_vulnerability_inferred',
  'external_system_mutated',
  'action_permit_created',
  'execution_admitted',
  'external_effect_performed',
  'stable_core_promotion_established',
  'successor_authority_created'
]);
const RECEIPT_CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Real Source != Synthetic Fixture',
  'Real Review Intake != Pilot Admission',
  'Pilot Admission != Human Disposition',
  'Human Disposition != Authority Verification',
  'Intake Candidate != Stress-Test Receipt',
  'Intake Candidate != PilotPermit',
  'Intake Candidate != ActionPermit',
  'Intake Candidate != Execution',
  'Non-Personal Classification != Identity Inference',
  'Missing Personal Data Evidence != Proof of Non-Personal Data'
]);

class MarketerPessimistRealReviewIntakeError extends Error {}

function requireCondition(condition, message) {
  if (!condition) throw new MarketerPessimistRealReviewIntakeError(message);
}

function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}

function assertBoolean(value, label) {
  requireCondition(typeof value === 'boolean', `${label} must be boolean`);
}

function assertExactKeys(value, expectedKeys, label) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} key set mismatch`);
}

function assertStringArray(value, label, minItems = 0) {
  requireCondition(Array.isArray(value) && value.length >= minItems, `${label} must be an array`);
  value.forEach((item, index) => assertString(item, `${label}[${index}]`));
  requireCondition(new Set(value).size === value.length, `${label} must not contain duplicates`);
}

function parseTime(value, label) {
  assertString(value, label);
  requireCondition(!Number.isNaN(Date.parse(value)), `${label} must be an ISO date-time`);
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
  copy.content_hash = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(copy))).digest('hex')}`;
}

function rehash(value) {
  value.content_hash = computeContentHash(value);
  return value;
}

function hashText(text) {
  return `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateClaimAndEvidence(container) {
  const claim = container.claim_package;
  const evidenceItems = container.supporting_evidence;
  const decision = container.decision_constraints;

  assertExactKeys(claim, CLAIM_PACKAGE_KEYS, 'claim_package');
  assertString(claim.claim_id, 'claim_package.claim_id', /^claim-[a-z0-9][a-z0-9-]{1,63}$/);
  requireCondition(claim.data_class === 'claim-content', 'claim_package.data_class mismatch');
  assertString(claim.claim_text, 'claim_package.claim_text');
  assertString(claim.review_purpose, 'claim_package.review_purpose');
  assertStringArray(claim.scope, 'claim_package.scope', 1);
  requireCondition(Array.isArray(claim.material_statements) && claim.material_statements.length > 0,
    'material_statements required');

  const statementIds = new Set();
  for (const statement of claim.material_statements) {
    assertExactKeys(statement, STATEMENT_KEYS, 'material_statement');
    assertString(statement.statement_id, 'statement.statement_id', /^stmt-[a-z0-9][a-z0-9-]{1,63}$/);
    requireCondition(!statementIds.has(statement.statement_id), `duplicate statement id: ${statement.statement_id}`);
    statementIds.add(statement.statement_id);
    requireCondition(statement.data_class === 'claim-content', 'statement.data_class mismatch');
    assertString(statement.text, 'statement.text');
    requireCondition(CLASSIFICATIONS.includes(statement.classification),
      `unsupported classification: ${statement.classification}`);
    requireCondition(statement.material === true, 'statement.material must be true');
    assertStringArray(statement.evidence_refs, 'statement.evidence_refs');
    assertExactKeys(statement.falsification_probe, FALSIFICATION_KEYS, 'falsification_probe');
    requireCondition(['available', 'unavailable'].includes(statement.falsification_probe.status),
      'unsupported falsification status');
    if (statement.falsification_probe.status === 'available') {
      requireCondition(['observation', 'test'].includes(statement.falsification_probe.kind),
        'available falsification kind must be observation or test');
      assertString(statement.falsification_probe.description, 'falsification_probe.description');
      requireCondition(statement.falsification_probe.unavailable_reason === null,
        'available falsification probe cannot have unavailable_reason');
    } else {
      requireCondition(statement.falsification_probe.kind === 'none', 'unavailable falsification kind must be none');
      requireCondition(statement.falsification_probe.description === null,
        'unavailable falsification description must be null');
      assertString(statement.falsification_probe.unavailable_reason, 'falsification_probe.unavailable_reason');
    }
  }

  requireCondition(Array.isArray(evidenceItems), 'supporting_evidence must be an array');
  const evidenceIds = new Set();
  const derivedRefs = Object.fromEntries([...statementIds].map(id => [id, new Set()]));
  for (const evidence of evidenceItems) {
    assertExactKeys(evidence, EVIDENCE_KEYS, 'evidence');
    assertString(evidence.evidence_id, 'evidence.evidence_id', /^ev-[a-z0-9][a-z0-9-]{1,63}$/);
    requireCondition(!evidenceIds.has(evidence.evidence_id), `duplicate evidence id: ${evidence.evidence_id}`);
    evidenceIds.add(evidence.evidence_id);
    requireCondition(evidence.data_class === 'evidence-bundle', 'evidence.data_class mismatch');
    assertString(evidence.summary, 'evidence.summary');
    assertString(evidence.provenance_ref, 'evidence.provenance_ref');
    requireCondition(EVIDENCE_QUALITY.includes(evidence.quality), `unsupported evidence quality: ${evidence.quality}`);
    parseTime(evidence.observed_at, 'evidence.observed_at');
    assertStringArray(evidence.supports_statement_ids, 'evidence.supports_statement_ids');
    assertStringArray(evidence.contradicts_statement_ids, 'evidence.contradicts_statement_ids');
    for (const statementId of [...evidence.supports_statement_ids, ...evidence.contradicts_statement_ids]) {
      requireCondition(statementIds.has(statementId), `evidence references unknown statement: ${statementId}`);
      derivedRefs[statementId].add(evidence.evidence_id);
    }
    const overlap = evidence.supports_statement_ids.filter(id => evidence.contradicts_statement_ids.includes(id));
    requireCondition(overlap.length === 0 || evidence.quality === 'conflicting',
      `support/contradiction overlap requires conflicting evidence quality: ${evidence.evidence_id}`);
  }

  for (const statement of claim.material_statements) {
    statement.evidence_refs.forEach(ref => requireCondition(evidenceIds.has(ref),
      `statement references unknown evidence: ${ref}`));
    const expected = [...derivedRefs[statement.statement_id]].sort();
    const actual = [...statement.evidence_refs].sort();
    requireCondition(JSON.stringify(expected) === JSON.stringify(actual),
      `statement/evidence lineage mismatch: ${statement.statement_id}`);
  }

  assertExactKeys(decision, DECISION_KEYS, 'decision_constraints');
  requireCondition(decision.data_class === 'decision-context', 'decision_constraints.data_class mismatch');
  for (const key of ['objectives', 'constraints', 'unacceptable_outcomes', 'success_conditions']) {
    assertStringArray(decision[key], `decision_constraints.${key}`, 1);
  }
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, 'input protocol mismatch');
  requireCondition(input.version === VERSION, 'input version mismatch');
  requireCondition(input.artifact_type === INPUT_TYPE, 'input artifact_type mismatch');
  assertString(input.intake_id, 'input.intake_id',
    /^urn:uu-aap:marketer-pessimist:real-review-intake:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(input.contract_binding, CONTRACT_KEYS, 'contract_binding');
  requireCondition(input.contract_binding.contract_id === CONTRACT_ID, 'Product Contract id mismatch');
  requireCondition(input.contract_binding.product_id === PRODUCT_ID, 'product id mismatch');
  requireCondition(input.contract_binding.product_version === PRODUCT_VERSION, 'product version mismatch');
  requireCondition(input.contract_binding.content_hash === CONTRACT_HASH, 'Product Contract hash mismatch');

  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'frontier repository mismatch');
  assertString(input.evaluation_frontier.revision, 'evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  parseTime(input.evaluation_frontier.observed_at, 'evaluation_frontier.observed_at');

  assertExactKeys(input.source_context, SOURCE_KEYS, 'source_context');
  requireCondition(SOURCE_MODES.includes(input.source_context.mode), 'unsupported source mode');
  assertString(input.source_context.source_reference, 'source_context.source_reference');
  parseTime(input.source_context.source_observed_at, 'source_context.source_observed_at');
  assertString(input.source_context.classification_basis, 'source_context.classification_basis');
  for (const key of [
    'human_classification_supplied', 'personal_data_present', 'sensitive_personal_data_present',
    'identity_resolution_required', 'protected_attribute_data_present',
    'psychological_vulnerability_data_present', 'deletion_supported', 'correction_supported'
  ]) assertBoolean(input.source_context[key], `source_context.${key}`);

  requireCondition(input.source_context.human_classification_supplied === true,
    'human-supplied data classification is required');
  requireCondition(input.source_context.personal_data_present === false,
    'real review intake v0.1 rejects personal data');
  requireCondition(input.source_context.sensitive_personal_data_present === false,
    'real review intake v0.1 rejects sensitive personal data');
  requireCondition(input.source_context.identity_resolution_required === false,
    'real review intake v0.1 rejects identity resolution');
  requireCondition(input.source_context.protected_attribute_data_present === false,
    'real review intake v0.1 rejects protected-attribute data');
  requireCondition(input.source_context.psychological_vulnerability_data_present === false,
    'real review intake v0.1 rejects psychological-vulnerability data');
  requireCondition(input.source_context.retention_mode === 'session',
    'real review intake v0.1 requires session retention');
  requireCondition(input.source_context.deletion_supported === true,
    'real review intake v0.1 requires deletion support');
  requireCondition(input.source_context.correction_supported === true,
    'real review intake v0.1 requires correction support');

  if (input.source_context.mode === 'synthetic_conformance') {
    requireCondition(input.source_context.source_reference.startsWith('urn:synthetic:'),
      'synthetic_conformance source_reference must use urn:synthetic');
  } else {
    requireCondition(!input.source_context.source_reference.startsWith('urn:synthetic:'),
      'real_non_personal source_reference cannot use urn:synthetic');
  }

  validateClaimAndEvidence(input);

  assertExactKeys(input.controls, CONTROL_KEYS, 'controls');
  requireCondition(input.controls.real_non_personal_input_available === true,
    'real_non_personal_input_available must be true');
  requireCondition(input.controls.local_only === true, 'local_only must be true');
  requireCondition(input.controls.read_only === true, 'read_only must be true');
  for (const key of CONTROL_KEYS.filter(key =>
    !['real_non_personal_input_available', 'local_only', 'read_only'].includes(key))) {
    requireCondition(input.controls[key] === false, `${key} must remain false`);
  }

  requireCondition(input.content_hash === computeContentHash(input), 'input content hash mismatch');
  return input;
}

function deriveCandidate(input) {
  validateInput(input);
  const claims = {};
  TRUE_CLAIMS.forEach(key => { claims[key] = true; });
  FALSE_CLAIMS.forEach(key => { claims[key] = false; });

  const candidate = {
    protocol: PROTOCOL,
    version: VERSION,
    artifact_type: CANDIDATE_TYPE,
    candidate_id: `urn:uu-aap:marketer-pessimist:real-review-candidate:${input.content_hash.slice(-24)}`,
    state: input.source_context.mode === 'real_non_personal'
      ? 'REAL_REVIEW_CANDIDATE_READY'
      : 'SYNTHETIC_CONFORMANCE_CANDIDATE_READY',
    contract_binding: clone(input.contract_binding),
    evaluation_frontier: clone(input.evaluation_frontier),
    source_binding: {
      intake_id: input.intake_id,
      intake_hash: input.content_hash,
      mode: input.source_context.mode,
      source_reference: input.source_context.source_reference,
      source_observed_at: input.source_context.source_observed_at,
      classification_basis_hash: hashText(input.source_context.classification_basis)
    },
    bounded_case: {
      claim_package: clone(input.claim_package),
      supporting_evidence: clone(input.supporting_evidence),
      decision_constraints: clone(input.decision_constraints)
    },
    safety_boundary: {
      human_classification_supplied: true,
      personal_data_present: false,
      sensitive_personal_data_present: false,
      identity_resolution_required: false,
      protected_attribute_data_present: false,
      psychological_vulnerability_data_present: false,
      local_only: true,
      read_only: true,
      network_access_required: false,
      provider_invocation_available: false,
      publication_available: false,
      campaign_send_available: false,
      spend_available: false,
      personal_targeting_available: false,
      external_system_mutation_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      execution_available: false,
      external_effect_available: false
    },
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(candidate);
  return validateCandidate(candidate);
}

function validateCandidate(candidate) {
  assertExactKeys(candidate, CANDIDATE_KEYS, 'candidate');
  requireCondition(candidate.protocol === PROTOCOL, 'candidate protocol mismatch');
  requireCondition(candidate.version === VERSION, 'candidate version mismatch');
  requireCondition(candidate.artifact_type === CANDIDATE_TYPE, 'candidate artifact_type mismatch');
  assertString(candidate.candidate_id, 'candidate.candidate_id',
    /^urn:uu-aap:marketer-pessimist:real-review-candidate:[0-9a-f]{24}$/);
  requireCondition(['SYNTHETIC_CONFORMANCE_CANDIDATE_READY', 'REAL_REVIEW_CANDIDATE_READY'].includes(candidate.state),
    'candidate state unsupported');

  assertExactKeys(candidate.contract_binding, CONTRACT_KEYS, 'candidate.contract_binding');
  requireCondition(candidate.contract_binding.contract_id === CONTRACT_ID, 'candidate contract id mismatch');
  requireCondition(candidate.contract_binding.product_id === PRODUCT_ID, 'candidate product id mismatch');
  requireCondition(candidate.contract_binding.product_version === PRODUCT_VERSION, 'candidate product version mismatch');
  requireCondition(candidate.contract_binding.content_hash === CONTRACT_HASH, 'candidate contract hash mismatch');

  assertExactKeys(candidate.evaluation_frontier, FRONTIER_KEYS, 'candidate.evaluation_frontier');
  requireCondition(candidate.evaluation_frontier.repository === 'Matawaka/uu-aap', 'candidate frontier repository mismatch');
  assertString(candidate.evaluation_frontier.revision, 'candidate.evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  parseTime(candidate.evaluation_frontier.observed_at, 'candidate.evaluation_frontier.observed_at');

  assertExactKeys(candidate.source_binding, SOURCE_BINDING_KEYS, 'candidate.source_binding');
  assertString(candidate.source_binding.intake_id, 'candidate.source_binding.intake_id');
  assertString(candidate.source_binding.intake_hash, 'candidate.source_binding.intake_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(SOURCE_MODES.includes(candidate.source_binding.mode), 'candidate source mode unsupported');
  assertString(candidate.source_binding.source_reference, 'candidate.source_binding.source_reference');
  parseTime(candidate.source_binding.source_observed_at, 'candidate.source_binding.source_observed_at');
  assertString(candidate.source_binding.classification_basis_hash,
    'candidate.source_binding.classification_basis_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(
    candidate.state === (candidate.source_binding.mode === 'real_non_personal'
      ? 'REAL_REVIEW_CANDIDATE_READY'
      : 'SYNTHETIC_CONFORMANCE_CANDIDATE_READY'),
    'candidate state/source mode mismatch'
  );

  assertExactKeys(candidate.bounded_case, BOUNDED_CASE_KEYS, 'candidate.bounded_case');
  validateClaimAndEvidence(candidate.bounded_case);

  assertExactKeys(candidate.safety_boundary, SAFETY_KEYS, 'candidate.safety_boundary');
  requireCondition(candidate.safety_boundary.human_classification_supplied === true,
    'candidate human classification must remain recorded');
  requireCondition(candidate.safety_boundary.local_only === true && candidate.safety_boundary.read_only === true,
    'candidate must remain local and read-only');
  for (const key of SAFETY_KEYS.filter(key =>
    !['human_classification_supplied', 'local_only', 'read_only'].includes(key))) {
    requireCondition(candidate.safety_boundary[key] === false,
      `candidate safety boundary ${key} must remain false`);
  }

  assertExactKeys(candidate.claims, RECEIPT_CLAIM_KEYS, 'candidate.claims');
  TRUE_CLAIMS.forEach(key => requireCondition(candidate.claims[key] === true, `required claim ${key} must be true`));
  FALSE_CLAIMS.forEach(key => requireCondition(candidate.claims[key] === false, `prohibited claim ${key} must remain false`));
  assertStringArray(candidate.non_effects, 'candidate.non_effects', REQUIRED_NON_EFFECTS.length);
  requireCondition(
    candidate.non_effects.length === REQUIRED_NON_EFFECTS.length &&
    JSON.stringify([...candidate.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()),
    'candidate non_effect set mismatch'
  );
  requireCondition(candidate.next_safe_action === NEXT_SAFE_ACTION, 'candidate next_safe_action mismatch');
  requireCondition(candidate.content_hash === computeContentHash(candidate), 'candidate content hash mismatch');
  return candidate;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketerPessimistRealReviewIntakeValidationReceipt',
    intake_id: input.intake_id,
    intake_hash: input.content_hash,
    source_mode: input.source_context.mode,
    valid: true,
    local_only: true,
    real_review_started: false,
    pilot_permit_created: false,
    action_permit_created: false,
    execution_available: false,
    external_effect_available: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new MarketerPessimistRealReviewIntakeError(`invalid JSON: ${error.message}`);
  }
}

function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function usage() {
  return [
    'Маркетолог Пессимиста Real Review Intake v0.1',
    '',
    'Usage:',
    '  node products/marketer-pessimist/v0.1/real-review-intake/v0.1/real-review-intake.js validate <file|->',
    '  node products/marketer-pessimist/v0.1/real-review-intake/v0.1/real-review-intake.js inspect <file|->',
    '  node products/marketer-pessimist/v0.1/real-review-intake/v0.1/real-review-intake.js help',
    '',
    'This intake is local, read-only and no-effect. It creates a review candidate only; it never creates a stress-test receipt, PilotPermit, ActionPermit or execution.'
  ].join('\n');
}

function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  requireCondition(['validate', 'inspect'].includes(command),
    `unsupported command: ${command}; allowed commands are validate, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or - for stdin`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : deriveCandidate(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}

function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: 'MARKETER_PESSIMIST_REAL_REVIEW_INTAKE_REJECTED', message })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  MarketerPessimistRealReviewIntakeError,
  PROTOCOL,
  VERSION,
  INPUT_TYPE,
  CANDIDATE_TYPE,
  CONTRACT_ID,
  PRODUCT_ID,
  PRODUCT_VERSION,
  CONTRACT_HASH,
  NEXT_SAFE_ACTION,
  SOURCE_MODES,
  CLASSIFICATIONS,
  EVIDENCE_QUALITY,
  INPUT_KEYS,
  SOURCE_KEYS,
  CONTROL_KEYS,
  CANDIDATE_KEYS,
  TRUE_CLAIMS,
  FALSE_CLAIMS,
  RECEIPT_CLAIM_KEYS,
  REQUIRED_NON_EFFECTS,
  canonicalize,
  computeContentHash,
  rehash,
  hashText,
  validateInput,
  deriveCandidate,
  validateCandidate,
  validationReceipt,
  parseText,
  readInput,
  usage,
  runCli
};