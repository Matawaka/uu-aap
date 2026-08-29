'use strict';
const assert=require('node:assert/strict');
const {recognizeSuccessor}=require('./policy-relative-materialization.js');

const authority={
  type:'MaterializationAuthorityReceipt',
  receipt_ref:'urn:uu-aap:materialization-authority:synthetic:1',
  result:'AUTHORIZED_IN_SCOPE',
  policy_id:'policy:synthetic:recognition',
  policy_version:'0.1',
  policy_scope:'repo:synthetic',
  predecessor_ref:'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  successor_ref:'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
};
const base={
  policy_id:authority.policy_id,
  policy_version:authority.policy_version,
  policy_scope:authority.policy_scope,
  predecessor_ref:authority.predecessor_ref,
  successor_ref:authority.successor_ref,
  decision_time:'2026-08-30T00:00:00Z',
  materialization_authority:authority,
  conflict_set_refs:[],dispute_refs:[],supersession_refs:[],
  universal_canonicality_claim:false,
  execution_authority_requested:false,
  action_permit_requested:false
};
let r=recognizeSuccessor(base);
assert.equal(r.result,'RECOGNIZED_IN_SCOPE');
assert.equal(r.recognized_in_scope,true);
assert.equal(r.universal_canonicality,false);
assert.equal(r.execution_authority_created,false);

r=recognizeSuccessor({...base,conflict_set_refs:['conflict:a','conflict:b']});
assert.equal(r.result,'CONTESTED');
r=recognizeSuccessor({...base,dispute_refs:['dispute:1']});
assert.equal(r.result,'CONTESTED');
r=recognizeSuccessor({...base,defer:true});
assert.equal(r.result,'DEFERRED');
r=recognizeSuccessor({...base,policy_reject:true});
assert.equal(r.result,'REJECTED');
r=recognizeSuccessor({...base,materialization_authority:{...authority,result:'INSUFFICIENT_EVIDENCE'}});
assert.equal(r.result,'INSUFFICIENT_EVIDENCE');
r=recognizeSuccessor({...base,materialization_authority:{...authority,successor_ref:'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'}});
assert.equal(r.result,'REJECTED');
assert.throws(()=>recognizeSuccessor({...base,universal_canonicality_claim:true}));
assert.throws(()=>recognizeSuccessor({...base,execution_authority_requested:true}));
assert.throws(()=>recognizeSuccessor({...base,action_permit_requested:true}));
console.log('policy-relative materialization v0.1: ok');
