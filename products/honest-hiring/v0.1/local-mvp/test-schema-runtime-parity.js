'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./honest-hiring.js');

function load(name) { return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')); }
const inputSchema = load('input.schema.json');
const requirementSchema = load('requirement-receipt.schema.json');
const comparisonSchema = load('comparison-receipt.schema.json');
const resultSchema = load('result.schema.json');

assert.strictEqual(inputSchema.additionalProperties, false);
assert.deepStrictEqual([...inputSchema.required].sort(), [...Runtime.INPUT_KEYS].sort());
assert.strictEqual(inputSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.strictEqual(inputSchema.properties.version.const, Runtime.VERSION);
assert.strictEqual(inputSchema.properties.artifact_type.const, Runtime.INPUT_TYPE);
assert.deepStrictEqual([...inputSchema.properties.controls.required].sort(), [...Runtime.CONTROL_KEYS].sort());

assert.strictEqual(requirementSchema.additionalProperties, false);
assert.deepStrictEqual([...requirementSchema.required].sort(), [...Runtime.REQUIREMENT_RECEIPT_KEYS].sort());
assert.strictEqual(requirementSchema.properties.receipt_type.const, 'HonestHiringRequirementReceipt');
assert.strictEqual(requirementSchema.properties.next_safe_action.const, 'REQUIREMENT_RECEIPT_READY_FOR_LOCAL_COMPARISON_ONLY');

assert.strictEqual(comparisonSchema.additionalProperties, false);
assert.deepStrictEqual([...comparisonSchema.required].sort(), [...Runtime.COMPARISON_RECEIPT_KEYS].sort());
assert.strictEqual(comparisonSchema.properties.receipt_type.const, 'HonestHiringComparisonReceipt');
assert.strictEqual(comparisonSchema.properties.next_safe_action.const, Runtime.NEXT_SAFE_ACTION);
for (const claim of Runtime.COMPARISON_TRUE_CLAIMS) assert.strictEqual(comparisonSchema.properties.claims.properties[claim].const, true, claim);
for (const claim of Runtime.COMPARISON_FALSE_CLAIMS) assert.strictEqual(comparisonSchema.properties.claims.properties[claim].const, false, claim);

assert.strictEqual(resultSchema.additionalProperties, false);
assert.deepStrictEqual([...resultSchema.required].sort(), [...Runtime.RESULT_KEYS].sort());
assert.strictEqual(resultSchema.properties.artifact_type.const, Runtime.RESULT_TYPE);
assert.strictEqual(resultSchema.properties.next_safe_action.const, Runtime.NEXT_SAFE_ACTION);

console.log('HONEST_HIRING_LOCAL_MVP_SCHEMA_RUNTIME_PARITY_V0_1_PASS');
