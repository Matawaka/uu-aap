'use strict';

const fs = require('fs');
const path = require('path');
const Disposition = require('./disposition.js');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const base = __dirname;
const inputSchema = JSON.parse(fs.readFileSync(path.resolve(base, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(base, 'receipt.schema.json'), 'utf8'));

assert(same(inputSchema.required, Disposition.INPUT_KEYS), 'input schema/runtime top-level key mismatch');
assert(same(inputSchema.properties.controls.required, Disposition.CONTROL_KEYS), 'controls schema/runtime key mismatch');
assert(same(receiptSchema.required, Disposition.RECEIPT_KEYS), 'receipt schema/runtime top-level key mismatch');
assert(same(receiptSchema.properties.claims.required, Disposition.CLAIM_KEYS), 'receipt claims schema/runtime key mismatch');
assert(same(receiptSchema.properties.classification.enum, Disposition.CLASSIFICATIONS), 'classification schema/runtime mismatch');
assert(same(inputSchema.properties.decision.oneOf[1].properties.value.enum, Disposition.DECISIONS), 'decision vocabulary schema/runtime mismatch');
assert(same(inputSchema.properties.decision.oneOf[1].properties.context.enum, Disposition.DECISION_CONTEXTS), 'decision context schema/runtime mismatch');
assert(receiptSchema.additionalProperties === false && inputSchema.additionalProperties === false, 'schemas must remain closed');

console.log('MarketCloser Human Analysis Disposition Gate schema/runtime parity: PASS');
