'use strict';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(object, keys, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: expected object`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(object, key), `${label}: missing ${key}`);
  for (const key of Object.keys(object)) assert(keys.includes(key), `${label}: unexpected property ${key}`);
}

function nonEmpty(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label}: expected non-empty string`);
}

function validateInput(input) {
  exactKeys(input, [
    '$schema', 'artifact_type', 'artifact_version', 'decision_input_id', 'action', 'target', 'operation_ref',
    'responsible_party_id', 'executor_implementation_id', 'evidence_refs'
  ], 'CommitDecisionInput');
  assert(input.$schema === './commit-decision-input.schema.json', 'CommitDecisionInput: schema binding mismatch');
  assert(input.artifact_type === 'CommitDecisionInput', 'CommitDecisionInput: artifact_type mismatch');
  assert(input.artifact_version === '0.1', 'CommitDecisionInput: artifact_version mismatch');
  for (const key of ['decision_input_id', 'action', 'target', 'operation_ref', 'responsible_party_id', 'executor_implementation_id']) {
    nonEmpty(input[key], `CommitDecisionInput.${key}`);
  }
  exactKeys(input.evidence_refs, [
    'handoff_result_ref', 'handoff_offer_ref', 'handoff_acceptance_ref', 'revalidation_receipt_ref',
    'authority_verification_ref', 'execution_admission_ref', 'pre_materialization_ref'
  ], 'CommitDecisionInput.evidence_refs');
  for (const [key, value] of Object.entries(input.evidence_refs)) nonEmpty(value, `CommitDecisionInput.evidence_refs.${key}`);
}

function validateRevalidation(receipt) {
  exactKeys(receipt, [
    '$schema', 'artifact_type', 'artifact_version', 'receipt_id', 'operation_ref', 'action', 'target',
    'intended_base_revision', 'observed_current_revision', 'observed_at', 'decision_at', 'max_age_seconds',
    'checks', 'claims'
  ], 'RevalidationReceipt');
  assert(receipt.$schema === './revalidation-receipt.schema.json', 'RevalidationReceipt: schema binding mismatch');
  assert(receipt.artifact_type === 'RevalidationReceipt', 'RevalidationReceipt: artifact_type mismatch');
  assert(receipt.artifact_version === '0.1', 'RevalidationReceipt: artifact_version mismatch');
  assert(Number.isInteger(receipt.max_age_seconds) && receipt.max_age_seconds > 0 && receipt.max_age_seconds <= 3600,
    'RevalidationReceipt: invalid max_age_seconds');
}

function evaluateFreshness(receipt) {
  const observed = Date.parse(receipt.observed_at);
  const decision = Date.parse(receipt.decision_at);
  if (!Number.isFinite(observed) || !Number.isFinite(decision)) return false;
  const ageMs = decision - observed;
  return ageMs >= 0 && ageMs <= receipt.max_age_seconds * 1000;
}

function checkObject() {
  return {
    handoff_accepted: false,
    handoff_party_exact: false,
    handoff_executor_exact: false,
    action_exact: false,
    target_exact: false,
    operation_exact: false,
    revalidation_fresh: false,
    revision_unchanged: false,
    authority_established: false,
    authority_scope_exact: false,
    authority_target_exact: false,
    execution_admitted: false,
    collision_clear: false,
    execution_revision_exact: false,
    pre_materialization_permitted: false,
    pre_materialization_refs_exact: false
  };
}

