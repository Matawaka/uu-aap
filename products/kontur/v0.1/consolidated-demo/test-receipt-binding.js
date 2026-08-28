'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./kontur-consolidated-demo.js');
const Binding = require('./receipt-binding.js');

const input = JSON.parse(fs.readFileSync(path.join(__dirname, 'examples/phase-d-synthetic.input.json'), 'utf8'));
const receipt = Runtime.deriveReceipt(input);
assert.strictEqual(Binding.validateReceiptAgainstInput(input, receipt), receipt);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function reject(name, fn) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected rejection`);
  assert.match(error.message, /does not reproduce exact source input/);
}

reject('source_input_hash_substitution', () => {
  const changed = clone(receipt);
  changed.source_input.input_hash = `sha256:${'1'.repeat(64)}`;
  Runtime.rehash(changed);
  Binding.validateReceiptAgainstInput(input, changed);
});
reject('frontier_substitution', () => {
  const changed = clone(receipt);
  changed.evaluation_frontier.revision = 'f'.repeat(40);
  Runtime.rehash(changed);
  Binding.validateReceiptAgainstInput(input, changed);
});
reject('family_summary_substitution', () => {
  const changed = clone(receipt);
  changed.family_review.canonical_path_count = 999;
  Runtime.rehash(changed);
  Binding.validateReceiptAgainstInput(input, changed);
});
reject('metric_substitution', () => {
  const changed = clone(receipt);
  changed.synthetic_demo_metrics.human_interruption_count += 1;
  Runtime.rehash(changed);
  Binding.validateReceiptAgainstInput(input, changed);
});

console.log('KONTUR_CONSOLIDATED_DEMO_RECEIPT_BINDING_PASS');
