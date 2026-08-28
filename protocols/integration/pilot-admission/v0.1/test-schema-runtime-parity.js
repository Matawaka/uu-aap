'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./pilot-admission.js');

function read(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
const inputSchema = read('admission-candidate.schema.json');
const receiptSchema = read('admission-preflight-receipt.schema.json');

assert.deepStrictEqual([...inputSchema.required].sort(), [...Runtime.INPUT_KEYS].sort(), 'input top-level schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.evaluation_frontier.required].sort(), [...Runtime.FRONTIER_KEYS].sort(), 'frontier schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.product.required].sort(), [...Runtime.PRODUCT_KEYS].sort(), 'product schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.proposed_pilot.required].sort(), [...Runtime.PILOT_KEYS].sort(), 'pilot schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.requested_reviews.required].sort(), [...Runtime.REVIEW_KEYS].sort(), 'review schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.controls.required].sort(), [...Runtime.CONTROL_KEYS].sort(), 'controls schema/runtime drift');

assert.deepStrictEqual([...receiptSchema.required].sort(), [...Runtime.RECEIPT_KEYS].sort(), 'receipt top-level schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.properties.source_candidate.required].sort(), [...Runtime.SOURCE_KEYS].sort(), 'source schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.properties.run_admission_predecessor.required].sort(), [...Runtime.PREDECESSOR_KEYS].sort(), 'predecessor schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.properties.product.required].sort(), [...Runtime.RECEIPT_PRODUCT_KEYS].sort(), 'receipt product schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.properties.pilot.required].sort(), [...Runtime.RECEIPT_PILOT_KEYS].sort(), 'receipt pilot schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.properties.required_human_gates.required].sort(), [...Runtime.GATE_KEYS].sort(), 'gate schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.properties.claims.required].sort(), [...Runtime.CLAIM_KEYS].sort(), 'claim schema/runtime drift');
for (const key of Runtime.TRUE_CLAIMS) assert.strictEqual(receiptSchema.properties.claims.properties[key].const, true, `${key} schema must be true`);
for (const key of Runtime.FALSE_CLAIMS) assert.strictEqual(receiptSchema.properties.claims.properties[key].const, false, `${key} schema must be false`);

console.log('UU_AAP_PRODUCT_PILOT_ADMISSION_SCHEMA_RUNTIME_PARITY_PASS');
