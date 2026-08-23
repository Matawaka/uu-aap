'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const POLICY_TYPE = 'UU-AAPCanonicalizationPolicy';
const POLICY_VERSION = '0.1';
const RECEIPT_TYPE = 'CanonicalizationReceipt';
const RECEIPT_VERSION = '0.1';

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

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sortedUniqueStrings(value, label) {
  assert(Array.isArray(value) && value.length > 0, `${label}: expected non-empty array`);
  for (const item of value) nonEmpty(item, label);
  assert(new Set(value).size === value.length, `${label}: duplicates forbidden`);
  return [...value].sort();
}

function timeActive(policy, at) {
  const t = Date.parse(at);
  const start = Date.parse(policy.effective_from);
  if (!Number.isFinite(t) || !Number.isFinite(start) || t < start) return false;
  if (policy.effective_until !== null) {
    const end = Date.parse(policy.effective_until);
    if (!Number.isFinite(end) || t > end) return false;
  }
  return true;
}

async function digestPolicy(policy) {
  const bytes = Binding.utf8Bytes(Binding.canonicalize(policy, '$'));
  return Binding.sha256Hex(bytes);
}

function validatePolicy(policy) {
  assert(policy && typeof policy === 'object' && !Array.isArray(policy), 'CanonicalizationPolicy: required object');
  assert(policy.artifact_type === POLICY_TYPE, 'CanonicalizationPolicy: artifact_type mismatch');
  assert(policy.artifact_version === POLICY_VERSION, 'CanonicalizationPolicy: artifact_version mismatch');
  assert(typeof policy.policy_id === 'string' && policy.policy_id.startsWith('urn:uu-aap:canonicalization-policy:'),
    'CanonicalizationPolicy: invalid policy_id');
  assert(Number.isInteger(policy.policy_version) && policy.policy_version >= 1,
    'CanonicalizationPolicy: invalid policy_version');
  assert(typeof policy.canonicality_scope === 'string' && policy.canonicality_scope.startsWith('urn:uu-aap:canonicality-scope:'),
    'CanonicalizationPolicy: invalid canonicality_scope');

  const applies = policy.applies_to || {};
  assert(applies.target === 'github:Matawaka/uu-aap', 'CanonicalizationPolicy: unsupported target');
  assert(applies.observation_mode === 'git_object_database_readback',
    'CanonicalizationPolicy: unsupported observation mode');
  assert(applies.observation_source === 'local_git_object_database',
    'CanonicalizationPolicy: unsupported observation source');
  assert(applies.outcome_scope === 'local_git_successor_object',
    'CanonicalizationPolicy: unsupported outcome scope');

  const rule = policy.recognition_rule || {};
  for (const key of [
    'require_observation_match',
    'require_execution_lineage',
    'require_authority_input',
    'require_pre_materialization_permission_input',
    'active_stay_blocks_recognition'
  ]) assert(rule[key] === true, `CanonicalizationPolicy: ${key} must be true`);
  assert(rule.conflict_mode === 'single_head_no_unresolved_conflict',
    'CanonicalizationPolicy: unsupported conflict mode');

  assert(typeof policy.effective_from === 'string' && Number.isFinite(Date.parse(policy.effective_from)),
    'CanonicalizationPolicy: invalid effective_from');
  if (policy.effective_until !== null) {
    assert(typeof policy.effective_until === 'string' && Number.isFinite(Date.parse(policy.effective_until)),
      'CanonicalizationPolicy: invalid effective_until');
  }

  const adapter = policy.poai_adapter_boundary || {};
  assert(adapter.observed_git_successor_is_poai_successor_record === false,
    'CanonicalizationPolicy: Git successor must not be declared a PoAI successor record');
  assert(adapter.typed_poai_successor_adapter_required === true,
    'CanonicalizationPolicy: typed PoAI successor adapter requirement must be explicit');
  assert(adapter.canonicalization_receipt_is_poai_materialization_event === false,
    'CanonicalizationPolicy: CanonicalizationReceipt must not masquerade as PoAI MaterializationEvent');

  const claims = policy.claims || {};
  for (const key of [
    'remote_branch_or_ref_canonicality_established',
    'poai_materialization_event_recorded',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_responsibility_determined',
    'legal_effect_established',
    'moral_correctness_established',
    'poai_v_conformance_established'
  ]) assert(claims[key] === false, `CanonicalizationPolicy: prohibited claim ${key}`);
}

