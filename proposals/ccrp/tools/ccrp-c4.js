'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sorted(values) {
  return Array.isArray(values) ? [...values].sort() : [];
}

function sameArray(left, right) {
  return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

function sameOwner(left, right) {
  return !!left && !!right &&
    left.actor_id === right.actor_id &&
    left.session_id === right.session_id;
}

function sameIntent(left, right) {
  return !!left && !!right &&
    left.intent_id === right.intent_id &&
    left.intent_revision === right.intent_revision &&
    left.intent_digest === right.intent_digest;
}

function valueWithinScopes(value, scopes) {
  if (typeof value !== 'string') return false;
  return (Array.isArray(scopes) ? scopes : []).some((scope) =>
    value === scope || value.startsWith(`${scope}:`)
  );
}

function predecessorLeaseRef(state) {
  if (state && state.active_lease_ref) return state.active_lease_ref;
  const refs = state && Array.isArray(state.historical_lease_refs) ? state.historical_lease_refs : [];
  return refs.length > 0 ? refs[refs.length - 1] : null;
}

function intentFromWorkContext(workContext) {
  return {
    intent_id: workContext.intent.intent_id,
    intent_revision: workContext.intent.revision,
    intent_digest: workContext.intent.digest
  };
}

function stateId(contextId, epoch, status, suffix) {
  const safe = `${contextId}-${suffix || 'state'}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `urn:ccrp:coordination-state:${safe}:e${epoch}:${status}`;
}

function buildState({
  workContext,
  owner,
  epoch,
  fencingToken,
  status,
  activeLeaseRef,
  historicalLeaseRefs,
  operationScope,
  targetScope,
  lastCanonicalRevision,
  lastTransitionRef = null
}) {
  const currentOwner = status === 'active' && !!owner;
  return {
    artifact_type: 'CCRPCoordinationState',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C4',
    state_id: stateId(workContext.context_id, epoch, status, lastTransitionRef || 'initial'),
    context_id: workContext.context_id,
    origin_ref: {
      actor_id: workContext.origin.actor_id,
      session_id: workContext.origin.session_id
    },
    intent_ref: intentFromWorkContext(workContext),
    coordination_status: status,
    owner: owner ? clone(owner) : null,
    epoch,
    fencing_token: fencingToken,
    active_lease_ref: activeLeaseRef || null,
    historical_lease_refs: [...new Set(historicalLeaseRefs || [])],
    operation_scope: sorted(operationScope),
    target_scope: sorted(targetScope),
    last_canonical_revision: lastCanonicalRevision,
    last_transition_ref: lastTransitionRef,
    claims: {
      cross_context_coordination_state_established: true,
      pause_barrier_established: status === 'paused',
      current_execution_owner_established: currentOwner,
      execution_admitted: false,
      materialization_permitted: false,
      canonical_state_established: false,
      poai_authority_established: false,
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

function deriveC4State({ workContext, currentLease, lastCanonicalRevision }) {
  if (!workContext || workContext.artifact_type !== 'CCRPWorkContext') throw new Error('invalid_work_context');
  if (!currentLease || currentLease.artifact_type !== 'CCRPExecutionLease') throw new Error('invalid_current_lease');
  if (currentLease.context_ref.context_id !== workContext.context_id) throw new Error('lease_context_mismatch');
  if (!sameIntent(currentLease.context_ref, intentFromWorkContext(workContext))) throw new Error('lease_intent_mismatch');
  if (!valueWithinScopes(currentLease.target_scope[0], workContext.target_scope)) throw new Error('lease_target_outside_work_context');
  if (currentLease.status !== 'active') throw new Error('initial_lease_must_be_active');

  return buildState({
    workContext,
    owner: {
      actor_id: currentLease.context_ref.actor_id,
      session_id: currentLease.context_ref.session_id
    },
    epoch: currentLease.epoch,
    fencingToken: currentLease.fencing_token,
    status: 'active',
    activeLeaseRef: currentLease.lease_id,
    historicalLeaseRefs: [currentLease.lease_id],
    operationScope: currentLease.operation_scope,
    targetScope: currentLease.target_scope,
    lastCanonicalRevision
  });
}

function transitionErrors({ state, transition, currentRevision }) {
  const errors = [];
  if (!state || state.artifact_type !== 'CCRPCoordinationState' || state.conformance_level !== 'CCRP/C4') {
    return ['invalid_coordination_state'];
  }
  if (!transition || transition.artifact_type !== 'CCRPCoordinationTransition' || transition.conformance_level !== 'CCRP/C4') {
    return ['invalid_coordination_transition'];
  }
  if (transition.context_id !== state.context_id) errors.push('context_mismatch');
  if (!sameIntent(transition.intent_ref, state.intent_ref)) errors.push('intent_mismatch');
  if (!sameOwner(transition.from_owner, state.owner)) errors.push('from_owner_mismatch');
  if (transition.previous_epoch !== state.epoch) errors.push('previous_epoch_mismatch');
  if (transition.previous_fencing_token !== state.fencing_token) errors.push('previous_fencing_token_mismatch');
  if (transition.previous_lease_ref !== predecessorLeaseRef(state)) errors.push('previous_lease_mismatch');
  if (!sameArray(transition.operation_scope, state.operation_scope)) errors.push('operation_scope_change_not_permitted');
  if (!sameArray(transition.target_scope, state.target_scope)) errors.push('target_scope_change_not_permitted');
  if (transition.observed_current_revision !== currentRevision || state.last_canonical_revision !== currentRevision) {
    errors.push('current_revision_reread_required');
  }

  if (transition.transition_type === 'pause') {
    if (state.coordination_status !== 'active') errors.push('pause_requires_active_context');
    if (transition.to_owner !== null) errors.push('pause_must_not_assign_successor_owner');
  } else if (transition.transition_type === 'resume') {
    if (state.coordination_status !== 'paused') errors.push('resume_requires_paused_context');
    if (!transition.to_owner) errors.push('resume_requires_to_owner');
  } else if (transition.transition_type === 'handoff') {
    if (state.coordination_status !== 'active') errors.push('handoff_requires_active_context');
    if (!transition.to_owner) errors.push('handoff_requires_to_owner');
    if (transition.to_owner && sameOwner(transition.to_owner, transition.from_owner)) errors.push('handoff_requires_distinct_session_or_actor');
  } else {
    errors.push('unsupported_transition_type');
  }
  return [...new Set(errors)];
}

function makeSuccessorLease({ state, transition }) {
  const nextEpoch = state.epoch + 1;
  const nextToken = state.fencing_token + 1;
  const safeContext = state.context_id.replace(/[^a-zA-Z0-9._-]/g, '_');
  const issuedAt = transition.requested_at;
  const issuedMs = Date.parse(issuedAt);
  const expiresAt = Number.isFinite(issuedMs) ? new Date(issuedMs + 30 * 60 * 1000).toISOString() : issuedAt;
  const previousLease = predecessorLeaseRef(state);

  return {
    artifact_type: 'CCRPExecutionLease',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C2',
    lease_id: `urn:ccrp:lease:${safeContext}:e${nextEpoch}`,
    execution_lineage_id: transition.execution_lineage_id,
    context_ref: {
      context_id: state.context_id,
      actor_id: transition.to_owner.actor_id,
      session_id: transition.to_owner.session_id,
      intent_id: state.intent_ref.intent_id,
      intent_revision: state.intent_ref.intent_revision,
      intent_digest: state.intent_ref.intent_digest
    },
    epoch: nextEpoch,
    fencing_token: nextToken,
    operation_scope: sorted(state.operation_scope),
    target_scope: sorted(state.target_scope),
    issued_revision: state.last_canonical_revision,
    issued_at: issuedAt,
    expires_at: expiresAt,
    status: 'active',
    supersedes_lease_ref: previousLease,
    superseded_by_lease_ref: null,
    claims: {
      lease_established: true,
      current_execution_owner_established: true,
      execution_admitted: false,
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

function transitionResultId(transition) {
  const safe = String(transition && transition.transition_id || 'missing').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `urn:ccrp:coordination-transition-result:${safe}`;
}

function applyC4Transition({ state, transition, workContext, currentRevision }) {
  const reasons = transitionErrors({ state, transition, currentRevision });
  const onlyRevisionProblem = reasons.length > 0 && reasons.every((reason) => reason === 'current_revision_reread_required');
  const decision = reasons.length === 0 ? 'accepted' : (onlyRevisionProblem ? 'hold' : 'rejected');

  let nextState = clone(state);
  let successorLease = null;

  if (decision === 'accepted' && transition.transition_type === 'pause') {
    nextState = buildState({
      workContext,
      owner: state.owner,
      epoch: state.epoch,
      fencingToken: state.fencing_token,
      status: 'paused',
      activeLeaseRef: null,
      historicalLeaseRefs: [...state.historical_lease_refs, predecessorLeaseRef(state)].filter(Boolean),
      operationScope: state.operation_scope,
      targetScope: state.target_scope,
      lastCanonicalRevision: state.last_canonical_revision,
      lastTransitionRef: transition.transition_id
    });
  } else if (decision === 'accepted' && ['resume', 'handoff'].includes(transition.transition_type)) {
    successorLease = makeSuccessorLease({ state, transition });
    nextState = buildState({
      workContext,
      owner: transition.to_owner,
      epoch: successorLease.epoch,
      fencingToken: successorLease.fencing_token,
      status: 'active',
      activeLeaseRef: successorLease.lease_id,
      historicalLeaseRefs: [...state.historical_lease_refs, predecessorLeaseRef(state), successorLease.lease_id].filter(Boolean),
      operationScope: state.operation_scope,
      targetScope: state.target_scope,
      lastCanonicalRevision: state.last_canonical_revision,
      lastTransitionRef: transition.transition_id
    });
  }

  const successorEpoch = decision === 'accepted' && ['resume', 'handoff'].includes(transition.transition_type);
  return {
    artifact_type: 'CCRPCoordinationTransitionResult',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C4',
    result_id: transitionResultId(transition),
    transition_ref: transition && transition.transition_id,
    transition_type: transition && transition.transition_type,
    evaluated_at: transition && transition.requested_at,
    decision,
    reason_codes: reasons,
    previous_state_ref: state && state.state_id,
    next_state: nextState,
    successor_lease: successorLease,
    source_artifacts_preserved: true,
    claims: {
      transition_checked: true,
      pause_barrier_established: decision === 'accepted' && transition.transition_type === 'pause',
      resume_established: decision === 'accepted' && transition.transition_type === 'resume',
      handoff_established: decision === 'accepted' && transition.transition_type === 'handoff',
      successor_epoch_established: successorEpoch,
      current_execution_owner_established: decision === 'accepted' && nextState.coordination_status === 'active',
      context_admission_established: false,
      execution_admitted: false,
      materialization_permitted: false,
      canonical_state_established: false,
      poai_authority_established: false,
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

function evaluateC4ContextAdmission({ operation, presentedLease, state, workContext, currentRevision, evaluatedAt }) {
  const intent = intentFromWorkContext(workContext);
  const checks = {
    coordination_state_active: !!state && state.coordination_status === 'active',
    context_exact: !!operation && !!operation.context_ref && operation.context_ref.context_id === state.context_id && state.context_id === workContext.context_id,
    intent_exact: !!operation && !!operation.context_ref && sameIntent(operation.context_ref, state.intent_ref) && sameIntent(state.intent_ref, intent),
    owner_exact: !!operation && !!operation.context_ref && sameOwner({ actor_id: operation.context_ref.actor_id, session_id: operation.context_ref.session_id }, state.owner),
    lease_ref_exact: !!presentedLease && presentedLease.lease_id === state.active_lease_ref,
    lease_owner_exact: !!presentedLease && !!presentedLease.context_ref && sameOwner({ actor_id: presentedLease.context_ref.actor_id, session_id: presentedLease.context_ref.session_id }, state.owner),
    epoch_current: !!presentedLease && presentedLease.epoch === state.epoch,
    fencing_token_current: !!presentedLease && presentedLease.fencing_token === state.fencing_token,
    operation_scope_contained: !!operation && state.operation_scope.includes(operation.action),
    target_scope_contained: !!operation && valueWithinScopes(operation.target, state.target_scope),
    revision_current: !!operation && operation.base_revision === currentRevision && operation.observed_current_revision === currentRevision && state.last_canonical_revision === currentRevision
  };
  const reasons = [];
  const reasonMap = {
    coordination_state_active: 'context_paused_or_inactive',
    context_exact: 'context_mismatch',
    intent_exact: 'intent_mismatch',
    owner_exact: 'session_not_current_owner',
    lease_ref_exact: 'lease_not_current',
    lease_owner_exact: 'lease_owner_mismatch',
    epoch_current: 'stale_epoch',
    fencing_token_current: 'stale_fencing_token',
    operation_scope_contained: 'operation_outside_coordination_scope',
    target_scope_contained: 'target_outside_coordination_scope',
    revision_current: 'revision_reread_required'
  };
  for (const [key, ok] of Object.entries(checks)) if (!ok) reasons.push(reasonMap[key]);
  const admitted = Object.values(checks).every(Boolean);
  const safe = String(operation && operation.operation_id || 'missing').replace(/[^a-zA-Z0-9._-]/g, '_');
  return {
    artifact_type: 'CCRPContextAdmissionResult',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C4',
    result_id: `urn:ccrp:context-admission-result:${safe}`,
    evaluated_at: evaluatedAt,
    operation_ref: operation && operation.operation_id,
    coordination_state_ref: state && state.state_id,
    presented_lease_ref: presentedLease && presentedLease.lease_id,
    decision: admitted ? 'context_admitted' : 'not_admitted',
    reason_codes: [...new Set(reasons)],
    checks,
    source_artifacts_preserved: true,
    claims: {
      context_admission_established: admitted,
      current_execution_owner_established: !!state && state.coordination_status === 'active' && !!state.owner,
      lease_established: !!presentedLease,
      execution_admitted: false,
      materialization_permitted: false,
      canonical_state_established: false,
      poai_authority_established: false,
      historical_provenance_preserved: true,
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

const FORBIDDEN_C4_CLAIMS = [
  'execution_admitted',
  'materialization_permitted',
  'canonical_state_established',
  'poai_authority_established',
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

function validateC4Boundary(artifact) {
  const errors = [];
  if (!artifact || artifact.conformance_level !== 'CCRP/C4') errors.push('wrong_conformance_level');
  if (!artifact || !artifact.claims) errors.push('missing_claims');
  for (const claim of FORBIDDEN_C4_CLAIMS) {
    if (!artifact || !artifact.claims || artifact.claims[claim] !== false) errors.push(`c4_claim_must_remain_false:${claim}`);
  }
  if (artifact && artifact.source_artifacts_preserved !== undefined && artifact.source_artifacts_preserved !== true) {
    errors.push('source_artifacts_not_preserved');
  }
  return errors;
}

module.exports = {
  FORBIDDEN_C4_CLAIMS,
  clone,
  sameOwner,
  sameIntent,
  deriveC4State,
  applyC4Transition,
  evaluateC4ContextAdmission,
  validateC4Boundary
};
