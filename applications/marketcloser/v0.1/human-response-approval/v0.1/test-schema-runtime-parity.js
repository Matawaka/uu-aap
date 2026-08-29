'use strict';

const fs = require('fs');
const path = require('path');
const Approval = require('./approval.js');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const inputSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'receipt.schema.json'), 'utf8'));

assert(JSON.stringify(Object.keys(inputSchema.properties).sort()) === JSON.stringify([...Approval.INPUT_KEYS].sort()), 'input schema/runtime key parity mismatch');
assert(JSON.stringify(Object.keys(inputSchema.properties.controls.properties).sort()) === JSON.stringify([...Approval.CONTROL_KEYS].sort()), 'control schema/runtime key parity mismatch');
assert(JSON.stringify(inputSchema.properties.decision.oneOf[1].properties.value.enum) === JSON.stringify(Approval.DECISIONS), 'decision vocabulary parity mismatch');
assert(JSON.stringify(Object.keys(receiptSchema.properties).sort()) === JSON.stringify([...Approval.RECEIPT_KEYS].sort()), 'receipt schema/runtime key parity mismatch');
assert(JSON.stringify(receiptSchema.properties.classification.enum) === JSON.stringify(Approval.CLASSIFICATIONS), 'classification vocabulary parity mismatch');
assert(JSON.stringify(Object.keys(receiptSchema.properties.claims.properties).sort()) === JSON.stringify([...Approval.CLAIM_KEYS].sort()), 'claim schema/runtime key parity mismatch');

console.log('MarketCloser Human Response Approval schema/runtime parity: PASS');
