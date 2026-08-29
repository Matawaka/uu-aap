'use strict';
const assert = require('node:assert/strict');
const { carryPendingEffect, reconcilePendingEffect, authorizeRetry } = require('./pending-effect.js');

const carried = carryPendingEffect({
  effect_id: 'effect:1',
  target_ref: 'target:1',
  attempted_under_permit: 'permit:old',
  acknowledgement_state: 'UNKNOWN',
  predecessor_observed_at: '2026-08-29T15:00:00Z'
});
assert.equal(carried.retry_authorized, false);
assert.equal(carried.mutation_authority, false);
assert.equal(carried.carried_as_evidence_only, true);

for (const status of ['CONFIRMED','ABSENT','CONFLICT','UNKNOWN']) {
  const r = reconcilePendingEffect(carried, { status, observation_scope: 'read-only', evidence_refs: ['obs:1'] });
  assert.equal(r.retry_authorized, false);
  assert.equal(r.mutation_authority, false);
  assert.equal(r.fresh_action_authorization_required, true);
}

const absent = reconcilePendingEffect(carried, { status: 'ABSENT' });
assert.throws(() => authorizeRetry(absent, null), /fresh action authorization/);
assert.throws(() => authorizeRetry(absent, {type:'FRESH_ACTION_AUTHORIZATION', effect_id:'effect:other', authorization_id:'auth:1'}), /effect mismatch/);
const retry = authorizeRetry(absent, {type:'FRESH_ACTION_AUTHORIZATION', effect_id:'effect:1', authorization_id:'auth:1'});
assert.equal(retry.retry_authorized, true);
assert.equal(retry.predecessor_permit_reused, false);

assert.throws(() => carryPendingEffect({effect_id:'effect:2', acknowledgement_state:'ABSENT'}), /pending or unknown/);
console.log('pending effect tests: ok');
