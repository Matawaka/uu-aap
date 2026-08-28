'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Runtime = require('./real-review-intake.js');

function sorted(value) {
  return [...value].sort();
}

const intakeSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'intake.schema.json'), 'utf8'));
const candidateSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'candidate.schema.json'), 'utf8'));

assert.deepStrictEqual(sorted(intakeSchema.required), sorted(Runtime.INPUT_KEYS));
assert.deepStrictEqual(sorted(intakeSchema.$defs.sourceContext.required), sorted(Runtime.SOURCE_KEYS));
assert.deepStrictEqual(sorted(intakeSchema.$defs.controls.required), sorted(Runtime.CONTROL_KEYS));
assert.strictEqual(intakeSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.strictEqual(intakeSchema.properties.version.const, Runtime.VERSION);
assert.strictEqual(intakeSchema.properties.artifact_type.const, Runtime.INPUT_TYPE);
assert.deepStrictEqual(sorted(intakeSchema.$defs.sourceContext.properties.mode.enum), sorted(Runtime.SOURCE_MODES));
assert.deepStrictEqual(
  sorted(intakeSchema.$defs.statement.properties.classification.enum),
  sorted(Runtime.CLASSIFICATIONS)
);
assert.deepStrictEqual(
  sorted(intakeSchema.$defs.evidence.properties.quality.enum),
  sorted(Runtime.EVIDENCE_QUALITY)
);

assert.deepStrictEqual(sorted(candidateSchema.required), sorted(Runtime.CANDIDATE_KEYS));
assert.strictEqual(candidateSchema.properties.protocol.const, Runtime.PROTOCOL);
assert.strictEqual(candidateSchema.properties.version.const, Runtime.VERSION);
assert.strictEqual(candidateSchema.properties.artifact_type.const, Runtime.CANDIDATE_TYPE);
assert.strictEqual(candidateSchema.properties.next_safe_action.const, Runtime.NEXT_SAFE_ACTION);
assert.deepStrictEqual(
  sorted(candidateSchema.$defs.sourceBinding.properties.mode.enum),
  sorted(Runtime.SOURCE_MODES)
);

const claimProperties = candidateSchema.$defs.claims.properties;
assert.deepStrictEqual(sorted(Object.keys(claimProperties)), sorted(Runtime.RECEIPT_CLAIM_KEYS));
for (const key of Runtime.TRUE_CLAIMS) assert.strictEqual(claimProperties[key].const, true, key);
for (const key of Runtime.FALSE_CLAIMS) assert.strictEqual(claimProperties[key].const, false, key);
assert.strictEqual(candidateSchema.properties.non_effects.minItems, Runtime.REQUIRED_NON_EFFECTS.length);
assert.strictEqual(candidateSchema.properties.non_effects.maxItems, Runtime.REQUIRED_NON_EFFECTS.length);

console.log('PASS: real review intake schema/runtime parity');