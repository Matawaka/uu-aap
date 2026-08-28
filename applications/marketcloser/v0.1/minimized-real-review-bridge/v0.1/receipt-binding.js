'use strict';

const Bridge = require('./bridge.js');

function canonical(value) {
  return JSON.stringify(Bridge.canonicalize(value));
}

function validateReceiptAgainstInput(receipt, input) {
  Bridge.validateInput(input);
  Bridge.validateReceipt(receipt);
  const expected = Bridge.deriveReceipt(input);
  if (canonical(receipt) !== canonical(expected)) {
    throw new Bridge.MarketCloserMinimizedRealReviewBridgeError(
      'Receipt Self-Consistency != Exact Bridge + Predecessor Binding'
    );
  }
  return receipt;
}

module.exports = { validateReceiptAgainstInput };
