#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  FCLPreActionEvidenceBridgeError,
  buildBridgeRecord,
  evidenceContextForBridge,
  hashObject,
  validateBoundBridgeRecord,
  validateBridgeRecord,
  validateBundleWithBridge,
  validateInput,
} = require('./pre-action-evidence-bridge.js');
const {
  coreHash,
  sha256Object,
  validateBundle,
  validateEvidenceBridgeContext,
} = require('../../../integration/pre-action-evidence-bundle/v0.1/validate-pre-action-evidence-bundle.js');

const clone = value => JSON.parse(JSON.stringify(value));
const ROOT = __dirname;
const ORIGIN = {
  repository: 'Matawaka/uu-aap',
  revision: '5c04365c176320c19bddc17fcd65e935bf1e3057',
  tree: '49cb3df672b2a360568536db5baa280edeadb3cf',
};

function expectBridgeFailure(label, fn, pattern = null) {
  let failed = false;
  try { fn(); }
  catch (error) {
    failed = true;
    assert(error instanceof FCLPreActionEvidenceBridgeError, `${label}: wrong error ${error && error.name}`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function expectGenericFailure(label, fn, pattern = null) {
  let failed = false;
  try { fn(); }
  catch (error) {
    failed = true;
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function predecessorRunFailure(label, run) {
  if (run.error) return `${label} failed: ${run.error.message}`;
  if (run.signal) return `${label} failed: signal ${run.signal}`;
  return `${label} failed with status ${run.status}`;
}

function loadReconciliationSample() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-bridge-reconciliation-'));
  const receiptPath = path.join(dir, 'reconciliation.json');
  const inputPath = path.join(dir, 'reconciliation-input.json');
  const script = path.resolve(ROOT, '..', 'pre-action-evidence-contract-reconciliation', 'test-pre-action-evidence-contract-reconciliation.js');
  const run = spawnSync(process.execPath, [script, receiptPath, inputPath], {
    stdio: 'inherit',
    timeout: 60000,
    killSignal: 'SIGKILL',
  });
  assert.strictEqual(run.status, 0, predecessorRunFailure('reconciliation predecessor suite', run));
  return {
    receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
  };
}

function loadApprovalSample() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-bridge-approval-'));
  const receiptPath = path.join(dir, 'approval.json');
  const inputPath = path.join(dir, 'approval-input.json');
  const script = path.resolve(ROOT, '..', 'action-specific-approval', 'test-action-specific-approval.js');
  const run = spawnSync(process.execPath, [script, receiptPath, inputPath], {
    stdio: 'inherit',
    timeout: 60000,
    killSignal: 'SIGKILL',
  });
  assert.strictEqual(run.status, 0, predecessorRunFailure('approval predecessor suite', run));
  return {
    receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
  };
}

const reconciliationSample = loadReconciliationSample();
const approvalSample = loadApprovalSample();

assert.strictEqual(
  approvalSample.input.core_action_permit.content_hash,
  reconciliationSample.input.fcl_core_action_permit.content_hash,
  'approval and reconciliation samples must bind the exact same ActionPermit'
);

function bridgeInput() {
  return {
    protocol: 'FCL',
    version: '0.1',
    profile: 'pre-action-evidence-bridge-v0.1',
    bridge_id: 'fcl-preaction-bridge-interrupt-v0-1',
    origin: clone(ORIGIN),
    reconciliation_input: clone(reconciliationSample.input),
    reconciliation_receipt: clone(reconciliationSample.receipt),
    bridged_at: '2026-08-27T18:01:11Z',
  };
}

function earliestOriginal(...values) {
  return values.reduce((best, value) => Date.parse(value) < Date.parse(best) ? value : best);
}

function bundleForBridge() {
  const input = bridgeInput();
  const rInput = input.reconciliation_input;
  const mapping = rInput.capability_mapping_receipt;
  const executionAvailability = rInput.execution_capability_availability;
  const permitInput = rInput.fcl_core_action_permit_binding_input;
  const permit = rInput.fcl_core_action_permit;
  const c = permitInput.core_coordination_binding_input;
  const coordination = permitInput.core_coordination_receipt;
  const approval = approvalSample.receipt.approval_binding;
  const target = permit.payload.target;

  const bundle = {
    protocol: 'UU-AAP-PRE-ACTION-EVIDENCE-BUNDLE',
    version: '0.1',
    artifact_type: 'PreActionEvidenceBundle',
    bundle_id: 'urn:uu-aap:pre-action:fcl-bridge-interrupt-v0-1',
    assembled_at: '2026-08-27T18:01:12Z',
    subject: clone(c.core_state_receipt.subject),
    selection_binding: {
      selection_id: mapping.selection_id,
      content_hash: mapping.selection_content_hash,
      selected_capability_id: mapping.selected_capability_id,
      descriptor_id: mapping.selected_descriptor_id,
      descriptor_content_hash: mapping.selected_descriptor_content_hash,
      operation: mapping.selected_operation,
    },
    availability_binding: {
      binding_id: executionAvailability.binding_id,
      content_hash: executionAvailability.content_hash,
      observation_content_hash: executionAvailability.observation.content_hash,
      core_availability_claim_hash: executionAvailability.core_availability_claim.content_hash,
      status: executionAvailability.observation.status,
      valid_until: executionAvailability.observation.valid_until,
      frontier: executionAvailability.observation.frontier.revision,
    },
    target: {
      resource: target.resource,
      operation: target.operation,
      expected_predecessor_frontier: target.expected_predecessor_frontier,
      authority_scope: target.authority_scope,
      binding_hash: permit.payload.target_binding_hash,
    },
    approval_binding: clone(approval),
    core_receipts: {
      state: clone(c.core_state_receipt),
      availability: clone(c.core_availability_claim),
      intent: clone(c.core_intent_receipt),
      authority_or_responsibility: clone(c.core_authority_receipt),
      coordination: clone(coordination),
      action_permit: clone(permit),
    },
    lifecycle_handoff: {
      protocol: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE',
      version: '0.1',
      next_phase: 'authorize',
      frontier: target.expected_predecessor_frontier,
      target_binding_hash: permit.payload.target_binding_hash,
      action_permit_hash: permit.content_hash,
      approval_hash: approval.content_hash,
      authorization_must_occur_by: earliestOriginal(
        executionAvailability.observation.valid_until,
        approval.valid_until,
        permit.payload.expires_at
      ),
      one_shot: true,
      permit_consumed: false,
    },
    assertions: {
      core_chain_valid: true,
      availability_fresh_at_assembly: true,
      approval_exactly_bound: true,
      target_exactly_bound: true,
      action_permit_preexists_bundle: true,
      evidence_complete_for_authorize_handoff: true,
    },
    non_effects: {
      intent_created_by_bundle: false,
      authority_created_by_bundle: false,
      approval_created_by_bundle: false,
      action_permit_created_by_bundle: false,
      action_performed: false,
      outcome_observed: false,
      authority_expanded: false,
      future_action_permission_created: false,
      general_authority_created: false,
      causality_proven: false,
      truth_certified: false,
      liability_established: false,
    },
    content_hash: '',
  };
  bundle.content_hash = sha256Object(bundle);
  return bundle;
}

function rehashBundle(bundle) {
  bundle.content_hash = '';
  bundle.content_hash = sha256Object(bundle);
  return bundle;
}
function rehashBridge(bridge) {
  bridge.content_hash = '';
  bridge.content_hash = hashObject(bridge);
  return bridge;
}
function rehashCore(receipt) {
  receipt.content_hash = coreHash(receipt);
  return receipt;
}

function testHistoricalNoBridgeBehaviorStillPasses() {
  const script = path.resolve(ROOT, '..', '..', '..', 'integration', 'pre-action-evidence-bundle', 'v0.1', 'validate-pre-action-evidence-bundle.js');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  assert(/UU-AAP Pre-Action Evidence Bundle v0.1: PASS/.test(run.stdout));
}

function testHistoricalExplicitEvidenceContextStillPasses() {
  const script = path.resolve(ROOT, '..', '..', '..', 'integration', 'pre-action-evidence-bundle', 'v0.1', 'test-evidence-context.js');
  const run = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
}

function testPositiveBridgeRecord() {
  const input = bridgeInput();
  assert.strictEqual(validateInput(input), true);
  const record = buildBridgeRecord(input);
  assert.strictEqual(validateBridgeRecord(record), true);
  assert.strictEqual(validateBoundBridgeRecord(record, input), true);
  assert.strictEqual(validateEvidenceBridgeContext(record), true);
  assert.notStrictEqual(record.selected_operation, record.target_operation);
  assert.strictEqual(record.next_safe_action, 'ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE');
  assert.strictEqual(record.action_permit_hash, input.reconciliation_input.fcl_core_action_permit.content_hash);
}

function testDeterministicBridgeRecord() {
  const input = bridgeInput();
  assert.deepStrictEqual(buildBridgeRecord(input), buildBridgeRecord(clone(input)));
}

function testFCLBundlePassesOnlyWithExactBridge() {
  const input = bridgeInput();
  const bundle = bundleForBridge();
  const bridge = buildBridgeRecord(input);
  const evidenceContext = evidenceContextForBridge(input);
  assert.strictEqual(validateBundle(bundle, evidenceContext, bridge), true);
  assert.strictEqual(validateBundleWithBridge(bundle, input), true);
  expectGenericFailure('same FCL bundle without bridge', () => validateBundle(bundle, evidenceContext), /target operation mismatch|state receipt not bound/);
}

function testSelectedOperationSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.selected_operation = 'delete_everything';
  rehashBridge(bridge);
  expectGenericFailure('selected operation substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge selected operation mismatch/);
}

function testTargetOperationSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.target_operation = 'fcl.run.other';
  rehashBridge(bridge);
  expectGenericFailure('target operation substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge target operation mismatch/);
}

function testEvidenceAvailabilityBindingSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.availability.evidence_binding_content_hash = `sha256:${'1'.repeat(64)}`;
  rehashBridge(bridge);
  expectGenericFailure('evidence availability binding substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge evidence availability binding mismatch/);
}

function testActionChainAvailabilitySubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.availability.action_chain_availability_claim_hash = `sha256:${'2'.repeat(64)}`;
  rehashBridge(bridge);
  expectGenericFailure('action-chain availability substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge action-chain AvailabilityClaim mismatch/);
}

function testIntentProjectionSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.projections.intent.source_receipt_hash = `sha256:${'3'.repeat(64)}`;
  rehashBridge(bridge);
  expectGenericFailure('intent projection substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge IntentReceipt source mismatch/);
}

function testAuthorityProjectionSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.projections.authority.authority_scope = 'fcl.run.other';
  rehashBridge(bridge);
  expectGenericFailure('authority projection substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge authority scope mismatch/);
}

function testCoordinationProjectionSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.projections.coordination.source_receipt_hash = `sha256:${'4'.repeat(64)}`;
  rehashBridge(bridge);
  expectGenericFailure('coordination projection substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge CoordinationReceipt source mismatch/);
}

function testActionPermitSourceSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge(), bridge = buildBridgeRecord(input);
  bridge.action_permit_hash = `sha256:${'5'.repeat(64)}`;
  rehashBridge(bridge);
  expectGenericFailure('ActionPermit source substitution', () => validateBundle(bundle, evidenceContextForBridge(input), bridge), /bridge ActionPermit source mismatch/);
}

function testTargetBindingSubstitutionRejected() {
  const input = bridgeInput(), bundle = bundleForBridge();
  bundle.target.binding_hash = `sha256:${'6'.repeat(64)}`;
  rehashBundle(bundle);
  expectBridgeFailure('target binding substitution', () => validateBundleWithBridge(bundle, input), /target binding hash mismatch|PreAction bundle invalid/);
}

function testStaleGenericAvailabilityRejected() {
  const input = bridgeInput(), bundle = bundleForBridge();
  bundle.assembled_at = input.reconciliation_input.execution_capability_availability.observation.valid_until;
  rehashBundle(bundle);
  expectBridgeFailure('stale generic availability', () => validateBundleWithBridge(bundle, input), /availability stale at bundle assembly/);
}

function testConsumedPermitRejected() {
  const input = bridgeInput(), bundle = bundleForBridge();
  bundle.core_receipts.action_permit.payload.consumed = true;
  rehashCore(bundle.core_receipts.action_permit);
  bundle.lifecycle_handoff.action_permit_hash = bundle.core_receipts.action_permit.content_hash;
  rehashBundle(bundle);
  expectBridgeFailure('consumed permit', () => validateBundleWithBridge(bundle, input), /ActionPermit source mismatch|one-shot state mismatch/);
}

function testBridgeInputStaleRejected() {
  const input = bridgeInput();
  input.bridged_at = input.reconciliation_receipt.execution_availability_valid_until;
  expectBridgeFailure('stale bridge input', () => validateInput(input), /Execution Availability stale/);
}

function testBridgeOverclaimRejected() {
  const record = buildBridgeRecord(bridgeInput());
  record.non_effects.authorize_admitted = true;
  rehashBridge(record);
  expectBridgeFailure('bridge overclaim', () => validateBridgeRecord(record), /authorize_admitted/);
}

function testImportSafeAndReadOnlyCli() {
  const script = path.resolve(ROOT, 'pre-action-evidence-bridge.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
  assert.strictEqual(imported.status, 0, imported.stderr);
  assert.strictEqual(imported.stdout, '');
  assert.strictEqual(imported.stderr, '');
  for (const command of ['assemble','authorize','execute','probe','consume','interrupt','send']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8' });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}

const tests = [
  testHistoricalNoBridgeBehaviorStillPasses,
  testHistoricalExplicitEvidenceContextStillPasses,
  testPositiveBridgeRecord,
  testDeterministicBridgeRecord,
  testFCLBundlePassesOnlyWithExactBridge,
  testSelectedOperationSubstitutionRejected,
  testTargetOperationSubstitutionRejected,
  testEvidenceAvailabilityBindingSubstitutionRejected,
  testActionChainAvailabilitySubstitutionRejected,
  testIntentProjectionSubstitutionRejected,
  testAuthorityProjectionSubstitutionRejected,
  testCoordinationProjectionSubstitutionRejected,
  testActionPermitSourceSubstitutionRejected,
  testTargetBindingSubstitutionRejected,
  testStaleGenericAvailabilityRejected,
  testConsumedPermitRejected,
  testBridgeInputStaleRejected,
  testBridgeOverclaimRejected,
  testImportSafeAndReadOnlyCli,
];

for (const test of tests) {
  test();
  process.stdout.write(`PASS ${test.name}\n`);
}

const bridgeRecordPath = process.argv[2];
const bridgeInputPath = process.argv[3];
const bundlePath = process.argv[4];
if (bridgeRecordPath) fs.writeFileSync(bridgeRecordPath, `${JSON.stringify(buildBridgeRecord(bridgeInput()), null, 2)}\n`);
if (bridgeInputPath) fs.writeFileSync(bridgeInputPath, `${JSON.stringify(bridgeInput(), null, 2)}\n`);
if (bundlePath) fs.writeFileSync(bundlePath, `${JSON.stringify(bundleForBridge(), null, 2)}\n`);
process.stdout.write(`PASS FCL PreAction Evidence Bridge v0.1 conformance (${tests.length} groups)\n`);
