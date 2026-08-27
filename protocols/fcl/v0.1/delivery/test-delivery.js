'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { FCLDeliveryError, assessDelivery, canonicalFingerprint, validateProjection, validateTrace } = require('./delivery');

const ROOT = __dirname;
function load(name) { return JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    assert(error instanceof FCLDeliveryError, `${label}: expected FCLDeliveryError, got ${error && error.name}`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected error: ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}
function refreshProjection(projection) {
  projection.fingerprint_sha256 = '';
  projection.fingerprint_sha256 = canonicalFingerprint(projection);
  return projection;
}

function testLiveDeliveryProjection() {
  const trace = load('live.trace.json');
  assert.strictEqual(validateTrace(trace), true);
  const receipt = assessDelivery(trace);
  assert.strictEqual(receipt.human_status, 'WAITING');
  assert.strictEqual(receipt.accepted_head_sequence, 2);
  assert.strictEqual(receipt.display_update_count, 2);
  assert.strictEqual(receipt.delivery_creates_progress, false);
  assert.strictEqual(receipt.transport_events_prove_liveness, false);
  assert.strictEqual(receipt.authority_established, false);
  assert.strictEqual(receipt.execution_admitted, false);
  assert(/^sha256:[0-9a-f]{64}$/.test(receipt.fingerprint_sha256));
  assert.strictEqual(canonicalFingerprint(receipt), receipt.fingerprint_sha256);
}

function testDuplicateReconnectAndStaleAreNonProgress() {
  const receipt = assessDelivery(load('live.trace.json'));
  const bySeq = Object.fromEntries(receipt.dispositions.map(d => [d.delivery_sequence, d]));
  assert.strictEqual(bySeq[1].disposition, 'TRANSPORT_ONLY');
  assert.strictEqual(bySeq[2].disposition, 'TRANSPORT_ONLY');
  assert.strictEqual(bySeq[4].disposition, 'TRANSPORT_ONLY');
  assert.strictEqual(bySeq[5].disposition, 'IDEMPOTENT_REPLAY');
  assert.strictEqual(bySeq[6].disposition, 'DROPPED_STALE_PROJECTION');
  for (const seq of [1,2,4,5,6]) {
    assert.strictEqual(bySeq[seq].display_state_advanced, false);
    assert.strictEqual(bySeq[seq].new_progress_created_by_delivery, false);
  }
  assert.strictEqual(receipt.accepted_head_sequence, 2);
}

function testProjectionFingerprintAndFixedNonEffects() {
  const trace = load('live.trace.json');
  const projection = clone(trace.events[0].projection);
  assert.strictEqual(validateProjection(projection), true);
  const badFp = clone(projection); badFp.fingerprint_sha256 = `sha256:${'0'.repeat(64)}`;
  expectFailure('projection fingerprint mismatch', () => validateProjection(badFp), /fingerprint_sha256 mismatch/);
  const execution = clone(projection); execution.execution_admitted = true; refreshProjection(execution);
  expectFailure('delivery projection cannot admit execution', () => validateProjection(execution), /execution_admitted/);
  const authority = clone(projection); authority.authority_established = true; refreshProjection(authority);
  expectFailure('delivery projection cannot establish authority', () => validateProjection(authority), /authority_established/);
  const transportTruth = clone(projection); transportTruth.transport_delivery_proves_progress = true; refreshProjection(transportTruth);
  expectFailure('transport cannot prove progress', () => validateProjection(transportTruth), /transport_delivery_proves_progress/);
}

function testIdentityDriftRejected() {
  const fields = ['run_id', 'run_epoch', 'intent_ref', 'chain_id'];
  for (const field of fields) {
    const trace = load('live.trace.json');
    const p = trace.events[3].projection;
    if (field === 'run_epoch') p[field] += 1; else p[field] = `${p[field]}-drift`;
    refreshProjection(p);
    expectFailure(`${field} drift`, () => assessDelivery(trace), /identity drift/);
  }
}

function testNewerProjectionRequiresDisplayPredecessor() {
  const trace = load('live.trace.json');
  trace.events[3].display_predecessor_projection_fingerprint = null;
  expectFailure('newer projection predecessor binding', () => assessDelivery(trace), /must bind currently accepted projection fingerprint/);
}

function testSameHeadEquivocationFailsClosed() {
  const trace = load('live.trace.json');
  const p = trace.events[5].projection;
  p.current_phase = 'equivocating-phase';
  refreshProjection(p);
  expectFailure('same head different fingerprint', () => assessDelivery(trace), /same head_sequence with different projection fingerprint/);
}

function testTerminalMonotonicityAndReplay() {
  const trace = load('terminal.trace.json');
  const receipt = assessDelivery(trace);
  assert.strictEqual(receipt.terminal, true);
  assert.strictEqual(receipt.continuation_available, true);
  assert.strictEqual(receipt.human_status, 'CONTINUATION_AVAILABLE');
  assert.strictEqual(receipt.next_safe_action, 'CREATE_SUCCESSOR_RUN');
  assert.strictEqual(receipt.dispositions[5].disposition, 'IDEMPOTENT_REPLAY');
  assert.strictEqual(receipt.display_update_count, 3);

  const invalid = load('terminal.trace.json');
  const terminal = invalid.events[2].projection;
  const p = clone(terminal);
  p.head_sequence = 4; p.chain_length = 5; p.head_fingerprint = `sha256:${'4'.repeat(64)}`;
  p.human_status = 'ACTIVE'; p.last_confirmed_progress_at = '2026-08-27T16:12:00Z'; p.last_progress_age_seconds = 1;
  p.current_phase = 'impossible-resurrection'; p.waiting_on = null; p.next_observable_event = 'should not exist';
  p.next_safe_action = 'WAIT_FOR_NEXT_RECEIPT'; p.terminal = false; p.continuation_available = false; p.projected_at = '2026-08-27T16:12:01Z';
  refreshProjection(p);
  invalid.events.push({
    delivery_sequence: 6, event_kind: 'PROJECTION_DELIVERY', connection_generation: 1,
    received_at: '2026-08-27T16:12:02Z', transport_event_ref: 'terminal:6',
    display_predecessor_projection_fingerprint: terminal.fingerprint_sha256,
    transport_progress_claim: false, projection: p
  });
  invalid.assessed_at = '2026-08-27T16:12:03Z';
  expectFailure('terminal projection cannot be superseded', () => assessDelivery(invalid), /terminal projection cannot be superseded/);
}

function testTransportOnlyCannotCarryProgressOrProjection() {
  const heartbeatProjection = load('live.trace.json');
  heartbeatProjection.events[1].projection = clone(heartbeatProjection.events[0].projection);
  expectFailure('heartbeat carrying projection', () => validateTrace(heartbeatProjection), /transport-only event cannot carry a projection/);
  const ackClaim = load('live.trace.json');
  ackClaim.events[2].transport_progress_claim = true;
  expectFailure('transport progress claim', () => validateTrace(ackClaim), /transport_progress_claim must remain false/);
  const reconnectProjection = load('live.trace.json');
  reconnectProjection.events[4].projection = clone(reconnectProjection.events[3].projection);
  expectFailure('reconnect carrying projection', () => validateTrace(reconnectProjection), /RECONNECT cannot carry a projection/);
}

function testConnectionGenerationRequiresReconnect() {
  const trace = load('live.trace.json');
  trace.events[3].connection_generation = 1;
  expectFailure('generation increase without reconnect', () => validateTrace(trace), /changed without RECONNECT/);
  const reconnect = load('live.trace.json');
  reconnect.events[4].connection_generation = 2;
  expectFailure('reconnect skips generation', () => validateTrace(reconnect), /increment connection_generation by exactly one/);
}

function testDeliveryTimeCannotRegress() {
  const trace = load('live.trace.json');
  trace.events[2].received_at = '2026-08-27T15:59:59Z';
  expectFailure('delivery timestamp regression', () => validateTrace(trace), /received_at regressed/);
  const assessed = load('live.trace.json'); assessed.assessed_at = '2026-08-27T16:00:00Z';
  expectFailure('assessment before delivery', () => validateTrace(assessed), /cannot precede the last received event/);
}

function testReplayBindingCannotChange() {
  const trace = load('live.trace.json');
  trace.events[5].display_predecessor_projection_fingerprint = trace.events[3].projection.fingerprint_sha256;
  expectFailure('replay changes predecessor binding', () => assessDelivery(trace), /replay changed display predecessor binding/);
}

function testDeterministicAssessmentAndNoActuatingCli() {
  const trace = load('live.trace.json');
  assert.deepStrictEqual(assessDelivery(trace), assessDelivery(clone(trace)));
  const script = path.join(ROOT, 'delivery.js');
  for (const command of ['send', 'execute', 'resume', 'interrupt']) {
    const result = spawnSync(process.execPath, [script, command, path.join(ROOT, 'examples', 'live.trace.json')], { encoding: 'utf8' });
    assert.notStrictEqual(result.status, 0, `${command} must not be accepted`);
    assert(/unsupported command/.test(result.stderr), `${command}: expected unsupported command error`);
  }
}

function run() {
  const tests = [
    testLiveDeliveryProjection,
    testDuplicateReconnectAndStaleAreNonProgress,
    testProjectionFingerprintAndFixedNonEffects,
    testIdentityDriftRejected,
    testNewerProjectionRequiresDisplayPredecessor,
    testSameHeadEquivocationFailsClosed,
    testTerminalMonotonicityAndReplay,
    testTransportOnlyCannotCarryProgressOrProjection,
    testConnectionGenerationRequiresReconnect,
    testDeliveryTimeCannotRegress,
    testReplayBindingCannotChange,
    testDeterministicAssessmentAndNoActuatingCli
  ];
  for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }
  process.stdout.write(`PASS FCL Projection Delivery v0.1 conformance (${tests.length} groups)\n`);
}
run();
