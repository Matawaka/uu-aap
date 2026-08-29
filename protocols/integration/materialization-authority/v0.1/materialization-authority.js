'use strict';

const RESULTS=new Set(['AUTHORIZED_IN_SCOPE','DISPUTED','EXPIRED','REVOKED','OUT_OF_SCOPE','INSUFFICIENT_EVIDENCE']);

function assessMaterializationAuthority(input){
  if(!input||typeof input!=='object') throw new Error('input required');
  for(const k of ['policy_id','policy_version','subject_ref','action','predecessor_ref','successor_ref','evaluation_time']) if(!input[k]) throw new Error(`${k} required`);
  if(input.action!=='successor.materialize'&&input.action!=='successor.recognize') throw new Error('unsupported materialization action');
  if(!Array.isArray(input.authority_receipts)||input.authority_receipts.length===0) throw new Error('authority_receipts required');
  if(input.execution_authority_requested===true) throw new Error('execution authority forbidden');
  if(input.action_permit_requested===true) throw new Error('ActionPermit creation forbidden');
  if(input.universal_canonicality_claim===true) throw new Error('universal canonicality claim forbidden');

  const now=Date.parse(input.evaluation_time);
  if(!Number.isFinite(now)) throw new Error('evaluation_time invalid');
  const validFrom=input.valid_from?Date.parse(input.valid_from):null;
  const validUntil=input.valid_until?Date.parse(input.valid_until):null;
  if(validFrom!==null&&!Number.isFinite(validFrom)) throw new Error('valid_from invalid');
  if(validUntil!==null&&!Number.isFinite(validUntil)) throw new Error('valid_until invalid');
  if(validFrom!==null&&validUntil!==null&&validUntil<validFrom) throw new Error('invalid validity window');

  const targetRef=`${input.predecessor_ref}->${input.successor_ref}`;
  const relevant=input.authority_receipts.filter(r=>r&&r.type==='ScopedAuthorityEvidenceReceipt'&&r.subject_ref===input.subject_ref);
  const revoked=input.revocation_evidence===true||relevant.some(r=>r.result==='REVOKED');
  const expired=(validUntil!==null&&now>validUntil)||(validFrom!==null&&now<validFrom)||relevant.some(r=>r.result==='EXPIRED');
  const disputed=input.dispute_evidence===true||relevant.some(r=>r.result==='DISPUTED');
  const scopeMismatch=relevant.some(r=>r.action!==input.action||r.target_ref!==targetRef);
  const supported=relevant.filter(r=>r.result==='SUPPORTED'&&r.action===input.action&&r.target_ref===targetRef&&r.materialization_authority_verified===false);

  let result;
  if(revoked) result='REVOKED';
  else if(expired) result='EXPIRED';
  else if(disputed) result='DISPUTED';
  else if(scopeMismatch&&supported.length===0) result='OUT_OF_SCOPE';
  else if(supported.length===0) result='INSUFFICIENT_EVIDENCE';
  else result='AUTHORIZED_IN_SCOPE';

  return {
    type:'MaterializationAuthorityReceipt',
    version:'0.1',
    policy_id:input.policy_id,
    policy_version:input.policy_version,
    subject_ref:input.subject_ref,
    action:input.action,
    predecessor_ref:input.predecessor_ref,
    successor_ref:input.successor_ref,
    target_ref:targetRef,
    evaluation_time:input.evaluation_time,
    authority_receipt_refs:relevant.map((r,i)=>r.receipt_ref||`inline:${i}`),
    contention_refs:Array.isArray(input.contention_refs)?input.contention_refs:[],
    result,
    materialization_authority_supported:result==='AUTHORIZED_IN_SCOPE',
    execution_authority_created:false,
    universal_canonicality_established:false,
    action_permit_created:false,
    external_effect_authority_created:false,
    legal_status_created:false
  };
}

module.exports={assessMaterializationAuthority,RESULTS};