function validateObservationReceipt(receipt) {
  assert(receipt && typeof receipt === 'object', 'ObservationReceipt: required object');
  assert(receipt.artifact_type === 'ObservationReceipt', 'ObservationReceipt: artifact_type mismatch');
  assert(receipt.artifact_version === '0.1', 'ObservationReceipt: artifact_version mismatch');
  assert(typeof receipt.observed_at === 'string' && Number.isFinite(Date.parse(receipt.observed_at)),
    'ObservationReceipt: invalid observed_at');
  assert(receipt.observation_mode === 'git_object_database_readback',
    'ObservationReceipt: unsupported observation mode');
  assert(receipt.observation_source === 'local_git_object_database',
    'ObservationReceipt: unsupported observation source');
  assert(receipt.outcome_scope === 'local_git_successor_object',
    'ObservationReceipt: unsupported outcome scope');
  assert(receipt.claims && receipt.claims.outcome_observed === true,
    'ObservationReceipt: outcome_observed must be true');
  assert(receipt.claims.observation_matches_commit_receipt === true,
    'ObservationReceipt: observation must match CommitReceipt');
  assert(receipt.claims.local_git_object_state_observed === true,
    'ObservationReceipt: local Git state must be observed');
  assert(receipt.claims.remote_repository_state_observed === false,
    'ObservationReceipt: remote observation overclaim');
  assert(receipt.claims.poai_materialization_event_recorded === false,
    'ObservationReceipt: predecessor must not claim PoAI materialization');
  assert(receipt.claims.policy_relative_canonicality_established === false,
    'ObservationReceipt: predecessor must not already claim canonicality');

  assert(receipt.expected && receipt.observed, 'ObservationReceipt: expected/observed state required');
  assert(receipt.expected.successor_revision === receipt.observed.revision,
    'ObservationReceipt: expected/observed revision mismatch');
  assert(receipt.expected.successor_commit_sha === receipt.observed.commit_sha,
    'ObservationReceipt: expected/observed commit mismatch');
  assert(receipt.expected.successor_tree_sha === receipt.observed.tree_sha,
    'ObservationReceipt: expected/observed tree mismatch');
  assert(receipt.expected.parent_commit_sha === receipt.observed.parent_commit_sha,
    'ObservationReceipt: expected/observed parent mismatch');
  const expectedPaths = sortedUniqueStrings(receipt.expected.changed_paths, 'ObservationReceipt.expected.changed_paths');
  const observedPaths = sortedUniqueStrings(receipt.observed.changed_paths, 'ObservationReceipt.observed.changed_paths');
  assert(sameArray(expectedPaths, observedPaths), 'ObservationReceipt: expected/observed changed paths mismatch');
  assert(receipt.expected.changed_path_count === expectedPaths.length,
    'ObservationReceipt: expected changed_path_count mismatch');
  assert(receipt.observed.changed_path_count === observedPaths.length,
    'ObservationReceipt: observed changed_path_count mismatch');
}

function validateCommitReceipt(receipt) {
  assert(receipt && receipt.artifact_type === 'CommitReceipt' && receipt.artifact_version === '0.1',
    'CommitReceipt: invalid predecessor artifact');
  assert(receipt.claims && receipt.claims.commit_performed === true,
    'CommitReceipt: commit_performed must be true');
  assert(receipt.claims.state_transition_evidence_established === true,
    'CommitReceipt: state transition evidence required');
  assert(receipt.claims.outcome_observed === false,
    'CommitReceipt: outcome must remain unobserved at commit stage');
  assert(receipt.claims.policy_relative_canonicality_established === false,
    'CommitReceipt: canonicality must remain false at commit stage');
  assert(receipt.claims.poai_materialization_event_recorded === false,
    'CommitReceipt: must not claim PoAI materialization');
}

