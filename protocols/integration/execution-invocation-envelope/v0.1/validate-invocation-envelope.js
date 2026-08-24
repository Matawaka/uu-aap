#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const f=JSON.parse(fs.readFileSync(path.join(__dirname,'conformance.fixture.json'),'utf8'));
const r=JSON.parse(fs.readFileSync(path.join(__dirname,'..','..','execute-revalidation','v0.1','conformance.fixture.json'),'utf8'));
function st(v){if(Array.isArray(v))return '['+v.map(st).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+st(v[k])).join(',')+'}';return JSON.stringify(v)}
function h(x){const c=structuredClone(x);delete c.content_hash;return 'sha256:'+crypto.createHash('sha256').update(st(c)).digest('hex')}
function e(a,b,n){if(a!==b)throw Error(`${n}: ${a} != ${b}`)}
function t(s){const n=Date.parse(s);if(!Number.isFinite(n))throw Error('bad time');return n}
function v(x){
e(x.protocol,'UU-AAP-EXECUTION-INVOCATION-ENVELOPE','protocol');e(x.version,'0.1','version');e(x.artifact_type,'ExecutionInvocationEnvelope','type');
e(x.execute_revalidation_ref.decision_id,r.decision_id,'revalidation id');e(x.execute_revalidation_ref.content_hash,r.content_hash,'revalidation hash');e(x.execute_revalidation_ref.status,'ready','revalidation status');e(r.decision.status,'ready','source ready');
for(const k of ['id','scope'])e(x.subject[k],r.subject[k],'subject '+k);
for(const k of ['capability_id','operation','authority_scope','target_binding_hash','predecessor_frontier'])e(x.action_binding[k],r.action_binding[k],'action '+k);
e(x.evidence_binding.availability_binding_hash,r.freshness_binding.availability_binding_hash,'availability');e(x.evidence_binding.approval_hash,r.freshness_binding.approval_hash,'approval');e(x.evidence_binding.action_permit_hash,r.freshness_binding.action_permit_hash,'permit');
e(x.invocation.adapter_role,'transport_only','adapter role');e(x.invocation.one_shot,true,'one shot');e(x.invocation.consumed,false,'consumed');e(x.invocation.expected_target_guard_used,true,'target guard');e(x.invocation.expected_predecessor_guard_used,true,'frontier guard');
if(t(x.created_at)>t(x.invocation.expires_at))throw Error('envelope created after expiry');if(t(x.invocation.expires_at)>t(r.freshness_binding.execute_revalidation_must_occur_by))throw Error('envelope extends revalidation horizon');
for(const k of ['revalidation_exactly_bound','action_exactly_bound','permit_exactly_bound','guards_fail_closed','one_shot_unconsumed','adapter_not_authority_source'])e(x.assertions[k],true,'assert '+k);
for(const k of ['actuator_invocation_emitted','action_receipt_created','permit_consumed','action_performed','outcome_observed','authority_created_or_expanded','future_action_permission_created','general_authority_created','causality_proven','truth_certified','liability_established'])e(x.non_effects[k],false,'non-effect '+k);
e(x.content_hash,h(x),'hash');return true}
v(f);
const ms=[
['reval id',x=>x.execute_revalidation_ref.decision_id+='x'],['reval hash',x=>x.execute_revalidation_ref.content_hash='sha256:'+'0'.repeat(64)],['status',x=>x.execute_revalidation_ref.status='denied'],
['subject',x=>x.subject.id+='x'],['scope',x=>x.subject.scope+='x'],['capability',x=>x.action_binding.capability_id+='x'],['operation',x=>x.action_binding.operation='other'],['authority',x=>x.action_binding.authority_scope='other'],
['target',x=>x.action_binding.target_binding_hash='sha256:'+'1'.repeat(64)],['frontier',x=>x.action_binding.predecessor_frontier+='x'],['availability',x=>x.evidence_binding.availability_binding_hash='sha256:'+'2'.repeat(64)],
['approval',x=>x.evidence_binding.approval_hash='sha256:'+'3'.repeat(64)],['permit',x=>x.evidence_binding.action_permit_hash='sha256:'+'4'.repeat(64)],['adapter role',x=>x.invocation.adapter_role='authority_source'],
['reuse',x=>x.invocation.one_shot=false],['preconsume',x=>x.invocation.consumed=true],['target guard',x=>x.invocation.expected_target_guard_used=false],['frontier guard',x=>x.invocation.expected_predecessor_guard_used=false],
['extend expiry',x=>x.invocation.expires_at='2026-08-24T20:00:00Z'],['late create',x=>x.created_at='2026-08-24T20:00:00Z'],['invoke claim',x=>x.non_effects.actuator_invocation_emitted=true],
['action receipt claim',x=>x.non_effects.action_receipt_created=true],['permit consumed claim',x=>x.non_effects.permit_consumed=true],['action claim',x=>x.non_effects.action_performed=true],
['outcome claim',x=>x.non_effects.outcome_observed=true],['authority claim',x=>x.non_effects.authority_created_or_expanded=true],['future claim',x=>x.non_effects.future_action_permission_created=true],
['general authority',x=>x.non_effects.general_authority_created=true],['guard assertion',x=>x.assertions.guards_fail_closed=false],['adapter assertion',x=>x.assertions.adapter_not_authority_source=false],['hash',x=>x.content_hash='sha256:'+'f'.repeat(64)]
];
let n=0;for(const [name,m] of ms){const x=structuredClone(f);m(x);try{v(x);throw Error('PASSED '+name)}catch(err){if(err.message.startsWith('PASSED'))throw err;n++}}
console.log(`Execution Invocation Envelope v0.1: positive fixture valid; ${n} negative mutations rejected; no actuator invoked.`);
