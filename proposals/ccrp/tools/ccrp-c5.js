'use strict';

const path = require('path');
const Authority = require(path.resolve(__dirname, '../../poai/authority/tools/authority-core.js'));
const Materialization = require(path.resolve(__dirname, '../../poai/materialization/tools/materialization-core.js'));
const C2 = require(path.resolve(__dirname, 'ccrp-c2.js'));
const C4 = require(path.resolve(__dirname, 'ccrp-c4.js'));

function safeId(value) {
  return String(value || 'missing').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function evaluateC5PolicyCoordination({
  authorityVerification,
  materializationPolicy,
  contextAdmission,
  executionAdmission,
  operation,
  requestedAction,
  requestedTarget,
  evaluatedAt
}) {
  const policyErrors = Materialization.validatePolicy(materializationPolicy);
  const authorityErrors = Authority.validateVerificationResult(authorityVerification);
  const contextErrors = C4.validateC4Boundary(contextAdmission);
  const executionErrors = C2.validateC2AdmissionBoundary(executionAdmission);
  const policyDigest = materializationPolicy ? await Materialization.digestJson(materializationPolicy) : null;

  const authorityClaims = authorityVerification && authorityVerification.claims || {};
  const authorityPolicy = authorityVerification && authorityVerification.policy || {};
  const contextClaims = contextAdmission && contextAdmission.claims || {};
  const executionClaims = executionAdmission && executionAdmission.claims || {};

  const externalAuthorityEstablished =
    authorityErrors.length === 0 &&
    !!authorityVerification &&
    authorityVerification.status === 'established' &&
    Array.isArray(authorityVerification.errors) &&
    authorityVerification.errors.length === 0 &&
    authorityClaims.issuer_entitlement_chain_valid === true &&
    authorityClaims.materialization_authority_established === true;

  const checks = {
    materialization_policy_valid: policyErrors.length === 0,
    authority_result_valid: authorityErrors.length === 0,
    external_authority_established: externalAuthorityEstablished,
    authority_scope_exact:
      !!authorityVerification && !!materializationPolicy &&
      authorityVerification.required_scope === materializationPolicy.required_authority_scope &&
      requestedAction === materializationPolicy.required_authority_scope,
    authority_target_exact:
      !!authorityVerification && !!materializationPolicy &&
      authorityVerification.target === requestedTarget &&
      materializationPolicy.applies_to && materializationPolicy.applies_to.target === requestedTarget &&
      materializationPolicy.authority_verification_rule &&
      materializationPolicy.authority_verification_rule.required_target === requestedTarget,
    policy_binding_exact:
      !!authorityVerification && !!materializationPolicy &&
      authorityPolicy.policy_id === materializationPolicy.policy_id &&
      authorityPolicy.policy_version === materializationPolicy.policy_version &&
      authorityPolicy.digest && authorityPolicy.digest.value === policyDigest,
    context_admission_valid: contextErrors.length === 0,
    context_admitted:
      !!contextAdmission && contextAdmission.decision === 'context_admitted' &&
      contextClaims.context_admission_established === true,
    execution_admission_valid: executionErrors.length === 0,
    execution_admitted:
      !!executionAdmission && executionAdmission.decision === 'admitted' &&
      executionClaims.execution_admitted === true,
    current_execution_owner_established:
      contextClaims.current_execution_owner_established === true &&
      executionClaims.current_execution_owner_established === true,
    operation_ref_exact:
      !!operation && !!contextAdmission && !!executionAdmission &&
      contextAdmission.operation_ref === operation.operation_id &&
      executionAdmission.operation_ref === operation.operation_id,
    lease_ref_exact:
      !!contextAdmission && !!executionAdmission &&
      contextAdmission.presented_lease_ref === executionAdmission.presented_lease_ref &&
      contextAdmission.presented_lease_ref === executionAdmission.current_lease_ref,
    action_exact: !!operation && operation.action === requestedAction,
    target_exact: !!operation && operation.target === requestedTarget,
    revision_binding_exact:
      !!operation && !!executionAdmission &&
      executionAdmission.current_revision === operation.base_revision &&
      operation.base_revision === operation.observed_current_revision,
    context_input_did_not_self_permit_materialization:
      contextClaims.materialization_permitted === false,
    execution_input_did_not_self_permit_materialization:
      executionClaims.materialization_permitted === false
  };

  const coordinated = Object.values(checks).every(Boolean);
  const reasonCodes = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `failed:${name}`);

  const externalPolicyInputEstablished =
    checks.materialization_policy_valid &&
    checks.policy_binding_exact &&
    checks.authority_scope_exact &&
    checks.authority_target_exact;

  const contextInputEstablished =
    checks.context_admission_valid && checks.context_admitted &&
    checks.context_input_did_not_self_permit_materialization;

  const executionInputEstablished =
    checks.execution_admission_valid && checks.execution_admitted &&
    checks.current_execution_owner_established &&
    checks.execution_input_did_not_self_permit_materialization;

  return {
    artifact_type: 'CCRPPolicyCoordinationResult',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C5',
    result_id: `urn:ccrp:policy-coordination-result:${safeId(operation && operation.operation_id)}--${safeId(authorityVerification && authorityVerification.verification_id)}`,
    evaluated_at: evaluatedAt,
    requested_action: requestedAction,
    requested_target: requestedTarget,
    operation_ref: operation && operation.operation_id,
    context_admission_ref: contextAdmission && contextAdmission.result_id,
    execution_admission_ref: executionAdmission && executionAdmission.result_id,
    authority_verification_ref: authorityVerification && authorityVerification.verification_id,
    materialization_policy_ref: {
      policy_id: materializationPolicy && materializationPolicy.policy_id,
      policy_version: materializationPolicy && materializationPolicy.policy_version,
      digest: policyDigest
    },
    decision: coordinated ? 'coordinated' : 'not_coordinated',
    reason_codes: reasonCodes,
    checks,
    source_artifacts_preserved: true,
    claims: {
      external_poai_authority_input_established:
        checks.authority_result_valid && checks.external_authority_established &&
        checks.authority_scope_exact && checks.authority_target_exact && checks.policy_binding_exact,
      external_materialization_policy_input_established: externalPolicyInputEstablished,
      context_admission_input_established: contextInputEstablished,
      execution_admission_input_established: executionInputEstablished,
      policy_integrated_coordination_established: coordinated,
      execution_admitted: false,
      materialization_permitted: false,
      poai_authority_established: false,
      canonical_state_established: false,
      policy_relative_canonicality_established: false,
      universal_canonicality_established: false,
      historical_provenance_preserved: true,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_authority_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    }
  };
}

