'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { digestJson, buildProvenanceClosure } = require('./build-provenance-closure.js');

const repoRoot = path.resolve(__dirname, '../../..');
const policyPath = path.join(
  repoRoot,
  'protocols/integration/v0.1/policies/integration-local-git-object-database.canonicalization-policy.json'
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function runCanonicalization(paths) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-canonicalization-receipt.js',
    paths.canonicalization,
    paths.observation,
    paths.commit,
    paths.decision,
    paths.decisionInput,
    paths.revalidation
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (run.error) throw run.error;
  assert(run.status === 0, `CanonicalizationReceipt prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
  return {
    canonicalizationReceipt: readJson(paths.canonicalization),
    observationReceipt: readJson(paths.observation),
    commitReceipt: readJson(paths.commit),
    commitDecision: readJson(paths.decision),
    commitDecisionInput: readJson(paths.decisionInput),
    revalidationReceipt: readJson(paths.revalidation),
    canonicalizationPolicy: readJson(policyPath)
  };
}

async function expectReject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

async function main() {
  const closurePath = process.argv[2] || '/tmp/provenance-closure.json';
  const paths = {
    canonicalization: process.argv[3] || '/tmp/provenance-canonicalization.json',
    observation: process.argv[4] || '/tmp/provenance-observation.json',
    commit: process.argv[5] || '/tmp/provenance-commit.json',
    decision: process.argv[6] || '/tmp/provenance-decision.json',
    decisionInput: process.argv[7] || '/tmp/provenance-decision-input.json',
    revalidation: process.argv[8] || '/tmp/provenance-revalidation.json'
  };

  const upstream = runCanonicalization(paths);
  const closedAt = '2026-08-23T07:50:00Z';
  const closure = await buildProvenanceClosure({ ...upstream, closedAt });

  assert(closure.claims.bounded_chain_closed === true, 'bounded chain must close');
  assert(closure.claims.digest_bound_suffix_established === true, 'digest-bound suffix required');
  assert(closure.claims.reference_bound_upstream_frontier_established === true,
    'reference-bound upstream frontier required');
  assert(closure.claims.semantic_origin_provenance_complete === false,
    'semantic-origin provenance must remain incomplete');
  assert(closure.claims.standalone_context_frame_provenance_established === false,
    'ContextFrame provenance must not be invented');
  assert(closure.claims.standalone_intent_provenance_established === false,
    'Intent provenance must not be invented');
  assert(closure.claims.all_upstream_evidence_artifact_bytes_bound === false,
    'reference-only upstream evidence must not be called digest-bound');
  assert(closure.claims.policy_relative_canonicality_preserved === true,
    'policy-relative canonicality must be preserved');
  assert(closure.digest_bound_lineage.length === 7, 'expected seven digest-bound lineage artifacts');
  assert(closure.digest_bound_lineage[0].artifact_type === 'RevalidationReceipt',
    'origin frontier must start at RevalidationReceipt');
  assert(closure.digest_bound_lineage[5].artifact_type === 'CanonicalizationReceipt',
    'canonicalization binding missing');
  assert(closure.digest_bound_lineage[6].artifact_type === 'UU-AAPCanonicalizationPolicy',
    'policy binding missing');
  assert(closure.reference_bound_upstream.refs.length === 6,
    'expected six reference-only upstream evidence refs');

  const expectedArtifacts = [
    upstream.revalidationReceipt,
    upstream.commitDecisionInput,
    upstream.commitDecision,
    upstream.commitReceipt,
    upstream.observationReceipt,
    upstream.canonicalizationReceipt,
    upstream.canonicalizationPolicy
  ];
  for (let i = 0; i < expectedArtifacts.length; i += 1) {
    const expectedDigest = await digestJson(expectedArtifacts[i]);
    assert(closure.digest_bound_lineage[i].digest.value === expectedDigest,
      `digest mismatch at lineage index ${i}`);
  }

  for (const key of [
    'remote_branch_or_ref_canonicality_established',
    'poai_materialization_event_recorded',
    'poai_successor_record_identity_inferred',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_responsibility_determined',
    'legal_effect_established',
    'moral_correctness_established',
    'poai_v_conformance_established'
  ]) assert(closure.claims[key] === false, `closure must keep ${key}=false`);

  const vectors = [];
  const args = () => ({ ...upstream, closedAt });

  vectors.push(await expectReject('closure_before_canonicalization', async () => {
    await buildProvenanceClosure({ ...upstream, closedAt: upstream.canonicalizationReceipt.evaluated_at });
  }, /closure must occur after canonicalization/));

  vectors.push(await expectReject('revalidation_ref_substitution', async () => {
    const a = args();
    a.commitDecisionInput = clone(a.commitDecisionInput);
    a.commitDecisionInput.evidence_refs.revalidation_receipt_ref = 'urn:uu-aap:revalidation:other';
    await buildProvenanceClosure(a);
  }, /revalidation ref substitution/));

  vectors.push(await expectReject('decision_input_lineage_substitution', async () => {
    const a = args();
    a.commitDecisionInput = clone(a.commitDecisionInput);
    a.commitDecisionInput.decision_input_id = 'urn:uu-aap:commit-decision-input:other';
    await buildProvenanceClosure(a);
  }, /DecisionInput\/Decision lineage substitution/));

  vectors.push(await expectReject('commit_decision_lineage_substitution', async () => {
    const a = args();
    a.commitReceipt = clone(a.commitReceipt);
    a.commitReceipt.commit_decision_ref = 'urn:uu-aap:commit-decision:other';
    await buildProvenanceClosure(a);
  }, /Decision\/Commit lineage substitution/));

  vectors.push(await expectReject('observation_lineage_substitution', async () => {
    const a = args();
    a.observationReceipt = clone(a.observationReceipt);
    a.observationReceipt.commit_receipt_ref = `urn:uu-aap:commit-receipt:${'0'.repeat(40)}`;
    await buildProvenanceClosure(a);
  }, /Commit\/Observation lineage substitution/));

  vectors.push(await expectReject('canonicalization_lineage_substitution', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.observation_receipt_ref = `urn:uu-aap:observation-receipt:${'0'.repeat(40)}`;
    await buildProvenanceClosure(a);
  }, /Observation\/Canonicalization lineage substitution/));

  vectors.push(await expectReject('authority_ref_substitution', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.lineage.authority_verification_ref = 'urn:poai:authority-verification:other';
    await buildProvenanceClosure(a);
  }, /authority ref substitution/));

  vectors.push(await expectReject('pre_materialization_ref_substitution', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.lineage.pre_materialization_ref = 'urn:poai-ccrp:pre-materialization:other';
    await buildProvenanceClosure(a);
  }, /pre-materialization ref substitution/));

  vectors.push(await expectReject('semantic_action_substitution', async () => {
    const a = args();
    a.observationReceipt = clone(a.observationReceipt);
    a.observationReceipt.action = 'other.action';
    await buildProvenanceClosure(a);
  }, /semantic binding substitution/));

  vectors.push(await expectReject('semantic_revalidation_target_substitution', async () => {
    const a = args();
    a.revalidationReceipt = clone(a.revalidationReceipt);
    a.revalidationReceipt.target = 'github:Other/repo';
    await buildProvenanceClosure(a);
  }, /revalidation semantic binding substitution/));

  vectors.push(await expectReject('successor_tree_substitution', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.recognized_state.tree_sha = '0'.repeat(40);
    await buildProvenanceClosure(a);
  }, /successor tree substitution/));

  vectors.push(await expectReject('successor_effect_substitution', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.recognized_state.changed_paths = ['other/path.json'];
    a.canonicalizationReceipt.recognized_state.changed_path_count = 1;
    await buildProvenanceClosure(a);
  }, /successor effect substitution/));

  vectors.push(await expectReject('canonicality_removed', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.claims.policy_relative_canonicality_established = false;
    await buildProvenanceClosure(a);
  }, /policy-relative canonicality required/));

  vectors.push(await expectReject('canonicality_scope_substitution', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.policy.canonicality_scope = 'urn:uu-aap:canonicality-scope:other';
    await buildProvenanceClosure(a);
  }, /canonicality scope substitution/));

  vectors.push(await expectReject('policy_digest_substitution', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.policy.digest.value = '0'.repeat(64);
    await buildProvenanceClosure(a);
  }, /canonicalization policy digest substitution/));

  vectors.push(await expectReject('remote_canonicality_overclaim', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.claims.remote_branch_or_ref_canonicality_established = true;
    await buildProvenanceClosure(a);
  }, /prohibited claim remote_branch_or_ref_canonicality_established/));

  vectors.push(await expectReject('truth_overclaim', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.claims.truth_certified = true;
    await buildProvenanceClosure(a);
  }, /prohibited claim truth_certified/));

  vectors.push(await expectReject('poai_materialization_overclaim', async () => {
    const a = args();
    a.canonicalizationReceipt = clone(a.canonicalizationReceipt);
    a.canonicalizationReceipt.claims.poai_materialization_event_recorded = true;
    await buildProvenanceClosure(a);
  }, /prohibited claim poai_materialization_event_recorded/));

  fs.writeFileSync(closurePath, JSON.stringify(closure, null, 2) + '\n');

  console.log(JSON.stringify({
    suite: 'UU-AAP bounded ProvenanceClosureReceipt v0.1',
    closure_id: closure.closure_id,
    bounded_chain_closed: closure.claims.bounded_chain_closed,
    digest_bound_lineage_count: closure.digest_bound_lineage.length,
    reference_bound_upstream_count: closure.reference_bound_upstream.refs.length,
    semantic_origin_provenance_complete: closure.claims.semantic_origin_provenance_complete,
    standalone_context_frame_provenance_established: closure.claims.standalone_context_frame_provenance_established,
    standalone_intent_provenance_established: closure.claims.standalone_intent_provenance_established,
    policy_relative_canonicality_preserved: closure.claims.policy_relative_canonicality_preserved,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
