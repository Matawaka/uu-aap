'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Runtime = require('./deployment-observation.js');

const inputSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'receipt.schema.json'), 'utf8'));

assert.equal(inputSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.equal(inputSchema.properties.version.const, Runtime.VERSION);
assert.equal(inputSchema.properties.artifact_type.const, Runtime.INPUT_TYPE);
assert.equal(inputSchema.properties.boundary_binding.properties.boundary_hash.const, Runtime.BOUNDARY_HASH);
assert.equal(receiptSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.equal(receiptSchema.properties.version.const, Runtime.VERSION);
assert.equal(receiptSchema.properties.receipt_type.const, Runtime.RECEIPT_TYPE);
assert.equal(receiptSchema.properties.next_safe_action.const, Runtime.NEXT_SAFE_ACTION);
assert.deepEqual([...inputSchema.required].sort(), [...Runtime.INPUT_KEYS].sort());
assert.deepEqual([...receiptSchema.required].sort(), [...Runtime.RECEIPT_KEYS].sort());

console.log('MarketCloser deployment observation schema/runtime parity: PASS');
