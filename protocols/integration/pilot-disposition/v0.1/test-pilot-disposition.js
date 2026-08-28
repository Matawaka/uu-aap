'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./pilot-disposition.js');

function read(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function reject(name, fn, pattern = null) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected rejection`);
  if (pattern) assert.match(error.message, pattern, `${name}: unexpected error`);
}
function humanDecision(base, decision) {
  const changed = clone(base);
  changed.decision.decision_context = 'human_supplied';
  changed.decision.decision = decision;
  changed.decision.reviewer_reference = `opaque-reviewer:test-${decision.toLowerCase()}`;
  changed.decision.rationale = `Conformance-only human_supplied ${decision} assertion; no identity or authority verification.`;
  Runtime.rehash(changed);
  return changed;
}

const marketer = read('examples/marketer-pessimist-defer.disposition.json');
const hiring = read('examples/honest-hiring-defer.disposition.json');

for (const input of [marketer, hiring]) {
  Runtime.validateInput(input);
  const receipt = Runtime.deriveReceipt(input);
  const receipt2 = Runtime.deriveReceipt(clone(input));
  assert.deepStrictEqual(receipt2, receipt, 'receipt must be deterministic');
  assert.strictEqual(Runtime.validateReceipt(receipt), receipt);
  assert.strictEqual(receipt.human_decision.decision, 'DEFER');
  assert.strictEqual(receipt.disposition.status, 'HUMAN_REVIEW_DEFERRED');
  assert.strictEqual(receipt.claims.human_deferral_recorded, true);
  assert.strictEqual(receipt.claims.human_approval_recorded, false);
  assert.strictEqual(receipt.claims.pilot_permit_created, false);
  assert.strictEqual(receipt.claims.real_pilot_started, false);
  assert.strictEqual(receipt.claims.reviewer_identity_verified, false);
  assert.strictEqual(receipt.claims.reviewer_authority_verified, false);
}

const marketerApprove = Runtime.deriveReceipt(humanDecision(marketer, 'APPROVE'));
assert.strictEqual(marketerApprove.disposition.status, 'HUMAN_ADMISSION_APPROVED_PERMIT_NOT_CREATED');
assert.strictEqual(marketerApprove.claims.human_approval_recorded, true);
assert.strictEqual(marketerApprove.required_followup_gates.data_protection_review_required, false);
assert.strictEqual(marketerApprove.next_safe_action, 'SEPARATE_AUTHORITY_BOUND_PILOT_PERMIT_REVIEW_REQUIRED');
assert.strictEqual(marketerApprove.claims.pilot_permit_created, false);
assert.strictEqual(marketerApprove.claims.product_owner_authority_verified, false);

const hiringApprove = Runtime.deriveReceipt(humanDecision(hiring, 'APPROVE'));
assert.strictEqual(hiringApprove.disposition.status, 'PRODUCT_REVIEW_APPROVED_DATA_PROTECTION_STILL_REQUIRED');
assert.strictEqual(hiringApprove.required_followup_gates.data_protection_review_required, true);
assert.strictEqual(hiringApprove.required_followup_gates.participant_consent_required, true);
assert.strictEqual(hiringApprove.claims.data_protection_approved, false);
assert.strictEqual(hiringApprove.claims.participant_consent_recorded, false);
assert.strictEqual(hiringApprove.claims.pilot_permit_created, false);

for (const input of [marketer, hiring]) {
  const rejected = Runtime.deriveReceipt(humanDecision(input, 'REJECT'));
  assert.strictEqual(rejected.disposition.status, 'HUMAN_REVIEW_REJECTED');
  assert.strictEqual(rejected.claims.human_rejection_recorded, true);
  assert.strictEqual(rejected.next_safe_action, 'STOP_THIS_PILOT_CANDIDATE_WITHOUT_SANCTION');
  assert(rejected.non_effects.includes('Reject or Defer != Sanction or Global Prohibition'));
}

reject('synthetic approve forbidden', () => {
  const changed = clone(marketer);
  changed.decision.decision = 'APPROVE';
  Runtime.rehash(changed);
  Runtime.validateInput(changed);
}, /synthetic conformance fixtures may only record DEFER/);

reject('permit creation control forbidden', () => {
  const changed = clone(marketer);
  changed.controls.pilot_permit_creation_available = true;
  Runtime.rehash(changed);
  Runtime.validateInput(changed);
}, /pilot_permit_creation_available must remain false/);

reject('pilot start control forbidden', () => {
  const changed = clone(marketer);
  changed.controls.pilot_start_available = true;
  Runtime.rehash(changed);
  Runtime.validateInput(changed);
}, /pilot_start_available must remain false/);

reject('wrong expected product', () => {
  const changed = clone(marketer);
  changed.expected_product_id = 'honest-hiring';
  Runtime.rehash(changed);
  Runtime.validateInput(changed);
}, /expected product does not match candidate profile/);

reject('unknown input field', () => {
  const changed = clone(marketer);
  changed.extra = false;
  Runtime.validateInput(changed);
}, /keys mismatch/);

reject('approve unsatisfied upstream', () => {
  Runtime.expectedDisposition('APPROVE', 'PILOT_BOUNDARY_UNSATISFIED');
}, /cannot approve an unsatisfied pilot boundary/);

const marketerReceipt = Runtime.deriveReceipt(marketer);
for (const claim of Runtime.ALWAYS_FALSE_CLAIMS) {
  reject(`receipt overclaim ${claim}`, () => {
    const changed = clone(marketerReceipt);
    changed.claims[claim] = true;
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
  }, /must remain false|may not verify/);
}

reject('receipt status substitution', () => {
  const changed = clone(marketerReceipt);
  changed.disposition.status = 'HUMAN_REVIEW_REJECTED';
  changed.disposition.reason_codes = ['HUMAN_REJECT_RECORDED_WITHOUT_SANCTION'];
  changed.next_safe_action = 'STOP_THIS_PILOT_CANDIDATE_WITHOUT_SANCTION';
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /disposition status mismatch/);

reject('receipt reason substitution', () => {
  const changed = clone(marketerReceipt);
  changed.disposition.reason_codes = ['SUBSTITUTED_REASON'];
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /set mismatch/);

reject('receipt reviewer identity overclaim', () => {
  const changed = clone(marketerReceipt);
  changed.human_decision.reviewer_identity_verified = true;
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /may not verify reviewer identity/);

reject('receipt unknown claim', () => {
  const changed = clone(marketerReceipt);
  changed.claims.unknown_claim = false;
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /keys mismatch/);

console.log('UU_AAP_PRODUCT_PILOT_HUMAN_DISPOSITION_V0_1_PASS');
