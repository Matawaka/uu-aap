'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  FCLPreActionEvidenceContractReconciliationError,
  buildReceipt, fingerprint, normalizedEvidenceContext, validateInput, validateReceipt,
} = require('./pre-action-evidence-contract-reconciliation.js');
const {
  buildMappingReceipt,
  canonicalFingerprint: mappingFingerprint,
} = require('../capability-identity-mapping/capability-identity-mapping.js');
const {
  contentHash: descriptorContentHash,
  validate: validateDescriptor,
} = require('../../../integration/execution-capability-descriptor/v0.1/validate-execution-capability-descriptor.js');
const {
  hashObject: selectionHashObject,
  validate: validateSelection,
} = require('../../../integration/capability-selection/v0.1/validate-capability-selection.js');
const {
  hash: availabilityHash,
  validate: validateExecutionAvailability,
} = require('../../../integration/execution-capability-availability/v0.1/validate-execution-capability-availability.js');
const {
  validateEvidenceContext,
} = require('../../../integration/pre-action-evidence-bundle/v0.1/validate-pre-action-evidence-bundle.js');

const clone = value => JSON.parse(JSON.stringify(value));
const ROOT = __dirname;
const REPO_ROOT = path.resolve(ROOT, '..', '..', '..', '..');
const AVAILABILITY_FIXTURE = path.join(REPO_ROOT, 'protocols', 'integration', 'execution-capability-availability', 'v0.1', 'conformance.fixture.json');
const ORIGIN = {
  repository: 'Matawaka/uu-aap',
  revision: 'b4fcda2bfe19670dccd3ed265dcaad04b2f22232',
  tree: '3c5c0cf415e0db3084de2cbb68c3ba173792a53e',
};

