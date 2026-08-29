#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const T5 = require('./implementation-substitution.js');

const AI = JSON.parse(fs.readFileSync(
  require('path').join(__dirname, 'examples/ai-transport-receipt-identity.input.json'),
  'utf8'
));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectReject(fn, fragment) {
  assert.throws(fn, (error) =>
    error &&
    error.name === 'ImplementationSubstitutionError' &&
    (!fragment || error.message.includes(fragment))
  );
}

function mutateInput(input, mutate) {
  const copy = clone(input);
  mutate(copy);
  copy.content_hash = '';
  T5.rehash(copy);
  return copy;
}

const valid = T5.validateInput(clone(AI));
assert.strictEqual(valid.assessment_id, AI.assessment_id);

const receipt = T5.buildReceipt(clone(AI));
assert.strictEqual(receipt.decision, 'SUBSTITUTABLE');
assert.deepStrictEqual(receipt.decision_basis.unsatisfied_dimensions, []);
assert.deepStrictEqual(receipt.decision_basis.insufficient_dimensions, []);
assert.deepStrictEqual(receipt.decision_basis.adapter_required_dimensions, []);
assert.deepStrictEqual(receipt.decision_basis.not_applicable_dimensions, ['wire_schema']);
assert.strictEqual(receipt.assertions.whole_component_substitution_assessed, false);
assert.strictEqual(receipt.non_effects.implementation_selected, false);
assert.strictEqual(receipt.non_effects.authority_created, false);
assert.strictEqual(receipt.non_effects.runtime_activated, false);
assert.strictEqual(receipt.non_effects.execution_admitted, false);
assert.strictEqual(receipt.non_effects.universal_substitutability_established, false);
T5.validateReceipt(clone(receipt), clone(AI));

const adapterInput = mutateInput(AI, (copy) => {
  copy.dimensions.wire_schema.required = true;
  copy.dimensions.wire_schema.finding = 'ADAPTER_REQUIRED';
  copy.dimensions.wire_schema.reason = 'Synthetic vector: exact consumer wire adapter is required.';
});
const adapterReceipt = T5.buildReceipt(adapterInput);
assert.strictEqual(adapterReceipt.decision, 'ADAPTER_REQUIRED');
assert.deepStrictEqual(adapterReceipt.decision_basis.adapter_required_dimensions, ['wire_schema']);

const insufficientInput = mutateInput(AI, (copy) => {
  copy.dimensions.conformance.finding = 'INSUFFICIENT_EVIDENCE';
  copy.dimensions.conformance.evidence_refs = [];
  copy.dimensions.conformance.reason = 'Synthetic vector: exact candidate conformance evidence is missing.';
});
const insufficientReceipt = T5.buildReceipt(insufficientInput);
assert.strictEqual(insufficientReceipt.decision, 'INSUFFICIENT_EVIDENCE');
assert.deepStrictEqual(insufficientReceipt.decision_basis.insufficient_dimensions, ['conformance']);

const incompatibleInput = mutateInput(AI, (copy) => {
  copy.dimensions.effect_ceiling.finding = 'UNSATISFIED';
  copy.dimensions.effect_ceiling.reason = 'Synthetic vector: candidate effect ceiling exceeds consumer boundary.';
});
const incompatibleReceipt = T5.buildReceipt(incompatibleInput);
assert.strictEqual(incompatibleReceipt.decision, 'NOT_SUBSTITUTABLE');
assert.deepStrictEqual(incompatibleReceipt.decision_basis.unsatisfied_dimensions, ['effect_ceiling']);

const precedenceInput = mutateInput(AI, (copy) => {
  copy.dimensions.wire_schema.required = true;
  copy.dimensions.wire_schema.finding = 'ADAPTER_REQUIRED';
  copy.dimensions.conformance.finding = 'INSUFFICIENT_EVIDENCE';
  copy.dimensions.conformance.evidence_refs = [];
  copy.dimensions.effect_ceiling.finding = 'UNSATISFIED';
});
assert.strictEqual(T5.buildReceipt(precedenceInput).decision, 'NOT_SUBSTITUTABLE');

expectReject(() => T5.validateInput(mutateInput(AI, (copy) => {
  copy.dimensions.semantic.finding = 'NOT_APPLICABLE';
})), 'required dimension cannot be NOT_APPLICABLE');

expectReject(() => T5.validateInput(mutateInput(AI, (copy) => {
  copy.substitution_scope.whole_component_substitution = true;
})), 'does not assess whole-component');

expectReject(() => T5.validateInput(mutateInput(AI, (copy) => {
  copy.constraints.selection_requested = true;
})), 'selection_requested must remain false');

expectReject(() => T5.validateInput(mutateInput(AI, (copy) => {
  copy.candidate.implementation_id = copy.incumbent.implementation_id;
})), 'must differ');

const badHash = clone(AI);
badHash.content_hash = `sha256:${'0'.repeat(64)}`;
expectReject(() => T5.validateInput(badHash), 'content_hash mismatch');

const tamperedReceipt = clone(receipt);
tamperedReceipt.decision = 'ADAPTER_REQUIRED';
tamperedReceipt.content_hash = '';
T5.rehash(tamperedReceipt);
expectReject(() => T5.validateReceipt(tamperedReceipt, AI), 'decision mismatch');

const reordered = clone(AI);
reordered.dimensions = Object.fromEntries(Object.entries(reordered.dimensions).reverse());
reordered.content_hash = '';
T5.rehash(reordered);
assert.strictEqual(reordered.content_hash, AI.content_hash);
assert.strictEqual(T5.buildReceipt(reordered).content_hash, receipt.content_hash);

console.log('Implementation Substitution Assessment v0.1 conformance: PASS');
