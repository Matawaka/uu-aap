'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildRequestReceipt } = require('../control-request/control-request.js');
const { fingerprint: runtimeFingerprint, validateViewModel } = require('../runtime-ui/runtime-ui.js');
const { buildEvaluationReceipt } = require('../request-evaluation/request-evaluation.js');
const {
  FCLAuthorityEvaluationError, INTERRUPT_SCOPE, SUCCESSOR_SCOPE,
  buildAuthorityEvaluationReceipt, canonicalFingerprint, classify,
  requiredScopeForControl, requiredTargetForEvaluation,
  validateAuthorityEvaluationReceipt, validateInput
} = require('./authority-evaluation.js');

const ROOT = __dirname;
const CONTROL_EXAMPLES = path.join(ROOT, '..', 'control-request', 'examples');
const clone = value => JSON.parse(JSON.stringify(value));
const load = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const control = name => load(path.join(CONTROL_EXAMPLES, name));
const ACTOR = { id: 'actor:fcl-runtime-controller', key_ref: 'key:fcl-runtime-controller' };

function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    assert(error instanceof FCLAuthorityEvaluationError, `${label}: expected FCLAuthorityEvaluationError, got ${error && error.name}`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected error ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}
function refreshView(view) {
  view.fingerprint_sha256 = '';
  view.fingerprint_sha256 = runtimeFingerprint(view);
  validateViewModel(view);
  return view;
}
function rerender(source, renderedAt) {
  const view = clone(source);
  const delta = Math.max(0, Math.floor((Date.parse(renderedAt) - Date.parse(view.rendered_at)) / 1000));
  view.rendered_at = renderedAt;
  if (view.last_confirmed_progress_age_seconds !== null) view.last_confirmed_progress_age_seconds += delta;
  return refreshView(view);
}
function evalInput(controlInput, currentView, evaluatedAt) {
  return {
    protocol: 'FCL', version: '0.1', profile: 'current-state-request-evaluation-v0.1',
    evaluation_id: `auth-source-${controlInput.request_id}`,
    origin: { repository: 'Matawaka/uu-aap', revision: '1eced7c85b1fcb3c061479cbad3f70d43d1c9cd2', tree: 'd6888d74445de27c4e59b8dad935596005b48936' },
    request_receipt: buildRequestReceipt(controlInput), current_view: currentView, evaluated_at: evaluatedAt
  };
}
function currentInterruptReceipt() {
  const input = control('interrupt.request.json');
  return buildEvaluationReceipt(evalInput(input, rerender(input.source_view, '2026-08-27T17:01:05Z'), '2026-08-27T17:01:06Z'));
}
function currentSuccessorReceipt() {
  const input = control('successor.request.json');
  return buildEvaluationReceipt(evalInput(input, rerender(input.source_view, '2026-08-27T17:05:05Z'), '2026-08-27T17:05:06Z'));
}
function staleInterruptReceipt() {
  const input = control('interrupt.request.json');
  const view = rerender(input.source_view, '2026-08-27T17:01:05Z');
  Object.assign(view, { display_state: 'ACTIVE', current_phase: 'recovered-progress', waiting_on: null, source_next_safe_action: 'WAIT_FOR_NEXT_RECEIPT', offered_control: 'NONE', terminal_run_visible: false });
  refreshView(view);
  return buildEvaluationReceipt(evalInput(input, view, '2026-08-27T17:01:06Z'));
}
function digest(value) { return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value }; }
function authorityResult(evaluation, verifiedAt, overrides = {}) {
  const scope = requiredScopeForControl(evaluation.requested_control);
  const target = requiredTargetForEvaluation(evaluation);
  const result = {
    artifact_type: 'PoAIAuthorityVerificationResult', artifact_version: '0.1-experimental',
    verification_id: `urn:poai:authority-verification:fcl-${evaluation.request_id}`,
    verified_at: verifiedAt,
    policy: { policy_id: 'urn:poai:policy:fcl-control-test', policy_version: 1, digest: digest('1'.repeat(64)) },
    root: { root_id: 'urn:poai:authority-root:fcl-control-test', root_version: 1, digest: digest('2'.repeat(64)) },
    grant_path: ['urn:poai:authority-grant:fcl-control-test'],
    subject: clone(ACTOR), required_scope: scope, target, status: 'established',
    checks: { root_accepted_by_policy: true, grant_path_valid: true, required_scope_matches: true, required_target_matches: true, authority_graph_acyclic: true },
    claims: {
      root_declared: true, root_evidence_observed: true, root_accepted_by_policy: true,
      issuer_entitlement_chain_valid: true, materialization_authority_established: false,
      policy_control_authority_established: false, legal_identity_verified: false,
      legal_authority_established: false, universal_authority_established: false,
      universal_canonicality_established: false, truth_certified: false,
      causal_proof_certified: false, legal_responsibility_determined: false,
      moral_correctness_established: false, legal_effect_established: false,
      poai_v_conformance_established: false
    },
    errors: []
  };
  if (overrides.required_scope !== undefined) result.required_scope = overrides.required_scope;
  if (overrides.target !== undefined) result.target = overrides.target;
  if (overrides.subject !== undefined) result.subject = clone(overrides.subject);
  if (overrides.status !== undefined) result.status = overrides.status;
  if (overrides.issuer_entitlement_chain_valid !== undefined) result.claims.issuer_entitlement_chain_valid = overrides.issuer_entitlement_chain_valid;
  if (overrides.root_accepted_by_policy !== undefined) result.claims.root_accepted_by_policy = overrides.root_accepted_by_policy;
  if (overrides.materialization_authority_established !== undefined) result.claims.materialization_authority_established = overrides.materialization_authority_established;
  if (overrides.policy_control_authority_established !== undefined) result.claims.policy_control_authority_established = overrides.policy_control_authority_established;
  if (overrides.legal_authority_established !== undefined) result.claims.legal_authority_established = overrides.legal_authority_established;
  if (overrides.errors !== undefined) result.errors = clone(overrides.errors);
  return result;
}
function inputFor(evaluation, result, evaluatedAt) {
  return {
    protocol: 'FCL', version: '0.1', profile: 'authority-evaluation-v0.1',
    authority_evaluation_id: `authority-${evaluation.request_id}`,
    origin: { repository: 'Matawaka/uu-aap', revision: 'd5e588c36a7ac82e310fbdb06a1f8dc22182e8c8', tree: 'cc6ef28955fd6737879ffc3f8cc8ec8f0aa7d54c' },
    current_state_request_evaluation: evaluation,
    effect_actor_subject: clone(ACTOR), authority_verification_result: result, evaluated_at: evaluatedAt
  };
}
function positiveInterruptInput() { const e=currentInterruptReceipt(); return inputFor(e,authorityResult(e,'2026-08-27T17:01:07Z'),'2026-08-27T17:01:08Z'); }
function positiveSuccessorInput() { const e=currentSuccessorReceipt(); return inputFor(e,authorityResult(e,'2026-08-27T17:05:07Z'),'2026-08-27T17:05:08Z'); }

