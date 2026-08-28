'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  assemble,
  buildAssemblyReceipt,
  buildBundle,
  fourSourceMinimum,
  threeWayHorizon,
  validateAssemblyReceipt,
  validateInput,
} = require('./pre-action-bundle-assembly.js');
const { buildBridgeRecord, evidenceContextForBridge } = require('../pre-action-evidence-bridge/pre-action-evidence-bridge.js');
const { validateInput: validateActionPermitInput } = require('../core-action-permit-binding/core-action-permit-binding.js');
const { sha256Object, validateBundle } = require('../../../integration/pre-action-evidence-bundle/v0.1/validate-pre-action-evidence-bundle.js');

const clone = value => JSON.parse(JSON.stringify(value));
const ROOT = __dirname;
const ORIGIN = {
  repository: 'Matawaka/uu-aap',
  revision: '1f4e72b06b6587faef044816db0be3f876cbd712',
  tree: 'e7911dc76867e920ece7622f4059af818f2ba4c2',
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

function runNode(label, script, args = [], env = {}) {
  const run = spawnSync(process.execPath, [script, ...args], {
    stdio: 'ignore', timeout: 60000, env: { ...process.env, ...env },
  });
  assert.strictEqual(run.status, 0, `${label} failed: ${run.error ? run.error.message : 'non-zero status'}`);
}

function materializeSources() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-assembly-sources-'));
  const reconciliationReceiptPath = path.join(dir, 'reconciliation.json');
  const reconciliationInputPath = path.join(dir, 'reconciliation-input.json');
  const reconciliationScript = path.resolve(ROOT, '..', 'pre-action-evidence-contract-reconciliation', 'test-pre-action-evidence-contract-reconciliation.js');
  runNode('reconciliation source', reconciliationScript, [reconciliationReceiptPath, reconciliationInputPath]);

  const reconciliationReceipt = JSON.parse(fs.readFileSync(reconciliationReceiptPath, 'utf8'));
  const reconciliationInput = JSON.parse(fs.readFileSync(reconciliationInputPath, 'utf8'));
  const cachedPermitPath = path.join(dir, 'permit.json');
  const cachedPermitInputPath = path.join(dir, 'permit-input.json');
  fs.writeFileSync(cachedPermitPath, `${JSON.stringify(reconciliationInput.fcl_core_action_permit, null, 2)}\n`);
  fs.writeFileSync(cachedPermitInputPath, `${JSON.stringify(reconciliationInput.fcl_core_action_permit_binding_input, null, 2)}\n`);

  const approvalReceiptPath = path.join(dir, 'approval.json');
  const approvalInputPath = path.join(dir, 'approval-input.json');
  const approvalScript = path.resolve(ROOT, '..', 'action-specific-approval', 'run-conformance-cached.js');
  runNode('approval source', approvalScript, [approvalReceiptPath, approvalInputPath], {
    FCL_APPROVAL_CACHED_PERMIT: cachedPermitPath,
    FCL_APPROVAL_CACHED_PERMIT_INPUT: cachedPermitInputPath,
  });

  return {
    reconciliationReceipt,
    reconciliationInput,
    approvalReceipt: JSON.parse(fs.readFileSync(approvalReceiptPath, 'utf8')),
    approvalInput: JSON.parse(fs.readFileSync(approvalInputPath, 'utf8')),
  };
}

const sources = materializeSources();

function bridgeInput() {
  return {
    protocol: 'FCL', version: '0.1', profile: 'pre-action-evidence-bridge-v0.1',
    bridge_id: 'fcl-preaction-bridge-assembly-interrupt-v0-1',
    origin: clone(ORIGIN),
    reconciliation_input: clone(sources.reconciliationInput),
    reconciliation_receipt: clone(sources.reconciliationReceipt),
    bridged_at: '2026-08-27T18:01:11Z',
  };
}

function positiveInput() {
  const bInput = bridgeInput();
  return {
    protocol: 'FCL', version: '0.1', profile: 'pre-action-bundle-assembly-v0.1',
    assembly_id: 'fcl-preaction-assembly-interrupt-v0-1',
    bundle_id: 'urn:uu-aap:pre-action:fcl-production-assembly-interrupt-v0-1',
    origin: clone(ORIGIN),
    bridge_input: bInput,
    bridge_record: buildBridgeRecord(bInput),
    approval_input: clone(sources.approvalInput),
    approval_receipt: clone(sources.approvalReceipt),
    assembled_at: '2026-08-27T18:01:12Z',
  };
}

