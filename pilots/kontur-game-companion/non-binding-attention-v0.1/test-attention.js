'use strict';

const assert=require('node:assert/strict');
const {contestedCueReceipt}=require('../dlc-si-attention-contention/adapter.js');
const {buildNonBindingAttentionReceipt}=require('./attention.js');

const base={
  contention_id:'kontur-attention-energy-001',
  source_conflict_refs:['kontur:focus:bounded:1'],
  claims:[
    {claim_id:'cue-a',legitimacy_ref:'evidence:a',successor_state_ref:'focus:a',correct_answer:false,instruction:false},
    {claim_id:'cue-b',legitimacy_ref:'evidence:b',successor_state_ref:'focus:b',correct_answer:false,instruction:false}
  ],
  safe_work:['observe_without_cue'],
  evaluated_at:'2026-08-30T00:05:00Z'
};

const deferredInput={...base,resolution:{mode:'DEFERRED',selected_claim_id:null,justification:'preserve plurality while no bounded precedence is justified',lease:null,revisit_triggers:['new_evidence']}};
const deferredReceipt=contestedCueReceipt(deferredInput);
let r=buildNonBindingAttentionReceipt({
  contention_input:deferredInput,
  source_receipt:deferredReceipt,
  attention_need:'NOTICE_ONLY',
  cue_id:null,
  explicit_help_request:false
});
assert.equal(r.state,'DEFERRED_NO_CUE');
assert.equal(r.signal_class,'NONE');
assert.equal(r.emitted_cue_id,null);
assert.deepEqual(r.preserved_cue_ids,['cue-a','cue-b']);
assert.equal(r.normative_winner,false);

const precedenceInput={...base,contention_id:'kontur-attention-energy-002',evaluated_at:'2026-08-30T00:05:30Z',resolution:{
  mode:'TEMPORARY_PRECEDENCE',
  selected_claim_id:'cue-a',
  justification:'bounded indication-only precedence',
  lease:{
    authority_ref:'human-policy:cursor-v1',
    scope:['cursor:indication-only'],
    starts_at:'2026-08-30T00:05:00Z',
    expires_at:'2026-08-30T00:06:00Z',
    revocation_conditions:['player_decline'],
    revisit_triggers:['lease_expiry','new_evidence'],
    successor_state_constraints:['no-solution-disclosure']
  },
  revisit_triggers:['lease_expiry','new_evidence']
}};
const precedenceReceipt=contestedCueReceipt(precedenceInput);

r=buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-a',explicit_help_request:false});
assert.equal(r.signal_class,'PERIPHERAL');
assert.equal(r.emitted_cue_id,'cue-a');
assert.equal(r.signal_is_minimal_for_need,true);

r=buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'FOCUS_REQUESTED',cue_id:'cue-a',explicit_help_request:false});
assert.equal(r.signal_class,'FOCUSED_NUDGE');

r=buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'HINT_EXPLICITLY_REQUESTED',cue_id:'cue-a',explicit_help_request:true});
assert.equal(r.signal_class,'EXPLICIT_HINT');
assert.equal(r.solution_disclosed,false);
assert.equal(r.instruction,false);
assert.equal(r.correct_answer,false);
assert.equal(r.response_authority_created,false);
assert.equal(r.action_permit_created,false);
assert.equal(r.external_effect_authority_created,false);

r=buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NO_CUE_NEEDED',cue_id:'cue-a',explicit_help_request:false});
assert.equal(r.signal_class,'NONE');
assert.equal(r.emitted_cue_id,null);
assert.equal(r.next_safe_action,'OBSERVE_OR_WAIT_WITHOUT_CUE');

assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'HINT_EXPLICITLY_REQUESTED',cue_id:'cue-a',explicit_help_request:false}),/explicit help request/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-a',signal_override:'EXPLICIT_HINT'}),/signal energy override/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-b'}),/DLC-SI selected cue/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:deferredInput,source_receipt:deferredReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-a'}),/deferred contention cannot emit/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:{...precedenceReceipt,selected_cue_id:'cue-b'},attention_need:'NOTICE_ONLY',cue_id:'cue-b'}),/exactly re-derive/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-a',solution_disclosure_requested:true}),/solution disclosure/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-a',optimization:{engagement_optimization:true}}),/engagement_optimization forbidden/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-a',optimization:{interest_score:0.9}}),/interest_score forbidden/);
assert.throws(()=>buildNonBindingAttentionReceipt({contention_input:precedenceInput,source_receipt:precedenceReceipt,attention_need:'NOTICE_ONLY',cue_id:'cue-a',optimization:{predicted_interest_override:true}}),/predicted_interest_override forbidden/);

console.log('KONTUR non-binding attention / minimal hint energy v0.1: ok');
