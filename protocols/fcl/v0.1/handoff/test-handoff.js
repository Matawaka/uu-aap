'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { FCLHandoffError, buildHandoffReceipt, canonicalFingerprint, validateHandoff } = require('./handoff');

const ROOT = __dirname;
function load() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'successor.handoff.json'), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function refresh(value) { value.fingerprint_sha256 = ''; value.fingerprint_sha256 = canonicalFingerprint(value); return value; }
function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    assert(error instanceof FCLHandoffError, `${label}: expected FCLHandoffError, got ${error && error.name}`);
  }
  assert(failed, `${label}: expected failure`);
}

function testValidHandoffReceipt() {
  const input = load();
  assert.strictEqual(validateHandoff(input), true);
  const r = buildHandoffReceipt(input);
  assert.strictEqual(r.human_status, 'CONTINUED_ON_SUCCESSOR');
  assert.strictEqual(r.predecessor_terminal_preserved, true);
  assert.strictEqual(r.predecessor_terminal_visible, true);
  assert.strictEqual(r.successor_primary_display, true);
  assert.strictEqual(r.predecessor_resurrection_admitted, false);
  assert.strictEqual(r.predecessor_authority_reacquired, false);
  assert.strictEqual(r.authority_transferred_by_handoff, false);
  assert.strictEqual(r.execution_admitted, false);
  assert.strictEqual(r.authority_established, false);
  assert.strictEqual(r.hidden_reasoning_transferred, false);
  assert.strictEqual(r.next_safe_action, 'WAIT_FOR_SUCCESSOR_PROGRESS');
  assert.strictEqual(r.fingerprint_sha256, canonicalFingerprint(r));
}

function testPredecessorMustBeTerminalAndContinuable() {
  const a = load(); a.predecessor_delivery_assessment.terminal = false; refresh(a.predecessor_delivery_assessment);
  expectFailure('non-terminal delivery', () => validateHandoff(a), /must be terminal/);
  const b = load(); b.predecessor_delivery_assessment.continuation_available = false; refresh(b.predecessor_delivery_assessment);
  expectFailure('continuation unavailable', () => validateHandoff(b), /must expose continuation/);
}

function testDeliveredTerminalProjectionBinding() {
  const a = load(); a.predecessor_terminal_projection.current_phase = 'tampered'; refresh(a.predecessor_terminal_projection);
  expectFailure('projection differs from delivered display', () => validateHandoff(a), /must equal delivered terminal display/);
  const b = load(); b.predecessor_delivery_assessment.accepted_run_id = 'other-run'; refresh(b.predecessor_delivery_assessment);
  expectFailure('delivery identity mismatch', () => validateHandoff(b), /predecessor run_id mismatch/);
}

function testTerminalHeadBindsContinuation() {
  const a = load(); a.continuation_receipt.terminal_receipt_fingerprint = `sha256:${'c'.repeat(64)}`; refresh(a.continuation_receipt);
  expectFailure('terminal head mismatch', () => validateHandoff(a), /must bind predecessor projection head/);
}

function testPredecessorContinuationIdentityAndCheckpoint() {
  const a = load(); a.continuation_receipt.predecessor_run_id = 'different-predecessor'; refresh(a.continuation_receipt);
  expectFailure('continuation predecessor identity drift', () => validateHandoff(a), /predecessor_run_id mismatch/);
  const b = load(); b.continuation_receipt.intent_ref = 'intent:drift'; refresh(b.continuation_receipt);
  expectFailure('continuation intent drift', () => validateHandoff(b), /continuation intent drift/);
  const c = load(); c.continuation_receipt.last_checkpoint_ref = 'checkpoint:other'; refresh(c.continuation_receipt);
  expectFailure('continuation checkpoint drift', () => validateHandoff(c), /continuation checkpoint/);
}

function testFreshSuccessorIdentityAndEpoch() {
  const a = load();
  a.continuation_receipt.successor_run_id = a.continuation_receipt.predecessor_run_id;
  refresh(a.continuation_receipt);
  expectFailure('run id reuse', () => validateHandoff(a), /successor_run_id must differ/);
  const b = load();
  b.continuation_receipt.successor_run_epoch = b.continuation_receipt.predecessor_run_epoch;
  refresh(b.continuation_receipt);
  expectFailure('epoch not advanced', () => validateHandoff(b), /successor epoch must advance/);
}

function testSuccessorProjectionIdentityAndChain() {
  const a = load(); a.successor_projection.run_id = 'wrong-successor'; refresh(a.successor_projection);
  expectFailure('successor projection run mismatch', () => validateHandoff(a), /successor projection run_id mismatch/);
  const b = load(); b.successor_projection.intent_ref = 'intent:other'; refresh(b.successor_projection);
  expectFailure('successor projection intent drift', () => validateHandoff(b), /successor projection intent drift/);
  const c = load(); c.successor_projection.chain_id = c.predecessor_terminal_projection.chain_id; refresh(c.successor_projection);
  expectFailure('successor chain reuse', () => validateHandoff(c), /successor chain must be distinct/);
}

