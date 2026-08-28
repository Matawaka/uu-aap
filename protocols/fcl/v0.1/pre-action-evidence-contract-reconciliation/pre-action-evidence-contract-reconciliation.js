'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  buildMappingReceipt,
  validateInput: validateMappingInput,
  validateMappingReceipt,
} = require('../capability-identity-mapping/capability-identity-mapping.js');
const {
  validate: validateExecutionAvailability,
} = require('../../../integration/execution-capability-availability/v0.1/validate-execution-capability-availability.js');
const {
  validateEvidenceContext,
} = require('../../../integration/pre-action-evidence-bundle/v0.1/validate-pre-action-evidence-bundle.js');
const {
  FCLCoreActionPermitBindingError,
  validateBoundActionPermit,
} = require('../core-action-permit-binding/core-action-permit-binding.js');

class FCLPreActionEvidenceContractReconciliationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FCLPreActionEvidenceContractReconciliationError';
  }
}

const req = (condition, message) => {
  if (!condition) throw new FCLPreActionEvidenceContractReconciliationError(message);
};
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const exact = (value, keys, label) => {
  req(obj(value), `${label} must be object`);
  req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} keys mismatch`);
};
const str = (value, label, pattern = null) => {
  req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
  if (pattern) req(pattern.test(value), `${label} invalid format`);
};
const integer = (value, label) => req(Number.isInteger(value) && value >= 0, `${label} must be integer >= 0`);
const instant = (value, label) => {
  str(value, label);
  const parsed = Date.parse(value);
  req(Number.isFinite(parsed), `${label} invalid date-time`);
  return parsed;
};
const has = (value, key) => obj(value) && Object.prototype.hasOwnProperty.call(value, key);

const SHA40 = /^[0-9a-f]{40}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const INPUT_KEYS = [
  'protocol', 'version', 'profile', 'reconciliation_id', 'origin',
  'capability_mapping_input', 'capability_mapping_receipt',
  'execution_capability_availability',
  'fcl_core_action_permit_binding_input', 'fcl_core_action_permit',
  'reconciled_at'
];
const RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'reconciliation_id', 'origin',
  'mapping_fingerprint', 'execution_availability_content_hash',
  'fcl_action_permit_hash', 'request_id', 'requested_control',
  'run_id', 'run_epoch', 'chain_id', 'intent_ref',
  'selected_capability_id', 'selected_descriptor_id', 'selected_descriptor_content_hash',
  'selected_operation', 'fcl_scope', 'fcl_target', 'target_binding_hash', 'frontier',
  'execution_availability_valid_until', 'fcl_availability_valid_until', 'action_permit_expires_at',
  'source_core_receipts', 'compatibility', 'assertions', 'non_effects',
  'next_safe_action', 'reconciled_at', 'fingerprint_sha256'
];
const SOURCE_CORE_KEYS = [
  'execution_state_receipt_hash', 'execution_availability_claim_hash',
  'fcl_state_receipt_hash', 'fcl_availability_claim_hash',
  'fcl_intent_receipt_hash', 'fcl_authority_receipt_hash',
  'fcl_coordination_receipt_hash'
];
const COMPATIBILITY_KEYS = [
  'mapping_selected_operation_to_fcl_scope_exact',
  'execution_availability_selection_identity_exact',
  'execution_availability_positive_and_fresh',
  'normalized_preaction_evidence_context_shape_valid',
  'fcl_action_permit_chain_valid',
  'fcl_scope_target_run_epoch_chain_exact',
  'preaction_frontier_revision_exact',
  'action_permit_target_binding_hash_present',
  'core_state_receipt_identity_equal',
  'core_availability_claim_identity_equal',
  'fcl_availability_embeds_selection_provenance',
  'selected_operation_equals_fcl_target_operation',
  'fcl_intent_exposes_preaction_operation',
  'fcl_intent_exposes_target_binding_hash',
  'fcl_authority_exposes_target_binding_hash',
  'fcl_coordination_exposes_target_binding_hash',
  'direct_preaction_bundle_contract_satisfied'
];
const EXPECTED_COMPATIBILITY = {
  mapping_selected_operation_to_fcl_scope_exact: true,
  execution_availability_selection_identity_exact: true,
  execution_availability_positive_and_fresh: true,
  normalized_preaction_evidence_context_shape_valid: true,
  fcl_action_permit_chain_valid: true,
  fcl_scope_target_run_epoch_chain_exact: true,
  preaction_frontier_revision_exact: true,
  action_permit_target_binding_hash_present: true,
  core_state_receipt_identity_equal: false,
  core_availability_claim_identity_equal: false,
  fcl_availability_embeds_selection_provenance: false,
  selected_operation_equals_fcl_target_operation: false,
  fcl_intent_exposes_preaction_operation: false,
  fcl_intent_exposes_target_binding_hash: false,
  fcl_authority_exposes_target_binding_hash: false,
  fcl_coordination_exposes_target_binding_hash: false,
  direct_preaction_bundle_contract_satisfied: false,
};
const ASSERTION_KEYS = [
  'mapping_receipt_exactly_reproduced',
  'execution_availability_canonically_revalidated',
  'fcl_action_permit_canonically_revalidated',
  'cross_source_identity_exact',
  'shared_frontier_proven',
  'fresh_at_reconciliation',
  'compatibility_matrix_observed',
  'direct_bundle_fail_closed'
];
const NON_EFFECT_KEYS = [
  'source_receipt_rewritten', 'core_receipt_created', 'availability_observed',
  'intent_created', 'authority_created', 'approval_created',
  'action_permit_created', 'action_permit_consumed', 'pre_action_bundle_created',
  'authorize_admitted', 'execution_admitted', 'action_performed',
  'interrupt_completed', 'successor_run_created', 'runtime_state_transitioned',
  'future_action_permission_created', 'legal_effect_established', 'truth_certified',
  'causality_proven', 'liability_established', 'private_reasoning_included'
];

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (obj(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new FCLPreActionEvidenceContractReconciliationError(`unsupported canonical JSON value type: ${typeof value}`);
}
function hashObject(value) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(value), 'utf8')).digest('hex')}`;
}
function fingerprint(receipt) {
  const projected = clone(receipt);
  projected.fingerprint_sha256 = '';
  return hashObject(projected);
}
function same(a, b) { return canonical(a) === canonical(b); }

