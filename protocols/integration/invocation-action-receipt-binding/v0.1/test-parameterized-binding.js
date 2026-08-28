'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateBinding } = require('./validate-parameterized-binding.js');

const ROOT = __dirname;
const bindingFixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'conformance.fixture.json'), 'utf8'));
const envelopeFixture = JSON.parse(fs.readFileSync(path.join(ROOT, '..', '..', 'execution-invocation-envelope', 'v0.1', 'conformance.fixture.json'), 'utf8'));
const DEMO_RESOURCE = 'urn:uu-aap:resource:demo-target';
const clone = value => structuredClone(value);

const historical = spawnSync(process.execPath, [path.join(ROOT, 'validate-invocation-action-receipt-binding.js')], { encoding: 'utf8' });
assert.strictEqual(historical.status, 0, historical.stderr);
assert(/29 negative mutations rejected/.test(historical.stdout), historical.stdout);

assert.strictEqual(validateBinding(bindingFixture, envelopeFixture, DEMO_RESOURCE), true);

const mutations = [
  ['envelope id', value => { value.invocation_envelope_ref.envelope_id += 'x'; }],
  ['envelope hash', value => { value.invocation_envelope_ref.content_hash = `sha256:${'0'.repeat(64)}`; }],
  ['invocation id', value => { value.invocation_evidence.invocation_id += 'x'; }],
  ['adapter', value => { value.invocation_evidence.adapter_id += 'x'; }],
  ['target', value => { value.invocation_evidence.target_binding_hash = `sha256:${'1'.repeat(64)}`; }],
  ['frontier', value => { value.invocation_evidence.predecessor_frontier += 'x'; }],
  ['not emitted', value => { value.invocation_evidence.emission_status = 'planned'; }],
  ['target guard', value => { value.invocation_evidence.expected_target_guard_passed = false; }],
  ['frontier guard', value => { value.invocation_evidence.expected_predecessor_guard_passed = false; }],
  ['envelope not consumed', value => { value.invocation_evidence.one_shot_envelope_consumed = false; }],
  ['permit not consumed', value => { value.invocation_evidence.action_permit_consumed = false; }],
  ['evidence outcome', value => { value.invocation_evidence.non_effects.outcome_observed = true; }],
  ['action frontier relabel', value => { value.core_action_receipt.frontier.revision = 'successor'; }],
  ['permit predecessor', value => { value.core_action_receipt.predecessor_receipt_hashes[0] = `sha256:${'2'.repeat(64)}`; }],
  ['extra predecessor', value => { value.core_action_receipt.predecessor_receipt_hashes.push(`sha256:${'3'.repeat(64)}`); }],
  ['performed false', value => { value.core_action_receipt.assertions.action_performed = false; }],
  ['scope escalation', value => { value.core_action_receipt.assertions.performed_scope = 'all'; }],
  ['receipt outcome', value => { value.core_action_receipt.non_effects.outcome_observed = true; }],
  ['truth', value => { value.core_action_receipt.non_effects.truth_certified = true; }],
  ['liability', value => { value.core_action_receipt.non_effects.liability_established = true; }],
  ['effect ref', value => { value.core_action_receipt.payload.effect_ref = `sha256:${'4'.repeat(64)}`; }],
  ['core hash', value => { value.core_action_receipt.content_hash = `sha256:${'5'.repeat(64)}`; }],
  ['binding outcome', value => { value.non_effects.outcome_observed = true; }],
  ['successor', value => { value.non_effects.successor_state_established = true; }],
  ['causality', value => { value.non_effects.causality_proven = true; }],
  ['authority', value => { value.non_effects.authority_created_or_expanded = true; }],
  ['future', value => { value.non_effects.future_action_permission_created = true; }],
  ['assert frontier', value => { value.assertions.action_receipt_on_predecessor_frontier = false; }],
  ['binding hash', value => { value.content_hash = `sha256:${'f'.repeat(64)}`; }],
];

let rejected = 0;
for (const [name, mutate] of mutations) {
  const candidate = clone(bindingFixture);
  mutate(candidate);
  let failed = false;
  try { validateBinding(candidate, envelopeFixture, DEMO_RESOURCE); }
  catch (_) { failed = true; }
  assert(failed, `historical mutation unexpectedly accepted: ${name}`);
  rejected += 1;
}
assert.strictEqual(rejected, 29);

assert.throws(
  () => validateBinding(bindingFixture, envelopeFixture, 'urn:uu-aap:resource:other'),
  /performed scope/,
);
assert.throws(
  () => validateBinding(bindingFixture, envelopeFixture, ''),
  /performedResourceRef must be non-empty string/,
);

const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(ROOT, 'validate-parameterized-binding.js'))})`], { encoding: 'utf8' });
assert.strictEqual(imported.status, 0, imported.stderr);
assert.strictEqual(imported.stdout, '');
assert.strictEqual(imported.stderr, '');

process.stdout.write('PASS parameterized Invocation↔ActionReceipt seam: 29 historical mutations preserved; performed resource identity is explicit.\n');
