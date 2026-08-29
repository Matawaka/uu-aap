'use strict';

const RESULTS=new Set(['SUPPORTED','DISPUTED','EXPIRED','REVOKED','INSUFFICIENT_EVIDENCE','OUT_OF_SCOPE']);

function assessAuthorityEvidence(input){
  if(!input||typeof input!=='object') throw new Error('input required');
  for(const k of ['issuer_ref','subject_ref','action','target_ref','evaluation_time']) if(!input[k]) throw new Error(`${k} required`);
  if(!Array.isArray(input.issuer_entitlement_evidence)) throw new Error('issuer_entitlement_evidence required');
  if(!Array.isArray(input.allowed_actions)||input.allowed_actions.length===0) throw new Error('allowed_actions required');
  if(!Array.isArray(input.allowed_targets)||input.allowed_targets.length===0) throw new Error('allowed_targets required');
  if(input.identity_evidence && input.identity_evidence.result && !['MATCH_SUPPORTED','MATCH_DISPUTED','INSUFFICIENT_EVIDENCE','NOT_ASSESSED'].includes(input.identity_evidence.result)) throw new Error('invalid identity evidence result');
  if(input.execution_authority_requested===true) throw new Error('execution authority is outside evidence profile');
  if(input.action_permit_requested===true) throw new Error('ActionPermit creation forbidden');

  const t=Date.parse(input.evaluation_time);
  if(!Number.isFinite(t)) throw new Error('evaluation_time invalid');
  const from=input.valid_from?Date.parse(input.valid_from):null;
  const until=input.valid_until?Date.parse(input.valid_until):null;
  if(from!==null&&!Number.isFinite(from)) throw new Error('valid_from invalid');
  if(until!==null&&!Number.isFinite(until)) throw new Error('valid_until invalid');
  if(from!==null&&until!==null&&until<from) throw new Error('invalid validity window');

  const actionInScope=input.allowed_actions.includes(input.action);
  const targetInScope=input.allowed_targets.includes(input.target_ref);
  const revoked=input.revocation_evidence===true;
  const disputed=input.issuer_entitlement_evidence.some(e=>e&&e.status==='DISPUTES_ENTITLEMENT');
  const supports=input.issuer_entitlement_evidence.filter(e=>e&&e.status==='SUPPORTS_ENTITLEMENT');
  const independence=new Set(supports.map(e=>e.independence_group).filter(Boolean));
  const expired=(until!==null&&t>until)||(from!==null&&t<from);

  let result;
  if(revoked) result='REVOKED';
  else if(expired) result='EXPIRED';
  else if(!actionInScope||!targetInScope) result='OUT_OF_SCOPE';
  else if(disputed) result='DISPUTED';
  else if(supports.length<1||independence.size<1) result='INSUFFICIENT_EVIDENCE';
  else result='SUPPORTED';

  if(input.parent_authority){
    const parentActions=new Set(input.parent_authority.allowed_actions||[]);
    const parentTargets=new Set(input.parent_authority.allowed_targets||[]);
    if(input.allowed_actions.some(a=>!parentActions.has(a))) throw new Error('delegation may not widen action scope');
    if(input.allowed_targets.some(a=>!parentTargets.has(a))) throw new Error('delegation may not widen target scope');
  }

  return {
    type:'ScopedAuthorityEvidenceReceipt',
    version:'0.1',
    issuer_ref:input.issuer_ref,
    subject_ref:input.subject_ref,
    action:input.action,
    target_ref:input.target_ref,
    evaluation_time:input.evaluation_time,
    allowed_actions:input.allowed_actions,
    allowed_targets:input.allowed_targets,
    valid_from:input.valid_from||null,
    valid_until:input.valid_until||null,
    result,
    authority_evidence_supported:result==='SUPPORTED',
    issuer_entitlement_universally_verified:false,
    materialization_authority_verified:false,
    execution_authority_created:false,
    action_permit_created:false,
    external_effect_authority_created:false
  };
}

module.exports={assessAuthorityEvidence,RESULTS};
