'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'pass-008.json'),'utf8'));
const allowed=new Set(['CURRENT','SUCCESSOR_NEEDED','WAITING_EXTERNAL','TARGET_SURFACE','INSUFFICIENT_EVIDENCE']);
assert.equal(audit.classification_mutates_issue,false);
assert.equal(audit.issues.length,12);
const byRef=new Map(audit.issues.map(x=>[x.issue_ref,x]));
for(const e of audit.issues){assert.equal(allowed.has(e.roadmap_role),true,`${e.issue_ref} invalid roadmap role`);assert.equal(Array.isArray(e.basis)&&e.basis.length>0,true,`${e.issue_ref} basis required`);}
assert.equal(byRef.get('#341').roadmap_role,'CURRENT');
assert.equal(byRef.get('#418').roadmap_role,'WAITING_EXTERNAL');
assert.equal(byRef.get('#420').roadmap_role,'WAITING_EXTERNAL');
for(const ref of ['#422','#435','#440']) assert.equal(byRef.get(ref).roadmap_role,'TARGET_SURFACE');
for(const ref of ['#445','#447','#449','#697']) assert.equal(byRef.get(ref).roadmap_role,'CURRENT');
for(const ref of ['#486','#492']) assert.equal(byRef.get(ref).roadmap_role,'WAITING_EXTERNAL');
assert.equal(audit.non_effects.issue_state_mutated,false);
assert.equal(audit.non_effects.roadmap_priority_created,false);
console.log('backlog reconciliation pass 008: ok');
