'use strict';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const Publication = require('./publication-observation.js');
const Binding = require('./receipt-binding.js');
const Positive = require('./synthetic-positive-helper.js');

assert(typeof Publication.validateInput === 'function', 'validateInput export missing');
assert(typeof Publication.deriveReceipt === 'function', 'deriveReceipt export missing');
assert(typeof Publication.validateReceipt === 'function', 'validateReceipt export missing');
assert(typeof Binding.validateReceiptForSource === 'function', 'binding export missing');
assert(typeof Positive.buildPublicationInput === 'function', 'positive helper export missing');
console.log('MarketCloser Publication Observation import safety: PASS');
