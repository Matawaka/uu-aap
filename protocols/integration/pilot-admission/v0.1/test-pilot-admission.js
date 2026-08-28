'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./pilot-admission.js');

const base = __dirname;
function read(name) { return JSON.parse(fs.readFileSync(path.join(base, name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function rehash(value) { return Runtime.rehash(value); }
function reject(name, fn, pattern = null) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected rejection`);
  if (pattern) assert.match(error.message, pattern, `${name}: unexpected error`);
}

const marketer = read('examples/marketer-pessimist-real-non-personal.candidate.json');
const hiring = read('examples/honest-hiring-real-personal.candidate.json');

const marketerReceipt = Runtime.deriveReceipt(marketer);
const marketerReceipt2 = Runtime.deriveReceipt(clone(marketer));
assert.deepStrictEqual(marketerReceipt2, marketerReceipt, 'Marketer receipt must be deterministic');
assert.strictEqual(marketerReceipt.pilot.status, 'READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW');
assert.strictEqual(marketerReceipt.next_safe_action, 'HUMAN_PILOT_ADMISSION_REVIEW_REQUIRED');
assert.strictEqual(marketerReceipt.required_human_gates.data_protection_review_required, false);
assert.strictEqual(marketerReceipt.required_human_gates.participant_consent_required, false);
assert.strictEqual(marketerReceipt.product.predecessor_artifact_type, 'MarketerPessimistStressTestReceipt');
assert.strictEqual(marketerReceipt.product.local_mvp_revalidated, true);

const hiringReceipt = Runtime.deriveReceipt(hiring);
const hiringReceipt2 = Runtime.deriveReceipt(clone(hiring));
assert.deepStrictEqual(hiringReceipt2, hiringReceipt, 'Honest Hiring receipt must be deterministic');
assert.strictEqual(hiringReceipt.pilot.status, 'DATA_PROTECTION_REVIEW_REQUIRED');
assert.strictEqual(hiringReceipt.next_safe_action, 'DATA_PROTECTION_AND_HUMAN_PILOT_REVIEW_REQUIRED');
assert.strictEqual(hiringReceipt.required_human_gates.data_protection_review_required, true);
assert.strictEqual(hiringReceipt.required_human_gates.participant_consent_required, true);
assert.strictEqual(hiringReceipt.product.predecessor_artifact_type, 'HonestHiringLocalComparisonResult');
assert.strictEqual(hiringReceipt.product.local_mvp_revalidated, true);

for (const receipt of [marketerReceipt, hiringReceipt]) {
  assert.strictEqual(Runtime.validateReceipt(receipt), receipt);
  for (const key of Runtime.FALSE_CLAIMS) assert.strictEqual(receipt.claims[key], false, `${key} must remain false`);
  assert.strictEqual(receipt.claims.local_mvp_predecessor_revalidated, true);
  assert.strictEqual(receipt.claims.human_pilot_admission_required, true);
}

function boundaryMutation(name, baseInput, mutate, expectedStatus, expectedReason) {
  const changed = clone(baseInput);
  mutate(changed);
  rehash(changed);
  const receipt = Runtime.deriveReceipt(changed);
  assert.strictEqual(receipt.pilot.status, expectedStatus, `${name}: status mismatch`);
  if (expectedReason) assert(receipt.pilot.reason_codes.includes(expectedReason), `${name}: reason missing`);
  assert.strictEqual(receipt.claims.pilot_admitted, false);
  assert.strictEqual(receipt.claims.real_pilot_started, false);
}

boundaryMutation('sensitive_personal_data', hiring, x => { x.proposed_pilot.sensitive_personal_data_involved = true; }, 'PILOT_BOUNDARY_UNSATISFIED', 'SENSITIVE_PERSONAL_DATA_NOT_ADMITTED_IN_V0_1');
boundaryMutation('external_effect', marketer, x => { x.proposed_pilot.external_effect_requested = true; }, 'PILOT_BOUNDARY_UNSATISFIED', 'EXTERNAL_EFFECT_NOT_ADMITTED_IN_V0_1');
boundaryMutation('irreversible_effect', marketer, x => { x.proposed_pilot.irreversible_effect_requested = true; }, 'PILOT_BOUNDARY_UNSATISFIED', 'IRREVERSIBLE_EFFECT_NOT_ADMITTED_IN_V0_1');
boundaryMutation('real_world_decision', marketer, x => { x.proposed_pilot.real_world_decision_in_scope = true; }, 'PILOT_BOUNDARY_UNSATISFIED', 'REAL_WORLD_DECISION_NOT_ADMITTED_IN_V0_1');
boundaryMutation('network_required', marketer, x => { x.proposed_pilot.network_access_required = true; }, 'PILOT_BOUNDARY_UNSATISFIED', 'NETWORK_ACCESS_NOT_ADMITTED_IN_V0_1');
boundaryMutation('provider_required', marketer, x => { x.proposed_pilot.provider_invocation_required = true; }, 'PILOT_BOUNDARY_UNSATISFIED', 'PROVIDER_INVOCATION_NOT_ADMITTED_IN_V0_1');
boundaryMutation('account_mutation_required', marketer, x => { x.proposed_pilot.account_mutation_required = true; }, 'PILOT_BOUNDARY_UNSATISFIED', 'ACCOUNT_MUTATION_NOT_ADMITTED_IN_V0_1');
boundaryMutation('correction_missing', marketer, x => { x.proposed_pilot.correction_supported = false; }, 'PILOT_BOUNDARY_UNSATISFIED', 'CORRECTION_BOUNDARY_REQUIRED');
boundaryMutation('deletion_missing', marketer, x => { x.proposed_pilot.deletion_supported = false; }, 'PILOT_BOUNDARY_UNSATISFIED', 'DELETION_BOUNDARY_REQUIRED');
boundaryMutation('human_review_missing', marketer, x => { x.requested_reviews.human_product_owner_review_required = false; }, 'PILOT_BOUNDARY_UNSATISFIED', 'HUMAN_PRODUCT_OWNER_REVIEW_REQUIRED');
boundaryMutation('data_protection_request_missing', hiring, x => { x.requested_reviews.data_protection_review_requested = false; }, 'PILOT_BOUNDARY_UNSATISFIED', 'DATA_PROTECTION_REVIEW_REQUEST_REQUIRED');
boundaryMutation('consent_boundary_missing', hiring, x => { x.requested_reviews.participant_consent_boundary_required = false; }, 'PILOT_BOUNDARY_UNSATISFIED', 'PARTICIPANT_CONSENT_BOUNDARY_REQUIRED');
boundaryMutation('nonpersonal_profile_becomes_personal', marketer, x => {
  x.proposed_pilot.data_mode = 'real_personal';
  x.proposed_pilot.personal_data_involved = true;
  x.proposed_pilot.participant_opt_in_required = true;
  x.requested_reviews.data_protection_review_requested = true;
  x.requested_reviews.participant_consent_boundary_required = true;
}, 'DATA_PROTECTION_REVIEW_REQUIRED', 'REAL_PERSONAL_DATA_REQUIRES_SEPARATE_DATA_PROTECTION_REVIEW');

reject('wrong_product_contract', () => {
  const changed = clone(marketer);
  changed.product.product_contract_hash = `sha256:${'0'.repeat(64)}`;
  rehash(changed);
  Runtime.validateInput(changed);
}, /contract hash mismatch/);
reject('local_mvp_source_substitution', () => {
  const changed = clone(marketer);
  changed.product.local_mvp_source_path = hiring.product.local_mvp_source_path;
  rehash(changed);
  Runtime.validateInput(changed);
}, /local MVP source path mismatch/);
reject('unknown_product', () => {
  const changed = clone(marketer);
  changed.product.product_id = 'unknown-product';
  rehash(changed);
  Runtime.validateInput(changed);
}, /unsupported product pilot profile/);
reject('pilot_start_control', () => {
  const changed = clone(marketer);
  changed.controls.pilot_start_available = true;
  rehash(changed);
  Runtime.validateInput(changed);
}, /pilot_start_available must remain false/);
reject('unknown_input_field', () => {
  const changed = clone(marketer);
  changed.extra = true;
  Runtime.validateInput(changed);
}, /keys mismatch/);

for (const claim of Runtime.FALSE_CLAIMS) {
  reject(`receipt_overclaim_${claim}`, () => {
    const changed = clone(marketerReceipt);
    changed.claims[claim] = true;
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
  }, /must remain false/);
}
reject('receipt_unknown_claim', () => {
  const changed = clone(marketerReceipt);
  changed.claims.unknown_claim = false;
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /keys mismatch/);
reject('receipt_next_action_substitution', () => {
  const changed = clone(marketerReceipt);
  changed.next_safe_action = 'DATA_PROTECTION_AND_HUMAN_PILOT_REVIEW_REQUIRED';
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /next_safe_action mismatch/);

console.log('UU_AAP_PRODUCT_PILOT_ADMISSION_V0_1_PASS');
