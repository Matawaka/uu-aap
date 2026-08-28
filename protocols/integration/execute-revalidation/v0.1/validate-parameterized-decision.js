'use strict';

const crypto = require('crypto');

function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
function hashWithoutContentHash(obj) {
  const copy = structuredClone(obj);
  delete copy.content_hash;
  return 'sha256:' + crypto.createHash('sha256').update(stable(copy)).digest('hex');
}
function fail(msg) { throw new Error(msg); }
function eq(actual, expected, label) { if (actual !== expected) fail(`${label}: expected ${expected}, got ${actual}`); }
function truth(value, label) { if (value !== true) fail(`${label}: expected true`); }
function falsity(value, label) { if (value !== false) fail(`${label}: expected false`); }
function time(s, label) {
  const n = Date.parse(s);
  if (!Number.isFinite(n)) fail(`${label}: invalid date-time ${s}`);
  return n;
}

function validateDecision(candidate, sourceAdmission) {
  if (!sourceAdmission || typeof sourceAdmission !== 'object' || Array.isArray(sourceAdmission)) fail('source admission missing');
  eq(candidate.protocol, 'UU-AAP-EXECUTE-REVALIDATION', 'protocol');
  eq(candidate.version, '0.1', 'version');
  eq(candidate.artifact_type, 'ExecuteRevalidationDecision', 'artifact_type');
  if (!candidate.decision_id) fail('decision_id missing');

  eq(candidate.authorize_admission_ref.assessment_id, sourceAdmission.assessment_id, 'authorize admission id');
  eq(candidate.authorize_admission_ref.content_hash, sourceAdmission.content_hash, 'authorize admission hash');
  eq(candidate.authorize_admission_ref.status, 'admissible', 'authorize admission status');
  eq(sourceAdmission.decision.status, 'admissible', 'source admission decision');

  eq(candidate.subject.id, sourceAdmission.subject.id, 'subject id');
  eq(candidate.subject.scope, sourceAdmission.subject.scope, 'subject scope');

  const action = candidate.action_binding;
  const sourceAction = sourceAdmission.action_binding;
  for (const key of ['capability_id','operation','authority_scope','target_binding_hash','predecessor_frontier']) {
    eq(action[key], sourceAction[key], `action binding ${key}`);
  }

  const fresh = candidate.freshness_binding;
  const sourceFresh = sourceAdmission.freshness_binding;
  for (const key of ['availability_binding_hash','availability_valid_until','approval_hash','approval_valid_until','action_permit_hash','permit_expires_at','authorization_must_occur_by']) {
    eq(fresh[key], sourceFresh[key], `freshness ${key}`);
  }
  eq(fresh.execute_revalidation_must_occur_by, sourceFresh.authorization_must_occur_by, 'execute horizon');
  eq(fresh.permit_one_shot, true, 'permit one-shot');
  eq(fresh.permit_consumed, false, 'permit consumed');

  eq(candidate.lifecycle_binding.protocol, 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE', 'lifecycle protocol');
  eq(candidate.lifecycle_binding.version, '0.1', 'lifecycle version');
  eq(candidate.lifecycle_binding.source_phase, 'authorize', 'source phase');
  eq(candidate.lifecycle_binding.target_phase, 'execute', 'target phase');
  eq(candidate.lifecycle_binding.gate_role, 'pre_execute_evidence', 'gate role');

  const evaluated = time(candidate.evaluated_at, 'evaluated_at');
  const bounds = [
    ['availability_valid_until', fresh.availability_valid_until],
    ['approval_valid_until', fresh.approval_valid_until],
    ['permit_expires_at', fresh.permit_expires_at],
    ['authorization_must_occur_by', fresh.authorization_must_occur_by],
    ['execute_revalidation_must_occur_by', fresh.execute_revalidation_must_occur_by],
  ];
  for (const [label, s] of bounds) {
    if (evaluated > time(s, label)) fail(`stale execute revalidation: evaluated_at > ${label}`);
  }

  eq(candidate.decision.status, 'ready', 'decision status');
  if (!Array.isArray(candidate.decision.reasons) || candidate.decision.reasons.length < 1) fail('decision reasons missing');

  for (const key of [
    'authorize_admission_exactly_bound',
    'freshness_rechecked_at_execute_boundary',
    'target_exactly_bound',
    'frontier_exactly_bound',
    'approval_exactly_bound',
    'permit_exactly_bound',
    'permit_preexists_revalidation',
    'permit_unconsumed',
    'execute_phase_only'
  ]) truth(candidate.assertions[key], `assertion ${key}`);

  for (const key of [
    'intent_created',
    'authority_created_or_expanded',
    'approval_created',
    'core_action_permit_created',
    'permit_consumed',
    'actuator_invocation_emitted',
    'action_performed',
    'outcome_observed',
    'availability_lifetime_extended',
    'future_action_permission_created',
    'general_authority_created',
    'causality_proven',
    'truth_certified',
    'liability_established'
  ]) falsity(candidate.non_effects[key], `non-effect ${key}`);

  eq(candidate.content_hash, hashWithoutContentHash(candidate), 'content hash');
  return true;
}

module.exports = {
  hashWithoutContentHash,
  stable,
  time,
  validateDecision,
};
