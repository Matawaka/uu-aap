'use strict';

function acceptanceReceipt(evidence){
  const required=['progress_without_hidden_reasoning','stall_distinguishable','irreversible_timeout','closed_run_no_authority','late_result_rejected','successor_from_capsule','human_view_last_progress_and_next_safe_action'];
  const criteria=Object.fromEntries(required.map(k=>[k,evidence?.[k]===true]));
  const passed=required.every(k=>criteria[k]);
  return {type:'PerceivedCausalLivenessAcceptanceReceipt',criteria,passed,production_ui_proven:false,production_timeout_policy_activated:false,release_authority_created:false};
}
module.exports={acceptanceReceipt};
