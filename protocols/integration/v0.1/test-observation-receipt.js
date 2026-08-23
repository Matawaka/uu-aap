'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { recordObservationReceipt } = require('./record-observation-receipt.js');

const repoRoot = path.resolve(__dirname, '../../..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function git(args) {
  return cp.execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim();
}

function refSnapshot() {
  return git(['for-each-ref', '--format=%(refname) %(objectname)']);
}

function worktreeSnapshot() {
  return git(['status', '--porcelain=v1', '--untracked-files=all']);
}

function runCommitReceipt(receiptPath, decisionPath, inputPath, revalidationPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-commit-receipt.js',
    receiptPath,
    decisionPath,
    inputPath,
    revalidationPath
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (run.error) throw run.error;
  assert(run.status === 0, `CommitReceipt prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
  return readJson(receiptPath);
}

function expectThrow(name, fn, pattern) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

function main() {
  const observationPath = process.argv[2] || '/tmp/observation-receipt.json';
  const commitReceiptPath = process.argv[3] || '/tmp/observation-prereq-commit-receipt.json';
  const decisionPath = process.argv[4] || '/tmp/observation-prereq-decision.json';
  const decisionInputPath = process.argv[5] || '/tmp/observation-prereq-decision-input.json';
  const revalidationPath = process.argv[6] || '/tmp/observation-prereq-revalidation.json';

  const commitReceipt = runCommitReceipt(
    commitReceiptPath,
    decisionPath,
    decisionInputPath,
    revalidationPath
  );

  assert(commitReceipt.claims.commit_performed === true, 'prerequisite CommitReceipt must establish commit performed');
  assert(commitReceipt.claims.outcome_observed === false, 'observation must remain a separate successor stage');

  const observation = {
    observation_mode: 'git_object_database_readback',
    observation_source: 'local_git_object_database',
    observed_at: '2026-08-23T07:33:00Z',
    observed_revision: commitReceipt.successor.revision,
    action: commitReceipt.action,
    target: commitReceipt.target,
    operation_ref: commitReceipt.operation_ref,
    responsible_party_id: commitReceipt.responsible_party_id,
    executor_implementation_id: commitReceipt.executor_implementation_id
  };

  const refsBefore = refSnapshot();
  const worktreeBefore = worktreeSnapshot();
  const receipt = recordObservationReceipt({ commitReceipt, observation, repoRoot });
  const refsAfter = refSnapshot();
  const worktreeAfter = worktreeSnapshot();

  assert(refsBefore === refsAfter, 'ObservationReceipt must not move refs');
  assert(worktreeBefore === worktreeAfter, 'ObservationReceipt must not mutate working tree');
  assert(receipt.commit_receipt_ref === commitReceipt.receipt_id, 'CommitReceipt binding mismatch');
  assert(receipt.observed.revision === commitReceipt.successor.revision, 'observed successor revision mismatch');
  assert(receipt.observed.tree_sha === commitReceipt.successor.tree_sha, 'observed successor tree mismatch');
  assert(receipt.observed.parent_commit_sha === commitReceipt.successor.parent_commit_sha,
    'observed successor parent mismatch');
  assert(receipt.observed.changed_path_count === commitReceipt.effect.changed_path_count,
    'observed changed-path count mismatch');
  assert(receipt.claims.outcome_observed === true, 'ObservationReceipt must establish narrow observed outcome');
  assert(receipt.claims.local_git_object_state_observed === true,
    'ObservationReceipt must establish local Git object readback');

  for (const key of [
    'remote_repository_state_observed',
    'published_branch_or_ref_update_observed',
    'poai_materialization_event_recorded',
    'policy_relative_canonicality_established',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_effect_established',
    'poai_v_conformance_established'
  ]) assert(receipt.claims[key] === false, `ObservationReceipt must keep ${key}=false`);

  const vectors = [];

  vectors.push(expectThrow('commit_receipt_not_performed', () => {
    const badReceipt = clone(commitReceipt);
    badReceipt.claims.commit_performed = false;
    recordObservationReceipt({ commitReceipt: badReceipt, observation, repoRoot });
  }, /commit_performed must be true/));

  vectors.push(expectThrow('observation_before_execution_receipt', () => {
    const bad = clone(observation);
    bad.observed_at = commitReceipt.recorded_at;
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /observation time must be after execution receipt/));

  vectors.push(expectThrow('observed_revision_substitution', () => {
    const bad = clone(observation);
    bad.observed_revision = `git:${'0'.repeat(40)}`;
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /observed revision/));

  vectors.push(expectThrow('successor_missing_at_observation', () => {
    const badReceipt = clone(commitReceipt);
    badReceipt.successor.commit_sha = '0'.repeat(40);
    badReceipt.successor.revision = `git:${'0'.repeat(40)}`;
    badReceipt.successor.tree_sha = '0'.repeat(40);
    const badObservation = clone(observation);
    badObservation.observed_revision = badReceipt.successor.revision;
    recordObservationReceipt({ commitReceipt: badReceipt, observation: badObservation, repoRoot });
  }, /successor commit missing at observation time/));

  vectors.push(expectThrow('successor_tree_substitution', () => {
    const badReceipt = clone(commitReceipt);
    badReceipt.successor.tree_sha = '0'.repeat(40);
    recordObservationReceipt({ commitReceipt: badReceipt, observation, repoRoot });
  }, /observed successor tree/));

  vectors.push(expectThrow('parent_substitution', () => {
    const badReceipt = clone(commitReceipt);
    badReceipt.successor.parent_commit_sha = '0'.repeat(40);
    recordObservationReceipt({ commitReceipt: badReceipt, observation, repoRoot });
  }, /declared successor parent/));

  vectors.push(expectThrow('changed_path_substitution', () => {
    const badReceipt = clone(commitReceipt);
    badReceipt.effect.changed_paths = ['other/path.json'];
    badReceipt.effect.changed_path_count = 1;
    recordObservationReceipt({ commitReceipt: badReceipt, observation, repoRoot });
  }, /changed-path mismatch/));

  vectors.push(expectThrow('action_substitution', () => {
    const bad = clone(observation);
    bad.action = 'other.action';
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /action substitution/));

  vectors.push(expectThrow('target_substitution', () => {
    const bad = clone(observation);
    bad.target = 'github:Other/repo';
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /target substitution/));

  vectors.push(expectThrow('operation_substitution', () => {
    const bad = clone(observation);
    bad.operation_ref = 'urn:ccrp:operation:other';
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /operation substitution/));

  vectors.push(expectThrow('responsible_party_substitution', () => {
    const bad = clone(observation);
    bad.responsible_party_id = 'urn:uu-aap:actor:other';
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /responsible party substitution/));

  vectors.push(expectThrow('executor_substitution', () => {
    const bad = clone(observation);
    bad.executor_implementation_id = 'urn:uu-aap:implementation:other:0.1';
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /executor implementation substitution/));

  vectors.push(expectThrow('unsupported_observation_mode', () => {
    const bad = clone(observation);
    bad.observation_mode = 'remote_repository_readback';
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /supports only git_object_database_readback/));

  vectors.push(expectThrow('unsupported_observation_source', () => {
    const bad = clone(observation);
    bad.observation_source = 'github_remote';
    recordObservationReceipt({ commitReceipt, observation: bad, repoRoot });
  }, /supports only local_git_object_database/));

  vectors.push(expectThrow('predecessor_canonicality_overclaim', () => {
    const badReceipt = clone(commitReceipt);
    badReceipt.claims.policy_relative_canonicality_established = true;
    recordObservationReceipt({ commitReceipt: badReceipt, observation, repoRoot });
  }, /must not already claim canonicality/));

  fs.writeFileSync(observationPath, JSON.stringify(receipt, null, 2) + '\n');

  console.log(JSON.stringify({
    suite: 'UU-AAP ObservationReceipt post-execution readback v0.1',
    commit_receipt_ref: receipt.commit_receipt_ref,
    observed_revision: receipt.observed.revision,
    observation_mode: receipt.observation_mode,
    observation_source: receipt.observation_source,
    outcome_scope: receipt.outcome_scope,
    positive_outcome_observed: receipt.claims.outcome_observed,
    negative_vectors: vectors.length,
    refs_unchanged: receipt.readback_verification.refs_unchanged_during_observation,
    working_tree_unchanged: receipt.readback_verification.working_tree_unchanged_during_observation,
    remote_repository_state_observed: receipt.claims.remote_repository_state_observed,
    canonicality_established: receipt.claims.policy_relative_canonicality_established
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
