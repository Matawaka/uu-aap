'use strict';

const Runtime = require('./deployment-observation.js');

function validateReceiptAgainstInput(receipt, input) {
  Runtime.validateInput(input);
  Runtime.validateReceipt(receipt);
  const expected = Runtime.deriveReceipt(input);
  const actualCanonical = JSON.stringify(Runtime.canonicalize(receipt));
  const expectedCanonical = JSON.stringify(Runtime.canonicalize(expected));
  if (actualCanonical !== expectedCanonical) {
    throw new Runtime.MarketCloserDeploymentObservationError(
      'receipt is self-consistent but not bound to the exact deployment observation input'
    );
  }
  return receipt;
}

module.exports = { validateReceiptAgainstInput };
