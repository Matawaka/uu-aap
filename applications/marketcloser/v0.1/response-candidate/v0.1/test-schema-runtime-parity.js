'use strict';

const fs = require('fs');
const path = require('path');
const Response = require('./response-candidate.js');

const inputSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'receipt.schema.json'), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

assert(same(inputSchema.required, Response.INPUT_KEYS), 'input schema/runtime top-level keys diverged');
assert(same(inputSchema.properties.controls.required, Response.CONTROL_KEYS), 'input controls schema/runtime keys diverged');
assert(same(receiptSchema.required, Response.RECEIPT_KEYS), 'receipt schema/runtime top-level keys diverged');
assert(same(receiptSchema.properties.classification.enum, Response.CLASSIFICATIONS), 'receipt classification schema/runtime values diverged');
assert(same(receiptSchema.properties.claims.required, Response.CLAIM_KEYS), 'receipt claims schema/runtime keys diverged');
assert(same(inputSchema.properties.customer_context.anyOf[1].properties.tone.enum, Response.TONES), 'tone schema/runtime values diverged');
assert(same(inputSchema.properties.customer_context.anyOf[1].properties.language.enum || [inputSchema.properties.customer_context.anyOf[1].properties.language.const], Response.LANGUAGES), 'language schema/runtime values diverged');

const responseRequired = [
  'candidate_id','language','tone','acknowledgement','evidence_bound_points','uncertainty_disclosures',
  'next_step','closing','draft_text','human_approval_required','approved','copy_export_allowed','published'
];
assert(same(receiptSchema.properties.response_candidate.anyOf[1].required, responseRequired), 'response candidate schema keys diverged');

console.log('MarketCloser response candidate schema/runtime parity: PASS');
