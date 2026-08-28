'use strict';

const crypto = require('crypto');

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256Canonical(value) {
  return `sha256:${crypto.createHash('sha256').update(stable(value)).digest('hex')}`;
}

function bindingHash(value) {
  const copy = structuredClone(value);
  delete copy.content_hash;
  return sha256Canonical(copy);
}

function invocationEvidenceHash(value) {
  const copy = structuredClone(value);
  delete copy.content_hash;
  return sha256Canonical(copy);
}

function coreActionReceiptHash(value) {
  const copy = structuredClone(value);
  delete copy.content_hash;
  delete copy.signature_profile;
  return sha256Canonical(copy);
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, label) {
  requireCondition(actual === expected, `${label}: ${actual} != ${expected}`);
}

function nonEmptyString(value, label) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
}

function validateBinding(candidate, sourceEnvelope, performedResourceRef) {
  requireCondition(candidate && typeof candidate === 'object' && !Array.isArray(candidate), 'candidate must be object');
  requireCondition(sourceEnvelope && typeof sourceEnvelope === 'object' && !Array.isArray(sourceEnvelope), 'sourceEnvelope must be object');
  nonEmptyString(performedResourceRef, 'performedResourceRef');

  equal(candidate.protocol, 'UU-AAP-INVOCATION-ACTION-RECEIPT-BINDING', 'protocol');
  equal(candidate.version, '0.1', 'version');
  equal(candidate.invocation_envelope_ref.envelope_id, sourceEnvelope.envelope_id, 'envelope id');
  equal(candidate.invocation_envelope_ref.content_hash, sourceEnvelope.content_hash, 'envelope hash');

  const evidence = candidate.invocation_evidence;
  equal(evidence.envelope_id, sourceEnvelope.envelope_id, 'evidence envelope id');
  equal(evidence.envelope_content_hash, sourceEnvelope.content_hash, 'evidence envelope hash');
  equal(evidence.invocation_id, sourceEnvelope.invocation.invocation_id, 'invocation id');
  equal(evidence.adapter_id, sourceEnvelope.invocation.adapter_id, 'adapter');
  equal(evidence.target_binding_hash, sourceEnvelope.action_binding.target_binding_hash, 'target');
  equal(evidence.predecessor_frontier, sourceEnvelope.action_binding.predecessor_frontier, 'frontier');
  equal(evidence.emission_status, 'emitted', 'emission');
  equal(evidence.expected_target_guard_passed, true, 'target guard');
  equal(evidence.expected_predecessor_guard_passed, true, 'frontier guard');
  equal(evidence.one_shot_envelope_consumed, true, 'envelope consumed');
  equal(evidence.action_permit_consumed, true, 'permit consumed');
  equal(evidence.non_effects.outcome_observed, false, 'evidence outcome');
  equal(evidence.non_effects.causality_proven, false, 'evidence causality');
  equal(evidence.content_hash, invocationEvidenceHash(evidence), 'evidence hash');

  const actionReceipt = candidate.core_action_receipt;
  equal(actionReceipt.protocol, 'UU-AAP Core', 'core protocol');
  equal(actionReceipt.version, '0.1', 'core version');
  equal(actionReceipt.receipt_type, 'ActionReceipt', 'receipt type');
  equal(actionReceipt.subject.id, sourceEnvelope.subject.id, 'subject id');
  equal(actionReceipt.subject.scope, sourceEnvelope.subject.scope, 'subject scope');
  equal(actionReceipt.frontier.revision, sourceEnvelope.action_binding.predecessor_frontier, 'ActionReceipt frontier');
  requireCondition(actionReceipt.predecessor_receipt_hashes.length === 1, 'ActionReceipt must have exactly one predecessor');
  equal(actionReceipt.predecessor_receipt_hashes[0], sourceEnvelope.evidence_binding.action_permit_hash, 'ActionPermit predecessor');
  equal(actionReceipt.assertions.action_performed, true, 'action performed');
  equal(actionReceipt.assertions.performed_scope, `${sourceEnvelope.action_binding.operation}:${performedResourceRef}`, 'performed scope');
  equal(actionReceipt.non_effects.outcome_observed, false, 'outcome non-effect');
  equal(actionReceipt.non_effects.truth_certified, false, 'truth non-effect');
  equal(actionReceipt.non_effects.liability_established, false, 'liability non-effect');
  equal(actionReceipt.payload.effect_ref, evidence.content_hash, 'effect ref');
  equal(actionReceipt.content_hash, coreActionReceiptHash(actionReceipt), 'core action hash');

  for (const key of [
    'envelope_exactly_bound',
    'invocation_exactly_bound',
    'permit_consumed_by_execution',
    'action_receipt_core_identity_valid',
    'action_receipt_on_predecessor_frontier',
    'outcome_not_inferred',
  ]) equal(candidate.assertions[key], true, `assert ${key}`);

  for (const key of [
    'outcome_observed',
    'successor_state_established',
    'causality_proven',
    'truth_certified',
    'liability_established',
    'authority_created_or_expanded',
    'future_action_permission_created',
  ]) equal(candidate.non_effects[key], false, `non-effect ${key}`);

  equal(candidate.content_hash, bindingHash(candidate), 'binding hash');
  return true;
}

module.exports = {
  bindingHash,
  coreActionReceiptHash,
  invocationEvidenceHash,
  sha256Canonical,
  stable,
  validateBinding,
};
