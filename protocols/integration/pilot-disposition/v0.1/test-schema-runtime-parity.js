'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./pilot-disposition.js');

function read(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
function sorted(value) { return [...value].sort(); }

const input = read('human-disposition-input.schema.json');
const receipt = read('human-disposition-receipt.schema.json');

assert.deepStrictEqual(sorted(input.required), sorted(Runtime.INPUT_KEYS));
assert.deepStrictEqual(sorted(input.properties.evaluation_frontier.required), sorted(Runtime.FRONTIER_KEYS));
assert.deepStrictEqual(sorted(input.properties.decision.required), sorted(Runtime.DECISION_KEYS));
assert.deepStrictEqual(sorted(input.properties.controls.required), sorted(Runtime.CONTROL_KEYS));
assert.deepStrictEqual(sorted(input.properties.decision.properties.decision.enum), sorted(Runtime.DECISIONS));
assert.deepStrictEqual(sorted(input.properties.decision.properties.decision_context.enum), sorted(Runtime.DECISION_CONTEXTS));
assert.deepStrictEqual(sorted(input.properties.admission_candidate_path.enum), sorted(Object.keys(Runtime.CANDIDATE_PROFILES)));

assert.deepStrictEqual(sorted(receipt.required), sorted(Runtime.RECEIPT_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.source_disposition.required), sorted(Runtime.SOURCE_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.admission_predecessor.required), sorted(Runtime.ADMISSION_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.product.required), sorted(Runtime.PRODUCT_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.human_decision.required), sorted(Runtime.HUMAN_DECISION_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.disposition.required), sorted(Runtime.DISPOSITION_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.required_followup_gates.required), sorted(Runtime.FOLLOWUP_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.claims.required), sorted(Runtime.CLAIM_KEYS));
assert.deepStrictEqual(sorted(receipt.properties.disposition.properties.status.enum), sorted(Runtime.STATUSES));
assert.deepStrictEqual(sorted(receipt.properties.next_safe_action.enum), sorted(Object.values(Runtime.NEXT_ACTIONS)));
assert.deepStrictEqual(sorted(receipt.properties.non_effects.items.enum), sorted(Runtime.REQUIRED_NON_EFFECTS));

for (const claim of Runtime.ALWAYS_FALSE_CLAIMS) {
  assert.strictEqual(receipt.properties.claims.properties[claim].const, false, `${claim}: schema must fix false`);
}
for (const key of Runtime.CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) {
  assert.strictEqual(input.properties.controls.properties[key].const, false, `${key}: schema must fix false`);
}

console.log('UU_AAP_PRODUCT_PILOT_HUMAN_DISPOSITION_SCHEMA_RUNTIME_PARITY_PASS');
