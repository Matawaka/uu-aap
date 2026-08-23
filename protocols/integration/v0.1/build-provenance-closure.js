'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nonEmpty(value, label) {
  assert(typeof value === 'string' && value.length > 0, `${label}: expected non-empty string`);
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

async function digestJson(value) {
  const bytes = Binding.utf8Bytes(Binding.canonicalize(value, '$'));
  return Binding.sha256Hex(bytes);
}

function digestObject(value) {
  return {
    canonicalization: 'RFC8785-JCS',
    digest_algorithm: 'SHA-256',
    digest_encoding: 'hex',
    value
  };
}

function assertFalseClaims(claims, keys, label) {
  assert(claims && typeof claims === 'object', `${label}: claims required`);
  for (const key of keys) assert(claims[key] === false, `${label}: prohibited claim ${key}`);
}

function validateRevalidation(receipt) {
  assert(receipt && receipt.artifact_type === 'RevalidationReceipt' && receipt.artifact_version === '0.1',
    'RevalidationReceipt: invalid artifact');
  nonEmpty(receipt.receipt_id, 'RevalidationReceipt.receipt_id');
  assert(receipt.claims && receipt.claims.revalidation_performed === true,
    'RevalidationReceipt: revalidation_performed required');
  assert(receipt.claims.freshness_established === true,
    'RevalidationReceipt: freshness_established required');
  for (const key of ['commit_approved', 'commit_performed', 'outcome_observed', 'canonical_state_established']) {
    assert(receipt.claims[key] === false, `RevalidationReceipt: ${key} must remain false`);
  }
}

function validateDecisionInput(input) {
  assert(input && input.artifact_type === 'CommitDecisionInput' && input.artifact_version === '0.1',
    'CommitDecisionInput: invalid artifact');
  nonEmpty(input.decision_input_id, 'CommitDecisionInput.decision_input_id');
  const refs = input.evidence_refs || {};
  for (const key of [
    'handoff_result_ref',
    'handoff_offer_ref',
    'handoff_acceptance_ref',
    'revalidation_receipt_ref',
    'authority_verification_ref',
    'execution_admission_ref',
    'pre_materialization_ref'
  ]) nonEmpty(refs[key], `CommitDecisionInput.evidence_refs.${key}`);
}

function validateDecision(decision) {
  assert(decision && decision.artifact_type === 'CommitDecisionResult' && decision.artifact_version === '0.1',
    'CommitDecisionResult: invalid artifact');
  assert(decision.decision === 'approved', 'CommitDecisionResult: decision must be approved');
  assert(decision.claims && decision.claims.commit_decision_approved === true,
    'CommitDecisionResult: approval claim required');
  assert(decision.claims.authority_input_established === true,
    'CommitDecisionResult: authority input required');
  assert(decision.claims.pre_materialization_permission_input_established === true,
    'CommitDecisionResult: pre-materialization input required');
  assertFalseClaims(decision.claims, [
    'commit_performed',
    'materialization_event_recorded',
    'repository_mutation_performed',
    'outcome_observed',
    'canonical_state_established',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_effect_established',
    'poai_v_conformance_established'
  ], 'CommitDecisionResult');
}

function validateCommit(receipt) {
  assert(receipt && receipt.artifact_type === 'CommitReceipt' && receipt.artifact_version === '0.1',
    'CommitReceipt: invalid artifact');
  assert(receipt.claims && receipt.claims.commit_performed === true,
    'CommitReceipt: commit_performed required');
  assert(receipt.claims.state_transition_evidence_established === true,
    'CommitReceipt: state transition evidence required');
  assertFalseClaims(receipt.claims, [
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
  ], 'CommitReceipt');
}

function validateObservation(receipt) {
  assert(receipt && receipt.artifact_type === 'ObservationReceipt' && receipt.artifact_version === '0.1',
    'ObservationReceipt: invalid artifact');
  assert(receipt.claims && receipt.claims.outcome_observed === true,
    'ObservationReceipt: outcome_observed required');
  assert(receipt.claims.observation_matches_commit_receipt === true,
    'ObservationReceipt: exact CommitReceipt match required');
  assertFalseClaims(receipt.claims, [
    'remote_repository_state_observed',
    'published_branch_or_ref_update_observed',
    'poai_materialization_event_recorded',
    'policy_relative_canonicality_established',
    'universal_canonicality_established',
    'truth_certified',
    'causal_proof_certified',
    'legal_effect_established',
    'poai_v_conformance_established'
  ], 'ObservationReceipt');
}

