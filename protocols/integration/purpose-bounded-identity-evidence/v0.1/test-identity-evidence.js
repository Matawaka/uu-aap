'use strict';
const assert=require('node:assert/strict');
const {assessIdentityEvidence}=require('./identity-evidence.js');

const base={
  purpose_id:'purpose:local-account-recovery-check',
  subject_ref:'subject:synthetic:alice',
  psr_root_ref:'psr:synthetic:alice-example:001',
  assessment_requested:true,
  cross_context_correlation_performed:false,
  biometric_required:false,
  universal_identity_claim:false,
  legal_identity_claim:false,
  evidence_refs:[
    {ref:'ev:1',status:'SUPPORTS_MATCH',independence_group:'institution-a'},
    {ref:'ev:2',status:'SUPPORTS_MATCH',independence_group:'witness-b'}
  ]
};
let r=assessIdentityEvidence(base);
assert.equal(r.result,'MATCH_SUPPORTED');
assert.equal(r.legal_identity_established,false);
assert.equal(r.authority_established,false);
assert.equal(r.universal_identity_proof,false);

r=assessIdentityEvidence({...base,evidence_refs:[base.evidence_refs[0]]});
assert.equal(r.result,'INSUFFICIENT_EVIDENCE');

r=assessIdentityEvidence({...base,evidence_refs:[...base.evidence_refs,{ref:'ev:3',status:'DISPUTES_MATCH',independence_group:'witness-c'}]});
assert.equal(r.result,'MATCH_DISPUTED');

r=assessIdentityEvidence({...base,assessment_requested:false});
assert.equal(r.result,'NOT_ASSESSED');

assert.throws(()=>assessIdentityEvidence({...base,cross_context_correlation_performed:true}));
assert.throws(()=>assessIdentityEvidence({...base,biometric_required:true}));
assert.throws(()=>assessIdentityEvidence({...base,universal_identity_claim:true}));
assert.throws(()=>assessIdentityEvidence({...base,legal_identity_claim:true}));
console.log('purpose-bounded identity evidence v0.1: ok');
