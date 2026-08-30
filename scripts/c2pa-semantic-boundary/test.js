'use strict';

const assert = require('assert');
const path = require('path');
const { evaluateFixture, readJson } = require('./evaluate');
const { assertLiveC2paReport, inferredValidationState } = require('./check-live-report');

const root = __dirname;
const rubric = readJson(path.join(root, 'rubric-v0.1.json'));

function sortedRuleIds(result) {
  return [...new Set(result.findings.map((finding) => finding.rule_id))].sort();
}

const unsafe = readJson(path.join(root, 'fixtures', 'unsafe-all-invariants.json'));
const unsafeResult = evaluateFixture(unsafe, rubric);
assert.strictEqual(unsafeResult.semantic_boundary_passed, false);
assert.deepStrictEqual(sortedRuleIds(unsafeResult), [...unsafe.expected.rule_ids].sort());
assert.strictEqual(unsafeResult.c2pa_conformance_evaluated, false);

const safe = readJson(path.join(root, 'fixtures', 'safe-separated-semantics.json'));
const safeResult = evaluateFixture(safe, rubric);
assert.strictEqual(safeResult.semantic_boundary_passed, true);
assert.deepStrictEqual(sortedRuleIds(safeResult), []);

assert.deepStrictEqual(
  assertLiveC2paReport({active_manifest: 'urn:test', validation_results: {validation_state: 'Valid'}}),
  {active_manifest: 'urn:test', validation_state: 'Valid'}
);

const validButUntrusted = {
  active_manifest: 'urn:test',
  validation_results: {
    activeManifest: {
      success: [
        {code: 'claimSignature.validated'},
        {code: 'claimSignature.insideValidity'}
      ],
      informational: [],
      failure: [{code: 'signingCredential.untrusted'}]
    }
  }
};
assert.strictEqual(inferredValidationState(validButUntrusted), 'Valid');
assert.deepStrictEqual(
  assertLiveC2paReport(validButUntrusted),
  {active_manifest: 'urn:test', validation_state: 'Valid'}
);

assert.throws(() => assertLiveC2paReport({active_manifest: 'urn:test', validation_results: {validation_state: 'Invalid'}}));
assert.throws(() => assertLiveC2paReport({
  active_manifest: 'urn:test',
  validation_results: {
    activeManifest: {
      success: [{code: 'claimSignature.validated'}, {code: 'claimSignature.insideValidity'}],
      failure: [{code: 'signingCredential.expired'}]
    }
  }
}));
assert.throws(() => assertLiveC2paReport({
  active_manifest: 'urn:test',
  validation_results: {
    activeManifest: {
      success: [{code: 'claimSignature.validated'}, {code: 'claimSignature.insideValidity'}],
      failure: [{code: 'assertion.dataHash.mismatch'}]
    }
  }
}));
assert.throws(() => assertLiveC2paReport({validation_results: {validation_state: 'Valid'}}));

console.log('C2PA semantic boundary v0.1: fixtures PASS');
