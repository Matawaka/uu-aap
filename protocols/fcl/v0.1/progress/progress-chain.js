'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class FCLProgressError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FCLProgressError';
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new FCLProgressError(message);
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
  const instant = Date.parse(value);
  requireCondition(Number.isFinite(instant), `${label} must be a valid instant`);
  return instant;
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}
function canonicalFingerprint(value) {
  const projected = clone(value);
  projected.fingerprint_sha256 = '';
  const canonical = JSON.stringify(canonicalize(projected));
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{2,95}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PROGRESS_KINDS = ['INTENT_ACK', 'CHECKPOINT_COMMIT', 'TOOL_OBSERVATION', 'DEPENDENCY_WAIT', 'SUBRESULT_COMMIT'];
const STATES = ['RUNNING', 'SUSPECTED_STALL', 'TIMED_OUT_CLOSED'];
const RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'run_id', 'run_epoch', 'intent_ref', 'state',
  'intent_acknowledged', 'current_phase', 'last_progress_at', 'last_progress_age_seconds',
  'progress_kind', 'waiting_on', 'next_observable_event', 'checkpoint_ref', 'lease_expires_at',
  'external_effect_authority', 'terminal', 'predecessor_resumable', 'continuation_available',
  'next_safe_action', 'evaluated_at', 'fingerprint_sha256'
];
const EVENT_KEYS = ['sequence', 'predecessor_fingerprint', 'committed_checkpoint_refs', 'receipt'];
const CHAIN_KEYS = ['protocol', 'version', 'profile', 'chain_id', 'origin', 'events', 'projected_at'];

function validateLivenessReceipt(receipt, label = 'receipt') {
  assertExactKeys(receipt, RECEIPT_KEYS, label);
  requireCondition(receipt.protocol === 'FCL', `${label}.protocol must be FCL`);
  requireCondition(receipt.version === '0.1', `${label}.version must be 0.1`);
  requireCondition(receipt.receipt_type === 'RunLivenessReceipt', `${label}.receipt_type must be RunLivenessReceipt`);
  assertString(receipt.run_id, `${label}.run_id`, ID_PATTERN);
  assertNonNegativeInteger(receipt.run_epoch, `${label}.run_epoch`);
  assertString(receipt.intent_ref, `${label}.intent_ref`);
  requireCondition(STATES.includes(receipt.state), `${label}.state invalid`);
  assertBoolean(receipt.intent_acknowledged, `${label}.intent_acknowledged`);
  assertString(receipt.current_phase, `${label}.current_phase`);
  const lastProgressAt = parseInstant(receipt.last_progress_at, `${label}.last_progress_at`);
  assertNonNegativeInteger(receipt.last_progress_age_seconds, `${label}.last_progress_age_seconds`);
  requireCondition(PROGRESS_KINDS.includes(receipt.progress_kind), `${label}.progress_kind invalid`);
  assertNullableString(receipt.waiting_on, `${label}.waiting_on`);
  assertString(receipt.next_observable_event, `${label}.next_observable_event`);
  assertNullableString(receipt.checkpoint_ref, `${label}.checkpoint_ref`);
  const leaseExpiresAt = parseInstant(receipt.lease_expires_at, `${label}.lease_expires_at`);
  assertBoolean(receipt.external_effect_authority, `${label}.external_effect_authority`);
  assertBoolean(receipt.terminal, `${label}.terminal`);
  requireCondition(receipt.predecessor_resumable === false, `${label}.predecessor_resumable must remain false`);
  assertBoolean(receipt.continuation_available, `${label}.continuation_available`);
  assertString(receipt.next_safe_action, `${label}.next_safe_action`);
  const evaluatedAt = parseInstant(receipt.evaluated_at, `${label}.evaluated_at`);
  requireCondition(evaluatedAt >= lastProgressAt, `${label}.evaluated_at cannot precede last_progress_at`);
  requireCondition(receipt.last_progress_age_seconds === Math.floor((evaluatedAt - lastProgressAt) / 1000), `${label}.last_progress_age_seconds mismatch`);
  assertString(receipt.fingerprint_sha256, `${label}.fingerprint_sha256`, SHA256_PATTERN);

  const expectedTerminal = receipt.state === 'TIMED_OUT_CLOSED';
  requireCondition(receipt.terminal === expectedTerminal, `${label}.terminal inconsistent with state`);
  requireCondition(receipt.continuation_available === expectedTerminal, `${label}.continuation_available inconsistent with state`);
  if (expectedTerminal) {
    requireCondition(evaluatedAt >= leaseExpiresAt, `${label}: terminal receipt must be evaluated at or after lease expiry`);
    requireCondition(receipt.external_effect_authority === false, `${label}: terminal receipt cannot retain external-effect authority`);
    requireCondition(receipt.next_safe_action === 'CREATE_SUCCESSOR_RUN', `${label}: terminal receipt must require CREATE_SUCCESSOR_RUN`);
  } else if (receipt.state === 'SUSPECTED_STALL') {
    requireCondition(evaluatedAt < leaseExpiresAt, `${label}: non-terminal receipt cannot be evaluated at or after lease expiry`);
    requireCondition(receipt.next_safe_action === 'WAIT_OR_INTERRUPT', `${label}: stalled receipt must use WAIT_OR_INTERRUPT`);
  } else {
    requireCondition(evaluatedAt < leaseExpiresAt, `${label}: non-terminal receipt cannot be evaluated at or after lease expiry`);
    requireCondition(receipt.next_safe_action === 'WAIT_FOR_NEXT_RECEIPT', `${label}: running receipt must use WAIT_FOR_NEXT_RECEIPT`);
  }
  requireCondition(receipt.fingerprint_sha256 === canonicalFingerprint(receipt), `${label}.fingerprint_sha256 mismatch`);
  return true;
}

