'use strict';

const SHA40 = /^[0-9a-f]{40}$/;

function checkSha(value, label) {
  if (!SHA40.test(value || '')) throw new Error(`Audit revision gate: ${label} must be exact 40-hex SHA`);
}

function assess({ requiredRevision, remoteMainRevision, checkoutRevision }) {
  checkSha(requiredRevision, 'required revision');
  checkSha(remoteMainRevision, 'remote main revision');
  checkSha(checkoutRevision, 'checkout revision');

  const remoteMatches = remoteMainRevision === requiredRevision;
  const checkoutMatches = checkoutRevision === requiredRevision;
  const remoteCheckoutMatch = remoteMainRevision === checkoutRevision;
  const ok = remoteMatches && checkoutMatches && remoteCheckoutMatch;

  return {
    artifact_type: 'KONTURAuditRevisionGateReceipt',
    artifact_version: '0.1',
    required_revision: `git:${requiredRevision}`,
    observed_remote_main_revision: `git:${remoteMainRevision}`,
    observed_checkout_revision: `git:${checkoutRevision}`,
    decision: ok ? 'audit_revision_verified' : 'audit_revision_rejected',
    claims: {
      exact_revision_match: ok,
      stale_checkout_detected: !checkoutMatches,
      audit_may_continue: ok,
      fallback_inference_used: false,
      inherited_readiness_used: false,
      state_change_authorized: false
    }
  };
}

function requireExact(context) {
  const receipt = assess(context);
  if (!receipt.claims.audit_may_continue) {
    const error = new Error('Audit revision gate: exact canonical revision equality required');
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}

function runAfterGate(context, callback) {
  if (typeof callback !== 'function') throw new Error('Audit revision gate: callback required');
  const receipt = requireExact(context);
  return { receipt, result: callback(receipt) };
}

module.exports = { assess, requireExact, runAfterGate };