function evaluateCommitDecision(input, evidence) {
  validateInput(input);
  const {
    handoffResult,
    handoffOffer,
    handoffAcceptance,
    revalidationReceipt,
    authorityVerification,
    operation,
    executionAdmission,
    preMaterializationResult
  } = evidence;

  for (const [key, value] of Object.entries(evidence)) assert(value && typeof value === 'object', `evidence.${key}: required object`);
  validateRevalidation(revalidationReceipt);

  const checks = checkObject();

  checks.handoff_accepted =
    handoffResult.status === 'accepted' &&
    handoffResult.claims &&
    handoffResult.claims.capability_attestation_verified === true &&
    handoffResult.claims.responsibility_transfer_established === true &&
    handoffResult.claims.responsibility_accepted === true &&
    handoffResult.claims.execution_admitted === false &&
    handoffResult.claims.materialization_permitted === false &&
    input.evidence_refs.handoff_result_ref === handoffResult.assessment_id;

  checks.handoff_party_exact =
    handoffOffer.receiving_party_id === input.responsible_party_id &&
    handoffAcceptance.receiving_party_id === input.responsible_party_id &&
    handoffResult.assignment_after_handoff &&
    handoffResult.assignment_after_handoff.responsible_party_id === input.responsible_party_id;

  checks.handoff_executor_exact =
    handoffOffer.executor_implementation_id === input.executor_implementation_id &&
    handoffAcceptance.executor_implementation_id === input.executor_implementation_id;

  checks.action_exact =
    handoffOffer.effect_ref && handoffOffer.effect_ref.action === input.action &&
    revalidationReceipt.action === input.action &&
    operation.action === input.action &&
    preMaterializationResult.requested_action === input.action;

  checks.target_exact =
    handoffOffer.effect_ref && handoffOffer.effect_ref.target === input.target &&
    revalidationReceipt.target === input.target &&
    operation.target === input.target &&
    preMaterializationResult.requested_target === input.target;

  checks.operation_exact =
    input.operation_ref === operation.operation_id &&
    revalidationReceipt.operation_ref === input.operation_ref &&
    executionAdmission.operation_ref === input.operation_ref &&
    preMaterializationResult.ccrp_operation_ref === input.operation_ref;

  checks.revalidation_fresh =
    evaluateFreshness(revalidationReceipt) &&
    revalidationReceipt.claims && revalidationReceipt.claims.revalidation_performed === true &&
    revalidationReceipt.claims.freshness_established === true &&
    revalidationReceipt.checks &&
    revalidationReceipt.checks.action_exact === true &&
    revalidationReceipt.checks.target_exact === true &&
    revalidationReceipt.checks.operation_exact === true;

  checks.revision_unchanged =
    revalidationReceipt.intended_base_revision === revalidationReceipt.observed_current_revision &&
    revalidationReceipt.checks.revision_unchanged === true &&
    operation.base_revision === revalidationReceipt.observed_current_revision &&
    operation.observed_current_revision === revalidationReceipt.observed_current_revision;

  checks.authority_established =
    authorityVerification.status === 'established' &&
    authorityVerification.claims &&
    authorityVerification.claims.issuer_entitlement_chain_valid === true &&
    authorityVerification.claims.materialization_authority_established === true &&
    input.evidence_refs.authority_verification_ref === authorityVerification.verification_id &&
    authorityVerification.subject && authorityVerification.subject.id === input.responsible_party_id;

  checks.authority_scope_exact = authorityVerification.required_scope === input.action;
  checks.authority_target_exact = authorityVerification.target === input.target;

  checks.execution_admitted =
    executionAdmission.decision === 'admitted' &&
    executionAdmission.claims && executionAdmission.claims.execution_admitted === true &&
    executionAdmission.claims.current_execution_owner_established === true &&
    executionAdmission.claims.lease_established === true &&
    input.evidence_refs.execution_admission_ref === executionAdmission.result_id;

  checks.collision_clear =
    executionAdmission.checks && executionAdmission.checks.collision_clear === true &&
    executionAdmission.reason_codes && executionAdmission.reason_codes.length === 0;

  checks.execution_revision_exact =
    executionAdmission.current_revision === revalidationReceipt.observed_current_revision &&
    executionAdmission.checks && executionAdmission.checks.revision_current === true &&
    executionAdmission.checks.action_in_scope === true &&
    executionAdmission.checks.target_in_scope === true;

  checks.pre_materialization_permitted =
    preMaterializationResult.decision === 'permitted' &&
    preMaterializationResult.claims &&
    preMaterializationResult.claims.poai_authority_input_established === true &&
    preMaterializationResult.claims.ccrp_execution_admission_input_established === true &&
    preMaterializationResult.claims.pre_materialization_permit_established === true &&
    preMaterializationResult.claims.materialization_permitted === true &&
    preMaterializationResult.claims.materialization_event_recorded === false &&
    preMaterializationResult.claims.repository_mutation_performed === false &&
    input.evidence_refs.pre_materialization_ref === preMaterializationResult.decision_id;

  checks.pre_materialization_refs_exact =
    preMaterializationResult.authority_verification_ref === authorityVerification.verification_id &&
    preMaterializationResult.ccrp_execution_admission_ref === executionAdmission.result_id &&
    preMaterializationResult.ccrp_operation_ref === operation.operation_id;

  const reasons = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `failed:${name}`);

  const approved = reasons.length === 0;

  return {
    $schema: './commit-decision-result.schema.json',
    artifact_type: 'CommitDecisionResult',
    artifact_version: '0.1',
    decision_id: `urn:uu-aap:commit-decision:${input.decision_input_id.replace(/[^A-Za-z0-9._:-]/g, '_')}`,
    decision_input_id: input.decision_input_id,
    evaluated_at: revalidationReceipt.decision_at,
    decision: approved ? 'approved' : 'not_approved',
    reason_codes: reasons,
    action: input.action,
    target: input.target,
    operation_ref: input.operation_ref,
    responsible_party_id: input.responsible_party_id,
    executor_implementation_id: input.executor_implementation_id,
    revision: revalidationReceipt.observed_current_revision,
    checks,
    claims: {
      responsibility_input_established: checks.handoff_accepted && checks.handoff_party_exact && checks.handoff_executor_exact,
      authority_input_established: checks.authority_established && checks.authority_scope_exact && checks.authority_target_exact,
      execution_admission_input_established: checks.execution_admitted && checks.collision_clear && checks.execution_revision_exact,
      revalidation_input_established: checks.revalidation_fresh && checks.revision_unchanged,
      pre_materialization_permission_input_established: checks.pre_materialization_permitted && checks.pre_materialization_refs_exact,
      commit_decision_approved: approved,
      commit_performed: false,
      materialization_event_recorded: false,
      repository_mutation_performed: false,
      outcome_observed: false,
      canonical_state_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    }
  };
}

module.exports = { evaluateCommitDecision, validateInput, validateRevalidation, evaluateFreshness };