function validateCanonicalization(receipt) {
  assert(receipt && receipt.artifact_type === 'CanonicalizationReceipt' && receipt.artifact_version === '0.1',
    'CanonicalizationReceipt: invalid artifact');
  assert(receipt.canonicality_claim && receipt.canonicality_claim.status === 'recognized',
    'CanonicalizationReceipt: recognized status required');
  assert(receipt.claims && receipt.claims.policy_evaluation_passed === true,
    'CanonicalizationReceipt: policy evaluation must pass');
  assert(receipt.claims.policy_relative_canonicality_established === true,
    'CanonicalizationReceipt: policy-relative canonicality required');
  assertFalseClaims(receipt.claims, [
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
  ], 'CanonicalizationReceipt');
}

function validatePolicy(policy) {
  assert(policy && policy.artifact_type === 'UU-AAPCanonicalizationPolicy' && policy.artifact_version === '0.1',
    'CanonicalizationPolicy: invalid artifact');
  nonEmpty(policy.policy_id, 'CanonicalizationPolicy.policy_id');
  assert(Number.isInteger(policy.policy_version) && policy.policy_version >= 1,
    'CanonicalizationPolicy: invalid policy_version');
  nonEmpty(policy.canonicality_scope, 'CanonicalizationPolicy.canonicality_scope');
  const boundary = policy.poai_adapter_boundary || {};
  assert(boundary.observed_git_successor_is_poai_successor_record === false,
    'CanonicalizationPolicy: Git successor/PoAI successor equivalence prohibited');
  assert(boundary.typed_poai_successor_adapter_required === true,
    'CanonicalizationPolicy: typed adapter requirement must be preserved');
  assert(boundary.canonicalization_receipt_is_poai_materialization_event === false,
    'CanonicalizationPolicy: materialization equivalence prohibited');
}

function semanticTuple(artifact) {
  return [
    artifact.action,
    artifact.target,
    artifact.operation_ref,
    artifact.responsible_party_id,
    artifact.executor_implementation_id
  ];
}

function exactSemanticBinding(artifacts) {
  const first = semanticTuple(artifacts[0]);
  return artifacts.every((artifact) => {
    const value = semanticTuple(artifact);
    return value.every((item, index) => typeof item === 'string' && item.length > 0 && item === first[index]);
  });
}

async function binding(stage, artifactType, artifactRef, artifact) {
  nonEmpty(artifactRef, `${stage}.artifact_ref`);
  return {
    stage,
    artifact_type: artifactType,
    artifact_ref: artifactRef,
    digest: digestObject(await digestJson(artifact))
  };
}