function testFirstSliceRequiresFreshNonTerminalProjection() {
  const a = load();
  a.successor_projection.terminal = true; a.successor_projection.continuation_available = true;
  a.successor_projection.human_status = 'CONTINUATION_AVAILABLE'; a.successor_projection.next_safe_action = 'CREATE_SUCCESSOR_RUN';
  refresh(a.successor_projection);
  expectFailure('successor cannot already be terminal', () => validateHandoff(a), /first successor projection must be non-terminal/);
  const b = load(); b.successor_projection.head_sequence = 1; b.successor_projection.chain_length = 2; refresh(b.successor_projection);
  expectFailure('successor starts after sequence zero', () => validateHandoff(b), /sequence 0/);
}

function testNoResurrectionAuthorityOrHiddenReasoningTransfer() {
  const a = load(); a.continuation_receipt.predecessor_resurrection_admitted = true; refresh(a.continuation_receipt);
  expectFailure('resurrection enabled', () => validateHandoff(a), /resurrection must remain false/);
  const b = load(); b.continuation_receipt.predecessor_authority_reacquired = true; refresh(b.continuation_receipt);
  expectFailure('authority reacquired', () => validateHandoff(b), /authority reacquisition must remain false/);
  const c = load(); c.continuation_receipt.transferable_hidden_reasoning = true; refresh(c.continuation_receipt);
  expectFailure('hidden reasoning transfer', () => validateHandoff(c), /transferable_hidden_reasoning must remain false/);
  const d = load(); d.successor_projection.authority_established = true; refresh(d.successor_projection);
  expectFailure('successor UI authority claim', () => validateHandoff(d), /authority_established must remain false/);
}

function testDisplayPredecessorBinding() {
  const a = load(); a.successor_display_predecessor_projection_fingerprint = `sha256:${'d'.repeat(64)}`;
  expectFailure('handoff display predecessor mismatch', () => validateHandoff(a), /display predecessor binding/);
}

function testCheckpointContinuityIntoSuccessor() {
  const a = load(); a.successor_projection.checkpoint_ref = 'checkpoint:wrong'; refresh(a.successor_projection);
  expectFailure('successor checkpoint mismatch', () => validateHandoff(a), /successor checkpoint/);
}

function testTemporalCausality() {
  const a = load(); a.handoff_at = '2026-08-27T17:10:01Z';
  expectFailure('handoff before continuation/successor', () => validateHandoff(a), /handoff cannot precede/);
  const b = load(); b.successor_projection.projected_at = '2026-08-27T17:10:01Z'; refresh(b.successor_projection);
  expectFailure('successor before continuation', () => validateHandoff(b), /successor projection cannot precede continuation/);
}

function testFingerprintIntegrity() {
  const a = load(); a.predecessor_terminal_projection.fingerprint_sha256 = `sha256:${'0'.repeat(64)}`;
  expectFailure('projection fingerprint mismatch', () => validateHandoff(a), /fingerprint_sha256 mismatch/);
  const b = load(); b.continuation_receipt.fingerprint_sha256 = `sha256:${'0'.repeat(64)}`;
  expectFailure('continuation fingerprint mismatch', () => validateHandoff(b), /fingerprint_sha256 mismatch/);
  const c = load(); c.predecessor_delivery_assessment.fingerprint_sha256 = `sha256:${'0'.repeat(64)}`;
  expectFailure('delivery fingerprint mismatch', () => validateHandoff(c), /fingerprint_sha256 mismatch/);
}

function testDeterministicReceiptAndNoActuatingCli() {
  const input = load();
  assert.deepStrictEqual(buildHandoffReceipt(input), buildHandoffReceipt(clone(input)));
  const script = path.join(ROOT, 'handoff.js');
  for (const command of ['resume','execute','send','switch','activate']) {
    const result = spawnSync(process.execPath, [script, command, path.join(ROOT, 'examples', 'successor.handoff.json')], {encoding:'utf8'});
    assert.notStrictEqual(result.status, 0, `${command} must not be accepted`);
    assert(/unsupported command/.test(result.stderr), `${command}: expected unsupported command`);
  }
}

function testOutputCannotCollapseRunBoundary() {
  const r = buildHandoffReceipt(load());
  assert.notStrictEqual(r.predecessor_run_id, r.successor_run_id);
  assert(r.successor_run_epoch > r.predecessor_run_epoch);
  assert.notStrictEqual(r.predecessor_chain_id, r.successor_chain_id);
  assert.strictEqual(r.intent_continuity_preserved, true);
  assert.strictEqual(r.checkpoint_continuity_preserved, true);
  assert.strictEqual(r.run_identity_reused, false);
  assert.strictEqual(r.successor_requires_fresh_authority, true);
}

function run() {
  const tests = [
    testValidHandoffReceipt,
    testPredecessorMustBeTerminalAndContinuable,
    testDeliveredTerminalProjectionBinding,
    testTerminalHeadBindsContinuation,
    testPredecessorContinuationIdentityAndCheckpoint,
    testFreshSuccessorIdentityAndEpoch,
    testSuccessorProjectionIdentityAndChain,
    testFirstSliceRequiresFreshNonTerminalProjection,
    testNoResurrectionAuthorityOrHiddenReasoningTransfer,
    testDisplayPredecessorBinding,
    testCheckpointContinuityIntoSuccessor,
    testTemporalCausality,
    testFingerprintIntegrity,
    testDeterministicReceiptAndNoActuatingCli,
    testOutputCannotCollapseRunBoundary
  ];
  for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }
  process.stdout.write(`PASS FCL Successor UI Handoff v0.1 conformance (${tests.length} groups)\n`);
}
run();
