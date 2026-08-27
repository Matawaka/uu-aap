'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { canonicalFingerprint: requestFingerprint, validateRequestReceipt } = require('../control-request/control-request.js');
const { canonicalFingerprint: authorityFingerprint } = require('../authority-evaluation/authority-evaluation.js');
const { buildCoreAuthorityReceipt, coreContentHash } = require('../core-authority-binding/core-authority-binding.js');
const { buildCoreCoordinationReceipt } = require('../core-coordination-binding/core-coordination-binding.js');
const { buildCoreActionPermit } = require('../core-action-permit-binding/core-action-permit-binding.js');
const {
  FCLActionSpecificApprovalError,
  buildApprovalBinding,
  buildApprovalReceipt,
  receiptFingerprint,
  sha256Object,
  validateApprovalBinding,
  validateApprovalReceipt,
  validateInput
} = require('./action-specific-approval.js');

const clone=value=>JSON.parse(JSON.stringify(value));
const ORIGIN={repository:'Matawaka/uu-aap',revision:'82ec62d59e5902241365d7deba78f3b04bcb4106',tree:'a5d37597d4f8a831575be70eec91890798e659a9'};
const ACTOR={id:'actor:fcl-runtime-controller',key_ref:'key:fcl-runtime-controller'};

function expectFailure(label,fn,pattern){
  let failed=false;
  try{fn();}catch(error){failed=true;assert(error instanceof FCLActionSpecificApprovalError,`${label}: expected FCLActionSpecificApprovalError, got ${error&&error.name}`);if(pattern)assert(pattern.test(error.message),`${label}: unexpected ${error.message}`);}
  assert(failed,`${label}: expected failure`);
}
function rehashCore(receipt){receipt.content_hash=coreContentHash(receipt);return receipt;}
function refingerprint(receipt){receipt.fingerprint_sha256=receiptFingerprint(receipt);return receipt;}

function loadInterruptPermitSample(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fcl-approval-permit-'));
  const permitPath=path.join(dir,'permit.json');
  const inputPath=path.join(dir,'permit-input.json');
  const script=path.resolve(__dirname,'../core-action-permit-binding/test-core-action-permit-binding.js');
  const run=spawnSync(process.execPath,[script,permitPath,inputPath],{encoding:'utf8'});
  assert.strictEqual(run.status,0,`predecessor ActionPermit suite failed: ${run.stderr}`);
  return {permit:JSON.parse(fs.readFileSync(permitPath,'utf8')),permitInput:JSON.parse(fs.readFileSync(inputPath,'utf8'))};
}

function makeRequestReceipt(permitInput,permit,eventSuffix='interrupt'){
  const fcl=permitInput.core_coordination_binding_input.fcl_authority_evaluation;
  const receipt={
    protocol:'FCL',version:'0.1',receipt_type:'UserControlRequestReceipt',
    request_id:fcl.request_id,
    source_view_fingerprint:`sha256:${'4'.repeat(64)}`,
    source_adapter_id:'runtime-ui-test-adapter',
    source_display_state:fcl.requested_control==='REQUEST_INTERRUPT'?'STALL_SUSPECTED':'CONTINUATION_AVAILABLE',
    source_run_id:fcl.current_run_id,
    source_run_epoch:fcl.current_run_epoch,
    source_chain_id:fcl.current_chain_id,
    intent_ref:fcl.intent_ref,
    requested_control:fcl.requested_control,
    request_semantics:'EXPLICIT_HUMAN_REQUEST_ONLY',
    human_event_id:`request-event-${eventSuffix}`,
    human_event_kind:'POINTER_ACTIVATION',
    human_event_occurred_at:fcl.requested_control==='REQUEST_INTERRUPT'?'2026-08-27T18:00:55Z':'2026-08-27T20:04:55Z',
    source_rendered_at:fcl.requested_control==='REQUEST_INTERRUPT'?'2026-08-27T18:00:54Z':'2026-08-27T20:04:54Z',
    requested_at:fcl.requested_control==='REQUEST_INTERRUPT'?'2026-08-27T18:00:56Z':'2026-08-27T20:04:56Z',
    expressed_request_recorded:true,
    internal_intent_proven:false,
    non_induced_intent_proven:false,
    request_requires_current_state_revalidation:true,
    request_requires_downstream_gate:true,
    interrupt_completed:false,
    continuation_receipt_created:false,
    successor_run_created:false,
    runtime_state_transitioned:false,
    progress_created:false,
    liveness_proven:false,
    action_permit_established:false,
    execution_admitted:false,
    authority_established:false,
    hidden_reasoning_included:false,
    next_safe_action:fcl.requested_control==='REQUEST_INTERRUPT'?'EVALUATE_INTERRUPT_REQUEST':'EVALUATE_SUCCESSOR_REQUEST',
    fingerprint_sha256:''
  };
  receipt.fingerprint_sha256=requestFingerprint(receipt);
  validateRequestReceipt(receipt);
  assert.strictEqual(permit.payload.requested_control,receipt.requested_control);
  return receipt;
}

