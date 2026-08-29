'use strict';
const assert=require('node:assert/strict');
const {causalValueReceipt,evaluateDecomposition}=require('./causal-value-evidence.js');
function r(id,claim,result,from='2026-08-29T10:00:00Z',until='2026-08-29T12:00:00Z'){
  return causalValueReceipt({type:'CAUSAL_VALUE_EVIDENCE',receipt_id:id,claim_ref:claim,successor_condition_ref:`succ:${claim}`,decomposition_option_ref:'opt:1',result,observed_basis_ref:`evidence:${id}`,valid_from:from,valid_until:until});
}
let a=evaluateDecomposition({option_ref:'opt:1',claim_receipts:[r('a','A','PRESERVED'),r('b','B','PRESERVED')],evaluated_at:'2026-08-29T11:00:00Z'});
assert.equal(a.result,'PRESERVED');assert.equal(a.partition_or_defer_sufficient,true);assert.equal(a.temporary_precedence_eligible,false);
a=evaluateDecomposition({option_ref:'opt:1',claim_receipts:[r('a','A','PRESERVED'),r('b','B','LOST')],evaluated_at:'2026-08-29T11:00:00Z'});
assert.equal(a.result,'NOT_PRESERVED');assert.equal(a.temporary_precedence_eligible,true);
a=evaluateDecomposition({option_ref:'opt:1',claim_receipts:[r('a','A','PRESERVED'),r('b','B','UNKNOWN')],evaluated_at:'2026-08-29T11:00:00Z'});
assert.equal(a.result,'UNKNOWN');assert.equal(a.temporary_precedence_eligible,false);assert.equal(a.unresolved_evidence,true);
a=evaluateDecomposition({option_ref:'opt:1',claim_receipts:[r('a','A','PRESERVED','2026-08-29T08:00:00Z','2026-08-29T09:00:00Z'),r('b','B','PRESERVED')],evaluated_at:'2026-08-29T11:00:00Z'});
assert.equal(a.result,'UNKNOWN');assert.equal(a.unknown_creates_precedence_eligibility,false);
console.log('dlc-si causal value evidence tests: ok');
