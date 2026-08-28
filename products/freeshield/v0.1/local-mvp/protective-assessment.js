'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'FREESHIELD-LOCAL-MVP';
const VERSION = '0.1';
const INPUT_TYPE = 'FreeShieldProtectiveAssessmentInput';
const RECEIPT_TYPE = 'FreeShieldProtectiveAssessmentReceipt';
const CONTRACT_ID = 'freeshield-protective-contract';
const PRODUCT_ID = 'freeshield';
const PRODUCT_VERSION = '0.1';
const CONTRACT_HASH = 'sha256:355ad149846745c6009dcf22a1ce059c47460bcdc49a9a9009620372282c8295';
const NEXT_SAFE_ACTION = 'HUMAN_PROTECTIVE_DISPOSITION_REQUIRED';

const INPUT_KEYS = [
  'protocol', 'version', 'artifact_type', 'input_id', 'contract_binding',
  'consumer_binding', 'evaluation_frontier', 'candidate', 'authority',
  'evidence', 'constraints', 'frontier_observation', 'controls', 'content_hash'
];
const CONTRACT_KEYS = ['contract_id', 'product_id', 'product_version', 'content_hash'];
const CONSUMER_KEYS = ['product_id', 'product_version', 'product_contract_hash', 'authority_transfer', 'responsibility_transfer'];
const FRONTIER_KEYS = ['repository', 'revision', 'observed_at'];
const CANDIDATE_KEYS = [
  'candidate_id', 'candidate_kind', 'operation_class', 'target_ref', 'payload_digest',
  'intended_outcome', 'declared_scope', 'analysis_only', 'external_effect_requested',
  'evidence_refs'
];
const AUTHORITY_KEYS = [
  'request_owner_role_id', 'authority_scope', 'authority_evidence_refs',
  'authority_lineage_complete', 'action_permit_ref'
];
const EVIDENCE_KEYS = [
  'id', 'data_class', 'quality', 'source_ref', 'provenance_ref', 'digest',
  'observed_at', 'applicable_scope'
];
const CONSTRAINT_KEYS = [
  'id', 'source_ref', 'scope', 'statement', 'disposition', 'evidence_refs'
];
const OBSERVATION_KEYS = ['state_id', 'observer_role_id', 'observed_at', 'quality', 'digest'];
const CONTROL_KEYS = [
  'local_only', 'read_only', 'network_access_required', 'filesystem_write_required',
  'provider_invocation_available', 'actuator_control_available', 'authority_creation_available',
  'responsibility_acceptance_available', 'action_permit_creation_available',
  'execution_available', 'external_effect_available', 'automatic_retry'
];

const RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'receipt_id', 'contract_binding',
  'consumer_binding', 'evaluation_frontier', 'source_input', 'state',
  'candidate_summary', 'authority_findings', 'evidence_findings', 'scope_findings',
  'risk_hypotheses', 'protective_outcome', 'reconciliation_candidate',
  'claims', 'non_effects', 'next_safe_action', 'content_hash'
];
const SOURCE_INPUT_KEYS = ['input_id', 'input_hash'];
const CANDIDATE_SUMMARY_KEYS = [
  'candidate_id', 'candidate_kind', 'operation_class', 'analysis_only',
  'external_effect_requested', 'payload_digest'
];
const AUTHORITY_FINDING_KEYS = [
  'authority_lineage_complete', 'scope_covered', 'action_permit_present',
  'authority_created', 'authority_expanded'
];
const EVIDENCE_FINDING_KEYS = [
  'verified_ids', 'unverified_ids', 'stale_ids', 'conflicting_ids',
  'frontier_quality', 'missing_required_evidence'
];
const SCOPE_FINDING_KEYS = ['declared_scope', 'uncovered_scope', 'scope_bound'];
const HYPOTHESIS_KEYS = ['hypothesis_id', 'code', 'status', 'description', 'basis_refs'];
const OUTCOME_KEYS = ['outcome', 'status', 'reason_codes', 'human_disposition_required'];
const RECONCILIATION_KEYS = ['required', 'owner_role_id', 'reason_codes'];

