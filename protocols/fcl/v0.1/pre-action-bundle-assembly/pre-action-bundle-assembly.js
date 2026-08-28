#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  FCLPreActionEvidenceBridgeError,
  buildBridgeRecord,
  canonical,
  evidenceContextForBridge,
  validateBoundBridgeRecord,
} = require('../pre-action-evidence-bridge/pre-action-evidence-bridge.js');
const {
  FCLActionSpecificApprovalError,
  buildApprovalReceipt,
  validateApprovalReceipt,
} = require('../action-specific-approval/action-specific-approval.js');
const {
  sha256Object,
  validateBundle,
} = require('../../../integration/pre-action-evidence-bundle/v0.1/validate-pre-action-evidence-bundle.js');

class FCLPreActionBundleAssemblyError extends Error {
  constructor(message) { super(message); this.name = 'FCLPreActionBundleAssemblyError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLPreActionBundleAssemblyError(message); };
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
const instant = (value, label) => {
  str(value, label);
  const parsed = Date.parse(value);
  req(Number.isFinite(parsed), `${label} invalid date-time`);
  return parsed;
};
const same = (a, b) => canonical(a) === canonical(b);
const SHA40 = /^[0-9a-f]{40}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;

const INPUT_KEYS = [
  'protocol','version','profile','assembly_id','bundle_id','origin',
  'bridge_input','bridge_record','approval_input','approval_receipt','assembled_at'
];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','assembly_id','bundle_id','bundle_content_hash',
  'bridge_id','bridge_content_hash','reconciliation_fingerprint',
  'approval_id','approval_fingerprint','approval_binding_hash',
  'action_permit_hash','target_binding_hash','frontier','selected_operation','target_operation',
  'authority_scope','freshness','assertions','non_effects','next_safe_action','assembled_at','content_hash'
];
const FRESHNESS_KEYS = [
  'execution_availability_valid_until','fcl_availability_valid_until','approval_valid_until',
  'action_permit_expires_at','authorization_must_occur_by'
];
const ASSERTION_KEYS = [
  'bridge_exactly_bound','approval_exactly_bound','same_action_permit_exact',
  'same_action_permit_binding_input_exact','target_exactly_bound',
  'permit_within_fcl_availability_horizon','three_way_equals_four_source_min',
  'bundle_bridge_aware_validation_passed','bundle_materialized'
];
const NON_EFFECT_KEYS = [
  'source_receipt_rewritten','core_receipt_created','intent_created','authority_created',
  'approval_created','action_permit_created','action_permit_consumed','authorize_admitted',
  'execution_admitted','execute_phase_entered','action_performed','runtime_state_transitioned',
  'future_action_permission_created'
];

function hashObject(value) {
  const projected = clone(value);
  delete projected.content_hash;
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(projected), 'utf8')).digest('hex')}`;
}
function receiptHash(receipt) { return hashObject(receipt); }
function earliest(values) { return values.reduce((best, value) => Date.parse(value) < Date.parse(best) ? value : best); }

function threeWayHorizon(input) {
  const bridge = input.bridge_record;
  const approval = input.approval_receipt.approval_binding;
  const permit = input.bridge_input.reconciliation_input.fcl_core_action_permit;
  return earliest([
    bridge.availability.evidence_valid_until,
    approval.valid_until,
    permit.payload.expires_at,
  ]);
}

function fourSourceMinimum(input) {
  const bridge = input.bridge_record;
  const approval = input.approval_receipt.approval_binding;
  const permit = input.bridge_input.reconciliation_input.fcl_core_action_permit;
  return earliest([
    bridge.availability.evidence_valid_until,
    bridge.availability.action_chain_valid_until,
    approval.valid_until,
    permit.payload.expires_at,
  ]);
}

function validateSources(input) {
  try { validateBoundBridgeRecord(input.bridge_record, input.bridge_input); }
  catch (error) {
    if (error instanceof FCLPreActionEvidenceBridgeError) throw new FCLPreActionBundleAssemblyError(`bridge source invalid: ${error.message}`);
    throw error;
  }
  const rebuiltBridge = buildBridgeRecord(input.bridge_input);
  req(same(rebuiltBridge, input.bridge_record), 'bridge record is not exactly reproducible from supplied bridge input');
  req(input.bridge_record.next_safe_action === 'ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE', 'bridge next_safe_action mismatch');

  try { validateApprovalReceipt(input.approval_receipt, input.approval_input); }
  catch (error) {
    if (error instanceof FCLActionSpecificApprovalError) throw new FCLPreActionBundleAssemblyError(`approval source invalid: ${error.message}`);
    throw error;
  }
  const rebuiltApproval = buildApprovalReceipt(input.approval_input);
  req(same(rebuiltApproval, input.approval_receipt), 'approval receipt is not exactly reproducible from supplied approval input');
  req(input.approval_receipt.next_safe_action === 'ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE', 'approval next_safe_action mismatch');
  return { rebuiltBridge, rebuiltApproval };
}

function deriveSources(input) {
  validateSources(input);
  const bridge = input.bridge_record;
  const bridgeInput = input.bridge_input;
  const rInput = bridgeInput.reconciliation_input;
  const mapping = rInput.capability_mapping_receipt;
  const executionAvailability = rInput.execution_capability_availability;
  const permitInput = rInput.fcl_core_action_permit_binding_input;
  const permit = rInput.fcl_core_action_permit;
  const coordinationInput = permitInput.core_coordination_binding_input;
  const coordination = permitInput.core_coordination_receipt;
  const state = coordinationInput.core_state_receipt;
  const fclAvailability = coordinationInput.core_availability_claim;
  const intent = coordinationInput.core_intent_receipt;
  const authority = coordinationInput.core_authority_receipt;
  const approvalInput = input.approval_input;
  const approvalReceipt = input.approval_receipt;
  const approvalBinding = approvalReceipt.approval_binding;
  const target = permit.payload.target;

  req(same(approvalInput.core_action_permit, permit), 'approval/bridge ActionPermit bytes mismatch');
  req(same(approvalInput.core_action_permit_binding_input, permitInput), 'approval/bridge ActionPermit binding input bytes mismatch');
  req(approvalReceipt.core_action_permit_hash === bridge.action_permit_hash, 'approval/bridge ActionPermit hash mismatch');
  req(approvalReceipt.core_action_permit_hash === permit.content_hash, 'approval ActionPermit hash mismatch with bridge input');
  req(approvalReceipt.target_binding_hash === bridge.target_binding_hash, 'approval/bridge target binding mismatch');
  req(approvalBinding.target_binding_hash === bridge.target_binding_hash, 'approval binding target mismatch');
  req(approvalBinding.operation === bridge.target_operation, 'approval operation must equal FCL target operation');
  req(bridge.selected_operation !== bridge.target_operation, 'selected operation / FCL target identifiers must remain distinct');
  req(approvalBinding.authority_scope === target.authority_scope, 'approval authority scope mismatch');
  req(approvalBinding.authority_scope === bridge.projections.authority.authority_scope, 'approval/bridge authority scope mismatch');
  req(approvalBinding.subject_id === state.subject.id, 'approval/FCL action-chain subject mismatch');
  req(bridge.frontier === target.expected_predecessor_frontier, 'bridge/ActionPermit frontier mismatch');
  req(bridge.target_binding_hash === permit.payload.target_binding_hash, 'bridge/ActionPermit target binding mismatch');
  req(approvalBinding.kind === 'action_specific' && approvalBinding.scope_bound === true && approvalBinding.one_shot === true, 'approval binding semantics mismatch');
  req(permit.payload.one_shot === true && permit.payload.consumed === false, 'ActionPermit must remain one-shot and unconsumed');
  req(permit.payload.expires_at === permitInput.expires_at, 'ActionPermit expiry/input mismatch');
  req(fclAvailability.payload.valid_until === bridge.availability.action_chain_valid_until, 'FCL availability/bridge horizon mismatch');
  req(instant(permit.payload.expires_at, 'ActionPermit expires_at') <= instant(fclAvailability.payload.valid_until, 'FCL Availability valid_until'), 'ActionPermit expiry exceeds FCL Availability horizon');
  req(threeWayHorizon(input) === fourSourceMinimum(input), 'derived horizon invariant mismatch');

  return {
    bridge, bridgeInput, rInput, mapping, executionAvailability, permitInput, permit,
    coordinationInput, coordination, state, fclAvailability, intent, authority,
    approvalInput, approvalReceipt, approvalBinding, target,
  };
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1', 'input header mismatch');
  req(input.profile === 'pre-action-bundle-assembly-v0.1', 'input.profile mismatch');
  str(input.assembly_id, 'input.assembly_id');
  str(input.bundle_id, 'input.bundle_id');
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);

  const sources = deriveSources(input);
  const assembledAt = instant(input.assembled_at, 'input.assembled_at');
  req(assembledAt >= instant(sources.bridge.bridged_at, 'bridge.bridged_at'), 'assembled_at cannot precede bridge materialization');
  req(assembledAt >= instant(sources.approvalReceipt.issued_at, 'approval_receipt.issued_at'), 'assembled_at cannot precede approval receipt');
  req(assembledAt >= instant(sources.permit.issued_at, 'ActionPermit.issued_at'), 'assembled_at cannot precede ActionPermit');
  req(assembledAt < instant(sources.bridge.availability.evidence_valid_until, 'Execution Availability valid_until'), 'Execution Availability stale at assembly');
  req(assembledAt < instant(sources.bridge.availability.action_chain_valid_until, 'FCL Availability valid_until'), 'FCL action-chain Availability stale at assembly');
  req(assembledAt < instant(sources.approvalBinding.valid_until, 'Approval valid_until'), 'Approval expired at assembly');
  req(assembledAt < instant(sources.permit.payload.expires_at, 'ActionPermit expires_at'), 'ActionPermit expired at assembly');
  req(instant(threeWayHorizon(input), 'authorization horizon') > assembledAt, 'authorization horizon already expired');
  return true;
}

function buildBundle(input) {
  validateInput(input);
  const {
    bridge, mapping, executionAvailability, permit, coordinationInput, coordination,
    state, fclAvailability, intent, authority, approvalBinding, target,
  } = deriveSources(input);

  const bundle = {
    protocol: 'UU-AAP-PRE-ACTION-EVIDENCE-BUNDLE', version: '0.1', artifact_type: 'PreActionEvidenceBundle',
    bundle_id: input.bundle_id, assembled_at: input.assembled_at,
    subject: clone(state.subject),
    selection_binding: {
      selection_id: mapping.selection_id, content_hash: mapping.selection_content_hash,
      selected_capability_id: mapping.selected_capability_id, descriptor_id: mapping.selected_descriptor_id,
      descriptor_content_hash: mapping.selected_descriptor_content_hash, operation: mapping.selected_operation,
    },
    availability_binding: {
      binding_id: executionAvailability.binding_id, content_hash: executionAvailability.content_hash,
      observation_content_hash: executionAvailability.observation.content_hash,
      core_availability_claim_hash: executionAvailability.core_availability_claim.content_hash,
      status: executionAvailability.observation.status, valid_until: executionAvailability.observation.valid_until,
      frontier: executionAvailability.observation.frontier.revision,
    },
    target: {
      resource: target.resource, operation: target.operation,
      expected_predecessor_frontier: target.expected_predecessor_frontier,
      authority_scope: target.authority_scope, binding_hash: permit.payload.target_binding_hash,
    },
    approval_binding: clone(approvalBinding),
    core_receipts: {
      state: clone(state), availability: clone(fclAvailability), intent: clone(intent),
      authority_or_responsibility: clone(authority), coordination: clone(coordination), action_permit: clone(permit),
    },
    lifecycle_handoff: {
      protocol: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE', version: '0.1', next_phase: 'authorize',
      frontier: target.expected_predecessor_frontier, target_binding_hash: permit.payload.target_binding_hash,
      action_permit_hash: permit.content_hash, approval_hash: approvalBinding.content_hash,
      authorization_must_occur_by: threeWayHorizon(input), one_shot: true, permit_consumed: false,
    },
    assertions: {
      core_chain_valid: true, availability_fresh_at_assembly: true, approval_exactly_bound: true,
      target_exactly_bound: true, action_permit_preexists_bundle: true, evidence_complete_for_authorize_handoff: true,
    },
    non_effects: {
      intent_created_by_bundle: false, authority_created_by_bundle: false, approval_created_by_bundle: false,
      action_permit_created_by_bundle: false, action_performed: false, outcome_observed: false,
      authority_expanded: false, future_action_permission_created: false, general_authority_created: false,
      causality_proven: false, truth_certified: false, liability_established: false,
    },
    content_hash: '',
  };
  bundle.content_hash = sha256Object(bundle);
  try { validateBundle(bundle, evidenceContextForBridge(input.bridge_input), bridge); }
  catch (error) { throw new FCLPreActionBundleAssemblyError(`assembled bundle bridge-aware reusable validation failed: ${error.message}`); }
  return bundle;
}

function buildAssemblyReceiptUnchecked(input, bundle) {
  const sources = deriveSources(input);
  const receipt = {
    protocol: 'FCL', version: '0.1', receipt_type: 'FCLPreActionBundleAssemblyReceipt',
    assembly_id: input.assembly_id, bundle_id: bundle.bundle_id, bundle_content_hash: bundle.content_hash,
    bridge_id: sources.bridge.bridge_id, bridge_content_hash: sources.bridge.content_hash,
    reconciliation_fingerprint: sources.bridge.reconciliation_fingerprint,
    approval_id: sources.approvalReceipt.approval_id, approval_fingerprint: sources.approvalReceipt.fingerprint_sha256,
    approval_binding_hash: sources.approvalBinding.content_hash, action_permit_hash: sources.permit.content_hash,
    target_binding_hash: sources.permit.payload.target_binding_hash, frontier: sources.target.expected_predecessor_frontier,
    selected_operation: sources.bridge.selected_operation, target_operation: sources.bridge.target_operation,
    authority_scope: sources.target.authority_scope,
    freshness: {
      execution_availability_valid_until: sources.bridge.availability.evidence_valid_until,
      fcl_availability_valid_until: sources.bridge.availability.action_chain_valid_until,
      approval_valid_until: sources.approvalBinding.valid_until,
      action_permit_expires_at: sources.permit.payload.expires_at,
      authorization_must_occur_by: threeWayHorizon(input),
    },
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    next_safe_action: 'EVALUATE_PRE_ACTION_AUTHORIZE_ADMISSION', assembled_at: input.assembled_at, content_hash: '',
  };
  receipt.content_hash = receiptHash(receipt);
  return receipt;
}

function buildAssemblyReceipt(input, bundle = buildBundle(input)) {
  validateInput(input);
  const expectedBundle = buildBundle(input);
  req(same(bundle, expectedBundle), 'bundle is not exactly reproducible from supplied assembly input');
  const receipt = buildAssemblyReceiptUnchecked(input, bundle);
  validateAssemblyReceipt(receipt, input, bundle);
  return receipt;
}

function validateAssemblyReceipt(receipt, input = null, bundle = null) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'FCL' && receipt.version === '0.1', 'receipt header mismatch');
  req(receipt.receipt_type === 'FCLPreActionBundleAssemblyReceipt', 'receipt_type mismatch');
  for (const key of ['assembly_id','bundle_id','bridge_id','approval_id','frontier','selected_operation','target_operation','authority_scope','next_safe_action','assembled_at']) str(receipt[key], `receipt.${key}`);
  for (const key of ['bundle_content_hash','bridge_content_hash','reconciliation_fingerprint','approval_fingerprint','approval_binding_hash','action_permit_hash','target_binding_hash','content_hash']) str(receipt[key], `receipt.${key}`, HASH);
  exact(receipt.freshness, FRESHNESS_KEYS, 'receipt.freshness');
  for (const key of FRESHNESS_KEYS) instant(receipt.freshness[key], `receipt.freshness.${key}`);
  req(instant(receipt.freshness.action_permit_expires_at, 'receipt ActionPermit expiry') <= instant(receipt.freshness.fcl_availability_valid_until, 'receipt FCL availability'), 'receipt permit expiry exceeds FCL availability horizon');
  const three = earliest([
    receipt.freshness.execution_availability_valid_until,
    receipt.freshness.approval_valid_until,
    receipt.freshness.action_permit_expires_at,
  ]);
  const four = earliest([
    receipt.freshness.execution_availability_valid_until,
    receipt.freshness.fcl_availability_valid_until,
    receipt.freshness.approval_valid_until,
    receipt.freshness.action_permit_expires_at,
  ]);
  req(three === four, 'receipt derived horizon invariant mismatch');
  req(receipt.freshness.authorization_must_occur_by === three, 'receipt authorization horizon mismatch');
  exact(receipt.assertions, ASSERTION_KEYS, 'receipt.assertions');
  for (const key of ASSERTION_KEYS) req(receipt.assertions[key] === true, `receipt.assertions.${key} must be true`);
  exact(receipt.non_effects, NON_EFFECT_KEYS, 'receipt.non_effects');
  for (const key of NON_EFFECT_KEYS) req(receipt.non_effects[key] === false, `receipt.non_effects.${key} must be false`);
  req(receipt.next_safe_action === 'EVALUATE_PRE_ACTION_AUTHORIZE_ADMISSION', 'receipt.next_safe_action mismatch');
  req(receipt.content_hash === receiptHash(receipt), 'receipt content hash mismatch');
  if (input !== null) {
    validateInput(input);
    const expectedBundle = buildBundle(input);
    const expected = buildAssemblyReceiptUnchecked(input, expectedBundle);
    req(same(receipt, expected), 'assembly receipt is not exactly reproducible from supplied input');
    if (bundle !== null) req(same(bundle, expectedBundle), 'supplied bundle mismatch');
  }
  return true;
}

function assemble(input) {
  const bundle = buildBundle(input);
  return { bundle, assembly_receipt: buildAssemblyReceipt(input, bundle) };
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLPreActionBundleAssemblyError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write(
      'FCL PreAction Bundle Assembly v0.1 artifact-only CLI\n' +
      'Usage: pre-action-bundle-assembly.js validate|assemble|validate-receipt <json|->\n' +
      'No authorize/execute/probe/consume/interrupt/send command exists.\n'
    );
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','assemble','validate-receipt'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') { validateInput(value); process.stdout.write('VALID\n'); }
  else if (command === 'assemble') process.stdout.write(`${JSON.stringify(assemble(value), null, 2)}\n`);
  else { validateAssemblyReceipt(value); process.stdout.write('VALID\n'); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLPreActionBundleAssemblyError) {
      process.stderr.write(`FCL PreAction Bundle Assembly validation error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  ASSERTION_KEYS,
  FCLPreActionBundleAssemblyError,
  NON_EFFECT_KEYS,
  assemble,
  buildAssemblyReceipt,
  buildBundle,
  fourSourceMinimum,
  hashObject,
  threeWayHorizon,
  validateAssemblyReceipt,
  validateInput,
};
