'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./protective-assessment.js');

const inputSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'receipt.schema.json'), 'utf8'));

assert.strictEqual(inputSchema.additionalProperties, false);
assert.deepStrictEqual([...inputSchema.required].sort(), [...Runtime.INPUT_KEYS].sort());
assert.strictEqual(inputSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.strictEqual(inputSchema.properties.version.const, Runtime.VERSION);
assert.strictEqual(inputSchema.properties.artifact_type.const, Runtime.INPUT_TYPE);
assert.strictEqual(inputSchema.properties.contract_binding.properties.content_hash.const, Runtime.CONTRACT_HASH);
assert.deepStrictEqual([...inputSchema.properties.controls.required].sort(), [...Runtime.CONTROL_KEYS].sort());
for (const key of Runtime.CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) {
  assert.strictEqual(inputSchema.properties.controls.properties[key].const, false, `${key} must be false in schema`);
}

assert.strictEqual(receiptSchema.additionalProperties, false);
assert.deepStrictEqual([...receiptSchema.required].sort(), [...Runtime.RECEIPT_KEYS].sort());
assert.strictEqual(receiptSchema.properties.receipt_type.const, Runtime.RECEIPT_TYPE);
assert.strictEqual(receiptSchema.properties.next_safe_action.const, Runtime.NEXT_SAFE_ACTION);
assert.deepStrictEqual(new Set(receiptSchema.properties.state.enum), Runtime.STATES);
assert.deepStrictEqual(new Set(receiptSchema.properties.protective_outcome.properties.outcome.enum), Runtime.OUTCOMES);
assert.deepStrictEqual([...receiptSchema.properties.claims.required].sort(), [...Runtime.CLAIM_KEYS].sort());
for (const claim of Runtime.TRUE_CLAIMS) assert.strictEqual(receiptSchema.properties.claims.properties[claim].const, true, `${claim} must be true`);
for (const claim of Runtime.FALSE_CLAIMS) assert.strictEqual(receiptSchema.properties.claims.properties[claim].const, false, `${claim} must be false`);
assert.strictEqual(receiptSchema.properties.non_effects.minItems, Runtime.REQUIRED_NON_EFFECTS.length);
assert.strictEqual(receiptSchema.properties.non_effects.maxItems, Runtime.REQUIRED_NON_EFFECTS.length);

console.log('FREESHIELD_LOCAL_MVP_SCHEMA_RUNTIME_PARITY_V0_1_PASS');
