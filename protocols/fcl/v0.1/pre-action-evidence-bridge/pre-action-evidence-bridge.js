#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  buildReceipt: buildReconciliationReceipt,
  normalizedEvidenceContext,
  validateInput: validateReconciliationInput,
  validateReceipt: validateReconciliationReceipt,
} = require('../pre-action-evidence-contract-reconciliation/pre-action-evidence-contract-reconciliation.js');
const {
  BRIDGE_PROFILE,
  sha256Object,
  validateBundle,
  validateEvidenceBridgeContext,
} = require('../../../integration/pre-action-evidence-bundle/v0.1/validate-pre-action-evidence-bundle.js');

class FCLPreActionEvidenceBridgeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FCLPreActionEvidenceBridgeError';
  }
}

const req = (condition, message) => {
  if (!condition) throw new FCLPreActionEvidenceBridgeError(message);
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
const instant = (value, label) => {
  str(value, label);
  const parsed = Date.parse(value);
  req(Number.isFinite(parsed), `${label} invalid date-time`);
  return parsed;
};
const same = (a, b) => canonical(a) === canonical(b);
const SHA40 = /^[0-9a-f]{40}$/;

const INPUT_KEYS = [
  'protocol','version','profile','bridge_id','origin',
  'reconciliation_input','reconciliation_receipt','bridged_at'
];
const RECORD_KEYS = [
  'profile','bridge_id','reconciliation_fingerprint','action_permit_hash','selected_operation','target_operation',
  'target_binding_hash','frontier','availability','projections','assertions','non_effects',
  'next_safe_action','bridged_at','content_hash'
];
const ASSERTION_KEYS = [
  'operation_mapping_exact','separate_availability_receipt_identities',
  'availability_provenance_exact','target_projection_exact',
  'source_receipts_preserved','no_semantic_relaxation'
];
const NON_EFFECT_KEYS = [
  'source_receipt_rewritten','core_receipt_created','intent_created','authority_created',
  'approval_created','action_permit_created','action_permit_consumed',
  'pre_action_bundle_created','authorize_admitted','execution_admitted','action_performed'
];

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (obj(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new FCLPreActionEvidenceBridgeError(`unsupported canonical JSON value type: ${typeof value}`);
}
function hashObject(value, excluded = new Set(['content_hash'])) {
  const projection = {};
  for (const [key, item] of Object.entries(value)) if (!excluded.has(key)) projection[key] = item;
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(projection),'utf8')).digest('hex')}`;
}
function targetProjection(resource, operation, frontier, authorityScope) {
  return {
    resource,
    operation,
    expected_predecessor_frontier: frontier,
    authority_scope: authorityScope,
  };
}
function targetProjectionHash(projection) {
  return sha256Object(projection, new Set());
}

function validateReconciliationSources(input) {
  try {
    validateReconciliationInput(input.reconciliation_input);
    validateReconciliationReceipt(input.reconciliation_receipt);
  } catch (error) {
    throw new FCLPreActionEvidenceBridgeError(`reconciliation source invalid: ${error.message}`);
  }
  const rebuilt = buildReconciliationReceipt(input.reconciliation_input);
  req(same(rebuilt, input.reconciliation_receipt), 'reconciliation receipt is not exactly reproducible from supplied reconciliation input');
  req(input.reconciliation_receipt.next_safe_action === 'PARAMETERIZE_PRE_ACTION_FCL_EVIDENCE_BRIDGE', 'reconciliation next_safe_action mismatch');
  return rebuilt;
}

function deriveSources(input) {
  validateReconciliationSources(input);
  const rInput = input.reconciliation_input;
  const r = input.reconciliation_receipt;
  const availability = rInput.execution_capability_availability;
  const permitInput = rInput.fcl_core_action_permit_binding_input;
  const permit = rInput.fcl_core_action_permit;
  const coordinationInput = permitInput.core_coordination_binding_input;
  const coordination = permitInput.core_coordination_receipt;
  const state = coordinationInput.core_state_receipt;
  const fclAvailability = coordinationInput.core_availability_claim;
  const intent = coordinationInput.core_intent_receipt;
  const authority = coordinationInput.core_authority_receipt;
  const target = permit.payload.target;

  req(r.compatibility.mapping_selected_operation_to_fcl_scope_exact === true, 'reconciliation must prove exact operation-to-scope mapping');
  req(r.compatibility.direct_preaction_bundle_contract_satisfied === false, 'bridge is only valid for the reconciled non-direct compatibility frontier');
  req(r.selected_operation !== target.operation, 'bridge must preserve selected-operation / FCL-target identifier distinction');
  req(r.fcl_scope === target.operation, 'reconciliation FCL scope mismatch with ActionPermit target operation');
  req(r.fcl_target === target.resource, 'reconciliation FCL target mismatch with ActionPermit target');
  req(r.target_binding_hash === permit.payload.target_binding_hash, 'reconciliation target binding mismatch with ActionPermit');
  req(r.frontier === target.expected_predecessor_frontier, 'reconciliation frontier mismatch with ActionPermit');

  const intentBinding = intent.payload && intent.payload.fcl_binding;
  req(obj(intentBinding), 'FCL IntentReceipt fcl_binding required');
  const intentProjection = targetProjection(
    intentBinding.required_target,
    intentBinding.required_scope,
    intent.frontier.revision,
    intentBinding.required_scope
  );
  req(targetProjectionHash(intentProjection) === permit.payload.target_binding_hash, 'IntentReceipt projected target binding mismatch');

  const authorityProjection = targetProjection(
    authority.assertions.authority_target,
    authority.assertions.authority_scope,
    authority.frontier.revision,
    authority.assertions.authority_scope
  );
  req(targetProjectionHash(authorityProjection) === permit.payload.target_binding_hash, 'AuthorityReceipt projected target binding mismatch');

  const coordinationProjection = targetProjection(
    coordination.assertions.coordination_target,
    coordination.assertions.coordination_scope,
    coordination.frontier.revision,
    coordination.assertions.coordination_scope
  );
  req(targetProjectionHash(coordinationProjection) === permit.payload.target_binding_hash, 'CoordinationReceipt projected target binding mismatch');

  const fclBinding = fclAvailability.payload && fclAvailability.payload.fcl_binding;
  req(obj(fclBinding), 'FCL AvailabilityClaim fcl_binding required');
  req(fclBinding.operation_scope === target.operation, 'FCL availability operation_scope mismatch');
  req(fclBinding.target === target.resource, 'FCL availability target mismatch');
  req(fclBinding.run_id === permit.payload.fcl_execution_context.run_id, 'FCL availability run_id mismatch');
  req(fclBinding.run_epoch === permit.payload.fcl_execution_context.run_epoch, 'FCL availability run_epoch mismatch');
  req(fclBinding.chain_id === permit.payload.fcl_execution_context.chain_id, 'FCL availability chain_id mismatch');

  req(availability.core_state_receipt.content_hash !== state.content_hash, 'generic/FCL StateReceipt identities must remain distinct');
  req(availability.core_availability_claim.content_hash !== fclAvailability.content_hash, 'generic/FCL AvailabilityClaim identities must remain distinct');

  return {
    rInput, r, availability, permitInput, permit, coordinationInput, coordination,
    state, fclAvailability, intent, authority, target,
    intentProjection, authorityProjection, coordinationProjection,
  };
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL', 'input.protocol mismatch');
  req(input.version === '0.1', 'input.version mismatch');
  req(input.profile === 'pre-action-evidence-bridge-v0.1', 'input.profile mismatch');
  str(input.bridge_id, 'input.bridge_id');
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);

  const sources = deriveSources(input);
  const bridgedAt = instant(input.bridged_at, 'input.bridged_at');
  req(bridgedAt >= instant(sources.r.reconciled_at, 'reconciliation.reconciled_at'), 'bridged_at cannot precede reconciliation');
  req(bridgedAt < instant(sources.r.execution_availability_valid_until, 'reconciliation.execution_availability_valid_until'), 'Execution Availability stale at bridge materialization');
  req(bridgedAt < instant(sources.r.fcl_availability_valid_until, 'reconciliation.fcl_availability_valid_until'), 'FCL availability stale at bridge materialization');
  req(bridgedAt < instant(sources.r.action_permit_expires_at, 'reconciliation.action_permit_expires_at'), 'ActionPermit expired at bridge materialization');
  return true;
}

function buildBridgeRecord(input) {
  validateInput(input);
  const {
    r, availability, permit, state, fclAvailability, intent, authority, coordination,
    target, intentProjection, authorityProjection, coordinationProjection,
  } = deriveSources(input);

  const record = {
    profile: BRIDGE_PROFILE,
    bridge_id: input.bridge_id,
    reconciliation_fingerprint: r.fingerprint_sha256,
    action_permit_hash: permit.content_hash,
    selected_operation: r.selected_operation,
    target_operation: target.operation,
    target_binding_hash: permit.payload.target_binding_hash,
    frontier: target.expected_predecessor_frontier,
    availability: {
      evidence_binding_content_hash: availability.content_hash,
      evidence_state_receipt_hash: availability.core_state_receipt.content_hash,
      evidence_availability_claim_hash: availability.core_availability_claim.content_hash,
      action_chain_state_receipt_hash: state.content_hash,
      action_chain_availability_claim_hash: fclAvailability.content_hash,
      selection_content_hash: rInputSelectionHash(input),
      descriptor_content_hash: r.selected_descriptor_content_hash,
      observation_content_hash: availability.observation.content_hash,
      evidence_valid_until: availability.observation.valid_until,
      action_chain_valid_until: fclAvailability.payload.valid_until,
    },
    projections: {
      intent: {
        source_receipt_hash: intent.content_hash,
        operation: intentProjection.operation,
        target_binding_hash: targetProjectionHash(intentProjection),
      },
      authority: {
        source_receipt_hash: authority.content_hash,
        authority_scope: authorityProjection.authority_scope,
        target_binding_hash: targetProjectionHash(authorityProjection),
      },
      coordination: {
        source_receipt_hash: coordination.content_hash,
        target_binding_hash: targetProjectionHash(coordinationProjection),
      },
    },
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    next_safe_action: 'ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE',
    bridged_at: input.bridged_at,
    content_hash: '',
  };
  record.content_hash = hashObject(record);
  validateBridgeRecord(record);
  return record;
}

function rInputSelectionHash(input) {
  return input.reconciliation_input.capability_mapping_receipt.selection_content_hash;
}

function validateBridgeRecord(record) {
  exact(record, RECORD_KEYS, 'record');
  try { validateEvidenceBridgeContext(record); }
  catch (error) { throw new FCLPreActionEvidenceBridgeError(`bridge record invalid: ${error.message}`); }
  req(record.content_hash === hashObject(record), 'bridge record content hash mismatch');
  return true;
}

function validateBoundBridgeRecord(record, input) {
  validateInput(input);
  validateBridgeRecord(record);
  const expected = buildBridgeRecord(input);
  req(same(record, expected), 'bridge record is not exactly reproducible from supplied bridge input');
  return true;
}

function evidenceContextForBridge(input) {
  validateInput(input);
  return normalizedEvidenceContext(input.reconciliation_input);
}

function validateBundleWithBridge(bundle, input) {
  validateInput(input);
  const bridge = buildBridgeRecord(input);
  const evidenceContext = normalizedEvidenceContext(input.reconciliation_input);
  try { return validateBundle(bundle, evidenceContext, bridge); }
  catch (error) { throw new FCLPreActionEvidenceBridgeError(`PreAction bundle invalid under FCL bridge: ${error.message}`); }
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLPreActionEvidenceBridgeError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write(
      'FCL PreAction Evidence Bridge v0.1 read-only CLI\n' +
      'Usage: pre-action-evidence-bridge.js validate|bridge|validate-record <json|->\n' +
      'No assemble/authorize/execute/probe/consume/interrupt/send command exists.\n'
    );
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','bridge','validate-record'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') {
    validateInput(value);
    process.stdout.write('VALID\n');
  } else if (command === 'bridge') {
    process.stdout.write(`${JSON.stringify(buildBridgeRecord(value), null, 2)}\n`);
  } else {
    validateBridgeRecord(value);
    process.stdout.write('VALID\n');
  }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLPreActionEvidenceBridgeError) {
      process.stderr.write(`FCL PreAction Evidence Bridge validation error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  ASSERTION_KEYS,
  FCLPreActionEvidenceBridgeError,
  NON_EFFECT_KEYS,
  buildBridgeRecord,
  canonical,
  evidenceContextForBridge,
  hashObject,
  targetProjection,
  targetProjectionHash,
  validateBoundBridgeRecord,
  validateBridgeRecord,
  validateBundleWithBridge,
  validateInput,
};