async function buildProvenanceClosure({
  revalidationReceipt,
  commitDecisionInput,
  commitDecision,
  commitReceipt,
  observationReceipt,
  canonicalizationReceipt,
  canonicalizationPolicy,
  closedAt
}) {
  validateRevalidation(revalidationReceipt);
  validateDecisionInput(commitDecisionInput);
  validateDecision(commitDecision);
  validateCommit(commitReceipt);
  validateObservation(observationReceipt);
  validateCanonicalization(canonicalizationReceipt);
  validatePolicy(canonicalizationPolicy);

  const closedAtMs = Date.parse(closedAt);
  assert(Number.isFinite(closedAtMs), 'ProvenanceClosure: invalid closedAt');
  assert(closedAtMs > Date.parse(canonicalizationReceipt.evaluated_at),
    'ProvenanceClosure: closure must occur after canonicalization');

  const refs = commitDecisionInput.evidence_refs;
  assert(refs.revalidation_receipt_ref === revalidationReceipt.receipt_id,
    'ProvenanceClosure: revalidation ref substitution');
  assert(commitDecision.decision_input_id === commitDecisionInput.decision_input_id,
    'ProvenanceClosure: DecisionInput/Decision lineage substitution');
  assert(commitReceipt.commit_decision_ref === commitDecision.decision_id,
    'ProvenanceClosure: Decision/Commit lineage substitution');
  assert(observationReceipt.commit_receipt_ref === commitReceipt.receipt_id,
    'ProvenanceClosure: Commit/Observation lineage substitution');
  assert(canonicalizationReceipt.observation_receipt_ref === observationReceipt.receipt_id,
    'ProvenanceClosure: Observation/Canonicalization lineage substitution');
  assert(canonicalizationReceipt.lineage.commit_receipt_ref === commitReceipt.receipt_id,
    'ProvenanceClosure: canonicalization CommitReceipt lineage mismatch');
  assert(canonicalizationReceipt.lineage.commit_decision_ref === commitDecision.decision_id,
    'ProvenanceClosure: canonicalization CommitDecision lineage mismatch');
  assert(canonicalizationReceipt.lineage.decision_input_ref === commitDecisionInput.decision_input_id,
    'ProvenanceClosure: canonicalization DecisionInput lineage mismatch');
  assert(canonicalizationReceipt.lineage.authority_verification_ref === refs.authority_verification_ref,
    'ProvenanceClosure: authority ref substitution');
  assert(canonicalizationReceipt.lineage.pre_materialization_ref === refs.pre_materialization_ref,
    'ProvenanceClosure: pre-materialization ref substitution');

  assert(revalidationReceipt.action === commitDecisionInput.action &&
    revalidationReceipt.target === commitDecisionInput.target &&
    revalidationReceipt.operation_ref === commitDecisionInput.operation_ref,
    'ProvenanceClosure: revalidation semantic binding substitution');
  assert(exactSemanticBinding([
    commitDecisionInput,
    commitDecision,
    commitReceipt,
    observationReceipt,
    canonicalizationReceipt.recognized_state
  ]), 'ProvenanceClosure: semantic binding substitution');

  const observedPaths = sortedUniqueStrings(observationReceipt.observed.changed_paths,
    'ObservationReceipt.observed.changed_paths');
  const commitPaths = sortedUniqueStrings(commitReceipt.effect.changed_paths,
    'CommitReceipt.effect.changed_paths');
  const recognizedPaths = sortedUniqueStrings(canonicalizationReceipt.recognized_state.changed_paths,
    'CanonicalizationReceipt.recognized_state.changed_paths');
  assert(sameArray(observedPaths, commitPaths) && sameArray(observedPaths, recognizedPaths),
    'ProvenanceClosure: successor effect substitution');
  assert(commitReceipt.successor.revision === observationReceipt.observed.revision &&
    commitReceipt.successor.revision === canonicalizationReceipt.recognized_state.revision,
    'ProvenanceClosure: successor revision substitution');
  assert(commitReceipt.successor.commit_sha === observationReceipt.observed.commit_sha &&
    commitReceipt.successor.commit_sha === canonicalizationReceipt.recognized_state.commit_sha,
    'ProvenanceClosure: successor commit substitution');
  assert(commitReceipt.successor.tree_sha === observationReceipt.observed.tree_sha &&
    commitReceipt.successor.tree_sha === canonicalizationReceipt.recognized_state.tree_sha,
    'ProvenanceClosure: successor tree substitution');

  const policyDigest = await digestJson(canonicalizationPolicy);
  assert(canonicalizationReceipt.policy.policy_id === canonicalizationPolicy.policy_id,
    'ProvenanceClosure: canonicalization policy ID substitution');
  assert(canonicalizationReceipt.policy.policy_version === canonicalizationPolicy.policy_version,
    'ProvenanceClosure: canonicalization policy version substitution');
  assert(canonicalizationReceipt.policy.canonicality_scope === canonicalizationPolicy.canonicality_scope,
    'ProvenanceClosure: canonicality scope substitution');
  assert(canonicalizationReceipt.policy.digest.value === policyDigest,
    'ProvenanceClosure: canonicalization policy digest substitution');
  assert(canonicalizationReceipt.canonicality_claim.scope === canonicalizationPolicy.canonicality_scope,
    'ProvenanceClosure: canonicality claim scope mismatch');
  assert(canonicalizationReceipt.canonicality_claim.policy_ref === canonicalizationPolicy.policy_id,
    'ProvenanceClosure: canonicality claim policy mismatch');

  const digestBoundLineage = [
    await binding('revalidation', 'RevalidationReceipt', revalidationReceipt.receipt_id, revalidationReceipt),
    await binding('decision_input', 'CommitDecisionInput', commitDecisionInput.decision_input_id, commitDecisionInput),
    await binding('commit_decision', 'CommitDecisionResult', commitDecision.decision_id, commitDecision),
    await binding('commit', 'CommitReceipt', commitReceipt.receipt_id, commitReceipt),
    await binding('observation', 'ObservationReceipt', observationReceipt.receipt_id, observationReceipt),
    await binding('canonicalization', 'CanonicalizationReceipt', canonicalizationReceipt.receipt_id, canonicalizationReceipt),
    await binding('canonicalization_policy', 'UU-AAPCanonicalizationPolicy', canonicalizationPolicy.policy_id, canonicalizationPolicy)
  ];

  const upstreamRefs = [
    refs.handoff_result_ref,
    refs.handoff_offer_ref,
    refs.handoff_acceptance_ref,
    refs.authority_verification_ref,
    refs.execution_admission_ref,
    refs.pre_materialization_ref
  ];
  assert(new Set(upstreamRefs).size === upstreamRefs.length,
    'ProvenanceClosure: duplicate upstream evidence refs');

  const seed = `${digestBoundLineage.map((entry) => entry.digest.value).join('|')}|${closedAt}`;
  const closureHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './provenance-closure-receipt.schema.json',
    artifact_type: 'ProvenanceClosureReceipt',
    artifact_version: '0.1',
    closure_id: `urn:uu-aap:provenance-closure:${closureHash.slice(0, 24)}`,
    closed_at: closedAt,
    origin_frontier: {
      mode: 'bounded_machine_suffix',
      earliest_digest_bound_artifact_type: 'RevalidationReceipt',
      standalone_context_frame_present: false,
      standalone_intent_present: false,
      semantic_origin_provenance_complete: false
    },
    semantic_binding: {
      action: commitDecisionInput.action,
      target: commitDecisionInput.target,
      operation_ref: commitDecisionInput.operation_ref,
      responsible_party_id: commitDecisionInput.responsible_party_id,
      executor_implementation_id: commitDecisionInput.executor_implementation_id
    },
    evidence_frontier: { ...refs },
    digest_bound_lineage: digestBoundLineage,
    reference_bound_upstream: {
      binding_mode: 'exact_reference_only',
      refs: upstreamRefs,
      artifact_bytes_bound: false
    },
    recognized_state: {
      revision: canonicalizationReceipt.recognized_state.revision,
      commit_sha: canonicalizationReceipt.recognized_state.commit_sha,
      tree_sha: canonicalizationReceipt.recognized_state.tree_sha,
      changed_paths: recognizedPaths,
      changed_path_count: recognizedPaths.length
    },
    canonicalization_binding: {
      receipt_ref: canonicalizationReceipt.receipt_id,
      policy_id: canonicalizationPolicy.policy_id,
      policy_version: canonicalizationPolicy.policy_version,
      policy_digest: digestObject(policyDigest),
      canonicality_scope: canonicalizationPolicy.canonicality_scope,
      status: 'recognized'
    },
    verification: {
      decision_input_evidence_frontier_exact: true,
      revalidation_ref_exact: true,
      decision_input_to_decision_exact: true,
      decision_to_commit_exact: true,
      commit_to_observation_exact: true,
      observation_to_canonicalization_exact: true,
      semantic_binding_exact: true,
      successor_state_exact: true,
      canonicalization_policy_exact: true,
      policy_relative_canonicality_preserved: true,
      artifact_digests_computed: true,
      assurance_not_upgraded: true
    },
    claims: {
      bounded_chain_closed: true,
      digest_bound_suffix_established: true,
      reference_bound_upstream_frontier_established: true,
      standalone_context_frame_provenance_established: false,
      standalone_intent_provenance_established: false,
      semantic_origin_provenance_complete: false,
      all_upstream_evidence_artifact_bytes_bound: false,
      policy_relative_canonicality_preserved: true,
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
  digestJson,
  buildProvenanceClosure
};