function positiveAuthority(control='REQUEST_SUCCESSOR'){
  const successor=control==='REQUEST_SUCCESSOR';
  const runId=successor?'run-successor-approval':'run-interrupt-approval';
  const epoch=successor?42:37;
  const scope=successor?'fcl.run.successor.create':'fcl.run.interrupt';
  const at=successor?'2026-08-27T20:05:01Z':'2026-08-27T20:01:01Z';
  const receipt={protocol:'FCL',version:'0.1',receipt_type:'FCLAuthorityEvaluationReceipt',authority_evaluation_id:`authority-${successor?'successor':'interrupt'}-approval`,request_evaluation_id:`evaluation-${successor?'successor':'interrupt'}-approval`,request_evaluation_fingerprint:`sha256:${'1'.repeat(64)}`,request_id:`request-${successor?'successor':'interrupt'}-approval`,requested_control:control,current_run_id:runId,current_run_epoch:epoch,current_chain_id:`chain-${successor?'successor':'interrupt'}-approval`,intent_ref:`intent:approval:${successor?'successor':'interrupt'}`,effect_actor_subject:clone(ACTOR),required_scope:scope,required_target:`urn:uu-aap:fcl:run:${runId}:epoch:${epoch}`,poai_verification_id:`urn:poai:authority-verification:fcl-${successor?'successor':'interrupt'}-approval`,poai_authority_result_binding_sha256:`sha256:${'2'.repeat(64)}`,poai_verified_at:successor?'2026-08-27T20:05:00Z':'2026-08-27T20:01:00Z',poai_verification_required_scope:scope,poai_verification_target:`urn:uu-aap:fcl:run:${runId}:epoch:${epoch}`,classification:'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED',request_current:true,poai_authority_result_valid:true,poai_status_established:true,issuer_entitlement_chain_valid:true,root_accepted_by_policy:true,scope_match:true,target_match:true,subject_match:true,authority_evidence_fresh:true,preexisting_request_scoped_authority_observed:true,forwardable_to_core_authority_adapter:true,authority_granted_by_evaluator:false,authority_expanded_by_evaluator:false,core_authority_receipt_created:false,request_effect_authorized:false,action_permit_established:false,execution_admitted:false,interrupt_completed:false,continuation_receipt_created:false,successor_run_created:false,runtime_state_transitioned:false,progress_created:false,liveness_proven:false,legal_identity_verified:false,legal_authority_established:false,universal_authority_established:false,legal_effect_established:false,truth_certified:false,causal_proof_certified:false,legal_responsibility_determined:false,liability_established:false,private_reasoning_included:false,next_safe_action:'BIND_CORE_AUTHORITY_RECEIPT',evaluated_at:at,fingerprint_sha256:''};
  receipt.fingerprint_sha256=authorityFingerprint(receipt);return receipt;
}
function successorPermitSample(){
  const fcl=positiveAuthority('REQUEST_SUCCESSOR');
  const stateAt='2026-08-27T20:04:58Z',availabilityAt='2026-08-27T20:04:59Z',intentAt='2026-08-27T20:05:00Z',authorityAt='2026-08-27T20:05:02Z',coordinationAt='2026-08-27T20:05:03Z',validUntil='2026-08-27T20:06:00Z',permitAt='2026-08-27T20:05:04Z',expiresAt='2026-08-27T20:05:50Z';
  const subject={id:`urn:uu-aap:fcl:control:${fcl.request_id}`,scope:'fcl-control-request'};
  const frontier={revision:`fcl:${fcl.current_run_id}:epoch:${fcl.current_run_epoch}`,observed_at:stateAt};
  const intentBinding={intent_ref:fcl.intent_ref,requested_control:fcl.requested_control,run_id:fcl.current_run_id,run_epoch:fcl.current_run_epoch,chain_id:fcl.current_chain_id,required_scope:fcl.required_scope,required_target:fcl.required_target};
  const availabilityBinding={run_id:fcl.current_run_id,run_epoch:fcl.current_run_epoch,chain_id:fcl.current_chain_id,operation_scope:fcl.required_scope,target:fcl.required_target};
  const state=rehashCore({protocol:'UU-AAP Core',version:'0.1',receipt_type:'StateReceipt',subject:clone(subject),frontier:clone(frontier),predecessor_receipt_hashes:[],assertions:{state_anchored:true,evidence_scope_declared:true},non_effects:{intent_established:false,authority_established:false,action_performed:false,liability_established:false,truth_certified:false},issuer:{id:'urn:uu-aap:test:fcl-state-source',assurance:'observed_test_state'},issued_at:stateAt,payload:{evidence_refs:['urn:evidence:fcl:successor-approval']},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''});
  const availability=rehashCore({protocol:'UU-AAP Core',version:'0.1',receipt_type:'AvailabilityClaim',subject:clone(subject),frontier:clone(frontier),predecessor_receipt_hashes:[state.content_hash],assertions:{availability_qualified:true,capability:fcl.required_scope},non_effects:{intent_established:false,action_performed:false,liability_established:false,truth_certified:false},issuer:{id:'urn:uu-aap:test:fcl-availability-source',assurance:'bounded_test_availability'},issued_at:availabilityAt,payload:{status:'available',valid_until:validUntil,resource:fcl.required_target,fcl_binding:availabilityBinding},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''});
  const intent=rehashCore({protocol:'UU-AAP Core',version:'0.1',receipt_type:'IntentReceipt',subject:clone(subject),frontier:clone(frontier),predecessor_receipt_hashes:[state.content_hash],assertions:{intent_declared:true,intent_scope:fcl.required_scope},non_effects:{action_performed:false,authority_expanded:false,responsibility_accepted:false,liability_established:false},issuer:{id:'urn:uu-aap:test:fcl-intent-source',assurance:'explicit_test_intent'},issued_at:intentAt,payload:{source:'explicit_fcl_control_intent',fcl_binding:intentBinding},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''});
  const authority=buildCoreAuthorityReceipt({protocol:'FCL',version:'0.1',profile:'core-authority-binding-v0.1',binding_id:`binding-${fcl.request_id}`,origin:clone(ORIGIN),fcl_authority_evaluation:clone(fcl),core_intent_receipt:clone(intent),issued_at:authorityAt});
  const coordinationInput={protocol:'FCL',version:'0.1',profile:'core-coordination-binding-v0.1',coordination_id:`coordination-${fcl.request_id}`,origin:clone(ORIGIN),fcl_authority_evaluation:fcl,core_state_receipt:state,core_availability_claim:availability,core_intent_receipt:intent,core_authority_receipt:authority,issued_at:coordinationAt};
  const coordination=buildCoreCoordinationReceipt(coordinationInput);
  const permitInput={protocol:'FCL',version:'0.1',profile:'core-action-permit-binding-v0.1',permit_id:'permit-successor-approval',origin:clone(ORIGIN),core_coordination_binding_input:coordinationInput,core_coordination_receipt:coordination,issued_at:permitAt,expires_at:expiresAt};
  return {permitInput,permit:buildCoreActionPermit(permitInput)};
}

