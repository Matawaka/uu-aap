'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Runtime = require('./stress-test.js');

const inputSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'receipt.schema.json'), 'utf8'));

assert.strictEqual(inputSchema.additionalProperties, false);
assert.deepStrictEqual([...inputSchema.required].sort(), [...Runtime.INPUT_KEYS].sort());
assert.strictEqual(inputSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.strictEqual(inputSchema.properties.version.const, Runtime.VERSION);
assert.strictEqual(inputSchema.properties.artifact_type.const, Runtime.INPUT_TYPE);
assert.strictEqual(inputSchema.properties.contract_binding.properties.content_hash.const, Runtime.CONTRACT_HASH);
assert.deepStrictEqual(
  [...inputSchema.properties.controls.required].sort(),
  [...Runtime.CONTROL_KEYS].sort(),
  'input control schema/runtime keys must match'
);
for (const key of Runtime.CONTROL_KEYS) {
  const expected = ['synthetic_only', 'local_only', 'read_only'].includes(key);
  assert.strictEqual(inputSchema.properties.controls.properties[key].const, expected, `control const mismatch: ${key}`);
}
assert.deepStrictEqual(
  [...inputSchema.properties.claim_package.properties.material_statements.items.properties.classification.enum].sort(),
  [...Runtime.CLASSIFICATIONS].sort(),
  'classification vocabulary must match'
);
assert.deepStrictEqual(
  [...inputSchema.properties.supporting_evidence.items.properties.quality.enum].sort(),
  [...Runtime.EVIDENCE_QUALITY].sort(),
  'evidence quality vocabulary must match'
);

assert.strictEqual(receiptSchema.additionalProperties, false);
assert.deepStrictEqual([...receiptSchema.required].sort(), [...Runtime.RECEIPT_KEYS].sort());
assert.strictEqual(receiptSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.strictEqual(receiptSchema.properties.version.const, Runtime.VERSION);
assert.strictEqual(receiptSchema.properties.receipt_type.const, Runtime.RECEIPT_TYPE);
assert.strictEqual(receiptSchema.properties.contract_binding.properties.content_hash.const, Runtime.CONTRACT_HASH);
assert.deepStrictEqual([...receiptSchema.properties.state.enum].sort(), [...Runtime.STATES].sort());
assert.deepStrictEqual(
  [...receiptSchema.properties.recommendation_candidate.properties.candidate.enum].sort(),
  [...Runtime.RECOMMENDATION_CANDIDATES].sort(),
  'recommendation candidate vocabulary must match'
);
assert.deepStrictEqual([...receiptSchema.properties.claims.required].sort(), [...Runtime.CLAIM_KEYS].sort());
for (const key of Runtime.TRUE_CLAIMS) {
  assert.strictEqual(receiptSchema.properties.claims.properties[key].const, true, `positive claim mismatch: ${key}`);
}
for (const key of Runtime.FALSE_CLAIMS) {
  assert.strictEqual(receiptSchema.properties.claims.properties[key].const, false, `negative claim mismatch: ${key}`);
}
assert.strictEqual(receiptSchema.properties.next_safe_action.const, Runtime.NEXT_SAFE_ACTION);
assert.strictEqual(receiptSchema.properties.non_effects.minItems, Runtime.REQUIRED_NON_EFFECTS.length);
assert.strictEqual(receiptSchema.properties.non_effects.maxItems, Runtime.REQUIRED_NON_EFFECTS.length);

console.log('MARKETER_PESSIMIST_LOCAL_MVP_SCHEMA_RUNTIME_PARITY_V0_1_PASS');
