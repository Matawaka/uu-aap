'use strict';

const RECONCILED = new Set(['CONFIRMED','ABSENT','CONFLICT','UNKNOWN']);

function carryPendingEffect(effect) {
  if (!effect || !effect.effect_id) throw new Error('effect_id required');
  if (!['PENDING','UNKNOWN'].includes(effect.acknowledgement_state)) throw new Error('pending or unknown acknowledgement required');
  return {
    effect_id: effect.effect_id,
    target_ref: effect.target_ref || null,
    attempted_under_permit: effect.attempted_under_permit || null,
    acknowledgement_state: effect.acknowledgement_state,
    predecessor_observed_at: effect.predecessor_observed_at || null,
    retry_authorized: false,
    mutation_authority: false,
    carried_as_evidence_only: true
  };
}

function reconcilePendingEffect(carried, observation) {
  if (!carried || carried.carried_as_evidence_only !== true) throw new Error('carried evidence required');
  if (!observation || !RECONCILED.has(observation.status)) throw new Error('valid reconciliation status required');
  return {
    effect_id: carried.effect_id,
    status: observation.status,
    observation_scope: observation.observation_scope || null,
    evidence_refs: Array.isArray(observation.evidence_refs) ? [...observation.evidence_refs] : [],
    retry_authorized: false,
    mutation_authority: false,
    fresh_action_authorization_required: true
  };
}

function authorizeRetry(reconciliation, authorization) {
  if (!reconciliation || reconciliation.fresh_action_authorization_required !== true) throw new Error('reconciliation required');
  if (!authorization || authorization.type !== 'FRESH_ACTION_AUTHORIZATION') throw new Error('fresh action authorization required');
  if (authorization.effect_id !== reconciliation.effect_id) throw new Error('authorization effect mismatch');
  if (!authorization.authorization_id) throw new Error('authorization_id required');
  return {
    effect_id: reconciliation.effect_id,
    retry_authorized: true,
    authorization_id: authorization.authorization_id,
    authorization_type: authorization.type,
    predecessor_permit_reused: false
  };
}

module.exports = { carryPendingEffect, reconcilePendingEffect, authorizeRetry, RECONCILED };
