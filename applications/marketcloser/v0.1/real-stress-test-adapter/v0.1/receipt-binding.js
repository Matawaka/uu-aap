'use strict';

const Adapter = require('./adapter.js');

function canonical(value) { return JSON.stringify(Adapter.canonicalize(value)); }

function assertExactBinding(input, receipt) {
  Adapter.validateInput(input);
  Adapter.validateReceipt(receipt);
  const expected = Adapter.stressTest(input);
  if (canonical(expected) !== canonical(receipt)) {
    throw new Adapter.MarketCloserRealStressTestAdapterError('stress-test receipt does not bind to exact adapter input and predecessor chain');
  }
  return receipt;
}

module.exports = { assertExactBinding };
