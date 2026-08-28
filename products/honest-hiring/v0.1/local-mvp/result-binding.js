'use strict';

const Runtime = require('./honest-hiring.js');

function sameCanonical(left, right) {
  return JSON.stringify(Runtime.canonicalize(left)) === JSON.stringify(Runtime.canonicalize(right));
}

function validateResultAgainstInput(input, result) {
  Runtime.validateInput(input);
  Runtime.validateResult(result);
  const expected = Runtime.deriveResult(input);
  if (!sameCanonical(result, expected)) {
    throw new Runtime.HonestHiringLocalMvpError('Honest Hiring local result does not reproduce exact source input');
  }
  return result;
}

module.exports = { validateResultAgainstInput };
