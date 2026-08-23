'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  EVENT_KINDS,
  digestJson,
  buildResponsibilityEventChain,
  validateResponsibilityEventChain
} = require('./build-responsibility-event-chain.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function runAttribution(outputPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-responsibility-attribution.js', outputPath
  ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  assert(run.status === 0, `responsibility attribution prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
}
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}
function digestObject(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}

async function main() {
  const outputPath = process.argv[2] || '/tmp/responsibility-event-chain.json';
  const attributionPath = '/tmp/event-chain-attribution.json';
  runAttribution(attributionPath);

  const responsibilityAttribution = readJson(attributionPath);
  const causalQualification = readJson('/tmp/responsibility-attribution-qualification.json');
  const counterfactualAssessment = readJson('/tmp/qualification-counterfactual.json');
  const causalAssessment = readJson('/tmp/counterfactual-causal-attribution.json');
  const responsibilityTrace = readJson('/tmp/causal-responsibility-trace.json');
  const outcomeObservation = readJson('/tmp/causal-outcome-observation.json');

  const args = {
    outcomeObservation,
    responsibilityTrace,
    causalAssessment,
    counterfactualAssessment,
    causalQualification,
    responsibilityAttribution,
    builtAt: '2026-08-23T08:42:00Z'
  };

  const chain = await buildResponsibilityEventChain(args);
  assert(chain.events.length === 6, 'reference chain must contain six events');
  assert(chain.events.map((event) => event.event_kind).join('|') === EVENT_KINDS.join('|'),
    'reference event order mismatch');
  assert(chain.head.sequence === 5, 'head must point to sixth event');
  assert(chain.claims.multi_event_responsibility_trace_established === true,
    'multi-event responsibility trace must be established');
  assert(chain.claims.append_only_digest_chain_established === true,
    'append-only digest chain must be established');
  assert(chain.events[0].assurance_snapshot.causal_proof_certified === false,
    'OutcomeObservation snapshot must not become causal proof');
  assert(chain.events[5].assurance_snapshot.policy_relative_responsibility_attribution_established === true,
    'final snapshot must preserve bounded responsibility attribution');
  assert(chain.events[5].assurance_snapshot.legal_liability_established === false &&
    chain.events[5].assurance_snapshot.moral_blame_assigned === false,
    'final snapshot must withhold legal liability and moral blame');

  const vectors = [];
  const validate = (value, overrides = {}) => validateResponsibilityEventChain({
    chain: value,
    outcomeObservation: overrides.outcomeObservation || outcomeObservation,
    responsibilityTrace: overrides.responsibilityTrace || responsibilityTrace,
    causalAssessment: overrides.causalAssessment || causalAssessment,
    counterfactualAssessment: overrides.counterfactualAssessment || counterfactualAssessment,
    causalQualification: overrides.causalQualification || causalQualification,
    responsibilityAttribution: overrides.responsibilityAttribution || responsibilityAttribution
  });

  vectors.push(await reject('missing_event', async () => {
    const changed = clone(chain);
    changed.events.pop();
    await validate(changed);
  }, /exactly six reference events required/));

  vectors.push(await reject('duplicate_event_kind', async () => {
    const changed = clone(chain);
    changed.events[1].event_kind = changed.events[0].event_kind;
    await validate(changed);
  }, /event kind\/order substitution/));

  vectors.push(await reject('event_reorder', async () => {
    const changed = clone(chain);
    [changed.events[1], changed.events[2]] = [changed.events[2], changed.events[1]];
    await validate(changed);
  }, /event kind\/order substitution|event sequence substitution/));

  vectors.push(await reject('sequence_substitution', async () => {
    const changed = clone(chain);
    changed.events[2].sequence = 9;
    await validate(changed);
  }, /event sequence substitution/));

  vectors.push(await reject('predecessor_digest_substitution', async () => {
    const changed = clone(chain);
    changed.events[3].predecessor_event_digest.value = '0'.repeat(64);
    await validate(changed);
  }, /event payload\/digest chain substitution|predecessor digest discontinuity/));

  vectors.push(await reject('source_ref_substitution', async () => {
    const changed = clone(chain);
    changed.events[1].source_binding.artifact_ref = 'urn:uu-aap:responsibility-trace:other';
    await validate(changed);
  }, /event payload\/digest chain substitution/));

  vectors.push(await reject('source_digest_substitution', async () => {
    const changed = clone(chain);
    changed.events[4].source_binding.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /event payload\/digest chain substitution/));

  vectors.push(await reject('event_semantic_frontier_drift', async () => {
    const changed = clone(chain);
    changed.events[2].semantic_binding.action = 'other.action';
    await validate(changed);
  }, /event payload\/digest chain substitution/));

  vectors.push(await reject('chain_semantic_frontier_drift', async () => {
    const changed = clone(chain);
    changed.semantic_binding.action = 'other.action';
    await validate(changed);
  }, /chain semantic frontier substitution/));

  vectors.push(await reject('event_effect_frontier_drift', async () => {
    const changed = clone(chain);
    changed.events[3].effect_frontier.tree_sha = '0'.repeat(40);
    await validate(changed);
  }, /event payload\/digest chain substitution/));

  vectors.push(await reject('chain_effect_frontier_drift', async () => {
    const changed = clone(chain);
    changed.effect_frontier.tree_sha = '0'.repeat(40);
    await validate(changed);
  }, /chain effect frontier substitution/));

  vectors.push(await reject('source_stage_time_substitution', async () => {
    const changed = clone(chain);
    changed.events[4].stage_time = '2026-08-23T08:39:59Z';
    await validate(changed);
  }, /event payload\/digest chain substitution/));

  vectors.push(await reject('historical_snapshot_future_upgrade', async () => {
    const changed = clone(chain);
    changed.events[0].assurance_snapshot.policy_relative_responsibility_attribution_established = true;
    await validate(changed);
  }, /event payload\/digest chain substitution|historical assurance snapshot substitution/));

  vectors.push(await reject('historical_snapshot_causal_proof_upgrade', async () => {
    const changed = clone(chain);
    changed.events[2].assurance_snapshot.causal_proof_certified = true;
    await validate(changed);
  }, /event payload\/digest chain substitution|historical assurance snapshot substitution/));

  vectors.push(await reject('event_digest_substitution', async () => {
    const changed = clone(chain);
    changed.events[2].event_digest.value = '0'.repeat(64);
    await validate(changed);
  }, /event payload\/digest chain substitution|event digest substitution/));

  vectors.push(await reject('mutate_event_without_rechaining', async () => {
    const changed = clone(chain);
    changed.events[1].stage_time = '2026-08-23T08:20:01.500Z';
    await validate(changed);
  }, /event payload\/digest chain substitution/));

  vectors.push(await reject('head_event_id_substitution', async () => {
    const changed = clone(chain);
    changed.head.event_id = 'urn:uu-aap:responsibility-event:other';
    await validate(changed);
  }, /chain head substitution/));

  vectors.push(await reject('head_digest_substitution', async () => {
    const changed = clone(chain);
    changed.head.event_digest.value = '0'.repeat(64);
    await validate(changed);
  }, /chain head substitution/));

  vectors.push(await reject('chain_digest_substitution', async () => {
    const changed = clone(chain);
    changed.chain_digest.value = '0'.repeat(64);
    await validate(changed);
  }, /chain digest substitution/));

  vectors.push(await reject('chain_id_substitution', async () => {
    const changed = clone(chain);
    changed.chain_id = 'urn:uu-aap:responsibility-event-chain:other';
    await validate(changed);
  }, /chain ID substitution/));

  vectors.push(await reject('built_at_temporal_inversion', async () => {
    const changed = clone(chain);
    changed.built_at = responsibilityAttribution.assessed_at;
    await validate(changed);
  }, /chain must be built after ResponsibilityAttributionAssessment/));

  vectors.push(await reject('source_outcome_causal_overclaim', async () => {
    const changed = clone(outcomeObservation);
    changed.claims.causal_proof_certified = true;
    await buildResponsibilityEventChain({ ...args, outcomeObservation: changed });
  }, /OutcomeObservation assurance boundary invalid|digest substitution/));

  vectors.push(await reject('source_trace_adjudication_upgrade', async () => {
    const changed = clone(responsibilityTrace);
    changed.responsibility_attribution.status = 'adjudicated';
    await buildResponsibilityEventChain({ ...args, responsibilityTrace: changed });
  }, /ResponsibilityTrace assurance boundary invalid|digest substitution/));

  vectors.push(await reject('source_causal_proof_upgrade', async () => {
    const changed = clone(causalAssessment);
    changed.assessment_result.causal_proof_established = true;
    await buildResponsibilityEventChain({ ...args, causalAssessment: changed });
  }, /CausalAttribution assurance boundary invalid|digest substitution/));

  vectors.push(await reject('source_counterfactual_proof_upgrade', async () => {
    const changed = clone(counterfactualAssessment);
    changed.assessment_result.causal_proof_established = true;
    await buildResponsibilityEventChain({ ...args, counterfactualAssessment: changed });
  }, /CounterfactualIntervention assurance boundary invalid|digest substitution/));

  vectors.push(await reject('source_qualification_contribution_downgrade', async () => {
    const changed = clone(causalQualification);
    const contribution = changed.decisions.find((item) => item.predicate === 'originating_execution_contributed_to_exact_transition');
    contribution.status = 'deferred';
    contribution.establishes_predicate = false;
    await buildResponsibilityEventChain({ ...args, causalQualification: changed });
  }, /CausalClaimQualification assurance boundary invalid|digest substitution/));

  vectors.push(await reject('source_attribution_legal_overclaim', async () => {
    const changed = clone(responsibilityAttribution);
    changed.claims.legal_liability_established = true;
    await buildResponsibilityEventChain({ ...args, responsibilityAttribution: changed });
  }, /ResponsibilityAttribution assurance boundary invalid/));

  vectors.push(await reject('source_attribution_moral_overclaim', async () => {
    const changed = clone(responsibilityAttribution);
    changed.claims.moral_blame_assigned = true;
    await buildResponsibilityEventChain({ ...args, responsibilityAttribution: changed });
  }, /ResponsibilityAttribution assurance boundary invalid/));

  vectors.push(await reject('source_local_stage_temporal_inversion', async () => {
    const changedCounterfactual = clone(counterfactualAssessment);
    changedCounterfactual.assessed_at = causalAssessment.assessed_at;
    const changedQualification = clone(causalQualification);
    changedQualification.predecessor_bindings.counterfactual_intervention.digest = digestObject(await digestJson(changedCounterfactual));
    const changedAttribution = clone(responsibilityAttribution);
    changedAttribution.predecessor_bindings.causal_claim_qualification.digest = digestObject(await digestJson(changedQualification));
    await buildResponsibilityEventChain({
      ...args,
      counterfactualAssessment: changedCounterfactual,
      causalQualification: changedQualification,
      responsibilityAttribution: changedAttribution
    });
  }, /local stage temporal inversion/));

  for (const key of [
    'complete_global_wall_clock_chronology_established',
    'generalized_external_consequence_causality_established',
    'universal_causal_truth_established',
    'causal_proof_certified',
    'responsibility_for_outcome_adjudicated',
    'legal_responsibility_determined',
    'legal_liability_established',
    'moral_blame_assigned',
    'truth_certified'
  ]) {
    vectors.push(await reject(`${key}_chain_overclaim`, async () => {
      const changed = clone(chain);
      changed.claims[key] = true;
      await validate(changed);
    }, new RegExp(`prohibited claim ${key}`)));
  }

  vectors.push(await reject('scalar_responsibility_score_injection', async () => {
    const changed = clone(chain);
    changed.responsibility_score = 0.9;
    await validate(changed);
  }, /scalar responsibility\/probability scores/));

  vectors.push(await reject('scalar_probability_in_event_injection', async () => {
    const changed = clone(chain);
    changed.events[0].probability = 0.9;
    await validate(changed);
  }, /scalar responsibility\/probability scores/));

  vectors.push(await reject('scalar_blame_score_in_snapshot_injection', async () => {
    const changed = clone(chain);
    changed.events[5].assurance_snapshot.blame_score = 1;
    await validate(changed);
  }, /scalar responsibility\/probability scores/));

  fs.writeFileSync(outputPath, JSON.stringify(chain, null, 2) + '\n');
  console.log(JSON.stringify({
    suite: 'UU-AAP ResponsibilityEventChain v0.1',
    chain_id: chain.chain_id,
    chain_profile: chain.chain_profile,
    event_count: chain.events.length,
    event_kinds: chain.events.map((event) => event.event_kind),
    head_event_id: chain.head.event_id,
    append_only_digest_chain_established: chain.claims.append_only_digest_chain_established,
    responsibility_for_outcome_adjudicated: chain.claims.responsibility_for_outcome_adjudicated,
    legal_liability_established: chain.claims.legal_liability_established,
    moral_blame_assigned: chain.claims.moral_blame_assigned,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
