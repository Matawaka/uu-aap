'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const FreeShield = require('../../../freeshield/v0.1/local-mvp/protective-assessment.js');
const FreeShieldBinding = require('../../../freeshield/v0.1/local-mvp/receipt-binding.js');

const PROTOCOL = 'HONEST-HIRING-LOCAL-MVP';
const VERSION = '0.1';
const INPUT_TYPE = 'HonestHiringComparisonInput';
const RESULT_TYPE = 'HonestHiringLocalComparisonResult';
const CONTRACT_ID = 'honest-hiring-product-contract';
const PRODUCT_ID = 'honest-hiring';
const PRODUCT_VERSION = '0.1';
const CONTRACT_HASH = 'sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae';
const NEXT_SAFE_ACTION = 'HUMAN_PROTECTIVE_DISPOSITION_REQUIRED';

const INPUT_KEYS = [
  'protocol', 'version', 'artifact_type', 'input_id', 'contract_binding',
  'evaluation_frontier', 'role', 'candidate', 'review_constraints', 'freeshield',
  'controls', 'content_hash'
];
const CONTRACT_KEYS = ['contract_id', 'product_id', 'product_version', 'content_hash'];
const FRONTIER_KEYS = ['repository', 'revision', 'observed_at'];
const ROLE_KEYS = ['role_id', 'role_title', 'owner_role_id', 'validity_frontier', 'tasks', 'requirements'];
const REQUIREMENT_KEYS = [
  'requirement_id', 'text', 'owner_role_id', 'job_relevance_rationale',
  'evidence_standard', 'material', 'challengeable', 'accepted_evidence_kinds'
];
const CANDIDATE_KEYS = ['candidate_packet_id', 'fictional', 'evidence_items', 'claims', 'declared_context'];
const EVIDENCE_KEYS = [
  'evidence_id', 'kind', 'status', 'data_class', 'source_ref', 'provenance_ref',
  'digest', 'submitted_for_requirement_ids', 'feature_tags'
];
const CLAIM_KEYS = ['claim_id', 'text', 'status', 'requirement_refs', 'evidence_refs'];
const CONTEXT_KEYS = ['context_id', 'text', 'requirement_refs', 'data_class', 'feature_tags'];
const REVIEW_KEYS = [
  'review_id', 'allowed_data_classes', 'prohibited_features', 'global_ranking_allowed',
  'external_effects_allowed', 'challenge_supported', 'employment_decision_in_scope',
  'cross_context_correlation_allowed'
];
const FREESHIELD_KEYS = ['assessment_input', 'assessment_receipt'];
const CONTROL_KEYS = [
  'local_only', 'read_only', 'network_access_required', 'filesystem_write_required',
  'provider_invocation_available', 'ats_mutation_available', 'communication_available',
  'global_ranking_available', 'employment_decision_available',
  'human_disposition_available', 'action_permit_creation_available',
  'execution_available', 'external_effect_available', 'automatic_retry'
];

const REQUIREMENT_RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'receipt_id', 'contract_binding',
  'evaluation_frontier', 'source_input', 'role', 'requirements', 'coverage',
  'claims', 'non_effects', 'next_safe_action', 'content_hash'
];
const COMPARISON_RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'receipt_id', 'contract_binding',
  'evaluation_frontier', 'source_input', 'requirement_receipt_ref',
  'candidate_packet', 'freeshield_assessment_ref', 'state',
  'comparison_by_requirement', 'uncertainty_summary', 'prohibited_feature_findings',
  'global_ranking', 'human_review_packet', 'success_criteria', 'claims',
  'non_effects', 'next_safe_action', 'content_hash'
];
const RESULT_KEYS = [
  'protocol', 'version', 'artifact_type', 'result_id', 'source_input',
  'requirement_receipt', 'freeshield_assessment_receipt', 'comparison_receipt',
  'next_safe_action', 'content_hash'
];
const SOURCE_INPUT_KEYS = ['input_id', 'input_hash'];
const REQUIREMENT_ROLE_KEYS = ['role_id', 'role_title', 'owner_role_id', 'validity_frontier'];
const NORMALIZED_REQUIREMENT_KEYS = [
  'requirement_id', 'text', 'owner_role_id', 'job_relevance_rationale',
  'evidence_standard', 'material', 'challengeable', 'accepted_evidence_kinds'
];
const COVERAGE_KEYS = ['material_requirement_count', 'attributable_material_count', 'coverage_complete'];
const RECEIPT_REF_KEYS = ['receipt_id', 'content_hash'];
const CANDIDATE_PACKET_KEYS = ['candidate_packet_id', 'fictional'];
const FREESHIELD_REF_KEYS = [
  'input_id', 'input_hash', 'receipt_id', 'receipt_hash', 'state', 'outcome',
  'human_disposition_required'
];
const COMPARISON_ITEM_KEYS = [
  'requirement_id', 'finding', 'claim_ids', 'evidence_ids', 'evidence_statuses',
  'uncertainty_codes', 'reason_codes'
];
const UNCERTAINTY_KEYS = [
  'unverified_evidence_ids', 'unavailable_evidence_ids', 'stale_evidence_ids',
  'conflicting_evidence_ids', 'unknown_requirement_ids'
];
const PROHIBITED_FINDING_KEYS = ['source_kind', 'source_id', 'feature'];
const GLOBAL_RANKING_KEYS = ['created', 'score', 'rank'];
const HUMAN_REVIEW_KEYS = [
  'packet_status', 'protective_disposition_required',
  'comparison_disposition_required', 'challenge_path_preserved'
];
const SUCCESS_KEYS = [
  'requirement_attribution_coverage', 'candidate_evidence_lineage_coverage',
  'prohibited_feature_exclusion', 'no_global_ranking', 'uncertainty_visibility',
  'zero_external_effect'
];

