'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { canonicalFingerprint } = require('../authority-evaluation/authority-evaluation.js');
const {
  FCLCoreAuthorityBindingError,
  buildCoreAuthorityReceipt,
  coreContentHash,
  validateBoundAuthorityReceipt,
  validateCoreIntentReceipt,
  validateInput
} = require('./core-authority-binding.js');

const clone = value => JSON.parse(JSON.stringify(value));
const ACTOR = { id: 'actor:fcl-runtime-controller', key_ref: 'key:fcl-runtime-controller' };

function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    assert(error instanceof FCLCoreAuthorityBindingError, `${label}: expected FCLCoreAuthorityBindingError, got ${error && error.name}`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected error ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function referenceCanonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(referenceCanonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${referenceCanonical(value[key])}`).join(',')}}`;
}
function referenceCoreHash(receipt) {
  const projection = {};
  for (const [key, value] of Object.entries(receipt)) if (key !== 'content_hash' && key !== 'signature_profile') projection[key] = value;
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(referenceCanonical(projection), 'utf8')).digest('hex')}`;
}

function positiveAuthority(control = 'REQUEST_INTERRUPT') {
  const successor = control === 'REQUEST_SUCCESSOR';
  const runId = successor ? 'run-successor-test' : 'run-interrupt-test';
  const epoch = successor ? 12 : 7;
  const scope = successor ? 'fcl.run.successor.create' : 'fcl.run.interrupt';
  const at = successor ? '2026-08-27T18:05:01Z' : '2026-08-27T18:01:01Z';
  const receipt = {
    protocol: 'FCL', version: '0.1', receipt_type: 'FCLAuthorityEvaluationReceipt',
    authority_evaluation_id: successor ? 'authority-successor-test' : 'authority-interrupt-test',
    request_evaluation_id: successor ? 'evaluation-successor-test' : 'evaluation-interrupt-test',
    request_evaluation_fingerprint: `sha256:${'1'.repeat(64)}`,
    request_id: successor ? 'request-successor-test' : 'request-interrupt-test',
    requested_control: control,
    current_run_id: runId,
    current_run_epoch: epoch,
    current_chain_id: successor ? 'chain-successor-test' : 'chain-interrupt-test',
    intent_ref: successor ? 'intent:test:successor' : 'intent:test:interrupt',
    effect_actor_subject: clone(ACTOR),
    required_scope: scope,
    required_target: `urn:uu-aap:fcl:run:${runId}:epoch:${epoch}`,
    poai_verification_id: successor ? 'urn:poai:authority-verification:fcl-successor-test' : 'urn:poai:authority-verification:fcl-interrupt-test',
    poai_authority_result_binding_sha256: `sha256:${'2'.repeat(64)}`,
    poai_verified_at: successor ? '2026-08-27T18:05:00Z' : '2026-08-27T18:01:00Z',
    poai_verification_required_scope: scope,
    poai_verification_target: `urn:uu-aap:fcl:run:${runId}:epoch:${epoch}`,
    classification: 'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED',
    request_current: true,
    poai_authority_result_valid: true,
    poai_status_established: true,
    issuer_entitlement_chain_valid: true,
    root_accepted_by_policy: true,
    scope_match: true,
    target_match: true,
    subject_match: true,
    authority_evidence_fresh: true,
    preexisting_request_scoped_authority_observed: true,
    forwardable_to_core_authority_adapter: true,
    authority_granted_by_evaluator: false,
    authority_expanded_by_evaluator: false,
    core_authority_receipt_created: false,
    request_effect_authorized: false,
    action_permit_established: false,
    execution_admitted: false,
    interrupt_completed: false,
    continuation_receipt_created: false,
    successor_run_created: false,
    runtime_state_transitioned: false,
    progress_created: false,
    liveness_proven: false,
    legal_identity_verified: false,
    legal_authority_established: false,
    universal_authority_established: false,
    legal_effect_established: false,
    truth_certified: false,
    causal_proof_certified: false,
    legal_responsibility_determined: false,
    liability_established: false,
    private_reasoning_included: false,
    next_safe_action: 'BIND_CORE_AUTHORITY_RECEIPT',
    evaluated_at: at,
    fingerprint_sha256: ''
  };
  receipt.fingerprint_sha256 = canonicalFingerprint(receipt);
  return receipt;
}

function makeIntent(authority) {
  const intent = {
    protocol: 'UU-AAP Core', version: '0.1', receipt_type: 'IntentReceipt',
    subject: { id: `urn:uu-aap:fcl:control:${authority.request_id}`, scope: 'fcl-control-request' },
    frontier: { revision: `fcl:${authority.current_run_id}:epoch:${authority.current_run_epoch}`, observed_at: '2026-08-27T18:00:00Z' },
    predecessor_receipt_hashes: [`sha256:${'3'.repeat(64)}`],
    assertions: { intent_declared: true, intent_scope: authority.required_scope },
    non_effects: { action_performed: false, authority_expanded: false, responsibility_accepted: false, liability_established: false },
    issuer: { id: 'urn:uu-aap:test:fcl-intent-source', assurance: 'explicit_test_intent' },
    issued_at: '2026-08-27T18:00:00Z',
    payload: {
      source: 'explicit_fcl_control_intent',
      fcl_binding: {
        intent_ref: authority.intent_ref,
        requested_control: authority.requested_control,
        run_id: authority.current_run_id,
        run_epoch: authority.current_run_epoch,
        chain_id: authority.current_chain_id,
        required_scope: authority.required_scope,
        required_target: authority.required_target
      }
    },
    signature_profile: { mode: 'none', reason: 'conformance_fixture_only' },
    content_hash: ''
  };
  intent.content_hash = referenceCoreHash(intent);
  return intent;
}

function inputFor(authority = positiveAuthority(), intent = null, issuedAt = null) {
  const coreIntent = intent || makeIntent(authority);
  return {
    protocol: 'FCL', version: '0.1', profile: 'core-authority-binding-v0.1',
    binding_id: `binding-${authority.request_id}`,
    origin: { repository: 'Matawaka/uu-aap', revision: '9876d914e28d84449432e04d0fc5b930f0c6a27b', tree: '274d425bb99489258e5598792122ccedd92cdad5' },
    fcl_authority_evaluation: authority,
    core_intent_receipt: coreIntent,
    issued_at: issuedAt || (authority.requested_control === 'REQUEST_SUCCESSOR' ? '2026-08-27T18:05:02Z' : '2026-08-27T18:01:02Z')
  };
}

function rehashIntent(intent) { intent.content_hash = coreContentHash(intent); return intent; }
function rehashReceipt(receipt) { receipt.content_hash = coreContentHash(receipt); return receipt; }

function testPositiveInterruptBinding() {
  const input = inputFor();
  const receipt = buildCoreAuthorityReceipt(input);
  assert.strictEqual(receipt.receipt_type, 'AuthorityReceipt');
  assert.deepStrictEqual(receipt.subject, input.core_intent_receipt.subject);
  assert.deepStrictEqual(receipt.frontier, input.core_intent_receipt.frontier);
  assert.deepStrictEqual(receipt.predecessor_receipt_hashes, [input.core_intent_receipt.content_hash]);
  assert.strictEqual(receipt.assertions.authority_bound, true);
  assert.strictEqual(receipt.assertions.authority_scope, 'fcl.run.interrupt');
  assert.strictEqual(receipt.non_effects.action_permitted, false);
  assert.strictEqual(receipt.payload.core_intent_chain_revalidated, false);
  assert.strictEqual(validateBoundAuthorityReceipt(receipt, input), true);
}
function testPositiveSuccessorBinding() {
  const authority = positiveAuthority('REQUEST_SUCCESSOR');
  const input = inputFor(authority);
  const receipt = buildCoreAuthorityReceipt(input);
  assert.strictEqual(receipt.assertions.authority_scope, 'fcl.run.successor.create');
  assert.strictEqual(receipt.payload.requested_control, 'REQUEST_SUCCESSOR');
}
function testCoreHashParity() {
  const input = inputFor();
  const receipt = buildCoreAuthorityReceipt(input);
  assert.strictEqual(receipt.content_hash, referenceCoreHash(receipt));
  assert.strictEqual(receipt.content_hash, coreContentHash(receipt));
}
function testDeterministicOutput() {
  const input = inputFor();
  assert.deepStrictEqual(buildCoreAuthorityReceipt(input), buildCoreAuthorityReceipt(clone(input)));
}
function testNonPositiveAuthorityRejected() {
  const authority = positiveAuthority();
  Object.assign(authority, { classification: 'AUTHORITY_NOT_ESTABLISHED', poai_status_established: false, issuer_entitlement_chain_valid: false, preexisting_request_scoped_authority_observed: false, forwardable_to_core_authority_adapter: false, next_safe_action: 'OBTAIN_MATCHING_AUTHORITY_EVIDENCE' });
  authority.fingerprint_sha256 = ''; authority.fingerprint_sha256 = canonicalFingerprint(authority);
  const intent = makeIntent(authority);
  expectFailure('non-positive authority', () => validateInput(inputFor(authority, intent)), /not positive/);
}
function testTamperedFCLFingerprintRejected() {
  const input = inputFor();
  input.fcl_authority_evaluation.fingerprint_sha256 = `sha256:${'0'.repeat(64)}`;
  expectFailure('tampered FCL fingerprint', () => validateInput(input), /fcl_authority_evaluation invalid|fingerprint/);
}
function testNonIntentPredecessorRejected() {
  const input = inputFor();
  input.core_intent_receipt.receipt_type = 'AuthorityReceipt';
  rehashIntent(input.core_intent_receipt);
  expectFailure('non-intent predecessor', () => validateInput(input), /must be IntentReceipt/);
}
function testCoreIntentHashMismatchRejected() {
  const input = inputFor();
  input.core_intent_receipt.content_hash = `sha256:${'0'.repeat(64)}`;
  expectFailure('intent hash mismatch', () => validateInput(input), /content hash mismatch/);
}
function testMissingIntentNonEffectRejected() {
  const input = inputFor();
  delete input.core_intent_receipt.non_effects.action_performed;
  rehashIntent(input.core_intent_receipt);
  expectFailure('intent non-effect missing', () => validateInput(input), /action_performed/);
}
function testIntentDeclaredRequired() {
  const input = inputFor();
  input.core_intent_receipt.assertions.intent_declared = false;
  rehashIntent(input.core_intent_receipt);
  expectFailure('intent not declared', () => validateInput(input), /intent_declared/);
}
function testMissingFCLBindingRejected() {
  const input = inputFor();
  delete input.core_intent_receipt.payload.fcl_binding;
  rehashIntent(input.core_intent_receipt);
  expectFailure('missing fcl binding', () => validateInput(input), /fcl_binding required/);
}
function testIntentRefSubstitutionRejected() {
  const input = inputFor();
  input.core_intent_receipt.payload.fcl_binding.intent_ref = 'intent:test:other';
  rehashIntent(input.core_intent_receipt);
  expectFailure('intent ref substitution', () => validateInput(input), /intent_ref/);
}
function testControlSubstitutionRejected() {
  const input = inputFor();
  input.core_intent_receipt.payload.fcl_binding.requested_control = 'REQUEST_SUCCESSOR';
  rehashIntent(input.core_intent_receipt);
  expectFailure('control substitution', () => validateInput(input), /requested_control/);
}
function testRunSubstitutionRejected() {
  const input = inputFor();
  input.core_intent_receipt.payload.fcl_binding.run_id = 'run-other-test';
  rehashIntent(input.core_intent_receipt);
  expectFailure('run substitution', () => validateInput(input), /run_id/);
}
function testEpochSubstitutionRejected() {
  const input = inputFor();
  input.core_intent_receipt.payload.fcl_binding.run_epoch += 1;
  rehashIntent(input.core_intent_receipt);
  expectFailure('epoch substitution', () => validateInput(input), /run_epoch/);
}
function testChainSubstitutionRejected() {
  const input = inputFor();
  input.core_intent_receipt.payload.fcl_binding.chain_id = 'chain-other-test';
  rehashIntent(input.core_intent_receipt);
  expectFailure('chain substitution', () => validateInput(input), /chain_id/);
}
function testScopeSubstitutionRejected() {
  const input = inputFor();
  input.core_intent_receipt.payload.fcl_binding.required_scope = 'fcl.run.successor.create';
  rehashIntent(input.core_intent_receipt);
  expectFailure('scope substitution', () => validateInput(input), /required_scope/);
}
function testTargetSubstitutionRejected() {
  const input = inputFor();
  input.core_intent_receipt.payload.fcl_binding.required_target = 'urn:uu-aap:fcl:run:*';
  rehashIntent(input.core_intent_receipt);
  expectFailure('target substitution', () => validateInput(input), /required_target/);
}
function testIntentMustPreexistAuthorityEvaluation() {
  const input = inputFor();
  input.core_intent_receipt.issued_at = '2026-08-27T18:01:02Z';
  rehashIntent(input.core_intent_receipt);
  expectFailure('late intent construction', () => validateInput(input), /pre-exist/);
}
function testBindingTimeCannotPrecedeAuthority() {
  const input = inputFor(positiveAuthority(), null, '2026-08-27T18:01:00Z');
  expectFailure('binding time precedes authority', () => validateInput(input), /cannot precede FCL authority/);
}
function testOutputSubjectMutationRejected() {
  const input = inputFor(), receipt = buildCoreAuthorityReceipt(input);
  receipt.subject.id = 'urn:uu-aap:other'; rehashReceipt(receipt);
  expectFailure('subject mutation', () => validateBoundAuthorityReceipt(receipt, input), /subject substitution/);
}
function testOutputFrontierMutationRejected() {
  const input = inputFor(), receipt = buildCoreAuthorityReceipt(input);
  receipt.frontier.revision = 'fcl:other:epoch:7'; rehashReceipt(receipt);
  expectFailure('frontier mutation', () => validateBoundAuthorityReceipt(receipt, input), /frontier substitution/);
}
function testOutputPredecessorMutationRejected() {
  const input = inputFor(), receipt = buildCoreAuthorityReceipt(input);
  receipt.predecessor_receipt_hashes.push(`sha256:${'9'.repeat(64)}`); rehashReceipt(receipt);
  expectFailure('predecessor mutation', () => validateBoundAuthorityReceipt(receipt, input), /predecessor substitution/);
}
function testPermissionExpansionRejected() {
  const input = inputFor(), receipt = buildCoreAuthorityReceipt(input);
  receipt.non_effects.permissions_expanded = true; rehashReceipt(receipt);
  expectFailure('permission expansion', () => validateBoundAuthorityReceipt(receipt, input), /permissions_expanded/);
}
function testActionPermitOverclaimRejected() {
  const input = inputFor(), receipt = buildCoreAuthorityReceipt(input);
  receipt.non_effects.action_permitted = true; rehashReceipt(receipt);
  expectFailure('action permit overclaim', () => validateBoundAuthorityReceipt(receipt, input), /action_permitted/);
}
function testLegalAuthorityOverclaimRejected() {
  const input = inputFor(), receipt = buildCoreAuthorityReceipt(input);
  receipt.non_effects.legal_authority_established = true; rehashReceipt(receipt);
  expectFailure('legal authority overclaim', () => validateBoundAuthorityReceipt(receipt, input), /legal_authority_established/);
}
function testReceiptTypeEscalationRejected() {
  const input = inputFor(), receipt = buildCoreAuthorityReceipt(input);
  receipt.receipt_type = 'ActionPermit'; rehashReceipt(receipt);
  expectFailure('receipt type escalation', () => validateBoundAuthorityReceipt(receipt, input), /must be AuthorityReceipt/);
}
function testIntentEnvelopeValidationDoesNotClaimFullChain() {
  const input = inputFor();
  assert.strictEqual(validateCoreIntentReceipt(input.core_intent_receipt), true);
  const receipt = buildCoreAuthorityReceipt(input);
  assert.strictEqual(receipt.payload.core_intent_envelope_validated, true);
  assert.strictEqual(receipt.payload.core_intent_chain_revalidated, false);
}
function testReadOnlyCliSurface() {
  const script = path.join(__dirname, 'core-authority-binding.js');
  for (const command of ['grant','permit','interrupt','execute','resume','send','switch','activate','create-successor']) {
    const result = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8' });
    assert.notStrictEqual(result.status, 0, `${command} must not be accepted`);
    assert(/unsupported command/.test(result.stderr), `${command}: expected unsupported command`);
  }
}

function run() {
  const tests = [
    testPositiveInterruptBinding, testPositiveSuccessorBinding, testCoreHashParity, testDeterministicOutput,
    testNonPositiveAuthorityRejected, testTamperedFCLFingerprintRejected, testNonIntentPredecessorRejected,
    testCoreIntentHashMismatchRejected, testMissingIntentNonEffectRejected, testIntentDeclaredRequired,
    testMissingFCLBindingRejected, testIntentRefSubstitutionRejected, testControlSubstitutionRejected,
    testRunSubstitutionRejected, testEpochSubstitutionRejected, testChainSubstitutionRejected,
    testScopeSubstitutionRejected, testTargetSubstitutionRejected, testIntentMustPreexistAuthorityEvaluation,
    testBindingTimeCannotPrecedeAuthority, testOutputSubjectMutationRejected, testOutputFrontierMutationRejected,
    testOutputPredecessorMutationRejected, testPermissionExpansionRejected, testActionPermitOverclaimRejected,
    testLegalAuthorityOverclaimRejected, testReceiptTypeEscalationRejected,
    testIntentEnvelopeValidationDoesNotClaimFullChain, testReadOnlyCliSurface
  ];
  for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }
  const output = buildCoreAuthorityReceipt(inputFor());
  if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`PASS FCL -> Core AuthorityReceipt Binding v0.1 conformance (${tests.length} groups)\n`);
}
run();
