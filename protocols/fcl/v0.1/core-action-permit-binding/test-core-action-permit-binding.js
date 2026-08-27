'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { canonicalFingerprint } = require('../authority-evaluation/authority-evaluation.js');
const { buildCoreAuthorityReceipt, coreContentHash } = require('../core-authority-binding/core-authority-binding.js');
const { buildCoreCoordinationReceipt } = require('../core-coordination-binding/core-coordination-binding.js');
const {
  FCLCoreActionPermitBindingError,
  buildCoreActionPermit,
  hashObject,
  targetBindingFor,
  targetBindingHash,
  validateBoundActionPermit,
  validateInput
} = require('./core-action-permit-binding.js');

const clone = value => JSON.parse(JSON.stringify(value));
const ORIGIN = { repository:'Matawaka/uu-aap', revision:'5b0b1464baff6edf305dfb32865019c846bcf9d6', tree:'cbc5c3e9f4e3c2c1ff3dd88a35aa7d4d3a5b8cdf' };
const ACTOR = { id:'actor:fcl-runtime-controller', key_ref:'key:fcl-runtime-controller' };

function expectFailure(label, fn, pattern) {
  let failed=false;
  try { fn(); } catch(error) {
    failed=true;
    assert(error instanceof FCLCoreActionPermitBindingError, `${label}: expected FCLCoreActionPermitBindingError, got ${error && error.name}`);
    if(pattern) assert(pattern.test(error.message), `${label}: unexpected error ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}
function rehash(receipt) { receipt.content_hash=coreContentHash(receipt); return receipt; }
function loadPredecessorSample() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fcl-permit-predecessor-'));
  const receiptPath=path.join(dir,'coordination.json');
  const inputPath=path.join(dir,'coordination-input.json');
  const script=path.resolve(__dirname,'../core-coordination-binding/test-core-coordination-binding.js');
  const run=spawnSync(process.execPath,[script,receiptPath,inputPath],{encoding:'utf8'});
  assert.strictEqual(run.status,0,`predecessor coordination suite failed: ${run.stderr}`);
  return { coordination:JSON.parse(fs.readFileSync(receiptPath,'utf8')), input:JSON.parse(fs.readFileSync(inputPath,'utf8')) };
}

function positiveAuthority(control='REQUEST_SUCCESSOR') {
  const successor=control==='REQUEST_SUCCESSOR';
  const runId=successor?'run-successor-permit':'run-interrupt-permit';
  const epoch=successor?32:27;
  const scope=successor?'fcl.run.successor.create':'fcl.run.interrupt';
  const at=successor?'2026-08-27T20:05:01Z':'2026-08-27T20:01:01Z';
  const receipt={
    protocol:'FCL',version:'0.1',receipt_type:'FCLAuthorityEvaluationReceipt',
    authority_evaluation_id:successor?'authority-successor-permit':'authority-interrupt-permit',
    request_evaluation_id:successor?'evaluation-successor-permit':'evaluation-interrupt-permit',
    request_evaluation_fingerprint:`sha256:${'1'.repeat(64)}`,
    request_id:successor?'request-successor-permit':'request-interrupt-permit',
    requested_control:control,current_run_id:runId,current_run_epoch:epoch,current_chain_id:successor?'chain-successor-permit':'chain-interrupt-permit',
    intent_ref:successor?'intent:permit:successor':'intent:permit:interrupt',effect_actor_subject:clone(ACTOR),
    required_scope:scope,required_target:`urn:uu-aap:fcl:run:${runId}:epoch:${epoch}`,
    poai_verification_id:successor?'urn:poai:authority-verification:fcl-successor-permit':'urn:poai:authority-verification:fcl-interrupt-permit',
    poai_authority_result_binding_sha256:`sha256:${'2'.repeat(64)}`,
    poai_verified_at:successor?'2026-08-27T20:05:00Z':'2026-08-27T20:01:00Z',
    poai_verification_required_scope:scope,poai_verification_target:`urn:uu-aap:fcl:run:${runId}:epoch:${epoch}`,
    classification:'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED',request_current:true,poai_authority_result_valid:true,poai_status_established:true,
    issuer_entitlement_chain_valid:true,root_accepted_by_policy:true,scope_match:true,target_match:true,subject_match:true,authority_evidence_fresh:true,
    preexisting_request_scoped_authority_observed:true,forwardable_to_core_authority_adapter:true,
    authority_granted_by_evaluator:false,authority_expanded_by_evaluator:false,core_authority_receipt_created:false,request_effect_authorized:false,
    action_permit_established:false,execution_admitted:false,interrupt_completed:false,continuation_receipt_created:false,successor_run_created:false,
    runtime_state_transitioned:false,progress_created:false,liveness_proven:false,legal_identity_verified:false,legal_authority_established:false,
    universal_authority_established:false,legal_effect_established:false,truth_certified:false,causal_proof_certified:false,legal_responsibility_determined:false,
    liability_established:false,private_reasoning_included:false,next_safe_action:'BIND_CORE_AUTHORITY_RECEIPT',evaluated_at:at,fingerprint_sha256:''
  };
  receipt.fingerprint_sha256=canonicalFingerprint(receipt);
  return receipt;
}
function times(control) { return control==='REQUEST_SUCCESSOR' ? {state:'2026-08-27T20:04:58Z',availability:'2026-08-27T20:04:59Z',intent:'2026-08-27T20:05:00Z',authority:'2026-08-27T20:05:02Z',coordination:'2026-08-27T20:05:03Z',validUntil:'2026-08-27T20:06:00Z',permit:'2026-08-27T20:05:04Z',expires:'2026-08-27T20:05:50Z'} : {state:'2026-08-27T20:00:00Z',availability:'2026-08-27T20:00:01Z',intent:'2026-08-27T20:00:02Z',authority:'2026-08-27T20:01:02Z',coordination:'2026-08-27T20:01:03Z',validUntil:'2026-08-27T20:02:00Z',permit:'2026-08-27T20:01:04Z',expires:'2026-08-27T20:01:50Z'}; }
function subjectFor(fcl){return{id:`urn:uu-aap:fcl:control:${fcl.request_id}`,scope:'fcl-control-request'};}
function intentBindingFor(fcl){return{intent_ref:fcl.intent_ref,requested_control:fcl.requested_control,run_id:fcl.current_run_id,run_epoch:fcl.current_run_epoch,chain_id:fcl.current_chain_id,required_scope:fcl.required_scope,required_target:fcl.required_target};}
function availabilityBindingFor(fcl){return{run_id:fcl.current_run_id,run_epoch:fcl.current_run_epoch,chain_id:fcl.current_chain_id,operation_scope:fcl.required_scope,target:fcl.required_target};}
function makeSuccessorCoordination() {
  const fcl=positiveAuthority('REQUEST_SUCCESSOR'),t=times('REQUEST_SUCCESSOR');
  const state=rehash({protocol:'UU-AAP Core',version:'0.1',receipt_type:'StateReceipt',subject:subjectFor(fcl),frontier:{revision:`fcl:${fcl.current_run_id}:epoch:${fcl.current_run_epoch}`,observed_at:t.state},predecessor_receipt_hashes:[],assertions:{state_anchored:true,evidence_scope_declared:true},non_effects:{intent_established:false,authority_established:false,action_performed:false,liability_established:false,truth_certified:false},issuer:{id:'urn:uu-aap:test:fcl-state-source',assurance:'observed_test_state'},issued_at:t.state,payload:{evidence_refs:[`urn:evidence:fcl:${fcl.current_run_id}`]},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''});
  const availability=rehash({protocol:'UU-AAP Core',version:'0.1',receipt_type:'AvailabilityClaim',subject:clone(state.subject),frontier:clone(state.frontier),predecessor_receipt_hashes:[state.content_hash],assertions:{availability_qualified:true,capability:fcl.required_scope},non_effects:{intent_established:false,action_performed:false,liability_established:false,truth_certified:false},issuer:{id:'urn:uu-aap:test:fcl-availability-source',assurance:'bounded_test_availability'},issued_at:t.availability,payload:{status:'available',valid_until:t.validUntil,resource:fcl.required_target,fcl_binding:availabilityBindingFor(fcl)},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''});
  const intent=rehash({protocol:'UU-AAP Core',version:'0.1',receipt_type:'IntentReceipt',subject:clone(state.subject),frontier:clone(state.frontier),predecessor_receipt_hashes:[state.content_hash],assertions:{intent_declared:true,intent_scope:fcl.required_scope},non_effects:{action_performed:false,authority_expanded:false,responsibility_accepted:false,liability_established:false},issuer:{id:'urn:uu-aap:test:fcl-intent-source',assurance:'explicit_test_intent'},issued_at:t.intent,payload:{source:'explicit_fcl_control_intent',fcl_binding:intentBindingFor(fcl)},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''});
  const authority=buildCoreAuthorityReceipt({protocol:'FCL',version:'0.1',profile:'core-authority-binding-v0.1',binding_id:`binding-${fcl.request_id}`,origin:clone(ORIGIN),fcl_authority_evaluation:clone(fcl),core_intent_receipt:clone(intent),issued_at:t.authority});
  const input={protocol:'FCL',version:'0.1',profile:'core-coordination-binding-v0.1',coordination_id:`coordination-${fcl.request_id}`,origin:clone(ORIGIN),fcl_authority_evaluation:fcl,core_state_receipt:state,core_availability_claim:availability,core_intent_receipt:intent,core_authority_receipt:authority,issued_at:t.coordination};
  return { input, coordination:buildCoreCoordinationReceipt(input), permitAt:t.permit, expiresAt:t.expires };
}

function permitInputFrom(sample, permitAt, expiresAt, id='permit-interrupt-test') {
  return {protocol:'FCL',version:'0.1',profile:'core-action-permit-binding-v0.1',permit_id:id,origin:clone(ORIGIN),core_coordination_binding_input:clone(sample.input),core_coordination_receipt:clone(sample.coordination),issued_at:permitAt,expires_at:expiresAt};
}
function interruptPermitInput() {
  const sample=loadPredecessorSample();
  return permitInputFrom(sample,'2026-08-27T18:01:04Z','2026-08-27T18:01:50Z');
}
function successorPermitInput() {
  const sample=makeSuccessorCoordination();
  return permitInputFrom(sample,sample.permitAt,sample.expiresAt,'permit-successor-test');
}

function testPositiveInterruptPermit(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);assert.strictEqual(r.receipt_type,'ActionPermit');assert.strictEqual(r.assertions.action_permitted,true);assert.strictEqual(r.assertions.action_scope,'fcl.run.interrupt');assert.strictEqual(r.payload.one_shot,true);assert.strictEqual(r.payload.consumed,false);assert.strictEqual(r.payload.execute_revalidation_required,true);assert.strictEqual(validateBoundActionPermit(r,input),true);}
function testPositiveSuccessorPermit(){const input=successorPermitInput(),r=buildCoreActionPermit(input);assert.strictEqual(r.assertions.action_scope,'fcl.run.successor.create');assert.strictEqual(r.payload.requested_control,'REQUEST_SUCCESSOR');assert.strictEqual(validateBoundActionPermit(r,input),true);}
function testDeterministicAndCoreHash(){const input=interruptPermitInput(),a=buildCoreActionPermit(input),b=buildCoreActionPermit(clone(input));assert.deepStrictEqual(a,b);assert.strictEqual(a.content_hash,coreContentHash(a));}
function testExactCorePredecessorGraph(){const input=interruptPermitInput(),r=buildCoreActionPermit(input),c=input.core_coordination_binding_input;assert.deepStrictEqual(r.predecessor_receipt_hashes,[c.core_state_receipt.content_hash,c.core_intent_receipt.content_hash,c.core_authority_receipt.content_hash,input.core_coordination_receipt.content_hash]);}
function testTargetBindingDeterministic(){const input=interruptPermitInput(),target=targetBindingFor(input);assert.strictEqual(target.resource,input.core_coordination_binding_input.fcl_authority_evaluation.required_target);assert.strictEqual(target.operation,'fcl.run.interrupt');assert.strictEqual(target.authority_scope,'fcl.run.interrupt');assert.strictEqual(targetBindingHash(input),hashObject(target));}
function testGenericPreActionPermitFields(){const r=buildCoreActionPermit(interruptPermitInput());for(const k of ['gate','expires_at','one_shot','consumed','target_binding_hash'])assert(Object.prototype.hasOwnProperty.call(r.payload,k),k);assert.strictEqual(r.payload.gate,'fail_closed');assert.strictEqual(r.payload.one_shot,true);assert.strictEqual(r.payload.consumed,false);}
function testPermitIssuedBeforeCoordinationRejected(){const input=interruptPermitInput();input.issued_at='2026-08-27T18:01:02Z';expectFailure('issue before coordination',()=>validateInput(input),/issued before CoordinationReceipt/);}
function testZeroLifetimeRejected(){const input=interruptPermitInput();input.expires_at=input.issued_at;expectFailure('zero lifetime',()=>validateInput(input),/expires_at must be after issued_at/);}
function testNegativeLifetimeRejected(){const input=interruptPermitInput();input.expires_at='2026-08-27T18:01:03Z';expectFailure('negative lifetime',()=>validateInput(input),/expires_at must be after issued_at/);}
function testIssuedAfterAvailabilityRejected(){const input=interruptPermitInput();input.issued_at='2026-08-27T18:02:01Z';input.expires_at='2026-08-27T18:02:02Z';expectFailure('issued after availability',()=>validateInput(input),/issued after availability expiry|expiry exceeds availability/);}
function testExpiryBeyondAvailabilityRejected(){const input=interruptPermitInput();input.expires_at='2026-08-27T18:02:01Z';expectFailure('expiry after availability',()=>validateInput(input),/expiry exceeds availability/);}
function testTamperedCoordinationReceiptRejected(){const input=interruptPermitInput();input.core_coordination_receipt.content_hash=`sha256:${'0'.repeat(64)}`;expectFailure('tampered coordination receipt',()=>validateInput(input),/coordination predecessor invalid/);}
function testTamperedCoordinationInputRejected(){const input=interruptPermitInput();input.core_coordination_binding_input.core_availability_claim.payload.status='unavailable';expectFailure('tampered coordination input',()=>validateInput(input),/coordination predecessor invalid/);}
function testCoordinationHorizonMismatchRejected(){const input=interruptPermitInput();input.core_coordination_receipt.payload.availability_valid_until='2026-08-27T18:09:00Z';rehash(input.core_coordination_receipt);expectFailure('coordination horizon mismatch',()=>validateInput(input),/coordination predecessor invalid|availability horizon/);}
function testOutputSubjectSubstitutionRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.subject.id='urn:other';rehash(r);expectFailure('subject substitution',()=>validateBoundActionPermit(r,input),/subject substitution/);}
function testOutputFrontierSubstitutionRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.frontier.revision='fcl:other:epoch:1';rehash(r);expectFailure('frontier substitution',()=>validateBoundActionPermit(r,input),/frontier revision substitution/);}
function testOutputPredecessorOmissionRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.predecessor_receipt_hashes.pop();rehash(r);expectFailure('predecessor omission',()=>validateBoundActionPermit(r,input),/predecessor substitution/);}
function testTargetHashAssertionSubstitutionRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.assertions.target_binding_hash=`sha256:${'a'.repeat(64)}`;rehash(r);expectFailure('target assertion hash',()=>validateBoundActionPermit(r,input),/target_binding_hash mismatch/);}
function testTargetHashPayloadSubstitutionRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.payload.target_binding_hash=`sha256:${'a'.repeat(64)}`;rehash(r);expectFailure('target payload hash',()=>validateBoundActionPermit(r,input),/payload target_binding_hash mismatch/);}
function testTargetObjectSubstitutionRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.payload.target.resource='urn:other';rehash(r);expectFailure('target object',()=>validateBoundActionPermit(r,input),/target substitution/);}
function testOneShotFalseRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.payload.one_shot=false;rehash(r);expectFailure('one_shot false',()=>validateBoundActionPermit(r,input),/one_shot/);}
function testConsumedTrueRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.payload.consumed=true;rehash(r);expectFailure('consumed true',()=>validateBoundActionPermit(r,input),/unconsumed/);}
function testGateDowngradeRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.payload.gate='best_effort';rehash(r);expectFailure('gate downgrade',()=>validateBoundActionPermit(r,input),/fail_closed/);}
function testExecuteRevalidationAssertionRequired(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.assertions.execute_revalidation_required=false;rehash(r);expectFailure('revalidation assertion',()=>validateBoundActionPermit(r,input),/require execute revalidation/);}
function testExecuteRevalidationPayloadRequired(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.payload.execute_revalidation_required=false;rehash(r);expectFailure('revalidation payload',()=>validateBoundActionPermit(r,input),/payload must require execute revalidation/);}
function testActionPerformedOverclaimRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.non_effects.action_performed=true;rehash(r);expectFailure('action performed',()=>validateBoundActionPermit(r,input),/action_performed/);}
function testOutcomeObservedOverclaimRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.non_effects.outcome_observed=true;rehash(r);expectFailure('outcome observed',()=>validateBoundActionPermit(r,input),/outcome_observed/);}
function testExecutionAdmissionOverclaimRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.non_effects.execution_admitted=true;rehash(r);expectFailure('execution admitted',()=>validateBoundActionPermit(r,input),/execution_admitted/);}
function testFuturePermissionOverclaimRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.non_effects.future_action_permission_created=true;rehash(r);expectFailure('future permission',()=>validateBoundActionPermit(r,input),/future_action_permission_created/);}
function testGeneralAuthorityOverclaimRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.non_effects.general_authority_created=true;rehash(r);expectFailure('general authority',()=>validateBoundActionPermit(r,input),/general_authority_created/);}
function testLegalAuthorityOverclaimRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.non_effects.legal_authority_established=true;rehash(r);expectFailure('legal authority',()=>validateBoundActionPermit(r,input),/legal_authority_established/);}
function testInterruptNotCompletedByPermit(){const r=buildCoreActionPermit(interruptPermitInput());assert.strictEqual(r.non_effects.interrupt_completed,false);assert.strictEqual(r.payload.lifecycle_authorize_admitted,false);assert.strictEqual(r.payload.lifecycle_execute_ready,false);}
function testSuccessorNotCreatedByPermit(){const r=buildCoreActionPermit(successorPermitInput());assert.strictEqual(r.non_effects.successor_run_created,false);assert.strictEqual(r.non_effects.continuation_receipt_created,false);}
function testReceiptTypeEscalationRejected(){const input=interruptPermitInput(),r=buildCoreActionPermit(input);r.receipt_type='ActionReceipt';rehash(r);expectFailure('receipt type escalation',()=>validateBoundActionPermit(r,input),/must be ActionPermit/);}
function testReadOnlyNoExecutionCli(){const input=interruptPermitInput(),script=path.join(__dirname,'core-action-permit-binding.js');for(const command of ['execute','interrupt','resume','send','switch','activate','create-successor','consume']){const run=spawnSync(process.execPath,[script,command,'-'],{input:JSON.stringify(input),encoding:'utf8'});assert.notStrictEqual(run.status,0,`${command} must not be accepted`);assert(/unsupported command/.test(run.stderr),`${command}: expected unsupported command`);}}

function run() {
  const tests=[testPositiveInterruptPermit,testPositiveSuccessorPermit,testDeterministicAndCoreHash,testExactCorePredecessorGraph,testTargetBindingDeterministic,testGenericPreActionPermitFields,testPermitIssuedBeforeCoordinationRejected,testZeroLifetimeRejected,testNegativeLifetimeRejected,testIssuedAfterAvailabilityRejected,testExpiryBeyondAvailabilityRejected,testTamperedCoordinationReceiptRejected,testTamperedCoordinationInputRejected,testCoordinationHorizonMismatchRejected,testOutputSubjectSubstitutionRejected,testOutputFrontierSubstitutionRejected,testOutputPredecessorOmissionRejected,testTargetHashAssertionSubstitutionRejected,testTargetHashPayloadSubstitutionRejected,testTargetObjectSubstitutionRejected,testOneShotFalseRejected,testConsumedTrueRejected,testGateDowngradeRejected,testExecuteRevalidationAssertionRequired,testExecuteRevalidationPayloadRequired,testActionPerformedOverclaimRejected,testOutcomeObservedOverclaimRejected,testExecutionAdmissionOverclaimRejected,testFuturePermissionOverclaimRejected,testGeneralAuthorityOverclaimRejected,testLegalAuthorityOverclaimRejected,testInterruptNotCompletedByPermit,testSuccessorNotCreatedByPermit,testReceiptTypeEscalationRejected,testReadOnlyNoExecutionCli];
  for(const test of tests){test();process.stdout.write(`PASS ${test.name}\n`);}
  process.stdout.write(`PASS FCL Core ActionPermit Binding v0.1 conformance (${tests.length} groups)\n`);
  const sample=interruptPermitInput();
  const output=buildCoreActionPermit(sample);
  validateBoundActionPermit(output,sample);
  if(process.argv[2])fs.writeFileSync(process.argv[2],`${JSON.stringify(output,null,2)}\n`);
  if(process.argv[3])fs.writeFileSync(process.argv[3],`${JSON.stringify(sample,null,2)}\n`);
}
run();