function isPrefix(prefix, full) {
  if (prefix.length > full.length) return false;
  return prefix.every((value, index) => value === full[index]);
}

function validateProgressChain(chain) {
  assertExactKeys(chain, CHAIN_KEYS, 'chain');
  requireCondition(chain.protocol === 'FCL', 'chain.protocol must be FCL');
  requireCondition(chain.version === '0.1', 'chain.version must be 0.1');
  requireCondition(chain.profile === 'progress-chain-v0.1', 'chain.profile mismatch');
  assertString(chain.chain_id, 'chain.chain_id', ID_PATTERN);
  assertExactKeys(chain.origin, ['repository', 'revision', 'tree'], 'chain.origin');
  requireCondition(chain.origin.repository === 'Matawaka/uu-aap', 'chain.origin.repository mismatch');
  assertString(chain.origin.revision, 'chain.origin.revision', SHA_PATTERN);
  assertString(chain.origin.tree, 'chain.origin.tree', SHA_PATTERN);
  requireCondition(Array.isArray(chain.events) && chain.events.length > 0, 'chain.events requires at least one event');
  parseInstant(chain.projected_at, 'chain.projected_at');

  let runId = null;
  let runEpoch = null;
  let intentRef = null;
  let previousReceipt = null;
  let previousCheckpoints = [];
  let terminalSeen = false;
  let leaseExpiresAt = null;
  let intentAcknowledged = null;
  let externalEffectAuthority = null;

  chain.events.forEach((event, index) => {
    assertExactKeys(event, EVENT_KEYS, `events[${index}]`);
    requireCondition(!terminalSeen, `events[${index}] cannot follow a terminal receipt`);
    assertNonNegativeInteger(event.sequence, `events[${index}].sequence`);
    requireCondition(event.sequence === index, `events[${index}].sequence must equal ${index}`);
    if (index === 0) {
      requireCondition(event.predecessor_fingerprint === null, 'events[0].predecessor_fingerprint must be null');
    } else {
      assertString(event.predecessor_fingerprint, `events[${index}].predecessor_fingerprint`, SHA256_PATTERN);
      requireCondition(event.predecessor_fingerprint === previousReceipt.fingerprint_sha256, `events[${index}].predecessor_fingerprint mismatch`);
    }
    assertStringArray(event.committed_checkpoint_refs, `events[${index}].committed_checkpoint_refs`);
    requireCondition(isPrefix(previousCheckpoints, event.committed_checkpoint_refs), `events[${index}].committed_checkpoint_refs must preserve prior checkpoint lineage`);

    validateLivenessReceipt(event.receipt, `events[${index}].receipt`);
    const receipt = event.receipt;
    const expectedCheckpoint = event.committed_checkpoint_refs.length === 0 ? null : event.committed_checkpoint_refs[event.committed_checkpoint_refs.length - 1];
    requireCondition(receipt.checkpoint_ref === expectedCheckpoint, `events[${index}].receipt.checkpoint_ref must equal the latest committed checkpoint`);

    if (index === 0) {
      runId = receipt.run_id;
      runEpoch = receipt.run_epoch;
      intentRef = receipt.intent_ref;
      leaseExpiresAt = receipt.lease_expires_at;
      intentAcknowledged = receipt.intent_acknowledged;
      externalEffectAuthority = receipt.external_effect_authority;
    } else {
      requireCondition(receipt.run_id === runId, `events[${index}].receipt.run_id drift`);
      requireCondition(receipt.run_epoch === runEpoch, `events[${index}].receipt.run_epoch drift`);
      requireCondition(receipt.intent_ref === intentRef, `events[${index}].receipt.intent_ref drift`);
      requireCondition(receipt.lease_expires_at === leaseExpiresAt, `events[${index}].receipt.lease_expires_at drift`);
      requireCondition(!(intentAcknowledged === true && receipt.intent_acknowledged === false), `events[${index}].receipt.intent_acknowledged regressed`);
      requireCondition(!(externalEffectAuthority === false && receipt.external_effect_authority === true), `events[${index}].receipt.external_effect_authority expanded through progress chain`);
      requireCondition(parseInstant(receipt.last_progress_at, `events[${index}].receipt.last_progress_at`) >= parseInstant(previousReceipt.last_progress_at, `events[${index - 1}].receipt.last_progress_at`), `events[${index}].receipt.last_progress_at regressed`);
      requireCondition(parseInstant(receipt.evaluated_at, `events[${index}].receipt.evaluated_at`) >= parseInstant(previousReceipt.evaluated_at, `events[${index - 1}].receipt.evaluated_at`), `events[${index}].receipt.evaluated_at regressed`);
    }

    if (receipt.terminal) terminalSeen = true;
    previousReceipt = receipt;
    intentAcknowledged = receipt.intent_acknowledged;
    externalEffectAuthority = receipt.external_effect_authority;
    previousCheckpoints = [...event.committed_checkpoint_refs];
  });

  const head = chain.events[chain.events.length - 1].receipt;
  requireCondition(parseInstant(chain.projected_at, 'chain.projected_at') >= parseInstant(head.evaluated_at, 'head.evaluated_at'), 'chain.projected_at cannot precede the head receipt');
  return true;
}

