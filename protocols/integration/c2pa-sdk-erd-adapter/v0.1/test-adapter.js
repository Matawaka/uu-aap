'use strict';

const assert = require('node:assert/strict');
const adapter = require('./adapter.js');
const ERD = require('../../event-responsive-dormancy/v0.1/event-responsive-dormancy.js');
const source = require('../../../../scripts/c2pa-swift-upstream-merge-reaudit/current-receipt.json');

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function expectThrow(fn, label) {
  let threw = false;
  try { fn(); } catch (_) { threw = true; }
  assert.equal(threw, true, label);
}
function signal(overrides = {}) {
  return {
    artifact_type: 'EventResponsiveWakeSignal',
    version: '0.1',
    signal_id: 'signal:test:swift-frontier-change',
    kind: 'SWIFT_PRESERVATION_FRONTIER_CHANGED',
    context_ref: adapter.CONTEXT_REF,
    scope_ref: adapter.scopeRef(source),
    evidence_ref: 'evidence:test:upstream-frontier-delta',
    source_assurance: 'EVIDENCE_BOUND',
    ...overrides,
  };
}

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test('accepted frozen C2PA source receipt validates', () => {
  assert.equal(adapter.validateAcceptedSourceReceipt(source), true);
});

test('dormant capability is deterministic', () => {
  assert.deepEqual(adapter.materializeDormantCapability(source), adapter.materializeDormantCapability(clone(source)));
});

test('dormant capability has no polling, background activity, inherited authority, intent or permit', () => {
  const c = adapter.materializeDormantCapability(source);
  for (const key of ['polling_enabled','background_activity_authorized','active_process','authority_inherited','intent_inherited','action_permit_inherited','external_effect_authority']) {
    assert.equal(c[key], false, key);
  }
  assert.deepEqual(c.wake_signal_kinds, ['SWIFT_PRESERVATION_FRONTIER_CHANGED','ANDROID_PRESERVATION_FRONTIER_CHANGED']);
});

test('matching Swift evidence-bound signal creates wake attention only', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal() });
  assert.equal(out.erd_wake_receipt.state, ERD.STATES.WAKE_ATTENTION_ONLY);
  assert.equal(out.adapter_receipt.wake_attention_only, true);
  assert.equal(out.adapter_receipt.separate_targeted_reaudit_review_required, true);
  assert.equal(out.adapter_receipt.next_admissible_interface, null);
  assert.equal(out.adapter_receipt.automatic_transition, false);
});

test('matching Android evidence-bound signal creates wake attention only', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal({
    signal_id: 'signal:test:android-frontier-change',
    kind: 'ANDROID_PRESERVATION_FRONTIER_CHANGED',
    evidence_ref: 'evidence:test:android-upstream-frontier-delta',
  }) });
  assert.equal(out.erd_wake_receipt.state, ERD.STATES.WAKE_ATTENTION_ONLY);
});

test('wrong context does not wake', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal({ context_ref: 'urn:other' }) });
  assert.equal(out.erd_wake_receipt.state, ERD.STATES.NO_WAKE_SIGNAL_MATCH);
  assert.equal(out.adapter_receipt.separate_targeted_reaudit_review_required, false);
});

test('wrong scope does not wake', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal({ scope_ref: 'urn:wrong-scope' }) });
  assert.equal(out.erd_wake_receipt.state, ERD.STATES.NO_WAKE_SIGNAL_MATCH);
});

test('unknown but structurally valid kind does not wake', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal({ kind: 'UNRELATED_UPSTREAM_EVENT' }) });
  assert.equal(out.erd_wake_receipt.state, ERD.STATES.NO_WAKE_SIGNAL_MATCH);
});

test('caller cannot inject ERD checks', () => {
  expectThrow(() => adapter.evaluateSignal({ source_receipt: source, wake_signal: signal(), checks: { current_evidence:true,current_authority:true,intent_corridor:true } }), 'checks injection');
});

test('unestablished signal assurance is rejected by adapter', () => {
  expectThrow(() => adapter.evaluateSignal({ source_receipt: source, wake_signal: signal({ source_assurance: 'UNESTABLISHED' }) }), 'unestablished signal');
});

