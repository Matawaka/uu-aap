'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { digestJson } = require('./build-responsibility-event-chain.js');
const { observeResponsibilityEventChain, validateResponsibilityEventChainReobservationReceipt } = require('./observe-responsibility-event-chain.js');
const { buildResponsibilityEventAppendReceipt, validateResponsibilityEventAppendReceipt } = require('./append-responsibility-event.js');

const repoRoot = path.resolve(__dirname, '../../..');
const assert = (v,m) => { if (!v) throw new Error(m); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const readJson = (f) => JSON.parse(fs.readFileSync(f,'utf8'));
async function reject(name, fn, pattern) {
  let error = null; try { await fn(); } catch (e) { error = e; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return {name,error:error.message};
}
function runChain(outputPath) {
  const run = cp.spawnSync('node',['protocols/integration/v0.1/test-responsibility-event-chain.js',outputPath],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if (run.error) throw run.error;
  assert(run.status === 0,`ResponsibilityEventChain prerequisite failed\n${run.stdout||''}\n${run.stderr||''}`);
}

async function main() {
  const outputPath = process.argv[2] || '/tmp/responsibility-event-append.json';
  const reobservationPath = process.argv[3] || '/tmp/responsibility-event-chain-reobservation.json';
  const basePath = '/tmp/append-base-chain.json';
  runChain(basePath);
  const baseBytes = fs.readFileSync(basePath,'utf8');
  const baseChain = JSON.parse(baseBytes);
  const source = {
    outcomeObservation:readJson('/tmp/causal-outcome-observation.json'),
    responsibilityTrace:readJson('/tmp/causal-responsibility-trace.json'),
    causalAssessment:readJson('/tmp/counterfactual-causal-attribution.json'),
    counterfactualAssessment:readJson('/tmp/qualification-counterfactual.json'),
    causalQualification:readJson('/tmp/responsibility-attribution-qualification.json'),
    responsibilityAttribution:readJson('/tmp/event-chain-attribution.json')
  };
  const baseBefore = await digestJson(baseChain);
  const observed = await observeResponsibilityEventChain({serializedChainBytes:baseBytes,observedAt:'2026-08-23T08:43:00Z',...source});
  const reobservation = observed.receipt;
  const args = {baseChain,reobservation,appendedAt:'2026-08-23T08:43:01Z',...source};
  const receipt = await buildResponsibilityEventAppendReceipt(args);
  const replay = await buildResponsibilityEventAppendReceipt(args);

  assert(await digestJson(baseChain) === baseBefore,'base chain mutated during append');
  assert(reobservation.claims.chain_integrity_reverified === true,'chain integrity must be reverified');
  assert(receipt.appended_event.sequence === 6 && receipt.appended_event.event_kind === 'responsibility_event_chain_reobserved','append event mismatch');
  assert(receipt.appended_event.predecessor_event_digest.value === baseChain.head.event_digest.value,'append predecessor mismatch');
  assert(receipt.extended_head.sequence === 6,'extended head mismatch');
  assert(receipt.claims.append_only_extension_established === true && receipt.claims.base_chain_immutable_preserved === true,'append claims missing');
  assert(receipt.claims.new_external_consequence_observed === false && receipt.claims.legal_liability_established === false && receipt.claims.moral_blame_assigned === false,'strong claims must remain false');
  assert(replay.append_receipt_id === receipt.append_receipt_id && replay.extension_digest.value === receipt.extension_digest.value,'same-input replay must be deterministic/idempotent');

  const vectors = [];
  const validateObs = (value, overrides={}) => validateResponsibilityEventChainReobservationReceipt({receipt:value,chain:overrides.baseChain||baseChain,...source});
  const validateAppend = (value, overrides={}) => validateResponsibilityEventAppendReceipt({receipt:value,baseChain:overrides.baseChain||baseChain,reobservation:overrides.reobservation||reobservation,...source});

  vectors.push(await reject('serialized_parse_failure',async()=>observeResponsibilityEventChain({serializedChainBytes:'{bad',observedAt:'2026-08-23T08:43:00Z',...source}),/parse failed/));
  vectors.push(await reject('reobservation_temporal_inversion',async()=>observeResponsibilityEventChain({serializedChainBytes:baseBytes,observedAt:baseChain.built_at,...source}),/observation must occur after chain build/));
  vectors.push(await reject('reobservation_chain_ref_substitution',async()=>{const x=clone(reobservation);x.chain_binding.artifact_ref='urn:uu-aap:responsibility-event-chain:other';await validateObs(x);},/chain ref substitution/));
  vectors.push(await reject('reobservation_chain_digest_substitution',async()=>{const x=clone(reobservation);x.chain_binding.digest.value='0'.repeat(64);await validateObs(x);},/chain digest substitution/));
  vectors.push(await reject('reobservation_observed_digest_substitution',async()=>{const x=clone(reobservation);x.observed_chain_digest.value='0'.repeat(64);await validateObs(x);},/observed chain digest substitution/));
  vectors.push(await reject('reobservation_head_substitution',async()=>{const x=clone(reobservation);x.observed_head.event_digest.value='0'.repeat(64);await validateObs(x);},/head substitution/));
  vectors.push(await reject('reobservation_semantic_drift',async()=>{const x=clone(reobservation);x.semantic_binding.action='other.action';await validateObs(x);},/semantic frontier substitution/));
  vectors.push(await reject('reobservation_effect_drift',async()=>{const x=clone(reobservation);x.effect_frontier.tree_sha='0'.repeat(40);await validateObs(x);},/effect frontier substitution/));
  vectors.push(await reject('reobservation_id_substitution',async()=>{const x=clone(reobservation);x.reobservation_id='urn:uu-aap:responsibility-event-chain-reobservation:other';await validateObs(x);},/ID substitution/));
  vectors.push(await reject('reobservation_legal_overclaim',async()=>{const x=clone(reobservation);x.claims.legal_liability_established=true;await validateObs(x);},/prohibited claim legal_liability_established/));
  vectors.push(await reject('reobservation_scalar_injection',async()=>{const x=clone(reobservation);x.responsibility_score=1;await validateObs(x);},/scalar fields prohibited/));

  vectors.push(await reject('append_temporal_inversion',async()=>buildResponsibilityEventAppendReceipt({...args,appendedAt:reobservation.observed_at}),/append must occur after reobservation/));
  vectors.push(await reject('base_chain_binding_ref_substitution',async()=>{const x=clone(receipt);x.base_chain_binding.artifact_ref='urn:uu-aap:responsibility-event-chain:other';await validateAppend(x);},/base chain binding substitution/));
  vectors.push(await reject('base_chain_binding_digest_substitution',async()=>{const x=clone(receipt);x.base_chain_binding.digest.value='0'.repeat(64);await validateAppend(x);},/base chain binding substitution/));
  vectors.push(await reject('base_head_substitution',async()=>{const x=clone(receipt);x.base_head.event_digest.value='0'.repeat(64);await validateAppend(x);},/base head substitution/));
  vectors.push(await reject('source_reobservation_ref_substitution',async()=>{const x=clone(receipt);x.source_reobservation_binding.artifact_ref='urn:uu-aap:responsibility-event-chain-reobservation:other';await validateAppend(x);},/reobservation binding substitution/));
  vectors.push(await reject('source_reobservation_digest_substitution',async()=>{const x=clone(receipt);x.source_reobservation_binding.digest.value='0'.repeat(64);await validateAppend(x);},/reobservation binding substitution/));
  vectors.push(await reject('append_sequence_substitution',async()=>{const x=clone(receipt);x.appended_event.sequence=7;await validateAppend(x);},/append sequence\/kind substitution/));
  vectors.push(await reject('append_kind_substitution',async()=>{const x=clone(receipt);x.appended_event.event_kind='external_consequence_observed';await validateAppend(x);},/append sequence\/kind substitution/));
  vectors.push(await reject('append_predecessor_substitution',async()=>{const x=clone(receipt);x.appended_event.predecessor_event_digest.value='0'.repeat(64);await validateAppend(x);},/predecessor event digest substitution/));
  vectors.push(await reject('append_semantic_drift',async()=>{const x=clone(receipt);x.appended_event.semantic_binding.action='other.action';await validateAppend(x);},/semantic frontier substitution/));
  vectors.push(await reject('append_effect_drift',async()=>{const x=clone(receipt);x.appended_event.effect_frontier.tree_sha='0'.repeat(40);await validateAppend(x);},/effect frontier substitution/));
  vectors.push(await reject('append_stage_time_substitution',async()=>{const x=clone(receipt);x.appended_event.stage_time='2026-08-23T08:42:59Z';await validateAppend(x);},/stage time substitution/));
  vectors.push(await reject('append_assurance_causal_upgrade',async()=>{const x=clone(receipt);x.appended_event.assurance_snapshot.causal_proof_certified=true;await validateAppend(x);},/assurance snapshot substitution/));
  vectors.push(await reject('append_assurance_legal_upgrade',async()=>{const x=clone(receipt);x.appended_event.assurance_snapshot.legal_liability_established=true;await validateAppend(x);},/assurance snapshot substitution/));
  vectors.push(await reject('append_event_digest_substitution',async()=>{const x=clone(receipt);x.appended_event.event_digest.value='0'.repeat(64);await validateAppend(x);},/appended event digest substitution/));
  vectors.push(await reject('extended_head_substitution',async()=>{const x=clone(receipt);x.extended_head.event_id='urn:uu-aap:responsibility-event:other';await validateAppend(x);},/extended head substitution/));
  vectors.push(await reject('extension_digest_substitution',async()=>{const x=clone(receipt);x.extension_digest.value='0'.repeat(64);await validateAppend(x);},/extension digest substitution/));
  vectors.push(await reject('receipt_id_substitution',async()=>{const x=clone(receipt);x.append_receipt_id='urn:uu-aap:responsibility-event-append-receipt:other';await validateAppend(x);},/receipt ID substitution/));
  vectors.push(await reject('replay_mode_substitution',async()=>{const x=clone(receipt);x.replay_semantics.mode='global_once';await validateAppend(x);},/replay semantics substitution/));
  vectors.push(await reject('global_replay_overclaim',async()=>{const x=clone(receipt);x.replay_semantics.global_replay_protection_established=true;await validateAppend(x);},/replay semantics substitution/));
  vectors.push(await reject('base_chain_mutation_claim',async()=>{const x=clone(receipt);x.verification.base_chain_mutated=true;await validateAppend(x);},/append boundary invalid/));
  for (const key of ['new_external_consequence_observed','causal_proof_certified','responsibility_for_outcome_adjudicated','legal_liability_established','moral_blame_assigned','truth_certified']) {
    vectors.push(await reject(`${key}_overclaim`,async()=>{const x=clone(receipt);x.claims[key]=true;await validateAppend(x);},new RegExp(`prohibited claim ${key}`)));
  }
  vectors.push(await reject('scalar_receipt_injection',async()=>{const x=clone(receipt);x.responsibility_score=.8;await validateAppend(x);},/scalar fields prohibited/));
  vectors.push(await reject('scalar_event_injection',async()=>{const x=clone(receipt);x.appended_event.probability=.8;await validateAppend(x);},/scalar fields prohibited/));
  vectors.push(await reject('mutated_base_chain_source',async()=>{const b=clone(baseChain);b.head.event_digest.value='0'.repeat(64);await validateAppend(receipt,{baseChain:b});},/chain head substitution|event payload\/digest chain substitution/));

  fs.writeFileSync(reobservationPath,JSON.stringify(reobservation,null,2)+'\n');
  fs.writeFileSync(outputPath,JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({
    suite:'UU-AAP ResponsibilityEventAppendReceipt v0.1',
    base_chain_id:baseChain.chain_id,
    base_head_sequence:baseChain.head.sequence,
    reobservation_id:reobservation.reobservation_id,
    append_receipt_id:receipt.append_receipt_id,
    appended_event_kind:receipt.appended_event.event_kind,
    extended_head_sequence:receipt.extended_head.sequence,
    append_only_extension_established:receipt.claims.append_only_extension_established,
    base_chain_immutable_preserved:receipt.claims.base_chain_immutable_preserved,
    new_external_consequence_observed:receipt.claims.new_external_consequence_observed,
    global_replay_protection_established:receipt.replay_semantics.global_replay_protection_established,
    negative_vectors:vectors.length
  },null,2));
}

main().catch((error)=>{console.error(error&&error.stack?error.stack:error);process.exit(1);});
