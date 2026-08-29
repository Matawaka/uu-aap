'use strict';

const assert = require('node:assert/strict');
const { acceptLateResult } = require('../../../../protocols/experimental/perceived-causal-liveness/v0.1/liveness.js');
const { closeForDeliberatePause, createFreshResumeSuccessor } = require('./adapter.js');

const active = {
  run_id: 'kontur-run-10',
  run_epoch: 10,
  state: 'RUNNING',
  lease_expires_at: '2026-08-30T00:30:00+05:00',
  external_effect_authority: false,
};

const pause = closeForDeliberatePause(active, { conversation_thread: 'local-thread-7', provenance_ref: 'receipt-42' });
assert.equal(pause.predecessor.state, 'CANCELLED_CLOSED');
assert.equal(pause.closure_cause, 'DELIBERATE_SESSION_PAUSE');
assert.equal(pause.suspected_stall_inferred, false);
assert.equal(pause.background_activity_authorized, false);
assert.equal(pause.authority_restorable, false);
assert.equal(pause.continuation_capsule.transfers_authority, false);
assert.equal(acceptLateResult(pause.predecessor, { run_epoch: 10 }).accepted_as_active, false);

const resumed = createFreshResumeSuccessor(pause, {
  run_id: 'kontur-run-11',
  run_epoch: 11,
  lease_expires_at: '2026-08-30T01:00:00+05:00',
});
assert.equal(resumed.successor.state, 'RUNNING');
assert.equal(resumed.successor.external_effect_authority, false);
assert.equal(resumed.predecessor_authority_inherited, false);
assert.equal(resumed.prior_help_intent_inherited, false);
assert.equal(resumed.action_permit_created, false);
assert.equal(resumed.checkpoint_reused.conversation_thread, 'local-thread-7');

assert.throws(() => createFreshResumeSuccessor(pause, {
  run_id: 'kontur-run-10', run_epoch: 11, lease_expires_at: 'x',
}));
assert.throws(() => createFreshResumeSuccessor(pause, {
  run_id: 'kontur-run-12', run_epoch: 10, lease_expires_at: 'x',
}));
assert.throws(() => closeForDeliberatePause(pause.predecessor));

console.log('KONTUR PCL pause-resume adapter v0.1: ok');