function validateCommitDecision(decision) {
  assert(decision && decision.artifact_type === 'CommitDecisionResult' && decision.artifact_version === '0.1',
    'CommitDecisionResult: invalid predecessor artifact');
  assert(decision.decision === 'approved', 'CommitDecisionResult: decision must be approved');
  assert(decision.claims && decision.claims.commit_decision_approved === true,
    'CommitDecisionResult: approved claim required');
  assert(decision.claims.authority_input_established === true,
    'CommitDecisionResult: authority input must be established');
  assert(decision.claims.pre_materialization_permission_input_established === true,
    'CommitDecisionResult: pre-materialization permission input must be established');
  for (const key of [
    'authority_established',
    'authority_scope_exact',
    'authority_target_exact',
    'pre_materialization_permitted',
    'pre_materialization_refs_exact'
  ]) assert(decision.checks && decision.checks[key] === true, `CommitDecisionResult: ${key} must be true`);
}

function validateDecisionInput(input) {
  assert(input && input.artifact_type === 'CommitDecisionInput' && input.artifact_version === '0.1',
    'CommitDecisionInput: invalid predecessor artifact');
  nonEmpty(input.decision_input_id, 'CommitDecisionInput.decision_input_id');
  assert(input.evidence_refs && typeof input.evidence_refs === 'object',
    'CommitDecisionInput: evidence_refs required');
  assert(/^urn:poai:authority-verification:/.test(input.evidence_refs.authority_verification_ref || ''),
    'CommitDecisionInput: invalid authority_verification_ref');
  assert(/^urn:poai-ccrp:pre-materialization:/.test(input.evidence_refs.pre_materialization_ref || ''),
    'CommitDecisionInput: invalid pre_materialization_ref');
}

function validateRecognitionContext(context) {
  exactKeys(context, [
    'evaluated_at',
    'expected_policy_id',
    'expected_policy_version',
    'expected_policy_digest',
    'expected_canonicality_scope',
    'authority_verification_ref',
    'pre_materialization_ref',
    'active_stay',
    'stay_refs',
    'conflict_status',
    'conflict_candidate_revisions'
  ], 'CanonicalizationContext');
  assert(typeof context.evaluated_at === 'string' && Number.isFinite(Date.parse(context.evaluated_at)),
    'CanonicalizationContext: invalid evaluated_at');
  nonEmpty(context.expected_policy_id, 'CanonicalizationContext.expected_policy_id');
  assert(Number.isInteger(context.expected_policy_version) && context.expected_policy_version >= 1,
    'CanonicalizationContext: invalid expected_policy_version');
  assert(typeof context.expected_policy_digest === 'string' && /^[0-9a-f]{64}$/.test(context.expected_policy_digest),
    'CanonicalizationContext: invalid expected_policy_digest');
  nonEmpty(context.expected_canonicality_scope, 'CanonicalizationContext.expected_canonicality_scope');
  assert(/^urn:poai:authority-verification:/.test(context.authority_verification_ref),
    'CanonicalizationContext: invalid authority_verification_ref');
  assert(/^urn:poai-ccrp:pre-materialization:/.test(context.pre_materialization_ref),
    'CanonicalizationContext: invalid pre_materialization_ref');
  assert(typeof context.active_stay === 'boolean', 'CanonicalizationContext.active_stay: expected boolean');
  assert(Array.isArray(context.stay_refs), 'CanonicalizationContext.stay_refs: expected array');
  assert(['none', 'unresolved', 'resolved'].includes(context.conflict_status),
    'CanonicalizationContext: invalid conflict_status');
  sortedUniqueStrings(context.conflict_candidate_revisions, 'CanonicalizationContext.conflict_candidate_revisions');
}

function exactSemanticBinding(artifacts) {
  const keys = ['action', 'target', 'operation_ref', 'responsible_party_id', 'executor_implementation_id'];
  for (const key of keys) {
    const values = artifacts.map((artifact) => artifact[key]);
    if (values.some((value) => typeof value !== 'string' || value.length === 0)) return false;
    if (!values.every((value) => value === values[0])) return false;
  }
  return true;
}

