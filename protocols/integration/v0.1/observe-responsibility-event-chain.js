'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const { digestJson, validateResponsibilityEventChain } = require('./build-responsibility-event-chain.js');

const OBSERVATION_MODE = 'serialized_chain_readback_and_full_revalidation';
const FORBIDDEN_TRUE = [
  'new_external_consequence_observed','generalized_external_consequence_causality_established',
  'universal_causal_truth_established','causal_proof_certified','responsibility_for_outcome_adjudicated',
  'legal_responsibility_determined','legal_liability_established','legal_effect_established',
  'moral_blame_assigned','moral_correctness_established','truth_certified',
  'complete_global_wall_clock_chronology_established','remote_branch_or_ref_canonicality_established',
  'poai_materialization_event_recorded','poai_successor_record_identity_inferred',
  'universal_canonicality_established','poai_v_conformance_established'
];
const SCALARS = new Set(['score','probability','percentage','weight','likelihood','confidence_score','causal_score','responsibility_score','blame_score','rating']);
const assert = (v, m) => { if (!v) throw new Error(m); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const digest = (value) => ({canonicalization:'RFC8785-JCS',digest_algorithm:'SHA-256',digest_encoding:'hex',value});
function hasScalar(v) {
  if (!v || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some(hasScalar);
  return Object.entries(v).some(([k,c]) => SCALARS.has(k) || hasScalar(c));
}
async function idHash(text) { return Binding.sha256Hex(Binding.utf8Bytes(text)); }
function sourceArgs(a) {
  return { outcomeObservation:a.outcomeObservation, responsibilityTrace:a.responsibilityTrace,
    causalAssessment:a.causalAssessment, counterfactualAssessment:a.counterfactualAssessment,
    causalQualification:a.causalQualification, responsibilityAttribution:a.responsibilityAttribution };
}

async function observeResponsibilityEventChain(args) {
  assert(typeof args.serializedChainBytes === 'string' && args.serializedChainBytes.length > 0,
    'ResponsibilityEventChainReobservationReceipt: serialized chain bytes required');
  let chain;
  try { chain = JSON.parse(args.serializedChainBytes); }
  catch (_) { throw new Error('ResponsibilityEventChainReobservationReceipt: serialized chain parse failed'); }
  await validateResponsibilityEventChain({chain, ...sourceArgs(args)});
  assert(!hasScalar(chain), 'ResponsibilityEventChainReobservationReceipt: scalar fields prohibited');
  assert(Date.parse(args.observedAt) > Date.parse(chain.built_at),
    'ResponsibilityEventChainReobservationReceipt: observation must occur after chain build');
  const bound = await digestJson(chain);
  const h = await idHash(`${chain.chain_id}|${bound}|${chain.head.event_digest.value}|${args.observedAt}`);
  const receipt = {
    $schema:'./responsibility-event-chain-reobservation.schema.json', artifact_type:'ResponsibilityEventChainReobservationReceipt', artifact_version:'0.1',
    reobservation_id:`urn:uu-aap:responsibility-event-chain-reobservation:${h.slice(0,24)}`, observed_at:args.observedAt,
    observation_mode:OBSERVATION_MODE,
    chain_binding:{artifact_type:'ResponsibilityEventChain',artifact_ref:chain.chain_id,digest:digest(bound)},
    observed_chain_digest:clone(chain.chain_digest), observed_head:clone(chain.head),
    semantic_binding:clone(chain.semantic_binding), effect_frontier:clone(chain.effect_frontier),
    verification:{serialized_readback_performed:true,full_chain_revalidation_passed:true,chain_binding_exact:true,chain_digest_exact:true,head_exact:true,semantic_frontier_exact:true,effect_frontier_exact:true,observation_after_chain_build:true,historical_assurance_preserved:true,scalar_scoring_absent:true,base_chain_mutated:false},
    claims:{responsibility_event_chain_reobserved:true,chain_integrity_reverified:true,new_external_consequence_observed:false,generalized_external_consequence_causality_established:false,universal_causal_truth_established:false,causal_proof_certified:false,responsibility_for_outcome_adjudicated:false,legal_responsibility_determined:false,legal_liability_established:false,legal_effect_established:false,moral_blame_assigned:false,moral_correctness_established:false,truth_certified:false,complete_global_wall_clock_chronology_established:false,remote_branch_or_ref_canonicality_established:false,poai_materialization_event_recorded:false,poai_successor_record_identity_inferred:false,universal_canonicality_established:false,poai_v_conformance_established:false}
  };
  await validateResponsibilityEventChainReobservationReceipt({receipt,chain,...sourceArgs(args)});
  return {receipt,chain};
}

async function validateResponsibilityEventChainReobservationReceipt(args) {
  const {receipt,chain} = args;
  assert(receipt && receipt.artifact_type === 'ResponsibilityEventChainReobservationReceipt' && receipt.artifact_version === '0.1','ResponsibilityEventChainReobservationReceipt: invalid artifact');
  assert(receipt.observation_mode === OBSERVATION_MODE,'ResponsibilityEventChainReobservationReceipt: observation mode substitution');
  assert(!hasScalar(receipt),'ResponsibilityEventChainReobservationReceipt: scalar fields prohibited');
  for (const k of FORBIDDEN_TRUE) assert(receipt.claims && receipt.claims[k] === false,`ResponsibilityEventChainReobservationReceipt: prohibited claim ${k}`);
  await validateResponsibilityEventChain({chain,...sourceArgs(args)});
  assert(Date.parse(receipt.observed_at) > Date.parse(chain.built_at),'ResponsibilityEventChainReobservationReceipt: observation must occur after chain build');
  const bound = await digestJson(chain);
  assert(receipt.chain_binding.artifact_ref === chain.chain_id,'ResponsibilityEventChainReobservationReceipt: chain ref substitution');
  assert(receipt.chain_binding.digest.value === bound,'ResponsibilityEventChainReobservationReceipt: chain digest substitution');
  assert(receipt.observed_chain_digest.value === chain.chain_digest.value,'ResponsibilityEventChainReobservationReceipt: observed chain digest substitution');
  assert(JSON.stringify(receipt.observed_head) === JSON.stringify(chain.head),'ResponsibilityEventChainReobservationReceipt: head substitution');
  assert(JSON.stringify(receipt.semantic_binding) === JSON.stringify(chain.semantic_binding),'ResponsibilityEventChainReobservationReceipt: semantic frontier substitution');
  assert(await digestJson(receipt.effect_frontier) === await digestJson(chain.effect_frontier),'ResponsibilityEventChainReobservationReceipt: effect frontier substitution');
  const h = await idHash(`${chain.chain_id}|${bound}|${chain.head.event_digest.value}|${receipt.observed_at}`);
  assert(receipt.reobservation_id === `urn:uu-aap:responsibility-event-chain-reobservation:${h.slice(0,24)}`,'ResponsibilityEventChainReobservationReceipt: ID substitution');
  assert(receipt.claims.responsibility_event_chain_reobserved === true && receipt.claims.chain_integrity_reverified === true,'ResponsibilityEventChainReobservationReceipt: positive claims incomplete');
  assert(receipt.verification.base_chain_mutated === false,'ResponsibilityEventChainReobservationReceipt: base chain mutation overclaim');
  return true;
}

module.exports = {OBSERVATION_MODE,observeResponsibilityEventChain,validateResponsibilityEventChainReobservationReceipt};