function humanStatus(head) {
  if (head.terminal) return head.continuation_available ? 'CONTINUATION_AVAILABLE' : 'CLOSED';
  if (head.state === 'SUSPECTED_STALL') return 'STALL_SUSPECTED';
  if (head.waiting_on !== null || head.progress_kind === 'DEPENDENCY_WAIT') return 'WAITING';
  return 'ACTIVE';
}

function buildProjection(chain) {
  validateProgressChain(chain);
  const headEvent = chain.events[chain.events.length - 1];
  const head = headEvent.receipt;
  const projection = {
    protocol: 'FCL',
    version: '0.1',
    receipt_type: 'ProgressProjectionReceipt',
    chain_id: chain.chain_id,
    run_id: head.run_id,
    run_epoch: head.run_epoch,
    intent_ref: head.intent_ref,
    chain_length: chain.events.length,
    head_sequence: headEvent.sequence,
    head_fingerprint: head.fingerprint_sha256,
    human_status: humanStatus(head),
    last_confirmed_progress_at: head.last_progress_at,
    last_progress_age_seconds: head.last_progress_age_seconds,
    current_phase: head.current_phase,
    waiting_on: head.waiting_on,
    next_observable_event: head.next_observable_event,
    next_safe_action: head.next_safe_action,
    checkpoint_ref: head.checkpoint_ref,
    terminal: head.terminal,
    continuation_available: head.continuation_available,
    execution_admitted: false,
    authority_established: false,
    transport_delivery_proves_progress: false,
    private_reasoning_included: false,
    projected_at: chain.projected_at,
    fingerprint_sha256: ''
  };
  projection.fingerprint_sha256 = canonicalFingerprint(projection);
  return projection;
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); } catch (error) { throw new FCLProgressError(`invalid JSON: ${error.message}`); }
}

function readInput(inputPath) {
  requireCondition(typeof inputPath === 'string' && inputPath.length > 0, 'input path is required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(canonicalize(value), null, 2)}\n`);
}

function helpText() {
  return [
    'FCL Progress Chain v0.1 read-only CLI',
    '',
    'Usage:',
    '  node progress-chain.js validate <progress-chain.json|->',
    '  node progress-chain.js project <progress-chain.json|->',
    '  node progress-chain.js help',
    '',
    'No execute, resume, interrupt or send command exists.',
    'Projection != Execution Authority.'
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
  requireCondition(['validate', 'project'].includes(command), `unsupported command: ${command}`);
  requireCondition(inputPath !== undefined, `${command} requires an input path`);
  const chain = readInput(inputPath);
  if (command === 'validate') {
    validateProgressChain(chain);
    printJson({ protocol: 'FCL', version: '0.1', status: 'VALID_PROGRESS_CHAIN', chain_id: chain.chain_id, execution_admitted: false, authority_established: false });
    return 0;
  }
  printJson(buildProjection(chain));
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLProgressError) {
      process.stderr.write(`FCL progress validation error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  FCLProgressError,
  buildProjection,
  canonicalFingerprint,
  canonicalize,
  validateLivenessReceipt,
  validateProgressChain
};