function approvalInput(sample=null){
  const s=sample||loadInterruptPermitSample();
  const request=makeRequestReceipt(s.permitInput,s.permit,s.permit.payload.requested_control==='REQUEST_INTERRUPT'?'interrupt':'successor');
  const successor=s.permit.payload.requested_control==='REQUEST_SUCCESSOR';
  return {protocol:'FCL',version:'0.1',profile:'action-specific-approval-v0.1',approval_id:successor?'approval-successor-test':'approval-interrupt-test',origin:clone(ORIGIN),user_control_request_receipt:request,core_action_permit_binding_input:clone(s.permitInput),core_action_permit:clone(s.permit),approval_event:{event_id:successor?'approval-event-successor':'approval-event-interrupt',event_kind:'KEYBOARD_ACTIVATION',target_action_permit_hash:s.permit.content_hash,target_coordination_receipt_hash:s.permitInput.core_coordination_receipt.content_hash,target_binding_hash:s.permit.payload.target_binding_hash,occurred_at:successor?'2026-08-27T20:05:05Z':'2026-08-27T18:01:05Z',human_initiated:true,passive_observation:false},issued_at:successor?'2026-08-27T20:05:06Z':'2026-08-27T18:01:06Z',valid_until:successor?'2026-08-27T20:05:40Z':'2026-08-27T18:01:40Z'};
}

