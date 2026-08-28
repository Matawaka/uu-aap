'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateEnvelope } = require('./validate-parameterized-envelope.js');

const here = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(here, 'conformance.fixture.json'), 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'execute-revalidation', 'v0.1', 'conformance.fixture.json'), 'utf8'));
const historical = path.join(here, 'validate-invocation-envelope.js');

const historicalRun = spawnSync(process.execPath, [historical], { encoding: 'utf8', timeout: 10000 });
assert.strictEqual(historicalRun.status, 0, historicalRun.stderr);
assert(/31 negative mutations rejected/.test(historicalRun.stdout), historicalRun.stdout);
assert.strictEqual(validateEnvelope(fixture, source), true);

const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(here, 'validate-parameterized-envelope.js'))})`], { encoding: 'utf8', timeout: 5000 });
assert.strictEqual(imported.status, 0, imported.stderr);
assert.strictEqual(imported.stdout, '');
assert.strictEqual(imported.stderr, '');

const mutations = [
  ['reval id', x => { x.execute_revalidation_ref.decision_id += 'x'; }],
  ['reval hash', x => { x.execute_revalidation_ref.content_hash = 'sha256:' + '0'.repeat(64); }],
  ['status', x => { x.execute_revalidation_ref.status = 'denied'; }],
  ['subject', x => { x.subject.id += 'x'; }],
  ['scope', x => { x.subject.scope += 'x'; }],
  ['capability', x => { x.action_binding.capability_id += 'x'; }],
  ['operation', x => { x.action_binding.operation = 'other'; }],
  ['authority', x => { x.action_binding.authority_scope = 'other'; }],
  ['target', x => { x.action_binding.target_binding_hash = 'sha256:' + '1'.repeat(64); }],
  ['frontier', x => { x.action_binding.predecessor_frontier += 'x'; }],
  ['availability', x => { x.evidence_binding.availability_binding_hash = 'sha256:' + '2'.repeat(64); }],
  ['approval', x => { x.evidence_binding.approval_hash = 'sha256:' + '3'.repeat(64); }],
  ['permit', x => { x.evidence_binding.action_permit_hash = 'sha256:' + '4'.repeat(64); }],
  ['adapter role', x => { x.invocation.adapter_role = 'authority_source'; }],
  ['reuse', x => { x.invocation.one_shot = false; }],
  ['preconsume', x => { x.invocation.consumed = true; }],
  ['target guard', x => { x.invocation.expected_target_guard_used = false; }],
  ['frontier guard', x => { x.invocation.expected_predecessor_guard_used = false; }],
  ['extend expiry', x => { x.invocation.expires_at = '2026-08-24T20:00:00Z'; }],
  ['late create', x => { x.created_at = '2026-08-24T20:00:00Z'; }],
  ['invoke claim', x => { x.non_effects.actuator_invocation_emitted = true; }],
  ['action receipt claim', x => { x.non_effects.action_receipt_created = true; }],
  ['permit consumed claim', x => { x.non_effects.permit_consumed = true; }],
  ['action claim', x => { x.non_effects.action_performed = true; }],
  ['outcome claim', x => { x.non_effects.outcome_observed = true; }],
  ['authority claim', x => { x.non_effects.authority_created_or_expanded = true; }],
  ['future claim', x => { x.non_effects.future_action_permission_created = true; }],
  ['general authority', x => { x.non_effects.general_authority_created = true; }],
  ['guard assertion', x => { x.assertions.guards_fail_closed = false; }],
  ['adapter assertion', x => { x.assertions.adapter_not_authority_source = false; }],
  ['hash', x => { x.content_hash = 'sha256:' + 'f'.repeat(64); }],
];

let rejected = 0;
for (const [name, mutate] of mutations) {
  const candidate = structuredClone(fixture);
  mutate(candidate);
  try {
    validateEnvelope(candidate, source);
    throw new Error(`PASSED ${name}`);
  } catch (error) {
    if (error.message.startsWith('PASSED')) throw error;
    rejected++;
  }
}
assert.strictEqual(rejected, mutations.length);
process.stdout.write(`PASS parameterized Execution Invocation Envelope seam (${rejected} historical mutations rejected)\n`);
