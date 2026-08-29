'use strict';
const assert=require('node:assert/strict');
const {createProgressReceipt}=require('../../../protocols/experimental/perceived-causal-liveness/v0.1/progress.js');
const {konturProgressView}=require('./adapter.js');

const run={run_id:'kontur-run-2',run_epoch:2,state:'RUNNING',lease_expires_at:'2026-08-30T00:10:00Z',external_effect_authority:false};
const meaningful=createProgressReceipt({run_id:run.run_id,run_epoch:2,observed_at:'2026-08-29T19:00:00Z',current_phase:'OBSERVE_LOCAL_SESSION',progress_kind:'OBSERVATION_BOUND',waiting_on:'PLAYER_OR_GAME_EVENT',next_observable_event:'NEW_LOCAL_GAME_EVENT',checkpoint_ref:'checkpoint:2'});
const v=konturProgressView({session_id:'session:2',run,progress_receipt:meaningful});
assert.equal(v.meaningful_progress_confirmed,true);
assert.equal(v.last_confirmed_meaningful_progress_at,'2026-08-29T19:00:00Z');
assert.equal(v.hidden_reasoning_disclosed,false);
assert.equal(v.player_pressure_created,false);
assert.equal(v.engagement_objective_created,false);
assert.equal(v.external_effect_authority_created,false);
assert.equal(v.action_permit_created,false);

const heartbeat=createProgressReceipt({run_id:run.run_id,run_epoch:2,observed_at:'2026-08-29T19:01:00Z',current_phase:'OBSERVE_LOCAL_SESSION',progress_kind:'OBSERVATION_BOUND',waiting_on:'PLAYER_OR_GAME_EVENT',next_observable_event:'NEW_LOCAL_GAME_EVENT',checkpoint_ref:'checkpoint:2'}, meaningful);
assert.equal(heartbeat.meaningful_progress,false);
const h=konturProgressView({session_id:'session:2',run,progress_receipt:heartbeat});
assert.equal(h.heartbeat_only,true);
assert.equal(h.meaningful_progress_confirmed,false);
assert.equal(h.last_confirmed_meaningful_progress_at,null);

assert.throws(()=>konturProgressView({session_id:'session:2',run,progress_receipt:{...meaningful,run_epoch:1}}),/stale or foreign/);
assert.throws(()=>konturProgressView({session_id:'session:2',run,progress_receipt:{...meaningful,hidden_reasoning_disclosed:true}}),/hidden reasoning/);
assert.throws(()=>konturProgressView({session_id:'session:2',run,progress_receipt:meaningful,player_pressure:true}),/forbidden KONTUR/);
assert.throws(()=>konturProgressView({session_id:'session:2',run,progress_receipt:meaningful,engagement_objective:true}),/forbidden KONTUR/);
assert.throws(()=>konturProgressView({session_id:'session:2',run,progress_receipt:meaningful,mood_inference:true}),/forbidden KONTUR/);
assert.throws(()=>konturProgressView({session_id:'session:2',run,progress_receipt:meaningful,durable_profile:true}),/forbidden KONTUR/);
console.log('kontur pcl progress visibility tests: ok');
