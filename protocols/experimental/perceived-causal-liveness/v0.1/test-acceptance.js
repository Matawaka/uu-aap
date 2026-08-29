'use strict';
const assert=require('node:assert/strict');
const {acceptanceReceipt}=require('./acceptance.js');
const all={progress_without_hidden_reasoning:true,stall_distinguishable:true,irreversible_timeout:true,closed_run_no_authority:true,late_result_rejected:true,successor_from_capsule:true,human_view_last_progress_and_next_safe_action:true};
const a=acceptanceReceipt(all);assert.equal(a.passed,true);assert.equal(a.production_ui_proven,false);assert.equal(a.release_authority_created,false);
assert.equal(acceptanceReceipt({...all,late_result_rejected:false}).passed,false);
console.log('liveness acceptance tests: ok');
