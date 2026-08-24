'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const F=JSON.parse(fs.readFileSync(path.join(__dirname,'conformance.fixture.json'),'utf8'));
const OPS=new Set(['inspect','qualify','authorize','observe']);
const RESULTS=new Set(['inspected','qualified','admissible','denied','approval_required']);
const DECISION_NON=['intent_created','intent_inferred','authority_created','authority_expanded','responsibility_accepted','coordination_completed','action_permit_created','action_performed_by_gateway','frontier_refreshed','truth_certified','causality_proven','liability_established','universal_canonicality_established'];
const OBS_NON=['action_performed_by_gateway','frontier_refreshed','causality_proven','truth_certified','liability_established','universal_canonicality_established'];
function bad(m){throw Error(m)}
function obj(v,n){if(!v||typeof v!=='object'||Array.isArray(v))bad(`${n} must be object`)}
function sortKeys(v){if(Array.isArray(v))return v.map(sortKeys);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=sortKeys(v[k]);return o}return v}
function hash(x){const y=JSON.parse(JSON.stringify(x));delete y.content_hash;return crypto.createHash('sha256').update(JSON.stringify(sortKeys(y))).digest('hex')}
function refsByType(r){const m=new Map();for(const x of r.core_receipts||[])m.set(x.receipt_type,x);return m}
function validateRef(x,n){obj(x,n);if(!x.receipt_type||!/^[a-f0-9]{64}$/.test(x.content_hash||'')||!x.frontier)bad(`${n} invalid`)}
function validateCapability(c){
 obj(c,'capability');
 if(c.protocol!=='UU-AAP-AI-GATEWAY'||c.version!=='0.1'||c.artifact_type!=='GatewayCapabilityManifest')bad('capability envelope');
 if(!Array.isArray(c.operations)||!['inspect','qualify','authorize','observe'].every(x=>c.operations.includes(x)))bad('operations missing');
 if(c.provider_neutral!==true||c.external_actuator_required!==false)bad('provider/runtime dependency');
 if(hash(c)!==c.content_hash)bad('capability hash');
}
function validateRequest(r){
 obj(r,'request');
 if(r.protocol!=='UU-AAP-AI-GATEWAY'||r.version!=='0.1'||r.artifact_type!=='GatewayRequest')bad('request envelope');
 if(!OPS.has(r.operation)||!r.request_id||!r.subject||!r.frontier)bad('request identity');
 obj(r.action,'action');obj(r.protocol_mode_consent,'protocol consent');
 if(r.protocol_mode_consent.blanket_action_approval!==false)bad('blanket action approval forbidden');
 if(r.action.read_only===true&&r.action.external_effect===true)bad('read-only cannot be external effect');
 const exp=new Set(r.action.expected_effects||[]);
 for(const x of r.action.explicit_non_effects||[])if(exp.has(x))bad('effect/non-effect overlap');
 for(const x of r.core_receipts||[])validateRef(x,'core receipt');
 for(const x of r.intent_evidence_refs||[])validateRef(x,'intent evidence ref');
 if(r.approval_ref!==null)validateRef(r.approval_ref,'approval ref');
 if(r.operation==='authorize'&&r.action.external_effect===true){
   const m=refsByType(r);
   for(const t of ['StateReceipt','IntentReceipt','CoordinationReceipt','ActionPermit'])if(!m.has(t))bad(`missing ${t}`);
   if(!m.has('AuthorityReceipt')&&!m.has('ResponsibilityReceipt'))bad('missing authority/responsibility');
   for(const x of m.values())if(x.frontier!==r.frontier)bad('core frontier mismatch');
   if(r.action.requires_approval===true&&!r.approval_ref)bad('approval required');
   if(r.approval_ref&&r.approval_ref.frontier!==r.frontier)bad('approval frontier mismatch');
 }
 if(hash(r)!==r.content_hash)bad('request hash');
}
function validateDecision(d,r){
 obj(d,'decision');
 if(d.protocol!=='UU-AAP-AI-GATEWAY'||d.version!=='0.1'||d.receipt_type!=='GatewayDecisionReceipt')bad('decision envelope');
 if(d.request_hash!==r.content_hash||d.request_id!==r.request_id||d.operation!==r.operation||d.subject!==r.subject||d.frontier!==r.frontier)bad('decision request binding');
 if(!RESULTS.has(d.result))bad('unknown result');
 obj(d.assertions,'assertions');obj(d.non_effects,'non_effects');
 if(d.assertions.exact_frontier_bound!==true||d.assertions.core_action_gate_preserved!==true||d.assertions.intent_evidence_not_substituted!==true||d.assertions.protocol_mode_consent_not_blanket_approval!==true)bad('decision assertions');
 for(const n of DECISION_NON)if(d.non_effects[n]!==false)bad(`decision non_effect ${n}`);
 if(d.result==='admissible'&&r.action.external_effect===true){
   const m=refsByType(r);
   if(!m.has('ActionPermit')||m.get('ActionPermit').frontier!==r.frontier)bad('admissible without matching ActionPermit');
   if(!m.has('IntentReceipt'))bad('IntentEvidenceReceipt cannot substitute for IntentReceipt');
   if(r.action.requires_approval===true&&!r.approval_ref)bad('admissible without approval');
 }
 if(r.action.requires_approval===true&&!r.approval_ref&&d.result!=='approval_required'&&d.result!=='denied')bad('missing approval must not be admissible');
 if(hash(d)!==d.content_hash)bad('decision hash');
}
function validateObservation(o,r){
 obj(o,'observation');
 if(o.protocol!=='UU-AAP-AI-GATEWAY'||o.version!=='0.1'||o.receipt_type!=='GatewayObservationReceipt')bad('observation envelope');
 if(o.request_hash!==r.content_hash||o.request_id!==r.request_id||o.subject!==r.subject||o.predecessor_frontier!==r.frontier)bad('observation request binding');
 obj(o.assertions,'observation assertions');obj(o.non_effects,'observation non_effects');
 if(o.assertions.observation_not_execution!==true||o.assertions.actuator_evidence_not_core_receipt!==true||o.assertions.outcome_not_causality!==true)bad('observation assertions');
 for(const n of OBS_NON)if(o.non_effects[n]!==false)bad(`observation non_effect ${n}`);
 if(o.external_effect_observed===true){
   if(!Array.isArray(o.actuator_evidence_refs)||o.actuator_evidence_refs.length===0)bad('performed effect without actuator evidence');
   if(!o.core_action_receipt_ref||o.core_action_receipt_ref.receipt_type!=='ActionReceipt')bad('performed effect without Core ActionReceipt');
   for(const x of o.actuator_evidence_refs)validateRef(x,'actuator evidence');
   validateRef(o.core_action_receipt_ref,'core action receipt');
   if(o.core_action_receipt_ref.frontier!==o.observed_frontier)bad('Core ActionReceipt observed frontier mismatch');
   for(const x of o.actuator_evidence_refs)if(x.frontier!==o.observed_frontier)bad('actuator evidence observed frontier mismatch');
   if(o.outcome_receipt_ref){validateRef(o.outcome_receipt_ref,'outcome receipt');if(o.outcome_receipt_ref.frontier!==o.observed_frontier)bad('OutcomeReceipt observed frontier mismatch')}
   if(o.successor_state_receipt_ref){validateRef(o.successor_state_receipt_ref,'successor state receipt');if(o.successor_state_receipt_ref.frontier!==o.observed_frontier)bad('SuccessorStateReceipt observed frontier mismatch')}
 }
 if(hash(o)!==o.content_hash)bad('observation hash');
}
function mutate(x,fn){const y=JSON.parse(JSON.stringify(x));fn(y);y.content_hash=hash(y);return y}
function reject(n,fn){try{fn()}catch{return}bad(`negative accepted: ${n}`)}
validateCapability(F.capability_manifest);
validateRequest(F.authorize_request);
validateDecision(F.decision_receipt,F.authorize_request);
validateObservation(F.observation_receipt,F.authorize_request);
const R=F.authorize_request,D=F.decision_receipt,O=F.observation_receipt,C=F.capability_manifest;
reject('authorize without ActionPermit',()=>validateRequest(mutate(R,x=>x.core_receipts=x.core_receipts.filter(y=>y.receipt_type!=='ActionPermit'))));
reject('authorize without IntentReceipt',()=>validateRequest(mutate(R,x=>x.core_receipts=x.core_receipts.filter(y=>y.receipt_type!=='IntentReceipt'))));
reject('IntentEvidence substitutes IntentReceipt',()=>validateRequest(mutate(R,x=>{x.core_receipts=x.core_receipts.filter(y=>y.receipt_type!=='IntentReceipt');x.core_receipts.push({receipt_type:'IntentEvidenceReceipt',content_hash:'c'.repeat(64),frontier:x.frontier})})));
reject('approval required missing',()=>validateRequest(mutate(R,x=>x.approval_ref=null)));
reject('stale frontier',()=>validateRequest(mutate(R,x=>x.core_receipts[0].frontier='sha256:stale')));
reject('effect non-effect overlap',()=>validateRequest(mutate(R,x=>x.action.explicit_non_effects.push('demo_state_change'))));
reject('read-only external effect',()=>validateRequest(mutate(R,x=>x.action.read_only=true)));
reject('decision creates authority',()=>validateDecision(mutate(D,x=>x.non_effects.authority_created=true),R));
reject('decision creates ActionPermit',()=>validateDecision(mutate(D,x=>x.non_effects.action_permit_created=true),R));
const noPermit=mutate(R,x=>x.core_receipts=x.core_receipts.filter(y=>y.receipt_type!=='ActionPermit'));
reject('admissible without matching permit',()=>validateDecision(mutate(D,x=>{x.request_hash=noPermit.content_hash}),noPermit));
reject('observe without actuator evidence',()=>validateObservation(mutate(O,x=>x.actuator_evidence_refs=[]),R));
reject('observe without Core ActionReceipt',()=>validateObservation(mutate(O,x=>x.core_action_receipt_ref=null),R));
reject('observe frontier mismatch',()=>validateObservation(mutate(O,x=>x.core_action_receipt_ref.frontier='sha256:wrong-observed-frontier'),R));
reject('gateway claims action performance',()=>validateObservation(mutate(O,x=>x.non_effects.action_performed_by_gateway=true),R));
reject('observation proves causality',()=>validateObservation(mutate(O,x=>x.non_effects.causality_proven=true),R));
reject('blanket protocol consent',()=>validateRequest(mutate(R,x=>x.protocol_mode_consent.blanket_action_approval=true)));
reject('provider-specific mandatory dependency',()=>validateCapability(mutate(C,x=>x.provider_neutral=false)));
console.log('UU_AAP_AI_GATEWAY_CONTRACT_V0_1_PASS');
module.exports={validateCapability,validateRequest,validateDecision,validateObservation,hash};
