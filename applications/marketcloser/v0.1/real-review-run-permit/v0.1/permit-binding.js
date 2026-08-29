'use strict';

const Permit = require('./permit.js');

function same(a, b) {
  return JSON.stringify(Permit.canonicalize(a)) === JSON.stringify(Permit.canonicalize(b));
}

function assertDecisionBinding(input, receipt) {
  const expected = Permit.deriveDecisionReceipt(input);
  if (!same(expected, receipt)) throw new Permit.MarketCloserRealReviewRunPermitError('decision receipt is not bound to exact materialization input');
  return true;
}

function assertPermitBinding(input, permit) {
  const expected = Permit.materializePermit(input);
  if (!same(expected, permit)) throw new Permit.MarketCloserRealReviewRunPermitError('run permit is not bound to exact materialization input');
  return true;
}

module.exports = { assertDecisionBinding, assertPermitBinding };