test('Swift source frontier substitution fails closed', () => {
  const m = clone(source); m.upstream.main_sha = '0'.repeat(40);
  expectThrow(() => adapter.validateAcceptedSourceReceipt(m), 'Swift SHA substitution');
});

test('Swift public binary substitution fails closed', () => {
  const m = clone(source); m.upstream.public_binary_release = 'v0.0.13';
  expectThrow(() => adapter.validateAcceptedSourceReceipt(m), 'binary substitution');
});

test('Android source frontier substitution fails closed', () => {
  const m = clone(source); m.android.main_sha = '1'.repeat(40);
  expectThrow(() => adapter.validateAcceptedSourceReceipt(m), 'Android SHA substitution');
});

test('accepted source receipt fingerprint substitution fails closed', () => {
  const m = clone(source); m.receipt_fingerprint_sha256 = 'a'.repeat(64);
  expectThrow(() => adapter.validateAcceptedSourceReceipt(m), 'fingerprint substitution');
});

test('compatibility cannot be silently promoted', () => {
  const m = clone(source); m.current_cross_sdk_compatibility_established = true;
  expectThrow(() => adapter.validateAcceptedSourceReceipt(m), 'compatibility promotion');
});

test('source preservation cannot be silently promoted to lossless consumer preservation', () => {
  const m = clone(source); m.current_swift_lossless_preservation_established = true;
  expectThrow(() => adapter.validateAcceptedSourceReceipt(m), 'lossless preservation promotion');
});

test('historical evidence rewrite flag fails closed', () => {
  const m = clone(source); m.historical_evidence.pr_783_contract_rewritten = true;
  expectThrow(() => adapter.validateAcceptedSourceReceipt(m), 'historical rewrite');
});

test('direct ERD reuse is explicit and no RERC or RSIC dependency is created', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal() });
  assert.equal(out.adapter_receipt.direct_erd_reuse, true);
  assert.equal(out.adapter_receipt.claims.rerc_dependency_created, false);
  assert.equal(out.adapter_receipt.claims.rsic_composition_required, false);
});

test('matching signal can never expose READY or PreAction interface', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal() });
  assert.notEqual(out.erd_wake_receipt.state, ERD.STATES.READY_FOR_SEPARATE_ACTION_ADMISSION);
  assert.equal(out.erd_wake_receipt.next_admissible_interface, null);
  assert.equal(out.adapter_receipt.next_admissible_interface, null);
});

test('all ERD and adapter authority/action claims remain false', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal() });
  assert.equal(Object.values(out.erd_wake_receipt.claims).every(v => v === false), true);
  assert.equal(Object.values(out.adapter_receipt.claims).every(v => v === false), true);
});

test('source receipt is immutable across evaluation', () => {
  const input = clone(source); const before = JSON.stringify(input);
  adapter.evaluateSignal({ source_receipt: input, wake_signal: signal() });
  assert.equal(JSON.stringify(input), before);
});

test('wake signal is immutable across evaluation', () => {
  const s = signal(); const before = JSON.stringify(s);
  adapter.evaluateSignal({ source_receipt: source, wake_signal: s });
  assert.equal(JSON.stringify(s), before);
});

test('adapter evaluation is deterministic', () => {
  const a = adapter.evaluateSignal({ source_receipt: clone(source), wake_signal: signal() });
  const b = adapter.evaluateSignal({ source_receipt: clone(source), wake_signal: signal() });
  assert.deepEqual(a, b);
});

test('score confidence trust and verdict surfaces are absent', () => {
  const out = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal() });
  const text = JSON.stringify(out.adapter_receipt).toLowerCase();
  for (const forbidden of ['trust_score','compatibility_score','confidence_score','aggregate_score','canonical_verdict']) assert.equal(text.includes(forbidden), false, forbidden);
});

test('adapter receipt validator rejects authority promotion', () => {
  const r = adapter.evaluateSignal({ source_receipt: source, wake_signal: signal() }).adapter_receipt;
  r.claims.authority_created = true;
  expectThrow(() => adapter.validateAdapterReceipt(r), 'authority promotion');
});

console.log(`C2PA_SDK_ERD_ADAPTER_V0_1: ${passed}/${passed} PASS`);
