'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./kontur-consolidated-demo.js');

const EXAMPLE = path.join(__dirname, 'examples/phase-d-synthetic.input.json');
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function mutatedInput(base, mutation) {
  const copy = clone(base);
  mutation(copy);
  Runtime.rehash(copy);
  return copy;
}
function reject(name, fn, pattern = null) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected rejection`);
  if (pattern) assert.match(error.message, pattern, `${name}: unexpected rejection`);
}

const input = readJson(EXAMPLE);
Runtime.validateInput(input);
const receipt = Runtime.deriveReceipt(input);
const receipt2 = Runtime.deriveReceipt(clone(input));
assert.deepStrictEqual(receipt2, receipt, 'consolidation receipt must be deterministic');
assert.strictEqual(receipt.receipt_type, Runtime.RECEIPT_TYPE);
assert.strictEqual(receipt.state, Runtime.STATE);
assert.strictEqual(receipt.next_safe_action, Runtime.NEXT_SAFE_ACTION);
assert.strictEqual(receipt.family_review.member_count, 6);
assert.strictEqual(receipt.family_review.established_edge_count, 4);
assert.strictEqual(receipt.family_review.planned_edge_count, 2);
assert.strictEqual(receipt.game_companion_review.layer_count, 7);
assert.strictEqual(receipt.pause_recovery_review.background_activity_during_pause, false);
assert.strictEqual(receipt.field_outcome_review.excluded_data.raw_game_history, false);
assert.strictEqual(receipt.synthetic_demo_metrics.network_call_count, 0);
assert.strictEqual(receipt.synthetic_demo_metrics.external_effect_count, 0);
for (const key of Runtime.TRUE_CLAIMS) assert.strictEqual(receipt.claims[key], true, `${key} must be true`);
for (const key of Runtime.FALSE_CLAIMS) assert.strictEqual(receipt.claims[key], false, `${key} must remain false`);

reject('wrong_contract_hash', () => Runtime.validateInput(mutatedInput(input, x => { x.family_binding.product_contract_hash = `sha256:${'0'.repeat(64)}`; })), /Product Contract hash mismatch/);
reject('wrong_manifest_hash', () => Runtime.validateInput(mutatedInput(input, x => { x.family_binding.family_manifest_hash = `sha256:${'0'.repeat(64)}`; })), /manifest hash mismatch/);
reject('readiness_member_substitution', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.readiness.member_id = 'other'; })), /member id mismatch/);
reject('readiness_activation_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.readiness.activation_authorized = true; })), /cannot authorize activation/);
reject('activation_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.activation.activation_performed = true; })), /cannot claim activation/);
reject('preflight_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.activation.preflight_run = true; })), /cannot claim preflight/);
reject('kernel_activation_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.kernel.kernel_activated = true; })), /kernel must remain not activated/);
reject('responsibility_acceptance_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.kernel.responsibility_accepted = true; })), /responsibility must remain unaccepted/);
reject('ledger_mutation_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.ledger.ledger_mutated = true; })), /cannot mutate ledger/);
reject('host_designation_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.live_host.host_designated = true; })), /cannot designate host/);
reject('executor_binding_overclaim', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.live_host.executor_bound = true; })), /cannot bind executor/);
reject('game_chain_layer_removed', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.game_companion.layer_ids.pop(); })), /layer ordering mismatch/);
reject('game_chain_not_closed', () => Runtime.validateInput(mutatedInput(input, x => { x.component_reviews.game_companion.chain_closed = false; })), /chain must be closed/);
reject('pause_background_activity', () => Runtime.validateInput(mutatedInput(input, x => { x.pause_recovery.background_activity_during_pause = true; })), /background activity during pause forbidden/);
reject('pause_successor_authority', () => Runtime.validateInput(mutatedInput(input, x => { x.pause_recovery.pause_creates_successor_authority = true; })), /pause cannot create successor authority/);
reject('privacy_raw_history', () => Runtime.validateInput(mutatedInput(input, x => { x.field_outcomes.excluded_data.raw_game_history = true; })), /raw_game_history must remain false/);
reject('privacy_attention_profile', () => Runtime.validateInput(mutatedInput(input, x => { x.field_outcomes.excluded_data.attention_profile = true; })), /attention_profile must remain false/);
reject('metric_network_call', () => Runtime.validateInput(mutatedInput(input, x => { x.metrics.network_call_count = 1; })), /network_call_count must remain zero/);
reject('metric_ledger_write', () => Runtime.validateInput(mutatedInput(input, x => { x.metrics.ledger_mutation_count = 1; })), /ledger_mutation_count must remain zero/);
reject('metric_production_telemetry', () => Runtime.validateInput(mutatedInput(input, x => { x.metrics.measurement_class = 'production_telemetry'; })), /synthetic_demo_metrics/);
reject('control_activation_available', () => Runtime.validateInput(mutatedInput(input, x => { x.controls.activation_available = true; })), /activation_available must remain false/);
reject('control_runtime_start_available', () => Runtime.validateInput(mutatedInput(input, x => { x.controls.runtime_start_available = true; })), /runtime_start_available must remain false/);

for (const claim of Runtime.FALSE_CLAIMS) {
  reject(`receipt_overclaim_${claim}`, () => {
    const changed = clone(receipt);
    changed.claims[claim] = true;
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
  }, new RegExp(claim));
}
reject('receipt_unknown_claim', () => {
  const changed = clone(receipt);
  changed.claims.unknown_claim = false;
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /claims keys mismatch/);
reject('receipt_state_overclaim', () => {
  const changed = clone(receipt);
  changed.state = 'PRODUCTION_READY';
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /state mismatch/);
reject('receipt_next_action_overclaim', () => {
  const changed = clone(receipt);
  changed.next_safe_action = 'ACTIVATE';
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /next_safe_action mismatch/);
reject('receipt_metric_network_overclaim', () => {
  const changed = clone(receipt);
  changed.synthetic_demo_metrics.network_call_count = 1;
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /network_call_count must remain zero/);

for (const cmd of ['activate', 'start', 'run', 'execute', 'write-ledger', 'designate-host', 'bind-executor', 'message', 'play', 'mutate', 'promote']) {
  reject(`forbidden_cli_${cmd}`, () => Runtime.runCli([cmd, '-']), /unsupported command/);
}

const validation = Runtime.validationReceipt(input);
assert.strictEqual(validation.valid, true);
assert.strictEqual(validation.activation_performed, false);
assert.strictEqual(validation.runtime_started, false);
assert.strictEqual(validation.ledger_mutated, false);
assert.strictEqual(validation.external_effect_performed, false);
console.log('KONTUR_CONSOLIDATED_MEASURABLE_DEMO_V0_1_PASS');
