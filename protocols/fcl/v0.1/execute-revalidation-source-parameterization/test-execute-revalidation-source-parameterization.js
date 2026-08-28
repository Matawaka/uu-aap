'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  buildDecision,
  prepareValidatedSource,
  revalidateWithPreparedSource,
  validateInput,
  validateReceipt,
} = require('./execute-revalidation-source-parameterization.js');
const {
  hashWithoutContentHash,
  validateDecision,
} = require('../../../integration/execute-revalidation/v0.1/validate-parameterized-decision.js');

const ROOT = __dirname;
const clone = value => JSON.parse(JSON.stringify(value));
const ORIGIN = {
  repository: 'Matawaka/uu-aap',
  revision: 'f4802d5b30536569cc9aa43df5ba78b5f13f1d11',
  tree: 'cb7d03cb4a9eab7b1bdc1e1eda71b614fea7e022',
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

function loadAuthorizeArtifacts() {
  const cached = {
    input: process.env.FCL_REVALIDATION_CACHED_AUTHORIZE_INPUT,
    phase: process.env.FCL_REVALIDATION_CACHED_AUTHORIZE_PHASE,
    receipt: process.env.FCL_REVALIDATION_CACHED_AUTHORIZE_RECEIPT,
  };
  if (cached.input && cached.phase && cached.receipt && Object.values(cached).every(p => fs.existsSync(p))) {
    return {
      input: JSON.parse(fs.readFileSync(cached.input, 'utf8')),
      phase: JSON.parse(fs.readFileSync(cached.phase, 'utf8')),
      receipt: JSON.parse(fs.readFileSync(cached.receipt, 'utf8')),
    };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-revalidation-authorize-'));
  const inputPath = path.join(dir, 'authorize-input.json');
  const phasePath = path.join(dir, 'authorize-phase.json');
  const receiptPath = path.join(dir, 'authorize-receipt.json');
  const script = path.resolve(ROOT, '..', 'execution-lifecycle-authorize-phase-binding', 'test-execution-lifecycle-authorize-phase-binding.js');
  const run = spawnSync(process.execPath, [script, inputPath, phasePath, receiptPath], { stdio: 'ignore', timeout: 240000 });
  assert.strictEqual(run.status, 0, `authorize source failed: ${run.error ? run.error.message : 'non-zero status'}`);
  return {
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
    phase: JSON.parse(fs.readFileSync(phasePath, 'utf8')),
    receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
  };
}

const source = loadAuthorizeArtifacts();

function positiveInput(evaluatedAt = '2026-08-27T18:01:15Z') {
  return {
    protocol: 'FCL', version: '0.1', profile: 'execute-revalidation-source-parameterization-v0.1',
    binding_id: 'fcl-execute-revalidation-interrupt-v0-1',
    decision_id: 'urn:uu-aap:execute-revalidation:fcl-interrupt-v0-1',
    origin: clone(ORIGIN),
    authorize_binding_input: clone(source.input),
    authorize_phase: clone(source.phase),
    fcl_authorize_phase_receipt: clone(source.receipt),
    evaluated_at: evaluatedAt,
  };
}

const canonicalInput = positiveInput();
const preparedSource = prepareValidatedSource(canonicalInput);
process.stdout.write('PASS prepared exact FCL authorize source once\n');

function testPositiveReadyDecision() {
  const input = positiveInput();
  assert.strictEqual(validateInput(input, preparedSource), true);
  const result = revalidateWithPreparedSource(input, preparedSource);
  assert.strictEqual(result.generic_revalidation_decision.decision.status, 'ready');
  assert.strictEqual(result.generic_revalidation_decision.non_effects.permit_consumed, false);
  assert.strictEqual(result.generic_revalidation_decision.non_effects.actuator_invocation_emitted, false);
  assert.strictEqual(result.fcl_revalidation_receipt.next_safe_action, 'PARAMETERIZE_EXECUTION_INVOCATION_ENVELOPE_FCL_SOURCE');
  assert.strictEqual(validateReceipt(result.fcl_revalidation_receipt), true);
}

function testDeterministicReadyDecision() {
  const first = revalidateWithPreparedSource(positiveInput(), preparedSource);
  const second = revalidateWithPreparedSource(positiveInput(), preparedSource);
  assert.deepStrictEqual(first, second);
}

function testParameterizedHelperAcceptsFCLDecision() {
  const input = positiveInput();
  const decision = buildDecision(input, preparedSource);
  assert.strictEqual(validateDecision(decision, input.authorize_binding_input.generic_assessment), true);
}

function testStaleRevalidationFailsClosed() {
  expectFailure('stale revalidation', () => validateInput(positiveInput('2026-08-27T18:02:01Z'), preparedSource), /stale execute revalidation/);
}

function testRevalidationCannotPredateAuthorize() {
  expectFailure('predates authorize', () => validateInput(positiveInput('2026-08-27T18:01:13Z'), preparedSource), /cannot predate authorize phase binding/);
}

function testConsumedPermitFailsClosed() {
  const input = positiveInput();
  input.authorize_binding_input.assessment_input.pre_action_bundle.core_receipts.action_permit.payload.consumed = true;
  expectFailure('consumed permit', () => validateInput(input, preparedSource), /prepared source authorize binding input mismatch/);
}

function testNonOneShotPermitFailsClosed() {
  const input = positiveInput();
  input.authorize_binding_input.assessment_input.pre_action_bundle.core_receipts.action_permit.payload.one_shot = false;
  expectFailure('non one-shot permit', () => validateInput(input, preparedSource), /prepared source authorize binding input mismatch/);
}

function testAuthorizePhaseSubstitutionRejected() {
  const input = positiveInput();
  input.authorize_phase.target_binding_hash = `sha256:${'1'.repeat(64)}`;
  expectFailure('authorize phase substitution', () => validateInput(input, preparedSource), /prepared source authorize phase mismatch/);
}

function testAuthorizeReceiptSubstitutionRejected() {
  const input = positiveInput();
  input.fcl_authorize_phase_receipt.target_binding_hash = `sha256:${'2'.repeat(64)}`;
  expectFailure('authorize receipt substitution', () => validateInput(input, preparedSource), /prepared source authorize receipt mismatch/);
}

function testAdmissionSubstitutionRejected() {
  const input = positiveInput();
  input.authorize_binding_input.generic_assessment.content_hash = `sha256:${'3'.repeat(64)}`;
  expectFailure('admission substitution', () => validateInput(input, preparedSource), /prepared source authorize binding input mismatch/);
}

function testTargetAndFrontierSubstitutionRejected() {
  const input = positiveInput();
  input.authorize_binding_input.assessment_input.pre_action_bundle.target.binding_hash = `sha256:${'4'.repeat(64)}`;
  expectFailure('target substitution', () => validateInput(input, preparedSource), /prepared source authorize binding input mismatch/);

  const input2 = positiveInput();
  input2.authorize_binding_input.assessment_input.pre_action_bundle.target.expected_predecessor_frontier += ':other';
  expectFailure('frontier substitution', () => validateInput(input2, preparedSource), /prepared source authorize binding input mismatch/);
}

function testExecuteHorizonExtensionRejected() {
  const input = positiveInput();
  const decision = buildDecision(input, preparedSource);
  decision.freshness_binding.execute_revalidation_must_occur_by = '2026-08-27T18:03:00Z';
  decision.content_hash = hashWithoutContentHash(decision);
  expectFailure('execute horizon extension', () => validateDecision(decision, input.authorize_binding_input.generic_assessment), /execute horizon/);
}

function testGenericDecisionOverclaimRejected() {
  const input = positiveInput();
  const decision = buildDecision(input, preparedSource);
  decision.non_effects.actuator_invocation_emitted = true;
  decision.content_hash = hashWithoutContentHash(decision);
  expectFailure('actuator overclaim', () => validateDecision(decision, input.authorize_binding_input.generic_assessment), /non-effect actuator_invocation_emitted/);
}

function testFCLReceiptOverclaimRejected() {
  const result = revalidateWithPreparedSource(positiveInput(), preparedSource);
  result.fcl_revalidation_receipt.non_effects.invocation_envelope_created = true;
  expectFailure('envelope overclaim', () => validateReceipt(result.fcl_revalidation_receipt), /invocation_envelope_created/);
}

function testReadOnlyCliAndImportSafe() {
  const script = path.resolve(ROOT, 'execute-revalidation-source-parameterization.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
  assert.strictEqual(imported.status, 0, imported.stderr);
  assert.strictEqual(imported.stdout, '');
  assert.strictEqual(imported.stderr, '');
  for (const command of ['invoke','execute','probe','consume','interrupt','send','actuate']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8', timeout: 5000 });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}

const tests = [
  testPositiveReadyDecision,
  testDeterministicReadyDecision,
  testParameterizedHelperAcceptsFCLDecision,
  testStaleRevalidationFailsClosed,
  testRevalidationCannotPredateAuthorize,
  testConsumedPermitFailsClosed,
  testNonOneShotPermitFailsClosed,
  testAuthorizePhaseSubstitutionRejected,
  testAuthorizeReceiptSubstitutionRejected,
  testAdmissionSubstitutionRejected,
  testTargetAndFrontierSubstitutionRejected,
  testExecuteHorizonExtensionRejected,
  testGenericDecisionOverclaimRejected,
  testFCLReceiptOverclaimRejected,
  testReadOnlyCliAndImportSafe,
];

for (const test of tests) {
  test();
  process.stdout.write(`PASS ${test.name}\n`);
}

const input = positiveInput();
const result = revalidateWithPreparedSource(input, preparedSource);
if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(input, null, 2)}\n`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], `${JSON.stringify(result.generic_revalidation_decision, null, 2)}\n`);
if (process.argv[4]) fs.writeFileSync(process.argv[4], `${JSON.stringify(result.fcl_revalidation_receipt, null, 2)}\n`);
process.stdout.write(`PASS FCL Execute Revalidation Source Parameterization v0.1 conformance (${tests.length} groups)\n`);
