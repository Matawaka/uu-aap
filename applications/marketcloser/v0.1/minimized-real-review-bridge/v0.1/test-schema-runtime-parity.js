'use strict';

const fs = require('fs');
const path = require('path');
const Bridge = require('./bridge.js');

const inputSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'receipt.schema.json'), 'utf8'));

function sorted(value) { return [...value].sort(); }
function equal(a, b, label) {
  if (JSON.stringify(sorted(a)) !== JSON.stringify(sorted(b))) throw new Error(`${label} key mismatch`);
}

equal(inputSchema.required, Bridge.INPUT_KEYS, 'input schema/runtime');
equal(receiptSchema.required, Bridge.RECEIPT_KEYS, 'receipt schema/runtime');
equal(receiptSchema.properties.claims.required, Bridge.CLAIM_KEYS, 'receipt claim schema/runtime');

if (inputSchema.properties.protocol.const !== Bridge.PROTOCOL || receiptSchema.properties.protocol.const !== Bridge.PROTOCOL) {
  throw new Error('protocol schema/runtime mismatch');
}
if (receiptSchema.properties.next_safe_action.const !== Bridge.NEXT_SAFE_ACTION) {
  throw new Error('next safe action schema/runtime mismatch');
}
if (receiptSchema.properties.non_effects.minItems !== Bridge.REQUIRED_NON_EFFECTS.length ||
    receiptSchema.properties.non_effects.maxItems !== Bridge.REQUIRED_NON_EFFECTS.length) {
  throw new Error('non-effect cardinality schema/runtime mismatch');
}

console.log('MarketCloser minimized bridge schema/runtime parity: PASS');