function rehash(value) { value.content_hash = sha256Object(value); return value; }

function testPositiveAssembly() {
  const input = positiveInput();
  assert.strictEqual(validateInput(input), true);
  const result = assemble(input);
  assert.strictEqual(validateAssemblyReceipt(result.assembly_receipt, input, result.bundle), true);
  assert.strictEqual(result.assembly_receipt.next_safe_action, 'EVALUATE_PRE_ACTION_AUTHORIZE_ADMISSION');
  assert.strictEqual(result.bundle.lifecycle_handoff.authorization_must_occur_by, threeWayHorizon(input));
  assert.strictEqual(threeWayHorizon(input), fourSourceMinimum(input));
}

function testDeterministicAssembly() {
  const input = positiveInput();
  assert.deepStrictEqual(assemble(input), assemble(clone(input)));
}

function testDirectBridgeAwareReusableValidation() {
  const input = positiveInput();
  const bundle = buildBundle(input);
  assert.strictEqual(validateBundle(bundle, evidenceContextForBridge(input.bridge_input), input.bridge_record), true);
}

function testSameBundleFailsWithoutBridge() {
  const input = positiveInput();
  const bundle = buildBundle(input);
  expectFailure('bundle without bridge', () => validateBundle(bundle, evidenceContextForBridge(input.bridge_input)), /target operation mismatch|state receipt not bound/);
}

function testBridgeSubstitutionRejected() {
  const input = positiveInput();
  input.bridge_record.target_operation = input.bridge_record.selected_operation;
  rehash(input.bridge_record);
  expectFailure('bridge substitution', () => validateInput(input), /bridge source invalid|not exactly reproducible/);
}

function testApprovalSubstitutionRejected() {
  const input = positiveInput();
  input.approval_receipt.target_binding_hash = `sha256:${'1'.repeat(64)}`;
  expectFailure('approval substitution', () => validateInput(input), /approval source invalid|approval.*mismatch/);
}

function testApprovalPermitMismatchRejected() {
  const input = positiveInput();
  input.approval_input.core_action_permit.content_hash = `sha256:${'2'.repeat(64)}`;
  expectFailure('approval permit mismatch', () => validateInput(input), /approval source invalid|ActionPermit/);
}

function testIdentifierCollapseRejected() {
  const input = positiveInput();
  input.bridge_record.selected_operation = input.bridge_record.target_operation;
  rehash(input.bridge_record);
  expectFailure('identifier collapse', () => validateInput(input), /bridge source invalid|not exactly reproducible/);
}

function testTargetBindingSubstitutionRejected() {
  const input = positiveInput();
  const bundle = buildBundle(input);
  bundle.target.binding_hash = `sha256:${'3'.repeat(64)}`;
  rehash(bundle);
  expectFailure('target binding substitution', () => validateBundle(bundle, evidenceContextForBridge(input.bridge_input), input.bridge_record), /target binding hash mismatch|bridge target binding mismatch/);
}

function testStaleGenericAvailabilityRejected() {
  const input = positiveInput();
  input.assembled_at = input.bridge_record.availability.evidence_valid_until;
  expectFailure('stale generic availability', () => validateInput(input), /Execution Availability stale/);
}

function testExpiredApprovalRejected() {
  const input = positiveInput();
  input.assembled_at = input.approval_receipt.approval_binding.valid_until;
  expectFailure('expired approval', () => validateInput(input), /Approval expired|ActionPermit expired|Execution Availability stale/);
}

function testExpiredPermitAlsoBoundsFCLFreshness() {
  const input = positiveInput();
  const permitExpiry = input.bridge_input.reconciliation_input.fcl_core_action_permit.payload.expires_at;
  const fclExpiry = input.bridge_record.availability.action_chain_valid_until;
  assert(Date.parse(permitExpiry) <= Date.parse(fclExpiry), 'canonical permit must not outlive FCL availability');
  input.assembled_at = permitExpiry;
  expectFailure('expired permit', () => validateInput(input), /ActionPermit expired|Approval expired|Execution Availability stale/);
}

