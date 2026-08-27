'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  FCLRuntimeUIError,
  fingerprint: runtimeFingerprint,
  validateViewModel
} = require('../runtime-ui/runtime-ui.js');

class FCLControlRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FCLControlRequestError';
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new FCLControlRequestError(message);
}
function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
function canonicalFingerprint(value) {
  const projected = clone(value);
  projected.fingerprint_sha256 = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}
function assertExactKeys(value, expectedKeys, label) {
  requireCondition(isObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch`);
}
function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}
function assertNonNegativeInteger(value, label) {
  requireCondition(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`);
}
function parseInstant(value, label) {
  assertString(value, label);
  const instant = Date.parse(value);
  requireCondition(Number.isFinite(instant), `${label} must be a valid date-time`);
  return instant;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{2,95}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const REQUESTED_CONTROLS = ['REQUEST_INTERRUPT', 'REQUEST_SUCCESSOR'];
const HUMAN_EVENT_KINDS = ['POINTER_ACTIVATION', 'KEYBOARD_ACTIVATION', 'VOICE_ACTIVATION', 'ACCESSIBILITY_ACTIVATION'];
const INPUT_KEYS = [
  'protocol', 'version', 'profile', 'request_id', 'origin', 'source_view', 'source_view_fingerprint',
  'display_binding', 'requested_control', 'human_event', 'requested_at'
];
const DISPLAY_BINDING_KEYS = ['run_id', 'run_epoch', 'chain_id', 'intent_ref', 'display_state'];
const HUMAN_EVENT_KEYS = ['event_id', 'event_kind', 'target_control', 'occurred_at', 'human_initiated', 'passive_observation'];
const RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'request_id', 'source_view_fingerprint', 'source_adapter_id',
  'source_display_state', 'source_run_id', 'source_run_epoch', 'source_chain_id', 'intent_ref',
  'requested_control', 'request_semantics', 'human_event_id', 'human_event_kind', 'human_event_occurred_at',
  'source_rendered_at', 'requested_at', 'expressed_request_recorded', 'internal_intent_proven',
  'non_induced_intent_proven', 'request_requires_current_state_revalidation', 'request_requires_downstream_gate',
  'interrupt_completed', 'continuation_receipt_created', 'successor_run_created', 'runtime_state_transitioned',
  'progress_created', 'liveness_proven', 'action_permit_established', 'execution_admitted', 'authority_established',
  'hidden_reasoning_included', 'next_safe_action', 'fingerprint_sha256'
];

