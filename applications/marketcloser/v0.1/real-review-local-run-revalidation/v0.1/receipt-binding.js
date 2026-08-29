'use strict';

const Revalidation = require('./revalidation.js');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) { return JSON.stringify(Revalidation.canonicalize(value)); }

function validateReceiptSourceBinding(input, receipt) {
  Revalidation.validateInput(input);
  Revalidation.validateReceipt(receipt);
  const expected = Revalidation.deriveReceipt(clone(input));
  if (canonical(expected) !== canonical(receipt)) {
    throw new Revalidation.MarketCloserRealReviewLocalRunRevalidationError('revalidation receipt does not bind exact source input');
  }
  return true;
}

module.exports = { validateReceiptSourceBinding };
