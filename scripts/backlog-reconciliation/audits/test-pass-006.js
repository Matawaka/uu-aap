'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {classifyIssue}=require('../classify.js');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'pass-006.json'),'utf8'));
assert.equal(audit.issues.length,5);
for(const e of audit.issues){
  const r=classifyIssue(e);
  assert.equal(r.implementation_state,'COMPLETED',`${e.issue_ref} implementation must be COMPLETED`);
  assert.equal(r.roadmap_state,'INSUFFICIENT_EVIDENCE',`${e.issue_ref} roadmap relevance is separate evidence`);
  assert.equal(r.automatic_closure_authorized,false);
  for(const p of e.implementation_paths) assert.equal(fs.existsSync(path.join(process.cwd(),p)),true,`${e.issue_ref} path missing: ${p}`);
}
console.log('backlog reconciliation pass 006: ok');
