'use strict';

const crypto = require('crypto');

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + stable(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function hashWithoutContentHash(value) {
  const copy = structuredClone(value);
  delete copy.content_hash;
  return 'sha256:' + crypto.createHash('sha256').update(stable(copy)).digest('hex');
}

function fail(message) { throw new Error(message); }
function eq(actual, expected, label) { if (actual !== expected) fail(`${label}: ${actual} != ${expected}`); }
function time(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(`${label}: invalid date-time ${value}`);
  return parsed;
}

function validateEnvelope(candidate, sourceRevalidation) {
  if (!sourceRevalidation || typeof sourceRevalidation !== 'object') fail('source revalidation required');
  eq(sourceRevalidation.protocol, 'UU-AAP-EXECUTE-REVALIDATION', 'source protocol');
  eq(sourceRevalidation.version, '0.1', 'source version');
  eq(sourceRevalidation.artifact_type, 'ExecuteRevalidationDecision', 'source type');
  eq(sourceRevalidation.decision.status, 'ready', 'source ready');

  eq(candidate.protocol, 'UU-AAP-EXECUTION-INVOCATION-ENVELOPE', 'protocol');
  eq(candidate.version, '0.1', 'version');
  eq(candidate.artifact_type, 'ExecutionInvocationEnvelope', 'type');

  eq(candidate.execute_revalidation_ref.decision_id, sourceRevalidation.decision_id, 'revalidation id');
  eq(candidate.execute_revalidation_ref.content_hash, sourceRevalidation.content_hash, 'revalidation hash');
  eq(candidate.execute_revalidation_ref.status, 'ready', 'revalidation status');

  for (const key of ['id','scope']) eq(candidate.subject[key], sourceRevalidation.subject[key], `subject ${key}`);
  for (const key of ['capability_id','operation','authority_scope','target_binding_hash','predecessor_frontier']) {
    eq(candidate.action_binding[key], sourceRevalidation.action_binding[key], `action ${key}`);
  }

  eq(candidate.evidence_binding.availability_binding_hash, sourceRevalidation.freshness_binding.availability_binding_hash, 'availability');
  eq(candidate.evidence_binding.approval_hash, sourceRevalidation.freshness_binding.approval_hash, 'approval');
  eq(candidate.evidence_binding.action_permit_hash, sourceRevalidation.freshness_binding.action_permit_hash, 'permit');

  eq(candidate.invocation.adapter_role, 'transport_only', 'adapter role');
  eq(candidate.invocation.one_shot, true, 'one shot');
  eq(candidate.invocation.consumed, false, 'consumed');
  eq(candidate.invocation.expected_target_guard_used, true, 'target guard');
  eq(candidate.invocation.expected_predecessor_guard_used, true, 'frontier guard');

  if (time(candidate.created_at, 'created_at') > time(candidate.invocation.expires_at, 'expires_at')) fail('envelope created after expiry');
  if (time(candidate.invocation.expires_at, 'expires_at') > time(sourceRevalidation.freshness_binding.execute_revalidation_must_occur_by, 'execute_revalidation_must_occur_by')) {
    fail('envelope extends revalidation horizon');
  }

  for (const key of ['revalidation_exactly_bound','action_exactly_bound','permit_exactly_bound','guards_fail_closed','one_shot_unconsumed','adapter_not_authority_source']) {
    eq(candidate.assertions[key], true, `assert ${key}`);
  }
  for (const key of ['actuator_invocation_emitted','action_receipt_created','permit_consumed','action_performed','outcome_observed','authority_created_or_expanded','future_action_permission_created','general_authority_created','causality_proven','truth_certified','liability_established']) {
    eq(candidate.non_effects[key], false, `non-effect ${key}`);
  }

  eq(candidate.content_hash, hashWithoutContentHash(candidate), 'hash');
  return true;
}

module.exports = { hashWithoutContentHash, stable, validateEnvelope };
