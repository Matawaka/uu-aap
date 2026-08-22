'use strict';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedScope(scope) {
  return Array.isArray(scope) ? [...scope].sort() : [];
}

function contextIdentityProjection(context) {
  return {
    context_id: context && context.context_id,
    origin_actor_id: context && context.origin && context.origin.actor_id,
    origin_session_id: context && context.origin && context.origin.session_id,
    intent_id: context && context.intent && context.intent.intent_id,
    intent_revision: context && context.intent && context.intent.revision,
    intent_digest: context && context.intent && context.intent.digest,
    target_scope: normalizedScope(context && context.target_scope)
  };
}

function compareContextIdentity(left, right) {
  const a = contextIdentityProjection(left);
  const b = contextIdentityProjection(right);

  if (!a.context_id || !b.context_id) {
    return {
      relation: 'invalid_context_identity',
      compatible: false,
      errors: ['missing_context_id']
    };
  }

  if (a.context_id !== b.context_id) {
    return {
      relation: 'distinct_contexts',
      compatible: true,
      same_actor: a.origin_actor_id === b.origin_actor_id,
      same_session: a.origin_session_id === b.origin_session_id,
      same_target_scope: JSON.stringify(a.target_scope) === JSON.stringify(b.target_scope),
      errors: []
    };
  }

  const mismatches = [];
  const fields = [
    'origin_actor_id',
    'origin_session_id',
    'intent_id',
    'intent_revision',
    'intent_digest'
  ];

  for (const field of fields) {
    if (a[field] !== b[field]) mismatches.push(field);
  }

  if (JSON.stringify(a.target_scope) !== JSON.stringify(b.target_scope)) {
    mismatches.push('target_scope');
  }

  if (mismatches.length > 0) {
    return {
      relation: 'context_identity_reuse_conflict',
      compatible: false,
      mismatches,
      errors: ['context_identity_reuse_mismatch']
    };
  }

  return {
    relation: 'same_context_identity',
    compatible: true,
    mismatches: [],
    errors: []
  };
}

