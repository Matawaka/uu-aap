'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { digestJson, observeOutcome, buildResponsibilityTrace } = require('./trace-responsibility.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(condition, message) { if (!condition) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function runProvenanceCompletion(completionPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-origin-provenance.js', completionPath
  ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  assert(run.status === 0, `provenance completion prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
}

async function expectReject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

async function main() {
  const tracePath = process.argv[2] || '/tmp/responsibility-trace.json';
  const outcomePath = process.argv[3] || '/tmp/outcome-observation.json';
  const completionPath = process.argv[4] || '/tmp/outcome-provenance-completion.json';

  runProvenanceCompletion(completionPath);
  const completionReceipt = readJson(completionPath);
  const commitReceipt = readJson('/tmp/origin-commit.json');
  const predecessorObservationReceipt = readJson('/tmp/origin-observation.json');
  const evidenceBundle = readJson('/tmp/origin-evidence-bundle.json');

  const outcomeObservation = await observeOutcome({
    completionReceipt,
    commitReceipt,
    predecessorObservationReceipt,
    observedAt: '2026-08-23T08:20:00Z',
    repoRoot
  });
  const trace = await buildResponsibilityTrace({
    completionReceipt,
    outcomeObservation,
    evidenceBundle,
    tracedAt: '2026-08-23T08:20:01Z'
  });

  assert(outcomeObservation.claims.exact_transition_effect_observed === true, 'exact transition effect must be observed');
  assert(outcomeObservation.effect_relation.code === 'exact_state_transition_effect', 'effect relation mismatch');
  assert(outcomeObservation.causal_assessment.status === 'not_assessed_beyond_transition', 'causal boundary mismatch');
  assert(outcomeObservation.claims.causal_proof_certified === false, 'outcome must not certify causality');
  assert(trace.claims.provenance_completion_preserved === true, 'completion must be preserved');
  assert(trace.claims.responsibility_chain_traceable === true, 'responsibility chain must be traceable');
  assert(trace.claims.responsible_party_execution_context_bound === true, 'responsible party context must be bound');
  assert(trace.claims.accepted_responsibility_scope_preserved === true, 'accepted scope must be preserved');
  assert(trace.responsibility_attribution.status === 'traceable_not_adjudicated', 'responsibility attribution boundary mismatch');
  assert(trace.scope_intersection.length === 1 && trace.scope_intersection[0] === trace.semantic_binding.action,
    'only originating action may be positively intersected in v0.1');

  for (const key of [
    'external_consequence_causality_established', 'causal_proof_certified', 'responsibility_for_outcome_adjudicated',
    'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned',
    'moral_correctness_established', 'truth_certified', 'remote_branch_or_ref_canonicality_established',
    'poai_materialization_event_recorded', 'poai_successor_record_identity_inferred',
    'universal_canonicality_established', 'poai_v_conformance_established'
  ]) assert(trace.claims[key] === false, `trace must keep ${key}=false`);

  const vectors = [];

  vectors.push(await expectReject('observation_before_completion', async () => {
    await observeOutcome({
      completionReceipt, commitReceipt, predecessorObservationReceipt,
      observedAt: completionReceipt.completed_at, repoRoot
    });
  }, /must occur after provenance completion/));

  vectors.push(await expectReject('predecessor_observation_ref_substitution', async () => {
    const obs = clone(predecessorObservationReceipt);
    obs.commit_receipt_ref = `urn:uu-aap:commit-receipt:${'0'.repeat(40)}`;
    await observeOutcome({ completionReceipt, commitReceipt, predecessorObservationReceipt: obs, observedAt: '2026-08-23T08:20:00Z', repoRoot });
  }, /lineage substitution/));

  vectors.push(await expectReject('completion_revision_substitution', async () => {
    const c = clone(completionReceipt);
    c.recognized_state.revision = `git:${'0'.repeat(40)}`;
    await observeOutcome({ completionReceipt: c, commitReceipt, predecessorObservationReceipt, observedAt: '2026-08-23T08:20:00Z', repoRoot });
  }, /recognized revision substitution/));

  vectors.push(await expectReject('completion_tree_substitution', async () => {
    const c = clone(completionReceipt);
    c.recognized_state.tree_sha = '0'.repeat(40);
    await observeOutcome({ completionReceipt: c, commitReceipt, predecessorObservationReceipt, observedAt: '2026-08-23T08:20:00Z', repoRoot });
  }, /recognized tree substitution/));

  vectors.push(await expectReject('completion_effect_substitution', async () => {
    const c = clone(completionReceipt);
    c.recognized_state.changed_paths = ['other/path'];
    await observeOutcome({ completionReceipt: c, commitReceipt, predecessorObservationReceipt, observedAt: '2026-08-23T08:20:00Z', repoRoot });
  }, /predecessor effect substitution/));

  vectors.push(await expectReject('completion_binding_digest_substitution', async () => {
    const o = clone(outcomeObservation);
    o.completion_binding.digest.value = '0'.repeat(64);
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation: o, evidenceBundle, tracedAt: '2026-08-23T08:20:01Z' });
  }, /completion binding substitution/));

  vectors.push(await expectReject('handoff_result_ref_substitution', async () => {
    const b = clone(evidenceBundle);
    b.upstream.handoff_result.artifact_ref = 'urn:ial:boundary-assessment:other';
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation, evidenceBundle: b, tracedAt: '2026-08-23T08:20:01Z' });
  }, /handoff_result ref substitution against completion/));

  vectors.push(await expectReject('handoff_offer_digest_substitution', async () => {
    const b = clone(evidenceBundle);
    b.upstream.handoff_offer.digest.value = '0'.repeat(64);
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation, evidenceBundle: b, tracedAt: '2026-08-23T08:20:01Z' });
  }, /handoff_offer digest substitution/));

  vectors.push(await expectReject('responsible_party_substitution', async () => {
    const b = clone(evidenceBundle);
    b.upstream.handoff_acceptance.artifact.receiving_party_id = 'urn:uu-aap:party:other';
    b.upstream.handoff_acceptance.digest.value = await digestJson(b.upstream.handoff_acceptance.artifact);
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation, evidenceBundle: b, tracedAt: '2026-08-23T08:20:01Z' });
  }, /handoff_acceptance digest substitution against completion|responsible party substitution/));

  vectors.push(await expectReject('executor_substitution', async () => {
    const o = clone(outcomeObservation);
    o.semantic_binding.executor_implementation_id = 'urn:uu-aap:implementation:other';
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation: o, evidenceBundle, tracedAt: '2026-08-23T08:20:01Z' });
  }, /outcome semantic substitution/));

  vectors.push(await expectReject('action_substitution', async () => {
    const o = clone(outcomeObservation);
    o.semantic_binding.action = 'other.action';
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation: o, evidenceBundle, tracedAt: '2026-08-23T08:20:01Z' });
  }, /outcome semantic substitution/));

  vectors.push(await expectReject('target_substitution', async () => {
    const o = clone(outcomeObservation);
    o.semantic_binding.target = 'github:Other/repo';
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation: o, evidenceBundle, tracedAt: '2026-08-23T08:20:01Z' });
  }, /outcome semantic substitution/));

  vectors.push(await expectReject('operation_substitution', async () => {
    const o = clone(outcomeObservation);
    o.semantic_binding.operation_ref = 'urn:ccrp:operation:other';
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation: o, evidenceBundle, tracedAt: '2026-08-23T08:20:01Z' });
  }, /outcome semantic substitution/));

  vectors.push(await expectReject('responsibility_scope_substitution', async () => {
    const b = clone(evidenceBundle);
    b.upstream.handoff_acceptance.artifact.accepted_responsibility_scope = ['preserve_historical_frontier'];
    b.upstream.handoff_acceptance.digest.value = await digestJson(b.upstream.handoff_acceptance.artifact);
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation, evidenceBundle: b, tracedAt: '2026-08-23T08:20:01Z' });
  }, /handoff_acceptance digest substitution against completion|accepted responsibility scope substitution|originating action not in accepted/));

  vectors.push(await expectReject('causal_overclaim', async () => {
    const o = clone(outcomeObservation);
    o.causal_assessment.establishes_causal_proof = true;
    o.claims.causal_proof_certified = true;
    await buildResponsibilityTrace({ completionReceipt, outcomeObservation: o, evidenceBundle, tracedAt: '2026-08-23T08:20:01Z' });
  }, /cannot be upgraded to generalized causality|prohibited claim causal_proof_certified/));

  vectors.push(await expectReject('legal_overclaim_in_completion', async () => {
    const c = clone(completionReceipt);
    c.claims.legal_responsibility_determined = true;
    await observeOutcome({ completionReceipt: c, commitReceipt, predecessorObservationReceipt, observedAt: '2026-08-23T08:20:00Z', repoRoot });
  }, /prohibited claim legal_responsibility_determined/));

  fs.writeFileSync(outcomePath, JSON.stringify(outcomeObservation, null, 2) + '\n');
  fs.writeFileSync(tracePath, JSON.stringify(trace, null, 2) + '\n');

  console.log(JSON.stringify({
    suite: 'UU-AAP OutcomeObservation / ResponsibilityTrace v0.1',
    outcome_observation_id: outcomeObservation.outcome_observation_id,
    trace_id: trace.trace_id,
    effect_relation: trace.effect_relation,
    causal_status: trace.causal_assessment.status,
    responsibility_attribution_status: trace.responsibility_attribution.status,
    responsibility_chain_traceable: trace.claims.responsibility_chain_traceable,
    responsibility_for_outcome_adjudicated: trace.claims.responsibility_for_outcome_adjudicated,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