const OUTCOMES = new Set(['ALLOW_ANALYSIS', 'NARROW_SCOPE', 'REQUIRE_EVIDENCE', 'HUMAN_REVIEW', 'BLOCK_EFFECT']);
const STATES = new Set(['UNKNOWN', 'CONFLICT', 'INSUFFICIENT_EVIDENCE', 'SCOPE_UNBOUND', 'ASSESSMENT_READY']);
const DATA_CLASSES = new Set(['candidate-envelope', 'contract-authority-bundle', 'constraint-bundle', 'frontier-state']);
const EVIDENCE_QUALITIES = new Set(['verified', 'unverified', 'stale', 'conflicting']);
const CONSTRAINT_DISPOSITIONS = new Set(['none', 'narrow_scope', 'require_evidence', 'human_review', 'block_effect']);

const TRUE_CLAIMS = Object.freeze([
  'protective_assessment_completed',
  'exact_contract_bound',
  'consumer_binding_preserved',
  'evidence_lineage_preserved',
  'uncertainty_preserved',
  'human_disposition_required'
]);
const FALSE_CLAIMS = Object.freeze([
  'truth_certified', 'harm_proven', 'intent_inferred', 'liability_established',
  'global_prohibition_created', 'sanction_created', 'blacklist_entry_created',
  'account_blocked', 'candidate_rejected', 'employment_decision_made',
  'human_disposition_recorded', 'actuator_blocked', 'external_system_mutated',
  'authority_created', 'authority_expanded', 'responsibility_accepted',
  'action_permit_created', 'execution_admitted', 'provider_invoked',
  'network_delivery_performed', 'external_effect_performed',
  'stable_core_promotion_established', 'successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);
const REQUIRED_NON_EFFECTS = Object.freeze([
  'Protective Review != Authority',
  'Protective Assessment != ActionPermit',
  'Risk Hypothesis != Proof of Harm',
  'BLOCK_EFFECT != Global Prohibition',
  'Scope Narrowing != Product Ownership',
  'Human Review Requirement != Negative Judgment',
  'Missing Evidence != Evidence of Safety or Harm',
  'Protective Outcome != Legal Judgment',
  'Protective Assessment != Sanction or Blacklist',
  'Available Evidence != Permission to Inspect',
  'ALLOW_ANALYSIS != Execution Admission',
  'Accepted Protective Assessment != Execution Authority'
]);

class FreeShieldLocalMvpError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FreeShieldLocalMvpError';
  }
}

function fail(message) { throw new FreeShieldLocalMvpError(message); }
function requireCondition(condition, message) { if (!condition) fail(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function assertObject(value, label) { requireCondition(isObject(value), `${label} must be an object`); }
function assertExactKeys(value, keys, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch`);
}
function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}
function assertBoolean(value, label) { requireCondition(typeof value === 'boolean', `${label} must be boolean`); }
function assertStringArray(value, label, { minItems = 0 } = {}) {
  requireCondition(Array.isArray(value) && value.length >= minItems, `${label} must be an array with at least ${minItems} item(s)`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${label}[${index}]`);
    requireCondition(!seen.has(item), `${label} must contain unique items`);
    seen.add(item);
  });
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}
function computeContentHash(value) {
  const projected = clone(value);
  projected.content_hash = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}
function rehash(value) { value.content_hash = computeContentHash(value); return value; }
function deterministicId(prefix, value) {
  return `${prefix}${crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex').slice(0, 24)}`;
}
function assertExactStringSet(value, expected, label) {
  assertStringArray(value, label, { minItems: expected.length });
  requireCondition(value.length === expected.length, `${label} size mismatch`);
  const left = [...value].sort();
  const right = [...expected].sort();
  requireCondition(JSON.stringify(left) === JSON.stringify(right), `${label} set mismatch`);
}

function validateContractBinding(binding) {
  assertExactKeys(binding, CONTRACT_KEYS, 'contract_binding');
  requireCondition(binding.contract_id === CONTRACT_ID, 'FREESHIELD contract id mismatch');
  requireCondition(binding.product_id === PRODUCT_ID, 'FREESHIELD product id mismatch');
  requireCondition(binding.product_version === PRODUCT_VERSION, 'FREESHIELD product version mismatch');
  requireCondition(binding.content_hash === CONTRACT_HASH, 'FREESHIELD contract hash mismatch');
}

