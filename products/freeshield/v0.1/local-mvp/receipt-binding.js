'use strict';

const Runtime = require('./protective-assessment.js');

function sameCanonical(left, right) {
  return JSON.stringify(Runtime.canonicalize(left)) === JSON.stringify(Runtime.canonicalize(right));
}

function validateReceiptAgainstInput(input, receipt) {
  Runtime.validateInput(input);
  Runtime.validateReceipt(receipt);
  const expected = Runtime.deriveAssessment(input);
  if (!sameCanonical(receipt, expected)) {
    throw new Runtime.FreeShieldLocalMvpError('protective assessment receipt does not reproduce exact source input');
  }
  return receipt;
}

module.exports = { validateReceiptAgainstInput };
