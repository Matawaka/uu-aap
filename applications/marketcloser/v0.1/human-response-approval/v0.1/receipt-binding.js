'use strict';

const Approval = require('./approval.js');

function deepEqual(a, b) {
  return JSON.stringify(Approval.canonicalize(a)) === JSON.stringify(Approval.canonicalize(b));
}

function validateReceiptForSource(input, receipt) {
  Approval.validateInput(input);
  Approval.validateReceipt(receipt);
  const expected = Approval.deriveReceipt(input);
  if (!deepEqual(expected, receipt)) {
    throw new Approval.MarketCloserHumanResponseApprovalError('approval receipt does not match exact source input');
  }
  return receipt;
}

module.exports = { validateReceiptForSource };
