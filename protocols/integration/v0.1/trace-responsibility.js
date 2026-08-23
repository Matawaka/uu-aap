'use strict';

const path = require('path');
const cp = require('child_process');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function git(args, repoRoot) {
  return cp.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}
function sameArray(left, right) {
  return left.length === right.length && left.every((value, i) => value === right[i]);
}
function sortedUnique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v.length > 0))].sort();
}
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digestObject(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function artifactBinding(artifactType, artifactRef, artifact) {
  return { artifact_type: artifactType, artifact_ref: artifactRef, digest: digestObject(await digestJson(artifact)) };
}
function assertFalseClaims(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function semanticTuple(value) {
  return [value.action, value.target, value.operation_ref, value.responsible_party_id, value.executor_implementation_id];
}
function sameSemantic(...values) {
  const first = semanticTuple(values[0]);
  return values.every((value) => semanticTuple(value).every((item, i) => item === first[i]));
}

async function observeOutcome({ completionReceipt, commitReceipt, predecessorObservationReceipt, observedAt, repoRoot }) {
  assert(completionReceipt && completionReceipt.artifact_type === 'ProvenanceCompletionReceipt',
    'OutcomeObservation: ProvenanceCompletionReceipt required');
  assert(completionReceipt.claims && completionReceipt.claims.machine_semantic_origin_provenance_complete === true,
    'OutcomeObservation: machine semantic provenance must already be complete');
  assert(commitReceipt && commitReceipt.artifact_type === 'CommitReceipt' && commitReceipt.claims.commit_performed === true,
    'OutcomeObservation: performed CommitReceipt required');
  assert(predecessorObservationReceipt && predecessorObservationReceipt.artifact_type === 'ObservationReceipt' &&
    predecessorObservationReceipt.claims.outcome_observed === true,
    'OutcomeObservation: predecessor ObservationReceipt required');

  assertFalseClaims(completionReceipt.claims, [
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'poai_successor_record_identity_inferred', 'universal_canonicality_established', 'truth_certified',
    'causal_proof_certified', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_correctness_established', 'poai_v_conformance_established'
  ], 'ProvenanceCompletionReceipt');

  const observedMs = Date.parse(observedAt);
  assert(Number.isFinite(observedMs) && observedMs > Date.parse(completionReceipt.completed_at),
    'OutcomeObservation: later observation must occur after provenance completion');

  assert(predecessorObservationReceipt.commit_receipt_ref === commitReceipt.receipt_id,
    'OutcomeObservation: predecessor ObservationReceipt/CommitReceipt lineage substitution');
  assert(sameSemantic(completionReceipt.semantic_binding, commitReceipt, predecessorObservationReceipt),
    'OutcomeObservation: semantic lineage substitution');

  const recognized = completionReceipt.recognized_state;
  const commitPaths = sortedUnique(commitReceipt.effect.changed_paths);
  const predecessorPaths = sortedUnique(predecessorObservationReceipt.observed.changed_paths);
  const recognizedPaths = sortedUnique(recognized.changed_paths);
  assert(sameArray(commitPaths, predecessorPaths) && sameArray(commitPaths, recognizedPaths),
    'OutcomeObservation: predecessor effect substitution');
  assert(commitReceipt.successor.revision === recognized.revision && predecessorObservationReceipt.observed.revision === recognized.revision,
    'OutcomeObservation: recognized revision substitution');
  assert(commitReceipt.successor.commit_sha === recognized.commit_sha && predecessorObservationReceipt.observed.commit_sha === recognized.commit_sha,
    'OutcomeObservation: recognized commit substitution');
  assert(commitReceipt.successor.tree_sha === recognized.tree_sha && predecessorObservationReceipt.observed.tree_sha === recognized.tree_sha,
    'OutcomeObservation: recognized tree substitution');

  git(['cat-file', '-e', `${recognized.commit_sha}^{commit}`], repoRoot);
  const treeSha = git(['rev-parse', `${recognized.commit_sha}^{tree}`], repoRoot);
  const parentSha = git(['rev-parse', `${recognized.commit_sha}^`], repoRoot);
  const changedPaths = sortedUnique(git(['diff-tree', '--no-commit-id', '--name-only', '-r', recognized.commit_sha], repoRoot).split(/\r?\n/));
  assert(treeSha === recognized.tree_sha, 'OutcomeObservation: later readback tree mismatch');
  assert(parentSha === commitReceipt.predecessor.commit_sha, 'OutcomeObservation: later readback parent mismatch');
  assert(sameArray(changedPaths, recognizedPaths), 'OutcomeObservation: later readback changed effect mismatch');

  const effectObjects = changedPaths.map((filePath) => ({
    path: filePath,
    git_object_sha: git(['rev-parse', `${recognized.commit_sha}:${filePath}`], repoRoot)
  }));

  const completionDigest = await digestJson(completionReceipt);
  const commitDigest = await digestJson(commitReceipt);
  const observationDigest = await digestJson(predecessorObservationReceipt);
  const seed = `${completionDigest}|${commitDigest}|${observationDigest}|${recognized.commit_sha}|${observedAt}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './outcome-responsibility.schema.json',
    artifact_type: 'OutcomeObservationReceipt',
    artifact_version: '0.1',
    outcome_observation_id: `urn:uu-aap:outcome-observation:${idHash.slice(0, 24)}`,
    observed_at: observedAt,
    completion_binding: await artifactBinding('ProvenanceCompletionReceipt', completionReceipt.completion_id, completionReceipt),
    predecessor_bindings: {
      commit_receipt: await artifactBinding('CommitReceipt', commitReceipt.receipt_id, commitReceipt),
      observation_receipt: await artifactBinding('ObservationReceipt', predecessorObservationReceipt.receipt_id, predecessorObservationReceipt)
    },
    semantic_binding: clone(completionReceipt.semantic_binding),
    observed_state: {
      observation_source: 'local_git_object_database',
      observation_scope: 'exact_local_git_transition_effect',
      revision: recognized.revision,
      commit_sha: recognized.commit_sha,
      tree_sha: treeSha,
      changed_paths: changedPaths,
      effect_objects: effectObjects
    },
    effect_relation: {
      code: 'exact_state_transition_effect',
      establishes_exact_transition_effect: true,
      establishes_external_consequence_causality: false
    },
    causal_assessment: {
      status: 'not_assessed_beyond_transition',
      alternative_causes_assessed: false,
      establishes_causal_proof: false
    },
    verification: {
      completion_exact: true,
      predecessor_lineage_exact: true,
      successor_state_exact: true,
      changed_effect_exact: true,
      later_readback_performed: true
    },
    claims: {
      exact_transition_effect_observed: true,
      outcome_observed: true,
      external_consequence_observed: false,
      external_consequence_causality_established: false,
      causal_proof_certified: false,
      responsibility_for_outcome_established: false,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      remote_branch_or_ref_canonicality_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false,
      poai_v_conformance_established: false
    }
  };
}

async function verifyExported(stage, exported, completionBinding) {
  assert(exported && exported.artifact && exported.digest, `ResponsibilityTrace: missing ${stage} evidence`);
  const actualDigest = await digestJson(exported.artifact);
  assert(exported.digest.value === actualDigest, `ResponsibilityTrace: ${stage} digest substitution`);
  assert(completionBinding && completionBinding.artifact_ref === exported.artifact_ref,
    `ResponsibilityTrace: ${stage} ref substitution against completion`);
  assert(completionBinding.digest.value === actualDigest,
    `ResponsibilityTrace: ${stage} digest substitution against completion`);
}

async function buildResponsibilityTrace({ completionReceipt, outcomeObservation, evidenceBundle, tracedAt }) {
  assert(completionReceipt && completionReceipt.artifact_type === 'ProvenanceCompletionReceipt',
    'ResponsibilityTrace: ProvenanceCompletionReceipt required');
  assert(outcomeObservation && outcomeObservation.artifact_type === 'OutcomeObservationReceipt',
    'ResponsibilityTrace: OutcomeObservationReceipt required');
  assert(evidenceBundle && evidenceBundle.artifact_type === 'IntegrationEvidenceBundle',
    'ResponsibilityTrace: IntegrationEvidenceBundle required');
  assert(evidenceBundle.claims && evidenceBundle.claims.same_decision_execution_captured === true &&
    evidenceBundle.claims.all_upstream_evidence_artifact_bytes_exported === true &&
    evidenceBundle.claims.reconstructed_equivalent_evidence_used === false,
    'ResponsibilityTrace: exact same-execution EvidenceBundle required');

  const tracedMs = Date.parse(tracedAt);
  assert(Number.isFinite(tracedMs) && tracedMs > Date.parse(outcomeObservation.observed_at),
    'ResponsibilityTrace: trace must occur after outcome observation');

  const completionDigest = await digestJson(completionReceipt);
  assert(outcomeObservation.completion_binding.artifact_ref === completionReceipt.completion_id &&
    outcomeObservation.completion_binding.digest.value === completionDigest,
    'ResponsibilityTrace: completion binding substitution');
  assert(outcomeObservation.claims.exact_transition_effect_observed === true &&
    outcomeObservation.effect_relation.establishes_exact_transition_effect === true,
    'ResponsibilityTrace: exact transition effect must already be observed');
  assert(outcomeObservation.causal_assessment.establishes_causal_proof === false &&
    outcomeObservation.effect_relation.establishes_external_consequence_causality === false,
    'ResponsibilityTrace: transition effect cannot be upgraded to generalized causality');
  assertFalseClaims(outcomeObservation.claims, [
    'external_consequence_causality_established', 'causal_proof_certified', 'responsibility_for_outcome_established',
    'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned', 'truth_certified',
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'OutcomeObservationReceipt');

  assert(sameSemantic(completionReceipt.semantic_binding, outcomeObservation.semantic_binding),
    'ResponsibilityTrace: outcome semantic substitution');

  const completionByStage = Object.fromEntries(completionReceipt.upstream_evidence_bindings.map((entry) => [entry.stage, entry]));
  const handoffResultExport = evidenceBundle.upstream.handoff_result;
  const handoffOfferExport = evidenceBundle.upstream.handoff_offer;
  const handoffAcceptanceExport = evidenceBundle.upstream.handoff_acceptance;
  await verifyExported('handoff_result', handoffResultExport, completionByStage.handoff_result);
  await verifyExported('handoff_offer', handoffOfferExport, completionByStage.handoff_offer);
  await verifyExported('handoff_acceptance', handoffAcceptanceExport, completionByStage.handoff_acceptance);

  const handoff = handoffResultExport.artifact;
  const offer = handoffOfferExport.artifact;
  const acceptance = handoffAcceptanceExport.artifact;
  const semantic = completionReceipt.semantic_binding;
  assert(offer.offer_id === handoff.offer_id && acceptance.acceptance_id === handoff.acceptance_id && acceptance.offer_id === offer.offer_id,
    'ResponsibilityTrace: handoff lineage substitution');
  assert(acceptance.receiving_party_id === semantic.responsible_party_id &&
    handoff.assignment_after_handoff.responsible_party_id === semantic.responsible_party_id,
    'ResponsibilityTrace: responsible party substitution');
  assert(acceptance.executor_implementation_id === semantic.executor_implementation_id &&
    offer.executor_implementation_id === semantic.executor_implementation_id,
    'ResponsibilityTrace: executor substitution');
  assert(offer.effect_ref.action === semantic.action && offer.effect_ref.target === semantic.target,
    'ResponsibilityTrace: action/target substitution');

  const acceptedScope = sortedUnique(acceptance.accepted_responsibility_scope);
  const handoffScope = sortedUnique(handoff.assignment_after_handoff.responsibility_scope);
  assert(sameArray(acceptedScope, handoffScope), 'ResponsibilityTrace: accepted responsibility scope substitution');
  assert(acceptedScope.includes(semantic.action), 'ResponsibilityTrace: originating action not in accepted responsibility scope');
  const scopeIntersection = [semantic.action];

  const bindings = [
    await artifactBinding(handoff.artifact_type, handoffResultExport.artifact_ref, handoff),
    await artifactBinding(offer.artifact_type, handoffOfferExport.artifact_ref, offer),
    await artifactBinding(acceptance.artifact_type, handoffAcceptanceExport.artifact_ref, acceptance)
  ];
  const outcomeDigest = await digestJson(outcomeObservation);
  const seed = `${completionDigest}|${outcomeDigest}|${bindings.map((b) => b.digest.value).join('|')}|${tracedAt}`;
  const traceHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './outcome-responsibility.schema.json',
    artifact_type: 'ResponsibilityTrace',
    artifact_version: '0.1',
    trace_id: `urn:uu-aap:responsibility-trace:${traceHash.slice(0, 24)}`,
    traced_at: tracedAt,
    completion_binding: await artifactBinding('ProvenanceCompletionReceipt', completionReceipt.completion_id, completionReceipt),
    outcome_observation_binding: await artifactBinding('OutcomeObservationReceipt', outcomeObservation.outcome_observation_id, outcomeObservation),
    responsibility_evidence_bindings: bindings,
    semantic_binding: clone(semantic),
    accepted_responsibility_scope: acceptedScope,
    scope_intersection: scopeIntersection,
    effect_relation: 'exact_state_transition_effect',
    causal_assessment: {
      status: 'not_assessed_beyond_transition',
      external_consequence_model_present: false,
      establishes_causal_proof: false
    },
    responsibility_attribution: {
      status: 'traceable_not_adjudicated',
      accepted_scope_preserved: true,
      responsibility_for_outcome_adjudicated: false,
      legal_liability_established: false,
      moral_blame_assigned: false
    },
    verification: {
      completion_exact: true,
      outcome_observation_exact: true,
      responsibility_evidence_exact: true,
      semantic_binding_exact: true,
      accepted_scope_exact: true,
      originating_action_in_accepted_scope: true,
      assurance_not_upgraded: true
    },
    claims: {
      provenance_completion_preserved: true,
      exact_transition_effect_observed: true,
      responsibility_chain_traceable: true,
      responsible_party_execution_context_bound: true,
      accepted_responsibility_scope_preserved: true,
      external_consequence_causality_established: false,
      causal_proof_certified: false,
      responsibility_for_outcome_adjudicated: false,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      moral_correctness_established: false,
      truth_certified: false,
      remote_branch_or_ref_canonicality_established: false,
      poai_materialization_event_recorded: false,
      poai_successor_record_identity_inferred: false,
      universal_canonicality_established: false,
      poai_v_conformance_established: false
    }
  };
}

module.exports = { digestJson, observeOutcome, buildResponsibilityTrace };
