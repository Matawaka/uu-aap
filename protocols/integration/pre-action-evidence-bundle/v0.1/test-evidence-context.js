'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const validatorPath = path.join(__dirname, 'validate-pre-action-evidence-bundle.js');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'conformance.fixture.json'), 'utf8'));
const {
  buildDefaultFixtureEvidenceContext,
  validateBundle,
  validateEvidenceContext
} = require('./validate-pre-action-evidence-bundle.js');

const clone = value => JSON.parse(JSON.stringify(value));

function expectFailure(label, fn, pattern) {
  let failed = false;
  try { fn(); } catch (error) {
    failed = true;
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function testDefaultContextDeterministic() {
  assert.deepStrictEqual(buildDefaultFixtureEvidenceContext(), buildDefaultFixtureEvidenceContext());
}

function testExplicitDefaultEqualsImplicitDefault() {
  const context = buildDefaultFixtureEvidenceContext();
  assert.strictEqual(validateBundle(clone(fixture)), true);
  assert.strictEqual(validateBundle(clone(fixture), clone(context)), true);
}

function testContextValidationPasses() {
  assert.strictEqual(validateEvidenceContext(buildDefaultFixtureEvidenceContext()), true);
}

function testSelectionContextSubstitutionRejected() {
  const context = buildDefaultFixtureEvidenceContext();
  context.selection.content_hash = `sha256:${'0'.repeat(64)}`;
  expectFailure('selection context', () => validateBundle(clone(fixture), context), /selection hash mismatch/);
}

function testAvailabilityContextSubstitutionRejected() {
  const context = buildDefaultFixtureEvidenceContext();
  context.availability.core_availability_claim_hash = `sha256:${'0'.repeat(64)}`;
  expectFailure('availability context', () => validateBundle(clone(fixture), context), /availability claim ref mismatch|availability receipt not bound/);
}

function testUnavailableContextRejected() {
  const context = buildDefaultFixtureEvidenceContext();
  context.availability.status = 'unavailable';
  expectFailure('unavailable context', () => validateEvidenceContext(context), /status must be available/);
}

function testMalformedContextRejected() {
  const context = buildDefaultFixtureEvidenceContext();
  delete context.selection.descriptor_id;
  expectFailure('malformed context', () => validateEvidenceContext(context), /selection keys mismatch/);
}

function testImportHasNoConformanceSideEffects() {
  const script = `require(${JSON.stringify(validatorPath)})`;
  const run = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.strictEqual(run.status, 0, run.stderr);
  assert.strictEqual(run.stdout, '');
}

const tests = [
  testDefaultContextDeterministic,
  testExplicitDefaultEqualsImplicitDefault,
  testContextValidationPasses,
  testSelectionContextSubstitutionRejected,
  testAvailabilityContextSubstitutionRejected,
  testUnavailableContextRejected,
  testMalformedContextRejected,
  testImportHasNoConformanceSideEffects
];

for (const test of tests) {
  test();
  process.stdout.write(`PASS ${test.name}\n`);
}
process.stdout.write(`PASS Pre-Action Evidence Bundle evidence-context interface (${tests.length} groups)\n`);
