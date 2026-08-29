'use strict';
function postExecutionReceipt({contested_action_receipt,outcome_ref,executed_at,lease_ref=null}){
 if(!contested_action_receipt||contested_action_receipt.type!=='ContestedActionReceipt') throw Error('contested action receipt required');
 if(contested_action_receipt.contested!==true) throw Error('action must remain contested');
 if(!outcome_ref||!executed_at) throw Error('outcome evidence required');
 return {type:'PostExecutionContestReceipt',action_ref:contested_action_receipt.action_ref??null,outcome_ref,executed_at,lease_ref,selected_claim_ref:contested_action_receipt.selected_claim_ref??null,competing_claim_refs:[...(contested_action_receipt.competing_claim_refs||[])],contested:true,normative_winner:null,execution_proves_legitimacy:false,execution_erases_competing_legitimacy:false,requires_revisit:contested_action_receipt.mode==='TEMPORARY_PRECEDENCE',external_effect_authority_created:false};
}
function assertContestVisible(receipt){if(!receipt||receipt.type!=='PostExecutionContestReceipt')throw Error('post execution receipt required');if(receipt.contested!==true||receipt.normative_winner!==null||receipt.execution_erases_competing_legitimacy!==false)throw Error('contest visibility lost');return true;}
module.exports={postExecutionReceipt,assertContestVisible};