function validateConsumerBinding(binding) {
  assertExactKeys(binding, CONSUMER_KEYS, 'consumer_binding');
  assertString(binding.product_id, 'consumer_binding.product_id', /^[a-z][a-z0-9-]{1,63}$/);
  assertString(binding.product_version, 'consumer_binding.product_version');
  assertString(binding.product_contract_hash, 'consumer_binding.product_contract_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(binding.product_id !== PRODUCT_ID, 'FREESHIELD cannot consume itself in this MVP');
  requireCondition(binding.authority_transfer === false, 'consumer authority transfer must remain false');
  requireCondition(binding.responsibility_transfer === false, 'consumer responsibility transfer must remain false');
}

function validateControls(controls) {
  assertExactKeys(controls, CONTROL_KEYS, 'controls');
  for (const key of CONTROL_KEYS) assertBoolean(controls[key], `controls.${key}`);
  requireCondition(controls.local_only === true, 'controls.local_only must remain true');
  requireCondition(controls.read_only === true, 'controls.read_only must remain true');
  for (const key of CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) {
    requireCondition(controls[key] === false, `controls.${key} must remain false`);
  }
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === INPUT_TYPE, `artifact_type must be ${INPUT_TYPE}`);
  assertString(input.input_id, 'input_id', /^urn:uu-aap:freeshield:protective-input:[a-z0-9][a-z0-9:-]{2,191}$/);
  validateContractBinding(input.contract_binding);
  validateConsumerBinding(input.consumer_binding);

  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'evaluation frontier repository mismatch');
  assertString(input.evaluation_frontier.revision, 'evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  assertString(input.evaluation_frontier.observed_at, 'evaluation_frontier.observed_at');

  assertExactKeys(input.candidate, CANDIDATE_KEYS, 'candidate');
  assertString(input.candidate.candidate_id, 'candidate.candidate_id');
  assertString(input.candidate.candidate_kind, 'candidate.candidate_kind');
  assertString(input.candidate.operation_class, 'candidate.operation_class');
  assertString(input.candidate.target_ref, 'candidate.target_ref');
  assertString(input.candidate.payload_digest, 'candidate.payload_digest', /^sha256:[0-9a-f]{64}$/);
  assertString(input.candidate.intended_outcome, 'candidate.intended_outcome');
  assertStringArray(input.candidate.declared_scope, 'candidate.declared_scope', { minItems: 1 });
  assertBoolean(input.candidate.analysis_only, 'candidate.analysis_only');
  assertBoolean(input.candidate.external_effect_requested, 'candidate.external_effect_requested');
  assertStringArray(input.candidate.evidence_refs, 'candidate.evidence_refs', { minItems: 1 });
  requireCondition(!(input.candidate.analysis_only && input.candidate.external_effect_requested), 'analysis-only candidate cannot request external effect');

  assertExactKeys(input.authority, AUTHORITY_KEYS, 'authority');
  assertString(input.authority.request_owner_role_id, 'authority.request_owner_role_id');
  assertStringArray(input.authority.authority_scope, 'authority.authority_scope', { minItems: 1 });
  assertStringArray(input.authority.authority_evidence_refs, 'authority.authority_evidence_refs', { minItems: 1 });
  assertBoolean(input.authority.authority_lineage_complete, 'authority.authority_lineage_complete');
  requireCondition(input.authority.action_permit_ref === null, 'local MVP does not accept ActionPermit carriage');

  requireCondition(Array.isArray(input.evidence) && input.evidence.length >= 4, 'at least four exact evidence items required');
  const evidenceIds = new Set();
  for (const [index, item] of input.evidence.entries()) {
    assertExactKeys(item, EVIDENCE_KEYS, `evidence[${index}]`);
    assertString(item.id, `evidence[${index}].id`);
    requireCondition(!evidenceIds.has(item.id), `duplicate evidence id: ${item.id}`);
    evidenceIds.add(item.id);
    requireCondition(DATA_CLASSES.has(item.data_class), `unsupported FREESHIELD data class: ${item.data_class}`);
    requireCondition(EVIDENCE_QUALITIES.has(item.quality), `unsupported evidence quality: ${item.quality}`);
    assertString(item.source_ref, `evidence[${index}].source_ref`);
    assertString(item.provenance_ref, `evidence[${index}].provenance_ref`);
    assertString(item.digest, `evidence[${index}].digest`, /^sha256:[0-9a-f]{64}$/);
    assertString(item.observed_at, `evidence[${index}].observed_at`);
    assertStringArray(item.applicable_scope, `evidence[${index}].applicable_scope`, { minItems: 1 });
  }
  for (const ref of [...input.candidate.evidence_refs, ...input.authority.authority_evidence_refs]) {
    requireCondition(evidenceIds.has(ref), `unknown evidence ref: ${ref}`);
  }

  requireCondition(Array.isArray(input.constraints) && input.constraints.length >= 1, 'at least one constraint required');
  const constraintIds = new Set();
  for (const [index, item] of input.constraints.entries()) {
    assertExactKeys(item, CONSTRAINT_KEYS, `constraints[${index}]`);
    assertString(item.id, `constraints[${index}].id`);
    requireCondition(!constraintIds.has(item.id), `duplicate constraint id: ${item.id}`);
    constraintIds.add(item.id);
    assertString(item.source_ref, `constraints[${index}].source_ref`);
    assertStringArray(item.scope, `constraints[${index}].scope`, { minItems: 1 });
    assertString(item.statement, `constraints[${index}].statement`);
    requireCondition(CONSTRAINT_DISPOSITIONS.has(item.disposition), `unsupported constraint disposition: ${item.disposition}`);
    assertStringArray(item.evidence_refs, `constraints[${index}].evidence_refs`, { minItems: 1 });
    for (const ref of item.evidence_refs) requireCondition(evidenceIds.has(ref), `constraint unknown evidence ref: ${ref}`);
  }

  assertExactKeys(input.frontier_observation, OBSERVATION_KEYS, 'frontier_observation');
  assertString(input.frontier_observation.state_id, 'frontier_observation.state_id');
  assertString(input.frontier_observation.observer_role_id, 'frontier_observation.observer_role_id');
  assertString(input.frontier_observation.observed_at, 'frontier_observation.observed_at');
  requireCondition(EVIDENCE_QUALITIES.has(input.frontier_observation.quality), 'unsupported frontier observation quality');
  assertString(input.frontier_observation.digest, 'frontier_observation.digest', /^sha256:[0-9a-f]{64}$/);

  validateControls(input.controls);
  requireCondition(input.content_hash === computeContentHash(input), 'input content hash mismatch');
  return input;
}

