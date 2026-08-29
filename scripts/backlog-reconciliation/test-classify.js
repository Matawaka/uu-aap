'use strict';const assert=require('node:assert/strict');const {classifyIssue}=require('./classify.js');
let r=classifyIssue({issue_ref:'#1',merged_prs:['#2'],merge_shas:['abc'],implementation_paths:['protocols/x'],acceptance_complete:true});assert.equal(r.state,'COMPLETED');assert.equal(r.automatic_closure_authorized,false);
r=classifyIssue({issue_ref:'#2',merged_prs:['#3'],implementation_paths:[],acceptance_complete:null});assert.equal(r.state,'PARTIAL');
r=classifyIssue({issue_ref:'#3',superseded_by:'#4'});assert.equal(r.state,'SUPERSEDED');
r=classifyIssue({issue_ref:'#4',explicitly_still_open:true});assert.equal(r.state,'STILL_OPEN');
r=classifyIssue({issue_ref:'#5'});assert.equal(r.state,'INSUFFICIENT_EVIDENCE');
console.log('backlog reconciliation tests: ok');