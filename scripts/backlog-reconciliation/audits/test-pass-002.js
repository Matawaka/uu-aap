'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {classifyIssue}=require('../classify.js');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'pass-002.json'),'utf8'));
assert.equal(audit.classification_mutates_issue,false);
for(const e of audit.issues){
  const r=classifyIssue({...e,roadmap_current:false});
  assert.equal(r.implementation_state,'COMPLETED',`${e.issue_ref} should reconcile implementation as COMPLETED`);
  assert.equal(r.roadmap_state,'INSUFFICIENT_EVIDENCE',`${e.issue_ref} roadmap state is not inferred from implementation completion`);
  assert.equal(r.automatic_closure_authorized,false);
  for(const p of e.implementation_paths) assert.equal(fs.existsSync(path.join(process.cwd(),p)),true,`${e.issue_ref} implementation path missing: ${p}`);
}
console.log('backlog reconciliation pass 002 dual-axis: ok');
