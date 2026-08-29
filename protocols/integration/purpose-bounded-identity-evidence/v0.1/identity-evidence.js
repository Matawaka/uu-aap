'use strict';

const RESULTS=new Set(['MATCH_SUPPORTED','MATCH_DISPUTED','INSUFFICIENT_EVIDENCE','NOT_ASSESSED']);

function assessIdentityEvidence(input){
  if(!input||typeof input!=='object') throw new Error('input required');
  if(!input.purpose_id) throw new Error('purpose_id required');
  if(!input.subject_ref) throw new Error('subject_ref required');
  if(!input.psr_root_ref) throw new Error('psr_root_ref required');
  if(!Array.isArray(input.evidence_refs)) throw new Error('evidence_refs required');
  if(typeof input.cross_context_correlation_performed!=='boolean') throw new Error('correlation flag required');
  if(input.cross_context_correlation_performed) throw new Error('cross-context correlation denied by default');
  if(input.biometric_required===true) throw new Error('biometric requirement forbidden');
  if(input.universal_identity_claim===true) throw new Error('universal identity claim forbidden');
  if(input.legal_identity_claim===true && input.entitled_legal_identity_verifier!==true) throw new Error('legal identity claim requires separately entitled verifier');

  const supporting=input.evidence_refs.filter(e=>e&&e.status==='SUPPORTS_MATCH');
  const disputing=input.evidence_refs.filter(e=>e&&e.status==='DISPUTES_MATCH');
  const independent=new Set(supporting.map(e=>e.independence_group).filter(Boolean));
  let result='NOT_ASSESSED';
  if(input.assessment_requested===true){
    if(disputing.length>0) result='MATCH_DISPUTED';
    else if(supporting.length>=2 && independent.size>=2) result='MATCH_SUPPORTED';
    else result='INSUFFICIENT_EVIDENCE';
  }
  if(!RESULTS.has(result)) throw new Error('invalid result');
  return {
    type:'PurposeBoundedIdentityEvidenceReceipt',
    version:'0.1',
    purpose_id:input.purpose_id,
    subject_ref:input.subject_ref,
    psr_root_ref:input.psr_root_ref,
    evidence_refs:input.evidence_refs,
    result,
    legal_identity_established: input.legal_identity_claim===true && input.entitled_legal_identity_verifier===true && result==='MATCH_SUPPORTED',
    universal_identity_proof:false,
    authority_established:false,
    intent_established:false,
    action_established:false,
    responsibility_established:false,
    liability_established:false,
    cross_context_correlation_performed:false,
    biometric_processing_required:false,
    external_effect_authority_created:false
  };
}

module.exports={assessIdentityEvidence,RESULTS};
