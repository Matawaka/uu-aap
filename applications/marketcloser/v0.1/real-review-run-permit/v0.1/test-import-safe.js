'use strict';

const Permit = require('./permit.js');
const Binding = require('./permit-binding.js');

if (Permit.PROTOCOL !== 'MARKETCLOSER-REAL-REVIEW-RUN-PERMIT') throw new Error('permit import mismatch');
if (typeof Permit.materializePermit !== 'function' || typeof Permit.evaluateCurrentness !== 'function') throw new Error('permit exports missing');
if (typeof Binding.assertPermitBinding !== 'function' || typeof Binding.assertDecisionBinding !== 'function') throw new Error('binding exports missing');

console.log('MarketCloser run permit import safety: PASS');
