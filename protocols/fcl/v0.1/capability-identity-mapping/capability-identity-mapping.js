'use strict';

const crypto = require('crypto');
const fs = require('fs');
const {
  validate: validateDescriptor,
} = require('../../../integration/execution-capability-descriptor/v0.1/validate-execution-capability-descriptor.js');
const {
  validate: validateSelection,
} = require('../../../integration/capability-selection/v0.1/validate-capability-selection.js');
const {
  FCLAuthorityEvaluationError,
  validateAuthorityEvaluationReceipt,
} = require('../authority-evaluation/authority-evaluation.js');

class FCLCapabilityIdentityMappingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FCLCapabilityIdentityMappingError';
  }
}

const req = (condition, message) => {
  if (!condition) throw new FCLCapabilityIdentityMappingError(message);
};
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const canon = value => Array.isArray(value)
  ? value.map(canon)
  : (obj(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canon(value[key])]))
    : value);
const hash = value => `sha256:${crypto.createHash('sha256').update(JSON.stringify(canon(value)), 'utf8').digest('hex')}`;
const fingerprint = value => {
  const copy = clone(value);
  copy.fingerprint_sha256 = '';
  return hash(copy);
};
const exact = (value, keys, label) => {
  req(obj(value), `${label} must be object`);
  req(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()),
    `${label} keys mismatch`
  );
};
const str = (value, label) => req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
const integer = (value, label) => req(Number.isInteger(value) && value >= 0, `${label} must be non-negative integer`);
const instant = (value, label) => {
  str(value, label);
  const parsed = Date.parse(value);
  req(Number.isFinite(parsed), `${label} invalid date-time`);
  return parsed;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const INPUT_KEYS = [
  'protocol', 'version', 'profile', 'mapping_id', 'origin',
  'execution_capability_descriptor', 'capability_selection',
  'fcl_authority_evaluation', 'mapped_at'
];

const RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'mapping_id', 'origin',
  'authority_evaluation_id', 'authority_evaluation_fingerprint',
  'request_id', 'requested_control', 'current_run_id', 'current_run_epoch',
  'current_chain_id', 'intent_ref', 'fcl_required_scope', 'fcl_required_target',
  'selection_id', 'selection_content_hash', 'selected_capability_id',
  'selected_descriptor_id', 'selected_descriptor_content_hash', 'selected_adapter_id',
  'selected_operation', 'selected_operation_projection_hash', 'descriptor_authority_scope',
  'mapping_status', 'assertions', 'non_effects', 'next_safe_action',
  'mapped_at', 'fingerprint_sha256'
];

const ASSERTION_KEYS = [
  'descriptor_validated', 'selection_validated', 'authority_evaluation_validated',
  'selection_result_selected', 'descriptor_ref_exact', 'capability_exact',
  'operation_exact', 'authority_scope_exact', 'provider_neutral',
  'discovery_only', 'external_effect_contract_preserved',
  'action_specific_approval_required', 'fresh_availability_probe_required',
  'exact_target_binding_required', 'predecessor_freshness_required',
  'fail_closed_target_guard_required', 'one_shot_supported',
  'expiry_required', 'separate_observer_required'
];

const NON_EFFECT_KEYS = [
  'selection_created_by_mapping', 'availability_observed', 'availability_claim_created',
  'intent_created', 'authority_granted', 'authority_expanded', 'approval_created',
  'action_permit_created', 'action_permit_consumed', 'pre_action_bundle_created',
  'authorize_admitted', 'execution_admitted', 'action_performed',
  'interrupt_completed', 'successor_run_created', 'runtime_state_transitioned',
  'future_permission_created', 'legal_effect_established', 'truth_certified',
  'causality_proven', 'liability_established', 'private_reasoning_included'
];

