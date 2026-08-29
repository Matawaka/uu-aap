'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildReceipt}=require('../v0.1/dlc-si.js');
const {successorEnvelope}=require('./compatibility.js');
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'../v0.1/examples/temporary-precedence.contention.json'),'utf8'));
const before=buildReceipt(fixture);
const out=successorEnvelope({
  v01_contention:fixture,
  decomposition:{options:[{option_id:'late-b',dimension:'TIME',safe:true,preserves_causal_value_a:true,preserves_causal_value_b:false}]},
  post_execution:{outcome_ref:'outcome:observed',executed_at:fixture.evaluated_at},
  relation_input:{claim_a_ref:before.claim_refs[0].claim_id,claim_b_ref:before.claim_refs[1].claim_id,relation:'INCOMPARABLE',evidence_refs:['v0.1:'+before.fingerprint_sha256]},
  safe_work:{work_items:[{work_id:'observe',reversible:true,conflicts_with_contested_portion:false},{work_id:'commit',reversible:false,conflicts_with_contested_portion:true}]}
});
const after=buildReceipt(fixture);
assert.equal(after.fingerprint_sha256,before.fingerprint_sha256);
assert.equal(out.predecessor.fingerprint_sha256,before.fingerprint_sha256);
assert.equal(out.predecessor_fingerprint_preserved,true);
assert.equal(out.v01_semantics_rewritten,false);
assert.equal(out.external_effect_authority_created,false);
assert.equal(out.decomposition.choice.mode,'TEMPORARY_PRECEDENCE_ELIGIBLE');
assert.equal(out.decomposition.choice.requires_separate_bounded_precedence_authority,true);
assert.equal(out.post_execution.contested,true);
assert.equal(out.post_execution.normative_winner,null);
assert.equal(out.safe_work_gate.work.find(x=>x.work_id==='observe').may_proceed,true);
assert.equal(out.safe_work_gate.work.find(x=>x.work_id==='commit').may_proceed,false);
console.log('dlc-si v0.2 compatibility tests: ok');