function validateSourceView(view) {
  try {
    validateViewModel(view);
  } catch (error) {
    if (error instanceof FCLRuntimeUIError) throw new FCLControlRequestError(`source_view invalid: ${error.message}`);
    throw error;
  }
  requireCondition(view.fingerprint_sha256 === runtimeFingerprint(view), 'source_view fingerprint mismatch');
  requireCondition(view.control_semantics === 'REQUEST_ONLY', 'source_view control_semantics must remain REQUEST_ONLY');
  requireCondition(view.control_executes_action === false, 'source_view control_executes_action must remain false');
  requireCondition(view.action_permit_established === false, 'source_view action_permit_established must remain false');
  requireCondition(view.execution_admitted === false, 'source_view execution_admitted must remain false');
  requireCondition(view.authority_established === false, 'source_view authority_established must remain false');
  return true;
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === 'FCL', 'input.protocol must be FCL');
  requireCondition(input.version === '0.1', 'input.version must be 0.1');
  requireCondition(input.profile === 'user-control-request-v0.1', 'input.profile mismatch');
  assertString(input.request_id, 'input.request_id', ID_PATTERN);

  assertExactKeys(input.origin, ['repository', 'revision', 'tree'], 'input.origin');
  requireCondition(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  assertString(input.origin.revision, 'input.origin.revision', SHA_PATTERN);
  assertString(input.origin.tree, 'input.origin.tree', SHA_PATTERN);

  requireCondition(isObject(input.source_view), 'input.source_view must be an object');
  validateSourceView(input.source_view);
  assertString(input.source_view_fingerprint, 'input.source_view_fingerprint', SHA256_PATTERN);
  requireCondition(input.source_view_fingerprint === input.source_view.fingerprint_sha256, 'input.source_view_fingerprint must bind source_view exactly');

  assertExactKeys(input.display_binding, DISPLAY_BINDING_KEYS, 'input.display_binding');
  assertString(input.display_binding.run_id, 'input.display_binding.run_id', ID_PATTERN);
  assertNonNegativeInteger(input.display_binding.run_epoch, 'input.display_binding.run_epoch');
  assertString(input.display_binding.chain_id, 'input.display_binding.chain_id', ID_PATTERN);
  assertString(input.display_binding.intent_ref, 'input.display_binding.intent_ref');
  requireCondition(
    ['ACTIVE', 'WAITING', 'STALL_SUSPECTED', 'CONTINUATION_AVAILABLE', 'CONTINUED_ON_SUCCESSOR'].includes(input.display_binding.display_state),
    'input.display_binding.display_state invalid'
  );
  const view = input.source_view;
  requireCondition(input.display_binding.run_id === view.displayed_run_id, 'display binding run_id drift');
  requireCondition(input.display_binding.run_epoch === view.displayed_run_epoch, 'display binding run_epoch drift');
  requireCondition(input.display_binding.chain_id === view.displayed_chain_id, 'display binding chain_id drift');
  requireCondition(input.display_binding.intent_ref === view.intent_ref, 'display binding intent_ref drift');
  requireCondition(input.display_binding.display_state === view.display_state, 'display binding display_state drift');

  requireCondition(REQUESTED_CONTROLS.includes(input.requested_control), 'input.requested_control must be an invokable request-only control');
  requireCondition(view.offered_control !== 'NONE', 'source_view offered_control NONE cannot be invoked');
  requireCondition(input.requested_control === view.offered_control, 'requested control must equal source_view.offered_control');
  if (input.requested_control === 'REQUEST_INTERRUPT') {
    requireCondition(view.display_state === 'STALL_SUSPECTED', 'REQUEST_INTERRUPT requires STALL_SUSPECTED source display');
    requireCondition(view.source_next_safe_action === 'WAIT_OR_INTERRUPT', 'REQUEST_INTERRUPT requires WAIT_OR_INTERRUPT source boundary');
  } else {
    requireCondition(view.display_state === 'CONTINUATION_AVAILABLE', 'REQUEST_SUCCESSOR requires CONTINUATION_AVAILABLE source display');
    requireCondition(view.source_next_safe_action === 'CREATE_SUCCESSOR_RUN', 'REQUEST_SUCCESSOR requires CREATE_SUCCESSOR_RUN source boundary');
    requireCondition(view.terminal_run_visible === true, 'REQUEST_SUCCESSOR requires visible terminal run evidence');
  }

  assertExactKeys(input.human_event, HUMAN_EVENT_KEYS, 'input.human_event');
  assertString(input.human_event.event_id, 'input.human_event.event_id', ID_PATTERN);
  requireCondition(HUMAN_EVENT_KINDS.includes(input.human_event.event_kind), 'input.human_event.event_kind is not explicit human activation');
  requireCondition(input.human_event.target_control === input.requested_control, 'human event target_control must equal requested_control');
  requireCondition(input.human_event.human_initiated === true, 'human event must be explicitly human_initiated');
  requireCondition(input.human_event.passive_observation === false, 'passive observation cannot create a control request');

  const renderedAt = parseInstant(view.rendered_at, 'source_view.rendered_at');
  const eventAt = parseInstant(input.human_event.occurred_at, 'input.human_event.occurred_at');
  const requestedAt = parseInstant(input.requested_at, 'input.requested_at');
  requireCondition(eventAt >= renderedAt, 'human event cannot precede source view rendering');
  requireCondition(requestedAt >= eventAt, 'requested_at cannot precede human event');
  return true;
}

function buildRequestReceipt(input) {
  validateInput(input);
  const view = input.source_view;
  const nextSafeAction = input.requested_control === 'REQUEST_INTERRUPT'
    ? 'EVALUATE_INTERRUPT_REQUEST'
    : 'EVALUATE_SUCCESSOR_REQUEST';
  const receipt = {
    protocol: 'FCL',
    version: '0.1',
    receipt_type: 'UserControlRequestReceipt',
    request_id: input.request_id,
    source_view_fingerprint: input.source_view_fingerprint,
    source_adapter_id: view.adapter_id,
    source_display_state: view.display_state,
    source_run_id: view.displayed_run_id,
    source_run_epoch: view.displayed_run_epoch,
    source_chain_id: view.displayed_chain_id,
    intent_ref: view.intent_ref,
    requested_control: input.requested_control,
    request_semantics: 'EXPLICIT_HUMAN_REQUEST_ONLY',
    human_event_id: input.human_event.event_id,
    human_event_kind: input.human_event.event_kind,
    human_event_occurred_at: input.human_event.occurred_at,
    source_rendered_at: view.rendered_at,
    requested_at: input.requested_at,
    expressed_request_recorded: true,
    internal_intent_proven: false,
    non_induced_intent_proven: false,
    request_requires_current_state_revalidation: true,
    request_requires_downstream_gate: true,
    interrupt_completed: false,
    continuation_receipt_created: false,
    successor_run_created: false,
    runtime_state_transitioned: false,
    progress_created: false,
    liveness_proven: false,
    action_permit_established: false,
    execution_admitted: false,
    authority_established: false,
    hidden_reasoning_included: false,
    next_safe_action: nextSafeAction,
    fingerprint_sha256: ''
  };
  receipt.fingerprint_sha256 = canonicalFingerprint(receipt);
  return receipt;
}

