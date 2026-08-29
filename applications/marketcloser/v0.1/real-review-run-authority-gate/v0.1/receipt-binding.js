'use strict';

const Gate = require('./authority-gate.js');

function canonicalEqual(a, b) {
  return JSON.stringify(Gate.canonicalize(a)) === JSON.stringify(Gate.canonicalize(b));
}

function validateBinding(input, receipt) {
  Gate.validateInput(input);
  Gate.validateReceipt(receipt);
  const expected = Gate.deriveReceipt(input);
  if (!canonicalEqual(expected, receipt)) {
    throw new Gate.MarketCloserRealReviewRunAuthorityGateError('authority gate receipt is not bound to exact source input');
  }
  return true;
}

module.exports = { validateBinding };
