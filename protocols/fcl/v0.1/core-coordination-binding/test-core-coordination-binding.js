'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { canonicalFingerprint } = require('../authority-evaluation/authority-evaluation.js');
const { buildCoreAuthorityReceipt, coreContentHash } = require('../core-authority-binding/core-authority-binding.js');
const {
  FCLCoreCoordinationBindingError,
  buildCoreCoordinationReceipt,
  validateBoundCoordinationReceipt,
  validateInput
} = require('./core-coordination-binding.js');

const clone = value => JSON.parse(JSON.stringify(value));
const ACTOR = { id:'actor:fcl-runtime-controller', key_ref:'key:fcl-runtime-controller' };
const ORIGIN = { repository:'Matawaka/uu-aap', revision:'0c1196bf48346ecef67ed2f75c805319899ab4f9', tree:'ee940632847b53c46d9f2b1e60f441a5323a0eb4' };

function expectFailure(label, fn, pattern) {
  let failed=false;
  try{fn();}catch(error){
    failed=true;
    assert(error instanceof FCLCoreCoordinationBindingError, `${label}: expected FCLCoreCoordinationBindingError, got ${error&&error.name}`);
    if(pattern) assert(pattern.test(error.message), `${label}: unexpected error ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}
function referenceCanonical(value){
  if(value===null||typeof value==='boolean'||typeof value==='number'||typeof value==='string')return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(referenceCanonical).join(',')}]`;
  const keys=Object.keys(value).sort();return `{${keys.map(key=>`${JSON.stringify(key)}:${referenceCanonical(value[key])}`).join(',')}}`;
}
function referenceCoreHash(receipt){const projection={};for(const[k,v]of Object.entries(receipt))if(k!=='content_hash'&&k!=='signature_profile')projection[k]=v;return `sha256:${crypto.createHash('sha256').update(Buffer.from(referenceCanonical(projection),'utf8')).digest('hex')}`;}
function rehash(receipt){receipt.content_hash=coreContentHash(receipt);return receipt;}

function positiveAuthority(control='REQUEST_INTERRUPT'){
  const successor=control==='REQUEST_SUCCESSOR';
  const runId=successor?'run-successor-coordination':'run-interrupt-coordination';
  const epoch=successor?22:17;
  const scope=successor?'fcl.run.successor.create':'fcl.run.interrupt';
  const at=successor?'2026-08-27T18:05:01Z':'2026-08-27T18:01:01Z';
  const receipt={
    protocol:'FCL',version:'0.1',receipt_type:'FCLAuthorityEvaluationReceipt',
    authority_evaluation_id:successor?'authority-successor-coordination':'authority-interrupt-coordination',
    request_evaluation_id:successor?'evaluation-successor-coordination':'evaluation-interrupt-coordination',
    request_evaluation_fingerprint:`sha256:${'1'.repeat(64)}`,
    request_id:successor?'request-successor-coordination':'request-interrupt-coordination',
    requested_control:control,current_run_id:runId,current_run_epoch:epoch,current_chain_id:successor?'chain-successor-coordination':'chain-interrupt-coordination',
    intent_ref:successor?'intent:coordination:successor':'intent:coordination:interrupt',effect_actor_subject:clone(ACTOR),
    required_scope:scope,required_target:`urn:uu-aap:fcl:run:${runId}:epoch:${epoch}`,
    poai_verification_id:successor?'urn:poai:authority-verification:fcl-successor-coordination':'urn:poai:authority-verification:fcl-interrupt-coordination',
    poai_authority_result_binding_sha256:`sha256:${'2'.repeat(64)}`,
    poai_verified_at:successor?'2026-08-27T18:05:00Z':'2026-08-27T18:01:00Z',
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
  receipt.fingerprint_sha256=canonicalFingerprint(receipt);return receipt;
}
function times(control){return control==='REQUEST_SUCCESSOR'?{state:'2026-08-27T18:04:58Z',availability:'2026-08-27T18:04:59Z',intent:'2026-08-27T18:05:00Z',authority:'2026-08-27T18:05:02Z',coordination:'2026-08-27T18:05:03Z'}:{state:'2026-08-27T17:59:58Z',availability:'2026-08-27T17:59:59Z',intent:'2026-08-27T18:00:00Z',authority:'2026-08-27T18:01:02Z',coordination:'2026-08-27T18:01:03Z'};}
function subjectFor(fcl){return{id:`urn:uu-aap:fcl:control:${fcl.request_id}`,scope:'fcl-control-request'};}
function frontierFor(fcl,t){return{revision:`fcl:${fcl.current_run_id}:epoch:${fcl.current_run_epoch}`,observed_at:t.state};}
function bindingFor(fcl){return{intent_ref:fcl.intent_ref,requested_control:fcl.requested_control,run_id:fcl.current_run_id,run_epoch:fcl.current_run_epoch,chain_id:fcl.current_chain_id,required_scope:fcl.required_scope,required_target:fcl.required_target};}
function makeState(fcl){const t=times(fcl.requested_control);const r={protocol:'UU-AAP Core',version:'0.1',receipt_type:'StateReceipt',subject:subjectFor(fcl),frontier:frontierFor(fcl,t),predecessor_receipt_hashes:[],assertions:{state_anchored:true,evidence_scope_declared:true},non_effects:{intent_established:false,authority_established:false,action_performed:false,liability_established:false,truth_certified:false},issuer:{id:'urn:uu-aap:test:fcl-state-source',assurance:'observed_test_state'},issued_at:t.state,payload:{evidence_refs:[`urn:evidence:fcl:${fcl.current_run_id}`]},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''};return rehash(r);}
function makeAvailability(state,fcl){const t=times(fcl.requested_control);const r={protocol:'UU-AAP Core',version:'0.1',receipt_type:'AvailabilityClaim',subject:clone(state.subject),frontier:clone(state.frontier),predecessor_receipt_hashes:[state.content_hash],assertions:{availability_qualified:true,capability:fcl.required_scope},non_effects:{intent_established:false,action_performed:false,liability_established:false,truth_certified:false},issuer:{id:'urn:uu-aap:test:fcl-availability-source',assurance:'bounded_test_availability'},issued_at:t.availability,payload:{resource:fcl.required_target,status:'available_for_coordination_test',fcl_binding:bindingFor(fcl)},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''};return rehash(r);}
function makeIntent(state,fcl){const t=times(fcl.requested_control);const r={protocol:'UU-AAP Core',version:'0.1',receipt_type:'IntentReceipt',subject:clone(state.subject),frontier:clone(state.frontier),predecessor_receipt_hashes:[state.content_hash],assertions:{intent_declared:true,intent_scope:fcl.required_scope},non_effects:{action_performed:false,authority_expanded:false,responsibility_accepted:false,liability_established:false},issuer:{id:'urn:uu-aap:test:fcl-intent-source',assurance:'explicit_test_intent'},issued_at:t.intent,payload:{source:'explicit_fcl_control_intent',fcl_binding:bindingFor(fcl)},signature_profile:{mode:'none',reason:'conformance_fixture_only'},content_hash:''};return rehash(r);}
function makeAuthority(intent,fcl){const t=times(fcl.requested_control);return buildCoreAuthorityReceipt({protocol:'FCL',version:'0.1',profile:'core-authority-binding-v0.1',binding_id:`binding-${fcl.request_id}`,origin:clone(ORIGIN),fcl_authority_evaluation:clone(fcl),core_intent_receipt:clone(intent),issued_at:t.authority});}
function inputFor(control='REQUEST_INTERRUPT'){
  const fcl=positiveAuthority(control),state=makeState(fcl),availability=makeAvailability(state,fcl),intent=makeIntent(state,fcl),authority=makeAuthority(intent,fcl),t=times(control);
  return{protocol:'FCL',version:'0.1',profile:'core-coordination-binding-v0.1',coordination_id:`coordination-${fcl.request_id}`,origin:clone(ORIGIN),fcl_authority_evaluation:fcl,core_state_receipt:state,core_availability_claim:availability,core_intent_receipt:intent,core_authority_receipt:authority,issued_at:t.coordination};
}

function testPositiveInterruptCoordination(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);assert.strictEqual(r.receipt_type,'CoordinationReceipt');assert.strictEqual(r.assertions.coordination_established,true);assert.strictEqual(r.assertions.coordination_scope,'fcl.run.interrupt');assert.deepStrictEqual(r.predecessor_receipt_hashes,[input.core_availability_claim.content_hash,input.core_intent_receipt.content_hash,input.core_authority_receipt.content_hash]);assert.strictEqual(validateBoundCoordinationReceipt(r,input),true);}
function testPositiveSuccessorCoordination(){const input=inputFor('REQUEST_SUCCESSOR'),r=buildCoreCoordinationReceipt(input);assert.strictEqual(r.assertions.coordination_scope,'fcl.run.successor.create');assert.strictEqual(r.payload.requested_control,'REQUEST_SUCCESSOR');}
function testDeterministicAndCoreHashParity(){const input=inputFor(),a=buildCoreCoordinationReceipt(input),b=buildCoreCoordinationReceipt(clone(input));assert.deepStrictEqual(a,b);assert.strictEqual(a.content_hash,coreContentHash(a));assert.strictEqual(a.content_hash,referenceCoreHash(a));}
function testClosedMiniChainEdges(){const input=inputFor();assert.deepStrictEqual(input.core_state_receipt.predecessor_receipt_hashes,[]);assert.deepStrictEqual(input.core_availability_claim.predecessor_receipt_hashes,[input.core_state_receipt.content_hash]);assert.deepStrictEqual(input.core_intent_receipt.predecessor_receipt_hashes,[input.core_state_receipt.content_hash]);assert.deepStrictEqual(input.core_authority_receipt.predecessor_receipt_hashes,[input.core_intent_receipt.content_hash]);validateInput(input);}
function testStatePredecessorRejected(){const input=inputFor();input.core_state_receipt.predecessor_receipt_hashes=[`sha256:${'9'.repeat(64)}`];rehash(input.core_state_receipt);expectFailure('state predecessor',()=>validateInput(input),/must not have predecessors/);}
function testStateAnchoredRequired(){const input=inputFor();input.core_state_receipt.assertions.state_anchored=false;rehash(input.core_state_receipt);expectFailure('state anchored',()=>validateInput(input),/state_anchored/);}
function testStateNonEffectRequired(){const input=inputFor();delete input.core_state_receipt.non_effects.truth_certified;rehash(input.core_state_receipt);expectFailure('state non-effect',()=>validateInput(input),/truth_certified/);}
function testAvailabilityPredecessorRejected(){const input=inputFor();input.core_availability_claim.predecessor_receipt_hashes=[`sha256:${'8'.repeat(64)}`];rehash(input.core_availability_claim);expectFailure('availability predecessor',()=>validateInput(input),/point exactly to StateReceipt/);}
function testAvailabilitySubjectMismatch(){const input=inputFor();input.core_availability_claim.subject.id='urn:other';rehash(input.core_availability_claim);expectFailure('availability subject',()=>validateInput(input),/subject mismatch/);}
function testAvailabilityFrontierMismatch(){const input=inputFor();input.core_availability_claim.frontier.revision='fcl:other:epoch:1';rehash(input.core_availability_claim);expectFailure('availability frontier',()=>validateInput(input),/frontier mismatch/);}
function testAvailabilityCapabilityMismatch(){const input=inputFor();input.core_availability_claim.assertions.capability='fcl.run.successor.create';rehash(input.core_availability_claim);expectFailure('availability capability',()=>validateInput(input),/capability/);}
function testAvailabilityBindingMissing(){const input=inputFor();delete input.core_availability_claim.payload.fcl_binding;rehash(input.core_availability_claim);expectFailure('availability binding missing',()=>validateInput(input),/fcl_binding required/);}
function testAvailabilityRunBindingMismatch(){const input=inputFor();input.core_availability_claim.payload.fcl_binding.run_id='different-run';rehash(input.core_availability_claim);expectFailure('availability run binding',()=>validateInput(input),/run_id/);}
function testIntentPredecessorRejected(){const input=inputFor();input.core_intent_receipt.predecessor_receipt_hashes=[`sha256:${'7'.repeat(64)}`];rehash(input.core_intent_receipt);expectFailure('intent predecessor',()=>validateInput(input),/point exactly to StateReceipt/);}
function testIntentSubjectMismatch(){const input=inputFor();input.core_intent_receipt.subject.id='urn:other';rehash(input.core_intent_receipt);expectFailure('intent subject',()=>validateInput(input),/subject mismatch/);}
function testIntentFrontierMismatch(){const input=inputFor();input.core_intent_receipt.frontier.revision='fcl:other:epoch:1';rehash(input.core_intent_receipt);expectFailure('intent frontier',()=>validateInput(input),/frontier mismatch/);}
function testAuthorityMustMatch547Binding(){const input=inputFor();input.core_authority_receipt.assertions.authority_target='urn:uu-aap:fcl:run:other:epoch:1';rehash(input.core_authority_receipt);expectFailure('authority deterministic binding',()=>validateInput(input),/core_authority_receipt invalid|authority_target/);}
function testAuthorityPredecessorRejected(){const input=inputFor();input.core_authority_receipt.predecessor_receipt_hashes=[`sha256:${'6'.repeat(64)}`];rehash(input.core_authority_receipt);expectFailure('authority predecessor',()=>validateInput(input),/core_authority_receipt invalid|predecessor/);}
function testNonPositiveFCLRejected(){const input=inputFor();const f=input.fcl_authority_evaluation;Object.assign(f,{classification:'AUTHORITY_NOT_ESTABLISHED',poai_status_established:false,issuer_entitlement_chain_valid:false,preexisting_request_scoped_authority_observed:false,forwardable_to_core_authority_adapter:false,next_safe_action:'OBTAIN_MATCHING_AUTHORITY_EVIDENCE'});f.fingerprint_sha256='';f.fingerprint_sha256=canonicalFingerprint(f);expectFailure('non-positive FCL',()=>validateInput(input),/not positive/);}
function testTamperedFCLFingerprintRejected(){const input=inputFor();input.fcl_authority_evaluation.fingerprint_sha256=`sha256:${'0'.repeat(64)}`;expectFailure('tampered FCL',()=>validateInput(input),/fcl_authority_evaluation invalid|fingerprint/);}
function testAvailabilityIssuedBeforeStateRejected(){const input=inputFor();input.core_availability_claim.issued_at='2026-08-27T17:59:57Z';rehash(input.core_availability_claim);expectFailure('availability time reversal',()=>validateInput(input),/issued before StateReceipt/);}
function testIntentIssuedBeforeStateRejected(){const input=inputFor();input.core_intent_receipt.issued_at='2026-08-27T17:59:57Z';rehash(input.core_intent_receipt);expectFailure('intent time reversal',()=>validateInput(input),/issued before StateReceipt/);}
function testCoordinationIssuedBeforeAuthorityRejected(){const input=inputFor();input.issued_at='2026-08-27T18:01:01Z';expectFailure('coordination time rollback',()=>validateInput(input),/before AuthorityReceipt/);}
function testOutputPredecessorSubstitutionRejected(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);r.predecessor_receipt_hashes=[input.core_availability_claim.content_hash,input.core_intent_receipt.content_hash];rehash(r);expectFailure('coordination predecessors',()=>validateBoundCoordinationReceipt(r,input),/predecessor substitution/);}
function testOutputSubjectSubstitutionRejected(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);r.subject.id='urn:other';rehash(r);expectFailure('coordination subject',()=>validateBoundCoordinationReceipt(r,input),/subject substitution/);}
function testOutputFrontierSubstitutionRejected(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);r.frontier.revision='fcl:other:epoch:1';rehash(r);expectFailure('coordination frontier',()=>validateBoundCoordinationReceipt(r,input),/frontier substitution/);}
function testExecutionOverclaimRejected(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);r.non_effects.execution_authorized=true;rehash(r);expectFailure('execution overclaim',()=>validateBoundCoordinationReceipt(r,input),/execution_authorized/);}
function testActionPermitOverclaimRejected(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);r.non_effects.action_permitted=true;rehash(r);expectFailure('permit overclaim',()=>validateBoundCoordinationReceipt(r,input),/action_permitted/);}
function testLegalAuthorityOverclaimRejected(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);r.non_effects.legal_authority_established=true;rehash(r);expectFailure('legal authority overclaim',()=>validateBoundCoordinationReceipt(r,input),/legal_authority_established/);}
function testReceiptTypeEscalationRejected(){const input=inputFor(),r=buildCoreCoordinationReceipt(input);r.receipt_type='ActionPermit';rehash(r);expectFailure('receipt type escalation',()=>validateBoundCoordinationReceipt(r,input),/must be CoordinationReceipt/);}
function testAvailabilityDoesNotCreateIntentOrAuthority(){const input=inputFor();assert.strictEqual(input.core_availability_claim.non_effects.intent_established,false);assert.strictEqual(input.core_availability_claim.assertions.capability,input.fcl_authority_evaluation.required_scope);assert.strictEqual(buildCoreCoordinationReceipt(input).non_effects.authority_granted,false);}
function testReadOnlyCli(){const input=inputFor(),script=path.join(__dirname,'core-coordination-binding.js');for(const command of ['permit','execute','interrupt','resume','send','switch','activate','create-successor','grant']){const result=spawnSync(process.execPath,[script,command,'-'],{input:JSON.stringify(input),encoding:'utf8'});assert.notStrictEqual(result.status,0,`${command} must not be accepted`);assert(/unsupported command/.test(result.stderr),`${command}: expected unsupported command`);}}

