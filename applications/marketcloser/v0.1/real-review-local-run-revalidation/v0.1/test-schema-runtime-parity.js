'use strict';

const fs = require('fs');
const path = require('path');
const Runtime = require('./revalidation.js');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const inputSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'receipt.schema.json'), 'utf8'));

assert(JSON.stringify([...inputSchema.required].sort()) === JSON.stringify([...Runtime.INPUT_KEYS].sort()), 'input schema/runtime key parity mismatch');
assert(JSON.stringify([...receiptSchema.required].sort()) === JSON.stringify([...Runtime.RECEIPT_KEYS].sort()), 'receipt schema/runtime key parity mismatch');
assert(JSON.stringify([...receiptSchema.properties.classification.enum].sort()) === JSON.stringify([...Runtime.CLASSIFICATIONS].sort()), 'classification schema/runtime parity mismatch');
assert(inputSchema.properties.origin.properties.revision.const === Runtime.ORIGIN_FRONTIER, 'origin revision parity mismatch');
assert(inputSchema.properties.origin.properties.tree.const === Runtime.ORIGIN_TREE, 'origin tree parity mismatch');
assert(receiptSchema.properties.stress_test_run.const === false, 'receipt schema must forbid stress-test execution');
assert(receiptSchema.properties.next_safe_action.enum.includes(Runtime.NEXT_SAFE_ACTION), 'next-safe-action parity mismatch');

console.log('MarketCloser local run revalidation schema/runtime parity: PASS');
