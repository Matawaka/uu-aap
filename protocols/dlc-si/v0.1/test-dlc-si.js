'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { DLCSIError, buildReceipt, canonicalFingerprint, validateContention } = require('./dlc-si');
const ROOT = __dirname;
function load(name) { return JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    assert(error instanceof DLCSIError, `${label}: expected DLCSIError`);
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected error: ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}
function testUnresolved() {
  const input = load('unresolved.contention.json');
  assert.strictEqual(validateContention(input), true);
  const receipt = buildReceipt(input);
  assert.strictEqual(receipt.status, 'UNRESOLVED');
  assert.strictEqual(receipt.contest_visible, true);
  assert.strictEqual(receipt.selected_claim_id, null);
  assert.strictEqual(receipt.precedence_effective, false);
  assert.strictEqual(receipt.action_gate_candidate, false);
  assert.strictEqual(receipt.execution_admitted, false);
  assert.strictEqual(receipt.irreversible_conflict_frozen, true);
  assert.deepStrictEqual(receipt.preserved_claim_ids, ['claim-preserve-continuity', 'claim-protect-interface']);
  assert(receipt.safe_work_allowed.includes('collect_evidence'));
  assert(receipt.safe_work_allowed.includes('observe'));
  assert(/^sha256:[0-9a-f]{64}$/.test(receipt.fingerprint_sha256));
  assert.strictEqual(canonicalFingerprint(receipt), receipt.fingerprint_sha256);
}
function testArrivalOrderCannotSelectOrChangeIdentity() {
  const first = load('unresolved.contention.json'); const second = clone(first);
  second.claims.reverse(); second.source_conflict_refs.reverse(); second.safe_work.reverse(); second.proposed_resolution.revisit_triggers.reverse();
  const a = buildReceipt(first); const b = buildReceipt(second);
  assert.deepStrictEqual(a, b); assert.strictEqual(a.fingerprint_sha256, b.fingerprint_sha256); assert.strictEqual(a.selected_claim_id, null);
}
function testDeferredPreservesBoth() {
  const receipt = buildReceipt(load('deferred.contention.json'));
  assert.strictEqual(receipt.status, 'DEFERRED'); assert.strictEqual(receipt.selected_claim_id, null);
  assert.strictEqual(receipt.irreversible_conflict_frozen, true); assert.strictEqual(receipt.execution_admitted, false);
  assert.strictEqual(receipt.preserved_claim_ids.length, 2); assert(receipt.revisit_triggers.includes('resource_restoration'));
}
function testLiveTemporaryPrecedence() {
  const receipt = buildReceipt(load('temporary-precedence.contention.json'));
  assert.strictEqual(receipt.status, 'TEMPORARY_PRECEDENCE'); assert.strictEqual(receipt.selected_claim_id, 'claim-protect-interface');
  assert.strictEqual(receipt.former_selected_claim_id, null); assert.strictEqual(receipt.precedence_effective, true);
  assert.strictEqual(receipt.action_gate_candidate, true); assert.strictEqual(receipt.execution_admitted, false);
  assert.strictEqual(receipt.irreversible_conflict_frozen, false); assert.strictEqual(receipt.contest_visible, true);
  assert.deepStrictEqual(receipt.preserved_claim_ids, ['claim-preserve-continuity', 'claim-protect-interface']);
  assert(receipt.revisit_triggers.includes('lease_expiry'));
}
function testExpiredLeaseReopens() {
  const input = load('temporary-precedence.contention.json'); input.evaluated_at = input.proposed_resolution.lease.expires_at;
  const receipt = buildReceipt(input);
  assert.strictEqual(receipt.status, 'UNRESOLVED'); assert.strictEqual(receipt.selected_claim_id, null);
  assert.strictEqual(receipt.former_selected_claim_id, 'claim-protect-interface'); assert.strictEqual(receipt.precedence_effective, false);
  assert.strictEqual(receipt.action_gate_candidate, false); assert.strictEqual(receipt.execution_admitted, false);
  assert.strictEqual(receipt.irreversible_conflict_frozen, true); assert.deepStrictEqual(receipt.reopened_by, ['lease_expiry']);
  assert.strictEqual(receipt.preserved_claim_ids.length, 2);
}
function testFailClosedMutations() {
  const base = load('unresolved.contention.json');
  const capacity = clone(base); capacity.interface.output_capacity = 2;
  expectFailure('interface capacity cannot broaden first slice', () => validateContention(capacity), /output_capacity/);
  const firstWins = clone(base); firstWins.proposed_resolution.mode = 'TEMPORARY_PRECEDENCE'; firstWins.proposed_resolution.selected_claim_id = firstWins.claims[0].claim_id;
  expectFailure('interface or arrival order cannot create precedence without a bounded lease', () => validateContention(firstWins), /lease/);
  const missingClaim = load('temporary-precedence.contention.json'); missingClaim.proposed_resolution.selected_claim_id = 'claim-not-present';
  expectFailure('selected claim must exist', () => validateContention(missingClaim), /existing claim/);
  const unbounded = load('temporary-precedence.contention.json'); unbounded.proposed_resolution.lease.expires_at = unbounded.proposed_resolution.lease.starts_at;
  expectFailure('lease must be bounded', () => validateContention(unbounded), /expires_at/);
  const noExpiryTrigger = load('temporary-precedence.contention.json'); noExpiryTrigger.proposed_resolution.lease.revisit_triggers = noExpiryTrigger.proposed_resolution.lease.revisit_triggers.filter(value => value !== 'lease_expiry');
  expectFailure('lease expiry must revisit', () => validateContention(noExpiryTrigger), /lease_expiry/);
  const premature = load('temporary-precedence.contention.json'); premature.evaluated_at = '2026-08-27T09:00:00Z';
  expectFailure('future lease cannot be effective early', () => buildReceipt(premature), /not active/);
  const ordered = clone(base); ordered.conflict.claim_relation = 'ORDERED';
  expectFailure('first slice cannot silently order claims', () => validateContention(ordered), /INCOMPARABLE/);
  const extra = clone(base); extra.arrival_order = ['claim-preserve-continuity', 'claim-protect-interface'];
  expectFailure('arrival order is not an authority-bearing field', () => validateContention(extra), /keys mismatch/);
}
function run() {
  const tests = [testUnresolved, testArrivalOrderCannotSelectOrChangeIdentity, testDeferredPreservesBoth, testLiveTemporaryPrecedence, testExpiredLeaseReopens, testFailClosedMutations];
  for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }
  process.stdout.write(`PASS DLC-SI v0.1 conformance (${tests.length} groups)\n`);
}
run();
