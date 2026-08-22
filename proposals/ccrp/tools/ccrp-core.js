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

module.exports = {
  FALSE_C0_CLAIMS,
  clone,
  contextIdentityProjection,
  compareContextIdentity,
  validateC0Boundary
};
