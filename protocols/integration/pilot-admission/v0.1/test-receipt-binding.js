'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./pilot-admission.js');
const Binding = require('./receipt-binding.js');

function read(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function reject(name, fn) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected rejection`);
  assert.match(error.message, /does not reproduce exact source candidate/);
}

for (const name of [
  'examples/marketer-pessimist-real-non-personal.candidate.json',
  'examples/honest-hiring-real-personal.candidate.json'
]) {
  const candidate = read(name);
  const receipt = Runtime.deriveReceipt(candidate);
  assert.strictEqual(Binding.validateReceiptAgainstCandidate(candidate, receipt), receipt);

  reject(`${name}: source candidate hash substitution`, () => {
    const changed = clone(receipt);
    changed.source_candidate.candidate_hash = `sha256:${'1'.repeat(64)}`;
    Runtime.rehash(changed);
    Binding.validateReceiptAgainstCandidate(candidate, changed);
  });

  reject(`${name}: predecessor output substitution`, () => {
    const changed = clone(receipt);
    changed.product.predecessor_output_hash = `sha256:${'2'.repeat(64)}`;
    Runtime.rehash(changed);
    Binding.validateReceiptAgainstCandidate(candidate, changed);
  });

  reject(`${name}: self-consistent status substitution`, () => {
    const changed = clone(receipt);
    changed.pilot.status = 'PILOT_BOUNDARY_UNSATISFIED';
    changed.pilot.reason_codes = ['SUBSTITUTED_STATUS'];
    changed.next_safe_action = 'CORRECT_OR_NARROW_PILOT_CANDIDATE';
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
    Binding.validateReceiptAgainstCandidate(candidate, changed);
  });

  reject(`${name}: changed candidate with predecessor receipt`, () => {
    const changedCandidate = clone(candidate);
    changedCandidate.proposed_pilot.purpose += ' changed';
    Runtime.rehash(changedCandidate);
    Binding.validateReceiptAgainstCandidate(changedCandidate, receipt);
  });
}

console.log('UU_AAP_PRODUCT_PILOT_ADMISSION_RECEIPT_BINDING_PASS');
