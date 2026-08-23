'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const SUPPORT_STATES = new Set(['supported', 'contradicted', 'mixed', 'insufficient', 'not_tested']);
const HYPOTHESIS_KINDS = new Set([
  'originating_execution_contributed',
  'alternative_local_cause_contributed',
  'insufficient_evidence_for_broader_causality'
]);
const PROHIBITED_SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score',
  'causal_score', 'responsibility_score', 'rating'
]);
const FORBIDDEN_CLAIMS = [
  'generalized_external_consequence_causality_established',
  'causal_proof_certified',
  'exclusive_cause_established',
  'necessary_cause_established',
  'sufficient_cause_established',
  'counterfactual_causality_established',
  'responsibility_for_outcome_adjudicated',
  'legal_responsibility_determined',
  'legal_effect_established',
  'moral_blame_assigned',
  'moral_correctness_established',
  'truth_certified',
  'remote_branch_or_ref_canonicality_established',
  'poai_materialization_event_recorded',
  'poai_successor_record_identity_inferred',
  'universal_canonicality_established',
  'poai_v_conformance_established'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sortedUnique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v.length > 0))].sort();
}
function sameArray(left, right) {
  return left.length === right.length && left.every((value, i) => value === right[i]);
}
function semanticTuple(value) {
  return [value.action, value.target, value.operation_ref, value.base_revision, value.responsible_party_id, value.executor_implementation_id];
}
function sameSemantic(left, right) {
  const a = semanticTuple(left);
  const b = semanticTuple(right);
  return a.length === b.length && a.every((value, i) => value === b[i]);
}
function deepHasProhibitedScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(deepHasProhibitedScalarKey);
  return Object.entries(value).some(([key, child]) => PROHIBITED_SCALAR_KEYS.has(key) || deepHasProhibitedScalarKey(child));
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
function inferSupportState(hypothesis) {
  const supporting = sortedUnique(hypothesis.supporting_evidence_ids);
  const contradicting = sortedUnique(hypothesis.contradicting_evidence_ids);
  const contextual = sortedUnique(hypothesis.context_evidence_ids);
  const alternatives = sortedUnique(hypothesis.alternative_evidence_ids);
  const gaps = sortedUnique(hypothesis.unresolved_gaps);
  if (hypothesis.support_status === 'not_tested') {
    return supporting.length === 0 && contradicting.length === 0 && contextual.length === 0 && alternatives.length === 0 ? 'not_tested' : 'invalid';
  }
  if (supporting.length > 0 && contradicting.length > 0) return 'mixed';
  if (supporting.length > 0) return 'supported';
  if (contradicting.length > 0) return 'contradicted';
  if (contextual.length > 0 || alternatives.length > 0 || gaps.length > 0) return 'insufficient';
  return 'invalid';
}
function evidenceObservedAt(sourceArtifact) {
  for (const key of ['recorded_at', 'observed_at', 'traced_at', 'completed_at', 'closed_at']) {
    if (sourceArtifact && typeof sourceArtifact[key] === 'string') return sourceArtifact[key];
  }
  throw new Error('CausalAttributionAssessment: evidence source has no observation timestamp');
}
async function evidenceItem(id, proposition, sourceArtifact, artifactRef) {
  return {
    evidence_id: id,
    proposition,
    observed_at: evidenceObservedAt(sourceArtifact),
    source_binding: await artifactBinding(sourceArtifact.artifact_type, artifactRef, sourceArtifact),
    truth_certified: false
  };
}
function expectedArtifactRef(artifact) {
  const fields = {
    ResponsibilityTrace: 'trace_id',
    OutcomeObservationReceipt: 'outcome_observation_id',
    CommitReceipt: 'receipt_id'
  };
  const field = fields[artifact.artifact_type];
  return field ? artifact[field] : null;
}

