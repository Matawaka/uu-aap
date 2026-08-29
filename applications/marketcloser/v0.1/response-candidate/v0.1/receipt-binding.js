'use strict';

const Response = require('./response-candidate.js');

function canonical(value) {
  return JSON.stringify(Response.canonicalize(value));
}

function validateReceiptForSource(input, receipt) {
  Response.validateInput(input);
  Response.validateReceipt(receipt);
  const expected = Response.deriveReceipt(input);
  if (canonical(expected) !== canonical(receipt)) {
    throw new Response.MarketCloserResponseCandidateError('response candidate receipt does not match exact source input');
  }
  return receipt;
}

module.exports = { validateReceiptForSource };
