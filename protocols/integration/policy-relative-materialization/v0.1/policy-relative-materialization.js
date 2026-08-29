'use strict';

const RESULTS=new Set(['RECOGNIZED_IN_SCOPE','CONTESTED','DEFERRED','REJECTED','INSUFFICIENT_EVIDENCE']);

function recognizeSuccessor(input){
  if(!input||typeof input!=='object') throw new Error('input required');
  for(const k of ['policy_id','policy_version','policy_scope','predecessor_ref','successor_ref','decision_time']) if(!input[k]) throw new Error(`${k} required`);
  if(!input.materialization_authority||input.materialization_authority.type!=='MaterializationAuthorityReceipt') throw new Error('MaterializationAuthorityReceipt required');
  if(input.materialization_authority.result!=='AUTHORIZED_IN_SCOPE') return receipt(input,'INSUFFICIENT_EVIDENCE');
  if(input.materialization_authority.predecessor_ref!==input.predecessor_ref||input.materialization_authority.successor_ref!==input.successor_ref) return receipt(input,'REJECTED');
  if(input.materialization_authority.policy_id!==input.policy_id||input.materialization_authority.policy_version!==input.policy_version) return receipt(input,'REJECTED');
  if(input.materialization_authority.policy_scope!==input.policy_scope) return receipt(input,'REJECTED');
  if(input.universal_canonicality_claim===true) throw new Error('universal canonicality forbidden');
  if(input.execution_authority_requested===true||input.action_permit_requested===true) throw new Error('execution authority forbidden');

  const conflicts=Array.isArray(input.conflict_set_refs)?input.conflict_set_refs:[];
  const disputed=Array.isArray(input.dispute_refs)&&input.dispute_refs.length>0;
  const deferred=input.defer===true;
  let result='RECOGNIZED_IN_SCOPE';
  if(disputed||conflicts.length>1) result='CONTESTED';
  else if(deferred) result='DEFERRED';
  else if(input.policy_reject===true) result='REJECTED';
  return receipt(input,result);
}

function receipt(input,result){
  if(!RESULTS.has(result)) throw new Error('invalid result');
  return {
    type:'PolicyRelativeMaterializationReceipt',
    version:'0.1',
    policy_id:input.policy_id,
    policy_version:input.policy_version,
    policy_scope:input.policy_scope,
    predecessor_ref:input.predecessor_ref,
    successor_ref:input.successor_ref,
    decision_time:input.decision_time,
    materialization_authority_ref:input.materialization_authority&&input.materialization_authority.receipt_ref||null,
    conflict_set_refs:Array.isArray(input.conflict_set_refs)?input.conflict_set_refs:[],
    dispute_refs:Array.isArray(input.dispute_refs)?input.dispute_refs:[],
    supersession_refs:Array.isArray(input.supersession_refs)?input.supersession_refs:[],
    result,
    recognized_in_scope:result==='RECOGNIZED_IN_SCOPE',
    universal_canonicality:false,
    execution_authority_created:false,
    action_permit_created:false,
    repository_mutation_performed:false,
    external_effect_performed:false,
    truth_claim_created:false,
    legal_status_created:false
  };
}

module.exports={recognizeSuccessor,RESULTS};