function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); }
  catch (error) {
    failed = true;
    assert(error instanceof FCLPreActionEvidenceContractReconciliationError, `${label}: wrong error ${error && error.name}`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function loadPermitSample() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-reconciliation-permit-'));
  const receiptPath = path.join(dir, 'permit.json');
  const inputPath = path.join(dir, 'permit-input.json');
  const script = path.resolve(ROOT, '..', 'core-action-permit-binding', 'test-core-action-permit-binding.js');
  const run = spawnSync(process.execPath, [script, receiptPath, inputPath], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, `FCL ActionPermit predecessor suite failed: ${run.stderr}`);
  return {
    permit: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
  };
}

function operation(name, authorityScope) {
  return {
    operation: name,
    effect_class: 'external_effect',
    reversible: true,
    compensation_supported: true,
    authority_scope: authorityScope,
    approval_contract: {
      required: true, mode: 'action_specific', scope_binding_required: true,
      protocol_mode_consent_sufficient: false,
    },
    availability_contract: {
      advertised_capability_is_current_availability: false,
      availability_probe_required_before_authorization: true,
      availability_proof_is_authority: false,
    },
    lifecycle_contract: {
      profile: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE', version: '0.1',
      mode: 'bounded_external_effect',
      required_phases: ['prepare', 'authorize', 'execute', 'observe', 'close'],
      exact_target_binding_required: true, predecessor_freshness_required: true,
      fail_closed_target_guard_required: true, one_shot_supported: true,
      expiry_required: true, separate_observer_required: true,
    },
    receipt_contract: {
      pre_action_required: ['StateReceipt', 'IntentReceipt', 'AuthorityReceipt', 'CoordinationReceipt', 'ActionPermit'],
      actuator_may_emit: ['ActuatorObservation'],
      core_post_action_required: ['ActionReceipt', 'OutcomeReceipt', 'SuccessorStateReceipt'],
      actuator_creates_core_action_permit: false,
      actuator_creates_core_post_action_receipts: false,
      advertised_receipt_support_is_receipt: false,
    },
    effect_contract: {
      expected_effect_categories: ['fcl_runtime_control_transition'],
      explicit_non_effects: ['authority_transfer', 'unbounded_execution'],
      effect_observation_is_causality_proof: false,
    },
  };
}

function descriptor() {
  const record = {
    protocol: 'UU-AAP-EXECUTION-CAPABILITY-DESCRIPTOR', version: '0.1',
    artifact_type: 'ExecutionCapabilityDescriptor',
    descriptor_id: 'urn:uu-aap:execution-capability:fcl-run-control-v0.1',
    capability: {
      capability_id: 'urn:uu-aap:capability:fcl-run-control',
      adapter_id: 'urn:uu-aap:adapter:fcl-runtime-controller',
      provider_neutral_schema: true, discovery_only: true,
    },
    operations: [
      operation('interrupt_run', 'fcl.run.interrupt'),
      operation('create_successor_run', 'fcl.run.successor.create'),
    ],
    global_non_effects: {
      authority_granted: false, intent_created: false, action_permit_created: false,
      action_authorized: false, action_performed: false, current_availability_asserted: false,
      causality_proven: false, truth_certified: false, liability_established: false,
      future_action_permission_created: false,
    },
    content_hash: '',
  };
  record.content_hash = descriptorContentHash(record);
  assert.strictEqual(validateDescriptor(record), true);
  return record;
}

function projectionFrom(desc, op) {
  const projection = {
    capability_id: desc.capability.capability_id,
    adapter_id: desc.capability.adapter_id,
    operation: op.operation, effect_class: op.effect_class,
    authority_scope: op.authority_scope, reversible: op.reversible,
    compensation_supported: op.compensation_supported,
    approval_mode: op.approval_contract.mode,
    scope_binding_required: op.approval_contract.scope_binding_required,
    availability_probe_required_before_authorization: op.availability_contract.availability_probe_required_before_authorization,
    exact_target_binding_required: op.lifecycle_contract.exact_target_binding_required,
    predecessor_freshness_required: op.lifecycle_contract.predecessor_freshness_required,
    fail_closed_target_guard_required: op.lifecycle_contract.fail_closed_target_guard_required,
    one_shot_supported: op.lifecycle_contract.one_shot_supported,
    expiry_required: op.lifecycle_contract.expiry_required,
    separate_observer_required: op.lifecycle_contract.separate_observer_required,
    lifecycle_profile: op.lifecycle_contract.profile,
    lifecycle_version: op.lifecycle_contract.version,
    lifecycle_mode: op.lifecycle_contract.mode,
    required_phases: clone(op.lifecycle_contract.required_phases),
    pre_action_receipts: clone(op.receipt_contract.pre_action_required),
    post_action_receipts: clone(op.receipt_contract.core_post_action_required),
    current_availability_asserted: false,
    projection_hash: '',
  };
  projection.projection_hash = selectionHashObject(projection, 'projection_hash');
  return projection;
}

function selectionForAuthority(desc, authority) {
  const selectedName = authority.requested_control === 'REQUEST_SUCCESSOR' ? 'create_successor_run' : 'interrupt_run';
  const op = desc.operations.find(item => item.operation === selectedName);
  assert(op, 'mapped operation missing');
  const projection = projectionFrom(desc, op);
  const record = {
    protocol: 'UU-AAP-CAPABILITY-SELECTION', version: '0.1',
    artifact_type: 'CapabilitySelectionRecord',
    selection_id: `urn:uu-aap:capability-selection:fcl-reconciliation-${authority.request_id}`,
    request: {
      operation: selectedName, effect_class: 'external_effect', authority_scope: authority.required_scope,
      lifecycle_profile: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE', lifecycle_version: '0.1',
      lifecycle_mode: 'bounded_external_effect',
      hard_constraints: {
        action_specific_approval_required: true, scope_bound_approval_required: true,
        fresh_availability_probe_required: true, exact_target_binding_required: true,
        predecessor_freshness_required: true, fail_closed_target_guard_required: true,
        one_shot_required: true, expiry_required: true, separate_observer_required: true,
      },
      required_phases: ['prepare', 'authorize', 'execute', 'observe', 'close'],
      required_pre_action_receipts: ['StateReceipt', 'IntentReceipt', 'AuthorityReceipt', 'CoordinationReceipt', 'ActionPermit'],
      required_post_action_receipts: ['ActionReceipt', 'OutcomeReceipt', 'SuccessorStateReceipt'],
      preference_policy: {
        ordered_preferences: ['prefer_reversible', 'prefer_compensation'],
        tie_breaker: 'stable_capability_id_asc',
      },
    },
    candidates: [{
      descriptor_ref: { descriptor_id: desc.descriptor_id, content_hash: desc.content_hash },
      operation_projection: projection,
      assessment: { eligible: true, failed_hard_constraints: [], preference_vector: [1, 1], eligible_rank: 1 },
    }],
    result: {
      status: 'selected', selected_capability_id: desc.capability.capability_id,
      selected_descriptor_ref: { descriptor_id: desc.descriptor_id, content_hash: desc.content_hash },
      assertions: {
        hard_constraints_applied_before_preferences: true, selected_candidate_eligible: true,
        no_constraints_relaxed: true, fresh_availability_still_required: true,
        authorization_still_required: true,
      },
    },
    non_effects: {
      intent_established: false, current_availability_asserted: false, authority_granted: false,
      approval_created: false, action_permit_created: false, action_authorized: false,
      action_performed: false, causality_proven: false, truth_certified: false,
      liability_established: false, future_action_permission_created: false,
    },
    content_hash: '',
  };
  record.content_hash = selectionHashObject(record, 'content_hash');
  assert.deepStrictEqual(validateSelection(record), []);
  return record;
}

function mappingForPermit(permitInput) {
  const authority = permitInput.core_coordination_binding_input.fcl_authority_evaluation;
  const desc = descriptor();
  const selection = selectionForAuthority(desc, authority);
  const input = {
    protocol: 'FCL', version: '0.1', profile: 'capability-identity-mapping-v0.1',
    mapping_id: `fcl-reconciliation-map-${authority.request_id}`,
    origin: clone(ORIGIN), execution_capability_descriptor: desc,
    capability_selection: selection, fcl_authority_evaluation: clone(authority),
    mapped_at: '2026-08-27T18:01:02Z',
  };
  return { input, receipt: buildMappingReceipt(input) };
}

function executionAvailabilityFor(mapping, permitInput) {
  const record = clone(JSON.parse(fs.readFileSync(AVAILABILITY_FIXTURE, 'utf8')));
  const selection = mapping.input.capability_selection;
  const selected = selection.result;
  const frontier = permitInput.core_coordination_binding_input.core_state_receipt.frontier.revision;
  const operation = selection.request.operation;
  record.binding_id = 'urn:uu-aap:execution-capability-availability:binding:fcl-reconciliation';
  record.selection_binding = {
    selection_id: selection.selection_id, selection_content_hash: selection.content_hash,
    selected_capability_id: selected.selected_capability_id,
    selected_descriptor_ref: clone(selected.selected_descriptor_ref), operation,
    fresh_availability_still_required: true,
  };
  record.observation.observation_id = 'urn:uu-aap:execution-capability-availability:observation:fcl-reconciliation';
  record.observation.subject = {
    capability_id: selected.selected_capability_id,
    descriptor_ref: clone(selected.selected_descriptor_ref), operation,
  };
  record.observation.frontier = { revision: frontier, observed_at: '2026-08-27T18:01:05Z' };
  record.observation.probe.probe_id = 'urn:uu-aap:probe:fcl-reconciliation';
  record.observation.probe.started_at = '2026-08-27T18:01:04Z';
  record.observation.probe.completed_at = '2026-08-27T18:01:05Z';
  record.observation.status = 'available';
  record.observation.valid_until = '2026-08-27T18:01:45Z';
  record.observation.assertions.required_checks_satisfied = true;
  for (const check of record.observation.probe.checks) check.status = 'pass';
  record.observation.content_hash = availabilityHash(record.observation);

  record.core_state_receipt.subject = { id: selected.selected_capability_id, scope: `operation:${operation}` };
  record.core_state_receipt.frontier = { revision: frontier, observed_at: '2026-08-27T18:01:03Z' };
  record.core_state_receipt.issued_at = '2026-08-27T18:01:03Z';
  record.core_state_receipt.predecessor_receipt_hashes = [];
  record.core_state_receipt.content_hash = availabilityHash(record.core_state_receipt, true);

  record.core_availability_claim.subject = clone(record.core_state_receipt.subject);
  record.core_availability_claim.frontier = { revision: frontier, observed_at: '2026-08-27T18:01:05Z' };
  record.core_availability_claim.predecessor_receipt_hashes = [record.core_state_receipt.content_hash];
  record.core_availability_claim.assertions.availability_qualified = true;
  record.core_availability_claim.assertions.capability = `${selected.selected_capability_id}#${operation}`;
  record.core_availability_claim.issued_at = '2026-08-27T18:01:06Z';
  record.core_availability_claim.payload = {
    status: 'available', availability_observation_hash: record.observation.content_hash,
    selection_record_hash: selection.content_hash,
    descriptor_content_hash: selected.selected_descriptor_ref.content_hash,
    valid_until: record.observation.valid_until,
  };
  record.core_availability_claim.content_hash = availabilityHash(record.core_availability_claim, true);
  record.assertions.selection_binding_verified = true;
  record.assertions.state_frontier_preserved = true;
  record.assertions.observation_fresh_for_claim = true;
  record.assertions.positive_availability_only_if_all_required_checks_pass = true;
  record.assertions.core_availability_claim_materialized = true;
  record.content_hash = availabilityHash(record);
  assert.strictEqual(validateExecutionAvailability(record, selection), true);
  return record;
}

const permitSample = loadPermitSample();
const mappingSample = mappingForPermit(permitSample.input);
const availabilitySample = executionAvailabilityFor(mappingSample, permitSample.input);

function positiveInput() {
  return {
    protocol: 'FCL', version: '0.1', profile: 'pre-action-evidence-contract-reconciliation-v0.1',
    reconciliation_id: 'fcl-preaction-reconciliation-interrupt-v0-1', origin: clone(ORIGIN),
    capability_mapping_input: clone(mappingSample.input),
    capability_mapping_receipt: clone(mappingSample.receipt),
    execution_capability_availability: clone(availabilitySample),
    fcl_core_action_permit_binding_input: clone(permitSample.input),
    fcl_core_action_permit: clone(permitSample.permit),
    reconciled_at: '2026-08-27T18:01:10Z',
  };
}

function testPositiveReconciliation() {
  const input = positiveInput();
  assert.strictEqual(validateInput(input), true);
  const receipt = buildReceipt(input);
  assert.strictEqual(validateReceipt(receipt), true);
  assert.strictEqual(receipt.compatibility.mapping_selected_operation_to_fcl_scope_exact, true);
  assert.strictEqual(receipt.compatibility.direct_preaction_bundle_contract_satisfied, false);
  assert.strictEqual(receipt.next_safe_action, 'PARAMETERIZE_PRE_ACTION_FCL_EVIDENCE_BRIDGE');
}
function testNormalizedContextShapeValidButNotWholeBundle() {
  const input = positiveInput();
  assert.strictEqual(validateEvidenceContext(normalizedEvidenceContext(input)), true);
  const receipt = buildReceipt(input);
  assert.strictEqual(receipt.compatibility.normalized_preaction_evidence_context_shape_valid, true);
  assert.strictEqual(receipt.compatibility.core_availability_claim_identity_equal, false);
}
function testOperationToScopeMappingDoesNotCollapseIdentifiers() {
  const receipt = buildReceipt(positiveInput());
  assert.strictEqual(receipt.compatibility.mapping_selected_operation_to_fcl_scope_exact, true);
  assert.strictEqual(receipt.selected_operation, 'interrupt_run');
  assert.strictEqual(receipt.fcl_scope, 'fcl.run.interrupt');
  assert.strictEqual(receipt.compatibility.selected_operation_equals_fcl_target_operation, false);
}
function testMappingReceiptMustBeExactReproduction() {
  const input = positiveInput();
  input.capability_mapping_receipt.selection_id = 'urn:uu-aap:capability-selection:substituted';
  input.capability_mapping_receipt.fingerprint_sha256 = '';
  input.capability_mapping_receipt.fingerprint_sha256 = mappingFingerprint(input.capability_mapping_receipt);
  expectFailure('mapping reproduction', () => validateInput(input), /not exactly reproducible/);
}
function testAvailabilityMustBindExactSelection() {
  const input = positiveInput();
  input.execution_capability_availability.selection_binding.selection_id = 'urn:uu-aap:capability-selection:other';
  input.execution_capability_availability.content_hash = availabilityHash(input.execution_capability_availability);
  expectFailure('availability selection', () => validateInput(input), /execution availability invalid: selection_id mismatch/);
}
function testExecutionAvailabilityExpiryRejected() {
  const input = positiveInput(); input.reconciled_at = '2026-08-27T18:01:46Z';
  expectFailure('execution availability expiry', () => validateInput(input), /Execution Availability stale/);
}
function testActionPermitExpiryRejected() {
  const input = positiveInput();
  input.execution_capability_availability.observation.valid_until = '2026-08-27T18:01:59Z';
  input.execution_capability_availability.core_availability_claim.payload.valid_until = '2026-08-27T18:01:59Z';
  input.execution_capability_availability.observation.content_hash = availabilityHash(input.execution_capability_availability.observation);
  input.execution_capability_availability.core_availability_claim.payload.availability_observation_hash = input.execution_capability_availability.observation.content_hash;
  input.execution_capability_availability.core_availability_claim.content_hash = availabilityHash(input.execution_capability_availability.core_availability_claim, true);
  input.execution_capability_availability.content_hash = availabilityHash(input.execution_capability_availability);
  input.reconciled_at = '2026-08-27T18:01:51Z';
  expectFailure('permit expiry', () => validateInput(input), /ActionPermit expired/);
}
function testSharedFrontierRequired() {
  const input = positiveInput();
  input.execution_capability_availability.observation.frontier.revision = 'fcl:other:epoch:999';
  input.execution_capability_availability.core_state_receipt.frontier.revision = 'fcl:other:epoch:999';
  input.execution_capability_availability.core_availability_claim.frontier.revision = 'fcl:other:epoch:999';
  input.execution_capability_availability.observation.content_hash = availabilityHash(input.execution_capability_availability.observation);
  input.execution_capability_availability.core_state_receipt.content_hash = availabilityHash(input.execution_capability_availability.core_state_receipt, true);
  input.execution_capability_availability.core_availability_claim.predecessor_receipt_hashes = [input.execution_capability_availability.core_state_receipt.content_hash];
  input.execution_capability_availability.core_availability_claim.payload.availability_observation_hash = input.execution_capability_availability.observation.content_hash;
  input.execution_capability_availability.core_availability_claim.content_hash = availabilityHash(input.execution_capability_availability.core_availability_claim, true);
  input.execution_capability_availability.content_hash = availabilityHash(input.execution_capability_availability);
  expectFailure('frontier', () => validateInput(input), /same frontier revision/);
}
function testDirectBundleOverclaimRejected() {
  const receipt = buildReceipt(positiveInput());
  receipt.compatibility.direct_preaction_bundle_contract_satisfied = true;
  receipt.fingerprint_sha256 = ''; receipt.fingerprint_sha256 = fingerprint(receipt);
  expectFailure('direct bundle overclaim', () => validateReceipt(receipt), /direct_preaction_bundle_contract_satisfied/);
}
function testNonEffectOverclaimRejected() {
  const receipt = buildReceipt(positiveInput());
  receipt.non_effects.pre_action_bundle_created = true;
  receipt.fingerprint_sha256 = ''; receipt.fingerprint_sha256 = fingerprint(receipt);
  expectFailure('bundle non-effect', () => validateReceipt(receipt), /pre_action_bundle_created/);
}
function testReceiptFingerprintTamperRejected() {
  const receipt = buildReceipt(positiveInput()); receipt.fcl_target = 'urn:other';
  expectFailure('receipt fingerprint', () => validateReceipt(receipt), /fingerprint mismatch/);
}
function testReadOnlyCli() {
  const script = path.join(ROOT, 'pre-action-evidence-contract-reconciliation.js');
  for (const command of ['assemble','authorize','execute','probe','consume','interrupt','send','create-successor']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8' });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}
function testImportSafe() {
  const script = path.join(ROOT, 'pre-action-evidence-contract-reconciliation.js');
  const run = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  assert.strictEqual(run.stdout, ''); assert.strictEqual(run.stderr, '');
}

const tests = [
  testPositiveReconciliation,
  testNormalizedContextShapeValidButNotWholeBundle,
  testOperationToScopeMappingDoesNotCollapseIdentifiers,
  testMappingReceiptMustBeExactReproduction,
  testAvailabilityMustBindExactSelection,
  testExecutionAvailabilityExpiryRejected,
  testActionPermitExpiryRejected,
  testSharedFrontierRequired,
  testDirectBundleOverclaimRejected,
  testNonEffectOverclaimRejected,
  testReceiptFingerprintTamperRejected,
  testReadOnlyCli,
  testImportSafe,
];
for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }

const receiptPath = process.argv[2];
const inputPath = process.argv[3];
if (receiptPath) fs.writeFileSync(receiptPath, `${JSON.stringify(buildReceipt(positiveInput()), null, 2)}\n`);
if (inputPath) fs.writeFileSync(inputPath, `${JSON.stringify(positiveInput(), null, 2)}\n`);
process.stdout.write(`PASS FCL PreAction Evidence Contract Reconciliation v0.1 conformance (${tests.length} groups)\n`);