const FALSE_C0_CLAIMS = [
  'execution_admitted',
  'current_execution_owner_established',
  'lease_established',
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

function validateC0Boundary(context) {
  const errors = [];

  if (!context || context.artifact_type !== 'CCRPWorkContext') errors.push('not_ccrp_work_context');
  if (!context || context.conformance_level !== 'CCRP/C0') errors.push('wrong_conformance_level');
  if (!context || context.state !== 'declared') errors.push('c0_state_must_be_declared');
  if (!context || context.owner !== null) errors.push('c0_owner_must_be_unestablished');
  if (!context || context.lease !== null) errors.push('c0_lease_must_be_unestablished');
  if (!context || !Array.isArray(context.blocking_conflicts) || context.blocking_conflicts.length !== 0) {
    errors.push('c0_blocking_conflicts_must_be_empty');
  }
  if (!context || !context.claims || context.claims.context_identified !== true) {
    errors.push('context_identified_not_declared');
  }

  for (const claim of FALSE_C0_CLAIMS) {
    if (!context || !context.claims || context.claims[claim] !== false) {
      errors.push(`c0_claim_must_remain_false:${claim}`);
    }
  }

  return errors;
}

const FALSE_C1_INTENT_CLAIMS = [
  'collision_checked',
  'execution_admitted',
  'current_execution_owner_established',
  'lease_established',
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

const FALSE_C1_RESULT_CLAIMS = [
  'collision_resolved',
  'execution_admitted',
  'current_execution_owner_established',
  'lease_established',
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

function validateC1IntentBoundary(operation) {
  const errors = [];
  if (!operation || operation.artifact_type !== 'CCRPOperationIntent') errors.push('not_ccrp_operation_intent');
  if (!operation || operation.conformance_level !== 'CCRP/C1') errors.push('wrong_conformance_level');
  if (!operation || !operation.claims || operation.claims.context_bound !== true) {
    errors.push('context_bound_not_declared');
  }
  for (const claim of FALSE_C1_INTENT_CLAIMS) {
    if (!operation || !operation.claims || operation.claims[claim] !== false) {
      errors.push(`c1_intent_claim_must_remain_false:${claim}`);
    }
  }
  return errors;
}

function findContext(contexts, contextId) {
  return (Array.isArray(contexts) ? contexts : []).find((item) => item && item.context_id === contextId) || null;
}

function contextBindingErrors(operation, contexts) {
  if (!operation || !operation.context_ref) return ['missing_context_ref'];
  const ref = operation.context_ref;
  const context = findContext(contexts, ref.context_id);
  if (!context) return ['unknown_context'];

  const identity = contextIdentityProjection(context);
  const expected = {
    origin_actor_id: ref.actor_id,
    origin_session_id: ref.session_id,
    intent_id: ref.intent_id,
    intent_revision: ref.intent_revision,
    intent_digest: ref.intent_digest
  };

  const errors = [];
  for (const [field, value] of Object.entries(expected)) {
    if (identity[field] !== value) errors.push(`context_binding_mismatch:${field}`);
  }

  const scopes = normalizedScope(context.target_scope);
  if (!scopes.some((scope) => typeof operation.target === 'string' && operation.target.startsWith(scope))) {
    errors.push('target_outside_context_scope');
  }
  return errors;
}

function setsOverlap(left, right) {
  const rightSet = new Set(Array.isArray(right) ? right : []);
  return (Array.isArray(left) ? left : []).some((value) => rightSet.has(value));
}

function resultId(type, operations) {
  const suffix = operations
    .filter(Boolean)
    .map((operation) => String(operation.operation_id || 'missing').replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join('--');
  return `urn:ccrp:collision-result:${type}:${suffix || 'none'}`;
}

function buildC1CollisionResult(type, operations, currentRevision, reasonCodes, evaluatedAt) {
  const collisionDetected = type !== 'no_collision';
  const refs = [...new Set(operations.filter(Boolean).map((operation) => operation.operation_id))];
  return {
    artifact_type: 'CCRPCollisionResult',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C1',
    result_id: resultId(type, operations),
    evaluated_at: evaluatedAt || new Date().toISOString(),
    operation_refs: refs,
    current_revision: currentRevision,
    collision_type: type,
    blocking: collisionDetected,
    reason_codes: [...new Set(reasonCodes || [])],
    source_intents_preserved: true,
    resolution_status: collisionDetected ? 'unresolved' : 'not_required',
    claims: {
      collision_checked: true,
      collision_detected: collisionDetected,
      collision_resolved: false,
      execution_admitted: false,
      current_execution_owner_established: false,
      lease_established: false,
      materialization_permitted: false,
      canonical_state_established: false,
      poai_authority_established: false,
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

function detectC1Collision({
  operation,
  peerOperation = null,
  contexts = [],
  currentRevision,
  seenIdempotencyKeys = [],
  evaluatedAt
}) {
  const operations = [operation, peerOperation].filter(Boolean);
  const primaryBinding = contextBindingErrors(operation, contexts);
  if (primaryBinding.length > 0) {
    return buildC1CollisionResult('wrong_context', operations, currentRevision, primaryBinding, evaluatedAt);
  }

  if (peerOperation) {
    const peerBinding = contextBindingErrors(peerOperation, contexts);
    if (peerBinding.length > 0) {
      return buildC1CollisionResult('wrong_context', operations, currentRevision, peerBinding, evaluatedAt);
    }
  }

  const seen = new Set(seenIdempotencyKeys);
  if (seen.has(operation.idempotency_key) ||
      (peerOperation && operation.idempotency_key === peerOperation.idempotency_key)) {
    return buildC1CollisionResult(
      'duplicate_operation',
      operations,
      currentRevision,
      ['idempotency_key_already_observed'],
      evaluatedAt
    );
  }

  const stale = operations.filter((item) =>
    item.base_revision !== currentRevision || item.observed_current_revision !== currentRevision
  );
  if (stale.length > 0) {
    return buildC1CollisionResult(
      'stale_base',
      operations,
      currentRevision,
      ['relevant_revision_changed'],
      evaluatedAt
    );
  }

  if (peerOperation) {
    const exclusive = operation.concurrency_class === 'exclusive' && peerOperation.concurrency_class === 'exclusive';
    const overlaps = operation.target === peerOperation.target || setsOverlap(operation.write_set, peerOperation.write_set);
    if (exclusive && overlaps) {
      return buildC1CollisionResult(
        'exclusive_operation_collision',
        operations,
        currentRevision,
        ['exclusive_write_scope_overlap'],
        evaluatedAt
      );
    }
  }

  return buildC1CollisionResult('no_collision', operations, currentRevision, [], evaluatedAt);
}

function validateC1ResultBoundary(result) {
  const errors = [];
  if (!result || result.artifact_type !== 'CCRPCollisionResult') errors.push('not_ccrp_collision_result');
  if (!result || result.conformance_level !== 'CCRP/C1') errors.push('wrong_conformance_level');
  if (!result || result.source_intents_preserved !== true) errors.push('source_intents_not_preserved');
  if (!result || !result.claims || result.claims.collision_checked !== true) errors.push('collision_not_checked');

  for (const claim of FALSE_C1_RESULT_CLAIMS) {
    if (!result || !result.claims || result.claims[claim] !== false) {
      errors.push(`c1_result_claim_must_remain_false:${claim}`);
    }
  }

  if (result && result.collision_type === 'no_collision') {
    if (result.blocking !== false) errors.push('no_collision_must_not_block');
    if (!result.claims || result.claims.collision_detected !== false) errors.push('no_collision_detected_must_be_false');
    if (result.resolution_status !== 'not_required') errors.push('no_collision_resolution_not_required');
  } else if (result) {
    if (result.blocking !== true) errors.push('collision_must_block_c1');
    if (!result.claims || result.claims.collision_detected !== true) errors.push('collision_detected_must_be_true');
    if (result.resolution_status !== 'unresolved') errors.push('c1_collision_must_remain_unresolved');
  }

  return errors;
}

module.exports = {
  FALSE_C0_CLAIMS,
  FALSE_C1_INTENT_CLAIMS,
  FALSE_C1_RESULT_CLAIMS,
  clone,
  contextIdentityProjection,
  compareContextIdentity,
  validateC0Boundary,
  validateC1IntentBoundary,
  contextBindingErrors,
  detectC1Collision,
  validateC1ResultBoundary
};
