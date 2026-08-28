'use strict';

const Runtime = require('./pilot-disposition.js');

function validateReceiptAgainstDisposition(input, receipt) {
  Runtime.validateInput(input);
  Runtime.validateReceipt(receipt);
  const expected = Runtime.deriveReceipt(input);
  if (JSON.stringify(Runtime.canonicalize(expected)) !== JSON.stringify(Runtime.canonicalize(receipt))) {
    throw new Runtime.ProductPilotDispositionError('disposition receipt does not reproduce exact source disposition and admission predecessor');
  }
  return receipt;
}

module.exports = { validateReceiptAgainstDisposition };
