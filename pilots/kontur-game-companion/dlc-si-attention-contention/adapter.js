'use strict';
const {validateContention,buildReceipt}=require('../../../protocols/dlc-si/v0.1/dlc-si.js');

function toContention({contention_id,source_conflict_refs,claims,interface_id='kontur-cursor',resolution,safe_work=['observe_without_cue'],evaluated_at}){
  if(!Array.isArray(claims)||claims.length<2) throw Error('at least two attention claims required');
  const mapped=claims.map(c=>{
    if(!c.claim_id||!c.legitimacy_ref||!c.successor_state_ref) throw Error('attention claim evidence required');
    if(c.correct_answer===true||c.instruction===true) throw Error('attention claim cannot assert correct answer or instruction');
    return {claim_id:c.claim_id,legitimacy_ref:c.legitimacy_ref,successor_state_ref:c.successor_state_ref};
  });
  const x={protocol:'DLC-SI',version:'0.1',profile:'dual-legitimacy-singular-interface-v0.1',contention_id,source_conflict_refs,claims:mapped,interface:{interface_id,output_capacity:1},conflict:{type:'interface_capacity',claim_relation:'INCOMPARABLE',successor_relation:'INCOMPATIBLE'},proposed_resolution:resolution,safe_work,evaluated_at};
  validateContention(x);return x;
}

function contestedCueReceipt(input){
  const contention=toContention(input);
  const dlc=buildReceipt(contention);
  return {type:'KONTURContestedCueReceipt',contention_id:dlc.contention_id,status:dlc.status,contest_visible:true,selected_cue_id:dlc.selected_claim_id,preserved_cue_ids:[...dlc.preserved_claim_ids],precedence_effective:dlc.precedence_effective,revisit_triggers:[...dlc.revisit_triggers],lease:dlc.lease,correct_answer:false,instruction:false,normative_winner:false,selection_erases_legitimacy:false,engagement_objective_created:false,mood_inference_created:false,durable_profile_created:false,external_effect_authority_created:false,action_permit_created:false,dlc_si_fingerprint:dlc.fingerprint_sha256};
}
module.exports={toContention,contestedCueReceipt};
