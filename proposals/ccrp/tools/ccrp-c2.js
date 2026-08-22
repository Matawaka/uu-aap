'use strict';

function asTime(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : NaN;
}

function sameContextBinding(operation, lease) {
  if (!operation || !operation.context_ref || !lease || !lease.context_ref) return false;
  const op = operation.context_ref;
  const ref = lease.context_ref;
  return op.context_id === ref.context_id &&
    op.actor_id === ref.actor_id &&
    op.session_id === ref.session_id &&
    op.intent_id === ref.intent_id &&
    op.intent_revision === ref.intent_revision &&
    op.intent_digest === ref.intent_digest;
}

function valueWithinScopes(value, scopes) {
  if (typeof value !== 'string') return false;
  return (Array.isArray(scopes) ? scopes : []).some((scope) =>
    value === scope || value.startsWith(`${scope}:`)
  );
}

function leaseTimeValid(lease, evaluatedAt) {
  if (!lease) return false;
  const now = asTime(evaluatedAt);
  const start = asTime(lease.issued_at);
  const end = asTime(lease.expires_at);
  if (![now, start, end].every(Number.isFinite)) return false;
  return now >= start && now < end;
}

function isLeaseArtifact(lease) {
  return !!lease &&
    lease.artifact_type === 'CCRPExecutionLease' &&
    lease.conformance_level === 'CCRP/C2';
}

function collisionClearsOperation(collisionResult, operation) {
  if (!collisionResult || !operation) return false;
  return collisionResult.artifact_type === 'CCRPCollisionResult' &&
    collisionResult.conformance_level === 'CCRP/C1' &&
    collisionResult.collision_type === 'no_collision' &&
    collisionResult.blocking === false &&
    Array.isArray(collisionResult.operation_refs) &&
    collisionResult.operation_refs.includes(operation.operation_id);
}

function resultId(operation, currentLease) {
  const op = String(operation && operation.operation_id || 'missing-operation').replace(/[^a-zA-Z0-9._-]/g, '_');
  const lease = String(currentLease && currentLease.lease_id || 'missing-lease').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `urn:ccrp:execution-admission-result:${op}--${lease}`;
}

function evaluateC2ExecutionAdmission({
  operation,
  presentedLease,
  currentLease,
  collisionResult,
  currentRevision,
  evaluatedAt
}) {
  const presentedLeaseValidArtifact = isLeaseArtifact(presentedLease);
  const currentLeaseValidArtifact = isLeaseArtifact(currentLease);
  const presentedLeaseBindsOperation = presentedLeaseValidArtifact && sameContextBinding(operation, presentedLease);
  const currentLeaseBindsOperation = currentLeaseValidArtifact && sameContextBinding(operation, currentLease);
  const sameExecutionLineage = presentedLeaseValidArtifact && currentLeaseValidArtifact &&
    presentedLease.execution_lineage_id === currentLease.execution_lineage_id;
  const epochCurrent = presentedLeaseValidArtifact && currentLeaseValidArtifact &&
    presentedLease.epoch === currentLease.epoch;
  const fencingTokenCurrent = presentedLeaseValidArtifact && currentLeaseValidArtifact &&
    presentedLease.fencing_token === currentLease.fencing_token;
  const presentedLeaseActive = presentedLeaseValidArtifact && presentedLease.status === 'active';
  const currentLeaseActive = currentLeaseValidArtifact && currentLease.status === 'active';
  const presentedLeaseUnexpired = presentedLeaseValidArtifact && leaseTimeValid(presentedLease, evaluatedAt);
  const currentLeaseUnexpired = currentLeaseValidArtifact && leaseTimeValid(currentLease, evaluatedAt);
  const actionInScope = currentLeaseValidArtifact &&
    Array.isArray(currentLease.operation_scope) && currentLease.operation_scope.includes(operation && operation.action);
  const targetInScope = currentLeaseValidArtifact && valueWithinScopes(operation && operation.target, currentLease.target_scope);
  const collisionClear = collisionClearsOperation(collisionResult, operation);
  const revisionCurrent = !!operation &&
    operation.base_revision === currentRevision &&
    operation.observed_current_revision === currentRevision;

  const checks = {
    presented_lease_binds_operation: presentedLeaseBindsOperation,
    current_lease_binds_operation: currentLeaseBindsOperation,
    same_execution_lineage: sameExecutionLineage,
    epoch_current: epochCurrent,
    fencing_token_current: fencingTokenCurrent,
    presented_lease_active: presentedLeaseActive,
    current_lease_active: currentLeaseActive,
    presented_lease_unexpired: presentedLeaseUnexpired,
    current_lease_unexpired: currentLeaseUnexpired,
    action_in_scope: actionInScope,
    target_in_scope: targetInScope,
    collision_clear: collisionClear,
    revision_current: revisionCurrent
  };

  const reasons = [];
  if (!presentedLeaseValidArtifact) reasons.push('invalid_presented_lease');
  if (!currentLeaseValidArtifact) reasons.push('invalid_current_lease');
  if (!presentedLeaseBindsOperation) reasons.push('presented_lease_does_not_bind_operation');
  if (!currentLeaseBindsOperation) reasons.push('operation_not_owned_by_current_lease');
  if (!sameExecutionLineage) reasons.push('execution_lineage_mismatch');
  if (!epochCurrent) reasons.push('stale_epoch');
  if (!fencingTokenCurrent) reasons.push('stale_fencing_token');
  if (!presentedLeaseActive) reasons.push('presented_lease_not_active');
  if (!currentLeaseActive) reasons.push('current_lease_not_active');
  if (!presentedLeaseUnexpired) reasons.push('presented_lease_expired_or_not_yet_valid');
  if (!currentLeaseUnexpired) reasons.push('current_lease_expired_or_not_yet_valid');
  if (!actionInScope) reasons.push('action_outside_lease_scope');
  if (!targetInScope) reasons.push('target_outside_lease_scope');
  if (!collisionClear) reasons.push('collision_not_clear');
  if (!revisionCurrent) reasons.push('revision_not_current');

  const admitted = Object.values(checks).every(Boolean);
  const currentOwnerEstablished = currentLeaseValidArtifact && currentLeaseActive && currentLeaseUnexpired;

  return {
    artifact_type: 'CCRPExecutionAdmissionResult',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C2',
    result_id: resultId(operation, currentLease),
    evaluated_at: evaluatedAt,
    operation_ref: operation && operation.operation_id,
    presented_lease_ref: presentedLease && presentedLease.lease_id,
    current_lease_ref: currentLease && currentLease.lease_id,
    collision_result_ref: collisionResult && collisionResult.result_id || null,
    current_revision: currentRevision,
    current_epoch: currentLease && currentLease.epoch,
    current_fencing_token: currentLease && currentLease.fencing_token,
    decision: admitted ? 'admitted' : 'not_admitted',
    reason_codes: [...new Set(reasons)],
    checks,
    source_artifacts_preserved: true,
    claims: {
      execution_admitted: admitted,
      current_execution_owner_established: currentOwnerEstablished,
      lease_established: currentLeaseValidArtifact,
      materialization_permitted: false,
      canonical_state_established: false,
      poai_authority_established: false,
      historical_provenance_preserved: true,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    }
  };
}

