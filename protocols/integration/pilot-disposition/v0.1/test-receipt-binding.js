'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./pilot-disposition.js');
const Binding = require('./receipt-binding.js');

function read(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function reject(name, fn) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected rejection`);
  assert.match(error.message, /does not reproduce exact source disposition and admission predecessor/);
}

for (const name of [
  'examples/marketer-pessimist-defer.disposition.json',
  'examples/honest-hiring-defer.disposition.json'
]) {
  const input = read(name);
  const receipt = Runtime.deriveReceipt(input);
  assert.strictEqual(Binding.validateReceiptAgainstDisposition(input, receipt), receipt);

  reject(`${name}: source disposition hash substitution`, () => {
    const changed = clone(receipt);
    changed.source_disposition.disposition_hash = `sha256:${'1'.repeat(64)}`;
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
    Binding.validateReceiptAgainstDisposition(input, changed);
  });

  reject(`${name}: admission preflight hash substitution`, () => {
    const changed = clone(receipt);
    changed.admission_predecessor.preflight_receipt_hash = `sha256:${'2'.repeat(64)}`;
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
    Binding.validateReceiptAgainstDisposition(input, changed);
  });

  reject(`${name}: reviewer reference substitution`, () => {
    const changed = clone(receipt);
    changed.human_decision.reviewer_reference += ':changed';
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
    Binding.validateReceiptAgainstDisposition(input, changed);
  });

  reject(`${name}: changed input with predecessor receipt`, () => {
    const changedInput = clone(input);
    changedInput.decision.rationale += ' changed';
    Runtime.rehash(changedInput);
    Binding.validateReceiptAgainstDisposition(changedInput, receipt);
  });
}

console.log('UU_AAP_PRODUCT_PILOT_HUMAN_DISPOSITION_BINDING_PASS');
