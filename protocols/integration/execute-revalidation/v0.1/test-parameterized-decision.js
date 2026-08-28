'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { hashWithoutContentHash, validateDecision } = require('./validate-parameterized-decision.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'conformance.fixture.json'), 'utf8'));
const admission = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'pre-action-authorize-admission', 'v0.1', 'conformance.fixture.json'), 'utf8'));
const historicalPath = path.join(__dirname, 'validate-execute-revalidation.js');

const historical = spawnSync(process.execPath, [historicalPath], { encoding: 'utf8' });
assert.strictEqual(historical.status, 0, historical.stderr);
assert(/Execute Revalidation Gate v0\.1: positive fixture valid; 41 negative mutations rejected/.test(historical.stdout), historical.stdout);

assert.strictEqual(validateDecision(fixture, admission), true);

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
    validateDecision(candidate, admission);
    throw new Error(`PASSED ${name}`);
  } catch (error) {
    if (error.message.startsWith('PASSED ')) throw error;
    rejected++;
  }
}
assert.strictEqual(rejected, mutations.length);

const imported = spawnSync(process.execPath, ['-e', `
  const m=require(${JSON.stringify(path.join(__dirname, 'validate-parameterized-decision.js'))});
  if(typeof m.validateDecision!=='function') process.exit(9);
`], { encoding: 'utf8' });
assert.strictEqual(imported.status, 0, imported.stderr);
assert.strictEqual(imported.stdout, '');
assert.strictEqual(imported.stderr, '');

const rehashed = structuredClone(fixture);
rehashed.content_hash = hashWithoutContentHash(rehashed);
assert.strictEqual(rehashed.content_hash, fixture.content_hash);
process.stdout.write(`PASS parameterized Execute Revalidation seam (${rejected} historical mutations rejected)\n`);
