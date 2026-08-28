'use strict';

const Runtime = require('./kontur-consolidated-demo.js');

function sameCanonical(left, right) {
  return JSON.stringify(Runtime.canonicalize(left)) === JSON.stringify(Runtime.canonicalize(right));
}

function validateReceiptAgainstInput(input, receipt, repoRoot) {
  Runtime.validateInput(input, repoRoot);
  Runtime.validateReceipt(receipt);
  const expected = Runtime.deriveReceipt(input, repoRoot);
  if (!sameCanonical(receipt, expected)) {
    throw new Runtime.KONTURConsolidatedDemoError('KONTUR consolidation receipt does not reproduce exact source input and canonical repository evidence');
  }
  return receipt;
}

module.exports = { validateReceiptAgainstInput };
