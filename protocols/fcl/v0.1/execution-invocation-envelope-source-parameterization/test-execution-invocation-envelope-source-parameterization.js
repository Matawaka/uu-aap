'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  buildEnvelope,
  materializeWithPreparedSource,
  prepareValidatedSource,
  validateInput,
  validateReceipt,
} = require('./execution-invocation-envelope-source-parameterization.js');
const {
  hashWithoutContentHash,
  validateEnvelope,
} = require('../../../integration/execution-invocation-envelope/v0.1/validate-parameterized-envelope.js');

const ROOT = __dirname;
const clone = value => JSON.parse(JSON.stringify(value));
const ORIGIN = {
  repository: 'Matawaka/uu-aap',
  revision: '82ff4dbdd57da5ae223bb6eade6b8aac9db1cb83',
  tree: '60fe1fccbd0806c091bd09296610a1229871934d',
};

function expectFailure(label, fn, pattern = null) {
  let failed = false;
  try { fn(); }
  catch (error) {
    failed = true;
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function loadRevalidationArtifacts() {
  const cached = {
    input: process.env.FCL_INVOCATION_CACHED_REVALIDATION_INPUT,
    decision: process.env.FCL_INVOCATION_CACHED_REVALIDATION_DECISION,
    receipt: process.env.FCL_INVOCATION_CACHED_REVALIDATION_RECEIPT,
  };
  if (cached.input && cached.decision && cached.receipt && Object.values(cached).every(p => fs.existsSync(p))) {
    return {
      input: JSON.parse(fs.readFileSync(cached.input, 'utf8')),
      decision: JSON.parse(fs.readFileSync(cached.decision, 'utf8')),
      receipt: JSON.parse(fs.readFileSync(cached.receipt, 'utf8')),
    };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-invocation-revalidation-'));
  const inputPath = path.join(dir, 'revalidation-input.json');
  const decisionPath = path.join(dir, 'revalidation-decision.json');
  const receiptPath = path.join(dir, 'revalidation-receipt.json');
  const script = path.resolve(ROOT, '..', 'execute-revalidation-source-parameterization', 'test-execute-revalidation-source-parameterization.js');
  const run = spawnSync(process.execPath, [script, inputPath, decisionPath, receiptPath], { stdio: 'ignore', timeout: 300000 });
  assert.strictEqual(run.status, 0, `revalidation source failed: ${run.error ? run.error.message : 'non-zero status'}`);
  return {
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
    decision: JSON.parse(fs.readFileSync(decisionPath, 'utf8')),
    receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
  };
}

const source = loadRevalidationArtifacts();

function positiveInput(createdAt = '2026-08-27T18:01:16Z') {
  return {
    protocol: 'FCL',
    version: '0.1',
    profile: 'execution-invocation-envelope-source-parameterization-v0.1',
    binding_id: 'fcl-execution-invocation-envelope-interrupt-v0-1',
    origin: clone(ORIGIN),
    revalidation_input: clone(source.input),
    generic_revalidation_decision: clone(source.decision),
    fcl_revalidation_receipt: clone(source.receipt),
    envelope_id: 'urn:uu-aap:invocation-envelope:fcl-interrupt-v0-1',
    created_at: createdAt,
    invocation_id: 'urn:uu-aap:actuator-invocation:fcl-interrupt-v0-1',
    adapter_id: 'urn:uu-aap:adapter:fcl-control-transport',
  };
}

const canonicalInput = positiveInput();
const preparedSource = prepareValidatedSource(canonicalInput);
process.stdout.write('PASS prepared exact FCL revalidation source once\n');

function testPositiveEnvelope() {
  const input = positiveInput();
  assert.strictEqual(validateInput(input, preparedSource), true);
  const result = materializeWithPreparedSource(input, preparedSource);
  const envelope = result.execution_invocation_envelope;
  assert.strictEqual(envelope.invocation.adapter_role, 'transport_only');
  assert.strictEqual(envelope.invocation.one_shot, true);
  assert.strictEqual(envelope.invocation.consumed, false);
  assert.strictEqual(envelope.non_effects.actuator_invocation_emitted, false);
  assert.strictEqual(envelope.non_effects.permit_consumed, false);
  assert.strictEqual(result.fcl_invocation_envelope_receipt.next_safe_action, 'PARAMETERIZE_INVOCATION_ACTION_RECEIPT_FCL_SOURCE');
  assert.strictEqual(validateReceipt(result.fcl_invocation_envelope_receipt), true);
}

function testDeterministicEnvelope() {
  const first = materializeWithPreparedSource(positiveInput(), preparedSource);
  const second = materializeWithPreparedSource(positiveInput(), preparedSource);
  assert.deepStrictEqual(first, second);
}

function testParameterizedHelperAcceptsFCLEnvelope() {
  const input = positiveInput();
  const envelope = buildEnvelope(input, preparedSource);
  assert.strictEqual(validateEnvelope(envelope, input.generic_revalidation_decision), true);
}

function testEnvelopeCannotPredateRevalidation() {
  expectFailure('predates revalidation', () => validateInput(positiveInput('2026-08-27T18:01:14Z'), preparedSource), /cannot predate execute revalidation/);
}

function testEnvelopeAfterHorizonRejected() {
  expectFailure('created after horizon', () => validateInput(positiveInput('2026-08-27T18:02:01Z'), preparedSource), /created after revalidation horizon/);
}

function testRevalidationDecisionSubstitutionRejected() {
  const input = positiveInput();
  input.generic_revalidation_decision.content_hash = `sha256:${'1'.repeat(64)}`;
  expectFailure('revalidation decision substitution', () => validateInput(input, preparedSource), /prepared source generic revalidation decision mismatch/);
}

function testFCLRevalidationReceiptSubstitutionRejected() {
  const input = positiveInput();
  input.fcl_revalidation_receipt.target_binding_hash = `sha256:${'2'.repeat(64)}`;
  expectFailure('FCL revalidation receipt substitution', () => validateInput(input, preparedSource), /prepared source FCL revalidation receipt mismatch/);
}

function testPermitApprovalTargetFrontierSubstitutionsRejected() {
  const permit = positiveInput();
  permit.revalidation_input.authorize_binding_input.assessment_input.pre_action_bundle.core_receipts.action_permit.content_hash = `sha256:${'3'.repeat(64)}`;
  expectFailure('permit substitution', () => validateInput(permit, preparedSource), /prepared source revalidation input mismatch/);

  const approval = positiveInput();
  approval.revalidation_input.authorize_binding_input.assessment_input.pre_action_bundle.approval_binding.content_hash = `sha256:${'4'.repeat(64)}`;
  expectFailure('approval substitution', () => validateInput(approval, preparedSource), /prepared source revalidation input mismatch/);

  const target = positiveInput();
  target.revalidation_input.authorize_binding_input.assessment_input.pre_action_bundle.target.binding_hash = `sha256:${'5'.repeat(64)}`;
  expectFailure('target substitution', () => validateInput(target, preparedSource), /prepared source revalidation input mismatch/);

  const frontier = positiveInput();
  frontier.revalidation_input.authorize_binding_input.assessment_input.pre_action_bundle.target.expected_predecessor_frontier += ':other';
  expectFailure('frontier substitution', () => validateInput(frontier, preparedSource), /prepared source revalidation input mismatch/);
}

function testEnvelopeHorizonExtensionRejected() {
  const input = positiveInput();
  const envelope = buildEnvelope(input, preparedSource);
  envelope.invocation.expires_at = '2026-08-27T18:03:00Z';
  envelope.content_hash = hashWithoutContentHash(envelope);
  expectFailure('envelope horizon extension', () => validateEnvelope(envelope, input.generic_revalidation_decision), /extends revalidation horizon/);
}

function testEnvelopeConsumedOrReusableRejected() {
  const input = positiveInput();
  const consumed = buildEnvelope(input, preparedSource);
  consumed.invocation.consumed = true;
  consumed.content_hash = hashWithoutContentHash(consumed);
  expectFailure('preconsumed envelope', () => validateEnvelope(consumed, input.generic_revalidation_decision), /consumed/);

  const reusable = buildEnvelope(input, preparedSource);
  reusable.invocation.one_shot = false;
  reusable.content_hash = hashWithoutContentHash(reusable);
  expectFailure('reusable envelope', () => validateEnvelope(reusable, input.generic_revalidation_decision), /one shot/);
}

function testAdapterAuthorityEscalationRejected() {
  const input = positiveInput();
  const envelope = buildEnvelope(input, preparedSource);
  envelope.invocation.adapter_role = 'authority_source';
  envelope.content_hash = hashWithoutContentHash(envelope);
  expectFailure('adapter authority escalation', () => validateEnvelope(envelope, input.generic_revalidation_decision), /adapter role/);
}

function testGuardWeakeningRejected() {
  const input = positiveInput();
  const envelope = buildEnvelope(input, preparedSource);
  envelope.invocation.expected_target_guard_used = false;
  envelope.content_hash = hashWithoutContentHash(envelope);
  expectFailure('target guard weakening', () => validateEnvelope(envelope, input.generic_revalidation_decision), /target guard/);
}

function testFCLReceiptOverclaimRejected() {
  const result = materializeWithPreparedSource(positiveInput(), preparedSource);
  result.fcl_invocation_envelope_receipt.non_effects.actuator_invocation_emitted = true;
  result.fcl_invocation_envelope_receipt.content_hash = hashWithoutContentHash(result.fcl_invocation_envelope_receipt);
  expectFailure('actuator emission overclaim', () => validateReceipt(result.fcl_invocation_envelope_receipt), /actuator_invocation_emitted/);
}

function testPostExecutionSynthesisRejected() {
  const result = materializeWithPreparedSource(positiveInput(), preparedSource);
  result.fcl_invocation_envelope_receipt.action_receipt = { receipt_type: 'ActionReceipt' };
  result.fcl_invocation_envelope_receipt.content_hash = hashWithoutContentHash(result.fcl_invocation_envelope_receipt);
  expectFailure('ActionReceipt synthesis', () => validateReceipt(result.fcl_invocation_envelope_receipt), /keys mismatch/);
}

function testReadOnlyCliAndImportSafe() {
  const script = path.resolve(ROOT, 'execution-invocation-envelope-source-parameterization.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8', timeout: 5000 });
  assert.strictEqual(imported.status, 0, imported.stderr);
  assert.strictEqual(imported.stdout, '');
  assert.strictEqual(imported.stderr, '');
  for (const command of ['invoke','execute','emit','consume','interrupt','send','actuate']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8', timeout: 5000 });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}

const tests = [
  testPositiveEnvelope,
  testDeterministicEnvelope,
  testParameterizedHelperAcceptsFCLEnvelope,
  testEnvelopeCannotPredateRevalidation,
  testEnvelopeAfterHorizonRejected,
  testRevalidationDecisionSubstitutionRejected,
  testFCLRevalidationReceiptSubstitutionRejected,
  testPermitApprovalTargetFrontierSubstitutionsRejected,
  testEnvelopeHorizonExtensionRejected,
  testEnvelopeConsumedOrReusableRejected,
  testAdapterAuthorityEscalationRejected,
  testGuardWeakeningRejected,
  testFCLReceiptOverclaimRejected,
  testPostExecutionSynthesisRejected,
  testReadOnlyCliAndImportSafe,
];

for (const test of tests) {
  test();
  process.stdout.write(`PASS ${test.name}\n`);
}

const input = positiveInput();
const result = materializeWithPreparedSource(input, preparedSource);
if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(input, null, 2)}\n`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], `${JSON.stringify(result.execution_invocation_envelope, null, 2)}\n`);
if (process.argv[4]) fs.writeFileSync(process.argv[4], `${JSON.stringify(result.fcl_invocation_envelope_receipt, null, 2)}\n`);
process.stdout.write(`PASS FCL Execution Invocation Envelope Source Parameterization v0.1 conformance (${tests.length} groups)\n`);
