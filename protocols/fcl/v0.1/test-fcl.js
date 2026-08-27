'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  FCLError,
  assessLateResult,
  buildContinuationReceipt,
  buildRunLivenessReceipt,
  canonicalFingerprint,
  validateContinuationCapsule,
  validateRunObservation
} = require('./fcl');

const ROOT = __dirname;
function load(name) { return JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    assert(error instanceof FCLError, `${label}: expected FCLError`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected error: ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function testLiveRunProducesObservableProgress() {
  const input = load('live.run.json');
  assert.strictEqual(validateRunObservation(input), true);
  const receipt = buildRunLivenessReceipt(input);
  assert.strictEqual(receipt.state, 'RUNNING');
  assert.strictEqual(receipt.terminal, false);
  assert.strictEqual(receipt.last_progress_age_seconds, 20);
  assert.strictEqual(receipt.next_safe_action, 'WAIT_FOR_NEXT_RECEIPT');
  assert.strictEqual(receipt.predecessor_resumable, false);
  assert(/^sha256:[0-9a-f]{64}$/.test(receipt.fingerprint_sha256));
  assert.strictEqual(canonicalFingerprint(receipt), receipt.fingerprint_sha256);
}

function testStallBecomesDistinctFromRunning() {
  const receipt = buildRunLivenessReceipt(load('stalled.run.json'));
  assert.strictEqual(receipt.state, 'SUSPECTED_STALL');
  assert.strictEqual(receipt.terminal, false);
  assert.strictEqual(receipt.last_progress_age_seconds, 90);
  assert.strictEqual(receipt.next_safe_action, 'WAIT_OR_INTERRUPT');
}

function testTimeoutIrreversiblyRevokesAuthority() {
  const input = load('timed-out.run.json');
  assert.strictEqual(input.external_effect_authority, true);
  const receipt = buildRunLivenessReceipt(input);
  assert.strictEqual(receipt.state, 'TIMED_OUT_CLOSED');
  assert.strictEqual(receipt.terminal, true);
  assert.strictEqual(receipt.external_effect_authority, false);
  assert.strictEqual(receipt.continuation_available, true);
  assert.strictEqual(receipt.predecessor_resumable, false);
  assert.strictEqual(receipt.next_safe_action, 'CREATE_SUCCESSOR_RUN');
}

function testLateProgressCannotResurrectExpiredLease() {
  const input = load('timed-out.run.json');
  input.last_progress_at = '2026-08-27T10:11:00Z';
  input.evaluated_at = '2026-08-27T10:11:01Z';
  expectFailure('progress after terminal lease cannot resurrect run', () => validateRunObservation(input), /lease expiry/);
}

function testFutureProgressIsRejected() {
  const input = load('live.run.json');
  input.last_progress_at = '2026-08-27T10:02:00Z';
  expectFailure('future progress cannot manufacture liveness', () => validateRunObservation(input), /future/);
}

function testSpinnerCannotMasqueradeAsProgress() {
  const input = load('live.run.json');
  input.progress_kind = 'SPINNER';
  expectFailure('spinner is not progress evidence', () => validateRunObservation(input), /progress_kind/);
}

function testContinuationCreatesNewEpochWithoutResurrection() {
  const capsule = load('continuation.capsule.json');
  assert.strictEqual(validateContinuationCapsule(capsule), true);
  const terminalReceipt = buildRunLivenessReceipt(load('timed-out.run.json'));
  assert.strictEqual(capsule.predecessor.terminal_receipt_fingerprint, terminalReceipt.fingerprint_sha256);
  const receipt = buildContinuationReceipt(capsule);
  assert.strictEqual(receipt.terminal_receipt_fingerprint, terminalReceipt.fingerprint_sha256);
  assert.strictEqual(receipt.status, 'SUCCESSOR_ADMISSIBLE');
  assert.strictEqual(receipt.predecessor_resurrection_admitted, false);
  assert.strictEqual(receipt.predecessor_authority_reacquired, false);
  assert.strictEqual(receipt.successor_requires_fresh_authority, true);
  assert.strictEqual(receipt.transferable_hidden_reasoning, false);
  assert.strictEqual(receipt.successor_run_epoch, 42);
}

function testContinuationCannotReuseClosedIdentityOrEpoch() {
  const sameId = load('continuation.capsule.json');
  sameId.successor.run_id = sameId.predecessor.run_id;
  expectFailure('successor cannot reuse predecessor run id', () => validateContinuationCapsule(sameId), /run_id must differ/);

  const sameEpoch = load('continuation.capsule.json');
  sameEpoch.successor.run_epoch = sameEpoch.predecessor.run_epoch;
  expectFailure('successor needs newer epoch', () => validateContinuationCapsule(sameEpoch), /greater than/);

  const notTerminal = load('continuation.capsule.json');
  notTerminal.predecessor.terminal_state = 'SUSPECTED_STALL';
  expectFailure('first slice continuation requires terminal closure', () => validateContinuationCapsule(notTerminal), /TIMED_OUT_CLOSED/);
}

function testLateBackendResultCannotReplyOrAct() {
  const disposition = assessLateResult(load('late-result.json'));
  assert.strictEqual(disposition.status, 'REJECTED_CLOSED_RUN');
  assert.strictEqual(disposition.stale_epoch, true);
  assert.strictEqual(disposition.active_reply_admitted, false);
  assert.strictEqual(disposition.external_effect_admitted, false);
  assert.strictEqual(disposition.authority_reacquisition_admitted, false);
  assert.strictEqual(disposition.retained_as_diagnostic, true);
}

function testClosedRunRejectsLateResultWithoutNewerEpoch() {
  const envelope = load('late-result.json');
  envelope.current_run_epoch = envelope.source_run_epoch;
  const disposition = assessLateResult(envelope);
  assert.strictEqual(disposition.stale_epoch, false);
  assert.strictEqual(disposition.status, 'REJECTED_CLOSED_RUN');
  assert.strictEqual(disposition.active_reply_admitted, false);
  assert.strictEqual(disposition.external_effect_admitted, false);
}

function testLateResultCannotTargetOlderCurrentEpoch() {
  const envelope = load('late-result.json');
  envelope.current_run_epoch = envelope.source_run_epoch - 1;
  expectFailure('late result cannot target an older epoch', () => assessLateResult(envelope), /cannot be older/);
}

function testCliHasNoResumeOrExecuteSurface() {
  const script = path.join(ROOT, 'fcl.js');
  for (const command of ['resume', 'execute']) {
    const result = childProcess.spawnSync(process.execPath, [script, command, path.join(ROOT, 'examples', 'timed-out.run.json')], { encoding: 'utf8' });
    assert.notStrictEqual(result.status, 0, `${command} must fail closed`);
    assert(/unsupported command/.test(result.stderr), `${command}: expected unsupported command error`);
  }
}

function testSetLikeCapsuleFieldsDoNotChangeReceiptIdentity() {
  const first = load('continuation.capsule.json');
  const second = clone(first);
  second.completed_refs.reverse();
  second.unresolved_work.reverse();
  second.constraints.reverse();
  second.non_effects.reverse();
  const a = buildContinuationReceipt(first);
  const b = buildContinuationReceipt(second);
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.fingerprint_sha256, b.fingerprint_sha256);
}

function run() {
  const tests = [
    testLiveRunProducesObservableProgress,
    testStallBecomesDistinctFromRunning,
    testTimeoutIrreversiblyRevokesAuthority,
    testLateProgressCannotResurrectExpiredLease,
    testFutureProgressIsRejected,
    testSpinnerCannotMasqueradeAsProgress,
    testContinuationCreatesNewEpochWithoutResurrection,
    testContinuationCannotReuseClosedIdentityOrEpoch,
    testLateBackendResultCannotReplyOrAct,
    testClosedRunRejectsLateResultWithoutNewerEpoch,
    testLateResultCannotTargetOlderCurrentEpoch,
    testCliHasNoResumeOrExecuteSurface,
    testSetLikeCapsuleFieldsDoNotChangeReceiptIdentity
  ];
  for (const test of tests) {
    test();
    process.stdout.write(`PASS ${test.name}\n`);
  }
  process.stdout.write(`PASS FCL v0.1 conformance (${tests.length} groups)\n`);
}

run();