function normalizedEvidenceContext(input) {
  const mapping = input.capability_mapping_receipt;
  const availability = input.execution_capability_availability;
  return {
    selection: {
      selection_id: mapping.selection_id,
      content_hash: mapping.selection_content_hash,
      selected_capability_id: mapping.selected_capability_id,
      descriptor_id: mapping.selected_descriptor_id,
      descriptor_content_hash: mapping.selected_descriptor_content_hash,
      operation: mapping.selected_operation,
    },
    availability: {
      binding_id: availability.binding_id,
      content_hash: availability.content_hash,
      observation_content_hash: availability.observation.content_hash,
      core_state_receipt_hash: availability.core_state_receipt.content_hash,
      core_availability_claim_hash: availability.core_availability_claim.content_hash,
      status: availability.observation.status,
      valid_until: availability.observation.valid_until,
      frontier: availability.observation.frontier.revision,
    },
  };
}

function validateSources(input) {
  try {
    validateMappingInput(input.capability_mapping_input);
    validateMappingReceipt(input.capability_mapping_receipt);
  } catch (error) {
    throw new FCLPreActionEvidenceContractReconciliationError(`capability mapping invalid: ${error.message}`);
  }
  const rebuilt = buildMappingReceipt(input.capability_mapping_input);
  req(same(rebuilt, input.capability_mapping_receipt), 'capability mapping receipt is not exactly reproducible from supplied mapping input');

  try {
    validateExecutionAvailability(
      input.execution_capability_availability,
      input.capability_mapping_input.capability_selection
    );
  } catch (error) {
    throw new FCLPreActionEvidenceContractReconciliationError(`execution availability invalid: ${error.message}`);
  }
  const executionAvailability = input.execution_capability_availability;
  req(executionAvailability.observation.status === 'available', 'execution availability must be positive');
  req(executionAvailability.core_availability_claim !== null, 'execution availability must materialize positive Core AvailabilityClaim');
  req(executionAvailability.assertions.core_availability_claim_materialized === true, 'execution availability must assert Core AvailabilityClaim materialized');

  try {
    validateBoundActionPermit(
      input.fcl_core_action_permit,
      input.fcl_core_action_permit_binding_input
    );
  } catch (error) {
    if (error instanceof FCLCoreActionPermitBindingError) {
      throw new FCLPreActionEvidenceContractReconciliationError(`FCL ActionPermit invalid: ${error.message}`);
    }
    throw error;
  }

  const context = normalizedEvidenceContext(input);
  try { validateEvidenceContext(context); }
  catch (error) {
    throw new FCLPreActionEvidenceContractReconciliationError(`normalized PreAction evidence context invalid: ${error.message}`);
  }
  return { rebuilt, context };
}

