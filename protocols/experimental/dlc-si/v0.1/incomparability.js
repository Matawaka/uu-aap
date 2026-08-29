'use strict';
const RELATIONS=new Set(['A_GT_B','B_GT_A','EQUIVALENT','INCOMPARABLE','MUTUALLY_INCOMPATIBLE']);
function relation({claim_a_ref,claim_b_ref,relation,evidence_refs=[]}){
 if(!claim_a_ref||!claim_b_ref||claim_a_ref===claim_b_ref)throw Error('distinct claims required');
 if(!RELATIONS.has(relation))throw Error('unsupported relation');
 return {type:'ClaimRelation',claim_a_ref,claim_b_ref,relation,evidence_refs:[...evidence_refs],forced_order:false,normative_winner:relation==='A_GT_B'?claim_a_ref:relation==='B_GT_A'?claim_b_ref:null};
}
function safeWorkGate({claim_relation,work_items}){
 if(!claim_relation||claim_relation.type!=='ClaimRelation')throw Error('claim relation required');
 if(!Array.isArray(work_items))throw Error('work items required');
 const unresolved=claim_relation.relation==='INCOMPARABLE'||claim_relation.relation==='MUTUALLY_INCOMPATIBLE';
 const classified=work_items.map(w=>{
   if(!w.work_id||typeof w.reversible!=='boolean'||typeof w.conflicts_with_contested_portion!=='boolean')throw Error('work classification required');
   const may_proceed=!unresolved||(!w.conflicts_with_contested_portion&&w.reversible);
   return {...w,may_proceed,blocked_reason:may_proceed?null:'IRREVERSIBLE_OR_CONFLICTING_UNDER_UNRESOLVED_CONTENTION'};
 });
 return {type:'SafeWorkGateReceipt',relation:claim_relation.relation,unresolved_contention:unresolved,work:classified,irreversible_conflict_frozen:unresolved,normative_winner:claim_relation.normative_winner,external_effect_authority_created:false};
}
module.exports={relation,safeWorkGate};
