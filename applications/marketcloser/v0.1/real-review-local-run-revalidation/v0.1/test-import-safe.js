'use strict';

const Runtime = require('./revalidation.js');
const Binding = require('./receipt-binding.js');
const Helper = require('./synthetic-positive-helper.js');

if (typeof Runtime.deriveReceipt !== 'function') throw new Error('deriveReceipt export missing');
if (typeof Runtime.validateReceipt !== 'function') throw new Error('validateReceipt export missing');
if (typeof Binding.validateReceiptSourceBinding !== 'function') throw new Error('receipt binding export missing');
if (typeof Helper.buildPositive !== 'function') throw new Error('synthetic helper export missing');

console.log('MarketCloser local run revalidation import safety: PASS');
