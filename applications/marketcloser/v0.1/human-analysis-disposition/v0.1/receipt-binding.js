'use strict';

const Disposition = require('./disposition.js');

function canonical(value) { return JSON.stringify(Disposition.canonicalize(value)); }

function validateReceiptForInput(input, receipt) {
  Disposition.validateInput(input);
  Disposition.validateReceipt(receipt);
  const expected = Disposition.deriveReceipt(input);
  if (canonical(expected) !== canonical(receipt)) {
    throw new Disposition.MarketCloserHumanAnalysisDispositionError('disposition receipt does not match exact source input');
  }
  return receipt;
}

module.exports = { validateReceiptForInput };
