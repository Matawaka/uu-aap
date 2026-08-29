'use strict';
const {humanLivenessView}=require('../../../protocols/experimental/perceived-causal-liveness/v0.1/human-view.js');

function validateProgressReceipt(r){
  if(r==null) return true;
  if(r.type!=='ProgressReceipt') throw Error('ProgressReceipt required');
  if(!r.run_id||!Number.isInteger(r.run_epoch)) throw Error('progress run identity required');
  if(r.hidden_reasoning_disclosed!==false) throw Error('hidden reasoning disclosure forbidden');
  if(r.external_effect_authority_created!==false) throw Error('progress cannot create authority');
  return true;
}

function konturProgressView({session_id,run,progress_receipt=null,continuation_available=false,player_pressure=false,engagement_objective=false,mood_inference=false,durable_profile=false}){
  if(!session_id) throw Error('session_id required');
  validateProgressReceipt(progress_receipt);
  if(progress_receipt && (progress_receipt.run_id!==run.run_id || progress_receipt.run_epoch!==run.run_epoch)) throw Error('stale or foreign progress receipt');
  if(player_pressure||engagement_objective||mood_inference||durable_profile) throw Error('forbidden KONTUR liveness use');
  const base=humanLivenessView({run,progress_receipt,continuation_available});
  const meaningful=progress_receipt?.meaningful_progress===true;
  return {
    type:'KONTURProgressVisibilityView',
    session_id,
    run_id:base.run_id,
    run_epoch:base.run_epoch,
    state:base.state,
    current_phase:base.current_phase,
    waiting_on:base.waiting_on,
    next_observable_event:base.next_observable_event,
    next_safe_action:base.next_safe_action,
    checkpoint_ref:progress_receipt?.checkpoint_ref??null,
    last_confirmed_meaningful_progress_at:meaningful?(progress_receipt?.observed_at??null):null,
    meaningful_progress_confirmed:meaningful,
    heartbeat_only:progress_receipt?progress_receipt.meaningful_progress===false:false,
    terminal_state_certain:base.terminal_state_certain,
    continuation_available:base.continuation_available,
    hidden_reasoning_disclosed:false,
    player_pressure_created:false,
    engagement_objective_created:false,
    mood_inference_created:false,
    durable_profile_created:false,
    external_effect_authority_created:false,
    action_permit_created:false
  };
}

module.exports={konturProgressView,validateProgressReceipt};
