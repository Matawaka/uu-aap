'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class FCLDeliveryError extends Error {
  constructor(message) { super(message); this.name = 'FCLDeliveryError'; }
}
function requireCondition(condition, message) { if (!condition) throw new FCLDeliveryError(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
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
function assertNullableString(value, label, pattern = null) { if (value !== null) assertString(value, label, pattern); }
function assertBoolean(value, label) { requireCondition(typeof value === 'boolean', `${label} must be boolean`); }
function assertNonNegativeInteger(value, label) { requireCondition(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`); }
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
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{2,95}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const PROJECTION_KEYS = [
  'protocol', 'version', 'receipt_type', 'chain_id', 'run_id', 'run_epoch', 'intent_ref',
  'chain_length', 'head_sequence', 'head_fingerprint', 'human_status', 'last_confirmed_progress_at',
  'last_progress_age_seconds', 'current_phase', 'waiting_on', 'next_observable_event', 'next_safe_action',
  'checkpoint_ref', 'terminal', 'continuation_available', 'execution_admitted', 'authority_established',
  'transport_delivery_proves_progress', 'private_reasoning_included', 'projected_at', 'fingerprint_sha256'
];
const TRACE_KEYS = ['protocol', 'version', 'profile', 'session_id', 'origin', 'events', 'assessed_at'];
const EVENT_KEYS = [
  'delivery_sequence', 'event_kind', 'connection_generation', 'received_at', 'transport_event_ref',
  'display_predecessor_projection_fingerprint', 'transport_progress_claim', 'projection'
];
const EVENT_KINDS = ['PROJECTION_DELIVERY', 'TRANSPORT_HEARTBEAT', 'TRANSPORT_ACK', 'RECONNECT'];
const HUMAN_STATUSES = ['ACTIVE', 'WAITING', 'STALL_SUSPECTED', 'CLOSED', 'CONTINUATION_AVAILABLE'];

function validateProjection(projection, label = 'projection') {
  assertExactKeys(projection, PROJECTION_KEYS, label);
  requireCondition(projection.protocol === 'FCL', `${label}.protocol must be FCL`);
  requireCondition(projection.version === '0.1', `${label}.version must be 0.1`);
  requireCondition(projection.receipt_type === 'ProgressProjectionReceipt', `${label}.receipt_type must be ProgressProjectionReceipt`);
  assertString(projection.chain_id, `${label}.chain_id`, ID_PATTERN);
  assertString(projection.run_id, `${label}.run_id`, ID_PATTERN);
  assertNonNegativeInteger(projection.run_epoch, `${label}.run_epoch`);
  assertString(projection.intent_ref, `${label}.intent_ref`);
  assertNonNegativeInteger(projection.head_sequence, `${label}.head_sequence`);
  requireCondition(Number.isInteger(projection.chain_length) && projection.chain_length >= 1, `${label}.chain_length must be a positive integer`);
  requireCondition(projection.chain_length === projection.head_sequence + 1, `${label}.chain_length must equal head_sequence + 1`);
  assertString(projection.head_fingerprint, `${label}.head_fingerprint`, SHA256_PATTERN);
  requireCondition(HUMAN_STATUSES.includes(projection.human_status), `${label}.human_status invalid`);
  const lastProgressAt = parseInstant(projection.last_confirmed_progress_at, `${label}.last_confirmed_progress_at`);
  assertNonNegativeInteger(projection.last_progress_age_seconds, `${label}.last_progress_age_seconds`);
  assertString(projection.current_phase, `${label}.current_phase`);
  assertNullableString(projection.waiting_on, `${label}.waiting_on`);
  assertString(projection.next_observable_event, `${label}.next_observable_event`);
  requireCondition(['WAIT_FOR_NEXT_RECEIPT', 'WAIT_OR_INTERRUPT', 'CREATE_SUCCESSOR_RUN'].includes(projection.next_safe_action), `${label}.next_safe_action invalid`);
  assertNullableString(projection.checkpoint_ref, `${label}.checkpoint_ref`);
  assertBoolean(projection.terminal, `${label}.terminal`);
  assertBoolean(projection.continuation_available, `${label}.continuation_available`);
  requireCondition(projection.execution_admitted === false, `${label}.execution_admitted must remain false`);
  requireCondition(projection.authority_established === false, `${label}.authority_established must remain false`);
  requireCondition(projection.transport_delivery_proves_progress === false, `${label}.transport_delivery_proves_progress must remain false`);
  requireCondition(projection.private_reasoning_included === false, `${label}.private_reasoning_included must remain false`);
  const projectedAt = parseInstant(projection.projected_at, `${label}.projected_at`);
  requireCondition(projectedAt >= lastProgressAt, `${label}.projected_at cannot precede last_confirmed_progress_at`);
  assertString(projection.fingerprint_sha256, `${label}.fingerprint_sha256`, SHA256_PATTERN);
  requireCondition(projection.fingerprint_sha256 === canonicalFingerprint(projection), `${label}.fingerprint_sha256 mismatch`);

  if (projection.terminal) {
    requireCondition(projection.continuation_available === true, `${label}: terminal projection must expose continuation_available=true`);
    requireCondition(projection.human_status === 'CONTINUATION_AVAILABLE', `${label}: terminal projection must be CONTINUATION_AVAILABLE`);
    requireCondition(projection.next_safe_action === 'CREATE_SUCCESSOR_RUN', `${label}: terminal projection must require CREATE_SUCCESSOR_RUN`);
  } else {
    requireCondition(projection.continuation_available === false, `${label}: non-terminal projection cannot expose continuation_available=true`);
    requireCondition(!['CLOSED', 'CONTINUATION_AVAILABLE'].includes(projection.human_status), `${label}: non-terminal projection cannot use terminal human_status`);
    if (projection.human_status === 'STALL_SUSPECTED') requireCondition(projection.next_safe_action === 'WAIT_OR_INTERRUPT', `${label}: stalled projection must use WAIT_OR_INTERRUPT`);
    else requireCondition(projection.next_safe_action === 'WAIT_FOR_NEXT_RECEIPT', `${label}: active/waiting projection must use WAIT_FOR_NEXT_RECEIPT`);
  }
  if (projection.human_status === 'ACTIVE') requireCondition(projection.waiting_on === null, `${label}: ACTIVE projection cannot declare waiting_on`);
  if (projection.human_status === 'WAITING') requireCondition(projection.waiting_on !== null, `${label}: WAITING projection must declare waiting_on`);
  return true;
}

function validateTrace(trace) {
  assertExactKeys(trace, TRACE_KEYS, 'trace');
  requireCondition(trace.protocol === 'FCL', 'trace.protocol must be FCL');
  requireCondition(trace.version === '0.1', 'trace.version must be 0.1');
  requireCondition(trace.profile === 'projection-delivery-v0.1', 'trace.profile mismatch');
  assertString(trace.session_id, 'trace.session_id', ID_PATTERN);
  assertExactKeys(trace.origin, ['repository', 'revision', 'tree'], 'trace.origin');
  requireCondition(trace.origin.repository === 'Matawaka/uu-aap', 'trace.origin.repository mismatch');
  assertString(trace.origin.revision, 'trace.origin.revision', SHA_PATTERN);
  assertString(trace.origin.tree, 'trace.origin.tree', SHA_PATTERN);
  requireCondition(Array.isArray(trace.events) && trace.events.length > 0, 'trace.events requires at least one event');
  const assessedAt = parseInstant(trace.assessed_at, 'trace.assessed_at');

  let currentGeneration = 0;
  let previousReceivedAt = null;
  let projectionCount = 0;
  trace.events.forEach((event, index) => {
    assertExactKeys(event, EVENT_KEYS, `events[${index}]`);
    assertNonNegativeInteger(event.delivery_sequence, `events[${index}].delivery_sequence`);
    requireCondition(event.delivery_sequence === index, `events[${index}].delivery_sequence must equal ${index}`);
    requireCondition(EVENT_KINDS.includes(event.event_kind), `events[${index}].event_kind invalid`);
    assertNonNegativeInteger(event.connection_generation, `events[${index}].connection_generation`);
    const receivedAt = parseInstant(event.received_at, `events[${index}].received_at`);
    if (previousReceivedAt !== null) requireCondition(receivedAt >= previousReceivedAt, `events[${index}].received_at regressed`);
    assertString(event.transport_event_ref, `events[${index}].transport_event_ref`);
    assertNullableString(event.display_predecessor_projection_fingerprint, `events[${index}].display_predecessor_projection_fingerprint`, SHA256_PATTERN);
    requireCondition(event.transport_progress_claim === false, `events[${index}].transport_progress_claim must remain false`);

    if (event.event_kind === 'RECONNECT') {
      requireCondition(event.connection_generation === currentGeneration + 1, `events[${index}]: RECONNECT must increment connection_generation by exactly one`);
      currentGeneration = event.connection_generation;
      requireCondition(event.projection === null, `events[${index}]: RECONNECT cannot carry a projection`);
      requireCondition(event.display_predecessor_projection_fingerprint === null, `events[${index}]: RECONNECT cannot carry display predecessor binding`);
    } else {
      requireCondition(event.connection_generation === currentGeneration, `events[${index}].connection_generation changed without RECONNECT`);
      if (event.event_kind === 'PROJECTION_DELIVERY') {
        requireCondition(isObject(event.projection), `events[${index}]: PROJECTION_DELIVERY requires projection`);
        validateProjection(event.projection, `events[${index}].projection`);
        projectionCount += 1;
      } else {
        requireCondition(event.projection === null, `events[${index}]: transport-only event cannot carry a projection`);
        requireCondition(event.display_predecessor_projection_fingerprint === null, `events[${index}]: transport-only event cannot carry display predecessor binding`);
      }
    }
    previousReceivedAt = receivedAt;
  });
  requireCondition(projectionCount > 0, 'trace requires at least one PROJECTION_DELIVERY event');
  requireCondition(assessedAt >= previousReceivedAt, 'trace.assessed_at cannot precede the last received event');
  return true;
}

function sameIdentity(a, b) {
  return a.chain_id === b.chain_id && a.run_id === b.run_id && a.run_epoch === b.run_epoch && a.intent_ref === b.intent_ref;
}

function assessDelivery(trace) {
  validateTrace(trace);
  let accepted = null;
  let acceptedPredecessor = null;
  let displayUpdateCount = 0;
  const seenPredecessors = new Map();
  const dispositions = [];

  for (const event of trace.events) {
    if (event.event_kind !== 'PROJECTION_DELIVERY') {
      dispositions.push({
        delivery_sequence: event.delivery_sequence,
        event_kind: event.event_kind,
        disposition: 'TRANSPORT_ONLY',
        projection_fingerprint: null,
        accepted_head_sequence_after: accepted === null ? null : accepted.head_sequence,
        accepted_projection_fingerprint_after: accepted === null ? null : accepted.fingerprint_sha256,
        display_state_advanced: false,
        new_progress_created_by_delivery: false,
        authority_established: false,
        execution_admitted: false
      });
      continue;
    }

    const projection = event.projection;
    const predecessor = event.display_predecessor_projection_fingerprint;
    if (accepted !== null) requireCondition(sameIdentity(projection, accepted), `events[${event.delivery_sequence}].projection identity drift within delivery session`);

    if (seenPredecessors.has(projection.fingerprint_sha256)) {
      requireCondition(seenPredecessors.get(projection.fingerprint_sha256) === predecessor, `events[${event.delivery_sequence}]: replay changed display predecessor binding`);
    } else {
      seenPredecessors.set(projection.fingerprint_sha256, predecessor);
    }

    let disposition;
    let advanced = false;
    if (accepted === null) {
      requireCondition(predecessor === null, `events[${event.delivery_sequence}]: first accepted projection must have null display predecessor`);
      accepted = projection;
      acceptedPredecessor = predecessor;
      disposition = 'ACCEPTED_NEWER_PROJECTION';
      advanced = true;
      displayUpdateCount += 1;
    } else if (projection.head_sequence < accepted.head_sequence) {
      disposition = 'DROPPED_STALE_PROJECTION';
    } else if (projection.head_sequence === accepted.head_sequence) {
      requireCondition(projection.fingerprint_sha256 === accepted.fingerprint_sha256, `events[${event.delivery_sequence}]: same head_sequence with different projection fingerprint`);
      disposition = 'IDEMPOTENT_REPLAY';
    } else {
      requireCondition(accepted.terminal === false, `events[${event.delivery_sequence}]: terminal projection cannot be superseded in the same delivery session`);
      requireCondition(predecessor === accepted.fingerprint_sha256, `events[${event.delivery_sequence}]: newer projection must bind currently accepted projection fingerprint`);
      requireCondition(projection.chain_length > accepted.chain_length, `events[${event.delivery_sequence}]: newer projection must increase chain_length`);
      requireCondition(parseInstant(projection.projected_at, `events[${event.delivery_sequence}].projection.projected_at`) >= parseInstant(accepted.projected_at, 'accepted.projected_at'), `events[${event.delivery_sequence}]: newer projection.projected_at regressed`);
      requireCondition(parseInstant(projection.last_confirmed_progress_at, `events[${event.delivery_sequence}].projection.last_confirmed_progress_at`) >= parseInstant(accepted.last_confirmed_progress_at, 'accepted.last_confirmed_progress_at'), `events[${event.delivery_sequence}]: newer projection last_confirmed_progress_at regressed`);
      accepted = projection;
      acceptedPredecessor = predecessor;
      disposition = 'ACCEPTED_NEWER_PROJECTION';
      advanced = true;
      displayUpdateCount += 1;
    }

    dispositions.push({
      delivery_sequence: event.delivery_sequence,
      event_kind: event.event_kind,
      disposition,
      projection_fingerprint: projection.fingerprint_sha256,
      accepted_head_sequence_after: accepted.head_sequence,
      accepted_projection_fingerprint_after: accepted.fingerprint_sha256,
      display_state_advanced: advanced,
      new_progress_created_by_delivery: false,
      authority_established: false,
      execution_admitted: false
    });
  }

  requireCondition(accepted !== null, 'delivery assessment requires an accepted projection');
  const receipt = {
    protocol: 'FCL',
    version: '0.1',
    receipt_type: 'ProjectionDeliveryAssessmentReceipt',
    session_id: trace.session_id,
    event_count: trace.events.length,
    display_update_count: displayUpdateCount,
    accepted_chain_id: accepted.chain_id,
    accepted_run_id: accepted.run_id,
    accepted_run_epoch: accepted.run_epoch,
    accepted_intent_ref: accepted.intent_ref,
    accepted_head_sequence: accepted.head_sequence,
    accepted_projection_fingerprint: accepted.fingerprint_sha256,
    accepted_display_predecessor_projection_fingerprint: acceptedPredecessor,
    human_status: accepted.human_status,
    last_confirmed_progress_at: accepted.last_confirmed_progress_at,
    current_phase: accepted.current_phase,
    waiting_on: accepted.waiting_on,
    next_observable_event: accepted.next_observable_event,
    next_safe_action: accepted.next_safe_action,
    terminal: accepted.terminal,
    continuation_available: accepted.continuation_available,
    dispositions,
    delivery_creates_progress: false,
    duplicate_delivery_counts_as_progress: false,
    reconnect_restores_authority: false,
    stale_projection_can_replace_display: false,
    transport_events_prove_liveness: false,
    execution_admitted: false,
    authority_established: false,
    private_reasoning_included: false,
    assessed_at: trace.assessed_at,
    fingerprint_sha256: ''
  };
  receipt.fingerprint_sha256 = canonicalFingerprint(receipt);
  return receipt;
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); } catch (error) { throw new FCLDeliveryError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  requireCondition(typeof inputPath === 'string' && inputPath.length > 0, 'input path is required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function printJson(value) { process.stdout.write(`${JSON.stringify(canonicalize(value), null, 2)}\n`); }
function helpText() {
  return [
    'FCL Projection Delivery v0.1 read-only CLI', '', 'Usage:',
    '  node delivery.js validate <projection-delivery-trace.json|->',
    '  node delivery.js assess <projection-delivery-trace.json|->',
    '  node delivery.js help', '',
    'No send, execute, resume, or interrupt command exists. Delivery Success != Progress.'
  ].join('\n');
}
function main(argv) {
  const [command, inputPath, ...extra] = argv;
  if (command === undefined || command === 'help' || command === '--help' || command === '-h') {
    requireCondition(inputPath === undefined && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write(`${helpText()}\n`); return 0;
  }
  requireCondition(extra.length === 0, 'unexpected extra arguments');
  requireCondition(['validate', 'assess'].includes(command), `unsupported command: ${command}`);
  requireCondition(inputPath !== undefined, `${command} requires an input path`);
  const trace = readInput(inputPath);
  if (command === 'validate') {
    validateTrace(trace);
    printJson({ protocol: 'FCL', version: '0.1', profile: 'projection-delivery-v0.1', status: 'VALID', session_id: trace.session_id, delivery_creates_progress: false, authority_established: false, execution_admitted: false });
    return 0;
  }
  printJson(assessDelivery(trace)); return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLDeliveryError) { process.stderr.write(`FCL Projection Delivery validation error: ${error.message}\n`); process.exitCode = 1; }
    else throw error;
  }
}

module.exports = { FCLDeliveryError, assessDelivery, canonicalFingerprint, canonicalize, validateProjection, validateTrace };
