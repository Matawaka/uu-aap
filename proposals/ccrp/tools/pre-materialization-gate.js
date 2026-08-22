'use strict';

const path = require('path');
const Authority = require(path.resolve(__dirname, '../../poai/authority/tools/authority-core.js'));
const Materialization = require(path.resolve(__dirname, '../../poai/materialization/tools/materialization-core.js'));
const C2 = require(path.resolve(__dirname, 'ccrp-c2.js'));

function safeId(value) {
  return String(value || 'missing').replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function evaluatePreMaterializationGate({
  authorityVerification,
  materializationPolicy,
  ccrpAdmission,
  operation,
  requestedAction,
  requestedTarget,
  evaluatedAt
}) {
  const policyErrors = Materialization.validatePolicy(materializationPolicy);
  const authorityErrors = Authority.validateVerificationResult(authorityVerification);
  const ccrpErrors = C2.validateC2AdmissionBoundary(ccrpAdmission);
  const policyDigest = materializationPolicy ? await Materialization.digestJson(materializationPolicy) : null;

  const policyBinding = authorityVerification && authorityVerification.policy || {};
  const claims = authorityVerification && authorityVerification.claims || {};
  const admissionClaims = ccrpAdmission && ccrpAdmission.claims || {};

  const checks = {
    policy_valid: policyErrors.length === 0,
    authority_result_valid: authorityErrors.length === 0,
    authority_result_established: !!authorityVerification && authorityVerification.status === 'established' && Array.isArray(authorityVerification.errors) && authorityVerification.errors.length === 0,
    issuer_entitlement_established: claims.issuer_entitlement_chain_valid === true,
    materialization_authority_established: claims.materialization_authority_established === true,
    authority_scope_exact: !!authorityVerification && !!materializationPolicy && authorityVerification.required_scope === materializationPolicy.required_authority_scope && requestedAction === materializationPolicy.required_authority_scope,
    authority_target_exact: !!authorityVerification && !!materializationPolicy && authorityVerification.target === requestedTarget && materializationPolicy.applies_to && materializationPolicy.applies_to.target === requestedTarget && materializationPolicy.authority_verification_rule && materializationPolicy.authority_verification_rule.required_target === requestedTarget,
    policy_binding_exact: !!materializationPolicy && !!authorityVerification && policyBinding.policy_id === materializationPolicy.policy_id && policyBinding.policy_version === materializationPolicy.policy_version && policyBinding.digest && policyBinding.digest.value === policyDigest,
    ccrp_admission_valid: ccrpErrors.length === 0,
    ccrp_execution_admitted: !!ccrpAdmission && ccrpAdmission.decision === 'admitted' && admissionClaims.execution_admitted === true,
    ccrp_current_owner_established: admissionClaims.current_execution_owner_established === true,
    ccrp_lease_established: admissionClaims.lease_established === true,
    ccrp_operation_ref_exact: !!ccrpAdmission && !!operation && ccrpAdmission.operation_ref === operation.operation_id,
    ccrp_action_exact: !!operation && operation.action === requestedAction,
    ccrp_target_exact: !!operation && operation.target === requestedTarget,
    ccrp_revision_binding_exact: !!ccrpAdmission && !!operation && ccrpAdmission.current_revision === operation.base_revision && operation.base_revision === operation.observed_current_revision,
    ccrp_did_not_self_permit_materialization: admissionClaims.materialization_permitted === false
  };

  const permitted = Object.values(checks).every(Boolean);
  const reasonCodes = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => `failed:${name}`);

  return {
    artifact_type: 'PoAICCRPPreMaterializationResult',
    artifact_version: '0.1-experimental',
    mode: 'dry_run_ci_only',
    decision_id: `urn:poai-ccrp:pre-materialization:${safeId(authorityVerification && authorityVerification.verification_id)}--${safeId(ccrpAdmission && ccrpAdmission.result_id)}`,
    evaluated_at: evaluatedAt,
    requested_action: requestedAction,
    requested_target: requestedTarget,
    policy_ref: {
      policy_id: materializationPolicy && materializationPolicy.policy_id,
      policy_version: materializationPolicy && materializationPolicy.policy_version,
      digest: policyDigest
    },
    authority_verification_ref: authorityVerification && authorityVerification.verification_id,
    ccrp_execution_admission_ref: ccrpAdmission && ccrpAdmission.result_id,
    ccrp_operation_ref: operation && operation.operation_id,
    decision: permitted ? 'permitted' : 'not_permitted',
    reason_codes: reasonCodes,
    checks,
    source_artifacts_preserved: true,
    claims: {
      poai_authority_input_established: checks.authority_result_valid && checks.authority_result_established && checks.issuer_entitlement_established && checks.materialization_authority_established && checks.authority_scope_exact && checks.authority_target_exact && checks.policy_binding_exact,
      ccrp_execution_admission_input_established: checks.ccrp_admission_valid && checks.ccrp_execution_admitted && checks.ccrp_current_owner_established && checks.ccrp_lease_established && checks.ccrp_operation_ref_exact && checks.ccrp_action_exact && checks.ccrp_target_exact && checks.ccrp_revision_binding_exact,
      pre_materialization_permit_established: permitted,
      materialization_permitted: permitted,
      materialization_event_recorded: false,
      successor_record_published: false,
      repository_mutation_performed: false,
      automatic_browser_action_performed: false,
      canonical_state_established: false,
      policy_relative_canonicality_established: false,
      universal_canonicality_established: false,
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

function validatePreMaterializationBoundary(result) {
  const errors = [];
  if (!result || result.artifact_type !== 'PoAICCRPPreMaterializationResult') errors.push('not_pre_materialization_result');
  if (!result || result.artifact_version !== '0.1-experimental') errors.push('wrong_artifact_version');
  if (!result || result.mode !== 'dry_run_ci_only') errors.push('wrong_mode');
  if (!result || result.source_artifacts_preserved !== true) errors.push('source_artifacts_not_preserved');

  const prohibitedTrue = [
    'materialization_event_recorded',
    'successor_record_published',
    'repository_mutation_performed',
    'automatic_browser_action_performed',
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

  for (const key of prohibitedTrue) {
    if (!result || !result.claims || result.claims[key] !== false) errors.push(`prohibited_claim:${key}`);
  }

  if (result && result.decision === 'permitted') {
    if (!result.claims || result.claims.pre_materialization_permit_established !== true) errors.push('permit_decision_without_permit_claim');
    if (!result.claims || result.claims.materialization_permitted !== true) errors.push('permit_decision_without_materialization_preflight_claim');
    if (!result.claims || result.claims.poai_authority_input_established !== true) errors.push('permit_without_poai_authority_input');
    if (!result.claims || result.claims.ccrp_execution_admission_input_established !== true) errors.push('permit_without_ccrp_admission_input');
    if (!Array.isArray(result.reason_codes) || result.reason_codes.length !== 0) errors.push('permitted_result_has_reasons');
  } else if (result) {
    if (!result.claims || result.claims.pre_materialization_permit_established !== false) errors.push('rejected_result_establishes_permit');
    if (!result.claims || result.claims.materialization_permitted !== false) errors.push('rejected_result_claims_materialization_permission');
    if (!Array.isArray(result.reason_codes) || result.reason_codes.length === 0) errors.push('rejected_result_missing_reason');
  }

  return errors;
}

module.exports = {
  evaluatePreMaterializationGate,
  validatePreMaterializationBoundary
};
