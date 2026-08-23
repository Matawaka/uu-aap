'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  digestPolicy,
  evaluateCanonicalization
} = require('./evaluate-canonicalization.js');

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

function runObservation(observationPath, commitReceiptPath, decisionPath, decisionInputPath, revalidationPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-observation-receipt.js',
    observationPath,
    commitReceiptPath,
    decisionPath,
    decisionInputPath,
    revalidationPath
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (run.error) throw run.error;
  assert(run.status === 0, `ObservationReceipt prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
  return {
    observationReceipt: readJson(observationPath),
    commitReceipt: readJson(commitReceiptPath),
    commitDecision: readJson(decisionPath),
    commitDecisionInput: readJson(decisionInputPath)
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
  const receiptPath = process.argv[2] || '/tmp/canonicalization-receipt.json';
  const observationPath = process.argv[3] || '/tmp/canonicalization-observation.json';
  const commitReceiptPath = process.argv[4] || '/tmp/canonicalization-commit-receipt.json';
  const decisionPath = process.argv[5] || '/tmp/canonicalization-decision.json';
  const decisionInputPath = process.argv[6] || '/tmp/canonicalization-decision-input.json';
  const revalidationPath = process.argv[7] || '/tmp/canonicalization-revalidation.json';

  const upstream = runObservation(
    observationPath,
    commitReceiptPath,
    decisionPath,
    decisionInputPath,
    revalidationPath
  );
  const { observationReceipt, commitReceipt, commitDecision, commitDecisionInput } = upstream;
  const policy = readJson(policyPath);
  const policyDigest = await digestPolicy(policy);

  const context = {
    evaluated_at: '2026-08-23T07:45:00Z',
    expected_policy_id: policy.policy_id,
    expected_policy_version: policy.policy_version,
    expected_policy_digest: policyDigest,
    expected_canonicality_scope: policy.canonicality_scope,
    authority_verification_ref: commitDecisionInput.evidence_refs.authority_verification_ref,
    pre_materialization_ref: commitDecisionInput.evidence_refs.pre_materialization_ref,
    active_stay: false,
    stay_refs: [],
    conflict_status: 'none',
    conflict_candidate_revisions: [observationReceipt.observed.revision]
  };

  const receipt = await evaluateCanonicalization({
    observationReceipt,
    commitReceipt,
    commitDecision,
    commitDecisionInput,
    policy,
    context
  });

  assert(receipt.observation_receipt_ref === observationReceipt.receipt_id,
    'canonicalization must bind exact ObservationReceipt');
  assert(receipt.lineage.commit_receipt_ref === commitReceipt.receipt_id,
    'canonicalization must bind exact CommitReceipt');
  assert(receipt.lineage.commit_decision_ref === commitDecision.decision_id,
    'canonicalization must bind exact CommitDecision');
  assert(receipt.lineage.decision_input_ref === commitDecisionInput.decision_input_id,
    'canonicalization must bind exact CommitDecisionInput');
  assert(receipt.recognized_state.revision === observationReceipt.observed.revision,
    'recognized revision mismatch');
  assert(receipt.recognized_state.tree_sha === observationReceipt.observed.tree_sha,
    'recognized tree mismatch');
  assert(receipt.policy.digest.value === policyDigest, 'policy digest mismatch');
  assert(receipt.canonicality_claim.status === 'recognized', 'canonicality status mismatch');
  assert(receipt.canonicality_claim.scope === policy.canonicality_scope, 'canonicality scope mismatch');
  assert(receipt.claims.policy_evaluation_passed === true, 'policy evaluation must pass');
  assert(receipt.claims.policy_relative_canonicality_established === true,
    'policy-relative canonicality must be established');

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
  ]) assert(receipt.claims[key] === false, `canonicalization must keep ${key}=false`);

  assert(receipt.poai_adapter_boundary.observed_git_successor_is_poai_successor_record === false,
    'Git successor must not become PoAI successor record implicitly');
  assert(receipt.poai_adapter_boundary.typed_poai_successor_adapter_present === false,
    'typed PoAI successor adapter must remain absent');
  assert(receipt.poai_adapter_boundary.poai_materialization_equivalence_inferred === false,
    'PoAI materialization equivalence must not be inferred');

  const vectors = [];

  vectors.push(await expectReject('observation_not_observed', async () => {
    const bad = clone(observationReceipt);
    bad.claims.outcome_observed = false;
    await evaluateCanonicalization({ observationReceipt: bad, commitReceipt, commitDecision, commitDecisionInput, policy, context });
  }, /outcome_observed must be true/));

  vectors.push(await expectReject('observation_commit_lineage_substitution', async () => {
    const bad = clone(observationReceipt);
    bad.commit_receipt_ref = `urn:uu-aap:commit-receipt:${'0'.repeat(40)}`;
    await evaluateCanonicalization({ observationReceipt: bad, commitReceipt, commitDecision, commitDecisionInput, policy, context });
  }, /ObservationReceipt\/CommitReceipt lineage substitution/));

  vectors.push(await expectReject('commit_decision_lineage_substitution', async () => {
    const bad = clone(commitReceipt);
    bad.commit_decision_ref = 'urn:uu-aap:commit-decision:other';
    await evaluateCanonicalization({ observationReceipt, commitReceipt: bad, commitDecision, commitDecisionInput, policy, context });
  }, /CommitReceipt\/CommitDecision lineage substitution/));

  vectors.push(await expectReject('decision_input_lineage_substitution', async () => {
    const bad = clone(commitDecisionInput);
    bad.decision_input_id = 'urn:uu-aap:commit-decision-input:other';
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput: bad, policy, context });
  }, /CommitDecision\/DecisionInput lineage substitution/));

  vectors.push(await expectReject('action_substitution', async () => {
    const bad = clone(observationReceipt);
    bad.action = 'other.action';
    await evaluateCanonicalization({ observationReceipt: bad, commitReceipt, commitDecision, commitDecisionInput, policy, context });
  }, /semantic binding substitution/));

  vectors.push(await expectReject('target_substitution', async () => {
    const bad = clone(observationReceipt);
    bad.target = 'github:Other/repo';
    await evaluateCanonicalization({ observationReceipt: bad, commitReceipt, commitDecision, commitDecisionInput, policy, context });
  }, /semantic binding substitution/));

  vectors.push(await expectReject('successor_tree_substitution', async () => {
    const bad = clone(observationReceipt);
    bad.observed.tree_sha = '0'.repeat(40);
    await evaluateCanonicalization({ observationReceipt: bad, commitReceipt, commitDecision, commitDecisionInput, policy, context });
  }, /expected\/observed tree mismatch/));

  vectors.push(await expectReject('successor_effect_substitution', async () => {
    const bad = clone(observationReceipt);
    bad.observed.changed_paths = ['other/path.json'];
    bad.observed.changed_path_count = 1;
    await evaluateCanonicalization({ observationReceipt: bad, commitReceipt, commitDecision, commitDecisionInput, policy, context });
  }, /expected\/observed changed paths mismatch/));

  vectors.push(await expectReject('authority_ref_substitution', async () => {
    const bad = clone(context);
    bad.authority_verification_ref = 'urn:poai:authority-verification:other';
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /authority verification ref substitution/));

  vectors.push(await expectReject('pre_materialization_ref_substitution', async () => {
    const bad = clone(context);
    bad.pre_materialization_ref = 'urn:poai-ccrp:pre-materialization:other';
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /pre-materialization ref substitution/));

  vectors.push(await expectReject('policy_id_substitution', async () => {
    const bad = clone(context);
    bad.expected_policy_id = 'urn:uu-aap:canonicalization-policy:other:0.1';
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /policy ID substitution/));

  vectors.push(await expectReject('policy_version_substitution', async () => {
    const bad = clone(context);
    bad.expected_policy_version = policy.policy_version + 1;
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /policy version substitution/));

  vectors.push(await expectReject('policy_digest_substitution', async () => {
    const bad = clone(context);
    bad.expected_policy_digest = '0'.repeat(64);
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /policy digest substitution/));

  vectors.push(await expectReject('canonicality_scope_substitution', async () => {
    const bad = clone(context);
    bad.expected_canonicality_scope = 'urn:uu-aap:canonicality-scope:other';
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /canonicality scope substitution/));

  vectors.push(await expectReject('policy_not_yet_effective', async () => {
    const bad = clone(context);
    bad.evaluated_at = '2026-08-23T07:39:59Z';
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /policy not active/));

  vectors.push(await expectReject('active_stay', async () => {
    const bad = clone(context);
    bad.active_stay = true;
    bad.stay_refs = ['urn:uu-aap:stay:test'];
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /active stay blocks recognition/));

  vectors.push(await expectReject('unresolved_conflict', async () => {
    const bad = clone(context);
    bad.conflict_status = 'unresolved';
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /unresolved conflict blocks recognition/));

  vectors.push(await expectReject('multiple_head_conflict', async () => {
    const bad = clone(context);
    bad.conflict_candidate_revisions = [
      observationReceipt.observed.revision,
      commitReceipt.predecessor.revision
    ];
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy, context: bad });
  }, /single-head conflict rule not satisfied/));

  vectors.push(await expectReject('policy_target_substitution', async () => {
    const badPolicy = clone(policy);
    badPolicy.applies_to.target = 'github:Other/repo';
    const badContext = clone(context);
    badContext.expected_policy_digest = await digestPolicy(badPolicy);
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy: badPolicy, context: badContext });
  }, /unsupported target/));

  vectors.push(await expectReject('poai_successor_identity_overclaim', async () => {
    const badPolicy = clone(policy);
    badPolicy.poai_adapter_boundary.observed_git_successor_is_poai_successor_record = true;
    const badContext = clone(context);
    badContext.expected_policy_digest = await digestPolicy(badPolicy);
    await evaluateCanonicalization({ observationReceipt, commitReceipt, commitDecision, commitDecisionInput, policy: badPolicy, context: badContext });
  }, /Git successor must not be declared a PoAI successor record/));

  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');

  console.log(JSON.stringify({
    suite: 'UU-AAP CanonicalizationReceipt policy recognition v0.1',
    observation_receipt_ref: receipt.observation_receipt_ref,
    recognized_revision: receipt.recognized_state.revision,
    canonicality_scope: receipt.canonicality_claim.scope,
    canonicality_status: receipt.canonicality_claim.status,
    policy_relative_canonicality_established: receipt.claims.policy_relative_canonicality_established,
    poai_materialization_event_recorded: receipt.claims.poai_materialization_event_recorded,
    poai_successor_record_identity_inferred: receipt.claims.poai_successor_record_identity_inferred,
    universal_canonicality_established: receipt.claims.universal_canonicality_established,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