const EVIDENCE_KINDS = new Set(['work_history', 'skill', 'work_sample', 'certification', 'candidate_explanation']);
const EVIDENCE_STATUSES = new Set(['verified', 'unverified', 'unavailable', 'stale', 'conflicting', 'UNKNOWN']);
const ALLOWED_DATA_CLASSES = new Set(['candidate-job-evidence', 'candidate-declared-context-data']);
const MACHINE_STATES = new Set([
  'UNKNOWN', 'CONFLICT', 'INSUFFICIENT_JOB_RELEVANT_EVIDENCE',
  'PROHIBITED_FEATURE_RISK', 'COMPARISON_CANDIDATE_READY'
]);
const FINDINGS = new Set(['EVIDENCED', 'PARTIAL_UNVERIFIED', 'UNAVAILABLE', 'UNKNOWN', 'CONFLICT']);
const CANONICAL_PROHIBITED_FEATURES = Object.freeze([
  'protected_attribute', 'protected_attribute_proxy', 'personality', 'emotion',
  'deception', 'health', 'disability', 'psychological_state', 'social_profile',
  'behavioral_biometrics', 'interaction_latency', 'unrelated_personal_history',
  'hidden_third_party_data', 'cross_context_correlation'
]);

const REQUIREMENT_TRUE_CLAIMS = Object.freeze([
  'requirements_normalized', 'exact_contract_bound', 'material_requirements_attributable',
  'job_relevance_rationales_present', 'evidence_standards_present', 'challengeability_preserved'
]);
const REQUIREMENT_FALSE_CLAIMS = Object.freeze([
  'candidate_comparison_authorized', 'employment_decision_authorized', 'authority_created',
  'responsibility_accepted', 'action_permit_created', 'execution_admitted',
  'external_effect_performed', 'universal_lawfulness_established'
]);
const REQUIREMENT_CLAIM_KEYS = Object.freeze([...REQUIREMENT_TRUE_CLAIMS, ...REQUIREMENT_FALSE_CLAIMS]);
const REQUIREMENT_NON_EFFECTS = Object.freeze([
  'Requirement Receipt != Candidate Comparison Authority',
  'Declared Requirement != Universal Lawfulness',
  'Job-Relevance Rationale != Proof of Necessity',
  'Requirement Attribution != Employment Decision'
]);

const COMPARISON_TRUE_CLAIMS = Object.freeze([
  'comparison_candidate_built', 'exact_contract_bound', 'requirement_receipt_bound',
  'freeshield_assessment_bound', 'evidence_lineage_preserved', 'uncertainty_preserved',
  'human_disposition_still_required', 'challenge_path_preserved', 'no_global_ranking'
]);
const COMPARISON_FALSE_CLAIMS = Object.freeze([
  'candidate_identity_established', 'candidate_worth_established', 'candidate_rejected',
  'candidate_shortlisted', 'candidate_offered', 'candidate_hired',
  'employment_decision_made', 'human_disposition_recorded', 'global_ranking_created',
  'protected_attribute_inferred', 'proxy_attribute_inferred', 'personality_inferred',
  'emotion_inferred', 'deception_inferred', 'health_inferred', 'disability_inferred',
  'psychological_state_inferred', 'social_profile_scraped',
  'cross_context_correlation_performed', 'ats_mutated', 'message_sent',
  'calendar_mutated', 'background_check_requested', 'external_system_mutated',
  'authority_created', 'responsibility_accepted', 'action_permit_created',
  'execution_admitted', 'external_effect_performed',
  'stable_core_promotion_established', 'successor_authority_created'
]);
const COMPARISON_CLAIM_KEYS = Object.freeze([...COMPARISON_TRUE_CLAIMS, ...COMPARISON_FALSE_CLAIMS]);
const COMPARISON_NON_EFFECTS = Object.freeze([
  'Hiring Support != Hiring Authority',
  'Candidate Evidence != Candidate Identity or Worth',
  'Missing Evidence != Negative Evidence',
  'Job-Relevant Comparison != Global Person Ranking',
  'Model Score != Employment Decision',
  'Protected Attribute != Job-Relevant Feature',
  'Proxy Correlation != Permission to Infer a Protected Attribute',
  'Human Review != Rubber-Stamping',
  'Candidate Challenge != Negative Signal',
  'FREESHIELD Assessment != Automatic Rejection'
]);

class HonestHiringLocalMvpError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HonestHiringLocalMvpError';
  }
}

function fail(message) { throw new HonestHiringLocalMvpError(message); }
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
  requireCondition(Array.isArray(value) && value.length >= minItems, `${label} must contain at least ${minItems} item(s)`);
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
function sameCanonical(left, right) { return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right)); }
function assertExactStringSet(value, expected, label) {
  assertStringArray(value, label, { minItems: expected.length });
  requireCondition(value.length === expected.length, `${label} size mismatch`);
  requireCondition(JSON.stringify([...value].sort()) === JSON.stringify([...expected].sort()), `${label} set mismatch`);
}
function uniqueBy(items, key, label) {
  const values = items.map(item => item[key]);
  requireCondition(new Set(values).size === values.length, `${label} ${key} values must be unique`);
}