const FALSE_C2_ASSURANCE_CLAIMS = [
  'materialization_permitted',
  'canonical_state_established',
  'poai_authority_established',
  'universal_canonicality_established',
  'truth_certified',
  'causal_proof_certified',
  'legal_responsibility_determined',
  'moral_correctness_established',
  'legal_effect_established',
  'poai_v_conformance_established'
];

function validateC2AdmissionBoundary(result) {
  const errors = [];
  if (!result || result.artifact_type !== 'CCRPExecutionAdmissionResult') errors.push('not_ccrp_execution_admission_result');
  if (!result || result.conformance_level !== 'CCRP/C2') errors.push('wrong_conformance_level');
  if (!result || result.source_artifacts_preserved !== true) errors.push('source_artifacts_not_preserved');
  if (!result || !result.claims || result.claims.historical_provenance_preserved !== true) {
    errors.push('historical_provenance_not_preserved');
  }
  for (const claim of FALSE_C2_ASSURANCE_CLAIMS) {
    if (!result || !result.claims || result.claims[claim] !== false) {
      errors.push(`c2_claim_must_remain_false:${claim}`);
    }
  }
  if (result && result.decision === 'admitted') {
    if (!result.claims || result.claims.execution_admitted !== true) errors.push('admitted_result_must_establish_execution_admission');
    if (!result.claims || result.claims.current_execution_owner_established !== true) errors.push('admitted_result_requires_current_owner');
    if (!result.claims || result.claims.lease_established !== true) errors.push('admitted_result_requires_lease');
    if (!Array.isArray(result.reason_codes) || result.reason_codes.length !== 0) errors.push('admitted_result_must_have_no_reasons');
  } else if (result) {
    if (!result.claims || result.claims.execution_admitted !== false) errors.push('rejected_result_must_not_admit_execution');
    if (!Array.isArray(result.reason_codes) || result.reason_codes.length === 0) errors.push('rejected_result_requires_reason');
  }
  return errors;
}

module.exports = {
  FALSE_C2_ASSURANCE_CLAIMS,
  sameContextBinding,
  leaseTimeValid,
  collisionClearsOperation,
  evaluateC2ExecutionAdmission,
  validateC2AdmissionBoundary
};
