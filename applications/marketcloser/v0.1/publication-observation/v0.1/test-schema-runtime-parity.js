'use strict';

const fs = require('fs');
const path = require('path');
const Publication = require('./publication-observation.js');
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const inputSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname,'input.schema.json'),'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname,'receipt.schema.json'),'utf8'));

assert(JSON.stringify(Object.keys(inputSchema.properties).sort()) === JSON.stringify([...Publication.INPUT_KEYS].sort()), 'input schema/runtime top-level mismatch');
assert(JSON.stringify(Object.keys(inputSchema.properties.controls.properties).sort()) === JSON.stringify([...Publication.CONTROL_KEYS].sort()), 'control schema/runtime mismatch');
assert(JSON.stringify(receiptSchema.properties.classification.enum.sort()) === JSON.stringify([...Publication.CLASSIFICATIONS].sort()), 'classification schema/runtime mismatch');
assert(JSON.stringify(Object.keys(receiptSchema.properties.claims.properties).sort()) === JSON.stringify([...Publication.CLAIM_KEYS].sort()), 'claim schema/runtime mismatch');
assert(receiptSchema.properties.non_effects.minItems === Publication.REQUIRED_NON_EFFECTS.length, 'non_effect count mismatch');
console.log('MarketCloser Publication Observation schema/runtime parity: PASS');
