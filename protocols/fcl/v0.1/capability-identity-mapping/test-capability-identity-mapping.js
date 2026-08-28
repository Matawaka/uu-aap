'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  FCLCapabilityIdentityMappingError,
  buildMappingReceipt,
  canonicalFingerprint,
  validateInput,
  validateMappingReceipt,
} = require('./capability-identity-mapping.js');
const {
  contentHash: descriptorContentHash,
  validate: validateDescriptor,
} = require('../../../integration/execution-capability-descriptor/v0.1/validate-execution-capability-descriptor.js');
const {
  hashObject: selectionHashObject,
  validate: validateSelection,
} = require('../../../integration/capability-selection/v0.1/validate-capability-selection.js');
const { buildRequestReceipt } = require('../control-request/control-request.js');
const { fingerprint: runtimeFingerprint, validateViewModel } = require('../runtime-ui/runtime-ui.js');
const { buildEvaluationReceipt } = require('../request-evaluation/request-evaluation.js');
const {
  buildAuthorityEvaluationReceipt,
  requiredScopeForControl,
  requiredTargetForEvaluation,
} = require('../authority-evaluation/authority-evaluation.js');

const ROOT = __dirname;
const CONTROL_EXAMPLES = path.join(ROOT, '..', 'control-request', 'examples');
const clone = value => JSON.parse(JSON.stringify(value));
const load = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const ACTOR = { id: 'actor:fcl-runtime-controller', key_ref: 'key:fcl-runtime-controller' };

