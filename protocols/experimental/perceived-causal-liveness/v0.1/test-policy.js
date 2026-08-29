'use strict';
const assert=require('node:assert/strict');
const {createLivenessPolicyReceipt,applyPolicyToRun}=require('./policy.js');
const p=createLivenessPolicyReceipt({policy_id:'policy:interactive',profile:'interactive',issued_at:'2026-08-29T16:00:00Z',issuer_ref:'runtime-profile:v0.1',suspect_after_ms:30000,close_after_ms:90000,max_suspect_after_ms:60000,max_close_after_ms:180000});
assert.equal(p.unbounded_lease_allowed,false);assert.equal(p.creates_external_effect_authority,false);
const r=applyPolicyToRun({run:{run_id:'r1',run_epoch:1},policy:p});assert.equal(r.policy_profile,'interactive');assert.equal(r.close_after_ms,90000);
assert.throws(()=>createLivenessPolicyReceipt({policy_id:'x',profile:'x',issued_at:'x',issuer_ref:'x',suspect_after_ms:70000,close_after_ms:90000,max_suspect_after_ms:60000,max_close_after_ms:180000}),/exceeds bounded maxima/);
assert.throws(()=>createLivenessPolicyReceipt({policy_id:'x',profile:'x',issued_at:'x',issuer_ref:'x',suspect_after_ms:30000,close_after_ms:30000,max_suspect_after_ms:60000,max_close_after_ms:180000}),/must exceed/);
console.log('liveness policy tests: ok');