function run(){
  const tests=[testPositiveInterruptCoordination,testPositiveSuccessorCoordination,testDeterministicAndCoreHashParity,testClosedMiniChainEdges,testStatePredecessorRejected,testStateAnchoredRequired,testStateNonEffectRequired,testAvailabilityPredecessorRejected,testAvailabilitySubjectMismatch,testAvailabilityFrontierMismatch,testAvailabilityCapabilityMismatch,testAvailabilityBindingMissing,testAvailabilityRunBindingMismatch,testIntentPredecessorRejected,testIntentSubjectMismatch,testIntentFrontierMismatch,testAuthorityMustMatch547Binding,testAuthorityPredecessorRejected,testNonPositiveFCLRejected,testTamperedFCLFingerprintRejected,testAvailabilityIssuedBeforeStateRejected,testIntentIssuedBeforeStateRejected,testCoordinationIssuedBeforeAuthorityRejected,testOutputPredecessorSubstitutionRejected,testOutputSubjectSubstitutionRejected,testOutputFrontierSubstitutionRejected,testExecutionOverclaimRejected,testActionPermitOverclaimRejected,testLegalAuthorityOverclaimRejected,testReceiptTypeEscalationRejected,testAvailabilityDoesNotCreateIntentOrAuthority,testReadOnlyCli];
  for(const test of tests){test();process.stdout.write(`PASS ${test.name}\n`);}process.stdout.write(`PASS FCL Core CoordinationReceipt Binding v0.1 conformance (${tests.length} groups)\n`);
  const sample=inputFor();const output=buildCoreCoordinationReceipt(sample);validateBoundCoordinationReceipt(output,sample);
  if(process.argv[2])fs.writeFileSync(process.argv[2],`${JSON.stringify(output,null,2)}\n`);
  if(process.argv[3])fs.writeFileSync(process.argv[3],`${JSON.stringify(sample,null,2)}\n`);
}
run();
