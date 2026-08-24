#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { runScenario, sha256 } = require('./run-harness.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'scenarios.fixture.json'), 'utf8'));
const allow = fixture.scenarios.find(x => x.scenario_id === 'dry-run-allow-exact-frontier');
const stale = fixture.scenarios.find(x => x.scenario_id === 'dry-run-deny-stale-head');

function clone(x) { return JSON.parse(JSON.stringify(x)); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function expectDeny(name, mutate, reason) {
  const s = clone(allow);
  s.scenario_id = 'negative-' + name;
  mutate(s);
  const r = runScenario(s);
  assert(r.decision === 'deny', `${name}: expected deny`);
  assert(r.actuator_call_emitted === false, `${name}: actuator call emitted`);
  assert(r.planned_call === null, `${name}: planned call must be null`);
  if (reason) assert(r.reasons.includes(reason), `${name}: missing reason ${reason}`);
}

const good = runScenario(allow);
assert(good.decision === 'allow_plan', 'positive must allow plan');
assert(good.actuator_call_emitted === false, 'positive must not emit actuator call');
assert(good.planned_call && good.planned_call.arguments.repository === allow.authorized.repository, 'positive plan binding');
const withoutHash = Object.fromEntries(Object.entries(good).filter(([k]) => k !== 'content_hash'));
assert(good.content_hash === sha256(withoutHash), 'positive content hash');

const denied = runScenario(stale);
assert(denied.decision === 'deny', 'stale fixture must deny');
assert(denied.reasons.includes('stale_or_mismatched_head'), 'stale reason');
assert(denied.planned_call === null, 'stale must not plan call');

expectDeny('non-admissible', s => s.authorized.decision = 'approval_required', 'gateway_decision_not_admissible');
expectDeny('missing-permit', s => delete s.authorized.action_permit_hash, 'missing_action_permit');
expectDeny('missing-approval', s => delete s.authorized.approval_reference, 'missing_explicit_approval');
expectDeny('live-execution', s => s.live_execution_enabled = true, 'live_execution_must_be_false');
expectDeny('wrong-mode', s => s.mode = 'live', 'mode_not_dry_run');
expectDeny('transport-authority', s => s.transport.transport_defines_authority = true, 'transport_defines_authority');
expectDeny('repo-switch', s => s.current_state.repository = 'Other/repo', 'repository_mismatch');
expectDeny('pr-switch', s => s.current_state.pr_number = 1000, 'pr_number_mismatch');
expectDeny('stale-base', s => s.current_state.base_sha = '8'.repeat(40), 'stale_or_mismatched_base');
expectDeny('bad-merge-method', s => s.authorized.merge_method = 'octopus', 'unsupported_merge_method');
expectDeny('effect-overlap', s => s.authorized.explicit_non_effects.push('pr_merged'), 'effect_non_effect_overlap');
expectDeny('secret-token', s => s.transport.api_token = 'forbidden', 'credential_material_forbidden');
expectDeny('wrong-tool', s => s.transport.tool_name = 'github.merge', 'unexpected_tool_name');
expectDeny('operation-substitution', s => s.authorized.operation = 'delete_repo', 'operation_not_merge_pr');

console.log('UU_AAP_AI_GATEWAY_REFERENCE_HARNESS_V0_1_PASS');
