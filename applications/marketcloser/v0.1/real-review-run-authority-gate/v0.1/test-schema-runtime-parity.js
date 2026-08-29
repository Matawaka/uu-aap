'use strict';

const fs = require('fs');
const path = require('path');
const Gate = require('./authority-gate.js');

const inputSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'receipt.schema.json'), 'utf8'));
const assert = (c, m) => { if (!c) throw new Error(m); };

assert(inputSchema.properties.protocol.const === Gate.PROTOCOL, 'input protocol drift');
assert(inputSchema.properties.version.const === Gate.VERSION, 'input version drift');
assert(inputSchema.properties.artifact_type.const === Gate.INPUT_TYPE, 'input type drift');
assert(receiptSchema.properties.protocol.const === Gate.PROTOCOL, 'receipt protocol drift');
assert(receiptSchema.properties.version.const === Gate.VERSION, 'receipt version drift');
assert(receiptSchema.properties.receipt_type.const === Gate.RECEIPT_TYPE, 'receipt type drift');
assert(receiptSchema.properties.authority_requirement.properties.required_scope.const === Gate.REQUIRED_SCOPE, 'required scope drift');
assert(JSON.stringify([...receiptSchema.properties.classification.enum].sort()) === JSON.stringify([...Gate.CLASSIFICATIONS].sort()), 'classification enum drift');
assert(receiptSchema.properties.non_effects.minItems === Gate.REQUIRED_NON_EFFECTS.length, 'non-effect minItems drift');
assert(receiptSchema.properties.non_effects.maxItems === Gate.REQUIRED_NON_EFFECTS.length, 'non-effect maxItems drift');
assert(JSON.stringify(Object.keys(receiptSchema.properties.claims.properties).sort()) === JSON.stringify([...Gate.CLAIM_KEYS].sort()), 'claim schema/runtime drift');
console.log('MarketCloser authority gate schema/runtime parity: PASS');
