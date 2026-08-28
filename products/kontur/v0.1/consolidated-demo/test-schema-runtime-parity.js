'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./kontur-consolidated-demo.js');

function readJson(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
const inputSchema = readJson('input.schema.json');
const receiptSchema = readJson('consolidation-receipt.schema.json');

assert.deepStrictEqual([...inputSchema.required].sort(), [...Runtime.INPUT_KEYS].sort(), 'input top-level schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.required].sort(), [...Runtime.RECEIPT_KEYS].sort(), 'receipt top-level schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.component_reviews.required].sort(), [...Runtime.COMPONENT_KEYS].sort(), 'component review schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.metrics.required].sort(), [...Runtime.METRIC_KEYS].sort(), 'metric schema/runtime drift');
assert.deepStrictEqual([...inputSchema.properties.controls.required].sort(), [...Runtime.CONTROL_KEYS].sort(), 'control schema/runtime drift');
assert.deepStrictEqual([...receiptSchema.properties.claims.required].sort(), [...Runtime.CLAIM_KEYS].sort(), 'claim schema/runtime drift');
for (const key of Runtime.TRUE_CLAIMS) assert.strictEqual(receiptSchema.properties.claims.properties[key].const, true, `${key} schema must be true`);
for (const key of Runtime.FALSE_CLAIMS) assert.strictEqual(receiptSchema.properties.claims.properties[key].const, false, `${key} schema must be false`);
assert.strictEqual(inputSchema.properties.metrics.properties.measurement_class.const, 'synthetic_demo_metrics');
assert.strictEqual(receiptSchema.properties.next_safe_action.const, Runtime.NEXT_SAFE_ACTION);
console.log('KONTUR_CONSOLIDATED_DEMO_SCHEMA_RUNTIME_PARITY_PASS');
