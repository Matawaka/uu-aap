'use strict';

const cp = require('child_process');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(object, keys, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: expected object`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(object, key), `${label}: missing ${key}`);
  for (const key of Object.keys(object)) assert(keys.includes(key), `${label}: unexpected property ${key}`);
}

function nonEmpty(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label}: expected non-empty string`);
}

function sha1(value, label) {
  assert(typeof value === 'string' && /^[0-9a-f]{40}$/.test(value), `${label}: expected 40-char lowercase Git SHA`);
}

function gitRevision(value, label) {
  assert(typeof value === 'string' && /^git:[0-9a-f]{40}$/.test(value), `${label}: expected git:<sha>`);
}

function git(repoRoot, args) {
  return cp.execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim();
}

function commitExists(repoRoot, sha) {
  const result = cp.spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  return result.status === 0;
}

function sortedUniqueStrings(value, label) {
  assert(Array.isArray(value) && value.length > 0, `${label}: expected non-empty array`);
  for (const item of value) nonEmpty(item, label);
  assert(new Set(value).size === value.length, `${label}: duplicates forbidden`);
  return [...value].sort();
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function refSnapshot(repoRoot) {
  return git(repoRoot, ['for-each-ref', '--format=%(refname) %(objectname)']);
}

function worktreeSnapshot(repoRoot) {
  return git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
}

function validateCommitReceipt(receipt) {
  assert(receipt && typeof receipt === 'object', 'CommitReceipt: required object');
  assert(receipt.artifact_type === 'CommitReceipt', 'CommitReceipt: artifact_type mismatch');
  assert(receipt.artifact_version === '0.1', 'CommitReceipt: artifact_version mismatch');
  assert(receipt.execution_mode === 'ephemeral_local_git_object',
    'CommitReceipt: unsupported execution mode for ObservationReceipt v0.1');
  nonEmpty(receipt.receipt_id, 'CommitReceipt.receipt_id');
  assert(/^urn:uu-aap:commit-receipt:/.test(receipt.receipt_id), 'CommitReceipt.receipt_id: invalid');
  assert(typeof receipt.recorded_at === 'string' && Number.isFinite(Date.parse(receipt.recorded_at)),
    'CommitReceipt.recorded_at: invalid date-time');

  for (const key of ['action', 'target', 'operation_ref', 'responsible_party_id', 'executor_implementation_id']) {
    nonEmpty(receipt[key], `CommitReceipt.${key}`);
  }

  assert(receipt.claims && receipt.claims.commit_performed === true,
    'CommitReceipt: commit_performed must be true');
  assert(receipt.claims.state_transition_evidence_established === true,
    'CommitReceipt: state-transition evidence must be established');
  assert(receipt.claims.outcome_observed === false,
    'CommitReceipt: predecessor stage must not already claim outcome observed');
  assert(receipt.claims.policy_relative_canonicality_established === false,
    'CommitReceipt: predecessor stage must not already claim canonicality');

  assert(receipt.predecessor && typeof receipt.predecessor === 'object', 'CommitReceipt.predecessor: required');
  assert(receipt.successor && typeof receipt.successor === 'object', 'CommitReceipt.successor: required');
  gitRevision(receipt.predecessor.revision, 'CommitReceipt.predecessor.revision');
  sha1(receipt.predecessor.commit_sha, 'CommitReceipt.predecessor.commit_sha');
  sha1(receipt.predecessor.tree_sha, 'CommitReceipt.predecessor.tree_sha');
  assert(receipt.predecessor.revision === `git:${receipt.predecessor.commit_sha}`,
    'CommitReceipt: predecessor revision/commit mismatch');

  gitRevision(receipt.successor.revision, 'CommitReceipt.successor.revision');
  sha1(receipt.successor.commit_sha, 'CommitReceipt.successor.commit_sha');
  sha1(receipt.successor.tree_sha, 'CommitReceipt.successor.tree_sha');
  sha1(receipt.successor.parent_commit_sha, 'CommitReceipt.successor.parent_commit_sha');
  assert(receipt.successor.revision === `git:${receipt.successor.commit_sha}`,
    'CommitReceipt: successor revision/commit mismatch');
  assert(receipt.successor.parent_commit_sha === receipt.predecessor.commit_sha,
    'CommitReceipt: declared successor parent/predecessor mismatch');

  assert(receipt.effect && receipt.effect.kind === 'git_commit', 'CommitReceipt.effect: expected git_commit');
  const changedPaths = sortedUniqueStrings(receipt.effect.changed_paths, 'CommitReceipt.effect.changed_paths');
  assert(receipt.effect.changed_path_count === changedPaths.length,
    'CommitReceipt.effect: changed_path_count mismatch');
}

function validateObservationRequest(observation) {
  exactKeys(observation, [
    'observation_mode',
    'observation_source',
    'observed_at',
    'observed_revision',
    'action',
    'target',
    'operation_ref',
    'responsible_party_id',
    'executor_implementation_id'
  ], 'ObservationRequest');

  assert(observation.observation_mode === 'git_object_database_readback',
    'ObservationRequest: v0.1 supports only git_object_database_readback');
  assert(observation.observation_source === 'local_git_object_database',
    'ObservationRequest: v0.1 supports only local_git_object_database');
  assert(typeof observation.observed_at === 'string' && Number.isFinite(Date.parse(observation.observed_at)),
    'ObservationRequest.observed_at: invalid date-time');
  gitRevision(observation.observed_revision, 'ObservationRequest.observed_revision');
  for (const key of ['action', 'target', 'operation_ref', 'responsible_party_id', 'executor_implementation_id']) {
    nonEmpty(observation[key], `ObservationRequest.${key}`);
  }
}

function recordObservationReceipt({ commitReceipt, observation, repoRoot }) {
  repoRoot = path.resolve(repoRoot || process.cwd());
  validateCommitReceipt(commitReceipt);
  validateObservationRequest(observation);

  assert(Date.parse(observation.observed_at) > Date.parse(commitReceipt.recorded_at),
    'ObservationReceipt: observation time must be after execution receipt');
  assert(observation.action === commitReceipt.action, 'ObservationReceipt: action substitution');
  assert(observation.target === commitReceipt.target, 'ObservationReceipt: target substitution');
  assert(observation.operation_ref === commitReceipt.operation_ref, 'ObservationReceipt: operation substitution');
  assert(observation.responsible_party_id === commitReceipt.responsible_party_id,
    'ObservationReceipt: responsible party substitution');
  assert(observation.executor_implementation_id === commitReceipt.executor_implementation_id,
    'ObservationReceipt: executor implementation substitution');
  assert(observation.observed_revision === commitReceipt.successor.revision,
    'ObservationReceipt: observed revision does not equal CommitReceipt successor');

  const predecessorSha = commitReceipt.predecessor.commit_sha;
  const successorSha = commitReceipt.successor.commit_sha;
  const refsBefore = refSnapshot(repoRoot);
  const worktreeBefore = worktreeSnapshot(repoRoot);

  assert(commitExists(repoRoot, predecessorSha), 'ObservationReceipt: predecessor commit missing at observation time');
  assert(commitExists(repoRoot, successorSha), 'ObservationReceipt: successor commit missing at observation time');

  const observedTree = git(repoRoot, ['rev-parse', `${successorSha}^{tree}`]);
  sha1(observedTree, 'ObservationReceipt: observed successor tree');
  assert(observedTree === commitReceipt.successor.tree_sha,
    'ObservationReceipt: observed successor tree does not match CommitReceipt');

  const parentLine = git(repoRoot, ['rev-list', '--parents', '-n', '1', successorSha]).split(/\s+/);
  assert(parentLine[0] === successorSha, 'ObservationReceipt: malformed successor parent line');
  assert(parentLine.length === 2, 'ObservationReceipt: v0.1 requires exactly one observed parent');
  const observedParent = parentLine[1];
  assert(observedParent === predecessorSha, 'ObservationReceipt: observed successor parent does not match predecessor');
  assert(observedParent === commitReceipt.successor.parent_commit_sha,
    'ObservationReceipt: observed successor parent does not match CommitReceipt');

  const observedChangedPaths = git(repoRoot, [
    'diff-tree', '--no-commit-id', '--name-only', '-r', predecessorSha, successorSha
  ]).split(/\r?\n/).filter(Boolean).sort();
  assert(observedChangedPaths.length > 0, 'ObservationReceipt: observed effect is empty');
  const expectedChangedPaths = sortedUniqueStrings(commitReceipt.effect.changed_paths,
    'CommitReceipt.effect.changed_paths');
  assert(sameArray(observedChangedPaths, expectedChangedPaths),
    `ObservationReceipt: changed-path mismatch; observed=${observedChangedPaths.join(',')} expected=${expectedChangedPaths.join(',')}`);

  const refsAfter = refSnapshot(repoRoot);
  const worktreeAfter = worktreeSnapshot(repoRoot);
  assert(refsBefore === refsAfter, 'ObservationReceipt: Git refs changed during readback');
  assert(worktreeBefore === worktreeAfter, 'ObservationReceipt: working tree changed during readback');

  return {
    $schema: './observation-receipt.schema.json',
    artifact_type: 'ObservationReceipt',
    artifact_version: '0.1',
    receipt_id: `urn:uu-aap:observation-receipt:${successorSha}`,
    observed_at: observation.observed_at,
    commit_receipt_ref: commitReceipt.receipt_id,
    observation_mode: observation.observation_mode,
    observation_source: observation.observation_source,
    outcome_scope: 'local_git_successor_object',
    action: commitReceipt.action,
    target: commitReceipt.target,
    operation_ref: commitReceipt.operation_ref,
    responsible_party_id: commitReceipt.responsible_party_id,
    executor_implementation_id: commitReceipt.executor_implementation_id,
    expected: {
      predecessor_revision: commitReceipt.predecessor.revision,
      predecessor_commit_sha: predecessorSha,
      successor_revision: commitReceipt.successor.revision,
      successor_commit_sha: successorSha,
      successor_tree_sha: commitReceipt.successor.tree_sha,
      parent_commit_sha: commitReceipt.successor.parent_commit_sha,
      changed_paths: expectedChangedPaths,
      changed_path_count: expectedChangedPaths.length
    },
    observed: {
      revision: `git:${successorSha}`,
      commit_sha: successorSha,
      tree_sha: observedTree,
      parent_commit_sha: observedParent,
      changed_paths: observedChangedPaths,
      changed_path_count: observedChangedPaths.length
    },
    readback_verification: {
      commit_receipt_performed: true,
      observation_time_after_execution_receipt: true,
      predecessor_commit_exists: true,
      successor_commit_exists_at_observation: true,
      successor_revision_exact: true,
      successor_tree_exact: true,
      single_parent_exact: true,
      changed_paths_exact: true,
      semantic_binding_exact: true,
      refs_unchanged_during_observation: true,
      working_tree_unchanged_during_observation: true
    },
    claims: {
      commit_receipt_accepted: true,
      post_execution_readback_performed: true,
      outcome_observed: true,
      successor_state_observed: true,
      observation_matches_commit_receipt: true,
      local_git_object_state_observed: true,
      remote_repository_state_observed: false,
      published_branch_or_ref_update_observed: false,
      poai_materialization_event_recorded: false,
      policy_relative_canonicality_established: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_effect_established: false,
      poai_v_conformance_established: false
    }
  };
}

module.exports = {
  recordObservationReceipt,
  validateCommitReceipt,
  validateObservationRequest
};
