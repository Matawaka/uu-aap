'use strict';
const assert=require('node:assert/strict');
const {recognizeSuccessor}=require('./policy-relative-materialization.js');

const authority={
  type:'MaterializationAuthorityReceipt',
  receipt_ref:'urn:uu-aap:materialization-authority:synthetic:1',
  result:'AUTHORIZED_IN_SCOPE',
  materialization_authority_supported:true,
  policy_id:'policy:synthetic:recognition',
  policy_version:'0.1',
  policy_scope:'repo:synthetic',
  subject_ref:'subject:synthetic:operator',
  action:'successor.materialize',
  predecessor_ref:'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  successor_ref:'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  target_ref:'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa->sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  evaluation_time:'2026-08-29T23:59:00Z',
  universal_canonicality_established:false,
  execution_authority_created:false,
  action_permit_created:false,
  external_effect_authority_created:false
};
const base={
  policy_id:authority.policy_id,
  policy_version:authority.policy_version,
  policy_scope:authority.policy_scope,
  predecessor_ref:authority.predecessor_ref,
  successor_ref:authority.successor_ref,
  decision_time:'2026-08-30T00:00:00Z',
  valid_from:'2026-08-29T00:00:00Z',
  valid_until:'2026-08-31T00:00:00Z',
  materialization_authority:authority,
  conflict_set_refs:[],dispute_refs:[],supersession_refs:[],appeal_refs:[],stay_refs:[],
  universal_canonicality_claim:false,
  execution_authority_requested:false,
  action_permit_requested:false
};
let r=recognizeSuccessor(base);
assert.equal(r.result,'RECOGNIZED_IN_SCOPE');
assert.equal(r.recognized_in_scope,true);
assert.equal(r.materialization_authority_binding.action,'successor.materialize');
assert.equal(r.universal_canonicality,false);
assert.equal(r.execution_authority_created,false);
assert.equal(r.certification_created,false);

r=recognizeSuccessor({...base,conflict_set_refs:['conflict:set:1']});
assert.equal(r.result,'CONTESTED');
r=recognizeSuccessor({...base,dispute_refs:['dispute:1']});
assert.equal(r.result,'CONTESTED');
r=recognizeSuccessor({...base,defer:true});
assert.equal(r.result,'DEFERRED');
r=recognizeSuccessor({...base,stay_refs:['stay:1']});
assert.equal(r.result,'DEFERRED');
r=recognizeSuccessor({...base,policy_reject:true,conflict_set_refs:['conflict:set:1']});
assert.equal(r.result,'REJECTED');
r=recognizeSuccessor({...base,materialization_authority:{...authority,result:'INSUFFICIENT_EVIDENCE',materialization_authority_supported:false}});
assert.equal(r.result,'INSUFFICIENT_EVIDENCE');
r=recognizeSuccessor({...base,materialization_authority:{...authority,successor_ref:'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'}});
assert.equal(r.result,'REJECTED');
r=recognizeSuccessor({...base,materialization_authority:{...authority,policy_scope:'repo:other'}});
assert.equal(r.result,'REJECTED');
r=recognizeSuccessor({...base,materialization_authority:{...authority,evaluation_time:'2026-08-30T00:01:00Z'}});
assert.equal(r.result,'INSUFFICIENT_EVIDENCE');
r=recognizeSuccessor({...base,valid_until:'2026-08-29T12:00:00Z'});
assert.equal(r.result,'DEFERRED');
r=recognizeSuccessor({...base,supersession_refs:['receipt:older'],appeal_refs:['appeal:1']});
assert.deepEqual(r.supersession_refs,['receipt:older']);
assert.deepEqual(r.appeal_refs,['appeal:1']);

assert.throws(()=>recognizeSuccessor({...base,decision_time:'not-a-time'}));
assert.throws(()=>recognizeSuccessor({...base,conflict_set_refs:'not-an-array'}));
assert.throws(()=>recognizeSuccessor({...base,universal_canonicality_claim:true,materialization_authority:{...authority,result:'INSUFFICIENT_EVIDENCE'}}));
assert.throws(()=>recognizeSuccessor({...base,execution_authority_requested:true}));
assert.throws(()=>recognizeSuccessor({...base,action_permit_requested:true}));
assert.throws(()=>recognizeSuccessor({...base,materialization_authority:{...authority,external_effect_authority_created:true}}));
console.log('policy-relative materialization v0.1: ok');
