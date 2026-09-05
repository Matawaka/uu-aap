'use strict';

const ERD = require('../../event-responsive-dormancy/v0.1/event-responsive-dormancy.js');

const ACCEPTED = Object.freeze({
  source_schema: 'urn:uu-aap:c2pa-swift-targeted-reaudit-receipt:0.3',
  tracking_issue: 916,
  swift_repo: 'contentauth/c2pa-swift',
  swift_main: '6fa8a78c16abac3b3f7eb4832c2cc943c9c19f0f',
  swift_binary: 'v0.0.12',
  android_main: '077035cda5bf6849abf270829b98af789cc31e4f',
  observation_sha256: '0d71fe53f7adacb68a671e7d71d146a08036676ea095b83e7a791942ca531dea',
  receipt_fingerprint_sha256: 'a7ae8037e188e552c07106f546db16169757bb620250cfd8df17e05e2df77b53',
  qualification_blob: 'e68360a90e9963cb5a66f8f4a2f26a088f47b439',
  erd_module_blob: '2cadbd2f405391f4f97e100d77245757ce6b5a58',
});

const CONTEXT_REF = 'urn:uu-aap:c2pa-sdk-preservation';
const WAKE_KINDS = Object.freeze([
  'SWIFT_PRESERVATION_FRONTIER_CHANGED',
  'ANDROID_PRESERVATION_FRONTIER_CHANGED',
]);

const CLAIMS = Object.freeze({
  trigger_authorizes_targeted_reaudit: false,
  compatibility_pass_inferred: false,
  c2pa_conformance_established: false,
  old_authority_restored: false,
  old_intent_restored: false,
  old_action_permit_restored: false,
  action_permit_created: false,
  authority_created: false,
  background_polling_performed: false,
  background_activity_authorized: false,
  active_process_created: false,
  external_effect_performed: false,
  rerc_dependency_created: false,
  rsic_composition_required: false,
  stable_core_admission: false,
  interface_registry_successor: false,
  historical_evidence_rewritten: false,
  upstream_modified: false,
  trust_score_created: false,
  truth_certified: false,
});

