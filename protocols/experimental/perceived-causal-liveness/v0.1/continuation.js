'use strict';

const TERMINAL = new Set(['TIMED_OUT_CLOSED','COMPLETED_CLOSED','CANCELLED_CLOSED']);

function checkpointCommit({run_id,run_epoch,committed_at,intent_ref,constraints=[],completed_observations=[],completed_subresults=[],remaining_work=[],pending_dependencies=[]}){
  if(!run_id||!Number.isInteger(run_epoch)||run_epoch<0) throw Error('run identity required');
  if(!committed_at||!intent_ref) throw Error('checkpoint provenance required');
  return {
    run_id,run_epoch,committed_at,intent_ref,
    constraints:[...constraints],
    completed_observations:[...completed_observations],
    completed_subresults:[...completed_subresults],
    remaining_work:[...remaining_work],
    pending_dependencies:[...pending_dependencies],
    hidden_reasoning_included:false,
    authority_included:false
  };
}

function continuationCapsule({closed_run,checkpoint}){
  if(!closed_run||!TERMINAL.has(closed_run.state)) throw Error('closed predecessor required');
  if(!checkpoint||checkpoint.run_id!==closed_run.run_id||checkpoint.run_epoch!==closed_run.run_epoch) throw Error('checkpoint predecessor mismatch');
  if(checkpoint.hidden_reasoning_included!==false||checkpoint.authority_included!==false) throw Error('non-transferable state present');
  return {
    predecessor_run_id:closed_run.run_id,
    predecessor_epoch:closed_run.run_epoch,
    predecessor_terminal_state:closed_run.state,
    checkpoint,
    transfers_hidden_reasoning:false,
    transfers_authority:false,
    successor_authority_required:true
  };
}

function materializeSuccessor({capsule,successor_run_id,successor_epoch,new_lease_expires_at}){
  if(!capsule||!capsule.predecessor_run_id) throw Error('capsule required');
  if(!successor_run_id||successor_run_id===capsule.predecessor_run_id) throw Error('successor requires new run_id');
  if(!Number.isInteger(successor_epoch)||successor_epoch<=capsule.predecessor_epoch) throw Error('successor epoch must advance');
  if(!new_lease_expires_at) throw Error('fresh lease required');
  return {
    run_id:successor_run_id,
    run_epoch:successor_epoch,
    state:'RUNNING',
    lease_expires_at:new_lease_expires_at,
    inherited_checkpoint:capsule.checkpoint,
    external_effect_authority:false,
    authority_revalidation_required:true,
    predecessor_run_id:capsule.predecessor_run_id,
    predecessor_epoch:capsule.predecessor_epoch
  };
}

module.exports={checkpointCommit,continuationCapsule,materializeSuccessor};
