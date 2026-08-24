'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const F=JSON.parse(fs.readFileSync(path.join(__dirname,'conformance.fixture.json'),'utf8'));
const ORIGINS=new Set(['system','user','mixed','external','unknown']);
const EVENT_KINDS=new Set(['interaction','silence','delay','absence']);
const STAGES=new Set(['presented','read','understood','accepted','intended','authorized','not_applicable']);
const STYLES=new Set(['neutral','leading','system_proposed','derived_from_user','mixed']);
const WEIGHTS=new Set(['zero','bounded_nonzero','not_assessed']);
const NON=[
'intent_established','intent_created','intent_inferred_from_exposure','intent_inferred_from_challenge',
'intent_inferred_from_silence','acceptance_inferred','understanding_inferred','authority_created',
'authority_expanded','responsibility_accepted','coordination_completed','action_permit_created',
'action_performed','liability_established'
];
function bad(m){throw Error(m)}
function obj(v,n){if(!v||typeof v!=='object'||Array.isArray(v))bad(`${n} must be object`)}
function sortKeys(v){if(Array.isArray(v))return v.map(sortKeys);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=sortKeys(v[k]);return o}return v}
function hash(x){const y=JSON.parse(JSON.stringify(x));delete y.content_hash;return crypto.createHash('sha256').update(JSON.stringify(sortKeys(y))).digest('hex')}
function validate(r){
  obj(r,'receipt');
  if(r.protocol!=='UU-AAP-INTENT-EVIDENCE'||r.version!=='0.1'||r.receipt_type!=='IntentEvidenceReceipt')bad('invalid envelope');
  obj(r.subject,'subject');obj(r.frontier,'frontier');obj(r.source_event,'source_event');obj(r.formulation,'formulation');
  obj(r.challenge,'challenge');obj(r.temporal,'temporal');obj(r.assertions,'assertions');obj(r.non_effects,'non_effects');
  obj(r.core_binding,'core_binding');obj(r.independence,'independence');
  if(!r.subject.subject_id||!r.subject.intent_candidate_id)bad('subject binding missing');
  if(!EVENT_KINDS.has(r.source_event.event_kind)||!STAGES.has(r.source_event.evidence_stage))bad('event/stage invalid');
  if(r.source_event.event_kind!=='interaction'&&r.source_event.evidence_stage!=='not_applicable')bad('non-interaction event cannot imply intent stage');
  if(!ORIGINS.has(r.formulation.origin)||!ORIGINS.has(r.formulation.first_introduced_by)||r.formulation.provenance_preserved!==true)bad('formulation provenance invalid');
  if(!WEIGHTS.has(r.independent_intent_evidence_weight))bad('weight invalid');
  if(r.challenge.present===true){
    if(!r.challenge.challenge_id||!r.challenge.issued_at||!STYLES.has(r.challenge.style)||!ORIGINS.has(r.challenge.formulation_origin)||r.challenge.provenance_preserved!==true)bad('challenge provenance missing');
  }
  if(r.challenge.introduced_new_content===true&&r.challenge.present!==true)bad('challenge-derived content without challenge provenance');
  if((r.formulation.origin==='system'||r.challenge.introduced_new_content===true)&&r.independent_intent_evidence_weight!=='zero')bad('system/challenge-presented text must have zero independent intent weight');
  if(r.challenge.introduced_new_content===true&&r.assertions.preexisting_intent_claimed===true)bad('challenge-created content claimed as pre-existing intent');
  if(r.temporal.backdated_as_prechallenge!==false)bad('post-challenge evidence backdated');
  if(r.temporal.claimed_preexisting_intent_at!==null&&r.challenge.present===true&&r.challenge.introduced_new_content===true){
    if(Date.parse(r.temporal.claimed_preexisting_intent_at)<Date.parse(r.challenge.issued_at))bad('challenge-derived evidence backdated before challenge');
  }
  if(r.frontier.reobserved===false&&r.frontier.effective_revision!==r.frontier.source_revision)bad('stale frontier upgraded');
  const A=r.assertions;
  const falseAssertions=['stage_transition_automatic','preexisting_intent_claimed','acceptance_inferred_from_read','authorization_inferred_from_acceptance',
    'silence_interpreted_as_refusal','delay_interpreted_as_intentional','absence_interpreted_as_negative_intent',
    'leading_challenge_claimed_neutral','stale_frontier_upgraded','core_intent_receipt_substituted'];
  for(const n of falseAssertions)if(A[n]!==false)bad(`assertion must be false: ${n}`);
  if(A.formulation_provenance_preserved!==true||A.challenge_provenance_preserved!==true)bad('provenance assertion missing');
  if(r.challenge.style==='leading'&&A.leading_challenge_claimed_neutral!==false)bad('leading challenge mislabeled neutral');
  for(const n of NON)if(r.non_effects[n]!==false)bad(`non_effect must be false: ${n}`);
  if(JSON.stringify(r.core_binding.may_contribute_to)!==JSON.stringify(['IntentReceipt']))bad('invalid Core contribution target');
  if(r.core_binding.substitutes_for_core_intent_receipt!==false||r.core_binding.requires_core_intent_primitive!==true||
     r.core_binding.requires_authority_responsibility_primitive!==true||r.core_binding.requires_coordination_primitive!==true||
     r.core_binding.requires_action_gate!==true)bad('Core boundary weakened');
  for(const n of ['external_contour_required','runtime_vendor_required','ai_provider_required','kontur_required'])if(r.independence[n]!==false)bad(`hidden dependency: ${n}`);
  if(hash(r)!==r.content_hash)bad('content_hash mismatch');
  return true;
}
function mutate(x,fn){const y=JSON.parse(JSON.stringify(x));fn(y);y.content_hash=hash(y);return y}
function reject(n,fn){try{fn()}catch{return}bad(`negative accepted: ${n}`)}
const R=F.intent_evidence_receipt;validate(R);
reject('system exposure -> intent',()=>validate(mutate(R,x=>x.non_effects.intent_inferred_from_exposure=true)));
reject('challenge content -> independent preexisting intent',()=>validate(mutate(R,x=>x.independent_intent_evidence_weight='bounded_nonzero')));
reject('read -> accepted',()=>validate(mutate(R,x=>{x.source_event.evidence_stage='read';x.assertions.acceptance_inferred_from_read=true})));
reject('accepted -> authorized',()=>validate(mutate(R,x=>{x.source_event.evidence_stage='accepted';x.assertions.authorization_inferred_from_acceptance=true})));
reject('silence -> refusal',()=>validate(mutate(R,x=>{x.source_event.event_kind='silence';x.source_event.evidence_stage='not_applicable';x.assertions.silence_interpreted_as_refusal=true})));
reject('delay -> intentional delay',()=>validate(mutate(R,x=>{x.source_event.event_kind='delay';x.source_event.evidence_stage='not_applicable';x.assertions.delay_interpreted_as_intentional=true})));
reject('post-challenge backdating',()=>validate(mutate(R,x=>{x.temporal.claimed_preexisting_intent_at='2026-08-24T15:00:00Z';x.assertions.preexisting_intent_claimed=true})));
reject('hidden formulation provenance',()=>validate(mutate(R,x=>x.formulation.provenance_preserved=false)));
reject('stale frontier upgrade',()=>validate(mutate(R,x=>x.frontier.effective_revision='sha256:new-frontier')));
reject('substitute for Core IntentReceipt',()=>validate(mutate(R,x=>x.core_binding.substitutes_for_core_intent_receipt=true)));
reject('leading challenge marked neutral',()=>validate(mutate(R,x=>{x.challenge.style='leading';x.assertions.leading_challenge_claimed_neutral=true})));
reject('missing challenge provenance',()=>validate(mutate(R,x=>x.challenge.challenge_id='')));
reject('authority/action permit escalation',()=>validate(mutate(R,x=>{x.non_effects.authority_created=true;x.non_effects.action_permit_created=true})));
console.log('UU_AAP_NON_INDUCED_INTENT_V0_1_PASS');
module.exports={validate,hash};