function validateCrossSourceIdentity(input) {
  const mapping = input.capability_mapping_receipt;
  const availability = input.execution_capability_availability;
  const permitInput = input.fcl_core_action_permit_binding_input;
  const permit = input.fcl_core_action_permit;
  const coordinationInput = permitInput.core_coordination_binding_input;
  const fcl = coordinationInput.fcl_authority_evaluation;

  const exactFields = [
    ['authority_evaluation_fingerprint', fcl.fingerprint_sha256],
    ['request_id', fcl.request_id],
    ['requested_control', fcl.requested_control],
    ['current_run_id', fcl.current_run_id],
    ['current_run_epoch', fcl.current_run_epoch],
    ['current_chain_id', fcl.current_chain_id],
    ['intent_ref', fcl.intent_ref],
    ['fcl_required_scope', fcl.required_scope],
    ['fcl_required_target', fcl.required_target],
  ];
  for (const [key, expected] of exactFields) req(mapping[key] === expected, `mapping/FCL identity mismatch: ${key}`);

  const b = availability.selection_binding;
  req(b.selection_id === mapping.selection_id, 'availability/mapping selection_id mismatch');
  req(b.selection_content_hash === mapping.selection_content_hash, 'availability/mapping selection hash mismatch');
  req(b.selected_capability_id === mapping.selected_capability_id, 'availability/mapping capability mismatch');
  req(b.selected_descriptor_ref.descriptor_id === mapping.selected_descriptor_id, 'availability/mapping descriptor id mismatch');
  req(b.selected_descriptor_ref.content_hash === mapping.selected_descriptor_content_hash, 'availability/mapping descriptor hash mismatch');
  req(b.operation === mapping.selected_operation, 'availability/mapping operation mismatch');

  req(permit.payload.authority_scope === mapping.fcl_required_scope, 'ActionPermit/mapping authority scope mismatch');
  req(permit.payload.target.resource === mapping.fcl_required_target, 'ActionPermit/mapping target mismatch');
  req(permit.payload.fcl_execution_context.run_id === mapping.current_run_id, 'ActionPermit/mapping run_id mismatch');
  req(permit.payload.fcl_execution_context.run_epoch === mapping.current_run_epoch, 'ActionPermit/mapping run_epoch mismatch');
  req(permit.payload.fcl_execution_context.chain_id === mapping.current_chain_id, 'ActionPermit/mapping chain_id mismatch');
  req(permit.payload.fcl_execution_context.intent_ref === mapping.intent_ref, 'ActionPermit/mapping intent_ref mismatch');
  req(
    availability.observation.frontier.revision === coordinationInput.core_state_receipt.frontier.revision,
    'Execution Availability and FCL Core chain must prove the same frontier revision'
  );
  return { mapping, availability, permitInput, permit, coordinationInput, fcl };
}

