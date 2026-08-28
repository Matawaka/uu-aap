'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  buildContract,
  prepareValidatedSource,
  prepareWithPreparedSource,
  validateContract,
  validateInput,
} = require('./invocation-action-receipt-postexecution-source-contract.js');

const ROOT = __dirname;
const clone = value => JSON.parse(JSON.stringify(value));
const ORIGIN = {
  repository: 'Matawaka/uu-aap',
  revision: '88a0cb4583b0840308387a9c528087f24ebd9574',
  tree: '523678a953bf8a0cc34eb46522cc58a94b8c4d4b',
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

function loadInvocationArtifacts() {
  const cached = {
    input: process.env.FCL_POSTEXEC_CACHED_INVOCATION_INPUT,
    envelope: process.env.FCL_POSTEXEC_CACHED_INVOCATION_ENVELOPE,
    receipt: process.env.FCL_POSTEXEC_CACHED_INVOCATION_RECEIPT,
  };
  if (cached.input && cached.envelope && cached.receipt && Object.values(cached).every(file => fs.existsSync(file))) {
    return {
      input: JSON.parse(fs.readFileSync(cached.input, 'utf8')),
      envelope: JSON.parse(fs.readFileSync(cached.envelope, 'utf8')),
      receipt: JSON.parse(fs.readFileSync(cached.receipt, 'utf8')),
    };
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-postexec-invocation-'));
  const inputPath = path.join(dir, 'invocation-input.json');
  const envelopePath = path.join(dir, 'invocation-envelope.json');
  const receiptPath = path.join(dir, 'invocation-receipt.json');
  const script = path.resolve(ROOT, '..', 'execution-invocation-envelope-source-parameterization', 'test-execution-invocation-envelope-source-parameterization.js');
  const run = spawnSync(process.execPath, [script, inputPath, envelopePath, receiptPath], { stdio: 'ignore', timeout: 360000 });
  assert.strictEqual(run.status, 0, `invocation envelope source failed: ${run.error ? run.error.message : 'non-zero status'}`);
  return {
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
    envelope: JSON.parse(fs.readFileSync(envelopePath, 'utf8')),
    receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
  };
}

const source = loadInvocationArtifacts();

function positiveInput(preparedAt = '2026-08-27T18:01:17Z') {
  return {
    protocol: 'FCL',
    version: '0.1',
    profile: 'invocation-action-receipt-postexecution-source-contract-v0.1',
    contract_id: 'urn:uu-aap:fcl:postexecution-source-contract:interrupt-v0-1',
    origin: clone(ORIGIN),
    invocation_envelope_input: clone(source.input),
    execution_invocation_envelope: clone(source.envelope),
    fcl_invocation_envelope_receipt: clone(source.receipt),
    prepared_at: preparedAt,
  };
}

const canonicalInput = positiveInput();
const preparedSource = prepareValidatedSource(canonicalInput);
process.stdout.write('PASS prepared exact #578 invocation-envelope source once\n');

function testPositiveContract() {
  const input = positiveInput();
  assert.strictEqual(validateInput(input, preparedSource), true);
  const result = prepareWithPreparedSource(input, preparedSource);
  const contract = result.post_execution_source_contract;
  assert.strictEqual(contract.status, 'awaiting_execution_evidence');
  assert.strictEqual(contract.performed_resource_ref_requirement.status, 'required_from_execution_evidence');
  assert.strictEqual(contract.performed_resource_ref_requirement.value, null);
  assert.strictEqual(contract.performed_resource_ref_requirement.inference_from_target_binding_hash, false);
  assert.strictEqual(contract.non_effects.actuator_invocation_emitted, false);
  assert.strictEqual(contract.non_effects.permit_consumed, false);
  assert.strictEqual(contract.non_effects.core_action_receipt_created, false);
  assert.strictEqual(contract.next_safe_action, 'BIND_FCL_RUNTIME_EXECUTION_EVIDENCE_SOURCE');
  assert.strictEqual(validateContract(contract), true);
}

function testDeterministicContract() {
  const first = prepareWithPreparedSource(positiveInput(), preparedSource);
  const second = prepareWithPreparedSource(positiveInput(), preparedSource);
  assert.deepStrictEqual(first, second);
}

function testContractCapturesExactFutureRequirements() {
  const contract = buildContract(positiveInput(), preparedSource);
  assert.strictEqual(contract.required_execution_evidence.emission_status, 'emitted');
  assert.strictEqual(contract.required_execution_evidence.one_shot_envelope_consumed, true);
  assert.strictEqual(contract.required_execution_evidence.action_permit_consumed, true);
  assert.strictEqual(contract.required_execution_evidence.performed_resource_ref_required, true);
  assert.strictEqual(contract.required_action_receipt.predecessor_action_permit_hash, source.envelope.evidence_binding.action_permit_hash);
  assert.strictEqual(contract.required_action_receipt.predecessor_frontier, source.envelope.action_binding.predecessor_frontier);
  assert.strictEqual(contract.required_action_receipt.performed_scope_rule, '<operation>:<performed_resource_ref>');
}

function testContractCannotPredateEnvelope() {
  expectFailure('predates envelope', () => validateInput(positiveInput('2026-08-27T18:01:15Z'), preparedSource), /cannot predate invocation envelope/);
}

function testContractAfterEnvelopeExpiryRejected() {
  expectFailure('after expiry', () => validateInput(positiveInput('2026-08-27T18:02:01Z'), preparedSource), /prepared after invocation envelope expiry/);
}

function testEnvelopeSubstitutionRejected() {
  const input = positiveInput();
  input.execution_invocation_envelope.content_hash = `sha256:${'1'.repeat(64)}`;
  expectFailure('envelope substitution', () => validateInput(input, preparedSource), /prepared source invocation envelope mismatch/);
}

function testFCLReceiptSubstitutionRejected() {
  const input = positiveInput();
  input.fcl_invocation_envelope_receipt.target_binding_hash = `sha256:${'2'.repeat(64)}`;
  expectFailure('FCL receipt substitution', () => validateInput(input, preparedSource), /prepared source FCL invocation envelope receipt mismatch/);
}

function testInvocationAndAdapterSubstitutionRejected() {
  const invocation = positiveInput();
  invocation.execution_invocation_envelope.invocation.invocation_id += ':other';
  expectFailure('invocation substitution', () => validateInput(invocation, preparedSource), /prepared source invocation envelope mismatch/);

  const adapter = positiveInput();
  adapter.execution_invocation_envelope.invocation.adapter_id += ':other';
  expectFailure('adapter substitution', () => validateInput(adapter, preparedSource), /prepared source invocation envelope mismatch/);
}

function testPermitTargetFrontierSubstitutionRejected() {
  const permit = positiveInput();
  permit.invocation_envelope_input.revalidation_input.authorize_binding_input.assessment_input.pre_action_bundle.core_receipts.action_permit.content_hash = `sha256:${'3'.repeat(64)}`;
  expectFailure('permit substitution', () => validateInput(permit, preparedSource), /prepared source invocation envelope input mismatch/);

  const target = positiveInput();
  target.execution_invocation_envelope.action_binding.target_binding_hash = `sha256:${'4'.repeat(64)}`;
  expectFailure('target substitution', () => validateInput(target, preparedSource), /prepared source invocation envelope mismatch/);

  const frontier = positiveInput();
  frontier.execution_invocation_envelope.action_binding.predecessor_frontier += ':other';
  expectFailure('frontier substitution', () => validateInput(frontier, preparedSource), /prepared source invocation envelope mismatch/);
}

function testPerformedResourceCannotBeInjectedOrInferred() {
  const input = positiveInput();
  input.performed_resource_ref = 'urn:uu-aap:resource:invented';
  expectFailure('input resource injection', () => validateInput(input, preparedSource), /input keys mismatch/);

  const contract = buildContract(positiveInput(), preparedSource);
  contract.performed_resource_ref_requirement.value = 'urn:uu-aap:resource:invented';
  expectFailure('contract resource injection', () => validateContract(contract), /value must remain null/);

  const inferred = buildContract(positiveInput(), preparedSource);
  inferred.performed_resource_ref_requirement.inference_from_target_binding_hash = true;
  expectFailure('resource inference', () => validateContract(inferred), /must not be inferred/);
}

function testExecutionFactOverclaimsRejected() {
  const contract = buildContract(positiveInput(), preparedSource);
  contract.non_effects.actuator_invocation_emitted = true;
  expectFailure('emission overclaim', () => validateContract(contract), /actuator_invocation_emitted/);

  const consumed = buildContract(positiveInput(), preparedSource);
  consumed.non_effects.envelope_consumed = true;
  expectFailure('envelope consumption overclaim', () => validateContract(consumed), /envelope_consumed/);

  const performed = buildContract(positiveInput(), preparedSource);
  performed.non_effects.action_performed = true;
  expectFailure('action overclaim', () => validateContract(performed), /action_performed/);
}

function testRequiredExecutionEvidenceCannotBeWeakened() {
  const contract = buildContract(positiveInput(), preparedSource);
  contract.required_execution_evidence.expected_target_guard_passed = false;
  expectFailure('target guard weakening', () => validateContract(contract), /expected_target_guard_passed/);

  const permit = buildContract(positiveInput(), preparedSource);
  permit.required_execution_evidence.action_permit_consumed = false;
  expectFailure('future permit consumption weakening', () => validateContract(permit), /action_permit_consumed/);
}

function testSyntheticPostExecutionArtifactsRejected() {
  const contract = buildContract(positiveInput(), preparedSource);
  contract.invocation_evidence = { emission_status: 'emitted' };
  expectFailure('synthetic invocation evidence', () => validateContract(contract), /contract keys mismatch/);

  const actionReceipt = buildContract(positiveInput(), preparedSource);
  actionReceipt.core_action_receipt = { receipt_type: 'ActionReceipt' };
  expectFailure('synthetic ActionReceipt', () => validateContract(actionReceipt), /contract keys mismatch/);
}

function testReadOnlyCliAndImportSafe() {
  const script = path.resolve(ROOT, 'invocation-action-receipt-postexecution-source-contract.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8', timeout: 5000 });
  assert.strictEqual(imported.status, 0, imported.stderr);
  assert.strictEqual(imported.stdout, '');
  assert.strictEqual(imported.stderr, '');
  for (const command of ['invoke', 'execute', 'emit', 'consume', 'interrupt', 'send', 'actuate']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8', timeout: 5000 });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}

const tests = [
  testPositiveContract,
  testDeterministicContract,
  testContractCapturesExactFutureRequirements,
  testContractCannotPredateEnvelope,
  testContractAfterEnvelopeExpiryRejected,
  testEnvelopeSubstitutionRejected,
  testFCLReceiptSubstitutionRejected,
  testInvocationAndAdapterSubstitutionRejected,
  testPermitTargetFrontierSubstitutionRejected,
  testPerformedResourceCannotBeInjectedOrInferred,
  testExecutionFactOverclaimsRejected,
  testRequiredExecutionEvidenceCannotBeWeakened,
  testSyntheticPostExecutionArtifactsRejected,
  testReadOnlyCliAndImportSafe,
];

for (const test of tests) {
  test();
  process.stdout.write(`PASS ${test.name}\n`);
}

const input = positiveInput();
const result = prepareWithPreparedSource(input, preparedSource);
if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(input, null, 2)}\n`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], `${JSON.stringify(result.post_execution_source_contract, null, 2)}\n`);
process.stdout.write(`PASS FCL Invocation→ActionReceipt Post-Execution Source Contract v0.1 conformance (${tests.length} groups)\n`);
