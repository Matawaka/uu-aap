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

function git(repoRoot, args, options = {}) {
  return cp.execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, ...(options.env || {}) },
    input: options.input
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

function validateCommitDecision(decision) {
  assert(decision && typeof decision === 'object', 'CommitDecisionResult: required object');
  assert(decision.artifact_type === 'CommitDecisionResult', 'CommitDecisionResult: artifact_type mismatch');
  assert(decision.artifact_version === '0.1', 'CommitDecisionResult: artifact_version mismatch');
  assert(decision.decision === 'approved', 'CommitDecisionResult: decision must be approved');
  assert(decision.claims && decision.claims.commit_decision_approved === true,
    'CommitDecisionResult: approved claim required');
  assert(decision.claims.commit_performed === false,
    'CommitDecisionResult: predecessor decision must not already claim commit performed');
  nonEmpty(decision.decision_id, 'CommitDecisionResult.decision_id');
  for (const key of ['action', 'target', 'operation_ref', 'responsible_party_id', 'executor_implementation_id']) {
    nonEmpty(decision[key], `CommitDecisionResult.${key}`);
  }
  assert(typeof decision.revision === 'string' && /^git:[0-9a-f]{40}$/.test(decision.revision),
    'CommitDecisionResult.revision: expected git:<sha>');
}

function validateExecution(execution) {
  exactKeys(execution, [
    'execution_mode',
    'recorded_at',
    'action',
    'target',
    'operation_ref',
    'responsible_party_id',
    'executor_implementation_id',
    'predecessor_revision',
    'successor_commit_sha',
    'successor_tree_sha',
    'changed_paths',
    'ref_snapshot_before',
    'ref_snapshot_after',
    'working_tree_before',
    'working_tree_after'
  ], 'CommitExecutionEvidence');

  assert(execution.execution_mode === 'ephemeral_local_git_object',
    'CommitExecutionEvidence: v0.1 supports only ephemeral_local_git_object');
  assert(typeof execution.recorded_at === 'string' && Number.isFinite(Date.parse(execution.recorded_at)),
    'CommitExecutionEvidence.recorded_at: invalid date-time');
  for (const key of ['action', 'target', 'operation_ref', 'responsible_party_id', 'executor_implementation_id']) {
    nonEmpty(execution[key], `CommitExecutionEvidence.${key}`);
  }
  assert(typeof execution.predecessor_revision === 'string' && /^git:[0-9a-f]{40}$/.test(execution.predecessor_revision),
    'CommitExecutionEvidence.predecessor_revision: expected git:<sha>');
  sha1(execution.successor_commit_sha, 'CommitExecutionEvidence.successor_commit_sha');
  sha1(execution.successor_tree_sha, 'CommitExecutionEvidence.successor_tree_sha');
  sortedUniqueStrings(execution.changed_paths, 'CommitExecutionEvidence.changed_paths');
  for (const key of ['ref_snapshot_before', 'ref_snapshot_after', 'working_tree_before', 'working_tree_after']) {
    assert(typeof execution[key] === 'string', `CommitExecutionEvidence.${key}: expected string`);
  }
}