function validateRequestReceipt(receipt) {
  assertExactKeys(receipt, RECEIPT_KEYS, 'receipt');
  requireCondition(receipt.protocol === 'FCL' && receipt.version === '0.1' && receipt.receipt_type === 'UserControlRequestReceipt', 'receipt header mismatch');
  assertString(receipt.request_id, 'receipt.request_id', ID_PATTERN);
  assertString(receipt.source_view_fingerprint, 'receipt.source_view_fingerprint', SHA256_PATTERN);
  assertString(receipt.source_adapter_id, 'receipt.source_adapter_id', ID_PATTERN);
  requireCondition(['STALL_SUSPECTED', 'CONTINUATION_AVAILABLE'].includes(receipt.source_display_state), 'receipt source_display_state invalid for control request');
  assertString(receipt.source_run_id, 'receipt.source_run_id', ID_PATTERN);
  assertNonNegativeInteger(receipt.source_run_epoch, 'receipt.source_run_epoch');
  assertString(receipt.source_chain_id, 'receipt.source_chain_id', ID_PATTERN);
  assertString(receipt.intent_ref, 'receipt.intent_ref');
  requireCondition(REQUESTED_CONTROLS.includes(receipt.requested_control), 'receipt requested_control invalid');
  requireCondition(receipt.request_semantics === 'EXPLICIT_HUMAN_REQUEST_ONLY', 'receipt request_semantics must remain request-only');
  assertString(receipt.human_event_id, 'receipt.human_event_id', ID_PATTERN);
  requireCondition(HUMAN_EVENT_KINDS.includes(receipt.human_event_kind), 'receipt human_event_kind invalid');
  parseInstant(receipt.human_event_occurred_at, 'receipt.human_event_occurred_at');
  parseInstant(receipt.source_rendered_at, 'receipt.source_rendered_at');
  parseInstant(receipt.requested_at, 'receipt.requested_at');
  requireCondition(receipt.expressed_request_recorded === true, 'receipt must record explicit request event');
  requireCondition(receipt.internal_intent_proven === false, 'receipt cannot prove internal intent');
  requireCondition(receipt.non_induced_intent_proven === false, 'receipt cannot prove non-induced intent');
  requireCondition(receipt.request_requires_current_state_revalidation === true, 'receipt must require current-state revalidation');
  requireCondition(receipt.request_requires_downstream_gate === true, 'receipt must require downstream gate');
  [
    'interrupt_completed', 'continuation_receipt_created', 'successor_run_created', 'runtime_state_transitioned',
    'progress_created', 'liveness_proven', 'action_permit_established', 'execution_admitted',
    'authority_established', 'hidden_reasoning_included'
  ].forEach(key => requireCondition(receipt[key] === false, `receipt.${key} must remain false`));
  const expectedAction = receipt.requested_control === 'REQUEST_INTERRUPT' ? 'EVALUATE_INTERRUPT_REQUEST' : 'EVALUATE_SUCCESSOR_REQUEST';
  requireCondition(receipt.next_safe_action === expectedAction, 'receipt next_safe_action mismatch');
  if (receipt.requested_control === 'REQUEST_INTERRUPT') requireCondition(receipt.source_display_state === 'STALL_SUSPECTED', 'interrupt receipt source state mismatch');
  else requireCondition(receipt.source_display_state === 'CONTINUATION_AVAILABLE', 'successor receipt source state mismatch');
  assertString(receipt.fingerprint_sha256, 'receipt.fingerprint_sha256', SHA256_PATTERN);
  requireCondition(receipt.fingerprint_sha256 === canonicalFingerprint(receipt), 'receipt fingerprint mismatch');
  return true;
}

function parseInputText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); } catch (error) { throw new FCLControlRequestError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  requireCondition(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  return parseInputText(inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8'));
}
function printJson(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help', '--help', '-h'].includes(command)) {
    requireCondition(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('FCL User Control Request v0.1 read-only CLI\nUsage: control-request.js validate|receipt <input.json|->\nNo interrupt/resume/execute/send/switch/activate/create-successor/grant command exists.\n');
    return 0;
  }
  requireCondition(extra.length === 0, 'unexpected extra arguments');
  requireCondition(['validate', 'receipt'].includes(command), `unsupported command: ${command}`);
  requireCondition(inputPath !== undefined, `${command} requires an input path`);
  const input = readInput(inputPath);
  if (command === 'validate') {
    validateInput(input);
    printJson({
      protocol: 'FCL', version: '0.1', profile: 'user-control-request-v0.1', status: 'VALID',
      request_id: input.request_id, effect_completed: false, action_permit_established: false,
      execution_admitted: false, authority_established: false
    });
    return 0;
  }
  const receipt = buildRequestReceipt(input);
  validateRequestReceipt(receipt);
  printJson(receipt);
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLControlRequestError) {
      process.stderr.write(`FCL User Control Request validation error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  FCLControlRequestError,
  buildRequestReceipt,
  canonicalFingerprint,
  validateInput,
  validateRequestReceipt,
  validateSourceView
};