const FORBIDDEN_C5_CLAIMS = [
  'execution_admitted',
  'materialization_permitted',
  'poai_authority_established',
  'canonical_state_established',
  'policy_relative_canonicality_established',
  'universal_canonicality_established',
  'truth_certified',
  'causal_proof_certified',
  'legal_responsibility_determined',
  'moral_correctness_established',
  'legal_authority_established',
  'legal_effect_established',
  'poai_v_conformance_established'
];

function validateC5Boundary(result) {
  const errors = [];
  if (!result || result.artifact_type !== 'CCRPPolicyCoordinationResult') errors.push('not_ccrp_policy_coordination_result');
  if (!result || result.conformance_level !== 'CCRP/C5') errors.push('wrong_conformance_level');
  if (!result || result.source_artifacts_preserved !== true) errors.push('source_artifacts_not_preserved');
  if (!result || !result.claims || result.claims.historical_provenance_preserved !== true) {
    errors.push('historical_provenance_not_preserved');
  }
  for (const claim of FORBIDDEN_C5_CLAIMS) {
    if (!result || !result.claims || result.claims[claim] !== false) {
      errors.push(`c5_claim_must_remain_false:${claim}`);
    }
  }
  if (result && result.decision === 'coordinated') {
    for (const claim of [
      'external_poai_authority_input_established',
      'external_materialization_policy_input_established',
      'context_admission_input_established',
      'execution_admission_input_established',
      'policy_integrated_coordination_established'
    ]) {
      if (!result.claims || result.claims[claim] !== true) errors.push(`coordinated_result_missing:${claim}`);
    }
    if (!Array.isArray(result.reason_codes) || result.reason_codes.length !== 0) errors.push('coordinated_result_has_reasons');
  } else if (result) {
    if (!result.claims || result.claims.policy_integrated_coordination_established !== false) {
      errors.push('not_coordinated_result_establishes_coordination');
    }
    if (!Array.isArray(result.reason_codes) || result.reason_codes.length === 0) errors.push('not_coordinated_result_missing_reason');
  }
  return errors;
}

module.exports = {
  FORBIDDEN_C5_CLAIMS,
  evaluateC5PolicyCoordination,
  validateC5Boundary
};