function validateContractBinding(binding) {
  assertExactKeys(binding, CONTRACT_KEYS, 'contract_binding');
  requireCondition(binding.contract_id === CONTRACT_ID, 'Honest Hiring contract id mismatch');
  requireCondition(binding.product_id === PRODUCT_ID, 'Honest Hiring product id mismatch');
  requireCondition(binding.product_version === PRODUCT_VERSION, 'Honest Hiring product version mismatch');
  requireCondition(binding.content_hash === CONTRACT_HASH, 'Honest Hiring contract hash mismatch');
}
function validateFrontier(frontier, label) {
  assertExactKeys(frontier, FRONTIER_KEYS, label);
  requireCondition(frontier.repository === 'Matawaka/uu-aap', `${label} repository mismatch`);
  assertString(frontier.revision, `${label}.revision`, /^[0-9a-f]{40}$/);
  assertString(frontier.observed_at, `${label}.observed_at`);
}
function comparisonPayload(input) {
  return {
    role: clone(input.role),
    candidate: clone(input.candidate),
    review_constraints: clone(input.review_constraints)
  };
}
function comparisonPayloadDigest(input) {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(comparisonPayload(input))), 'utf8').digest('hex')}`;
}

function validateRole(role, evaluationFrontier) {
  assertExactKeys(role, ROLE_KEYS, 'role');
  assertString(role.role_id, 'role.role_id');
  assertString(role.role_title, 'role.role_title');
  assertString(role.owner_role_id, 'role.owner_role_id');
  validateFrontier(role.validity_frontier, 'role.validity_frontier');
  requireCondition(sameCanonical(role.validity_frontier, evaluationFrontier), 'role validity frontier must equal evaluation frontier');
  assertStringArray(role.tasks, 'role.tasks', { minItems: 1 });
  requireCondition(Array.isArray(role.requirements) && role.requirements.length >= 1, 'role.requirements must contain at least one item');
  uniqueBy(role.requirements, 'requirement_id', 'requirements');
  for (const [index, requirement] of role.requirements.entries()) {
    assertExactKeys(requirement, REQUIREMENT_KEYS, `role.requirements[${index}]`);
    assertString(requirement.requirement_id, `role.requirements[${index}].requirement_id`);
    assertString(requirement.text, `role.requirements[${index}].text`);
    assertString(requirement.owner_role_id, `role.requirements[${index}].owner_role_id`);
    assertString(requirement.job_relevance_rationale, `role.requirements[${index}].job_relevance_rationale`);
    assertString(requirement.evidence_standard, `role.requirements[${index}].evidence_standard`);
    assertBoolean(requirement.material, `role.requirements[${index}].material`);
    assertBoolean(requirement.challengeable, `role.requirements[${index}].challengeable`);
    assertStringArray(requirement.accepted_evidence_kinds, `role.requirements[${index}].accepted_evidence_kinds`, { minItems: 1 });
    for (const kind of requirement.accepted_evidence_kinds) requireCondition(EVIDENCE_KINDS.has(kind), `unsupported accepted evidence kind: ${kind}`);
    if (requirement.material) {
      requireCondition(requirement.owner_role_id === role.owner_role_id, `material requirement owner mismatch: ${requirement.requirement_id}`);
      requireCondition(requirement.challengeable === true, `material requirement must remain challengeable: ${requirement.requirement_id}`);
    }
  }
}

function validateCandidate(candidate, requirements) {
  assertExactKeys(candidate, CANDIDATE_KEYS, 'candidate');
  assertString(candidate.candidate_packet_id, 'candidate.candidate_packet_id');
  requireCondition(candidate.fictional === true, 'v0.1 local MVP accepts fictional candidate data only');
  requireCondition(Array.isArray(candidate.evidence_items), 'candidate.evidence_items must be array');
  requireCondition(Array.isArray(candidate.claims), 'candidate.claims must be array');
  requireCondition(Array.isArray(candidate.declared_context), 'candidate.declared_context must be array');
  uniqueBy(candidate.evidence_items, 'evidence_id', 'candidate evidence');
  uniqueBy(candidate.claims, 'claim_id', 'candidate claims');
  uniqueBy(candidate.declared_context, 'context_id', 'candidate context');

  const requirementIds = new Set(requirements.map(item => item.requirement_id));
  const evidenceIds = new Set(candidate.evidence_items.map(item => item.evidence_id));

  for (const [index, evidence] of candidate.evidence_items.entries()) {
    assertExactKeys(evidence, EVIDENCE_KEYS, `candidate.evidence_items[${index}]`);
    assertString(evidence.evidence_id, `candidate.evidence_items[${index}].evidence_id`);
    requireCondition(EVIDENCE_KINDS.has(evidence.kind), `unsupported evidence kind: ${evidence.kind}`);
    requireCondition(EVIDENCE_STATUSES.has(evidence.status), `unsupported evidence status: ${evidence.status}`);
    requireCondition(evidence.data_class === 'candidate-job-evidence', 'candidate evidence data class must remain candidate-job-evidence');
    assertString(evidence.source_ref, `candidate.evidence_items[${index}].source_ref`);
    assertString(evidence.provenance_ref, `candidate.evidence_items[${index}].provenance_ref`);
    assertString(evidence.digest, `candidate.evidence_items[${index}].digest`, /^sha256:[0-9a-f]{64}$/);
    assertStringArray(evidence.submitted_for_requirement_ids, `candidate.evidence_items[${index}].submitted_for_requirement_ids`, { minItems: 1 });
    for (const requirementId of evidence.submitted_for_requirement_ids) requireCondition(requirementIds.has(requirementId), `evidence references unknown requirement: ${requirementId}`);
    assertStringArray(evidence.feature_tags, `candidate.evidence_items[${index}].feature_tags`);
  }

  for (const [index, claim] of candidate.claims.entries()) {
    assertExactKeys(claim, CLAIM_KEYS, `candidate.claims[${index}]`);
    assertString(claim.claim_id, `candidate.claims[${index}].claim_id`);
    assertString(claim.text, `candidate.claims[${index}].text`);
    requireCondition(EVIDENCE_STATUSES.has(claim.status), `unsupported claim status: ${claim.status}`);
    assertStringArray(claim.requirement_refs, `candidate.claims[${index}].requirement_refs`, { minItems: 1 });
    assertStringArray(claim.evidence_refs, `candidate.claims[${index}].evidence_refs`);
    for (const requirementId of claim.requirement_refs) requireCondition(requirementIds.has(requirementId), `claim references unknown requirement: ${requirementId}`);
    for (const evidenceId of claim.evidence_refs) requireCondition(evidenceIds.has(evidenceId), `claim references unknown evidence: ${evidenceId}`);
    if (!['unavailable', 'UNKNOWN'].includes(claim.status)) requireCondition(claim.evidence_refs.length > 0, `claim ${claim.claim_id} requires evidence lineage`);
  }

  for (const [index, context] of candidate.declared_context.entries()) {
    assertExactKeys(context, CONTEXT_KEYS, `candidate.declared_context[${index}]`);
    assertString(context.context_id, `candidate.declared_context[${index}].context_id`);
    assertString(context.text, `candidate.declared_context[${index}].text`);
    requireCondition(context.data_class === 'candidate-declared-context-data', 'declared context data class mismatch');
    assertStringArray(context.requirement_refs, `candidate.declared_context[${index}].requirement_refs`, { minItems: 1 });
    for (const requirementId of context.requirement_refs) requireCondition(requirementIds.has(requirementId), `context references unknown requirement: ${requirementId}`);
    assertStringArray(context.feature_tags, `candidate.declared_context[${index}].feature_tags`);
  }
}

function validateReview(review) {
  assertExactKeys(review, REVIEW_KEYS, 'review_constraints');
  assertString(review.review_id, 'review_constraints.review_id');
  assertStringArray(review.allowed_data_classes, 'review_constraints.allowed_data_classes', { minItems: 1 });
  const allowed = new Set(review.allowed_data_classes);
  for (const dataClass of allowed) {
    requireCondition([
      'role-requirement-data', 'candidate-job-evidence', 'candidate-declared-context-data',
      'hiring-process-context', 'derived-job-relevance-map', 'protective-assessment-data'
    ].includes(dataClass), `unsupported allowed data class: ${dataClass}`);
  }
  assertExactStringSet(review.prohibited_features, CANONICAL_PROHIBITED_FEATURES, 'review_constraints.prohibited_features');
  for (const key of ['global_ranking_allowed', 'external_effects_allowed', 'employment_decision_in_scope', 'cross_context_correlation_allowed']) {
    assertBoolean(review[key], `review_constraints.${key}`);
    requireCondition(review[key] === false, `review_constraints.${key} must remain false`);
  }
  requireCondition(review.challenge_supported === true, 'candidate challenge path must remain supported');
}

function validateControls(controls) {
  assertExactKeys(controls, CONTROL_KEYS, 'controls');
  requireCondition(controls.local_only === true && controls.read_only === true, 'runtime must remain local read-only');
  for (const key of CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) {
    assertBoolean(controls[key], `controls.${key}`);
    requireCondition(controls[key] === false, `controls.${key} must remain false`);
  }
}

function validateFreeShield(bundle, input) {
  assertExactKeys(bundle, FREESHIELD_KEYS, 'freeshield');
  const source = bundle.assessment_input;
  const receipt = bundle.assessment_receipt;
  FreeShieldBinding.validateReceiptAgainstInput(source, receipt);
  requireCondition(source.consumer_binding.product_id === PRODUCT_ID, 'FREESHIELD consumer product mismatch');
  requireCondition(source.consumer_binding.product_version === PRODUCT_VERSION, 'FREESHIELD consumer version mismatch');
  requireCondition(source.consumer_binding.product_contract_hash === CONTRACT_HASH, 'FREESHIELD consumer contract hash mismatch');
  requireCondition(source.consumer_binding.authority_transfer === false, 'FREESHIELD authority transfer forbidden');
  requireCondition(source.consumer_binding.responsibility_transfer === false, 'FREESHIELD responsibility transfer forbidden');
  requireCondition(sameCanonical(source.evaluation_frontier, input.evaluation_frontier), 'FREESHIELD source frontier mismatch');
  requireCondition(sameCanonical(receipt.evaluation_frontier, input.evaluation_frontier), 'FREESHIELD receipt frontier mismatch');
  requireCondition(source.candidate.candidate_id === input.candidate.candidate_packet_id, 'FREESHIELD candidate identity mismatch');
  requireCondition(source.candidate.payload_digest === comparisonPayloadDigest(input), 'FREESHIELD payload digest does not bind exact Hiring comparison payload');
  requireCondition(receipt.candidate_summary.payload_digest === comparisonPayloadDigest(input), 'FREESHIELD receipt payload digest mismatch');
  return receipt;
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === INPUT_TYPE, `artifact_type must be ${INPUT_TYPE}`);
  assertString(input.input_id, 'input_id', /^urn:uu-aap:honest-hiring:comparison-input:[a-z0-9][a-z0-9:-]{2,191}$/);
  validateContractBinding(input.contract_binding);
  validateFrontier(input.evaluation_frontier, 'evaluation_frontier');
  validateRole(input.role, input.evaluation_frontier);
  validateCandidate(input.candidate, input.role.requirements);
  validateReview(input.review_constraints);
  validateControls(input.controls);
  validateFreeShield(input.freeshield, input);
  requireCondition(input.content_hash === computeContentHash(input), 'input content hash mismatch');
  return input;
}

function detectProhibitedFeatures(input) {
  const prohibited = new Set(input.review_constraints.prohibited_features);
  const findings = [];
  for (const evidence of input.candidate.evidence_items) {
    for (const feature of evidence.feature_tags) {
      if (prohibited.has(feature)) findings.push({ source_kind: 'evidence', source_id: evidence.evidence_id, feature });
    }
  }
  for (const context of input.candidate.declared_context) {
    for (const feature of context.feature_tags) {
      if (prohibited.has(feature)) findings.push({ source_kind: 'declared_context', source_id: context.context_id, feature });
    }
  }
  findings.sort((a, b) => `${a.source_kind}:${a.source_id}:${a.feature}`.localeCompare(`${b.source_kind}:${b.source_id}:${b.feature}`));
  return findings;
}

function deriveRequirementReceipt(input) {
  validateInput(input);
  const material = input.role.requirements.filter(item => item.material);
  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'HonestHiringRequirementReceipt',
    receipt_id: deterministicId('urn:uu-aap:honest-hiring:requirement-receipt:', { input_id: input.input_id, input_hash: input.content_hash }),
    contract_binding: clone(input.contract_binding),
    evaluation_frontier: clone(input.evaluation_frontier),
    source_input: { input_id: input.input_id, input_hash: input.content_hash },
    role: {
      role_id: input.role.role_id,
      role_title: input.role.role_title,
      owner_role_id: input.role.owner_role_id,
      validity_frontier: clone(input.role.validity_frontier)
    },
    requirements: input.role.requirements.map(clone).sort((a, b) => a.requirement_id.localeCompare(b.requirement_id)),
    coverage: {
      material_requirement_count: material.length,
      attributable_material_count: material.filter(item => item.owner_role_id && item.job_relevance_rationale && item.evidence_standard && item.challengeable).length,
      coverage_complete: true
    },
    claims: {},
    non_effects: [...REQUIREMENT_NON_EFFECTS],
    next_safe_action: 'REQUIREMENT_RECEIPT_READY_FOR_LOCAL_COMPARISON_ONLY',
    content_hash: ''
  };
  for (const key of REQUIREMENT_TRUE_CLAIMS) receipt.claims[key] = true;
  for (const key of REQUIREMENT_FALSE_CLAIMS) receipt.claims[key] = false;
  rehash(receipt);
  return validateRequirementReceipt(receipt);
}

function evidenceQualityForClaim(claim, evidenceMap) {
  const statuses = new Set([claim.status]);
  for (const evidenceId of claim.evidence_refs) statuses.add(evidenceMap.get(evidenceId).status);
  return [...statuses].sort();
}

function deriveComparisonReceipt(input, requirementReceipt = null) {
  validateInput(input);
  const requirementsReceipt = requirementReceipt || deriveRequirementReceipt(input);
  validateRequirementReceipt(requirementsReceipt);
  requireCondition(requirementsReceipt.source_input.input_hash === input.content_hash, 'requirement receipt source mismatch');

  const evidenceMap = new Map(input.candidate.evidence_items.map(item => [item.evidence_id, item]));
  const claimsByRequirement = new Map(input.role.requirements.map(item => [item.requirement_id, []]));
  for (const claim of input.candidate.claims) {
    for (const requirementId of claim.requirement_refs) claimsByRequirement.get(requirementId).push(claim);
  }

  const comparison = [];
  const unknownRequirements = [];
  let hasConflict = false;
  let hasMissingMaterialClaim = false;
  for (const requirement of input.role.requirements) {
    const claims = claimsByRequirement.get(requirement.requirement_id) || [];
    if (requirement.material && claims.length === 0) hasMissingMaterialClaim = true;
    const evidenceIds = [...new Set(claims.flatMap(claim => claim.evidence_refs))].sort();
    const statuses = [...new Set(claims.flatMap(claim => evidenceQualityForClaim(claim, evidenceMap)))].sort();
    let finding = 'UNKNOWN';
    const uncertaintyCodes = [];
    const reasonCodes = [];
    if (claims.length === 0) {
      finding = 'UNKNOWN';
      uncertaintyCodes.push('NO_CANDIDATE_CLAIM_FOR_REQUIREMENT');
      reasonCodes.push('MISSING_JOB_RELEVANT_CLAIM');
      unknownRequirements.push(requirement.requirement_id);
    } else if (statuses.includes('conflicting')) {
      finding = 'CONFLICT';
      hasConflict = true;
      uncertaintyCodes.push('CONFLICTING_EVIDENCE');
      reasonCodes.push('HUMAN_RECONCILIATION_REQUIRED');
    } else if (statuses.includes('unavailable') || statuses.includes('UNKNOWN')) {
      finding = 'UNAVAILABLE';
      uncertaintyCodes.push('EVIDENCE_UNAVAILABLE_OR_UNKNOWN');
      reasonCodes.push('MISSING_EVIDENCE_PRESERVED_AS_UNCERTAINTY');
      unknownRequirements.push(requirement.requirement_id);
    } else if (statuses.includes('unverified') || statuses.includes('stale')) {
      finding = 'PARTIAL_UNVERIFIED';
      if (statuses.includes('unverified')) uncertaintyCodes.push('UNVERIFIED_EVIDENCE');
      if (statuses.includes('stale')) uncertaintyCodes.push('STALE_EVIDENCE');
      reasonCodes.push('EVIDENCE_QUALIFICATION_REQUIRED');
    } else {
      finding = 'EVIDENCED';
      reasonCodes.push('SOURCE_BOUND_JOB_EVIDENCE_PRESENT');
    }
    comparison.push({
      requirement_id: requirement.requirement_id,
      finding,
      claim_ids: claims.map(item => item.claim_id).sort(),
      evidence_ids: evidenceIds,
      evidence_statuses: statuses,
      uncertainty_codes: uncertaintyCodes.sort(),
      reason_codes: reasonCodes.sort()
    });
  }
  comparison.sort((a, b) => a.requirement_id.localeCompare(b.requirement_id));

  const prohibited = detectProhibitedFeatures(input);
  const protective = input.freeshield.assessment_receipt;
  const outcome = protective.protective_outcome.outcome;
  let state = 'COMPARISON_CANDIDATE_READY';
  if (prohibited.length > 0 || outcome === 'BLOCK_EFFECT') state = 'PROHIBITED_FEATURE_RISK';
  else if (outcome === 'HUMAN_REVIEW' || hasConflict) state = 'CONFLICT';
  else if (outcome === 'REQUIRE_EVIDENCE' || hasMissingMaterialClaim) state = 'INSUFFICIENT_JOB_RELEVANT_EVIDENCE';
  else if (outcome === 'NARROW_SCOPE') state = 'UNKNOWN';
  requireCondition(MACHINE_STATES.has(state), 'derived machine state invalid');

  const uncertainty = {
    unverified_evidence_ids: input.candidate.evidence_items.filter(item => item.status === 'unverified').map(item => item.evidence_id).sort(),
    unavailable_evidence_ids: input.candidate.evidence_items.filter(item => item.status === 'unavailable').map(item => item.evidence_id).sort(),
    stale_evidence_ids: input.candidate.evidence_items.filter(item => item.status === 'stale').map(item => item.evidence_id).sort(),
    conflicting_evidence_ids: input.candidate.evidence_items.filter(item => item.status === 'conflicting').map(item => item.evidence_id).sort(),
    unknown_requirement_ids: [...new Set(unknownRequirements)].sort()
  };

  const claims = {};
  for (const key of COMPARISON_TRUE_CLAIMS) claims[key] = true;
  for (const key of COMPARISON_FALSE_CLAIMS) claims[key] = false;

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'HonestHiringComparisonReceipt',
    receipt_id: deterministicId('urn:uu-aap:honest-hiring:comparison-receipt:', { input_id: input.input_id, input_hash: input.content_hash }),
    contract_binding: clone(input.contract_binding),
    evaluation_frontier: clone(input.evaluation_frontier),
    source_input: { input_id: input.input_id, input_hash: input.content_hash },
    requirement_receipt_ref: {
      receipt_id: requirementsReceipt.receipt_id,
      content_hash: requirementsReceipt.content_hash
    },
    candidate_packet: {
      candidate_packet_id: input.candidate.candidate_packet_id,
      fictional: true
    },
    freeshield_assessment_ref: {
      input_id: input.freeshield.assessment_input.input_id,
      input_hash: input.freeshield.assessment_input.content_hash,
      receipt_id: protective.receipt_id,
      receipt_hash: protective.content_hash,
      state: protective.state,
      outcome,
      human_disposition_required: protective.protective_outcome.human_disposition_required
    },
    state,
    comparison_by_requirement: comparison,
    uncertainty_summary: uncertainty,
    prohibited_feature_findings: prohibited,
    global_ranking: { created: false, score: null, rank: null },
    human_review_packet: {
      packet_status: 'candidate',
      protective_disposition_required: true,
      comparison_disposition_required: true,
      challenge_path_preserved: true
    },
    success_criteria: {
      requirement_attribution_coverage: requirementsReceipt.coverage.coverage_complete,
      candidate_evidence_lineage_coverage: true,
      prohibited_feature_exclusion: prohibited.length === 0,
      no_global_ranking: true,
      uncertainty_visibility: true,
      zero_external_effect: true
    },
    claims,
    non_effects: [...COMPARISON_NON_EFFECTS],
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(receipt);
  return validateComparisonReceipt(receipt);
}

function deriveResult(input) {
  validateInput(input);
  const requirementReceipt = deriveRequirementReceipt(input);
  const comparisonReceipt = deriveComparisonReceipt(input, requirementReceipt);
  const result = {
    protocol: PROTOCOL,
    version: VERSION,
    artifact_type: RESULT_TYPE,
    result_id: deterministicId('urn:uu-aap:honest-hiring:local-result:', { input_id: input.input_id, input_hash: input.content_hash }),
    source_input: { input_id: input.input_id, input_hash: input.content_hash },
    requirement_receipt: requirementReceipt,
    freeshield_assessment_receipt: clone(input.freeshield.assessment_receipt),
    comparison_receipt: comparisonReceipt,
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(result);
  return validateResult(result);
}

function validateRequirementReceipt(receipt) {
  assertExactKeys(receipt, REQUIREMENT_RECEIPT_KEYS, 'requirement_receipt');
  requireCondition(receipt.protocol === PROTOCOL && receipt.version === VERSION, 'requirement receipt protocol/version mismatch');
  requireCondition(receipt.receipt_type === 'HonestHiringRequirementReceipt', 'requirement receipt type mismatch');
  assertString(receipt.receipt_id, 'requirement_receipt.receipt_id', /^urn:uu-aap:honest-hiring:requirement-receipt:[0-9a-f]{24}$/);
  validateContractBinding(receipt.contract_binding);
  validateFrontier(receipt.evaluation_frontier, 'requirement_receipt.evaluation_frontier');
  assertExactKeys(receipt.source_input, SOURCE_INPUT_KEYS, 'requirement_receipt.source_input');
  assertString(receipt.source_input.input_id, 'requirement_receipt.source_input.input_id');
  assertString(receipt.source_input.input_hash, 'requirement_receipt.source_input.input_hash', /^sha256:[0-9a-f]{64}$/);
  assertExactKeys(receipt.role, REQUIREMENT_ROLE_KEYS, 'requirement_receipt.role');
  assertString(receipt.role.role_id, 'requirement_receipt.role.role_id');
  assertString(receipt.role.role_title, 'requirement_receipt.role.role_title');
  assertString(receipt.role.owner_role_id, 'requirement_receipt.role.owner_role_id');
  validateFrontier(receipt.role.validity_frontier, 'requirement_receipt.role.validity_frontier');
  requireCondition(Array.isArray(receipt.requirements) && receipt.requirements.length >= 1, 'requirement receipt requires requirements');
  uniqueBy(receipt.requirements, 'requirement_id', 'requirement receipt requirements');
  for (const [index, requirement] of receipt.requirements.entries()) {
    assertExactKeys(requirement, NORMALIZED_REQUIREMENT_KEYS, `requirement_receipt.requirements[${index}]`);
    assertString(requirement.requirement_id, `requirement_receipt.requirements[${index}].requirement_id`);
    assertString(requirement.text, `requirement_receipt.requirements[${index}].text`);
    assertString(requirement.owner_role_id, `requirement_receipt.requirements[${index}].owner_role_id`);
    assertString(requirement.job_relevance_rationale, `requirement_receipt.requirements[${index}].job_relevance_rationale`);
    assertString(requirement.evidence_standard, `requirement_receipt.requirements[${index}].evidence_standard`);
    assertBoolean(requirement.material, `requirement_receipt.requirements[${index}].material`);
    assertBoolean(requirement.challengeable, `requirement_receipt.requirements[${index}].challengeable`);
    assertStringArray(requirement.accepted_evidence_kinds, `requirement_receipt.requirements[${index}].accepted_evidence_kinds`, { minItems: 1 });
  }
  assertExactKeys(receipt.coverage, COVERAGE_KEYS, 'requirement_receipt.coverage');
  requireCondition(Number.isInteger(receipt.coverage.material_requirement_count) && receipt.coverage.material_requirement_count >= 0, 'material requirement count invalid');
  requireCondition(Number.isInteger(receipt.coverage.attributable_material_count) && receipt.coverage.attributable_material_count >= 0, 'attributable material count invalid');
  requireCondition(receipt.coverage.coverage_complete === true, 'requirement coverage must be complete');
  requireCondition(receipt.coverage.material_requirement_count === receipt.coverage.attributable_material_count, 'material requirement attribution coverage mismatch');
  assertExactKeys(receipt.claims, REQUIREMENT_CLAIM_KEYS, 'requirement_receipt.claims');
  for (const key of REQUIREMENT_TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required requirement claim ${key} must be true`);
  for (const key of REQUIREMENT_FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited requirement claim ${key} must remain false`);
  assertExactStringSet(receipt.non_effects, REQUIREMENT_NON_EFFECTS, 'requirement_receipt.non_effects');
  requireCondition(receipt.next_safe_action === 'REQUIREMENT_RECEIPT_READY_FOR_LOCAL_COMPARISON_ONLY', 'requirement receipt next action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'requirement receipt content hash mismatch');
  return receipt;
}

function validateComparisonReceipt(receipt) {
  assertExactKeys(receipt, COMPARISON_RECEIPT_KEYS, 'comparison_receipt');
  requireCondition(receipt.protocol === PROTOCOL && receipt.version === VERSION, 'comparison receipt protocol/version mismatch');
  requireCondition(receipt.receipt_type === 'HonestHiringComparisonReceipt', 'comparison receipt type mismatch');
  assertString(receipt.receipt_id, 'comparison_receipt.receipt_id', /^urn:uu-aap:honest-hiring:comparison-receipt:[0-9a-f]{24}$/);
  validateContractBinding(receipt.contract_binding);
  validateFrontier(receipt.evaluation_frontier, 'comparison_receipt.evaluation_frontier');
  assertExactKeys(receipt.source_input, SOURCE_INPUT_KEYS, 'comparison_receipt.source_input');
  assertString(receipt.source_input.input_id, 'comparison_receipt.source_input.input_id');
  assertString(receipt.source_input.input_hash, 'comparison_receipt.source_input.input_hash', /^sha256:[0-9a-f]{64}$/);
  assertExactKeys(receipt.requirement_receipt_ref, RECEIPT_REF_KEYS, 'comparison_receipt.requirement_receipt_ref');
  assertString(receipt.requirement_receipt_ref.receipt_id, 'comparison_receipt.requirement_receipt_ref.receipt_id');
  assertString(receipt.requirement_receipt_ref.content_hash, 'comparison_receipt.requirement_receipt_ref.content_hash', /^sha256:[0-9a-f]{64}$/);
  assertExactKeys(receipt.candidate_packet, CANDIDATE_PACKET_KEYS, 'comparison_receipt.candidate_packet');
  assertString(receipt.candidate_packet.candidate_packet_id, 'comparison_receipt.candidate_packet.candidate_packet_id');
  requireCondition(receipt.candidate_packet.fictional === true, 'comparison receipt candidate must remain fictional');
  assertExactKeys(receipt.freeshield_assessment_ref, FREESHIELD_REF_KEYS, 'comparison_receipt.freeshield_assessment_ref');
  assertString(receipt.freeshield_assessment_ref.input_id, 'comparison_receipt.freeshield_assessment_ref.input_id');
  assertString(receipt.freeshield_assessment_ref.input_hash, 'comparison_receipt.freeshield_assessment_ref.input_hash', /^sha256:[0-9a-f]{64}$/);
  assertString(receipt.freeshield_assessment_ref.receipt_id, 'comparison_receipt.freeshield_assessment_ref.receipt_id');
  assertString(receipt.freeshield_assessment_ref.receipt_hash, 'comparison_receipt.freeshield_assessment_ref.receipt_hash', /^sha256:[0-9a-f]{64}$/);
  requireCondition(FreeShield.STATES.has(receipt.freeshield_assessment_ref.state), 'comparison receipt FREESHIELD state invalid');
  requireCondition(FreeShield.OUTCOMES.has(receipt.freeshield_assessment_ref.outcome), 'comparison receipt FREESHIELD outcome invalid');
  requireCondition(receipt.freeshield_assessment_ref.human_disposition_required === true, 'FREESHIELD human disposition must remain required');
  requireCondition(MACHINE_STATES.has(receipt.state), 'comparison receipt machine state invalid');
  requireCondition(Array.isArray(receipt.comparison_by_requirement) && receipt.comparison_by_requirement.length >= 1, 'comparison receipt requires per-requirement findings');
  uniqueBy(receipt.comparison_by_requirement, 'requirement_id', 'comparison receipt requirements');
  for (const [index, item] of receipt.comparison_by_requirement.entries()) {
    assertExactKeys(item, COMPARISON_ITEM_KEYS, `comparison_receipt.comparison_by_requirement[${index}]`);
    assertString(item.requirement_id, `comparison_receipt.comparison_by_requirement[${index}].requirement_id`);
    requireCondition(FINDINGS.has(item.finding), `comparison finding invalid: ${item.finding}`);
    assertStringArray(item.claim_ids, `comparison_receipt.comparison_by_requirement[${index}].claim_ids`);
    assertStringArray(item.evidence_ids, `comparison_receipt.comparison_by_requirement[${index}].evidence_ids`);
    assertStringArray(item.evidence_statuses, `comparison_receipt.comparison_by_requirement[${index}].evidence_statuses`);
    assertStringArray(item.uncertainty_codes, `comparison_receipt.comparison_by_requirement[${index}].uncertainty_codes`);
    assertStringArray(item.reason_codes, `comparison_receipt.comparison_by_requirement[${index}].reason_codes`, { minItems: 1 });
  }
  assertExactKeys(receipt.uncertainty_summary, UNCERTAINTY_KEYS, 'comparison_receipt.uncertainty_summary');
  for (const key of UNCERTAINTY_KEYS) assertStringArray(receipt.uncertainty_summary[key], `comparison_receipt.uncertainty_summary.${key}`);
  requireCondition(Array.isArray(receipt.prohibited_feature_findings), 'prohibited feature findings must be array');
  for (const [index, finding] of receipt.prohibited_feature_findings.entries()) {
    assertExactKeys(finding, PROHIBITED_FINDING_KEYS, `comparison_receipt.prohibited_feature_findings[${index}]`);
    assertString(finding.source_kind, `comparison_receipt.prohibited_feature_findings[${index}].source_kind`);
    assertString(finding.source_id, `comparison_receipt.prohibited_feature_findings[${index}].source_id`);
    requireCondition(CANONICAL_PROHIBITED_FEATURES.includes(finding.feature), 'unknown prohibited feature finding');
  }
  assertExactKeys(receipt.global_ranking, GLOBAL_RANKING_KEYS, 'comparison_receipt.global_ranking');
  requireCondition(receipt.global_ranking.created === false && receipt.global_ranking.score === null && receipt.global_ranking.rank === null, 'global ranking must remain absent');
  assertExactKeys(receipt.human_review_packet, HUMAN_REVIEW_KEYS, 'comparison_receipt.human_review_packet');
  requireCondition(receipt.human_review_packet.packet_status === 'candidate', 'human review packet must remain candidate');
  requireCondition(receipt.human_review_packet.protective_disposition_required === true, 'protective disposition must remain required');
  requireCondition(receipt.human_review_packet.comparison_disposition_required === true, 'comparison disposition must remain required');
  requireCondition(receipt.human_review_packet.challenge_path_preserved === true, 'challenge path must remain preserved');
  assertExactKeys(receipt.success_criteria, SUCCESS_KEYS, 'comparison_receipt.success_criteria');
  for (const key of SUCCESS_KEYS) assertBoolean(receipt.success_criteria[key], `comparison_receipt.success_criteria.${key}`);
  assertExactKeys(receipt.claims, COMPARISON_CLAIM_KEYS, 'comparison_receipt.claims');
  for (const key of COMPARISON_TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required comparison claim ${key} must be true`);
  for (const key of COMPARISON_FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited comparison claim ${key} must remain false`);
  assertExactStringSet(receipt.non_effects, COMPARISON_NON_EFFECTS, 'comparison_receipt.non_effects');
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'comparison receipt next action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'comparison receipt content hash mismatch');
  return receipt;
}

function validateResult(result) {
  assertExactKeys(result, RESULT_KEYS, 'result');
  requireCondition(result.protocol === PROTOCOL && result.version === VERSION, 'result protocol/version mismatch');
  requireCondition(result.artifact_type === RESULT_TYPE, 'result artifact type mismatch');
  assertString(result.result_id, 'result.result_id', /^urn:uu-aap:honest-hiring:local-result:[0-9a-f]{24}$/);
  assertExactKeys(result.source_input, SOURCE_INPUT_KEYS, 'result.source_input');
  assertString(result.source_input.input_id, 'result.source_input.input_id');
  assertString(result.source_input.input_hash, 'result.source_input.input_hash', /^sha256:[0-9a-f]{64}$/);
  validateRequirementReceipt(result.requirement_receipt);
  FreeShield.validateReceipt(result.freeshield_assessment_receipt);
  validateComparisonReceipt(result.comparison_receipt);
  requireCondition(result.requirement_receipt.source_input.input_hash === result.source_input.input_hash, 'result requirement source binding mismatch');
  requireCondition(result.comparison_receipt.source_input.input_hash === result.source_input.input_hash, 'result comparison source binding mismatch');
  requireCondition(result.comparison_receipt.requirement_receipt_ref.content_hash === result.requirement_receipt.content_hash, 'result requirement receipt reference mismatch');
  requireCondition(result.comparison_receipt.freeshield_assessment_ref.receipt_hash === result.freeshield_assessment_receipt.content_hash, 'result FREESHIELD receipt reference mismatch');
  requireCondition(result.next_safe_action === NEXT_SAFE_ACTION, 'result next safe action mismatch');
  requireCondition(result.content_hash === computeContentHash(result), 'result content hash mismatch');
  return result;
}

function validationReceipt(input) {
  const result = deriveResult(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'HonestHiringLocalMvpValidationReceipt',
    input_id: input.input_id,
    input_hash: input.content_hash,
    valid: true,
    state: result.comparison_receipt.state,
    freeshield_outcome: result.comparison_receipt.freeshield_assessment_ref.outcome,
    global_ranking_created: false,
    candidate_rejected: false,
    employment_decision_made: false,
    human_disposition_recorded: false,
    execution_admitted: false,
    external_effect_performed: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); }
  catch (error) { throw new HonestHiringLocalMvpError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function inspectResult(result) {
  validateResult(result);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'HonestHiringLocalMvpInspectionReceipt',
    result_id: result.result_id,
    result_hash: result.content_hash,
    state: result.comparison_receipt.state,
    requirement_count: result.requirement_receipt.requirements.length,
    freeshield_outcome: result.comparison_receipt.freeshield_assessment_ref.outcome,
    protective_disposition_required: true,
    comparison_disposition_required: true,
    global_ranking_created: false,
    candidate_rejected: false,
    employment_decision_made: false,
    external_effect_performed: false
  };
}
function usage() {
  return [
    'Честный найм Local Comparison MVP v0.1', '',
    'Usage:',
    '  node products/honest-hiring/v0.1/local-mvp/honest-hiring.js validate <file|->',
    '  node products/honest-hiring/v0.1/local-mvp/honest-hiring.js compare <file|->',
    '  node products/honest-hiring/v0.1/local-mvp/honest-hiring.js inspect <result-file|->',
    '  node products/honest-hiring/v0.1/local-mvp/honest-hiring.js help', '',
    'This runtime performs local fictional requirement-by-requirement comparison only. It cannot rank, reject, hire, contact or mutate an external system.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  requireCondition(['validate', 'compare', 'inspect'].includes(command), `unsupported command: ${command}; allowed commands are validate, compare, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input path or -`);
  const value = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(value) : command === 'compare' ? deriveResult(value) : inspectResult(value);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: 'HONEST_HIRING_LOCAL_MVP_REJECTED', message: error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();

module.exports = {
  HonestHiringLocalMvpError,
  PROTOCOL, VERSION, INPUT_TYPE, RESULT_TYPE, CONTRACT_ID, PRODUCT_ID,
  PRODUCT_VERSION, CONTRACT_HASH, NEXT_SAFE_ACTION, INPUT_KEYS, CONTRACT_KEYS,
  FRONTIER_KEYS, ROLE_KEYS, REQUIREMENT_KEYS, CANDIDATE_KEYS, EVIDENCE_KEYS,
  CLAIM_KEYS, CONTEXT_KEYS, REVIEW_KEYS, FREESHIELD_KEYS, CONTROL_KEYS,
  REQUIREMENT_RECEIPT_KEYS, COMPARISON_RECEIPT_KEYS, RESULT_KEYS,
  SOURCE_INPUT_KEYS, REQUIREMENT_ROLE_KEYS, NORMALIZED_REQUIREMENT_KEYS,
  COVERAGE_KEYS, RECEIPT_REF_KEYS, CANDIDATE_PACKET_KEYS, FREESHIELD_REF_KEYS,
  COMPARISON_ITEM_KEYS, UNCERTAINTY_KEYS, PROHIBITED_FINDING_KEYS,
  GLOBAL_RANKING_KEYS, HUMAN_REVIEW_KEYS, SUCCESS_KEYS, EVIDENCE_KINDS,
  EVIDENCE_STATUSES, ALLOWED_DATA_CLASSES, MACHINE_STATES, FINDINGS,
  CANONICAL_PROHIBITED_FEATURES, REQUIREMENT_TRUE_CLAIMS,
  REQUIREMENT_FALSE_CLAIMS, REQUIREMENT_CLAIM_KEYS, REQUIREMENT_NON_EFFECTS,
  COMPARISON_TRUE_CLAIMS, COMPARISON_FALSE_CLAIMS, COMPARISON_CLAIM_KEYS,
  COMPARISON_NON_EFFECTS, canonicalize, computeContentHash, rehash,
  comparisonPayload, comparisonPayloadDigest, validateInput, detectProhibitedFeatures,
  deriveRequirementReceipt, deriveComparisonReceipt, deriveResult,
  validateRequirementReceipt, validateComparisonReceipt, validateResult,
  validationReceipt, parseText, readInput, inspectResult, usage, runCli
};
