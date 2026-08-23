'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function same(a, b) { return Binding.canonicalize(a, '$') === Binding.canonicalize(b, '$'); }
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digestObject(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(stage, artifactRef, artifact) {
  return { stage, artifact_type: artifact.artifact_type, artifact_ref: artifactRef, digest: digestObject(await digestJson(artifact)) };
}
function assertFalseClaims(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function artifactIdentity(stage, artifact) {
  const map = {
    handoff_result: 'assessment_id',
    handoff_offer: 'offer_id',
    handoff_acceptance: 'acceptance_id',
    authority_verification: 'verification_id',
    execution_admission: 'result_id',
    pre_materialization: 'decision_id'
  };
  return artifact && artifact[map[stage]];
}

async function verifyExported(stage, exported, expectedRef) {
  assert(exported && exported.artifact && exported.digest, `ProvenanceCompletion: missing exported ${stage}`);
  assert(exported.artifact_ref === expectedRef, `ProvenanceCompletion: ${stage} ref substitution`);
  assert(artifactIdentity(stage, exported.artifact) === expectedRef,
    `ProvenanceCompletion: ${stage} artifact identity mismatch`);
  assert(exported.artifact_type === exported.artifact.artifact_type,
    `ProvenanceCompletion: ${stage} artifact type mismatch`);
  assert(exported.digest.value === await digestJson(exported.artifact),
    `ProvenanceCompletion: ${stage} digest substitution`);
}

async function completeProvenance({
  boundedClosure,
  contextFrame,
  intentArtifact,
  originEnvelope,
  evidenceBundle,
  commitDecisionInput,
  commitDecision,
  canonicalizationReceipt,
  completedAt
}) {
  assert(boundedClosure && boundedClosure.artifact_type === 'ProvenanceClosureReceipt', 'ProvenanceCompletion: invalid bounded closure');
  assert(boundedClosure.claims && boundedClosure.claims.bounded_chain_closed === true, 'ProvenanceCompletion: bounded closure not closed');
  assert(boundedClosure.claims.semantic_origin_provenance_complete === false,
    'ProvenanceCompletion: predecessor closure must preserve its bounded-origin limitation');
  assert(contextFrame && contextFrame.artifact_type === 'ContextFrame', 'ProvenanceCompletion: ContextFrame required');
  assert(intentArtifact && intentArtifact.artifact_type === 'IntentArtifact', 'ProvenanceCompletion: IntentArtifact required');
  assert(originEnvelope && originEnvelope.artifact_type === 'OriginEnvelope', 'ProvenanceCompletion: OriginEnvelope required');
  assert(evidenceBundle && evidenceBundle.artifact_type === 'IntegrationEvidenceBundle', 'ProvenanceCompletion: EvidenceBundle required');
  assert(commitDecisionInput && commitDecisionInput.artifact_type === 'CommitDecisionInput', 'ProvenanceCompletion: DecisionInput required');
  assert(commitDecision && commitDecision.artifact_type === 'CommitDecisionResult' && commitDecision.decision === 'approved',
    'ProvenanceCompletion: approved CommitDecision required');
  assert(canonicalizationReceipt && canonicalizationReceipt.artifact_type === 'CanonicalizationReceipt',
    'ProvenanceCompletion: CanonicalizationReceipt required');
  assert(canonicalizationReceipt.claims.policy_relative_canonicality_established === true,
    'ProvenanceCompletion: policy-relative canonicality must already be established');

  const completedMs = Date.parse(completedAt);
  assert(Number.isFinite(completedMs) && completedMs > Date.parse(boundedClosure.closed_at),
    'ProvenanceCompletion: completion must occur after bounded closure');

  const contextDigest = await digestJson(contextFrame);
  const intentDigest = await digestJson(intentArtifact);
  const originDigest = await digestJson(originEnvelope);
  const operation = evidenceBundle.operation.artifact;
  const operationDigest = await digestJson(operation);
  const decisionInputDigest = await digestJson(commitDecisionInput);
  const decisionDigest = await digestJson(commitDecision);

  assert(intentArtifact.context_frame_ref === contextFrame.context_frame_id,
    'ProvenanceCompletion: Intent/ContextFrame ref substitution');
  assert(intentArtifact.context_frame_digest.value === contextDigest,
    'ProvenanceCompletion: Intent/ContextFrame digest substitution');
  assert(originEnvelope.context_frame_binding.artifact_ref === contextFrame.context_frame_id &&
    originEnvelope.context_frame_binding.digest.value === contextDigest,
    'ProvenanceCompletion: OriginEnvelope ContextFrame binding mismatch');
  assert(originEnvelope.intent_binding.artifact_ref === intentArtifact.intent_id &&
    originEnvelope.intent_binding.digest.value === intentDigest,
    'ProvenanceCompletion: OriginEnvelope Intent binding mismatch');
  assert(originEnvelope.operation_binding.artifact_ref === operation.operation_id &&
    originEnvelope.operation_binding.digest.value === operationDigest,
    'ProvenanceCompletion: OriginEnvelope operation binding mismatch');

  assert(intentArtifact.action === operation.action && intentArtifact.target === operation.target &&
    intentArtifact.operation_ref === operation.operation_id && intentArtifact.base_revision === operation.base_revision,
    'ProvenanceCompletion: Intent/operation semantic substitution');
  assert(originEnvelope.semantic_binding.action === operation.action &&
    originEnvelope.semantic_binding.target === operation.target &&
    originEnvelope.semantic_binding.operation_ref === operation.operation_id &&
    originEnvelope.semantic_binding.base_revision === operation.base_revision,
    'ProvenanceCompletion: origin semantic binding mismatch');

  assert(commitDecisionInput.action === intentArtifact.action && commitDecisionInput.target === intentArtifact.target &&
    commitDecisionInput.operation_ref === intentArtifact.operation_ref,
    'ProvenanceCompletion: origin/DecisionInput semantic substitution');
  assert(boundedClosure.semantic_binding.action === intentArtifact.action &&
    boundedClosure.semantic_binding.target === intentArtifact.target &&
    boundedClosure.semantic_binding.operation_ref === intentArtifact.operation_ref,
    'ProvenanceCompletion: bounded closure semantic mismatch');

  assert(evidenceBundle.claims.same_decision_execution_captured === true &&
    evidenceBundle.claims.all_upstream_evidence_artifact_bytes_exported === true &&
    evidenceBundle.claims.reconstructed_equivalent_evidence_used === false,
    'ProvenanceCompletion: evidence bundle is not same-execution exact-byte capture');
  assert(evidenceBundle.decision_input_ref === commitDecisionInput.decision_input_id,
    'ProvenanceCompletion: evidence bundle DecisionInput ref mismatch');
  assert(evidenceBundle.decision_input_digest.value === decisionInputDigest,
    'ProvenanceCompletion: evidence bundle DecisionInput digest mismatch');
  assert(evidenceBundle.decision_result_ref === commitDecision.decision_id,
    'ProvenanceCompletion: evidence bundle DecisionResult ref mismatch');
  assert(evidenceBundle.decision_result_digest.value === decisionDigest,
    'ProvenanceCompletion: evidence bundle DecisionResult digest mismatch');
  assert(evidenceBundle.operation.artifact_ref === operation.operation_id && evidenceBundle.operation.digest.value === operationDigest,
    'ProvenanceCompletion: operation export mismatch');

  const refs = commitDecisionInput.evidence_refs;
  const orderedStages = [
    ['handoff_result', refs.handoff_result_ref],
    ['handoff_offer', refs.handoff_offer_ref],
    ['handoff_acceptance', refs.handoff_acceptance_ref],
    ['authority_verification', refs.authority_verification_ref],
    ['execution_admission', refs.execution_admission_ref],
    ['pre_materialization', refs.pre_materialization_ref]
  ];
  for (const [stage, ref] of orderedStages) await verifyExported(stage, evidenceBundle.upstream[stage], ref);

  assert(same(boundedClosure.evidence_frontier, refs), 'ProvenanceCompletion: bounded closure evidence frontier mismatch');
  assert(new Set(boundedClosure.reference_bound_upstream.refs).size === 6,
    'ProvenanceCompletion: predecessor reference frontier malformed');
  for (const [, ref] of orderedStages) {
    assert(boundedClosure.reference_bound_upstream.refs.includes(ref),
      'ProvenanceCompletion: predecessor upstream ref missing');
  }

  const offer = evidenceBundle.upstream.handoff_offer.artifact;
  const acceptance = evidenceBundle.upstream.handoff_acceptance.artifact;
  const handoff = evidenceBundle.upstream.handoff_result.artifact;
  const authority = evidenceBundle.upstream.authority_verification.artifact;
  const admission = evidenceBundle.upstream.execution_admission.artifact;
  const pre = evidenceBundle.upstream.pre_materialization.artifact;

  assert(offer.effect_ref.intent_id === intentArtifact.intent_id && offer.effect_ref.action === intentArtifact.action &&
    offer.effect_ref.target === intentArtifact.target,
    'ProvenanceCompletion: handoff offer does not bind origin intent');
  assert(acceptance.offer_id === offer.offer_id && acceptance.receiving_party_id === commitDecisionInput.responsible_party_id &&
    acceptance.executor_implementation_id === commitDecisionInput.executor_implementation_id,
    'ProvenanceCompletion: handoff acceptance semantic mismatch');
  assert(handoff.offer_id === offer.offer_id && handoff.acceptance_id === acceptance.acceptance_id &&
    handoff.assignment_after_handoff.responsible_party_id === commitDecisionInput.responsible_party_id,
    'ProvenanceCompletion: handoff result semantic mismatch');
  assert(authority.required_scope === intentArtifact.action && authority.target === intentArtifact.target &&
    authority.subject.id === commitDecisionInput.responsible_party_id,
    'ProvenanceCompletion: authority semantic mismatch');
  assert(admission.operation_ref === operation.operation_id && admission.current_revision === operation.base_revision &&
    admission.decision === 'admitted',
    'ProvenanceCompletion: execution admission semantic mismatch');
  assert(pre.ccrp_operation_ref === operation.operation_id && pre.requested_action === intentArtifact.action &&
    pre.requested_target === intentArtifact.target && pre.authority_verification_ref === authority.verification_id &&
    pre.ccrp_execution_admission_ref === admission.result_id && pre.decision === 'permitted',
    'ProvenanceCompletion: pre-materialization semantic mismatch');

  assert(contextFrame.claims.machine_context_frontier_established === true &&
    contextFrame.claims.human_context_exhaustively_captured === false,
    'ProvenanceCompletion: ContextFrame assurance boundary invalid');
  assert(intentArtifact.claims.intent_declared === true && intentArtifact.claims.authority_established === false,
    'ProvenanceCompletion: Intent assurance boundary invalid');
  assert(originEnvelope.claims.machine_semantic_origin_established === true &&
    originEnvelope.claims.human_cognitive_origin_established === false,
    'ProvenanceCompletion: OriginEnvelope assurance boundary invalid');

  assertFalseClaims(canonicalizationReceipt.claims, [
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'poai_successor_record_identity_inferred', 'universal_canonicality_established', 'truth_certified',
    'causal_proof_certified', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_correctness_established', 'poai_v_conformance_established'
  ], 'CanonicalizationReceipt');

  const originBindings = [
    await binding('context_frame', contextFrame.context_frame_id, contextFrame),
    await binding('intent', intentArtifact.intent_id, intentArtifact),
    await binding('operation', operation.operation_id, operation)
  ];
  const upstreamBindings = [];
  for (const [stage, ref] of orderedStages) {
    upstreamBindings.push(await binding(stage, ref, evidenceBundle.upstream[stage].artifact));
  }
  const boundedBinding = await binding('bounded_provenance_closure', boundedClosure.closure_id, boundedClosure);
  const originEnvelopeBinding = await binding('origin_envelope', originEnvelope.origin_envelope_id, originEnvelope);

  const seed = [boundedBinding.digest.value, originEnvelopeBinding.digest.value,
    ...originBindings.map((x) => x.digest.value), ...upstreamBindings.map((x) => x.digest.value), completedAt].join('|');
  const completionHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './origin-provenance.schema.json',
    artifact_type: 'ProvenanceCompletionReceipt',
    artifact_version: '0.1',
    completion_id: `urn:uu-aap:provenance-completion:${completionHash.slice(0, 24)}`,
    completed_at: completedAt,
    bounded_closure_binding: boundedBinding,
    origin_envelope_binding: originEnvelopeBinding,
    origin_bindings: originBindings,
    upstream_evidence_bindings: upstreamBindings,
    semantic_binding: {
      action: intentArtifact.action,
      target: intentArtifact.target,
      operation_ref: intentArtifact.operation_ref,
      base_revision: intentArtifact.base_revision,
      responsible_party_id: commitDecisionInput.responsible_party_id,
      executor_implementation_id: commitDecisionInput.executor_implementation_id
    },
    recognized_state: {
      ...clone(boundedClosure.recognized_state),
      canonicality_scope: boundedClosure.canonicalization_binding.canonicality_scope
    },
    verification: {
      bounded_closure_preserved: true,
      context_frame_digest_exact: true,
      intent_context_binding_exact: true,
      origin_envelope_bindings_exact: true,
      origin_semantic_binding_exact: true,
      same_decision_execution_capture_exact: true,
      decision_input_digest_exact: true,
      decision_result_digest_exact: true,
      operation_digest_exact: true,
      all_upstream_refs_exact: true,
      all_upstream_digests_exact: true,
      responsibility_handoff_semantics_exact: true,
      authority_semantics_exact: true,
      execution_admission_semantics_exact: true,
      pre_materialization_semantics_exact: true,
      policy_relative_canonicality_preserved: true,
      assurance_not_upgraded: true
    },
    claims: {
      bounded_chain_preserved: true,
      context_frame_provenance_established: true,
      intent_provenance_established: true,
      all_upstream_evidence_artifact_bytes_bound: true,
      machine_semantic_origin_provenance_complete: true,
      human_cognitive_origin_provenance_established: false,
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

module.exports = { digestJson, completeProvenance };