function evidenceByQuality(input) {
  const result = { verified: [], unverified: [], stale: [], conflicting: [] };
  for (const item of input.evidence) result[item.quality].push(item.id);
  for (const key of Object.keys(result)) result[key].sort();
  return result;
}

function deriveAssessment(input) {
  validateInput(input);
  const quality = evidenceByQuality(input);
  const uncoveredScope = input.candidate.declared_scope.filter(scope => !input.authority.authority_scope.includes(scope)).sort();
  const constraintDisposition = new Set(input.constraints.map(item => item.disposition));
  const reasonCodes = [];
  const hypotheses = [];

  if (input.candidate.external_effect_requested) {
    reasonCodes.push('EXTERNAL_EFFECT_NOT_ADMITTED_BY_LOCAL_MVP');
    hypotheses.push({
      hypothesis_id: 'risk-external-effect-boundary',
      code: 'EXTERNAL_EFFECT_BOUNDARY',
      status: 'bounded_candidate',
      description: 'The submitted candidate requests an external effect that this local protective runtime cannot admit or execute.',
      basis_refs: [...input.candidate.evidence_refs].sort()
    });
  }
  if (!input.authority.authority_lineage_complete) {
    reasonCodes.push('AUTHORITY_LINEAGE_INCOMPLETE');
  }
  if (uncoveredScope.length > 0) {
    reasonCodes.push('SCOPE_EXCEEDS_DECLARED_AUTHORITY');
    hypotheses.push({
      hypothesis_id: 'risk-scope-mismatch',
      code: 'SCOPE_MISMATCH',
      status: 'bounded_candidate',
      description: 'At least one declared candidate scope element is outside the supplied authority scope.',
      basis_refs: [...input.authority.authority_evidence_refs].sort()
    });
  }
  if (quality.conflicting.length > 0 || input.frontier_observation.quality === 'conflicting') {
    reasonCodes.push('CONFLICTING_EVIDENCE_OR_FRONTIER');
  }
  if (quality.stale.length > 0 || quality.unverified.length > 0 || input.frontier_observation.quality === 'stale' || input.frontier_observation.quality === 'unverified') {
    reasonCodes.push('EVIDENCE_REFRESH_OR_VERIFICATION_REQUIRED');
  }
  if (constraintDisposition.has('block_effect')) reasonCodes.push('BINDING_CONSTRAINT_BLOCK_EFFECT');
  if (constraintDisposition.has('human_review')) reasonCodes.push('BINDING_CONSTRAINT_HUMAN_REVIEW');
  if (constraintDisposition.has('require_evidence')) reasonCodes.push('BINDING_CONSTRAINT_REQUIRE_EVIDENCE');
  if (constraintDisposition.has('narrow_scope')) reasonCodes.push('BINDING_CONSTRAINT_NARROW_SCOPE');

  let outcome = 'ALLOW_ANALYSIS';
  let state = 'ASSESSMENT_READY';
  if (input.candidate.external_effect_requested || constraintDisposition.has('block_effect')) {
    outcome = 'BLOCK_EFFECT';
  } else if (quality.conflicting.length > 0 || input.frontier_observation.quality === 'conflicting' || constraintDisposition.has('human_review')) {
    outcome = 'HUMAN_REVIEW';
    state = 'CONFLICT';
  } else if (!input.authority.authority_lineage_complete || quality.stale.length > 0 || quality.unverified.length > 0 || input.frontier_observation.quality === 'stale' || input.frontier_observation.quality === 'unverified' || constraintDisposition.has('require_evidence')) {
    outcome = 'REQUIRE_EVIDENCE';
    state = 'INSUFFICIENT_EVIDENCE';
  } else if (uncoveredScope.length > 0 || constraintDisposition.has('narrow_scope')) {
    outcome = 'NARROW_SCOPE';
    state = 'SCOPE_UNBOUND';
  }

  if (reasonCodes.length === 0) reasonCodes.push('EXACT_LOCAL_ANALYSIS_BOUNDARY_SATISFIED');
  reasonCodes.sort();
  hypotheses.sort((a, b) => a.hypothesis_id.localeCompare(b.hypothesis_id));

  const claims = {};
  for (const key of TRUE_CLAIMS) claims[key] = true;
  for (const key of FALSE_CLAIMS) claims[key] = false;

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: deterministicId('urn:uu-aap:freeshield:protective-receipt:', { input_id: input.input_id, input_hash: input.content_hash }),
    contract_binding: clone(input.contract_binding),
    consumer_binding: clone(input.consumer_binding),
    evaluation_frontier: clone(input.evaluation_frontier),
    source_input: { input_id: input.input_id, input_hash: input.content_hash },
    state,
    candidate_summary: {
      candidate_id: input.candidate.candidate_id,
      candidate_kind: input.candidate.candidate_kind,
      operation_class: input.candidate.operation_class,
      analysis_only: input.candidate.analysis_only,
      external_effect_requested: input.candidate.external_effect_requested,
      payload_digest: input.candidate.payload_digest
    },
    authority_findings: {
      authority_lineage_complete: input.authority.authority_lineage_complete,
      scope_covered: uncoveredScope.length === 0,
      action_permit_present: false,
      authority_created: false,
      authority_expanded: false
    },
    evidence_findings: {
      verified_ids: quality.verified,
      unverified_ids: quality.unverified,
      stale_ids: quality.stale,
      conflicting_ids: quality.conflicting,
      frontier_quality: input.frontier_observation.quality,
      missing_required_evidence: !input.authority.authority_lineage_complete
    },
    scope_findings: {
      declared_scope: [...input.candidate.declared_scope].sort(),
      uncovered_scope: uncoveredScope,
      scope_bound: uncoveredScope.length === 0
    },
    risk_hypotheses: hypotheses,
    protective_outcome: {
      outcome,
      status: 'candidate',
      reason_codes: reasonCodes,
      human_disposition_required: true
    },
    reconciliation_candidate: {
      required: ['CONFLICT', 'INSUFFICIENT_EVIDENCE', 'SCOPE_UNBOUND'].includes(state),
      owner_role_id: 'human-protection-owner',
      reason_codes: ['CONFLICT', 'INSUFFICIENT_EVIDENCE', 'SCOPE_UNBOUND'].includes(state) ? reasonCodes : []
    },
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
  assertString(receipt.receipt_id, 'receipt.receipt_id', /^urn:uu-aap:freeshield:protective-receipt:[0-9a-f]{24}$/);
  validateContractBinding(receipt.contract_binding);
  validateConsumerBinding(receipt.consumer_binding);
  assertExactKeys(receipt.evaluation_frontier, FRONTIER_KEYS, 'receipt.evaluation_frontier');
  requireCondition(receipt.evaluation_frontier.repository === 'Matawaka/uu-aap', 'receipt frontier repository mismatch');
  assertString(receipt.evaluation_frontier.revision, 'receipt.evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  assertString(receipt.evaluation_frontier.observed_at, 'receipt.evaluation_frontier.observed_at');
  assertExactKeys(receipt.source_input, SOURCE_INPUT_KEYS, 'receipt.source_input');
  assertString(receipt.source_input.input_id, 'receipt.source_input.input_id');
  assertString(receipt.source_input.input_hash, 'receipt.source_input.input_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(STATES.has(receipt.state), 'receipt machine state invalid');

  assertExactKeys(receipt.candidate_summary, CANDIDATE_SUMMARY_KEYS, 'receipt.candidate_summary');
  assertString(receipt.candidate_summary.candidate_id, 'receipt.candidate_summary.candidate_id');
  assertString(receipt.candidate_summary.candidate_kind, 'receipt.candidate_summary.candidate_kind');
  assertString(receipt.candidate_summary.operation_class, 'receipt.candidate_summary.operation_class');
  assertBoolean(receipt.candidate_summary.analysis_only, 'receipt.candidate_summary.analysis_only');
  assertBoolean(receipt.candidate_summary.external_effect_requested, 'receipt.candidate_summary.external_effect_requested');
  assertString(receipt.candidate_summary.payload_digest, 'receipt.candidate_summary.payload_digest', /^sha256:[0-9a-f]{64}$/);

  assertExactKeys(receipt.authority_findings, AUTHORITY_FINDING_KEYS, 'receipt.authority_findings');
  for (const key of AUTHORITY_FINDING_KEYS) assertBoolean(receipt.authority_findings[key], `receipt.authority_findings.${key}`);
  requireCondition(receipt.authority_findings.action_permit_present === false, 'receipt cannot claim ActionPermit presence');
  requireCondition(receipt.authority_findings.authority_created === false, 'receipt cannot create authority');
  requireCondition(receipt.authority_findings.authority_expanded === false, 'receipt cannot expand authority');

  assertExactKeys(receipt.evidence_findings, EVIDENCE_FINDING_KEYS, 'receipt.evidence_findings');
  for (const key of ['verified_ids', 'unverified_ids', 'stale_ids', 'conflicting_ids']) assertStringArray(receipt.evidence_findings[key], `receipt.evidence_findings.${key}`);
  requireCondition(EVIDENCE_QUALITIES.has(receipt.evidence_findings.frontier_quality), 'receipt frontier quality invalid');
  assertBoolean(receipt.evidence_findings.missing_required_evidence, 'receipt.evidence_findings.missing_required_evidence');

  assertExactKeys(receipt.scope_findings, SCOPE_FINDING_KEYS, 'receipt.scope_findings');
  assertStringArray(receipt.scope_findings.declared_scope, 'receipt.scope_findings.declared_scope', { minItems: 1 });
  assertStringArray(receipt.scope_findings.uncovered_scope, 'receipt.scope_findings.uncovered_scope');
  assertBoolean(receipt.scope_findings.scope_bound, 'receipt.scope_findings.scope_bound');

  requireCondition(Array.isArray(receipt.risk_hypotheses), 'receipt.risk_hypotheses must be array');
  for (const [index, item] of receipt.risk_hypotheses.entries()) {
    assertExactKeys(item, HYPOTHESIS_KEYS, `receipt.risk_hypotheses[${index}]`);
    assertString(item.hypothesis_id, `receipt.risk_hypotheses[${index}].hypothesis_id`);
    assertString(item.code, `receipt.risk_hypotheses[${index}].code`);
    requireCondition(item.status === 'bounded_candidate', 'risk hypothesis must remain candidate');
    assertString(item.description, `receipt.risk_hypotheses[${index}].description`);
    assertStringArray(item.basis_refs, `receipt.risk_hypotheses[${index}].basis_refs`, { minItems: 1 });
  }

  assertExactKeys(receipt.protective_outcome, OUTCOME_KEYS, 'receipt.protective_outcome');
  requireCondition(OUTCOMES.has(receipt.protective_outcome.outcome), 'protective outcome invalid');
  requireCondition(receipt.protective_outcome.status === 'candidate', 'protective outcome must remain candidate');
  assertStringArray(receipt.protective_outcome.reason_codes, 'receipt.protective_outcome.reason_codes', { minItems: 1 });
  requireCondition(receipt.protective_outcome.human_disposition_required === true, 'human disposition must remain required');

  assertExactKeys(receipt.reconciliation_candidate, RECONCILIATION_KEYS, 'receipt.reconciliation_candidate');
  assertBoolean(receipt.reconciliation_candidate.required, 'receipt.reconciliation_candidate.required');
  requireCondition(receipt.reconciliation_candidate.owner_role_id === 'human-protection-owner', 'reconciliation owner mismatch');
  assertStringArray(receipt.reconciliation_candidate.reason_codes, 'receipt.reconciliation_candidate.reason_codes');

  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  for (const key of TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required receipt claim ${key} must be true`);
  for (const key of FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited receipt claim ${key} must remain false`);
  assertExactStringSet(receipt.non_effects, REQUIRED_NON_EFFECTS, 'receipt.non_effects');
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'receipt next_safe_action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  const receipt = deriveAssessment(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'FreeShieldLocalMvpValidationReceipt',
    input_id: input.input_id,
    input_hash: input.content_hash,
    valid: true,
    protective_outcome: receipt.protective_outcome.outcome,
    human_disposition_required: true,
    actuator_blocked: false,
    action_permit_created: false,
    execution_admitted: false,
    external_effect_performed: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); }
  catch (error) { throw new FreeShieldLocalMvpError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function usage() {
  return [
    'FREESHIELD Local Protective Assessment MVP v0.1', '',
    'Usage:',
    '  node products/freeshield/v0.1/local-mvp/protective-assessment.js validate <file|->',
    '  node products/freeshield/v0.1/local-mvp/protective-assessment.js assess <file|->',
    '  node products/freeshield/v0.1/local-mvp/protective-assessment.js inspect <file|->',
    '  node products/freeshield/v0.1/local-mvp/protective-assessment.js help', '',
    'This runtime is deterministic local protective analysis only. It cannot block an actuator, create authority or execute an effect.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  requireCondition(['validate', 'assess', 'inspect'].includes(command), `unsupported command: ${command}; allowed commands are validate, assess, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : deriveAssessment(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: 'FREESHIELD_LOCAL_MVP_REJECTED', message: error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();

module.exports = {
  FreeShieldLocalMvpError,
  PROTOCOL, VERSION, INPUT_TYPE, RECEIPT_TYPE, CONTRACT_ID, PRODUCT_ID,
  PRODUCT_VERSION, CONTRACT_HASH, NEXT_SAFE_ACTION, INPUT_KEYS, CONTRACT_KEYS,
  CONSUMER_KEYS, FRONTIER_KEYS, CANDIDATE_KEYS, AUTHORITY_KEYS, EVIDENCE_KEYS,
  CONSTRAINT_KEYS, OBSERVATION_KEYS, CONTROL_KEYS, RECEIPT_KEYS, SOURCE_INPUT_KEYS,
  CANDIDATE_SUMMARY_KEYS, AUTHORITY_FINDING_KEYS, EVIDENCE_FINDING_KEYS,
  SCOPE_FINDING_KEYS, HYPOTHESIS_KEYS, OUTCOME_KEYS, RECONCILIATION_KEYS,
  OUTCOMES, STATES, DATA_CLASSES, EVIDENCE_QUALITIES, CONSTRAINT_DISPOSITIONS,
  TRUE_CLAIMS, FALSE_CLAIMS, CLAIM_KEYS, REQUIRED_NON_EFFECTS,
  canonicalize, computeContentHash, rehash, validateInput, deriveAssessment,
  validateReceipt, validationReceipt, parseText, readInput, usage, runCli
};