async function evaluateCanonicalization({
  observationReceipt,
  commitReceipt,
  commitDecision,
  commitDecisionInput,
  policy,
  context
}) {
  validateObservationReceipt(observationReceipt);
  validateCommitReceipt(commitReceipt);
  validateCommitDecision(commitDecision);
  validateDecisionInput(commitDecisionInput);
  validatePolicy(policy);
  validateRecognitionContext(context);

  assert(Date.parse(context.evaluated_at) > Date.parse(observationReceipt.observed_at),
    'CanonicalizationReceipt: canonicalization must be after observation');

  assert(observationReceipt.commit_receipt_ref === commitReceipt.receipt_id,
    'CanonicalizationReceipt: ObservationReceipt/CommitReceipt lineage substitution');
  assert(commitReceipt.commit_decision_ref === commitDecision.decision_id,
    'CanonicalizationReceipt: CommitReceipt/CommitDecision lineage substitution');
  assert(commitDecision.decision_input_id === commitDecisionInput.decision_input_id,
    'CanonicalizationReceipt: CommitDecision/DecisionInput lineage substitution');

  assert(exactSemanticBinding([observationReceipt, commitReceipt, commitDecision, commitDecisionInput]),
    'CanonicalizationReceipt: semantic binding substitution');

  assert(observationReceipt.observed.revision === commitReceipt.successor.revision,
    'CanonicalizationReceipt: successor revision substitution');
  assert(observationReceipt.observed.commit_sha === commitReceipt.successor.commit_sha,
    'CanonicalizationReceipt: successor commit substitution');
  assert(observationReceipt.observed.tree_sha === commitReceipt.successor.tree_sha,
    'CanonicalizationReceipt: successor tree substitution');
  const observedPaths = sortedUniqueStrings(observationReceipt.observed.changed_paths,
    'ObservationReceipt.observed.changed_paths');
  const commitPaths = sortedUniqueStrings(commitReceipt.effect.changed_paths,
    'CommitReceipt.effect.changed_paths');
  assert(sameArray(observedPaths, commitPaths), 'CanonicalizationReceipt: successor effect substitution');

  assert(policy.applies_to.target === observationReceipt.target,
    'CanonicalizationReceipt: policy target mismatch');
  assert(policy.applies_to.observation_mode === observationReceipt.observation_mode,
    'CanonicalizationReceipt: policy observation mode mismatch');
  assert(policy.applies_to.observation_source === observationReceipt.observation_source,
    'CanonicalizationReceipt: policy observation source mismatch');
  assert(policy.applies_to.outcome_scope === observationReceipt.outcome_scope,
    'CanonicalizationReceipt: policy outcome scope mismatch');

  const policyDigest = await digestPolicy(policy);
  assert(context.expected_policy_id === policy.policy_id,
    'CanonicalizationReceipt: policy ID substitution');
  assert(context.expected_policy_version === policy.policy_version,
    'CanonicalizationReceipt: policy version substitution');
  assert(context.expected_policy_digest === policyDigest,
    'CanonicalizationReceipt: policy digest substitution');
  assert(context.expected_canonicality_scope === policy.canonicality_scope,
    'CanonicalizationReceipt: canonicality scope substitution');
  assert(timeActive(policy, context.evaluated_at),
    'CanonicalizationReceipt: policy not active at evaluation time');

  assert(context.authority_verification_ref === commitDecisionInput.evidence_refs.authority_verification_ref,
    'CanonicalizationReceipt: authority verification ref substitution');
  assert(context.pre_materialization_ref === commitDecisionInput.evidence_refs.pre_materialization_ref,
    'CanonicalizationReceipt: pre-materialization ref substitution');

  assert(context.active_stay === false, 'CanonicalizationReceipt: active stay blocks recognition');
  assert(context.conflict_status !== 'unresolved',
    'CanonicalizationReceipt: unresolved conflict blocks recognition');
  const candidates = sortedUniqueStrings(context.conflict_candidate_revisions,
    'CanonicalizationContext.conflict_candidate_revisions');
  assert(candidates.length === 1 && candidates[0] === observationReceipt.observed.revision,
    'CanonicalizationReceipt: single-head conflict rule not satisfied');

  const seed = [
    observationReceipt.receipt_id,
    commitReceipt.receipt_id,
    commitDecision.decision_id,
    commitDecisionInput.decision_input_id,
    policy.policy_id,
    policyDigest,
    observationReceipt.observed.revision,
    context.evaluated_at
  ].join('|');
  const receiptDigest = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  const receiptId = `urn:uu-aap:canonicalization-receipt:${receiptDigest.slice(0, 24)}`;

  return {
    $schema: './canonicalization-receipt.schema.json',
    artifact_type: RECEIPT_TYPE,
    artifact_version: RECEIPT_VERSION,
    receipt_id: receiptId,
    evaluated_at: context.evaluated_at,
    observation_receipt_ref: observationReceipt.receipt_id,
    lineage: {
      commit_receipt_ref: commitReceipt.receipt_id,
      commit_decision_ref: commitDecision.decision_id,
      decision_input_ref: commitDecisionInput.decision_input_id,
      authority_verification_ref: context.authority_verification_ref,
      pre_materialization_ref: context.pre_materialization_ref
    },
    policy: {
      policy_id: policy.policy_id,
      policy_version: policy.policy_version,
      canonicality_scope: policy.canonicality_scope,
      digest: {
        canonicalization: 'RFC8785-JCS',
        digest_algorithm: 'SHA-256',
        digest_encoding: 'hex',
        value: policyDigest
      }
    },
    recognized_state: {
      target: observationReceipt.target,
      action: observationReceipt.action,
      operation_ref: observationReceipt.operation_ref,
      responsible_party_id: observationReceipt.responsible_party_id,
      executor_implementation_id: observationReceipt.executor_implementation_id,
      revision: observationReceipt.observed.revision,
      commit_sha: observationReceipt.observed.commit_sha,
      tree_sha: observationReceipt.observed.tree_sha,
      changed_paths: observedPaths,
      changed_path_count: observedPaths.length
    },
    contest_or_stay: {
      active_stay: false,
      refs: [...context.stay_refs]
    },
    conflict_state: {
      status: 'none',
      candidate_revisions: candidates
    },
    verification: {
      observation_predecessor_accepted: true,
      canonicalization_after_observation: true,
      observation_matches_commit_receipt: true,
      commit_lineage_exact: true,
      decision_lineage_exact: true,
      decision_input_lineage_exact: true,
      semantic_binding_exact: true,
      successor_binding_exact: true,
      authority_input_exact: true,
      pre_materialization_input_exact: true,
      policy_identity_exact: true,
      policy_digest_exact: true,
      policy_scope_exact: true,
      policy_time_active: true,
      no_active_stay: true,
      single_head_conflict_rule_satisfied: true,
      poai_adapter_boundary_preserved: true
    },
    canonicality_claim: {
      status: 'recognized',
      scope: policy.canonicality_scope,
      policy_ref: policy.policy_id,
      canonicalization_receipt_ref: receiptId
    },
    poai_adapter_boundary: {
      observed_git_successor_is_poai_successor_record: false,
      typed_poai_successor_adapter_present: false,
      poai_materialization_equivalence_inferred: false
    },
    claims: {
      observation_predecessor_accepted: true,
      execution_lineage_exact: true,
      authority_input_preserved: true,
      pre_materialization_permission_input_preserved: true,
      policy_evaluation_passed: true,
      policy_relative_canonicality_established: true,
      remote_branch_or_ref_canonicality_established: false,
      poai_materialization_event_recorded: false,
      poai_successor_record_identity_inferred: false,
      universal_canonicality_established: false,
      truth_certified: false,
      causal_proof_certified: false,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_correctness_established: false,
      poai_v_conformance_established: false
    }
  };
}

module.exports = {
  digestPolicy,
  validatePolicy,
  validateObservationReceipt,
  validateCommitReceipt,
  validateCommitDecision,
  validateDecisionInput,
  validateRecognitionContext,
  evaluateCanonicalization
};
