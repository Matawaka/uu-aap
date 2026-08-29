'use strict';

const RESULTS=new Set(['RECOGNIZED_IN_SCOPE','CONTESTED','DEFERRED','REJECTED','INSUFFICIENT_EVIDENCE']);
const AUTH_ACTIONS=new Set(['successor.materialize','successor.recognize']);

function refArray(input,key){
  if(input[key]===undefined) return [];
  if(!Array.isArray(input[key])) throw new Error(`${key} must be an array`);
  return input[key];
}

function recognizeSuccessor(input){
  if(!input||typeof input!=='object') throw new Error('input required');
  for(const k of ['policy_id','policy_version','policy_scope','predecessor_ref','successor_ref','decision_time']) if(!input[k]) throw new Error(`${k} required`);
  if(input.universal_canonicality_claim===true) throw new Error('universal canonicality forbidden');
  if(input.execution_authority_requested===true||input.action_permit_requested===true) throw new Error('execution authority forbidden');

  const decisionTime=Date.parse(input.decision_time);
  if(!Number.isFinite(decisionTime)) throw new Error('decision_time invalid');
  const validFrom=input.valid_from?Date.parse(input.valid_from):null;
  const validUntil=input.valid_until?Date.parse(input.valid_until):null;
  if(validFrom!==null&&!Number.isFinite(validFrom)) throw new Error('valid_from invalid');
  if(validUntil!==null&&!Number.isFinite(validUntil)) throw new Error('valid_until invalid');
  if(validFrom!==null&&validUntil!==null&&validUntil<validFrom) throw new Error('invalid validity window');

  const authority=input.materialization_authority;
  if(!authority||authority.type!=='MaterializationAuthorityReceipt') throw new Error('MaterializationAuthorityReceipt required');
  if(authority.universal_canonicality_established===true) throw new Error('authority receipt may not establish universal canonicality');
  if(authority.execution_authority_created===true||authority.action_permit_created===true||authority.external_effect_authority_created===true) throw new Error('authority receipt contains forbidden stronger effect');

  const conflicts=refArray(input,'conflict_set_refs');
  const disputes=refArray(input,'dispute_refs');
  const supersessions=refArray(input,'supersession_refs');
  const appeals=refArray(input,'appeal_refs');
  const stays=refArray(input,'stay_refs');

  if(authority.result!=='AUTHORIZED_IN_SCOPE'||authority.materialization_authority_supported!==true) return receipt(input,'INSUFFICIENT_EVIDENCE',conflicts,disputes,supersessions,appeals,stays);
  if(!AUTH_ACTIONS.has(authority.action)) return receipt(input,'REJECTED',conflicts,disputes,supersessions,appeals,stays);
  const expectedTarget=`${input.predecessor_ref}->${input.successor_ref}`;
  if(authority.predecessor_ref!==input.predecessor_ref||authority.successor_ref!==input.successor_ref||authority.target_ref!==expectedTarget) return receipt(input,'REJECTED',conflicts,disputes,supersessions,appeals,stays);
  if(authority.policy_id!==input.policy_id||authority.policy_version!==input.policy_version||authority.policy_scope!==input.policy_scope) return receipt(input,'REJECTED',conflicts,disputes,supersessions,appeals,stays);

  const authorityTime=Date.parse(authority.evaluation_time);
  if(!Number.isFinite(authorityTime)||authorityTime>decisionTime) return receipt(input,'INSUFFICIENT_EVIDENCE',conflicts,disputes,supersessions,appeals,stays);
  if((validFrom!==null&&decisionTime<validFrom)||(validUntil!==null&&decisionTime>validUntil)) return receipt(input,'DEFERRED',conflicts,disputes,supersessions,appeals,stays);

  let result='RECOGNIZED_IN_SCOPE';
  if(input.policy_reject===true) result='REJECTED';
  else if(disputes.length>0||conflicts.length>0) result='CONTESTED';
  else if(input.defer===true||stays.length>0) result='DEFERRED';
  return receipt(input,result,conflicts,disputes,supersessions,appeals,stays);
}

function receipt(input,result,conflicts=[],disputes=[],supersessions=[],appeals=[],stays=[]){
  if(!RESULTS.has(result)) throw new Error('invalid result');
  const authority=input.materialization_authority||{};
  return {
    type:'PolicyRelativeMaterializationReceipt',
    version:'0.1',
    policy_id:input.policy_id,
    policy_version:input.policy_version,
    policy_scope:input.policy_scope,
    policy_valid_from:input.valid_from||null,
    policy_valid_until:input.valid_until||null,
    predecessor_ref:input.predecessor_ref,
    successor_ref:input.successor_ref,
    decision_time:input.decision_time,
    materialization_authority_ref:authority.receipt_ref||null,
    materialization_authority_binding:{
      type:authority.type||null,
      result:authority.result||null,
      subject_ref:authority.subject_ref||null,
      action:authority.action||null,
      target_ref:authority.target_ref||null,
      evaluation_time:authority.evaluation_time||null
    },
    conflict_set_refs:conflicts,
    dispute_refs:disputes,
    supersession_refs:supersessions,
    appeal_refs:appeals,
    stay_refs:stays,
    result,
    recognized_in_scope:result==='RECOGNIZED_IN_SCOPE',
    universal_canonicality:false,
    execution_authority_created:false,
    action_permit_created:false,
    repository_mutation_performed:false,
    external_effect_performed:false,
    truth_claim_created:false,
    causality_claim_created:false,
    liability_claim_created:false,
    legal_status_created:false,
    certification_created:false
  };
}

module.exports={recognizeSuccessor,RESULTS};
