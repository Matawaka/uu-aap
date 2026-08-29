#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T5 = require('./implementation-substitution.js');

const ROOT = path.resolve(__dirname, '../../..');
const inputSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'assessment-input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'substitution-assessment-receipt.schema.json'), 'utf8'));
const examples = [
  'tooling/implementation-substitution/v0.1/examples/ai-transport-receipt-identity.input.json',
  'tooling/implementation-substitution/v0.1/examples/marketcloser-copy-export-receipt-identity.input.json'
].map((relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8')));

assert.deepStrictEqual(
  [...inputSchema.properties.dimensions.required].sort(),
  [...T5.DIMENSIONS].sort()
);
assert.deepStrictEqual(
  [...inputSchema.$defs.dimension.properties.finding.enum].sort(),
  [...T5.FINDINGS].sort()
);
assert.deepStrictEqual(
  [...receiptSchema.properties.decision.enum].sort(),
  [...T5.DECISIONS].sort()
);
assert.deepStrictEqual(
  Object.keys(receiptSchema.properties.non_effects.properties).sort(),
  Object.keys(T5.NON_EFFECTS).sort()
);

for (const example of examples) {
  T5.validateInput(example);
  const receipt = T5.buildReceipt(example);
  T5.validateReceipt(receipt, example);
}

console.log('Implementation Substitution schema/runtime parity: PASS');
