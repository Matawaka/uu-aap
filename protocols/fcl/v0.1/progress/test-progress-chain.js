'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  FCLProgressError,
  buildProjection,
  canonicalFingerprint,
  validateProgressChain
} = require('./progress-chain');

const EXAMPLES = path.join(__dirname, 'examples');
function load(name) { return JSON.parse(fs.readFileSync(path.join(EXAMPLES, name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function rehash(receipt) { receipt.fingerprint_sha256 = canonicalFingerprint(receipt); return receipt; }
function expectFailure(label, fn, pattern = null) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    assert(error instanceof FCLProgressError, `${label}: expected FCLProgressError, got ${error.constructor && error.constructor.name}`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected error ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function testHumanFacingProjectionStates() {
  const cases = [
    ['active.chain.json', 'ACTIVE', 'WAIT_FOR_NEXT_RECEIPT'],
    ['waiting.chain.json', 'WAITING', 'WAIT_FOR_NEXT_RECEIPT'],
    ['stall.chain.json', 'STALL_SUSPECTED', 'WAIT_OR_INTERRUPT'],
    ['closed.chain.json', 'CONTINUATION_AVAILABLE', 'CREATE_SUCCESSOR_RUN']
  ];
  for (const [name, expectedStatus, expectedAction] of cases) {
    const chain = load(name);
    assert.strictEqual(validateProgressChain(chain), true);
    const projection = buildProjection(chain);
    assert.strictEqual(projection.human_status, expectedStatus, name);
    assert.strictEqual(projection.next_safe_action, expectedAction, name);
    assert.strictEqual(projection.execution_admitted, false, name);
    assert.strictEqual(projection.authority_established, false, name);
    assert.strictEqual(projection.transport_delivery_proves_progress, false, name);
    assert.strictEqual(projection.private_reasoning_included, false, name);
    assert.strictEqual(projection.fingerprint_sha256, canonicalFingerprint(projection), name);
  }
}

function testSequenceAndPredecessorContinuity() {
  const skipped = load('waiting.chain.json'); skipped.events[2].sequence = 3;
  expectFailure('skipped sequence', () => validateProgressChain(skipped), /sequence/);

  const duplicate = load('waiting.chain.json'); duplicate.events[2].sequence = 1;
  expectFailure('duplicate sequence', () => validateProgressChain(duplicate), /sequence/);

  const brokenLink = load('waiting.chain.json'); brokenLink.events[2].predecessor_fingerprint = `sha256:${'0'.repeat(64)}`;
  expectFailure('broken predecessor fingerprint', () => validateProgressChain(brokenLink), /predecessor_fingerprint mismatch/);

  const firstHasPredecessor = load('active.chain.json'); firstHasPredecessor.events[0].predecessor_fingerprint = firstHasPredecessor.events[0].receipt.fingerprint_sha256;
  expectFailure('first event cannot claim predecessor', () => validateProgressChain(firstHasPredecessor), /must be null/);
}

function testIdentityAndLeaseCannotDrift() {
  for (const [field, replacement, pattern] of [
    ['run_id', 'other-progress-run', /run_id drift/],
    ['run_epoch', 2, /run_epoch drift/],
    ['intent_ref', 'intent:other', /intent_ref drift/],
    ['lease_expires_at', '2026-08-27T15:11:00Z', /lease_expires_at drift/]
  ]) {
    const chain = load('waiting.chain.json');
    chain.events[2].receipt[field] = replacement;
    rehash(chain.events[2].receipt);
    chain.events[3].predecessor_fingerprint = chain.events[2].receipt.fingerprint_sha256;
    expectFailure(`${field} drift`, () => validateProgressChain(chain), pattern);
  }
}

function testTemporalRegressionAndFabricationRejected() {
  const progressRegression = load('waiting.chain.json');
  progressRegression.events[3].receipt.last_progress_at = '2026-08-27T15:01:30Z';
  progressRegression.events[3].receipt.last_progress_age_seconds = 110;
  rehash(progressRegression.events[3].receipt);
  expectFailure('last progress regression', () => validateProgressChain(progressRegression), /last_progress_at regressed/);

  const evalRegression = load('waiting.chain.json');
  evalRegression.events[3].receipt.evaluated_at = '2026-08-27T15:01:30Z';
  evalRegression.events[3].receipt.last_progress_at = '2026-08-27T15:01:30Z';
  evalRegression.events[3].receipt.last_progress_age_seconds = 0;
  rehash(evalRegression.events[3].receipt);
  expectFailure('evaluation regression', () => validateProgressChain(evalRegression), /regressed/);

  const ageLie = load('active.chain.json'); ageLie.events[1].receipt.last_progress_age_seconds += 1; rehash(ageLie.events[1].receipt);
  expectFailure('fabricated progress age', () => validateProgressChain(ageLie), /last_progress_age_seconds mismatch/);

  const runningAfterExpiry = load('active.chain.json');
  runningAfterExpiry.events[1].receipt.evaluated_at = runningAfterExpiry.events[1].receipt.lease_expires_at;
  runningAfterExpiry.events[1].receipt.last_progress_age_seconds = Math.floor((Date.parse(runningAfterExpiry.events[1].receipt.evaluated_at) - Date.parse(runningAfterExpiry.events[1].receipt.last_progress_at)) / 1000);
  rehash(runningAfterExpiry.events[1].receipt);
  expectFailure('non-terminal after lease expiry', () => validateProgressChain(runningAfterExpiry), /non-terminal receipt cannot be evaluated/);
}

function testFingerprintIntegrity() {
  const chain = load('active.chain.json');
  chain.events[1].receipt.current_phase = 'rewritten-without-rehash';
  expectFailure('receipt content rewrite', () => validateProgressChain(chain), /fingerprint_sha256 mismatch/);
}

function testCheckpointLineageIsAppendOnly() {
  const disappearance = load('waiting.chain.json');
  disappearance.events[3].committed_checkpoint_refs = [];
  disappearance.events[3].receipt.checkpoint_ref = null;
  rehash(disappearance.events[3].receipt);
  expectFailure('checkpoint disappeared', () => validateProgressChain(disappearance), /preserve prior checkpoint lineage/);

  const substitution = load('waiting.chain.json');
  substitution.events[3].committed_checkpoint_refs = ['checkpoint:demo:other'];
  substitution.events[3].receipt.checkpoint_ref = 'checkpoint:demo:other';
  rehash(substitution.events[3].receipt);
  expectFailure('checkpoint lineage rewritten', () => validateProgressChain(substitution), /preserve prior checkpoint lineage/);

  const mismatch = load('waiting.chain.json');
  mismatch.events[3].receipt.checkpoint_ref = 'checkpoint:demo:other';
  rehash(mismatch.events[3].receipt);
  expectFailure('receipt checkpoint differs from committed lineage', () => validateProgressChain(mismatch), /latest committed checkpoint/);
}

function testTerminalClosureIsMonotonic() {
  const chain = load('closed.chain.json');
  const extra = clone(chain.events[4]);
  extra.sequence = chain.events.length;
  extra.predecessor_fingerprint = chain.events[chain.events.length - 1].receipt.fingerprint_sha256;
  extra.receipt.state = 'RUNNING';
  extra.receipt.terminal = false;
  extra.receipt.continuation_available = false;
  extra.receipt.next_safe_action = 'WAIT_FOR_NEXT_RECEIPT';
  extra.receipt.evaluated_at = '2026-08-27T15:09:59Z';
  extra.receipt.last_progress_at = '2026-08-27T15:09:00Z';
  extra.receipt.last_progress_age_seconds = 59;
  rehash(extra.receipt);
  chain.events.push(extra);
  chain.projected_at = extra.receipt.evaluated_at;
  expectFailure('non-terminal follows terminal', () => validateProgressChain(chain), /cannot follow a terminal receipt/);

  const authority = load('closed.chain.json');
  const last = authority.events[authority.events.length - 1].receipt;
  last.external_effect_authority = true; rehash(last);
  expectFailure('terminal authority restored', () => validateProgressChain(authority), /terminal receipt cannot retain external-effect authority/);
}

function testProgressStreamCannotCreateAuthority() {
  const chain = load('active.chain.json');
  chain.events[0].receipt.external_effect_authority = false;
  rehash(chain.events[0].receipt);
  chain.events[1].predecessor_fingerprint = chain.events[0].receipt.fingerprint_sha256;
  chain.events[1].receipt.external_effect_authority = true;
  rehash(chain.events[1].receipt);
  expectFailure('progress stream authority expansion', () => validateProgressChain(chain), /external_effect_authority expanded/);

  const ack = load('active.chain.json');
  ack.events[1].receipt.intent_acknowledged = false; rehash(ack.events[1].receipt);
  expectFailure('intent acknowledgement regression', () => validateProgressChain(ack), /intent_acknowledged regressed/);
}

function testSpinnerAndTransportMetadataAreNotProgressEvidence() {
  const spinner = load('active.chain.json');
  spinner.events[1].receipt.progress_kind = 'SPINNER'; rehash(spinner.events[1].receipt);
  expectFailure('spinner is not progress', () => validateProgressChain(spinner), /progress_kind invalid/);

  const transport = load('active.chain.json');
  transport.events[1].provider_metadata = { provider: 'example', delivered: true };
  expectFailure('transport delivery is not progress proof', () => validateProgressChain(transport), /keys mismatch/);

  const providerReceipt = load('active.chain.json');
  providerReceipt.events[1].receipt.provider_ack = true;
  expectFailure('provider ack cannot extend liveness receipt', () => validateProgressChain(providerReceipt), /keys mismatch/);
}

function testProjectionIsDeterministicAndBounded() {
  const chain = load('stall.chain.json');
  const a = buildProjection(chain);
  const b = buildProjection(clone(chain));
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.head_fingerprint, chain.events[chain.events.length - 1].receipt.fingerprint_sha256);
  assert.strictEqual(a.chain_length, chain.events.length);
  assert.strictEqual(a.execution_admitted, false);
  assert.strictEqual(a.authority_established, false);
}

function run() {
  const tests = [
    testHumanFacingProjectionStates,
    testSequenceAndPredecessorContinuity,
    testIdentityAndLeaseCannotDrift,
    testTemporalRegressionAndFabricationRejected,
    testFingerprintIntegrity,
    testCheckpointLineageIsAppendOnly,
    testTerminalClosureIsMonotonic,
    testProgressStreamCannotCreateAuthority,
    testSpinnerAndTransportMetadataAreNotProgressEvidence,
    testProjectionIsDeterministicAndBounded
  ];
  for (const test of tests) {
    test();
    process.stdout.write(`PASS ${test.name}\n`);
  }
  process.stdout.write(`PASS FCL Progress Chain v0.1 conformance (${tests.length} groups)\n`);
}

run();