function validateDescriptorArtifact(descriptor) {
  try {
    req(validateDescriptor(descriptor) === true, 'ExecutionCapabilityDescriptor validator did not return true');
  } catch (error) {
    if (error instanceof FCLCapabilityIdentityMappingError) throw error;
    throw new FCLCapabilityIdentityMappingError(`execution_capability_descriptor invalid: ${error.message}`);
  }
}

function validateSelectionArtifact(selection) {
  const errors = validateSelection(selection);
  req(Array.isArray(errors), 'CapabilitySelection validator must return an error array');
  req(errors.length === 0, `capability_selection invalid: ${errors.join(', ')}`);
}

function validateAuthorityArtifact(receipt) {
  try {
    validateAuthorityEvaluationReceipt(receipt);
  } catch (error) {
    if (error instanceof FCLAuthorityEvaluationError) {
      throw new FCLCapabilityIdentityMappingError(`fcl_authority_evaluation invalid: ${error.message}`);
    }
    throw error;
  }
  req(
    receipt.classification === 'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED',
    'FCL authority evaluation must be positive and request-scoped'
  );
  req(receipt.preexisting_request_scoped_authority_observed === true, 'pre-existing scoped authority must be observed');
  req(receipt.forwardable_to_core_authority_adapter === true, 'authority evaluation must be forwardable');
  req(receipt.authority_evidence_fresh === true, 'authority evidence must be fresh');
  req(receipt.request_effect_authorized === false, 'authority evaluation cannot authorize request effect');
  req(receipt.action_permit_established === false, 'authority evaluation cannot establish ActionPermit');
  req(receipt.execution_admitted === false, 'authority evaluation cannot admit execution');
}

function selectedCandidate(selection) {
  req(selection.result.status === 'selected', 'capability_selection.result.status must be selected');
  str(selection.result.selected_capability_id, 'selected_capability_id');
  req(obj(selection.result.selected_descriptor_ref), 'selected_descriptor_ref required');

  const matches = selection.candidates.filter(candidate => (
    candidate &&
    candidate.operation_projection &&
    candidate.operation_projection.capability_id === selection.result.selected_capability_id &&
    same(candidate.descriptor_ref, selection.result.selected_descriptor_ref)
  ));
  req(matches.length === 1, 'selected candidate must resolve exactly once');
  req(matches[0].assessment && matches[0].assessment.eligible === true, 'selected candidate must be eligible');
  return matches[0];
}

function requireProjectionMatchesDescriptor(projection, descriptor, operation) {
  const expectedPairs = {
    capability_id: descriptor.capability.capability_id,
    adapter_id: descriptor.capability.adapter_id,
    operation: operation.operation,
    effect_class: operation.effect_class,
    authority_scope: operation.authority_scope,
    reversible: operation.reversible,
    compensation_supported: operation.compensation_supported,
    approval_mode: operation.approval_contract.mode,
    scope_binding_required: operation.approval_contract.scope_binding_required,
    availability_probe_required_before_authorization:
      operation.availability_contract.availability_probe_required_before_authorization,
    exact_target_binding_required: operation.lifecycle_contract.exact_target_binding_required,
    predecessor_freshness_required: operation.lifecycle_contract.predecessor_freshness_required,
    fail_closed_target_guard_required: operation.lifecycle_contract.fail_closed_target_guard_required,
    one_shot_supported: operation.lifecycle_contract.one_shot_supported,
    expiry_required: operation.lifecycle_contract.expiry_required,
    separate_observer_required: operation.lifecycle_contract.separate_observer_required,
    lifecycle_profile: operation.lifecycle_contract.profile,
    lifecycle_version: operation.lifecycle_contract.version,
    lifecycle_mode: operation.lifecycle_contract.mode,
  };
  for (const [key, expected] of Object.entries(expectedPairs)) {
    req(projection[key] === expected, `selected operation projection mismatch: ${key}`);
  }
  req(same(projection.required_phases, operation.lifecycle_contract.required_phases), 'required_phases mismatch');
  req(same(projection.pre_action_receipts, operation.receipt_contract.pre_action_required), 'pre_action_receipts mismatch');
  req(same(projection.post_action_receipts, operation.receipt_contract.core_post_action_required), 'post_action_receipts mismatch');
}

