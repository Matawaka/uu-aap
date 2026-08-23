'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const { digestJson, validateResponsibilityEventChain } = require('./build-responsibility-event-chain.js');
const { validateResponsibilityEventChainReobservationReceipt } = require('./observe-responsibility-event-chain.js');

const EVENT_KIND = 'responsibility_event_chain_reobserved';
const SCALARS = new Set(['score','probability','percentage','weight','likelihood','confidence_score','causal_score','responsibility_score','blame_score','rating']);
const FALSE_CLAIMS = [
  'new_external_consequence_observed','generalized_external_consequence_causality_established','universal_causal_truth_established',
  'causal_proof_certified','responsibility_for_outcome_adjudicated','legal_responsibility_determined','legal_liability_established',
  'legal_effect_established','moral_blame_assigned','moral_correctness_established','truth_certified',
  'complete_global_wall_clock_chronology_established','remote_branch_or_ref_canonicality_established',
  'poai_materialization_event_recorded','poai_successor_record_identity_inferred','universal_canonicality_established','poai_v_conformance_established'
];
const assert = (v,m) => { if (!v) throw new Error(m); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const digest = (value) => ({canonicalization:'RFC8785-JCS',digest_algorithm:'SHA-256',digest_encoding:'hex',value});
function hasScalar(v) {
  if (!v || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some(hasScalar);
  return Object.entries(v).some(([k,c]) => SCALARS.has(k) || hasScalar(c));
}
async function hashText(text) { return Binding.sha256Hex(Binding.utf8Bytes(text)); }
function sources(a) {
  return {outcomeObservation:a.outcomeObservation,responsibilityTrace:a.responsibilityTrace,causalAssessment:a.causalAssessment,
    counterfactualAssessment:a.counterfactualAssessment,causalQualification:a.causalQualification,responsibilityAttribution:a.responsibilityAttribution};
}
async function binding(artifact, ref) {
  return {artifact_type:artifact.artifact_type,artifact_ref:ref,digest:digest(await digestJson(artifact))};
}
function appendedAssurance(baseChain) {
  const prior = clone(baseChain.events[baseChain.events.length - 1].assurance_snapshot);
  prior.chain_integrity_reobserved = true;
  return prior;
}
async function eventMaterialDigest(event) {
  const material = clone(event); delete material.event_digest; return digestJson(material);
}
function extensionMaterial(receipt) {
  return {
    appended_at:receipt.appended_at,
    base_chain_binding:clone(receipt.base_chain_binding),
    base_head:clone(receipt.base_head),
    source_reobservation_binding:clone(receipt.source_reobservation_binding),
    appended_event:{sequence:receipt.appended_event.sequence,event_id:receipt.appended_event.event_id,event_digest:clone(receipt.appended_event.event_digest)}
  };
}

async function buildResponsibilityEventAppendReceipt(args) {
  const baseChain = args.baseChain;
  const reobservation = args.reobservation;
  await validateResponsibilityEventChain({chain:baseChain,...sources(args)});
  await validateResponsibilityEventChainReobservationReceipt({receipt:reobservation,chain:baseChain,...sources(args)});
  assert(Date.parse(args.appendedAt) > Date.parse(reobservation.observed_at),
    'ResponsibilityEventAppendReceipt: append must occur after reobservation');
  assert(!hasScalar(baseChain) && !hasScalar(reobservation),'ResponsibilityEventAppendReceipt: scalar fields prohibited');

  const baseBinding = await binding(baseChain, baseChain.chain_id);
  const sourceBinding = await binding(reobservation, reobservation.reobservation_id);
  const eventIdHash = await hashText(`${baseChain.head.event_digest.value}|${sourceBinding.digest.value}|${reobservation.observed_at}|6`);
  const event = {
    sequence:6,
    event_id:`urn:uu-aap:responsibility-event:${eventIdHash.slice(0,24)}`,
    event_kind:EVENT_KIND,
    stage_time:reobservation.observed_at,
    source_binding:sourceBinding,
    semantic_binding:clone(baseChain.semantic_binding),
    effect_frontier:clone(baseChain.effect_frontier),
    predecessor_event_digest:clone(baseChain.head.event_digest),
    assurance_snapshot:appendedAssurance(baseChain)
  };
  event.event_digest = digest(await eventMaterialDigest(event));
  const receipt = {
    $schema:'./responsibility-event-append-receipt.schema.json',
    artifact_type:'ResponsibilityEventAppendReceipt', artifact_version:'0.1', append_receipt_id:'', appended_at:args.appendedAt,
    base_chain_binding:baseBinding, base_head:clone(baseChain.head), source_reobservation_binding:sourceBinding,
    appended_event:event,
    extended_head:{sequence:6,event_id:event.event_id,event_digest:clone(event.event_digest)},
    extension_digest:digest('0'.repeat(64)),
    replay_semantics:{mode:'deterministic_idempotent_same_inputs',distinct_duplicate_identity_permitted:false,global_replay_protection_established:false},
    verification:{base_chain_exact:true,base_head_exact:true,source_reobservation_exact:true,source_reobservation_verified:true,semantic_frontier_exact:true,effect_frontier_exact:true,append_sequence_exact:true,predecessor_event_digest_exact:true,appended_event_digest_exact:true,extended_head_exact:true,extension_digest_exact:true,local_stage_order_preserved:true,historical_assurance_preserved:true,scalar_scoring_absent:true,base_chain_mutated:false},
    claims:{append_only_extension_established:true,base_chain_immutable_preserved:true,responsibility_event_chain_reobservation_appended:true,chain_integrity_reobserved:true,new_external_consequence_observed:false,generalized_external_consequence_causality_established:false,universal_causal_truth_established:false,causal_proof_certified:false,responsibility_for_outcome_adjudicated:false,legal_responsibility_determined:false,legal_liability_established:false,legal_effect_established:false,moral_blame_assigned:false,moral_correctness_established:false,truth_certified:false,complete_global_wall_clock_chronology_established:false,remote_branch_or_ref_canonicality_established:false,poai_materialization_event_recorded:false,poai_successor_record_identity_inferred:false,universal_canonicality_established:false,poai_v_conformance_established:false}
  };
  const extensionValue = await digestJson(extensionMaterial(receipt));
  receipt.extension_digest = digest(extensionValue);
  const receiptHash = await hashText(`${baseBinding.digest.value}|${sourceBinding.digest.value}|${extensionValue}`);
  receipt.append_receipt_id = `urn:uu-aap:responsibility-event-append-receipt:${receiptHash.slice(0,24)}`;
  await validateResponsibilityEventAppendReceipt({receipt,baseChain,reobservation,...sources(args)});
  return receipt;
}

async function validateResponsibilityEventAppendReceipt(args) {
  const {receipt,baseChain,reobservation} = args;
  assert(receipt && receipt.artifact_type === 'ResponsibilityEventAppendReceipt' && receipt.artifact_version === '0.1','ResponsibilityEventAppendReceipt: invalid receipt');
  assert(!hasScalar(receipt),'ResponsibilityEventAppendReceipt: scalar fields prohibited');
  for (const k of FALSE_CLAIMS) assert(receipt.claims && receipt.claims[k] === false,`ResponsibilityEventAppendReceipt: prohibited claim ${k}`);
  await validateResponsibilityEventChain({chain:baseChain,...sources(args)});
  await validateResponsibilityEventChainReobservationReceipt({receipt:reobservation,chain:baseChain,...sources(args)});
  assert(Date.parse(reobservation.observed_at) > Date.parse(baseChain.built_at),'ResponsibilityEventAppendReceipt: reobservation temporal inversion');
  assert(Date.parse(receipt.appended_at) > Date.parse(reobservation.observed_at),'ResponsibilityEventAppendReceipt: append temporal inversion');

  const baseBinding = await binding(baseChain,baseChain.chain_id);
  const sourceBinding = await binding(reobservation,reobservation.reobservation_id);
  assert(receipt.base_chain_binding.artifact_ref === baseBinding.artifact_ref && receipt.base_chain_binding.digest.value === baseBinding.digest.value,'ResponsibilityEventAppendReceipt: base chain binding substitution');
  assert(JSON.stringify(receipt.base_head) === JSON.stringify(baseChain.head),'ResponsibilityEventAppendReceipt: base head substitution');
  assert(receipt.source_reobservation_binding.artifact_ref === sourceBinding.artifact_ref && receipt.source_reobservation_binding.digest.value === sourceBinding.digest.value,'ResponsibilityEventAppendReceipt: reobservation binding substitution');
  assert(receipt.appended_event.sequence === 6 && receipt.appended_event.event_kind === EVENT_KIND,'ResponsibilityEventAppendReceipt: append sequence/kind substitution');
  assert(receipt.appended_event.predecessor_event_digest.value === baseChain.head.event_digest.value,'ResponsibilityEventAppendReceipt: predecessor event digest substitution');
  assert(JSON.stringify(receipt.appended_event.semantic_binding) === JSON.stringify(baseChain.semantic_binding),'ResponsibilityEventAppendReceipt: semantic frontier substitution');
  assert(await digestJson(receipt.appended_event.effect_frontier) === await digestJson(baseChain.effect_frontier),'ResponsibilityEventAppendReceipt: effect frontier substitution');
  assert(receipt.appended_event.stage_time === reobservation.observed_at,'ResponsibilityEventAppendReceipt: appended event stage time substitution');
  assert(receipt.appended_event.source_binding.digest.value === sourceBinding.digest.value,'ResponsibilityEventAppendReceipt: appended source digest substitution');
  assert(await digestJson(receipt.appended_event.assurance_snapshot) === await digestJson(appendedAssurance(baseChain)),'ResponsibilityEventAppendReceipt: assurance snapshot substitution');
  assert(receipt.appended_event.event_digest.value === await eventMaterialDigest(receipt.appended_event),'ResponsibilityEventAppendReceipt: appended event digest substitution');
  assert(receipt.extended_head.sequence === 6 && receipt.extended_head.event_id === receipt.appended_event.event_id && receipt.extended_head.event_digest.value === receipt.appended_event.event_digest.value,'ResponsibilityEventAppendReceipt: extended head substitution');
  const extensionValue = await digestJson(extensionMaterial(receipt));
  assert(receipt.extension_digest.value === extensionValue,'ResponsibilityEventAppendReceipt: extension digest substitution');
  const receiptHash = await hashText(`${baseBinding.digest.value}|${sourceBinding.digest.value}|${extensionValue}`);
  assert(receipt.append_receipt_id === `urn:uu-aap:responsibility-event-append-receipt:${receiptHash.slice(0,24)}`,'ResponsibilityEventAppendReceipt: receipt ID substitution');
  assert(receipt.replay_semantics.mode === 'deterministic_idempotent_same_inputs' && receipt.replay_semantics.distinct_duplicate_identity_permitted === false && receipt.replay_semantics.global_replay_protection_established === false,'ResponsibilityEventAppendReceipt: replay semantics substitution');
  assert(receipt.verification.base_chain_mutated === false && receipt.claims.append_only_extension_established === true && receipt.claims.base_chain_immutable_preserved === true,'ResponsibilityEventAppendReceipt: append boundary invalid');
  return true;
}

module.exports = {EVENT_KIND,buildResponsibilityEventAppendReceipt,validateResponsibilityEventAppendReceipt};