function computeCompatibility(input) {
  const { mapping, availability, permit, coordinationInput } = validateCrossSourceIdentity(input);
  const executionState = availability.core_state_receipt;
  const executionClaim = availability.core_availability_claim;
  const fclState = coordinationInput.core_state_receipt;
  const fclClaim = coordinationInput.core_availability_claim;
  const fclIntent = coordinationInput.core_intent_receipt;
  const fclAuthority = coordinationInput.core_authority_receipt;
  const fclCoordination = input.fcl_core_action_permit_binding_input.core_coordination_receipt;

  const embedsSelectionProvenance = (
    has(fclClaim.payload, 'selection_record_hash') &&
    has(fclClaim.payload, 'descriptor_content_hash') &&
    has(fclClaim.payload, 'availability_observation_hash') &&
    fclClaim.payload.selection_record_hash === mapping.selection_content_hash &&
    fclClaim.payload.descriptor_content_hash === mapping.selected_descriptor_content_hash &&
    fclClaim.payload.availability_observation_hash === availability.observation.content_hash
  );
  const intentOperation = has(fclIntent.payload, 'operation') && fclIntent.payload.operation === mapping.selected_operation;
  const intentTargetHash = has(fclIntent.assertions, 'target_binding_hash') && fclIntent.assertions.target_binding_hash === permit.payload.target_binding_hash;
  const authorityTargetHash = has(fclAuthority.assertions, 'target_binding_hash') && fclAuthority.assertions.target_binding_hash === permit.payload.target_binding_hash;
  const coordinationTargetHash = has(fclCoordination.assertions, 'target_binding_hash') && fclCoordination.assertions.target_binding_hash === permit.payload.target_binding_hash;

  const compatibility = {
    mapping_selected_operation_to_fcl_scope_exact: mapping.descriptor_authority_scope === mapping.fcl_required_scope,
    execution_availability_selection_identity_exact: true,
    execution_availability_positive_and_fresh: true,
    normalized_preaction_evidence_context_shape_valid: true,
    fcl_action_permit_chain_valid: true,
    fcl_scope_target_run_epoch_chain_exact: true,
    preaction_frontier_revision_exact: availability.observation.frontier.revision === fclState.frontier.revision,
    action_permit_target_binding_hash_present: typeof permit.payload.target_binding_hash === 'string' && HASH.test(permit.payload.target_binding_hash),
    core_state_receipt_identity_equal: executionState.content_hash === fclState.content_hash,
    core_availability_claim_identity_equal: executionClaim.content_hash === fclClaim.content_hash,
    fcl_availability_embeds_selection_provenance: embedsSelectionProvenance,
    selected_operation_equals_fcl_target_operation: mapping.selected_operation === permit.payload.target.operation,
    fcl_intent_exposes_preaction_operation: intentOperation,
    fcl_intent_exposes_target_binding_hash: intentTargetHash,
    fcl_authority_exposes_target_binding_hash: authorityTargetHash,
    fcl_coordination_exposes_target_binding_hash: coordinationTargetHash,
    direct_preaction_bundle_contract_satisfied: false,
  };
  compatibility.direct_preaction_bundle_contract_satisfied = [
    compatibility.core_state_receipt_identity_equal,
    compatibility.core_availability_claim_identity_equal,
    compatibility.fcl_availability_embeds_selection_provenance,
    compatibility.selected_operation_equals_fcl_target_operation,
    compatibility.fcl_intent_exposes_preaction_operation,
    compatibility.fcl_intent_exposes_target_binding_hash,
    compatibility.fcl_authority_exposes_target_binding_hash,
    compatibility.fcl_coordination_exposes_target_binding_hash,
  ].every(Boolean);
  return compatibility;
}

