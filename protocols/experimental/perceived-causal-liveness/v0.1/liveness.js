'use strict';

const TERMINAL = new Set(['TIMED_OUT_CLOSED','COMPLETED_CLOSED','CANCELLED_CLOSED']);

function validateRunState(x){
  const fail=(m)=>{throw new Error(m)};
  if(!x || typeof x!=='object') fail('state required');
  if(!Number.isInteger(x.run_epoch) || x.run_epoch<0) fail('invalid run_epoch');
  if(!x.run_id) fail('run_id required');
  if(!['RUNNING','SUSPECTED_STALL','TIMED_OUT_CLOSED','COMPLETED_CLOSED','CANCELLED_CLOSED'].includes(x.state)) fail('invalid state');
  if(TERMINAL.has(x.state) && x.external_effect_authority!==false) fail('terminal run retains authority');
  if(x.state==='RUNNING' && !x.lease_expires_at) fail('live run requires lease');
  return true;
}

function transition(prev,next){
  validateRunState(prev); validateRunState(next);
  if(prev.run_id!==next.run_id) throw new Error('transition cannot change run_id');
  if(prev.run_epoch!==next.run_epoch) throw new Error('transition cannot change epoch');
  if(TERMINAL.has(prev.state)) throw new Error('terminal state cannot transition');
  const allowed={RUNNING:new Set(['RUNNING','SUSPECTED_STALL','COMPLETED_CLOSED','CANCELLED_CLOSED']),SUSPECTED_STALL:new Set(['RUNNING','TIMED_OUT_CLOSED','CANCELLED_CLOSED'])};
  if(!allowed[prev.state] || !allowed[prev.state].has(next.state)) throw new Error('illegal transition');
  return next;
}

function acceptLateResult(current,result){
  validateRunState(current);
  if(!result || !Number.isInteger(result.run_epoch)) throw new Error('late result epoch required');
  if(result.run_epoch<current.run_epoch) return {accepted_as_active:false,reason:'STALE_EPOCH'};
  if(TERMINAL.has(current.state)) return {accepted_as_active:false,reason:'RUN_CLOSED'};
  return {accepted_as_active:true,reason:'CURRENT_LIVE_EPOCH'};
}

function successorCapsule(closedRun,checkpoint){
  validateRunState(closedRun);
  if(!TERMINAL.has(closedRun.state)) throw new Error('predecessor must be closed');
  return {predecessor_run_id:closedRun.run_id,predecessor_epoch:closedRun.run_epoch,terminal_reason:closedRun.state,last_checkpoint:checkpoint||null,transfers_authority:false,hidden_reasoning_transferred:false};
}

module.exports={validateRunState,transition,acceptLateResult,successorCapsule,TERMINAL};