function testPositiveInterruptApproval(){const input=approvalInput(),r=buildApprovalReceipt(input);assert.strictEqual(r.explicit_approval_recorded,true);assert.strictEqual(r.requested_control,'REQUEST_INTERRUPT');assert.strictEqual(r.approval_binding.kind,'action_specific');assert.strictEqual(validateApprovalReceipt(r,input),true);}
function testPositiveSuccessorApproval(){const sample=successorPermitSample(),input=approvalInput(sample),r=buildApprovalReceipt(input);assert.strictEqual(r.requested_control,'REQUEST_SUCCESSOR');assert.strictEqual(r.approval_binding.operation,'fcl.run.successor.create');assert.strictEqual(validateApprovalReceipt(r,input),true);}
function testApprovalBindingHashParity(){const input=approvalInput(),b=buildApprovalBinding(input);assert.strictEqual(b.content_hash,sha256Object(b));assert.strictEqual(validateApprovalBinding(b,input),true);}
function testDeterministicReceiptFingerprint(){const input=approvalInput(),a=buildApprovalReceipt(input),b=buildApprovalReceipt(clone(input));assert.deepStrictEqual(a,b);assert.strictEqual(a.fingerprint_sha256,receiptFingerprint(a));}
function testRequestMustMatchPermitRequestId(){const input=approvalInput();input.user_control_request_receipt.request_id='request-other';input.user_control_request_receipt.fingerprint_sha256=requestFingerprint(input.user_control_request_receipt);expectFailure('request id',()=>validateInput(input),/request_id mismatch/);}
function testRequestControlMismatch(){const input=approvalInput();input.user_control_request_receipt.requested_control='REQUEST_SUCCESSOR';input.user_control_request_receipt.source_display_state='CONTINUATION_AVAILABLE';input.user_control_request_receipt.next_safe_action='EVALUATE_SUCCESSOR_REQUEST';input.user_control_request_receipt.fingerprint_sha256=requestFingerprint(input.user_control_request_receipt);expectFailure('request control',()=>validateInput(input),/requested_control mismatch|request receipt invalid/);}
function testRunMismatch(){const input=approvalInput();input.user_control_request_receipt.source_run_id='run-other';input.user_control_request_receipt.fingerprint_sha256=requestFingerprint(input.user_control_request_receipt);expectFailure('run mismatch',()=>validateInput(input),/run_id mismatch/);}
function testEpochMismatch(){const input=approvalInput();input.user_control_request_receipt.source_run_epoch+=1;input.user_control_request_receipt.fingerprint_sha256=requestFingerprint(input.user_control_request_receipt);expectFailure('epoch mismatch',()=>validateInput(input),/run_epoch mismatch/);}
function testChainMismatch(){const input=approvalInput();input.user_control_request_receipt.source_chain_id='chain-other';input.user_control_request_receipt.fingerprint_sha256=requestFingerprint(input.user_control_request_receipt);expectFailure('chain mismatch',()=>validateInput(input),/chain_id mismatch/);}
function testIntentMismatch(){const input=approvalInput();input.user_control_request_receipt.intent_ref='intent:other';input.user_control_request_receipt.fingerprint_sha256=requestFingerprint(input.user_control_request_receipt);expectFailure('intent mismatch',()=>validateInput(input),/intent_ref mismatch/);}
function testTamperedRequestFingerprintRejected(){const input=approvalInput();input.user_control_request_receipt.fingerprint_sha256=`sha256:${'0'.repeat(64)}`;expectFailure('request fingerprint',()=>validateInput(input),/request receipt invalid/);}
function testTamperedPermitRejected(){const input=approvalInput();input.core_action_permit.content_hash=`sha256:${'0'.repeat(64)}`;expectFailure('permit tamper',()=>validateInput(input),/ActionPermit invalid/);}
function testPermitConsumedRejected(){const input=approvalInput();input.core_action_permit.payload.consumed=true;rehashCore(input.core_action_permit);expectFailure('permit consumed',()=>validateInput(input),/ActionPermit invalid|unconsumed/);}
function testPermitOneShotRequired(){const input=approvalInput();input.core_action_permit.payload.one_shot=false;rehashCore(input.core_action_permit);expectFailure('permit one shot',()=>validateInput(input),/ActionPermit invalid|one_shot/);}
function testExecuteRevalidationRequired(){const input=approvalInput();input.core_action_permit.payload.execute_revalidation_required=false;rehashCore(input.core_action_permit);expectFailure('revalidation',()=>validateInput(input),/ActionPermit invalid|execute revalidation/);}
function testPassiveEventRejected(){const input=approvalInput();input.approval_event.passive_observation=true;expectFailure('passive event',()=>validateInput(input),/passive observation/);}
function testNonHumanEventRejected(){const input=approvalInput();input.approval_event.human_initiated=false;expectFailure('non-human event',()=>validateInput(input),/human_initiated/);}
function testUnsupportedEventKindRejected(){const input=approvalInput();input.approval_event.event_kind='HOVER';expectFailure('hover event',()=>validateInput(input),/explicit human activation/);}
function testRequestEventReuseRejected(){const input=approvalInput();input.approval_event.event_id=input.user_control_request_receipt.human_event_id;expectFailure('event reuse',()=>validateInput(input),/cannot be reused/);}
function testPermitHashSubstitutionRejected(){const input=approvalInput();input.approval_event.target_action_permit_hash=`sha256:${'1'.repeat(64)}`;expectFailure('permit event hash',()=>validateInput(input),/ActionPermit hash mismatch/);}
function testCoordinationHashSubstitutionRejected(){const input=approvalInput();input.approval_event.target_coordination_receipt_hash=`sha256:${'1'.repeat(64)}`;expectFailure('coord hash',()=>validateInput(input),/CoordinationReceipt hash mismatch/);}
function testTargetHashSubstitutionRejected(){const input=approvalInput();input.approval_event.target_binding_hash=`sha256:${'1'.repeat(64)}`;expectFailure('target hash',()=>validateInput(input),/target binding hash mismatch/);}
function testApprovalBeforePermitRejected(){const input=approvalInput();input.approval_event.occurred_at='2026-08-27T18:01:03Z';expectFailure('approval before permit',()=>validateInput(input),/cannot precede ActionPermit/);}
function testReceiptBeforeEventRejected(){const input=approvalInput();input.issued_at='2026-08-27T18:01:04Z';expectFailure('receipt before event',()=>validateInput(input),/cannot precede approval event/);}
function testZeroApprovalLifetimeRejected(){const input=approvalInput();input.valid_until=input.issued_at;expectFailure('zero approval lifetime',()=>validateInput(input),/must be after issued_at/);}
function testApprovalBeyondPermitRejected(){const input=approvalInput();input.valid_until='2026-08-27T18:01:51Z';expectFailure('beyond permit',()=>validateInput(input),/exceeds ActionPermit expiry/);}
function testApprovalCannotOutlivePermitOrAvailability(){const input=approvalInput();input.core_action_permit.payload.expires_at='2026-08-27T18:02:00Z';rehashCore(input.core_action_permit);input.core_action_permit_binding_input.expires_at='2026-08-27T18:02:00Z';input.approval_event.target_action_permit_hash=input.core_action_permit.content_hash;input.valid_until='2026-08-27T18:02:01Z';expectFailure('approval horizon',()=>validateInput(input),/exceeds ActionPermit expiry|exceeds availability horizon|ActionPermit invalid/);}
function testBindingKindMutationRejected(){const input=approvalInput(),r=buildApprovalReceipt(input);r.approval_binding.kind='protocol_mode';r.approval_binding.content_hash=sha256Object(r.approval_binding);refingerprint(r);expectFailure('binding kind',()=>validateApprovalReceipt(r,input),/kind must be action_specific/);}
function testBindingReusableRejected(){const input=approvalInput(),r=buildApprovalReceipt(input);r.approval_binding.one_shot=false;r.approval_binding.content_hash=sha256Object(r.approval_binding);refingerprint(r);expectFailure('binding reusable',()=>validateApprovalReceipt(r,input),/one_shot/);}
function testOutputPermitHashMutationRejected(){const input=approvalInput(),r=buildApprovalReceipt(input);r.core_action_permit_hash=`sha256:${'f'.repeat(64)}`;refingerprint(r);expectFailure('receipt permit hash',()=>validateApprovalReceipt(r,input),/ActionPermit hash mismatch/);}
function testOutputRequestReinterpretationRejected(){const input=approvalInput(),r=buildApprovalReceipt(input);r.request_reinterpreted_as_approval=true;refingerprint(r);expectFailure('request reinterpretation',()=>validateApprovalReceipt(r,input),/must remain false/);}
function testAuthorizeOverclaimRejected(){const input=approvalInput(),r=buildApprovalReceipt(input);r.lifecycle_authorize_admitted=true;refingerprint(r);expectFailure('authorize overclaim',()=>validateApprovalReceipt(r,input),/must remain false/);}
function testExecutionOverclaimRejected(){const input=approvalInput(),r=buildApprovalReceipt(input);r.execution_admitted=true;refingerprint(r);expectFailure('execution overclaim',()=>validateApprovalReceipt(r,input),/must remain false/);}
function testFutureAuthorityOverclaimRejected(){const input=approvalInput(),r=buildApprovalReceipt(input);r.future_action_permission_created=true;refingerprint(r);expectFailure('future permission',()=>validateApprovalReceipt(r,input),/must remain false/);}
function testApprovalDoesNotConsumePermit(){const input=approvalInput(),r=buildApprovalReceipt(input);assert.strictEqual(r.action_permit_consumed,false);assert.strictEqual(input.core_action_permit.payload.consumed,false);assert.strictEqual(r.next_safe_action,'ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE');}
function testReadOnlyCli(){const input=approvalInput(),script=path.join(__dirname,'action-specific-approval.js');for(const command of ['permit','consume','execute','interrupt','resume','send','switch','activate','create-successor','grant']){const run=spawnSync(process.execPath,[script,command,'-'],{input:JSON.stringify(input),encoding:'utf8'});assert.notStrictEqual(run.status,0,`${command} must not be accepted`);assert(/unsupported command/.test(run.stderr),`${command}: expected unsupported command`);}}

