'use strict';
const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const {classifyIssue}=require('./classify.js');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'audits/pass-001.json'),'utf8'));
assert.deepEqual(audit.scope,['#365','#367','#369']);
assert.equal(audit.non_effects.issue_state_mutated,false);
assert.equal(audit.non_effects.automatic_closure_authorized,false);
for(const entry of audit.entries){
  const receipt=classifyIssue(entry);
  assert.equal(receipt.state,'COMPLETED',`${entry.issue_ref} must reconcile as COMPLETED`);
  assert.equal(receipt.automatic_closure_authorized,false);
  assert.ok(receipt.successor_usage_refs.length>0);
  assert.ok(receipt.merge_shas.length>0);
  assert.ok(receipt.implementation_paths.length>0);
}
console.log('backlog reconciliation pass 001: ok');
