'use strict';
const assert=require('node:assert/strict');
const {assessMaterializationAuthority}=require('./materialization-authority.js');

const authority={
  type:'ScopedAuthorityEvidenceReceipt',
  receipt_ref:'authority:1',
  subject_ref:'subject:synthetic:operator',
  action:'successor.materialize',
  target_ref:'state:001->state:002',
  result:'SUPPORTED',
  materialization_authority_verified:false
};
const base={
  policy_id:'policy:synthetic-materialization',
  policy_version:'0.1',
  policy_scope:'repo:synthetic',
  subject_ref:'subject:synthetic:operator',
  action:'successor.materialize',
  predecessor_ref:'state:001',
  successor_ref:'state:002',
  evaluation_time:'2026-08-30T00:00:00Z',
  authority_receipts:[authority],
  revocation_evidence:false,
  dispute_evidence:false,
  execution_authority_requested:false,
  action_permit_requested:false,
  universal_canonicality_claim:false
};

let r=assessMaterializationAuthority(base);
assert.equal(r.result,'AUTHORIZED_IN_SCOPE');
assert.equal(r.policy_scope,base.policy_scope);
assert.equal(r.materialization_authority_supported,true);
assert.equal(r.execution_authority_created,false);
assert.equal(r.universal_canonicality_established,false);
assert.equal(r.action_permit_created,false);

r=assessMaterializationAuthority({...base,authority_receipts:[{...authority,target_ref:'state:x->state:y'}]});
assert.equal(r.result,'OUT_OF_SCOPE');
r=assessMaterializationAuthority({...base,authority_receipts:[{...authority,result:'DISPUTED'}]});
assert.equal(r.result,'DISPUTED');
r=assessMaterializationAuthority({...base,authority_receipts:[{...authority,result:'REVOKED'}]});
assert.equal(r.result,'REVOKED');
r=assessMaterializationAuthority({...base,authority_receipts:[{...authority,result:'EXPIRED'}]});
assert.equal(r.result,'EXPIRED');
r=assessMaterializationAuthority({...base,authority_receipts:[{...authority,result:'INSUFFICIENT_EVIDENCE'}]});
assert.equal(r.result,'INSUFFICIENT_EVIDENCE');

assert.throws(()=>assessMaterializationAuthority({...base,policy_scope:''}));
assert.throws(()=>assessMaterializationAuthority({...base,execution_authority_requested:true}));
assert.throws(()=>assessMaterializationAuthority({...base,action_permit_requested:true}));
assert.throws(()=>assessMaterializationAuthority({...base,universal_canonicality_claim:true}));
console.log('materialization authority v0.1: ok');