function run(){
  const tests=[testPositiveInterruptApproval,testPositiveSuccessorApproval,testApprovalBindingHashParity,testDeterministicReceiptFingerprint,testRequestMustMatchPermitRequestId,testRequestControlMismatch,testRunMismatch,testEpochMismatch,testChainMismatch,testIntentMismatch,testTamperedRequestFingerprintRejected,testTamperedPermitRejected,testPermitConsumedRejected,testPermitOneShotRequired,testExecuteRevalidationRequired,testPassiveEventRejected,testNonHumanEventRejected,testUnsupportedEventKindRejected,testRequestEventReuseRejected,testPermitHashSubstitutionRejected,testCoordinationHashSubstitutionRejected,testTargetHashSubstitutionRejected,testApprovalBeforePermitRejected,testReceiptBeforeEventRejected,testZeroApprovalLifetimeRejected,testApprovalBeyondPermitRejected,testApprovalCannotOutlivePermitOrAvailability,testBindingKindMutationRejected,testBindingReusableRejected,testOutputPermitHashMutationRejected,testOutputRequestReinterpretationRejected,testAuthorizeOverclaimRejected,testExecutionOverclaimRejected,testFutureAuthorityOverclaimRejected,testApprovalDoesNotConsumePermit,testReadOnlyCli];
  for(const test of tests){test();process.stdout.write(`PASS ${test.name}\n`);}
  process.stdout.write(`PASS FCL Action-Specific Approval v0.1 conformance (${tests.length} groups)\n`);
  const sample=approvalInput();const receipt=buildApprovalReceipt(sample);validateApprovalReceipt(receipt,sample);
  if(process.argv[2])fs.writeFileSync(process.argv[2],`${JSON.stringify(receipt,null,2)}\n`);
  if(process.argv[3])fs.writeFileSync(process.argv[3],`${JSON.stringify(sample,null,2)}\n`);
}
run();