function expectFailure(label, fn, pattern) {
  let failed = false;
  try {
    fn();
  } catch (error) {
    failed = true;
    assert(error instanceof FCLCapabilityIdentityMappingError, `${label}: wrong error ${error && error.name}`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
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

function digest(value) {
  return {
    canonicalization: 'RFC8785-JCS',
    digest_algorithm: 'SHA-256',
    digest_encoding: 'hex',
    value,
  };
}

function currentEvaluation(controlFile, renderedAt, evaluatedAt) {
  const request = load(path.join(CONTROL_EXAMPLES, controlFile));
  return buildEvaluationReceipt({
    protocol: 'FCL',
    version: '0.1',
    profile: 'current-state-request-evaluation-v0.1',
    evaluation_id: `mapping-source-${request.request_id}`,
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: '1eced7c85b1fcb3c061479cbad3f70d43d1c9cd2',
      tree: 'd6888d74445de27c4e59b8dad935596005b48936',
    },
    request_receipt: buildRequestReceipt(request),
    current_view: rerender(request.source_view, renderedAt),
    evaluated_at: evaluatedAt,
  });
}

function authorityResult(evaluation, verifiedAt) {
  return {
    artifact_type: 'PoAIAuthorityVerificationResult',
    artifact_version: '0.1-experimental',
    verification_id: `urn:poai:authority-verification:mapping-${evaluation.request_id}`,
    verified_at: verifiedAt,
    policy: {
      policy_id: 'urn:poai:policy:fcl-mapping-test',
      policy_version: 1,
      digest: digest('1'.repeat(64)),
    },
    root: {
      root_id: 'urn:poai:authority-root:fcl-mapping-test',
      root_version: 1,
      digest: digest('2'.repeat(64)),
    },
    grant_path: ['urn:poai:authority-grant:fcl-mapping-test'],
    subject: clone(ACTOR),
    required_scope: requiredScopeForControl(evaluation.requested_control),
    target: requiredTargetForEvaluation(evaluation),
    status: 'established',
    checks: {
      root_accepted_by_policy: true,
      grant_path_valid: true,
      required_scope_matches: true,
      required_target_matches: true,
      authority_graph_acyclic: true,
    },
    claims: {
      root_declared: true,
      root_evidence_observed: true,
      root_accepted_by_policy: true,
      issuer_entitlement_chain_valid: true,
      materialization_authority_established: false,
      policy_control_authority_established: false,
      legal_identity_verified: false,
      legal_authority_established: false,
      universal_authority_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      moral_correctness_established: false,
      legal_effect_established: false,
      poai_v_conformance_established: false,
    },
    errors: [],
  };
}

function authorityReceipt(kind) {
  const successor = kind === 'successor';
  const evaluation = currentEvaluation(
    successor ? 'successor.request.json' : 'interrupt.request.json',
    successor ? '2026-08-27T17:05:05Z' : '2026-08-27T17:01:05Z',
    successor ? '2026-08-27T17:05:06Z' : '2026-08-27T17:01:06Z'
  );
  return buildAuthorityEvaluationReceipt({
    protocol: 'FCL',
    version: '0.1',
    profile: 'authority-evaluation-v0.1',
    authority_evaluation_id: `mapping-authority-${evaluation.request_id}`,
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: 'd5e588c36a7ac82e310fbdb06a1f8dc22182e8c8',
      tree: 'cc6ef28955fd6737879ffc3f8cc8ec8f0aa7d54c',
    },
    current_state_request_evaluation: evaluation,
    effect_actor_subject: clone(ACTOR),
    authority_verification_result: authorityResult(
      evaluation,
      successor ? '2026-08-27T17:05:07Z' : '2026-08-27T17:01:07Z'
    ),
    evaluated_at: successor ? '2026-08-27T17:05:08Z' : '2026-08-27T17:01:08Z',
  });
}

function operation(name, authorityScope) {
  return {
    operation: name,
    effect_class: 'external_effect',
    reversible: true,
    compensation_supported: true,
    authority_scope: authorityScope,
    approval_contract: {
      required: true,
      mode: 'action_specific',
      scope_binding_required: true,
      protocol_mode_consent_sufficient: false,
    },
    availability_contract: {
      advertised_capability_is_current_availability: false,
      availability_probe_required_before_authorization: true,
      availability_proof_is_authority: false,
    },
    lifecycle_contract: {
      profile: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE',
      version: '0.1',
      mode: 'bounded_external_effect',
      required_phases: ['prepare', 'authorize', 'execute', 'observe', 'close'],
      exact_target_binding_required: true,
      predecessor_freshness_required: true,
      fail_closed_target_guard_required: true,
      one_shot_supported: true,
      expiry_required: true,
      separate_observer_required: true,
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
    protocol: 'UU-AAP-EXECUTION-CAPABILITY-DESCRIPTOR',
    version: '0.1',
    artifact_type: 'ExecutionCapabilityDescriptor',
    descriptor_id: 'urn:uu-aap:execution-capability:fcl-run-control-v0.1',
    capability: {
      capability_id: 'urn:uu-aap:capability:fcl-run-control',
      adapter_id: 'urn:uu-aap:adapter:fcl-runtime-controller',
      provider_neutral_schema: true,
      discovery_only: true,
    },
    operations: [
      operation('interrupt_run', 'fcl.run.interrupt'),
      operation('create_successor_run', 'fcl.run.successor.create'),
    ],
    global_non_effects: {
      authority_granted: false,
      intent_created: false,
      action_permit_created: false,
      action_authorized: false,
      action_performed: false,
      current_availability_asserted: false,
      causality_proven: false,
      truth_certified: false,
      liability_established: false,
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
    operation: op.operation,
    effect_class: op.effect_class,
    authority_scope: op.authority_scope,
    reversible: op.reversible,
    compensation_supported: op.compensation_supported,
    approval_mode: op.approval_contract.mode,
    scope_binding_required: op.approval_contract.scope_binding_required,
    availability_probe_required_before_authorization:
      op.availability_contract.availability_probe_required_before_authorization,
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

function selection(kind, desc = descriptor(), scopeOverride = null, operationOverride = null) {
  const successor = kind === 'successor';
  const selectedName = operationOverride || (successor ? 'create_successor_run' : 'interrupt_run');
  const actual = desc.operations.find(op => op.operation === selectedName);
  const scope = scopeOverride || (successor ? 'fcl.run.successor.create' : 'fcl.run.interrupt');
  const op = actual || operation(selectedName, scope);
  const projection = projectionFrom(desc, op);
  projection.authority_scope = scope;
  projection.projection_hash = selectionHashObject(projection, 'projection_hash');

  const record = {
    protocol: 'UU-AAP-CAPABILITY-SELECTION',
    version: '0.1',
    artifact_type: 'CapabilitySelectionRecord',
    selection_id: `urn:uu-aap:capability-selection:fcl-${kind}-v0.1`,
    request: {
      operation: selectedName,
      effect_class: 'external_effect',
      authority_scope: scope,
      lifecycle_profile: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE',
      lifecycle_version: '0.1',
      lifecycle_mode: 'bounded_external_effect',
      hard_constraints: {
        action_specific_approval_required: true,
        scope_bound_approval_required: true,
        fresh_availability_probe_required: true,
        exact_target_binding_required: true,
        predecessor_freshness_required: true,
        fail_closed_target_guard_required: true,
        one_shot_required: true,
        expiry_required: true,
        separate_observer_required: true,
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
      descriptor_ref: {
        descriptor_id: desc.descriptor_id,
        content_hash: desc.content_hash,
      },
      operation_projection: projection,
      assessment: {
        eligible: true,
        failed_hard_constraints: [],
        preference_vector: [1, 1],
        eligible_rank: 1,
      },
    }],
    result: {
      status: 'selected',
      selected_capability_id: desc.capability.capability_id,
      selected_descriptor_ref: {
        descriptor_id: desc.descriptor_id,
        content_hash: desc.content_hash,
      },
      assertions: {
        hard_constraints_applied_before_preferences: true,
        selected_candidate_eligible: true,
        no_constraints_relaxed: true,
        fresh_availability_still_required: true,
        authorization_still_required: true,
      },
    },
    non_effects: {
      intent_established: false,
      current_availability_asserted: false,
      authority_granted: false,
      approval_created: false,
      action_permit_created: false,
      action_authorized: false,
      action_performed: false,
      causality_proven: false,
      truth_certified: false,
      liability_established: false,
      future_action_permission_created: false,
    },
    content_hash: '',
  };
  record.content_hash = selectionHashObject(record, 'content_hash');
  assert.deepStrictEqual(validateSelection(record), []);
  return record;
}

function inputFor(kind) {
  const desc = descriptor();
  const auth = authorityReceipt(kind);
  return {
    protocol: 'FCL',
    version: '0.1',
    profile: 'capability-identity-mapping-v0.1',
    mapping_id: `fcl-capability-map-${kind}`,
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: '1dcdf3f8d98c5ecb8f1ca9f096e102b0baefb6c3',
      tree: '310108a09410489fadb41b70cd851ea0faad3801',
    },
    execution_capability_descriptor: desc,
    capability_selection: selection(kind, desc),
    fcl_authority_evaluation: auth,
    mapped_at: kind === 'successor' ? '2026-08-27T17:05:09Z' : '2026-08-27T17:01:09Z',
  };
}

function rehashDescriptor(value) {
  value.content_hash = descriptorContentHash(value);
}
function rehashSelection(value) {
  for (const candidate of value.candidates) {
    candidate.operation_projection.projection_hash =
      selectionHashObject(candidate.operation_projection, 'projection_hash');
  }
  value.content_hash = selectionHashObject(value, 'content_hash');
}

function testPositiveInterruptMapping() {
  const r = buildMappingReceipt(inputFor('interrupt'));
  assert.strictEqual(r.mapping_status, 'EXACT');
  assert.strictEqual(r.fcl_required_scope, 'fcl.run.interrupt');
  assert.strictEqual(r.selected_operation, 'interrupt_run');
}
function testPositiveSuccessorMapping() {
  const r = buildMappingReceipt(inputFor('successor'));
  assert.strictEqual(r.mapping_status, 'EXACT');
  assert.strictEqual(r.fcl_required_scope, 'fcl.run.successor.create');
  assert.strictEqual(r.selected_operation, 'create_successor_run');
}
function testDeterministicFingerprint() {
  const input = inputFor('interrupt');
  const a = buildMappingReceipt(input);
  const b = buildMappingReceipt(clone(input));
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.fingerprint_sha256, canonicalFingerprint(a));
}
function testDescriptorTamperRejected() {
  const input = inputFor('interrupt');
  input.execution_capability_descriptor.capability.provider_neutral_schema = false;
  rehashDescriptor(input.execution_capability_descriptor);
  expectFailure('descriptor tamper', () => validateInput(input), /descriptor|provider-neutral/);
}
function testSelectionTamperRejected() {
  const input = inputFor('interrupt');
  input.capability_selection.result.selected_capability_id = 'urn:uu-aap:capability:other';
  rehashSelection(input.capability_selection);
  expectFailure('selection tamper', () => validateInput(input), /capability_selection invalid|selected candidate/);
}
function testNoMatchSelectionRejected() {
  const input = inputFor('interrupt');
  const s = input.capability_selection;
  s.request.authority_scope = 'fcl.run.other';
  s.candidates[0].operation_projection.authority_scope = 'fcl.run.interrupt';
  s.candidates[0].assessment.eligible = false;
  s.candidates[0].assessment.failed_hard_constraints = ['authority_scope'];
  s.candidates[0].assessment.eligible_rank = null;
  s.result.status = 'no_match';
  s.result.selected_capability_id = null;
  s.result.selected_descriptor_ref = null;
  s.result.assertions.selected_candidate_eligible = false;
  rehashSelection(s);
  assert.deepStrictEqual(validateSelection(s), []);
  expectFailure('no match', () => validateInput(input), /status must be selected/);
}
function testDescriptorReferenceSubstitutionRejected() {
  const input = inputFor('interrupt');
  const s = input.capability_selection;
  const other = `sha256:${'a'.repeat(64)}`;
  s.candidates[0].descriptor_ref.content_hash = other;
  s.result.selected_descriptor_ref.content_hash = other;
  rehashSelection(s);
  assert.deepStrictEqual(validateSelection(s), []);
  expectFailure('descriptor ref', () => validateInput(input), /descriptor content_hash mismatch/);
}
function testCapabilitySubstitutionRejected() {
  const input = inputFor('interrupt');
  input.execution_capability_descriptor.capability.capability_id = 'urn:uu-aap:capability:other';
  rehashDescriptor(input.execution_capability_descriptor);
  expectFailure('capability substitute', () => validateInput(input), /selected descriptor content_hash mismatch|capability mismatch/);
}
function testOperationSubstitutionRejected() {
  const input = inputFor('interrupt');
  const s = input.capability_selection;
  s.request.operation = 'unknown_interrupt';
  s.candidates[0].operation_projection.operation = 'unknown_interrupt';
  rehashSelection(s);
  assert.deepStrictEqual(validateSelection(s), []);
  expectFailure('operation substitute', () => validateInput(input), /resolve exactly once/);
}
function testCandidateScopeMismatchRejected() {
  const input = inputFor('interrupt');
  const s = input.capability_selection;
  s.request.authority_scope = 'fcl.run.other';
  s.candidates[0].operation_projection.authority_scope = 'fcl.run.other';
  rehashSelection(s);
  assert.deepStrictEqual(validateSelection(s), []);
  expectFailure('scope substitute', () => validateInput(input), /authority_scope|does not exactly match/);
}
function testCrossControlScopeRejected() {
  const input = inputFor('interrupt');
  input.capability_selection = selection('successor', input.execution_capability_descriptor);
  expectFailure('cross control', () => validateInput(input), /does not exactly match FCL required_scope/);
}
function testApproximateScopeRejected() {
  const input = inputFor('interrupt');
  const d = input.execution_capability_descriptor;
  const op = d.operations.find(x => x.operation === 'interrupt_run');
  op.authority_scope = 'fcl.run.interrupt.extra';
  rehashDescriptor(d);
  input.capability_selection = selection('interrupt', d, 'fcl.run.interrupt.extra');
  expectFailure('approximate scope', () => validateInput(input), /does not exactly match FCL required_scope/);
}
function testDuplicateOperationRejected() {
  const input = inputFor('interrupt');
  input.execution_capability_descriptor.operations.push(clone(input.execution_capability_descriptor.operations[0]));
  rehashDescriptor(input.execution_capability_descriptor);
  expectFailure('duplicate operation', () => validateInput(input), /descriptor|unique/);
}
function testApprovalDowngradeRejected() {
  const input = inputFor('interrupt');
  input.execution_capability_descriptor.operations[0].approval_contract.required = false;
  rehashDescriptor(input.execution_capability_descriptor);
  expectFailure('approval downgrade', () => validateInput(input), /descriptor|approval/);
}
function testAvailabilityDowngradeRejected() {
  const input = inputFor('interrupt');
  input.execution_capability_descriptor.operations[0].availability_contract.availability_probe_required_before_authorization = false;
  rehashDescriptor(input.execution_capability_descriptor);
  expectFailure('availability downgrade', () => validateInput(input), /descriptor|availability/);
}
function testLifecycleDowngradeRejected() {
  const input = inputFor('interrupt');
  input.execution_capability_descriptor.operations[0].lifecycle_contract.one_shot_supported = false;
  rehashDescriptor(input.execution_capability_descriptor);
  expectFailure('lifecycle downgrade', () => validateInput(input), /descriptor|one-shot/);
}
function testNonPositiveAuthorityRejected() {
  const input = inputFor('interrupt');
  const a = input.fcl_authority_evaluation;
  a.classification = 'AUTHORITY_NOT_ESTABLISHED';
  a.preexisting_request_scoped_authority_observed = false;
  a.forwardable_to_core_authority_adapter = false;
  a.next_safe_action = 'OBTAIN_MATCHING_AUTHORITY_EVIDENCE';
  a.fingerprint_sha256 = '';
  a.fingerprint_sha256 = require('../authority-evaluation/authority-evaluation.js').canonicalFingerprint(a);
  expectFailure('non positive authority', () => validateInput(input), /positive and request-scoped/);
}
function testMappedAtBeforeAuthorityRejected() {
  const input = inputFor('interrupt');
  input.mapped_at = '2026-08-27T17:01:07Z';
  expectFailure('time rollback', () => validateInput(input), /cannot precede authority evaluation/);
}
function testSourceHashesPreserved() {
  const input = inputFor('interrupt');
  const r = buildMappingReceipt(input);
  assert.strictEqual(r.selection_content_hash, input.capability_selection.content_hash);
  assert.strictEqual(r.selected_descriptor_content_hash, input.execution_capability_descriptor.content_hash);
  assert.strictEqual(r.authority_evaluation_fingerprint, input.fcl_authority_evaluation.fingerprint_sha256);
  assert.strictEqual(r.selected_operation_projection_hash, input.capability_selection.candidates[0].operation_projection.projection_hash);
}
function testAllAssertionsTrue() {
  const r = buildMappingReceipt(inputFor('interrupt'));
  for (const [key, value] of Object.entries(r.assertions)) assert.strictEqual(value, true, key);
}
function testAllNonEffectsFalse() {
  const r = buildMappingReceipt(inputFor('interrupt'));
  for (const [key, value] of Object.entries(r.non_effects)) assert.strictEqual(value, false, key);
}
function testReceiptFingerprintTamperRejected() {
  const r = buildMappingReceipt(inputFor('interrupt'));
  r.selected_operation = 'other';
  expectFailure('receipt tamper', () => validateMappingReceipt(r), /fingerprint/);
}
function testReceiptAuthorityOverclaimRejected() {
  const r = buildMappingReceipt(inputFor('interrupt'));
  r.non_effects.authority_granted = true;
  r.fingerprint_sha256 = '';
  r.fingerprint_sha256 = canonicalFingerprint(r);
  expectFailure('authority overclaim', () => validateMappingReceipt(r), /authority_granted/);
}
function testReceiptStatusEscalationRejected() {
  const r = buildMappingReceipt(inputFor('interrupt'));
  r.mapping_status = 'AUTHORIZED';
  r.fingerprint_sha256 = '';
  r.fingerprint_sha256 = canonicalFingerprint(r);
  expectFailure('status escalation', () => validateMappingReceipt(r), /mapping_status/);
}
function testReadOnlyCliSurface() {
  const script = path.join(ROOT, 'capability-identity-mapping.js');
  for (const command of ['execute', 'authorize', 'permit', 'probe', 'grant', 'interrupt', 'create-successor', 'send']) {
    const result = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8' });
    assert.notStrictEqual(result.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(result.stderr), `${command}: unexpected stderr ${result.stderr}`);
  }
}

const tests = [
  testPositiveInterruptMapping,
  testPositiveSuccessorMapping,
  testDeterministicFingerprint,
  testDescriptorTamperRejected,
  testSelectionTamperRejected,
  testNoMatchSelectionRejected,
  testDescriptorReferenceSubstitutionRejected,
  testCapabilitySubstitutionRejected,
  testOperationSubstitutionRejected,
  testCandidateScopeMismatchRejected,
  testCrossControlScopeRejected,
  testApproximateScopeRejected,
  testDuplicateOperationRejected,
  testApprovalDowngradeRejected,
  testAvailabilityDowngradeRejected,
  testLifecycleDowngradeRejected,
  testNonPositiveAuthorityRejected,
  testMappedAtBeforeAuthorityRejected,
  testSourceHashesPreserved,
  testAllAssertionsTrue,
  testAllNonEffectsFalse,
  testReceiptFingerprintTamperRejected,
  testReceiptAuthorityOverclaimRejected,
  testReceiptStatusEscalationRejected,
  testReadOnlyCliSurface,
];

for (const test of tests) {
  test();
  process.stdout.write(`PASS ${test.name}\n`);
}

const outputReceipt = process.argv[2];
const outputInput = process.argv[3];
if (outputReceipt) fs.writeFileSync(outputReceipt, `${JSON.stringify(buildMappingReceipt(inputFor('interrupt')), null, 2)}\n`);
if (outputInput) fs.writeFileSync(outputInput, `${JSON.stringify(inputFor('interrupt'), null, 2)}\n`);
process.stdout.write(`PASS FCL Capability Identity Mapping v0.1 conformance (${tests.length} groups)\n`);