function requireCurrentV01Compatibility(compatibility) {
  exact(compatibility, COMPATIBILITY_KEYS, 'compatibility');
  for (const [key, expected] of Object.entries(EXPECTED_COMPATIBILITY)) {
    req(compatibility[key] === expected, `current v0.1 compatibility observation changed: ${key}`);
  }
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL', 'input.protocol mismatch');
  req(input.version === '0.1', 'input.version mismatch');
  req(input.profile === 'pre-action-evidence-contract-reconciliation-v0.1', 'input.profile mismatch');
  str(input.reconciliation_id, 'input.reconciliation_id');
  exact(input.origin, ['repository', 'revision', 'tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);

  validateSources(input);
  const { mapping, availability, permit, coordinationInput } = validateCrossSourceIdentity(input);
  const reconciledAt = instant(input.reconciled_at, 'input.reconciled_at');
  req(reconciledAt >= instant(mapping.mapped_at, 'mapping.mapped_at'), 'reconciled_at cannot precede capability mapping');
  req(reconciledAt >= instant(availability.core_availability_claim.issued_at, 'execution availability claim issued_at'), 'reconciled_at cannot precede Execution Availability claim');
  req(reconciledAt >= instant(permit.issued_at, 'ActionPermit issued_at'), 'reconciled_at cannot precede ActionPermit');
  req(reconciledAt < instant(availability.observation.valid_until, 'execution availability valid_until'), 'Execution Availability stale at reconciliation');
  req(reconciledAt < instant(coordinationInput.core_availability_claim.payload.valid_until, 'FCL availability valid_until'), 'FCL availability stale at reconciliation');
  req(reconciledAt < instant(permit.payload.expires_at, 'ActionPermit expires_at'), 'ActionPermit expired at reconciliation');

  const compatibility = computeCompatibility(input);
  requireCurrentV01Compatibility(compatibility);
  return true;
}

function buildReceipt(input) {
  validateInput(input);
  const mapping = input.capability_mapping_receipt;
  const availability = input.execution_capability_availability;
  const permitInput = input.fcl_core_action_permit_binding_input;
  const permit = input.fcl_core_action_permit;
  const coordinationInput = permitInput.core_coordination_binding_input;
  const compatibility = computeCompatibility(input);
  const receipt = {
    protocol: 'FCL', version: '0.1',
    receipt_type: 'FCLPreActionEvidenceContractReconciliationReceipt',
    reconciliation_id: input.reconciliation_id,
    origin: clone(input.origin),
    mapping_fingerprint: mapping.fingerprint_sha256,
    execution_availability_content_hash: availability.content_hash,
    fcl_action_permit_hash: permit.content_hash,
    request_id: mapping.request_id,
    requested_control: mapping.requested_control,
    run_id: mapping.current_run_id,
    run_epoch: mapping.current_run_epoch,
    chain_id: mapping.current_chain_id,
    intent_ref: mapping.intent_ref,
    selected_capability_id: mapping.selected_capability_id,
    selected_descriptor_id: mapping.selected_descriptor_id,
    selected_descriptor_content_hash: mapping.selected_descriptor_content_hash,
    selected_operation: mapping.selected_operation,
    fcl_scope: mapping.fcl_required_scope,
    fcl_target: mapping.fcl_required_target,
    target_binding_hash: permit.payload.target_binding_hash,
    frontier: availability.observation.frontier.revision,
    execution_availability_valid_until: availability.observation.valid_until,
    fcl_availability_valid_until: coordinationInput.core_availability_claim.payload.valid_until,
    action_permit_expires_at: permit.payload.expires_at,
    source_core_receipts: {
      execution_state_receipt_hash: availability.core_state_receipt.content_hash,
      execution_availability_claim_hash: availability.core_availability_claim.content_hash,
      fcl_state_receipt_hash: coordinationInput.core_state_receipt.content_hash,
      fcl_availability_claim_hash: coordinationInput.core_availability_claim.content_hash,
      fcl_intent_receipt_hash: coordinationInput.core_intent_receipt.content_hash,
      fcl_authority_receipt_hash: coordinationInput.core_authority_receipt.content_hash,
      fcl_coordination_receipt_hash: permitInput.core_coordination_receipt.content_hash,
    },
    compatibility,
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    next_safe_action: 'PARAMETERIZE_PRE_ACTION_FCL_EVIDENCE_BRIDGE',
    reconciled_at: input.reconciled_at,
    fingerprint_sha256: '',
  };
  receipt.fingerprint_sha256 = fingerprint(receipt);
  return receipt;
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'FCL' && receipt.version === '0.1', 'receipt header mismatch');
  req(receipt.receipt_type === 'FCLPreActionEvidenceContractReconciliationReceipt', 'receipt_type mismatch');
  str(receipt.reconciliation_id, 'receipt.reconciliation_id');
  exact(receipt.origin, ['repository', 'revision', 'tree'], 'receipt.origin');
  req(receipt.origin.repository === 'Matawaka/uu-aap', 'receipt.origin.repository mismatch');
  str(receipt.origin.revision, 'receipt.origin.revision', SHA40);
  str(receipt.origin.tree, 'receipt.origin.tree', SHA40);
  for (const key of ['mapping_fingerprint','execution_availability_content_hash','fcl_action_permit_hash','selected_descriptor_content_hash','target_binding_hash']) str(receipt[key], `receipt.${key}`, HASH);
  for (const key of ['request_id','requested_control','run_id','chain_id','intent_ref','selected_capability_id','selected_descriptor_id','selected_operation','fcl_scope','fcl_target','frontier']) str(receipt[key], `receipt.${key}`);
  integer(receipt.run_epoch, 'receipt.run_epoch');
  for (const key of ['execution_availability_valid_until','fcl_availability_valid_until','action_permit_expires_at','reconciled_at']) instant(receipt[key], `receipt.${key}`);
  exact(receipt.source_core_receipts, SOURCE_CORE_KEYS, 'receipt.source_core_receipts');
  for (const key of SOURCE_CORE_KEYS) str(receipt.source_core_receipts[key], `receipt.source_core_receipts.${key}`, HASH);
  requireCurrentV01Compatibility(receipt.compatibility);
  exact(receipt.assertions, ASSERTION_KEYS, 'receipt.assertions');
  for (const key of ASSERTION_KEYS) req(receipt.assertions[key] === true, `receipt.assertions.${key} must be true`);
  exact(receipt.non_effects, NON_EFFECT_KEYS, 'receipt.non_effects');
  for (const key of NON_EFFECT_KEYS) req(receipt.non_effects[key] === false, `receipt.non_effects.${key} must be false`);
  req(receipt.next_safe_action === 'PARAMETERIZE_PRE_ACTION_FCL_EVIDENCE_BRIDGE', 'next_safe_action mismatch');
  str(receipt.fingerprint_sha256, 'receipt.fingerprint_sha256', HASH);
  req(receipt.fingerprint_sha256 === fingerprint(receipt), 'receipt fingerprint mismatch');
  return true;
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLPreActionEvidenceContractReconciliationError(`invalid JSON: ${error.message}`); }
}
function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('FCL PreAction Evidence Contract Reconciliation v0.1 read-only CLI\nUsage: pre-action-evidence-contract-reconciliation.js validate|reconcile|validate-receipt <json|->\nNo assemble/authorize/execute/probe/consume/interrupt/send command exists.\n');
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','reconcile','validate-receipt'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') {
    validateInput(value); process.stdout.write('VALID\n');
  } else if (command === 'reconcile') {
    process.stdout.write(`${JSON.stringify(buildReceipt(value), null, 2)}\n`);
  } else {
    validateReceipt(value); process.stdout.write('VALID\n');
  }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLPreActionEvidenceContractReconciliationError) {
      process.stderr.write(`FCL PreAction reconciliation validation error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  ASSERTION_KEYS, COMPATIBILITY_KEYS, EXPECTED_COMPATIBILITY,
  FCLPreActionEvidenceContractReconciliationError, NON_EFFECT_KEYS,
  buildReceipt, canonical, computeCompatibility, fingerprint,
  normalizedEvidenceContext, validateInput, validateReceipt,
};
