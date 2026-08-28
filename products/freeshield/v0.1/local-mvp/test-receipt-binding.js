'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./protective-assessment.js');
const Binding = require('./receipt-binding.js');

const input = JSON.parse(fs.readFileSync(path.join(__dirname, 'examples/synthetic-honest-hiring.input.json'), 'utf8'));
const receipt = Runtime.deriveAssessment(input);
assert.deepStrictEqual(Binding.validateReceiptAgainstInput(input, receipt), receipt);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectReject(name, mutate) {
  const changed = clone(receipt);
  mutate(changed);
  Runtime.rehash(changed);
  assert.throws(() => Binding.validateReceiptAgainstInput(input, changed), /does not reproduce exact source input/, name);
}

expectReject('source input hash substitution', value => {
  value.source_input.input_hash = `sha256:${'0'.repeat(64)}`;
});
expectReject('consumer contract substitution', value => {
  value.consumer_binding.product_contract_hash = `sha256:${'1'.repeat(64)}`;
});
expectReject('candidate payload substitution', value => {
  value.candidate_summary.payload_digest = `sha256:${'2'.repeat(64)}`;
});
expectReject('frontier substitution', value => {
  value.evaluation_frontier.revision = 'f'.repeat(40);
});
expectReject('outcome substitution', value => {
  value.protective_outcome.outcome = 'HUMAN_REVIEW';
});

console.log('FREESHIELD_LOCAL_MVP_RECEIPT_INPUT_BINDING_V0_1_PASS');