async function buildCausalAttributionAssessment({
  responsibilityTrace,
  outcomeObservation,
  commitReceipt,
  hypotheses,
  assessedAt,
  evidenceCutoff
}) {
  assert(responsibilityTrace && responsibilityTrace.artifact_type === 'ResponsibilityTrace',
    'CausalAttributionAssessment: ResponsibilityTrace required');
  assert(outcomeObservation && outcomeObservation.artifact_type === 'OutcomeObservationReceipt',
    'CausalAttributionAssessment: OutcomeObservationReceipt required');
  assert(commitReceipt && commitReceipt.artifact_type === 'CommitReceipt',
    'CausalAttributionAssessment: CommitReceipt required');
  assert(responsibilityTrace.claims && responsibilityTrace.claims.responsibility_chain_traceable === true,
    'CausalAttributionAssessment: responsibility chain must already be traceable');
  assert(responsibilityTrace.responsibility_attribution && responsibilityTrace.responsibility_attribution.status === 'traceable_not_adjudicated',
    'CausalAttributionAssessment: predecessor responsibility must remain unadjudicated');
  assert(outcomeObservation.claims && outcomeObservation.claims.exact_transition_effect_observed === true,
    'CausalAttributionAssessment: exact transition effect must already be observed');
  assert(commitReceipt.claims && commitReceipt.claims.commit_performed === true,
    'CausalAttributionAssessment: performed CommitReceipt required');

  assertFalseClaims(responsibilityTrace.claims, [
    'external_consequence_causality_established', 'causal_proof_certified', 'responsibility_for_outcome_adjudicated',
    'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned',
    'moral_correctness_established', 'truth_certified', 'remote_branch_or_ref_canonicality_established',
    'poai_materialization_event_recorded', 'poai_successor_record_identity_inferred',
    'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'ResponsibilityTrace');
  assertFalseClaims(outcomeObservation.claims, [
    'external_consequence_causality_established', 'causal_proof_certified', 'responsibility_for_outcome_established',
    'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned', 'truth_certified',
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'OutcomeObservationReceipt');

  const outcomeDigest = await digestJson(outcomeObservation);
  assert(responsibilityTrace.outcome_observation_binding.artifact_ref === outcomeObservation.outcome_observation_id &&
    responsibilityTrace.outcome_observation_binding.digest.value === outcomeDigest,
    'CausalAttributionAssessment: ResponsibilityTrace/OutcomeObservation binding substitution');
  assert(sameSemantic(responsibilityTrace.semantic_binding, outcomeObservation.semantic_binding),
    'CausalAttributionAssessment: predecessor semantic binding drift');
  assert(sameSemantic(responsibilityTrace.semantic_binding, commitReceipt),
    'CausalAttributionAssessment: CommitReceipt semantic binding drift');

  const expectedEffect = outcomeObservation.observed_state;
  assert(commitReceipt.successor.revision === expectedEffect.revision &&
    commitReceipt.successor.commit_sha === expectedEffect.commit_sha &&
    commitReceipt.successor.tree_sha === expectedEffect.tree_sha,
    'CausalAttributionAssessment: CommitReceipt/effect frontier substitution');
  assert(sameArray(sortedUnique(commitReceipt.effect.changed_paths), sortedUnique(expectedEffect.changed_paths)),
    'CausalAttributionAssessment: CommitReceipt/effect path substitution');

  const assessedMs = Date.parse(assessedAt);
  const cutoffMs = Date.parse(evidenceCutoff);
  assert(Number.isFinite(assessedMs) && Number.isFinite(cutoffMs) && cutoffMs <= assessedMs,
    'CausalAttributionAssessment: evidence cutoff must not be later than assessed_at');
  assert(assessedMs > Date.parse(responsibilityTrace.traced_at),
    'CausalAttributionAssessment: assessment must occur after ResponsibilityTrace');

  const evidenceCatalog = [
    await evidenceItem('ev:commit-performed', 'approved_execution_created_successor_transition', commitReceipt, commitReceipt.receipt_id),
    await evidenceItem('ev:exact-effect-observed', 'exact_local_transition_effect_observed', outcomeObservation, outcomeObservation.outcome_observation_id),
    await evidenceItem('ev:responsibility-trace', 'accepted_responsibility_chain_is_traceable_not_adjudicated', responsibilityTrace, responsibilityTrace.trace_id),
    await evidenceItem('ev:alternatives-unassessed', 'alternative_causes_remain_unassessed_beyond_transition', responsibilityTrace, responsibilityTrace.trace_id),
    await evidenceItem('ev:external-consequence-unobserved', 'no_external_consequence_is_established_by_predecessor_observation', outcomeObservation, outcomeObservation.outcome_observation_id)
  ];
  for (const evidence of evidenceCatalog) {
    assert(Date.parse(evidence.observed_at) <= cutoffMs,
      `CausalAttributionAssessment: evidence ${evidence.evidence_id} is later than evidence cutoff`);
  }
  const evidenceIds = new Set(evidenceCatalog.map((item) => item.evidence_id));

  assert(Array.isArray(hypotheses) && hypotheses.length >= 3,
    'CausalAttributionAssessment: at least three competing hypotheses required');
  const normalizedHypotheses = hypotheses.map((source) => ({
    hypothesis_id: source.hypothesis_id,
    kind: source.kind,
    statement: source.statement,
    support_status: source.support_status,
    supporting_evidence_ids: sortedUnique(source.supporting_evidence_ids),
    contradicting_evidence_ids: sortedUnique(source.contradicting_evidence_ids),
    context_evidence_ids: sortedUnique(source.context_evidence_ids),
    alternative_evidence_ids: sortedUnique(source.alternative_evidence_ids),
    unresolved_gaps: sortedUnique(source.unresolved_gaps),
    establishes_causal_proof: false
  }));
  const ids = normalizedHypotheses.map((h) => h.hypothesis_id);
  assert(new Set(ids).size === ids.length, 'CausalAttributionAssessment: duplicate hypothesis IDs');
  const kinds = new Set(normalizedHypotheses.map((h) => h.kind));
  for (const required of HYPOTHESIS_KINDS) assert(kinds.has(required), `CausalAttributionAssessment: missing required hypothesis ${required}`);

  for (const hypothesis of normalizedHypotheses) {
    assert(typeof hypothesis.hypothesis_id === 'string' && hypothesis.hypothesis_id.startsWith('urn:uu-aap:causal-hypothesis:'),
      'CausalAttributionAssessment: invalid hypothesis ID');
    assert(HYPOTHESIS_KINDS.has(hypothesis.kind), `CausalAttributionAssessment: unsupported hypothesis kind ${hypothesis.kind}`);
    assert(typeof hypothesis.statement === 'string' && hypothesis.statement.length > 0,
      'CausalAttributionAssessment: hypothesis statement required');
    assert(SUPPORT_STATES.has(hypothesis.support_status),
      `CausalAttributionAssessment: invalid support state ${hypothesis.support_status}`);
    const allRefs = [
      ...hypothesis.supporting_evidence_ids, ...hypothesis.contradicting_evidence_ids,
      ...hypothesis.context_evidence_ids, ...hypothesis.alternative_evidence_ids
    ];
    for (const evidenceId of allRefs) assert(evidenceIds.has(evidenceId),
      `CausalAttributionAssessment: unknown evidence ${evidenceId}`);
    const inferred = inferSupportState(hypothesis);
    assert(inferred === hypothesis.support_status,
      `CausalAttributionAssessment: support-state substitution for ${hypothesis.hypothesis_id}; expected ${inferred}`);
  }

  const alternativesPresent = normalizedHypotheses.some((h) => h.kind === 'alternative_local_cause_contributed');
  assert(alternativesPresent, 'CausalAttributionAssessment: alternatives_considered requires an explicit alternative hypothesis');
  const originHypothesis = normalizedHypotheses.find((h) => h.kind === 'originating_execution_contributed');
  const broaderHypothesis = normalizedHypotheses.find((h) => h.kind === 'insufficient_evidence_for_broader_causality');
  assert(originHypothesis.support_status === 'supported',
    'CausalAttributionAssessment: bounded originating-execution hypothesis must be supported by declared evidence');
  assert(broaderHypothesis.support_status === 'supported',
    'CausalAttributionAssessment: broader-causality insufficiency must remain supported in v0.1');

  const traceDigest = await digestJson(responsibilityTrace);
  const commitDigest = await digestJson(commitReceipt);
  const hypothesisDigest = await digestJson(normalizedHypotheses);
  const seed = `${traceDigest}|${outcomeDigest}|${commitDigest}|${hypothesisDigest}|${evidenceCutoff}|${assessedAt}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  const assessment = {
    $schema: './causal-attribution.schema.json',
    artifact_type: 'CausalAttributionAssessment',
    artifact_version: '0.1',
    assessment_id: `urn:uu-aap:causal-attribution-assessment:${idHash.slice(0, 24)}`,
    assessed_at: assessedAt,
    predecessor_bindings: {
      responsibility_trace: await artifactBinding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace),
      outcome_observation: await artifactBinding('OutcomeObservationReceipt', outcomeObservation.outcome_observation_id, outcomeObservation),
      commit_receipt: await artifactBinding('CommitReceipt', commitReceipt.receipt_id, commitReceipt)
    },
    semantic_binding: clone(responsibilityTrace.semantic_binding),
    effect_under_assessment: {
      scope: 'exact_local_git_transition_effect',
      relation: 'exact_state_transition_effect',
      revision: expectedEffect.revision,
      commit_sha: expectedEffect.commit_sha,
      tree_sha: expectedEffect.tree_sha,
      changed_paths: sortedUnique(expectedEffect.changed_paths),
      effect_objects: clone(expectedEffect.effect_objects)
    },
    evidence_horizon: {
      evidence_cutoff: evidenceCutoff,
      later_evidence_admitted: false
    },
    evidence_catalog: evidenceCatalog,
    hypotheses: normalizedHypotheses,
    assessment_result: {
      status: 'bounded_association_supported_with_unresolved_alternatives',
      causal_scope: 'bounded_transition_mechanism_only',
      alternatives_considered: true,
      winner_selected: false,
      uncertainty_status: 'material_uncertainty_preserved',
      causal_proof_established: false
    },
    verification: {
      responsibility_trace_exact: true,
      outcome_observation_exact: true,
      commit_receipt_exact: true,
      semantic_binding_exact: true,
      effect_frontier_exact: true,
      evidence_horizon_enforced: true,
      competing_hypotheses_present: true,
      alternatives_explicitly_considered: true,
      support_states_evidence_consistent: true,
      scalar_scoring_absent: true,
      predecessor_assurance_not_upgraded: true
    },
    claims: {
      predecessor_responsibility_trace_verified: true,
      causal_hypotheses_evaluated: true,
      evidence_horizon_fixed: true,
      evidence_classified: true,
      alternatives_explicitly_considered: true,
      bounded_transition_mechanism_association_supported: true,
      uncertainty_explicitly_preserved: true,
      generalized_external_consequence_causality_established: false,
      causal_proof_certified: false,
      exclusive_cause_established: false,
      necessary_cause_established: false,
      sufficient_cause_established: false,
      counterfactual_causality_established: false,
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
  validateCausalAttributionAssessment({ assessment, responsibilityTrace, outcomeObservation, commitReceipt });
  return assessment;
}

async function validateCausalAttributionAssessment({ assessment, responsibilityTrace, outcomeObservation, commitReceipt }) {
  assert(assessment && assessment.artifact_type === 'CausalAttributionAssessment' && assessment.artifact_version === '0.1',
    'CausalAttributionAssessment: invalid assessment artifact');
  assert(!deepHasProhibitedScalarKey(assessment),
    'CausalAttributionAssessment: scalar probability/score fields are prohibited in v0.1');
  assertFalseClaims(assessment.claims, FORBIDDEN_CLAIMS, 'CausalAttributionAssessment');
  assert(assessment.assessment_result && assessment.assessment_result.causal_proof_established === false &&
    assessment.assessment_result.winner_selected === false,
    'CausalAttributionAssessment: assessment result must remain non-certifying and non-exclusive');

  const assessedMs = Date.parse(assessment.assessed_at);
  const cutoffMs = Date.parse(assessment.evidence_horizon && assessment.evidence_horizon.evidence_cutoff);
  assert(Number.isFinite(assessedMs) && Number.isFinite(cutoffMs) && cutoffMs <= assessedMs,
    'CausalAttributionAssessment: evidence cutoff must not be later than assessed_at');
  assert(assessment.evidence_horizon.later_evidence_admitted === false,
    'CausalAttributionAssessment: later evidence must not be silently admitted');

  const sources = [responsibilityTrace, outcomeObservation, commitReceipt];
  for (const source of sources) {
    const ref = expectedArtifactRef(source);
    assert(ref, 'CausalAttributionAssessment: unsupported predecessor artifact');
  }
  const expectedBindings = {
    responsibility_trace: await artifactBinding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace),
    outcome_observation: await artifactBinding('OutcomeObservationReceipt', outcomeObservation.outcome_observation_id, outcomeObservation),
    commit_receipt: await artifactBinding('CommitReceipt', commitReceipt.receipt_id, commitReceipt)
  };
  for (const [key, expected] of Object.entries(expectedBindings)) {
    const actual = assessment.predecessor_bindings[key];
    assert(actual && actual.artifact_ref === expected.artifact_ref,
      `CausalAttributionAssessment: predecessor ${key} ref substitution`);
    assert(actual.digest.value === expected.digest.value,
      `CausalAttributionAssessment: predecessor ${key} digest substitution`);
  }
  assert(sameSemantic(assessment.semantic_binding, responsibilityTrace.semantic_binding) &&
    sameSemantic(assessment.semantic_binding, outcomeObservation.semantic_binding) &&
    sameSemantic(assessment.semantic_binding, commitReceipt),
    'CausalAttributionAssessment: semantic binding drift');

  const effect = assessment.effect_under_assessment;
  const observed = outcomeObservation.observed_state;
  assert(effect.scope === 'exact_local_git_transition_effect' && effect.relation === 'exact_state_transition_effect',
    'CausalAttributionAssessment: effect scope/relation substitution');
  assert(effect.revision === observed.revision && effect.commit_sha === observed.commit_sha && effect.tree_sha === observed.tree_sha,
    'CausalAttributionAssessment: effect frontier substitution');
  assert(sameArray(sortedUnique(effect.changed_paths), sortedUnique(observed.changed_paths)),
    'CausalAttributionAssessment: effect path substitution');
  assert(await digestJson(effect.effect_objects) === await digestJson(observed.effect_objects),
    'CausalAttributionAssessment: effect object substitution');

  const evidenceMap = new Map(assessment.evidence_catalog.map((e) => [e.evidence_id, e]));
  assert(evidenceMap.size === assessment.evidence_catalog.length,
    'CausalAttributionAssessment: duplicate evidence IDs');
  for (const evidence of assessment.evidence_catalog) {
    assert(Date.parse(evidence.observed_at) <= cutoffMs,
      `CausalAttributionAssessment: evidence ${evidence.evidence_id} is later than evidence cutoff`);
    assert(evidence.truth_certified === false,
      'CausalAttributionAssessment: evidence item must not certify truth');
  }

  const hypothesisIds = assessment.hypotheses.map((h) => h.hypothesis_id);
  assert(new Set(hypothesisIds).size === hypothesisIds.length,
    'CausalAttributionAssessment: duplicate hypothesis IDs');
  const kinds = new Set(assessment.hypotheses.map((h) => h.kind));
  for (const required of HYPOTHESIS_KINDS) assert(kinds.has(required),
    `CausalAttributionAssessment: missing required hypothesis ${required}`);
  for (const hypothesis of assessment.hypotheses) {
    const refs = [
      ...hypothesis.supporting_evidence_ids, ...hypothesis.contradicting_evidence_ids,
      ...hypothesis.context_evidence_ids, ...hypothesis.alternative_evidence_ids
    ];
    for (const id of refs) assert(evidenceMap.has(id), `CausalAttributionAssessment: unknown evidence ${id}`);
    const inferred = inferSupportState(hypothesis);
    assert(inferred === hypothesis.support_status,
      `CausalAttributionAssessment: support-state substitution for ${hypothesis.hypothesis_id}; expected ${inferred}`);
    assert(hypothesis.establishes_causal_proof === false,
      'CausalAttributionAssessment: hypothesis cannot certify causal proof');
  }
  assert(assessment.assessment_result.alternatives_considered === true &&
    assessment.hypotheses.some((h) => h.kind === 'alternative_local_cause_contributed'),
    'CausalAttributionAssessment: alternatives_considered without explicit alternative hypothesis');
  assert(assessment.assessment_result.status === 'bounded_association_supported_with_unresolved_alternatives' &&
    assessment.assessment_result.causal_scope === 'bounded_transition_mechanism_only' &&
    assessment.assessment_result.uncertainty_status === 'material_uncertainty_preserved',
    'CausalAttributionAssessment: causal/uncertainty boundary substitution');
  return true;
}

module.exports = {
  digestJson,
  buildCausalAttributionAssessment,
  validateCausalAttributionAssessment,
  inferSupportState
};
