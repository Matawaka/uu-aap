'use strict';

const Interop = require('./local-interoperability.js');

function canonicalText(value) {
  return JSON.stringify(Interop.canonicalize(value));
}

function validateReceiptAgainstScenario(receipt, scenario) {
  Interop.validateScenario(scenario);
  Interop.validateReceipt(receipt);
  const expected = Interop.buildReceipt(scenario);
  if (canonicalText(receipt) !== canonicalText(expected)) {
    throw new Interop.CrossProductLocalInteropError('receipt/source scenario binding mismatch');
  }
  return true;
}

module.exports = {
  validateReceiptAgainstScenario
};
