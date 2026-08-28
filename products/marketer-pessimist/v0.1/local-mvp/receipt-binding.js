'use strict';

const Runtime = require('./stress-test.js');

function canonicalEqual(left, right) {
  return JSON.stringify(Runtime.canonicalize(left)) === JSON.stringify(Runtime.canonicalize(right));
}

function validateReceiptAgainstInput(input, receipt) {
  Runtime.validateInput(input);
  Runtime.validateReceipt(receipt);
  const expected = Runtime.analyze(input);
  if (!canonicalEqual(receipt, expected)) {
    throw new Runtime.MarketerPessimistMVPError(
      'stress-test receipt does not bind exactly to the supplied source input'
    );
  }
  return receipt;
}

module.exports = { validateReceiptAgainstInput };
