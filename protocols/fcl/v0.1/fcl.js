'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class FCLError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FCLError';
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new FCLError(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(value, expectedKeys, label) {
  requireCondition(isObject(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch: expected ${expected.join(', ')}, got ${actual.join(', ')}`);
}

function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}

function assertNullableString(value, label) {
  if (value !== null) assertString(value, label);
}

function assertBoolean(value, label) {
  requireCondition(typeof value === 'boolean', `${label} must be boolean`);
}

function assertNonNegativeInteger(value, label) {
  requireCondition(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`);
}

function assertPositiveInteger(value, label) {
  requireCondition(Number.isInteger(value) && value > 0, `${label} must be a positive integer`);
}

function assertStringArray(value, label, { minItems = 0 } = {}) {
  requireCondition(Array.isArray(value), `${label} must be an array`);
  requireCondition(value.length >= minItems, `${label} requires at least ${minItems} item(s)`);
  value.forEach((item, index) => assertString(item, `${label}[${index}]`));
  requireCondition(new Set(value).size === value.length, `${label} must contain unique values`);
}

function isRfc3339(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const hour = Number(match[4]); const minute = Number(match[5]); const second = Number(match[6]);
  const offsetHour = match[7] === undefined ? 0 : Number(match[7]);
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

function parseInstant(value, label) {
  requireCondition(isRfc3339(value), `${label} must be RFC 3339 date-time`);
  const ms = Date.parse(value);
  requireCondition(Number.isFinite(ms), `${label} must be a valid instant`);
  return ms;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}
function canonicalFingerprint(receipt) {
  const projected = clone(receipt);
  projected.fingerprint_sha256 = '';
  const canonical = JSON.stringify(canonicalize(projected));
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
function sortedUnique(values) { return [...new Set(values)].sort(); }

const ID_PATTERN = /^[a-z][a-z0-9-]{2,95}$/;
const FINGERPRINT_PATTERN = /^sha256:[0-9a-f]{64}$/;
const PROGRESS_KINDS = ['INTENT_ACK', 'CHECKPOINT_COMMIT', 'TOOL_OBSERVATION', 'DEPENDENCY_WAIT', 'SUBRESULT_COMMIT'];
const OBSERVATION_KEYS = ['protocol', 'version', 'profile', 'run_id', 'run_epoch', 'intent_ref', 'lease', 'intent_acknowledged', 'current_phase', 'last_progress_at', 'progress_kind', 'waiting_on', 'next_observable_event', 'external_effect_authority', 'checkpoint_ref', 'evaluated_at'];

function validateRunObservation(observation) {
  assertExactKeys(observation, OBSERVATION_KEYS, 'observation');
  requireCondition(observation.protocol === 'FCL', 'protocol must be FCL');
  requireCondition(observation.version === '0.1', 'version must be 0.1');
  requireCondition(observation.profile === 'feedback-continuity-v0.1', 'profile mismatch');
  assertString(observation.run_id, 'run_id', ID_PATTERN);
  assertNonNegativeInteger(observation.run_epoch, 'run_epoch');
  assertString(observation.intent_ref, 'intent_ref');

  assertExactKeys(observation.lease, ['starts_at', 'stall_after_seconds', 'expires_at'], 'lease');
  const startsAt = parseInstant(observation.lease.starts_at, 'lease.starts_at');
  assertPositiveInteger(observation.lease.stall_after_seconds, 'lease.stall_after_seconds');
  const expiresAt = parseInstant(observation.lease.expires_at, 'lease.expires_at');
  requireCondition(expiresAt > startsAt, 'lease.expires_at must be after lease.starts_at');
  requireCondition(observation.lease.stall_after_seconds * 1000 < expiresAt - startsAt, 'lease.stall_after_seconds must be shorter than the total lease');

  assertBoolean(observation.intent_acknowledged, 'intent_acknowledged');
  assertString(observation.current_phase, 'current_phase');
  const lastProgressAt = parseInstant(observation.last_progress_at, 'last_progress_at');
  requireCondition(lastProgressAt >= startsAt, 'last_progress_at cannot precede lease.starts_at');
  requireCondition(lastProgressAt < expiresAt, 'last_progress_at cannot occur at or after lease expiry; use late-result handling instead');
  requireCondition(PROGRESS_KINDS.includes(observation.progress_kind), `progress_kind must be one of ${PROGRESS_KINDS.join(', ')}`);
  assertNullableString(observation.waiting_on, 'waiting_on');
  assertString(observation.next_observable_event, 'next_observable_event');
  assertBoolean(observation.external_effect_authority, 'external_effect_authority');
  assertNullableString(observation.checkpoint_ref, 'checkpoint_ref');
  const evaluatedAt = parseInstant(observation.evaluated_at, 'evaluated_at');
  requireCondition(evaluatedAt >= startsAt, 'evaluated_at cannot precede lease.starts_at');
  requireCondition(lastProgressAt <= evaluatedAt, 'last_progress_at cannot be in the future relative to evaluated_at');
  return true;
}

function deriveState(observation) {
  validateRunObservation(observation);
  const evaluatedAt = parseInstant(observation.evaluated_at, 'evaluated_at');
  const expiresAt = parseInstant(observation.lease.expires_at, 'lease.expires_at');
  const lastProgressAt = parseInstant(observation.last_progress_at, 'last_progress_at');
  if (evaluatedAt >= expiresAt) return 'TIMED_OUT_CLOSED';
  const ageSeconds = Math.floor((evaluatedAt - lastProgressAt) / 1000);
  if (ageSeconds >= observation.lease.stall_after_seconds) return 'SUSPECTED_STALL';
  return 'RUNNING';
}

function buildRunLivenessReceipt(observation) {
  validateRunObservation(observation);
  const state = deriveState(observation);
  const evaluatedAt = parseInstant(observation.evaluated_at, 'evaluated_at');
  const lastProgressAt = parseInstant(observation.last_progress_at, 'last_progress_at');
  const terminal = state === 'TIMED_OUT_CLOSED';
  const receipt = {
    protocol: 'FCL',
    version: '0.1',
    receipt_type: 'RunLivenessReceipt',
    run_id: observation.run_id,
    run_epoch: observation.run_epoch,
    intent_ref: observation.intent_ref,
    state,
    intent_acknowledged: observation.intent_acknowledged,
    current_phase: observation.current_phase,
    last_progress_at: observation.last_progress_at,
    last_progress_age_seconds: Math.floor((evaluatedAt - lastProgressAt) / 1000),
    progress_kind: observation.progress_kind,
    waiting_on: observation.waiting_on,
    next_observable_event: terminal ? 'successor run may be created from a validated ContinuationCapsule' : observation.next_observable_event,
    checkpoint_ref: observation.checkpoint_ref,
    lease_expires_at: observation.lease.expires_at,
    external_effect_authority: terminal ? false : observation.external_effect_authority,
    terminal,
    predecessor_resumable: false,
    continuation_available: terminal,
    next_safe_action: state === 'RUNNING' ? 'WAIT_FOR_NEXT_RECEIPT' : state === 'SUSPECTED_STALL' ? 'WAIT_OR_INTERRUPT' : 'CREATE_SUCCESSOR_RUN',
    evaluated_at: observation.evaluated_at,
    fingerprint_sha256: ''
  };
  receipt.fingerprint_sha256 = canonicalFingerprint(receipt);
  return receipt;
}

const CAPSULE_KEYS = ['protocol', 'version', 'capsule_type', 'predecessor', 'successor', 'intent_ref', 'last_checkpoint_ref', 'completed_refs', 'unresolved_work', 'constraints', 'non_effects', 'created_at'];
function validateContinuationCapsule(capsule) {
  assertExactKeys(capsule, CAPSULE_KEYS, 'capsule');
  requireCondition(capsule.protocol === 'FCL', 'protocol must be FCL');
  requireCondition(capsule.version === '0.1', 'version must be 0.1');
  requireCondition(capsule.capsule_type === 'ContinuationCapsule', 'capsule_type must be ContinuationCapsule');
  assertExactKeys(capsule.predecessor, ['run_id', 'run_epoch', 'terminal_state', 'terminal_receipt_fingerprint'], 'predecessor');
  assertString(capsule.predecessor.run_id, 'predecessor.run_id', ID_PATTERN);
  assertNonNegativeInteger(capsule.predecessor.run_epoch, 'predecessor.run_epoch');
  requireCondition(capsule.predecessor.terminal_state === 'TIMED_OUT_CLOSED', 'predecessor.terminal_state must be TIMED_OUT_CLOSED');
  assertString(capsule.predecessor.terminal_receipt_fingerprint, 'predecessor.terminal_receipt_fingerprint', FINGERPRINT_PATTERN);

  assertExactKeys(capsule.successor, ['run_id', 'run_epoch'], 'successor');
  assertString(capsule.successor.run_id, 'successor.run_id', ID_PATTERN);
  assertNonNegativeInteger(capsule.successor.run_epoch, 'successor.run_epoch');
  requireCondition(capsule.successor.run_id !== capsule.predecessor.run_id, 'successor.run_id must differ from the closed predecessor run_id');
  requireCondition(capsule.successor.run_epoch > capsule.predecessor.run_epoch, 'successor.run_epoch must be greater than predecessor.run_epoch');

  assertString(capsule.intent_ref, 'intent_ref');
  assertNullableString(capsule.last_checkpoint_ref, 'last_checkpoint_ref');
  assertStringArray(capsule.completed_refs, 'completed_refs');
  assertStringArray(capsule.unresolved_work, 'unresolved_work', { minItems: 1 });
  assertStringArray(capsule.constraints, 'constraints');
  assertStringArray(capsule.non_effects, 'non_effects');
  parseInstant(capsule.created_at, 'created_at');
  return true;
}

function buildContinuationReceipt(capsule) {
  validateContinuationCapsule(capsule);
  const receipt = {
    protocol: 'FCL',
    version: '0.1',
    receipt_type: 'ContinuationReceipt',
    predecessor_run_id: capsule.predecessor.run_id,
    predecessor_run_epoch: capsule.predecessor.run_epoch,
    predecessor_terminal_state: capsule.predecessor.terminal_state,
    terminal_receipt_fingerprint: capsule.predecessor.terminal_receipt_fingerprint,
    predecessor_resurrection_admitted: false,
    predecessor_authority_reacquired: false,
    successor_run_id: capsule.successor.run_id,
    successor_run_epoch: capsule.successor.run_epoch,
    successor_requires_fresh_authority: true,
    transferable_hidden_reasoning: false,
    intent_ref: capsule.intent_ref,
    last_checkpoint_ref: capsule.last_checkpoint_ref,
    completed_refs: sortedUnique(capsule.completed_refs),
    unresolved_work: sortedUnique(capsule.unresolved_work),
    constraints: sortedUnique(capsule.constraints),
    non_effects: sortedUnique(capsule.non_effects),
    status: 'SUCCESSOR_ADMISSIBLE',
    created_at: capsule.created_at,
    fingerprint_sha256: ''
  };
  receipt.fingerprint_sha256 = canonicalFingerprint(receipt);
  return receipt;
}

const LATE_RESULT_KEYS = ['protocol', 'version', 'envelope_type', 'source_run_id', 'source_run_epoch', 'current_run_epoch', 'source_terminal_state', 'arrived_at', 'result_ref', 'requests_user_visible_authoritative_reply', 'requests_external_effect'];
function validateLateResultEnvelope(envelope) {
  assertExactKeys(envelope, LATE_RESULT_KEYS, 'late_result');
  requireCondition(envelope.protocol === 'FCL', 'protocol must be FCL');
  requireCondition(envelope.version === '0.1', 'version must be 0.1');
  requireCondition(envelope.envelope_type === 'LateResultEnvelope', 'envelope_type must be LateResultEnvelope');
  assertString(envelope.source_run_id, 'source_run_id', ID_PATTERN);
  assertNonNegativeInteger(envelope.source_run_epoch, 'source_run_epoch');
  assertNonNegativeInteger(envelope.current_run_epoch, 'current_run_epoch');
  requireCondition(envelope.current_run_epoch >= envelope.source_run_epoch, 'current_run_epoch cannot be older than source_run_epoch');
  requireCondition(envelope.source_terminal_state === 'TIMED_OUT_CLOSED', 'first slice only assesses results from TIMED_OUT_CLOSED runs');
  parseInstant(envelope.arrived_at, 'arrived_at');
  assertString(envelope.result_ref, 'result_ref');
  assertBoolean(envelope.requests_user_visible_authoritative_reply, 'requests_user_visible_authoritative_reply');
  assertBoolean(envelope.requests_external_effect, 'requests_external_effect');
  return true;
}

function assessLateResult(envelope) {
  validateLateResultEnvelope(envelope);
  const staleEpoch = envelope.source_run_epoch < envelope.current_run_epoch;
  return {
    protocol: 'FCL',
    version: '0.1',
    disposition_type: 'LateResultDisposition',
    source_run_id: envelope.source_run_id,
    source_run_epoch: envelope.source_run_epoch,
    current_run_epoch: envelope.current_run_epoch,
    source_terminal_state: envelope.source_terminal_state,
    stale_epoch: staleEpoch,
    status: 'REJECTED_CLOSED_RUN',
    active_reply_admitted: false,
    external_effect_admitted: false,
    authority_reacquisition_admitted: false,
    retained_as_diagnostic: true,
    result_ref: envelope.result_ref,
    arrived_at: envelope.arrived_at
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); } catch (error) { throw new FCLError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  requireCondition(typeof inputPath === 'string' && inputPath.length > 0, 'input path is required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function printJson(value) { process.stdout.write(`${JSON.stringify(canonicalize(value), null, 2)}\n`); }
function helpText() {
  return [
    'FCL v0.1 read-only CLI',
    '',
    'Usage:',
    '  node fcl.js validate-run <run-observation.json|->',
    '  node fcl.js observe <run-observation.json|->',
    '  node fcl.js validate-continuation <continuation-capsule.json|->',
    '  node fcl.js continue <continuation-capsule.json|->',
    '  node fcl.js assess-result <late-result-envelope.json|->',
    '  node fcl.js help',
    '',
    'There is no execute or resume command. Closed Run Cannot Reacquire Authority.'
  ].join('\n');
}
function main(argv) {
  const [command, inputPath, ...extra] = argv;
  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    requireCondition(inputPath === undefined && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write(`${helpText()}\n`);
    return 0;
  }
  requireCondition(extra.length === 0, 'unexpected extra arguments');
  const allowed = ['validate-run', 'observe', 'validate-continuation', 'continue', 'assess-result'];
  requireCondition(allowed.includes(command), `unsupported command: ${command}`);
  requireCondition(inputPath !== undefined, `${command} requires an input path`);
  const input = readInput(inputPath);
  if (command === 'validate-run') {
    validateRunObservation(input);
    printJson({ protocol: 'FCL', version: '0.1', status: 'VALID', run_id: input.run_id, execution_admitted: false });
    return 0;
  }
  if (command === 'observe') {
    printJson(buildRunLivenessReceipt(input));
    return 0;
  }
  if (command === 'validate-continuation') {
    validateContinuationCapsule(input);
    printJson({ protocol: 'FCL', version: '0.1', status: 'VALID_CONTINUATION_CAPSULE', predecessor_resurrection_admitted: false });
    return 0;
  }
  if (command === 'continue') {
    printJson(buildContinuationReceipt(input));
    return 0;
  }
  printJson(assessLateResult(input));
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLError) {
      process.stderr.write(`FCL validation error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  FCLError,
  assessLateResult,
  buildContinuationReceipt,
  buildRunLivenessReceipt,
  canonicalFingerprint,
  canonicalize,
  deriveState,
  validateContinuationCapsule,
  validateLateResultEnvelope,
  validateRunObservation
};