function resolveMapping(input) {
  const descriptor = input.execution_capability_descriptor;
  const selection = input.capability_selection;
  const authority = input.fcl_authority_evaluation;

  validateDescriptorArtifact(descriptor);
  validateSelectionArtifact(selection);
  validateAuthorityArtifact(authority);

  const candidate = selectedCandidate(selection);
  const projection = candidate.operation_projection;

  req(selection.result.selected_descriptor_ref.descriptor_id === descriptor.descriptor_id, 'selected descriptor_id mismatch');
  req(selection.result.selected_descriptor_ref.content_hash === descriptor.content_hash, 'selected descriptor content_hash mismatch');
  req(candidate.descriptor_ref.descriptor_id === descriptor.descriptor_id, 'candidate descriptor_id mismatch');
  req(candidate.descriptor_ref.content_hash === descriptor.content_hash, 'candidate descriptor content_hash mismatch');
  req(selection.result.selected_capability_id === descriptor.capability.capability_id, 'selected capability mismatch with descriptor');
  req(projection.capability_id === descriptor.capability.capability_id, 'candidate capability mismatch with descriptor');

  const operations = descriptor.operations.filter(operation => operation.operation === projection.operation);
  req(operations.length === 1, 'selected operation must resolve exactly once in supplied descriptor');
  const operation = operations[0];

  req(selection.request.operation === projection.operation, 'selection request operation mismatch');
  requireProjectionMatchesDescriptor(projection, descriptor, operation);

  req(selection.request.authority_scope === projection.authority_scope, 'selection request authority_scope mismatch');
  req(projection.authority_scope === operation.authority_scope, 'candidate authority_scope mismatch with descriptor');
  req(operation.authority_scope === authority.required_scope, 'descriptor authority_scope does not exactly match FCL required_scope');

  req(descriptor.capability.provider_neutral_schema === true, 'descriptor must remain provider-neutral');
  req(descriptor.capability.discovery_only === true, 'descriptor must remain discovery-only');
  req(operation.effect_class === 'external_effect', 'FCL mapped operation must be external_effect');
  req(operation.approval_contract.required === true, 'mapped operation requires action-specific approval');
  req(operation.approval_contract.mode === 'action_specific', 'mapped approval mode must be action_specific');
  req(operation.approval_contract.scope_binding_required === true, 'mapped approval must be scope-bound');
  req(
    operation.availability_contract.availability_probe_required_before_authorization === true,
    'mapped operation requires fresh availability probe'
  );
  req(operation.lifecycle_contract.exact_target_binding_required === true, 'exact target binding required');
  req(operation.lifecycle_contract.predecessor_freshness_required === true, 'predecessor freshness required');
  req(operation.lifecycle_contract.fail_closed_target_guard_required === true, 'fail-closed target guard required');
  req(operation.lifecycle_contract.one_shot_supported === true, 'one-shot support required');
  req(operation.lifecycle_contract.expiry_required === true, 'permit expiry required');
  req(operation.lifecycle_contract.separate_observer_required === true, 'separate observer required');

  return { descriptor, selection, authority, candidate, projection, operation };
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL', 'input.protocol mismatch');
  req(input.version === '0.1', 'input.version mismatch');
  req(input.profile === 'capability-identity-mapping-v0.1', 'input.profile mismatch');
  str(input.mapping_id, 'input.mapping_id');
  exact(input.origin, ['repository', 'revision', 'tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  req(/^[0-9a-f]{40}$/.test(input.origin.revision), 'input.origin.revision invalid');
  req(/^[0-9a-f]{40}$/.test(input.origin.tree), 'input.origin.tree invalid');
  const resolved = resolveMapping(input);
  req(
    instant(input.mapped_at, 'input.mapped_at') >= instant(resolved.authority.evaluated_at, 'authority.evaluated_at'),
    'mapped_at cannot precede authority evaluation'
  );
  return true;
}

function buildMappingReceipt(input) {
  validateInput(input);
  const { descriptor, selection, authority, projection, operation } = resolveMapping(input);

  const receipt = {
    protocol: 'FCL',
    version: '0.1',
    receipt_type: 'FCLCapabilityIdentityMappingReceipt',
    mapping_id: input.mapping_id,
    origin: clone(input.origin),
    authority_evaluation_id: authority.authority_evaluation_id,
    authority_evaluation_fingerprint: authority.fingerprint_sha256,
    request_id: authority.request_id,
    requested_control: authority.requested_control,
    current_run_id: authority.current_run_id,
    current_run_epoch: authority.current_run_epoch,
    current_chain_id: authority.current_chain_id,
    intent_ref: authority.intent_ref,
    fcl_required_scope: authority.required_scope,
    fcl_required_target: authority.required_target,
    selection_id: selection.selection_id,
    selection_content_hash: selection.content_hash,
    selected_capability_id: selection.result.selected_capability_id,
    selected_descriptor_id: descriptor.descriptor_id,
    selected_descriptor_content_hash: descriptor.content_hash,
    selected_adapter_id: descriptor.capability.adapter_id,
    selected_operation: operation.operation,
    selected_operation_projection_hash: projection.projection_hash,
    descriptor_authority_scope: operation.authority_scope,
    mapping_status: 'EXACT',
    assertions: {
      descriptor_validated: true,
      selection_validated: true,
      authority_evaluation_validated: true,
      selection_result_selected: true,
      descriptor_ref_exact: true,
      capability_exact: true,
      operation_exact: true,
      authority_scope_exact: true,
      provider_neutral: true,
      discovery_only: true,
      external_effect_contract_preserved: true,
      action_specific_approval_required: true,
      fresh_availability_probe_required: true,
      exact_target_binding_required: true,
      predecessor_freshness_required: true,
      fail_closed_target_guard_required: true,
      one_shot_supported: true,
      expiry_required: true,
      separate_observer_required: true,
    },
    non_effects: {
      selection_created_by_mapping: false,
      availability_observed: false,
      availability_claim_created: false,
      intent_created: false,
      authority_granted: false,
      authority_expanded: false,
      approval_created: false,
      action_permit_created: false,
      action_permit_consumed: false,
      pre_action_bundle_created: false,
      authorize_admitted: false,
      execution_admitted: false,
      action_performed: false,
      interrupt_completed: false,
      successor_run_created: false,
      runtime_state_transitioned: false,
      future_permission_created: false,
      legal_effect_established: false,
      truth_certified: false,
      causality_proven: false,
      liability_established: false,
      private_reasoning_included: false,
    },
    next_safe_action: 'BUILD_SOURCE_VERIFIED_PRE_ACTION_EVIDENCE_CONTEXT',
    mapped_at: input.mapped_at,
    fingerprint_sha256: '',
  };
  receipt.fingerprint_sha256 = fingerprint(receipt);
  return receipt;
}

function validateMappingReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'FCL', 'receipt.protocol mismatch');
  req(receipt.version === '0.1', 'receipt.version mismatch');
  req(receipt.receipt_type === 'FCLCapabilityIdentityMappingReceipt', 'receipt_type mismatch');
  str(receipt.mapping_id, 'receipt.mapping_id');
  exact(receipt.origin, ['repository', 'revision', 'tree'], 'receipt.origin');
  str(receipt.authority_evaluation_id, 'receipt.authority_evaluation_id');
  req(/^sha256:[0-9a-f]{64}$/.test(receipt.authority_evaluation_fingerprint), 'authority_evaluation_fingerprint invalid');
  str(receipt.request_id, 'receipt.request_id');
  req(['REQUEST_INTERRUPT', 'REQUEST_SUCCESSOR'].includes(receipt.requested_control), 'requested_control invalid');
  str(receipt.current_run_id, 'receipt.current_run_id');
  integer(receipt.current_run_epoch, 'receipt.current_run_epoch');
  str(receipt.current_chain_id, 'receipt.current_chain_id');
  str(receipt.intent_ref, 'receipt.intent_ref');
  req(['fcl.run.interrupt', 'fcl.run.successor.create'].includes(receipt.fcl_required_scope), 'fcl_required_scope invalid');
  str(receipt.fcl_required_target, 'receipt.fcl_required_target');
  str(receipt.selection_id, 'receipt.selection_id');
  req(/^sha256:[0-9a-f]{64}$/.test(receipt.selection_content_hash), 'selection_content_hash invalid');
  str(receipt.selected_capability_id, 'receipt.selected_capability_id');
  str(receipt.selected_descriptor_id, 'receipt.selected_descriptor_id');
  req(/^sha256:[0-9a-f]{64}$/.test(receipt.selected_descriptor_content_hash), 'selected_descriptor_content_hash invalid');
  str(receipt.selected_adapter_id, 'receipt.selected_adapter_id');
  str(receipt.selected_operation, 'receipt.selected_operation');
  req(/^sha256:[0-9a-f]{64}$/.test(receipt.selected_operation_projection_hash), 'selected_operation_projection_hash invalid');
  req(receipt.descriptor_authority_scope === receipt.fcl_required_scope, 'descriptor_authority_scope must equal FCL required scope');
  req(receipt.mapping_status === 'EXACT', 'mapping_status must be EXACT');
  exact(receipt.assertions, ASSERTION_KEYS, 'receipt.assertions');
  for (const key of ASSERTION_KEYS) req(receipt.assertions[key] === true, `assertion ${key} must be true`);
  exact(receipt.non_effects, NON_EFFECT_KEYS, 'receipt.non_effects');
  for (const key of NON_EFFECT_KEYS) req(receipt.non_effects[key] === false, `non_effect ${key} must remain false`);
  req(
    receipt.next_safe_action === 'BUILD_SOURCE_VERIFIED_PRE_ACTION_EVIDENCE_CONTEXT',
    'next_safe_action mismatch'
  );
  instant(receipt.mapped_at, 'receipt.mapped_at');
  req(/^sha256:[0-9a-f]{64}$/.test(receipt.fingerprint_sha256), 'fingerprint_sha256 invalid');
  req(receipt.fingerprint_sha256 === fingerprint(receipt), 'receipt fingerprint mismatch');
  return true;
}

function readJson(file) {
  const text = file === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(file, 'utf8');
  return JSON.parse(text);
}

function main(argv = process.argv.slice(2)) {
  const [command, file] = argv;
  if (command === 'help' || !command) {
    process.stdout.write('usage: capability-identity-mapping.js validate|map|validate-receipt <json|->\n');
    return 0;
  }
  if (!['validate', 'map', 'validate-receipt'].includes(command)) {
    process.stderr.write(`unsupported command: ${command}\n`);
    return 2;
  }
  if (!file) {
    process.stderr.write('input file required\n');
    return 2;
  }
  try {
    const value = readJson(file);
    if (command === 'validate') {
      validateInput(value);
      process.stdout.write('VALID\n');
    } else if (command === 'map') {
      process.stdout.write(`${JSON.stringify(buildMappingReceipt(value), null, 2)}\n`);
    } else {
      validateMappingReceipt(value);
      process.stdout.write('VALID\n');
    }
    return 0;
  } catch (error) {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  ASSERTION_KEYS,
  FCLCapabilityIdentityMappingError,
  NON_EFFECT_KEYS,
  buildMappingReceipt,
  canonicalFingerprint: fingerprint,
  validateInput,
  validateMappingReceipt,
};