function testConsumedPermitRejected() {
  const input = positiveInput();
  input.bridge_input.reconciliation_input.fcl_core_action_permit.payload.consumed = true;
  expectFailure('consumed permit', () => validateInput(input), /bridge source invalid|ActionPermit/);
}

function testThreeWayEqualsExplicitFourSourceMinimum() {
  const input = positiveInput();
  const permit = input.bridge_input.reconciliation_input.fcl_core_action_permit;
  assert(Date.parse(permit.payload.expires_at) <= Date.parse(input.bridge_record.availability.action_chain_valid_until));
  assert.strictEqual(threeWayHorizon(input), fourSourceMinimum(input));
  const result = assemble(input);
  assert.strictEqual(result.assembly_receipt.freshness.authorization_must_occur_by, fourSourceMinimum(input));
  assert.strictEqual(result.assembly_receipt.assertions.permit_within_fcl_availability_horizon, true);
  assert.strictEqual(result.assembly_receipt.assertions.three_way_equals_four_source_min, true);
}

function testInvalidFCLAvailabilityEarlierThanPermitRejectedCanonically() {
  const input = positiveInput();
  const permitInput = clone(input.bridge_input.reconciliation_input.fcl_core_action_permit_binding_input);
  const fclAvailability = permitInput.core_coordination_binding_input.core_availability_claim;
  permitInput.expires_at = new Date(Date.parse(fclAvailability.payload.valid_until) + 1000).toISOString();
  expectFailure('permit outlives FCL availability', () => validateActionPermitInput(permitInput), /expiry exceeds availability/);
}

function testAuthorizationHorizonExtensionRejected() {
  const input = positiveInput();
  const bundle = buildBundle(input);
  bundle.lifecycle_handoff.authorization_must_occur_by = input.bridge_record.availability.action_chain_valid_until;
  if (bundle.lifecycle_handoff.authorization_must_occur_by === threeWayHorizon(input)) {
    bundle.lifecycle_handoff.authorization_must_occur_by = input.bridge_record.availability.evidence_valid_until;
  }
  rehash(bundle);
  expectFailure('authorization horizon extension', () => validateBundle(bundle, evidenceContextForBridge(input.bridge_input), input.bridge_record), /authorization horizon/);
}

function testAssemblyReceiptOverclaimRejected() {
  const input = positiveInput();
  const bundle = buildBundle(input);
  const receipt = buildAssemblyReceipt(input, bundle);
  receipt.non_effects.authorize_admitted = true;
  rehash(receipt);
  expectFailure('assembly overclaim', () => validateAssemblyReceipt(receipt), /authorize_admitted/);
}

function testReadOnlyCli() {
  const script = path.resolve(ROOT, 'pre-action-bundle-assembly.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
  assert.strictEqual(imported.status, 0, imported.stderr);
  assert.strictEqual(imported.stdout, '');
  assert.strictEqual(imported.stderr, '');
  for (const command of ['authorize','execute','probe','consume','interrupt','send']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8', timeout: 5000 });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}

const tests = [
  testPositiveAssembly,
  testDeterministicAssembly,
  testDirectBridgeAwareReusableValidation,
  testSameBundleFailsWithoutBridge,
  testBridgeSubstitutionRejected,
  testApprovalSubstitutionRejected,
  testApprovalPermitMismatchRejected,
  testIdentifierCollapseRejected,
  testTargetBindingSubstitutionRejected,
  testStaleGenericAvailabilityRejected,
  testExpiredApprovalRejected,
  testExpiredPermitAlsoBoundsFCLFreshness,
  testConsumedPermitRejected,
  testThreeWayEqualsExplicitFourSourceMinimum,
  testInvalidFCLAvailabilityEarlierThanPermitRejectedCanonically,
  testAuthorizationHorizonExtensionRejected,
  testAssemblyReceiptOverclaimRejected,
  testReadOnlyCli,
];

for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }

const input = positiveInput();
const result = assemble(input);
if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(input, null, 2)}\n`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], `${JSON.stringify(result.bundle, null, 2)}\n`);
if (process.argv[4]) fs.writeFileSync(process.argv[4], `${JSON.stringify(result.assembly_receipt, null, 2)}\n`);
process.stdout.write(`PASS FCL PreAction Bundle Assembly v0.1 conformance (${tests.length} groups)\n`);
