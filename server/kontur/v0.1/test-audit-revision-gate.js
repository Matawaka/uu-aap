'use strict';

const assert = require('assert');
const Gate = require('./audit-revision-gate.js');

const REQUIRED = 'd4e3efd63416d9ef97d868fea096d966b843b350';
const STALE = '9894f6be4be663863696c5981d3d68c3c6777525';

function expectRejected(label, context, expectedStale) {
  let callbackCalls = 0;
  let caught = null;
  try {
    Gate.runAfterGate(context, () => { callbackCalls += 1; });
  } catch (error) {
    caught = error;
  }
  assert(caught, `${label}: rejection required`);
  assert(caught.receipt, `${label}: structured rejection receipt required`);
  assert.strictEqual(caught.receipt.decision, 'audit_revision_rejected');
  assert.strictEqual(caught.receipt.claims.audit_may_continue, false);
  assert.strictEqual(caught.receipt.claims.stale_checkout_detected, expectedStale);
  assert.strictEqual(caught.receipt.claims.fallback_inference_used, false);
  assert.strictEqual(caught.receipt.claims.inherited_readiness_used, false);
  assert.strictEqual(caught.receipt.claims.state_change_authorized, false);
  assert.strictEqual(callbackCalls, 0, `${label}: substantive audit callback must not run`);
}

const exact = Gate.runAfterGate({
  requiredRevision: REQUIRED,
  remoteMainRevision: REQUIRED,
  checkoutRevision: REQUIRED
}, receipt => receipt.decision);
assert.strictEqual(exact.receipt.decision, 'audit_revision_verified');
assert.strictEqual(exact.receipt.claims.exact_revision_match, true);
assert.strictEqual(exact.receipt.claims.audit_may_continue, true);
assert.strictEqual(exact.receipt.claims.fallback_inference_used, false);
assert.strictEqual(exact.receipt.claims.inherited_readiness_used, false);
assert.strictEqual(exact.receipt.claims.state_change_authorized, false);
assert.strictEqual(exact.result, 'audit_revision_verified');

// Concrete accepted regression from the independent KONTUR audit:
// the historical #226 checkout must never inherit readiness for d4e3efd...
expectRejected('historical stale checkout', {
  requiredRevision: REQUIRED,
  remoteMainRevision: REQUIRED,
  checkoutRevision: STALE
}, true);

expectRejected('remote main mismatch', {
  requiredRevision: REQUIRED,
  remoteMainRevision: STALE,
  checkoutRevision: REQUIRED
}, false);

expectRejected('both observations stale', {
  requiredRevision: REQUIRED,
  remoteMainRevision: STALE,
  checkoutRevision: STALE
}, true);

for (const field of ['requiredRevision', 'remoteMainRevision', 'checkoutRevision']) {
  const context = { requiredRevision: REQUIRED, remoteMainRevision: REQUIRED, checkoutRevision: REQUIRED };
  context[field] = 'not-a-sha';
  assert.throws(() => Gate.assess(context), /exact 40-hex SHA/);
}

console.log('KONTUR audit revision gate v0.1: PASS');