function testPositiveInterruptAuthority(){const r=buildAuthorityEvaluationReceipt(positiveInterruptInput());assert.strictEqual(r.classification,'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED');assert.strictEqual(r.required_scope,INTERRUPT_SCOPE);assert.strictEqual(r.forwardable_to_core_authority_adapter,true);assert.strictEqual(r.next_safe_action,'BIND_CORE_AUTHORITY_RECEIPT');}
function testPositiveSuccessorAuthority(){const r=buildAuthorityEvaluationReceipt(positiveSuccessorInput());assert.strictEqual(r.classification,'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED');assert.strictEqual(r.required_scope,SUCCESSOR_SCOPE);assert.strictEqual(r.forwardable_to_core_authority_adapter,true);}
function testDeterministicScopeAndTargetMapping(){const i=currentInterruptReceipt(),s=currentSuccessorReceipt();assert.strictEqual(requiredScopeForControl(i.requested_control),'fcl.run.interrupt');assert.strictEqual(requiredScopeForControl(s.requested_control),'fcl.run.successor.create');assert.strictEqual(requiredTargetForEvaluation(i),`urn:uu-aap:fcl:run:${i.current_run_id}:epoch:${i.current_run_epoch}`);}
function testNonCurrentRequestFailsClosed(){const e=staleInterruptReceipt(),input=inputFor(e,authorityResult(e,'2026-08-27T17:01:07Z'),'2026-08-27T17:01:08Z'),r=buildAuthorityEvaluationReceipt(input);assert.strictEqual(r.classification,'REQUEST_NOT_CURRENT');assert.strictEqual(r.forwardable_to_core_authority_adapter,false);}
function testNotEstablishedAuthority(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{status:'not_established',issuer_entitlement_chain_valid:false,errors:['required_authority_grant_not_found']}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_NOT_ESTABLISHED');}
function testRootNotAcceptedAuthority(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{status:'not_established',issuer_entitlement_chain_valid:false,root_accepted_by_policy:false,errors:['unaccepted_root']}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_NOT_ESTABLISHED');}
function testInterruptCannotUseSuccessorScope(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{required_scope:SUCCESSOR_SCOPE}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_SCOPE_MISMATCH');}
function testSuccessorCannotUseInterruptScope(){const e=currentSuccessorReceipt(),a=authorityResult(e,'2026-08-27T17:05:07Z',{required_scope:INTERRUPT_SCOPE}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:05:08Z'));assert.strictEqual(r.classification,'AUTHORITY_SCOPE_MISMATCH');}
function testMaterializationExecuteScopeCannotBeReused(){const e=currentSuccessorReceipt(),a=authorityResult(e,'2026-08-27T17:05:07Z',{required_scope:'poai.successor.materialization.execute'}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:05:08Z'));assert.strictEqual(r.classification,'AUTHORITY_SCOPE_MISMATCH');}
function testPolicyControlScopeCannotBeReused(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{required_scope:'poai.materialization.policy.control'}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_SCOPE_MISMATCH');}
function testRunTargetDrift(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{target:'urn:uu-aap:fcl:run:different-run:epoch:7'}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_TARGET_MISMATCH');}
function testEpochTargetDrift(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{target:`urn:uu-aap:fcl:run:${e.current_run_id}:epoch:${e.current_run_epoch+1}`}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_TARGET_MISMATCH');}
function testWildcardTargetRejected(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{target:'urn:uu-aap:fcl:run:*'}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_TARGET_MISMATCH');}
function testSubjectMismatch(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{subject:{id:'actor:other',key_ref:'key:other'}}),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_SUBJECT_MISMATCH');}
function testAuthorityEvidenceTooOld(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:05Z'),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_EVIDENCE_TOO_OLD');assert.strictEqual(r.next_safe_action,'REVERIFY_AUTHORITY');}
function testAuthorityEvidenceFromFuture(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:09Z'),r=buildAuthorityEvaluationReceipt(inputFor(e,a,'2026-08-27T17:01:08Z'));assert.strictEqual(r.classification,'AUTHORITY_EVIDENCE_TIME_INVALID');}
function testSpecializedAuthorityClaimLeakRejected(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{materialization_authority_established:true});expectFailure('materialization claim leakage',()=>validateInput(inputFor(e,a,'2026-08-27T17:01:08Z')),/assurance boundary|materialization_authority|FCL scope/);}
function testLegalAuthorityOverclaimRejected(){const e=currentInterruptReceipt(),a=authorityResult(e,'2026-08-27T17:01:07Z',{legal_authority_established:true});expectFailure('legal authority overclaim',()=>validateInput(inputFor(e,a,'2026-08-27T17:01:08Z')),/legal_authority|assurance boundary/);}
function testTamperedRequestEvaluationRejected(){const input=positiveInterruptInput();input.current_state_request_evaluation.fingerprint_sha256=`sha256:${'0'.repeat(64)}`;expectFailure('tampered request evaluation',()=>validateInput(input),/current_state_request_evaluation invalid|fingerprint/);}
function testPositiveNonEffectsRemainFalse(){const r=buildAuthorityEvaluationReceipt(positiveInterruptInput());for(const key of ['authority_granted_by_evaluator','authority_expanded_by_evaluator','core_authority_receipt_created','request_effect_authorized','action_permit_established','execution_admitted','interrupt_completed','continuation_receipt_created','successor_run_created','runtime_state_transitioned','progress_created','liveness_proven','legal_identity_verified','legal_authority_established','universal_authority_established','legal_effect_established','truth_certified','causal_proof_certified','legal_responsibility_determined','liability_established','private_reasoning_included'])assert.strictEqual(r[key],false,key);}
function testReceiptRejectsPermitOverclaim(){const r=buildAuthorityEvaluationReceipt(positiveInterruptInput()),bad=clone(r);bad.action_permit_established=true;bad.fingerprint_sha256='';bad.fingerprint_sha256=canonicalFingerprint(bad);expectFailure('permit overclaim',()=>validateAuthorityEvaluationReceipt(bad),/action_permit_established/);}
function testLiveRepositoryRootDoesNotGrantFCLScopes(){const root=load(path.resolve(ROOT,'../../../../proposals/poai/authority/roots/github/Matawaka.uu-aap.authority-root.json'));assert(!root.accepted_actions.includes(INTERRUPT_SCOPE),'live root must not implicitly accept interrupt scope');assert(!root.accepted_actions.includes(SUCCESSOR_SCOPE),'live root must not implicitly accept successor scope');}
function testDeterministicAndReadOnlyCli(){const input=positiveInterruptInput();assert.deepStrictEqual(buildAuthorityEvaluationReceipt(input),buildAuthorityEvaluationReceipt(clone(input)));const script=path.join(ROOT,'authority-evaluation.js');for(const command of ['grant','permit','interrupt','execute','resume','send','switch','activate','create-successor']){const result=spawnSync(process.execPath,[script,command,'-'],{input:'{}',encoding:'utf8'});assert.notStrictEqual(result.status,0,`${command} must not be accepted`);assert(/unsupported command/.test(result.stderr),`${command}: expected unsupported command`);}}

function run(){const tests=[testPositiveInterruptAuthority,testPositiveSuccessorAuthority,testDeterministicScopeAndTargetMapping,testNonCurrentRequestFailsClosed,testNotEstablishedAuthority,testRootNotAcceptedAuthority,testInterruptCannotUseSuccessorScope,testSuccessorCannotUseInterruptScope,testMaterializationExecuteScopeCannotBeReused,testPolicyControlScopeCannotBeReused,testRunTargetDrift,testEpochTargetDrift,testWildcardTargetRejected,testSubjectMismatch,testAuthorityEvidenceTooOld,testAuthorityEvidenceFromFuture,testSpecializedAuthorityClaimLeakRejected,testLegalAuthorityOverclaimRejected,testTamperedRequestEvaluationRejected,testPositiveNonEffectsRemainFalse,testReceiptRejectsPermitOverclaim,testLiveRepositoryRootDoesNotGrantFCLScopes,testDeterministicAndReadOnlyCli];for(const test of tests){test();process.stdout.write(`PASS ${test.name}\n`);}const input=positiveInterruptInput(),receipt=buildAuthorityEvaluationReceipt(input);if(process.argv[2])fs.writeFileSync(process.argv[2],`${JSON.stringify(input,null,2)}\n`);if(process.argv[3])fs.writeFileSync(process.argv[3],`${JSON.stringify(receipt,null,2)}\n`);process.stdout.write(`PASS FCL Authority Evaluation v0.1 conformance (${tests.length} groups)\n`);}run();
