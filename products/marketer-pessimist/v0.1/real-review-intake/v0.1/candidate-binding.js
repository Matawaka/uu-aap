'use strict';

const Runtime = require('./real-review-intake.js');

class RealReviewCandidateBindingError extends Error {}

function canonicalText(value) {
  return JSON.stringify(Runtime.canonicalize(value));
}

function validateCandidateAgainstInput(input, candidate) {
  Runtime.validateInput(input);
  Runtime.validateCandidate(candidate);
  const expected = Runtime.deriveCandidate(input);
  if (canonicalText(expected) !== canonicalText(candidate)) {
    throw new RealReviewCandidateBindingError('candidate/source binding mismatch');
  }
  return candidate;
}

module.exports = {
  RealReviewCandidateBindingError,
  validateCandidateAgainstInput
};