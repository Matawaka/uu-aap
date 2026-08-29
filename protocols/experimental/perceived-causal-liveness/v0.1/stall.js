'use strict';

function ms(iso){const t=Date.parse(iso);if(Number.isNaN(t))throw Error('invalid time');return t;}
function evaluateLiveness({state,now,last_meaningful_progress_at,suspect_after_ms,close_after_ms}){
  if(!['RUNNING','SUSPECTED_STALL'].includes(state))throw Error('live state required');
  if(!Number.isInteger(suspect_after_ms)||suspect_after_ms<1)throw Error('suspect_after_ms required');
  if(!Number.isInteger(close_after_ms)||close_after_ms<=suspect_after_ms)throw Error('close_after_ms must exceed suspect_after_ms');
  const age=ms(now)-ms(last_meaningful_progress_at);if(age<0)throw Error('time reversal');
  if(age>=close_after_ms)return{next_state:'TIMED_OUT_CLOSED',external_effect_authority:false,reason:'MEANINGFUL_PROGRESS_TIMEOUT',last_progress_age_ms:age};
  if(age>=suspect_after_ms)return{next_state:'SUSPECTED_STALL',external_effect_authority:false,reason:'MEANINGFUL_PROGRESS_STALE',last_progress_age_ms:age};
  return{next_state:'RUNNING',external_effect_authority:true,reason:'WITHIN_PROGRESS_WINDOW',last_progress_age_ms:age};
}
function recoverFromSuspectedStall(progressReceipt){
  if(!progressReceipt||progressReceipt.meaningful_progress!==true)return{recover:false,reason:'NO_MEANINGFUL_PROGRESS'};
  return{
    recover:true,
    next_state:'RUNNING',
    external_effect_authority:false,
    authority_revalidation_required:true,
    reason:'MEANINGFUL_PROGRESS_OBSERVED_AUTHORITY_STILL_SUSPENDED'
  };
}
module.exports={evaluateLiveness,recoverFromSuspectedStall};