function fail(message) { throw new Error(message); }
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} object required`);
  return value;
}
function exactKeys(value, allowed, label) {
  object(value, label);
  for (const key of Object.keys(value)) if (!allowed.has(key)) fail(`${label}: unknown field ${key}`);
}
function eq(actual, expected, label) { if (actual !== expected) fail(`${label} mismatch`); }
function allFalse(value, label) {
  object(value, label);
  if (Object.values(value).some(v => v !== false)) fail(`${label} must remain false`);
}

function validateAcceptedSourceReceipt(receipt) {
  object(receipt, 'source receipt');
  exactKeys(receipt, new Set([
    'android','cross_sdk_p0_3_complete','current_cross_sdk_compatibility_established',
    'current_swift_lossless_preservation_established','external_swiftpm_consumer','historical_evidence',
    'invariants','non_effects','observation_sha256','receipt_fingerprint_sha256','schema',
    'source_contract','tracking_issue','upstream'
  ]), 'source receipt');

  eq(receipt.schema, ACCEPTED.source_schema, 'source schema');
  eq(receipt.tracking_issue, ACCEPTED.tracking_issue, 'tracking issue');
  eq(receipt.observation_sha256, ACCEPTED.observation_sha256, 'observation sha256');
  eq(receipt.receipt_fingerprint_sha256, ACCEPTED.receipt_fingerprint_sha256, 'receipt fingerprint');
  eq(receipt.cross_sdk_p0_3_complete, false, 'P0.3 complete');
  eq(receipt.current_cross_sdk_compatibility_established, false, 'current cross-SDK compatibility');
  eq(receipt.current_swift_lossless_preservation_established, false, 'current Swift lossless preservation');

  exactKeys(receipt.upstream, new Set(['main_sha','pr_161_merged','public_binary_release','repository']), 'upstream');
  eq(receipt.upstream.repository, ACCEPTED.swift_repo, 'Swift repository');
  eq(receipt.upstream.main_sha, ACCEPTED.swift_main, 'Swift main');
  eq(receipt.upstream.pr_161_merged, true, 'Swift PR #161 merged');
  eq(receipt.upstream.public_binary_release, ACCEPTED.swift_binary, 'Swift public binary');

  exactKeys(receipt.source_contract, new Set(['claim_generator_additional_fields_present','classification','reader_crjson_present']), 'source contract');
  eq(receipt.source_contract.classification, 'CURRENT_MAIN_SOURCE_PASS', 'source contract classification');
  eq(receipt.source_contract.claim_generator_additional_fields_present, true, 'additional-fields presence');
  eq(receipt.source_contract.reader_crjson_present, true, 'reader crjson presence');

  exactKeys(receipt.external_swiftpm_consumer, new Set([
    'build_exit_code','classification','roundtrip_executed','roundtrip_exit_code','roundtrip_receipt_valid','source_binary_skew_marker'
  ]), 'SwiftPM consumer');
  eq(receipt.external_swiftpm_consumer.classification, 'BLOCKED_SOURCE_BINARY_SKEW', 'SwiftPM classification');
  eq(receipt.external_swiftpm_consumer.build_exit_code, 1, 'SwiftPM build exit');
  eq(receipt.external_swiftpm_consumer.roundtrip_executed, false, 'Swift roundtrip execution');
  eq(receipt.external_swiftpm_consumer.roundtrip_exit_code, null, 'Swift roundtrip exit');
  eq(receipt.external_swiftpm_consumer.roundtrip_receipt_valid, false, 'Swift roundtrip receipt');
  eq(receipt.external_swiftpm_consumer.source_binary_skew_marker, true, 'source-binary skew marker');

  exactKeys(receipt.android, new Set(['classification','main_sha','retest_performed']), 'Android');
  eq(receipt.android.classification, 'UNCHANGED_NO_RETEST_REQUIRED', 'Android classification');
  eq(receipt.android.main_sha, ACCEPTED.android_main, 'Android main');
  eq(receipt.android.retest_performed, false, 'Android retest');

  exactKeys(receipt.historical_evidence, new Set([
    'pr_781_historical_blocked_result_rewritten','pr_782_historical_results_rewritten','pr_783_contract_rewritten'
  ]), 'historical evidence');
  allFalse(receipt.historical_evidence, 'historical evidence');
  allFalse(receipt.non_effects, 'source non-effects');

  const expectedInvariants = new Set([
    'source preservation != consumer round-trip',
    'upstream merge != packaging compatibility',
    'packaging compatibility != semantic preservation',
    'semantic preservation != trust or authority',
    'successor result != historical rewrite',
  ]);
  if (!Array.isArray(receipt.invariants) || receipt.invariants.length !== expectedInvariants.size ||
      new Set(receipt.invariants).size !== receipt.invariants.length ||
      receipt.invariants.some(v => !expectedInvariants.has(v))) fail('source invariants mismatch');
  return true;
}

function scopeRef(receipt) {
  validateAcceptedSourceReceipt(receipt);
  return `urn:uu-aap:c2pa-sdk-preservation:baseline:${receipt.receipt_fingerprint_sha256}`;
}

function materializeDormantCapability(sourceReceipt) {
  validateAcceptedSourceReceipt(sourceReceipt);
  const capability = {
    artifact_type: 'EventResponsiveDormantCapability',
    version: '0.1',
    capability_id: 'c2pa-sdk-preservation-successor-watch:v0.1',
    context_ref: CONTEXT_REF,
    scope_ref: scopeRef(sourceReceipt),
    wake_signal_kinds: [...WAKE_KINDS],
    state: 'DORMANT',
    checkpoint_refs: [
      `c2pa-swift:main:${sourceReceipt.upstream.main_sha}`,
      `c2pa-swift:binary:${sourceReceipt.upstream.public_binary_release}`,
      `c2pa-android:main:${sourceReceipt.android.main_sha}`,
    ],
    provenance_refs: [
      `c2pa-swift-targeted-reaudit:${sourceReceipt.receipt_fingerprint_sha256}`,
      `rsic-qualification:Q1_C2PA_SDK_SUCCESSOR:${ACCEPTED.qualification_blob}`,
    ],
    predecessor: {
      run_id: 'c2pa-swift-upstream-merge-reaudit-v0.3',
      epoch: 1,
      lease_ref: null,
      intent_ref: null,
      action_permit_ref: null,
    },
    polling_enabled: false,
    background_activity_authorized: false,
    active_process: false,
    authority_inherited: false,
    intent_inherited: false,
    action_permit_inherited: false,
    external_effect_authority: false,
  };
  ERD.validateDormantCapability(capability);
  return capability;
}

function validateAdapterSignal(signal) {
  ERD.validateWakeSignal(signal);
  if (signal.source_assurance !== 'EVIDENCE_BOUND') fail('C2PA adapter requires EVIDENCE_BOUND wake signal');
  return true;
}

function validateAdapterReceipt(receipt) {
  object(receipt, 'adapter receipt');
  exactKeys(receipt, new Set([
    'artifact_type','version','source_receipt_fingerprint_sha256','source_observation_sha256',
    'signal_id','signal_kind','signal_evidence_ref','signal_source_assurance','dormant_capability_digest',
    'erd_wake_receipt_digest','erd_state','wake_attention_only','separate_targeted_reaudit_review_required',
    'direct_erd_reuse','source_frontier_unchanged','automatic_transition','next_admissible_interface','claims'
  ]), 'adapter receipt');
  eq(receipt.artifact_type, 'C2PASDKEventResponsiveDormancyAdapterReceipt', 'adapter receipt type');
  eq(receipt.version, '0.1', 'adapter version');
  eq(receipt.source_receipt_fingerprint_sha256, ACCEPTED.receipt_fingerprint_sha256, 'adapter source fingerprint');
  eq(receipt.source_observation_sha256, ACCEPTED.observation_sha256, 'adapter source observation');
  if (!/^[0-9a-f]{64}$/.test(receipt.dormant_capability_digest || '')) fail('dormant capability digest invalid');
  if (!/^[0-9a-f]{64}$/.test(receipt.erd_wake_receipt_digest || '')) fail('ERD wake receipt digest invalid');
  eq(receipt.signal_source_assurance, 'EVIDENCE_BOUND', 'signal source assurance');
  if (![ERD.STATES.WAKE_ATTENTION_ONLY, ERD.STATES.NO_WAKE_SIGNAL_MATCH].includes(receipt.erd_state)) fail('adapter ERD state forbidden');
  const matched = receipt.erd_state === ERD.STATES.WAKE_ATTENTION_ONLY;
  eq(receipt.wake_attention_only, matched, 'wake attention flag');
  eq(receipt.separate_targeted_reaudit_review_required, matched, 'separate review flag');
  eq(receipt.direct_erd_reuse, true, 'direct ERD reuse');
  eq(receipt.source_frontier_unchanged, true, 'source frontier unchanged');
  eq(receipt.automatic_transition, false, 'automatic transition');
  eq(receipt.next_admissible_interface, null, 'next admissible interface');
  exactKeys(receipt.claims, new Set(Object.keys(CLAIMS)), 'adapter claims');
  for (const [key, value] of Object.entries(CLAIMS)) eq(receipt.claims[key], value, `claim ${key}`);
  return true;
}

function evaluateSignal(input) {
  object(input, 'adapter input');
  exactKeys(input, new Set(['source_receipt','wake_signal']), 'adapter input');
  validateAcceptedSourceReceipt(input.source_receipt);
  validateAdapterSignal(input.wake_signal);
  const sourceBefore = ERD.digest(input.source_receipt);
  const signalBefore = ERD.digest(input.wake_signal);
  const dormantCapability = materializeDormantCapability(input.source_receipt);

  // Intentionally fixed to null: the C2PA adapter can create attention only.
  const erdWakeReceipt = ERD.evaluateWake({
    dormant_capability: dormantCapability,
    wake_signal: input.wake_signal,
    checks: null,
  });

  if (![ERD.STATES.WAKE_ATTENTION_ONLY, ERD.STATES.NO_WAKE_SIGNAL_MATCH].includes(erdWakeReceipt.state)) {
    fail('C2PA adapter crossed attention-only ERD boundary');
  }
  if (erdWakeReceipt.next_admissible_interface !== null || erdWakeReceipt.automatic_transition !== false) {
    fail('C2PA adapter exposed action-admission transition');
  }
  if (Object.values(erdWakeReceipt.claims).some(v => v !== false)) fail('ERD wake receipt overclaim');
  if (sourceBefore !== ERD.digest(input.source_receipt)) fail('source receipt mutated');
  if (signalBefore !== ERD.digest(input.wake_signal)) fail('wake signal mutated');

  const matched = erdWakeReceipt.state === ERD.STATES.WAKE_ATTENTION_ONLY;
  const adapterReceipt = {
    artifact_type: 'C2PASDKEventResponsiveDormancyAdapterReceipt',
    version: '0.1',
    source_receipt_fingerprint_sha256: input.source_receipt.receipt_fingerprint_sha256,
    source_observation_sha256: input.source_receipt.observation_sha256,
    signal_id: input.wake_signal.signal_id,
    signal_kind: input.wake_signal.kind,
    signal_evidence_ref: input.wake_signal.evidence_ref,
    signal_source_assurance: input.wake_signal.source_assurance,
    dormant_capability_digest: ERD.digest(dormantCapability),
    erd_wake_receipt_digest: ERD.digest(erdWakeReceipt),
    erd_state: erdWakeReceipt.state,
    wake_attention_only: matched,
    separate_targeted_reaudit_review_required: matched,
    direct_erd_reuse: true,
    source_frontier_unchanged: true,
    automatic_transition: false,
    next_admissible_interface: null,
    claims: { ...CLAIMS },
  };
  validateAdapterReceipt(adapterReceipt);
  return { dormant_capability: dormantCapability, erd_wake_receipt: erdWakeReceipt, adapter_receipt: adapterReceipt };
}

module.exports = {
  ACCEPTED,
  CONTEXT_REF,
  WAKE_KINDS,
  materializeDormantCapability,
  validateAcceptedSourceReceipt,
  validateAdapterSignal,
  validateAdapterReceipt,
  evaluateSignal,
  scopeRef,
};
