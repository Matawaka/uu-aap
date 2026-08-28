'use strict';

const Runtime = require('./pilot-admission.js');

function sameCanonical(left, right) {
  return JSON.stringify(Runtime.canonicalize(left)) === JSON.stringify(Runtime.canonicalize(right));
}

function validateReceiptAgainstCandidate(candidate, receipt) {
  Runtime.validateInput(candidate);
  Runtime.validateReceipt(receipt);
  const expected = Runtime.deriveReceipt(candidate);
  if (!sameCanonical(receipt, expected)) {
    throw new Runtime.ProductPilotAdmissionError('pilot admission receipt does not reproduce exact source candidate and canonical predecessor evidence');
  }
  return receipt;
}

module.exports = { validateReceiptAgainstCandidate };
