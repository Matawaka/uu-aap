'use strict';

const RESULTS=new Set(['PRESERVED','DEGRADED','LOST','UNKNOWN']);

function causalValueReceipt(input){
  if(!input||input.type!=='CAUSAL_VALUE_EVIDENCE') throw Error('causal value evidence required');
  for(const k of ['receipt_id','claim_ref','successor_condition_ref','decomposition_option_ref','result','observed_basis_ref','valid_from','valid_until']){
    if(input[k]===undefined||input[k]===null||input[k]==='') throw Error(`${k} required`);
  }
  if(!RESULTS.has(input.result)) throw Error('invalid causal value result');
  const from=Date.parse(input.valid_from), until=Date.parse(input.valid_until);
  if(!Number.isFinite(from)||!Number.isFinite(until)||until<=from) throw Error('bounded temporal validity required');
  return {
    type:'CausalValuePreservationReceipt',
    receipt_id:input.receipt_id,
    claim_ref:input.claim_ref,
    successor_condition_ref:input.successor_condition_ref,
    decomposition_option_ref:input.decomposition_option_ref,
    result:input.result,
    observed_basis_ref:input.observed_basis_ref,
    valid_from:input.valid_from,
    valid_until:input.valid_until,
    authority_created:false,
    normative_winner:null
  };
}

function evaluateDecomposition({option_ref,claim_receipts,evaluated_at}){
  if(!option_ref||!Array.isArray(claim_receipts)||claim_receipts.length<2) throw Error('option and at least two claim receipts required');
  const now=Date.parse(evaluated_at);
  if(!Number.isFinite(now)) throw Error('evaluated_at required');
  const receipts=claim_receipts.map(r=>{
    if(!r||r.type!=='CausalValuePreservationReceipt'||r.decomposition_option_ref!==option_ref) throw Error('matching causal value receipt required');
    const from=Date.parse(r.valid_from),until=Date.parse(r.valid_until);
    return {...r,temporally_valid:now>=from&&now<until};
  });
  const effective=receipts.map(r=>r.temporally_valid?r.result:'UNKNOWN');
  const allPreserved=effective.every(x=>x==='PRESERVED');
  const hasLoss=effective.some(x=>x==='DEGRADED'||x==='LOST');
  const hasUnknown=effective.some(x=>x==='UNKNOWN');
  return {
    type:'CausalValueDecompositionAssessment',
    option_ref,
    evaluated_at,
    claim_receipts:receipts,
    result:allPreserved?'PRESERVED':hasLoss?'NOT_PRESERVED':'UNKNOWN',
    partition_or_defer_sufficient:allPreserved,
    temporary_precedence_eligible:hasLoss,
    unresolved_evidence:hasUnknown,
    unknown_creates_precedence_eligibility:false,
    external_effect_authority_created:false,
    normative_winner:null
  };
}

module.exports={causalValueReceipt,evaluateDecomposition};
