'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Runtime = require('./real-review-intake.js');
const Binding = require('./candidate-binding.js');

const input = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'examples', 'synthetic-positioning.intake.json'), 'utf8'
));
const candidate = Runtime.deriveCandidate(input);
Binding.validateCandidateAgainstInput(input, candidate);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectBindingReject(mutator, label) {
  const substituted = clone(candidate);
  mutator(substituted);
  Runtime.rehash(substituted);
  Runtime.validateCandidate(substituted);
  assert.throws(
    () => Binding.validateCandidateAgainstInput(input, substituted),
    Binding.RealReviewCandidateBindingError,
    label
  );
}

expectBindingReject(value => {
  value.source_binding.source_reference = 'urn:synthetic:substituted-source:001';
}, 'source reference substitution');

expectBindingReject(value => {
  value.source_binding.classification_basis_hash = Runtime.hashText('substituted classification basis');
}, 'classification basis substitution');

expectBindingReject(value => {
  value.evaluation_frontier.revision = '1111111111111111111111111111111111111111';
}, 'frontier substitution');

expectBindingReject(value => {
  value.bounded_case.claim_package.claim_text = 'A structurally valid but source-substituted marketing claim.';
}, 'claim substitution');

const overclaim = clone(candidate);
overclaim.claims.pilot_admitted = true;
Runtime.rehash(overclaim);
assert.throws(() => Runtime.validateCandidate(overclaim), Runtime.MarketerPessimistRealReviewIntakeError);

console.log('PASS: exact real review intake/candidate source binding');