'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Runtime = require('./stress-test.js');
const Binding = require('./receipt-binding.js');

const input = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'examples', 'synthetic-onboarding.input.json'),
  'utf8'
));
const receipt = Runtime.analyze(input);
assert.strictEqual(Binding.validateReceiptAgainstInput(input, receipt), receipt);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function reject(name, mutation, pattern) {
  const changed = clone(receipt);
  mutation(changed);
  Runtime.rehash(changed);
  let error = null;
  try {
    Binding.validateReceiptAgainstInput(input, changed);
  } catch (value) {
    error = value;
  }
  assert(error, `${name}: expected source-binding rejection`);
  assert.match(error.message, pattern, `${name}: unexpected rejection`);
}

reject('source_input_hash_substitution', changed => {
  changed.source_input.input_hash = `sha256:${'1'.repeat(64)}`;
}, /does not bind exactly/);

reject('frontier_substitution', changed => {
  changed.evaluation_frontier.revision = 'f'.repeat(40);
}, /does not bind exactly/);

reject('classification_summary_substitution', changed => {
  changed.classification_summary.counts.hypothesis += 1;
}, /does not bind exactly/);

reject('counterargument_substitution', changed => {
  changed.counterarguments[0].text = 'Substituted candidate text.';
}, /does not bind exactly/);

reject('missing_evidence_substitution', changed => {
  changed.missing_evidence.pop();
}, /does not bind exactly/);

console.log('MARKETER_PESSIMIST_LOCAL_MVP_RECEIPT_INPUT_BINDING_V0_1_PASS');
