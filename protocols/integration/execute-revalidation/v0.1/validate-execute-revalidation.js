#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const here = __dirname;
const fixturePath = path.join(here, 'conformance.fixture.json');
const admissionPath = path.join(here, '..', '..', 'pre-action-authorize-admission', 'v0.1', 'conformance.fixture.json');

const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const admission = JSON.parse(fs.readFileSync(admissionPath, 'utf8'));

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

function validate(candidate) {
  eq(candidate.protocol, 'UU-AAP-EXECUTE-REVALIDATION', 'protocol');
  eq(candidate.version, '0.1', 'version');
  eq(candidate.artifact_type, 'ExecuteRevalidationDecision', 'artifact_type');
  if (!candidate.decision_id) fail('decision_id missing');

  eq(candidate.authorize_admission_ref.assessment_id, admission.assessment_id, 'authorize admission id');
  eq(candidate.authorize_admission_ref.content_hash, admission.content_hash, 'authorize admission hash');
  eq(candidate.authorize_admission_ref.status, 'admissible', 'authorize admission status');
  eq(admission.decision.status, 'admissible', 'source admission decision');

  eq(candidate.subject.id, admission.subject.id, 'subject id');
  eq(candidate.subject.scope, admission.subject.scope, 'subject scope');

  const action = candidate.action_binding;
  const sourceAction = admission.action_binding;
  for (const key of ['capability_id','operation','authority_scope','target_binding_hash','predecessor_frontier']) {
    eq(action[key], sourceAction[key], `action binding ${key}`);
  }

  const fresh = candidate.freshness_binding;
  const sourceFresh = admission.freshness_binding;
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

validate(fixture);

const mutations = [
  ['stale after permit expiry', x => { x.evaluated_at = '2026-08-24T19:56:01Z'; }],
  ['extend execute horizon', x => { x.freshness_binding.execute_revalidation_must_occur_by = '2026-08-24T20:00:00Z'; }],
  ['replace admission id', x => { x.authorize_admission_ref.assessment_id += ':other'; }],
  ['replace admission hash', x => { x.authorize_admission_ref.content_hash = 'sha256:' + '0'.repeat(64); }],
  ['admission not admissible', x => { x.authorize_admission_ref.status = 'denied'; }],
  ['replace subject id', x => { x.subject.id += ':other'; }],
  ['replace subject scope', x => { x.subject.scope += ':other'; }],
  ['replace capability', x => { x.action_binding.capability_id += ':other'; }],
  ['replace operation', x => { x.action_binding.operation = 'other'; }],
  ['replace authority scope', x => { x.action_binding.authority_scope = 'other'; }],
  ['replace target', x => { x.action_binding.target_binding_hash = 'sha256:' + '1'.repeat(64); }],
  ['replace frontier', x => { x.action_binding.predecessor_frontier += ':other'; }],
  ['replace availability hash', x => { x.freshness_binding.availability_binding_hash = 'sha256:' + '2'.repeat(64); }],
  ['extend availability', x => { x.freshness_binding.availability_valid_until = '2026-08-24T20:00:00Z'; }],
  ['replace approval hash', x => { x.freshness_binding.approval_hash = 'sha256:' + '3'.repeat(64); }],
  ['extend approval', x => { x.freshness_binding.approval_valid_until = '2026-08-24T20:00:00Z'; }],
  ['replace permit hash', x => { x.freshness_binding.action_permit_hash = 'sha256:' + '4'.repeat(64); }],
  ['extend permit', x => { x.freshness_binding.permit_expires_at = '2026-08-24T20:00:00Z'; }],
  ['extend authorization horizon', x => { x.freshness_binding.authorization_must_occur_by = '2026-08-24T20:00:00Z'; }],
  ['make permit reusable', x => { x.freshness_binding.permit_one_shot = false; }],
  ['consume permit before execute', x => { x.freshness_binding.permit_consumed = true; }],
  ['wrong lifecycle protocol', x => { x.lifecycle_binding.protocol = 'OTHER'; }],
  ['wrong lifecycle version', x => { x.lifecycle_binding.version = '9'; }],
  ['wrong source phase', x => { x.lifecycle_binding.source_phase = 'prepare'; }],
  ['skip directly beyond execute', x => { x.lifecycle_binding.target_phase = 'observe'; }],
  ['escalate gate role', x => { x.lifecycle_binding.gate_role = 'execution_authority'; }],
  ['decision denied but claims ready assertions', x => { x.decision.status = 'denied'; }],
  ['drop admission binding assertion', x => { x.assertions.authorize_admission_exactly_bound = false; }],
  ['drop freshness assertion', x => { x.assertions.freshness_rechecked_at_execute_boundary = false; }],
  ['drop target assertion', x => { x.assertions.target_exactly_bound = false; }],
  ['drop frontier assertion', x => { x.assertions.frontier_exactly_bound = false; }],
  ['drop permit unconsumed assertion', x => { x.assertions.permit_unconsumed = false; }],
  ['claim permit consumption', x => { x.non_effects.permit_consumed = true; }],
  ['claim actuator invocation', x => { x.non_effects.actuator_invocation_emitted = true; }],
  ['claim action performed', x => { x.non_effects.action_performed = true; }],
  ['claim outcome observed', x => { x.non_effects.outcome_observed = true; }],
  ['claim authority expansion', x => { x.non_effects.authority_created_or_expanded = true; }],
  ['claim future permission', x => { x.non_effects.future_action_permission_created = true; }],
  ['claim general authority', x => { x.non_effects.general_authority_created = true; }],
  ['claim lifetime extension', x => { x.non_effects.availability_lifetime_extended = true; }],
  ['content hash laundering', x => { x.content_hash = 'sha256:' + 'f'.repeat(64); }],
];

let rejected = 0;
for (const [name, mutate] of mutations) {
  const candidate = structuredClone(fixture);
  mutate(candidate);
  try {
    validate(candidate);
    fail(`negative mutation unexpectedly passed: ${name}`);
  } catch (err) {
    if (String(err.message).startsWith('negative mutation unexpectedly passed')) throw err;
    rejected++;
  }
}
if (rejected !== mutations.length) fail(`negative mutation count mismatch: ${rejected}/${mutations.length}`);

console.log(`Execute Revalidation Gate v0.1: positive fixture valid; ${rejected} negative mutations rejected; no actuator invoked.`);