function recordCommitReceipt({ commitDecision, execution, repoRoot }) {
  repoRoot = path.resolve(repoRoot || process.cwd());
  validateCommitDecision(commitDecision);
  validateExecution(execution);

  assert(execution.action === commitDecision.action, 'CommitReceipt: action substitution');
  assert(execution.target === commitDecision.target, 'CommitReceipt: target substitution');
  assert(execution.operation_ref === commitDecision.operation_ref, 'CommitReceipt: operation substitution');
  assert(execution.responsible_party_id === commitDecision.responsible_party_id,
    'CommitReceipt: responsible party substitution');
  assert(execution.executor_implementation_id === commitDecision.executor_implementation_id,
    'CommitReceipt: executor implementation substitution');
  assert(execution.predecessor_revision === commitDecision.revision,
    'CommitReceipt: predecessor revision does not equal approved decision frontier');

  const predecessorSha = commitDecision.revision.slice(4);
  const successorSha = execution.successor_commit_sha;
  assert(successorSha !== predecessorSha, 'CommitReceipt: successor must differ from predecessor');
  assert(commitExists(repoRoot, predecessorSha), 'CommitReceipt: predecessor commit object missing');
  assert(commitExists(repoRoot, successorSha), 'CommitReceipt: successor commit object missing');

  const predecessorTree = git(repoRoot, ['rev-parse', `${predecessorSha}^{tree}`]);
  const successorTree = git(repoRoot, ['rev-parse', `${successorSha}^{tree}`]);
  sha1(predecessorTree, 'CommitReceipt: predecessor tree');
  sha1(successorTree, 'CommitReceipt: successor tree');
  assert(successorTree === execution.successor_tree_sha, 'CommitReceipt: successor tree mismatch');
  assert(successorTree !== predecessorTree, 'CommitReceipt: unchanged tree cannot establish an execution effect');

  const parentLine = git(repoRoot, ['rev-list', '--parents', '-n', '1', successorSha]).split(/\s+/);
  assert(parentLine[0] === successorSha, 'CommitReceipt: malformed successor parent line');
  assert(parentLine.length === 2, 'CommitReceipt: v0.1 requires exactly one parent');
  assert(parentLine[1] === predecessorSha, 'CommitReceipt: successor parent does not equal decision predecessor');

  const actualChangedPaths = git(repoRoot, [
    'diff-tree', '--no-commit-id', '--name-only', '-r', predecessorSha, successorSha
  ]).split(/\r?\n/).filter(Boolean).sort();
  assert(actualChangedPaths.length > 0, 'CommitReceipt: no changed paths found');
  const declaredChangedPaths = sortedUniqueStrings(execution.changed_paths, 'CommitExecutionEvidence.changed_paths');
  assert(sameArray(actualChangedPaths, declaredChangedPaths),
    `CommitReceipt: changed-path mismatch; actual=${actualChangedPaths.join(',')} declared=${declaredChangedPaths.join(',')}`);

  assert(execution.ref_snapshot_before === execution.ref_snapshot_after,
    'CommitReceipt: Git refs changed during ephemeral execution');
  assert(execution.working_tree_before === execution.working_tree_after,
    'CommitReceipt: working tree changed during ephemeral execution');

  return {
    $schema: './commit-receipt.schema.json',
    artifact_type: 'CommitReceipt',
    artifact_version: '0.1',
    receipt_id: `urn:uu-aap:commit-receipt:${successorSha}`,
    recorded_at: execution.recorded_at,
    commit_decision_ref: commitDecision.decision_id,
    execution_mode: execution.execution_mode,
    action: commitDecision.action,
    target: commitDecision.target,
    operation_ref: commitDecision.operation_ref,
    responsible_party_id: commitDecision.responsible_party_id,
    executor_implementation_id: commitDecision.executor_implementation_id,
    predecessor: {
      revision: commitDecision.revision,
      commit_sha: predecessorSha,
      tree_sha: predecessorTree
    },
    successor: {
      revision: `git:${successorSha}`,
      commit_sha: successorSha,
      tree_sha: successorTree,
      parent_commit_sha: predecessorSha
    },
    effect: {
      kind: 'git_commit',
      changed_paths: actualChangedPaths,
      changed_path_count: actualChangedPaths.length
    },
    git_verification: {
      decision_frontier_exact: true,
      predecessor_commit_exists: true,
      successor_commit_exists: true,
      single_parent_exact: true,
      successor_tree_exact: true,
      tree_changed: true,
      changed_paths_exact: true,
      refs_unchanged: true,
      working_tree_unchanged: true
    },
    claims: {
      commit_decision_approved: true,
      commit_object_created: true,
      state_transition_evidence_established: true,
      commit_performed: true,
      local_ephemeral_execution_established: true,
      remote_repository_mutation_performed: false,
      published_branch_or_ref_update_established: false,
      poai_materialization_event_recorded: false,
      outcome_observed: false,
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
  recordCommitReceipt,
  validateCommitDecision,
  validateExecution
};
