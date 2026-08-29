'use strict';

const fs = require('fs');
const path = require('path');
const Adapter = require('./adapter.js');

const inputSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'receipt.schema.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a,b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

assert(same(inputSchema.required, Adapter.INPUT_KEYS), 'input schema/runtime top-level keys diverged');
assert(same(receiptSchema.required, Adapter.RECEIPT_KEYS), 'receipt schema/runtime top-level keys diverged');
assert(same(receiptSchema.properties.claims.required, Adapter.CLAIM_KEYS), 'receipt claim keys diverged');
for (const key of Adapter.TRUE_CLAIMS) assert(receiptSchema.properties.claims.properties[key].const === true, `true claim schema mismatch: ${key}`);
for (const key of Adapter.FALSE_CLAIMS) assert(receiptSchema.properties.claims.properties[key].const === false, `false claim schema mismatch: ${key}`);
assert(JSON.stringify(receiptSchema.properties.non_effects.const) === JSON.stringify(Adapter.REQUIRED_NON_EFFECTS), 'non-effect schema/runtime mismatch');
assert(receiptSchema.properties.next_safe_action.const === Adapter.NEXT_SAFE_ACTION, 'next action schema/runtime mismatch');
const analysisRequired = receiptSchema.properties.analysis.required;
assert(same(analysisRequired, [
  'state','uncertainty_states','classification_summary','evidence_lineage','counterarguments',
  'causal_alternatives','falsifiers','missing_evidence','recommendation_candidate','success_criteria'
]), 'analysis schema surface mismatch');
console.log('MarketCloser real stress-test adapter schema/runtime parity: PASS');
