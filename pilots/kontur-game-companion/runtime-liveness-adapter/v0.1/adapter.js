'use strict';

const {
  validateRunState,
  transition,
  successorCapsule,
} = require('../../../../protocols/experimental/perceived-causal-liveness/v0.1/liveness.js');

function closeForDeliberatePause(activeRun, checkpoint = null) {
  validateRunState(activeRun);
  if (!['RUNNING', 'SUSPECTED_STALL'].includes(activeRun.state)) {
    throw new Error('deliberate pause requires a live non-terminal run');
  }

  const closed = {
    ...activeRun,
    state: 'CANCELLED_CLOSED',
    external_effect_authority: false,
  };
  transition(activeRun, closed);

  const capsule = successorCapsule(closed, checkpoint);
  return {
    type: 'KonturDeliberatePauseClosureReceipt',
    closure_cause: 'DELIBERATE_SESSION_PAUSE',
    predecessor: closed,
    continuation_capsule: capsule,
    suspected_stall_inferred: false,
    background_activity_authorized: false,
    authority_restorable: false,
  };
}

function createFreshResumeSuccessor(pauseReceipt, candidate) {
  if (!pauseReceipt || pauseReceipt.type !== 'KonturDeliberatePauseClosureReceipt') {
    throw new Error('valid deliberate pause receipt required');
  }
  const predecessor = pauseReceipt.predecessor;
  validateRunState(predecessor);
  if (predecessor.state !== 'CANCELLED_CLOSED') {
    throw new Error('predecessor must remain terminally closed');
  }
  if (!candidate || !candidate.run_id || candidate.run_id === predecessor.run_id) {
    throw new Error('resume requires a fresh run_id');
  }
  if (!Number.isInteger(candidate.run_epoch) || candidate.run_epoch <= predecessor.run_epoch) {
    throw new Error('resume requires a strictly newer run_epoch');
  }

  const successor = {
    run_id: candidate.run_id,
    run_epoch: candidate.run_epoch,
    state: 'RUNNING',
    lease_expires_at: candidate.lease_expires_at,
    external_effect_authority: false,
  };
  validateRunState(successor);

  return {
    type: 'KonturFreshResumeSuccessorReceipt',
    predecessor_run_id: predecessor.run_id,
    predecessor_epoch: predecessor.run_epoch,
    successor,
    continuation_capsule: pauseReceipt.continuation_capsule,
    checkpoint_reused: pauseReceipt.continuation_capsule.last_checkpoint || null,
    predecessor_authority_inherited: false,
    prior_help_intent_inherited: false,
    background_activity_authorized: false,
    action_permit_created: false,
  };
}

module.exports = { closeForDeliberatePause, createFreshResumeSuccessor };
