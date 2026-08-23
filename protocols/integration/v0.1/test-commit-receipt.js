'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const { recordCommitReceipt } = require('./record-commit-receipt.js');

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

function git(args, options = {}) {
  return cp.execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    input: options.input
  }).trim();
}

function runDecision(resultPath, inputPath, revalidationPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-commit-decision.js',
    resultPath,
    inputPath,
    revalidationPath
  ], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (run.error) throw run.error;
  assert(run.status === 0, `CommitDecision prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
  return readJson(resultPath);
}

function refSnapshot() {
  return git(['for-each-ref', '--format=%(refname) %(objectname)']);
}

function worktreeSnapshot() {
  return git(['status', '--porcelain=v1', '--untracked-files=all']);
}

function makeCommit({ predecessorSha, treeSha, message, date }) {
  return git(['commit-tree', treeSha, '-p', predecessorSha], {
    input: `${message}\n`,
    env: {
      GIT_AUTHOR_NAME: 'UU-AAP CommitReceipt Harness',
      GIT_AUTHOR_EMAIL: 'commit-receipt@invalid.example',
      GIT_COMMITTER_NAME: 'UU-AAP CommitReceipt Harness',
      GIT_COMMITTER_EMAIL: 'commit-receipt@invalid.example',
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date
    }
  });
}

function createEphemeralSuccessor(predecessorSha) {
  const indexPath = path.join(os.tmpdir(), `uu-aap-commit-receipt-${process.pid}.index`);
  try { fs.unlinkSync(indexPath); } catch (_) {}
  const env = { GIT_INDEX_FILE: indexPath };

  git(['read-tree', `${predecessorSha}^{tree}`], { env });

  const probePath = '.uu-aap/commit-receipt-probe.json';
  const probeBody = JSON.stringify({
    artifact_type: 'CommitReceiptProbe',
    predecessor: predecessorSha,
    purpose: 'ephemeral-local-git-object-conformance-vector'
  }, null, 2) + '\n';

  const blobSha = git(['hash-object', '-w', '--stdin'], { input: probeBody });
  git(['update-index', '--add', '--cacheinfo', `100644,${blobSha},${probePath}`], { env });
  const successorTree = git(['write-tree'], { env });
  const successorSha = makeCommit({
    predecessorSha,
    treeSha: successorTree,
    message: 'UU-AAP ephemeral CommitReceipt conformance transition',
    date: '2026-08-23T06:35:00Z'
  });

  try { fs.unlinkSync(indexPath); } catch (_) {}
  return { successorSha, successorTree, changedPaths: [probePath] };
}

function expectThrow(name, fn, pattern) {
  let error = null;
  try { fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

function main() {
  const receiptPath = process.argv[2] || '/tmp/commit-receipt.json';
  const decisionPath = process.argv[3] || '/tmp/commit-receipt-decision.json';
  const decisionInputPath = process.argv[4] || '/tmp/commit-receipt-decision-input.json';
  const revalidationPath = process.argv[5] || '/tmp/commit-receipt-revalidation.json';

  const decision = runDecision(decisionPath, decisionInputPath, revalidationPath);
  assert(decision.decision === 'approved', 'prerequisite CommitDecision must be approved');
  assert(decision.claims.commit_performed === false, 'CommitDecision must precede commit performance');

  const predecessorSha = decision.revision.slice(4);
  const refsBefore = refSnapshot();
  const worktreeBefore = worktreeSnapshot();
  const successor = createEphemeralSuccessor(predecessorSha);
  const refsAfter = refSnapshot();
  const worktreeAfter = worktreeSnapshot();

  assert(refsBefore === refsAfter, 'ephemeral commit creation must not move refs');
  assert(worktreeBefore === worktreeAfter, 'ephemeral commit creation must not change working tree');

  const execution = {
    execution_mode: 'ephemeral_local_git_object',
    recorded_at: '2026-08-23T06:35:01Z',
    action: decision.action,
    target: decision.target,
    operation_ref: decision.operation_ref,
    responsible_party_id: decision.responsible_party_id,
    executor_implementation_id: decision.executor_implementation_id,
    predecessor_revision: decision.revision,
    successor_commit_sha: successor.successorSha,
    successor_tree_sha: successor.successorTree,
    changed_paths: successor.changedPaths,
    ref_snapshot_before: refsBefore,
    ref_snapshot_after: refsAfter,
    working_tree_before: worktreeBefore,
    working_tree_after: worktreeAfter
  };

  const receipt = recordCommitReceipt({ commitDecision: decision, execution, repoRoot });
  assert(receipt.claims.commit_decision_approved === true, 'receipt must bind approved decision');
  assert(receipt.claims.commit_performed === true, 'receipt must establish commit performed in declared mode');
  assert(receipt.claims.state_transition_evidence_established === true, 'state transition evidence missing');
  assert(receipt.successor.parent_commit_sha === predecessorSha, 'successor parent mismatch');
  assert(receipt.successor.tree_sha === successor.successorTree, 'successor tree mismatch');
  assert(receipt.effect.changed_paths.length === 1, 'expected one changed path');

  for (const key of [
    'remote_repository_mutation_performed',
    'published_branch_or_ref_update_established',
    'poai_materialization_event_recorded',
    'outcome_observed',
    'policy_relative_canonicality_established',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_effect_established',
    'poai_v_conformance_established'
  ]) assert(receipt.claims[key] === false, `receipt must keep ${key}=false`);

  const vectors = [];

  vectors.push(expectThrow('unapproved_decision', () => {
    const badDecision = clone(decision);
    badDecision.decision = 'not_approved';
    badDecision.claims.commit_decision_approved = false;
    recordCommitReceipt({ commitDecision: badDecision, execution, repoRoot });
  }, /decision must be approved/));

  vectors.push(expectThrow('predecessor_mismatch', () => {
    const bad = clone(execution);
    bad.predecessor_revision = `git:${'0'.repeat(40)}`;
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /predecessor revision/));

  vectors.push(expectThrow('successor_missing', () => {
    const bad = clone(execution);
    bad.successor_commit_sha = '0'.repeat(40);
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /successor commit object missing/));

  const predecessorTree = git(['rev-parse', `${predecessorSha}^{tree}`]);
  const emptyCommit = makeCommit({
    predecessorSha,
    treeSha: predecessorTree,
    message: 'UU-AAP empty transition must fail',
    date: '2026-08-23T06:35:02Z'
  });
  vectors.push(expectThrow('unchanged_tree', () => {
    const bad = clone(execution);
    bad.successor_commit_sha = emptyCommit;
    bad.successor_tree_sha = predecessorTree;
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /unchanged tree/));

  const predecessorParent = git(['rev-parse', `${predecessorSha}^`]);
  const wrongParentCommit = makeCommit({
    predecessorSha: predecessorParent,
    treeSha: successor.successorTree,
    message: 'UU-AAP wrong-parent transition must fail',
    date: '2026-08-23T06:35:03Z'
  });
  vectors.push(expectThrow('wrong_parent', () => {
    const bad = clone(execution);
    bad.successor_commit_sha = wrongParentCommit;
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /successor parent/));

  vectors.push(expectThrow('successor_tree_substitution', () => {
    const bad = clone(execution);
    bad.successor_tree_sha = '0'.repeat(40);
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /successor tree mismatch/));

  vectors.push(expectThrow('changed_path_substitution', () => {
    const bad = clone(execution);
    bad.changed_paths = ['other/path.json'];
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /changed-path mismatch/));

  vectors.push(expectThrow('action_substitution', () => {
    const bad = clone(execution);
    bad.action = 'other.action';
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /action substitution/));

  vectors.push(expectThrow('target_substitution', () => {
    const bad = clone(execution);
    bad.target = 'github:Other/repo';
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /target substitution/));

  vectors.push(expectThrow('operation_substitution', () => {
    const bad = clone(execution);
    bad.operation_ref = 'urn:ccrp:operation:other';
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /operation substitution/));

  vectors.push(expectThrow('responsible_party_substitution', () => {
    const bad = clone(execution);
    bad.responsible_party_id = 'urn:uu-aap:actor:other';
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /responsible party substitution/));

  vectors.push(expectThrow('executor_substitution', () => {
    const bad = clone(execution);
    bad.executor_implementation_id = 'urn:uu-aap:implementation:other:0.1';
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /executor implementation substitution/));

  vectors.push(expectThrow('published_mode_overclaim', () => {
    const bad = clone(execution);
    bad.execution_mode = 'published_repository_commit';
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /supports only ephemeral_local_git_object/));

  vectors.push(expectThrow('ref_update_detected', () => {
    const bad = clone(execution);
    bad.ref_snapshot_after = `${bad.ref_snapshot_after}\nrefs/heads/fake ${'0'.repeat(40)}`;
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /Git refs changed/));

  vectors.push(expectThrow('working_tree_change_detected', () => {
    const bad = clone(execution);
    bad.working_tree_after = `${bad.working_tree_after}\n M fake.txt`;
    recordCommitReceipt({ commitDecision: decision, execution: bad, repoRoot });
  }, /working tree changed/));

  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');

  console.log(JSON.stringify({
    suite: 'UU-AAP CommitReceipt execution-state transition v0.1',
    predecessor: receipt.predecessor.revision,
    successor: receipt.successor.revision,
    execution_mode: receipt.execution_mode,
    positive_commit_performed: receipt.claims.commit_performed,
    negative_vectors: vectors.length,
    refs_unchanged: receipt.git_verification.refs_unchanged,
    working_tree_unchanged: receipt.git_verification.working_tree_unchanged,
    remote_repository_mutation_performed: receipt.claims.remote_repository_mutation_performed,
    outcome_observed: receipt.claims.outcome_observed,
    canonicality_established: receipt.claims.policy_relative_canonicality_established
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
