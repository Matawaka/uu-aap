'use strict';

const TERMINAL=new Set(['TIMED_OUT_CLOSED','COMPLETED_CLOSED','CANCELLED_CLOSED']);
function humanLivenessView({run,progress_receipt=null,continuation_available=false}){
  if(!run||!run.run_id||!Number.isInteger(run.run_epoch)) throw Error('run identity required');
  const terminal=TERMINAL.has(run.state);
  const stalled=run.state==='SUSPECTED_STALL';
  const authority=run.external_effect_authority===true;
  const last=progress_receipt?.observed_at??null;
  let next_safe_action='WAIT_FOR_OBSERVABLE_PROGRESS';
  if(stalled) next_safe_action='OBSERVE_OR_REVALIDATE; NO_EXTERNAL_EFFECT';
  if(terminal&&continuation_available) next_safe_action='START_SUCCESSOR_FROM_CAPSULE; FRESH_AUTHORITY_REQUIRED';
  else if(terminal) next_safe_action='STOP; RUN_CLOSED';
  return {
    type:'HumanLivenessView',run_id:run.run_id,run_epoch:run.run_epoch,state:run.state,
    last_confirmed_progress_at:last,
    current_phase:progress_receipt?.current_phase??null,
    waiting_on:progress_receipt?.waiting_on??null,
    next_observable_event:progress_receipt?.next_observable_event??null,
    external_effect_authority:authority,
    terminal_state_certain:terminal,
    continuation_available:Boolean(continuation_available),
    next_safe_action,
    hidden_reasoning_disclosed:false
  };
}
module.exports={humanLivenessView};
