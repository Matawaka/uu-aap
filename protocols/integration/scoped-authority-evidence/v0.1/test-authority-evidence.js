'use strict';
const assert=require('node:assert/strict');
const {assessAuthorityEvidence}=require('./authority-evidence.js');

const base={
  issuer_ref:'issuer:synthetic:org-a',
  subject_ref:'subject:synthetic:alice',
  action:'review.approve',
  target_ref:'resource:doc-1',
  evaluation_time:'2026-08-30T02:00:00+05:00',
  valid_from:'2026-08-29T00:00:00+05:00',
  valid_until:'2026-09-01T00:00:00+05:00',
  allowed_actions:['review.approve'],
  allowed_targets:['resource:doc-1'],
  issuer_entitlement_evidence:[{ref:'ent:1',status:'SUPPORTS_ENTITLEMENT',independence_group:'policy-registry-a'}],
  execution_authority_requested:false,
  action_permit_requested:false
};
let r=assessAuthorityEvidence(base);
assert.equal(r.result,'SUPPORTED');
assert.equal(r.execution_authority_created,false);
assert.equal(r.action_permit_created,false);
assert.equal(r.materialization_authority_verified,false);

r=assessAuthorityEvidence({...base,issuer_entitlement_evidence:[]});
assert.equal(r.result,'INSUFFICIENT_EVIDENCE');
r=assessAuthorityEvidence({...base,issuer_entitlement_evidence:[...base.issuer_entitlement_evidence,{ref:'ent:2',status:'DISPUTES_ENTITLEMENT',independence_group:'registry-b'}]});
assert.equal(r.result,'DISPUTED');
r=assessAuthorityEvidence({...base,evaluation_time:'2026-09-02T00:00:00+05:00'});
assert.equal(r.result,'EXPIRED');
r=assessAuthorityEvidence({...base,revocation_evidence:true});
assert.equal(r.result,'REVOKED');
r=assessAuthorityEvidence({...base,action:'release.publish'});
assert.equal(r.result,'OUT_OF_SCOPE');
assert.throws(()=>assessAuthorityEvidence({...base,execution_authority_requested:true}));
assert.throws(()=>assessAuthorityEvidence({...base,action_permit_requested:true}));
assert.throws(()=>assessAuthorityEvidence({...base,parent_authority:{allowed_actions:['review.approve'],allowed_targets:['resource:doc-1']},allowed_actions:['review.approve','release.publish']}));
console.log('scoped authority evidence v0.1: ok');
