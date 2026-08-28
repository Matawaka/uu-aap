'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Runtime = require('./honest-hiring.js');
const Binding = require('./result-binding.js');

const EXAMPLE = path.join(__dirname, 'examples/synthetic-sap-data-platform-architect.input.json');
const input = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
const result = Runtime.deriveResult(input);

Binding.validateResultAgainstInput(input, result);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function reject(name, operation) {
  let rejected = false;
  try { operation(); } catch { rejected = true; }
  assert.strictEqual(rejected, true, `${name}: substituted result accepted`);
}

reject('source input hash substitution', () => {
  const forged = clone(result);
  forged.source_input.input_hash = 'sha256:' + 'a'.repeat(64);
  Runtime.rehash(forged);
  Binding.validateResultAgainstInput(input, forged);
});

reject('requirement receipt source substitution', () => {
  const forged = clone(result);
  forged.requirement_receipt.source_input.input_hash = 'sha256:' + 'b'.repeat(64);
  Runtime.rehash(forged.requirement_receipt);
  forged.comparison_receipt.requirement_receipt_ref.content_hash = forged.requirement_receipt.content_hash;
  Runtime.rehash(forged.comparison_receipt);
  Runtime.rehash(forged);
  Binding.validateResultAgainstInput(input, forged);
});

reject('FREESHIELD receipt substitution', () => {
  const forged = clone(result);
  forged.freeshield_assessment_receipt.protective_outcome.reason_codes = ['FORGED_LOCAL_REASON'];
  const FreeShield = require('../../../freeshield/v0.1/local-mvp/protective-assessment.js');
  FreeShield.rehash(forged.freeshield_assessment_receipt);
  forged.comparison_receipt.freeshield_assessment_ref.receipt_hash = forged.freeshield_assessment_receipt.content_hash;
  Runtime.rehash(forged.comparison_receipt);
  Runtime.rehash(forged);
  Binding.validateResultAgainstInput(input, forged);
});

reject('comparison evidence substitution', () => {
  const forged = clone(result);
  forged.comparison_receipt.comparison_by_requirement[0].reason_codes = ['FORGED_REASON'];
  Runtime.rehash(forged.comparison_receipt);
  Runtime.rehash(forged);
  Binding.validateResultAgainstInput(input, forged);
});

console.log('HONEST_HIRING_LOCAL_MVP_RESULT_BINDING_V0_1_PASS');
