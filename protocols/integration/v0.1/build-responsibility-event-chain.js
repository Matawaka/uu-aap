'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const CHAIN_PROFILE = 'responsibility_transition_assurance_trace_v0.1';
const EVENT_KINDS = [
  'exact_transition_observed',
  'responsibility_chain_traced',
  'bounded_causal_association_assessed',
  'counterfactual_intervention_assessed',
  'causal_predicates_qualified',
  'bounded_responsibility_attributed'
];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score',
  'causal_score', 'responsibility_score', 'blame_score', 'rating'
]);
const STRONG_FALSE_CLAIMS = [
  'complete_global_wall_clock_chronology_established',
  'generalized_external_consequence_causality_established',
  'universal_causal_truth_established',
  'causal_proof_certified',
  'responsibility_for_outcome_adjudicated',
  'legal_responsibility_determined',
  'legal_liability_established',
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

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => value === b[i]);
}
function baseRevision(value) { return value.base_revision || (value.predecessor && value.predecessor.revision) || null; }
function semantics(value) {
  return [value.action, value.target, value.operation_ref, baseRevision(value), value.responsible_party_id, value.executor_implementation_id];
}
function sameSemantic(a, b) {
  const left = semantics(a), right = semantics(b);
  return left.length === right.length && left.every((value, i) => value === right[i]);
}
function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
}
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
function assertFalseClaims(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function outcomeEffect(outcome) {
  return {
    scope: outcome.observed_state.observation_scope,
    relation: outcome.effect_relation.code,
    revision: outcome.observed_state.revision,
    commit_sha: outcome.observed_state.commit_sha,
    tree_sha: outcome.observed_state.tree_sha,
    changed_paths: clone(outcome.observed_state.changed_paths),
    effect_objects: clone(outcome.observed_state.effect_objects)
  };
}
function sourceRef(artifact) {
  switch (artifact.artifact_type) {
    case 'OutcomeObservationReceipt': return artifact.outcome_observation_id;
    case 'ResponsibilityTrace': return artifact.trace_id;
    case 'CausalAttributionAssessment': return artifact.assessment_id;
    case 'CounterfactualInterventionAssessment': return artifact.intervention_assessment_id;
    case 'CausalClaimQualification': return artifact.qualification_id;
    case 'ResponsibilityAttributionAssessment': return artifact.attribution_id;
    default: return null;
  }
}
function stageTime(artifact) {
  switch (artifact.artifact_type) {
    case 'OutcomeObservationReceipt': return artifact.observed_at;
    case 'ResponsibilityTrace': return artifact.traced_at;
    case 'CausalAttributionAssessment': return artifact.assessed_at;
    case 'CounterfactualInterventionAssessment': return artifact.assessed_at;
    case 'CausalClaimQualification': return artifact.qualified_at;
    case 'ResponsibilityAttributionAssessment': return artifact.assessed_at;
    default: return null;
  }
}
async function artifactBinding(artifact) {
  return {
    artifact_type: artifact.artifact_type,
    artifact_ref: sourceRef(artifact),
    digest: digest(await digestJson(artifact))
  };
}
async function assertBinding(binding, artifact, label) {
  assert(binding && binding.artifact_type === artifact.artifact_type,
    `ResponsibilityEventChain: ${label} artifact type substitution`);
  assert(binding.artifact_ref === sourceRef(artifact),
    `ResponsibilityEventChain: ${label} ref substitution`);
  assert(binding.digest && binding.digest.value === await digestJson(artifact),
    `ResponsibilityEventChain: ${label} digest substitution`);
}
function qualificationDecision(qualification, predicate) {
  return qualification.decisions.find((item) => item.predicate === predicate);
}

async function validateSourceArtifacts({
  outcomeObservation,
  responsibilityTrace,
  causalAssessment,
  counterfactualAssessment,
  causalQualification,
  responsibilityAttribution
}) {
  const sources = [
    outcomeObservation, responsibilityTrace, causalAssessment,
    counterfactualAssessment, causalQualification, responsibilityAttribution
  ];
  const types = [
    'OutcomeObservationReceipt', 'ResponsibilityTrace', 'CausalAttributionAssessment',
    'CounterfactualInterventionAssessment', 'CausalClaimQualification', 'ResponsibilityAttributionAssessment'
  ];
  sources.forEach((artifact, index) => {
    assert(artifact && artifact.artifact_type === types[index] && artifact.artifact_version === '0.1',
      `ResponsibilityEventChain: ${types[index]}@0.1 required`);
    assert(sourceRef(artifact), `ResponsibilityEventChain: source ref missing for ${types[index]}`);
    assert(Number.isFinite(Date.parse(stageTime(artifact))), `ResponsibilityEventChain: invalid stage time for ${types[index]}`);
    assert(!hasScalarKey(artifact), `ResponsibilityEventChain: scalar responsibility/probability field in ${types[index]}`);
    if (artifact.claims && Object.prototype.hasOwnProperty.call(artifact.claims, 'truth_certified')) {
      assert(artifact.claims.truth_certified === false, `ResponsibilityEventChain: ${types[index]} truth overclaim`);
    }
  });

  const canonicalSemantic = outcomeObservation.semantic_binding;
  for (const artifact of sources.slice(1)) {
    assert(sameSemantic(canonicalSemantic, artifact.semantic_binding),
      `ResponsibilityEventChain: semantic frontier drift at ${artifact.artifact_type}`);
  }

  const effect = outcomeEffect(outcomeObservation);
  assert(effect.scope === 'exact_local_git_transition_effect' && effect.relation === 'exact_state_transition_effect',
    'ResponsibilityEventChain: outcome effect boundary invalid');
  assert(responsibilityTrace.effect_relation === 'exact_state_transition_effect',
    'ResponsibilityEventChain: ResponsibilityTrace effect relation drift');
  for (const [label, candidate] of [
    ['CausalAttributionAssessment', causalAssessment.effect_under_assessment],
    ['CounterfactualInterventionAssessment', counterfactualAssessment.effect_under_assessment],
    ['CausalClaimQualification', causalQualification.effect_under_qualification],
    ['ResponsibilityAttributionAssessment', responsibilityAttribution.effect_under_attribution]
  ]) {
    assert(await digestJson(candidate) === await digestJson(effect),
      `ResponsibilityEventChain: effect frontier drift at ${label}`);
  }

  await assertBinding(responsibilityTrace.outcome_observation_binding, outcomeObservation,
    'ResponsibilityTrace/OutcomeObservation');
  await assertBinding(causalAssessment.predecessor_bindings.responsibility_trace, responsibilityTrace,
    'CausalAttribution/ResponsibilityTrace');
  await assertBinding(causalAssessment.predecessor_bindings.outcome_observation, outcomeObservation,
    'CausalAttribution/OutcomeObservation');
  await assertBinding(counterfactualAssessment.predecessor_bindings.causal_attribution, causalAssessment,
    'Counterfactual/CausalAttribution');
  await assertBinding(counterfactualAssessment.predecessor_bindings.responsibility_trace, responsibilityTrace,
    'Counterfactual/ResponsibilityTrace');
  await assertBinding(counterfactualAssessment.predecessor_bindings.outcome_observation, outcomeObservation,
    'Counterfactual/OutcomeObservation');
  await assertBinding(causalQualification.predecessor_bindings.counterfactual_intervention, counterfactualAssessment,
    'Qualification/Counterfactual');
  await assertBinding(causalQualification.predecessor_bindings.causal_attribution, causalAssessment,
    'Qualification/CausalAttribution');
  await assertBinding(causalQualification.predecessor_bindings.responsibility_trace, responsibilityTrace,
    'Qualification/ResponsibilityTrace');
  await assertBinding(responsibilityAttribution.predecessor_bindings.causal_claim_qualification, causalQualification,
    'Attribution/CausalQualification');
  await assertBinding(responsibilityAttribution.predecessor_bindings.responsibility_trace, responsibilityTrace,
    'Attribution/ResponsibilityTrace');
  await assertBinding(responsibilityAttribution.predecessor_bindings.outcome_observation, outcomeObservation,
    'Attribution/OutcomeObservation');

  assert(outcomeObservation.claims.outcome_observed === true &&
    outcomeObservation.claims.external_consequence_causality_established === false &&
    outcomeObservation.claims.causal_proof_certified === false,
    'ResponsibilityEventChain: OutcomeObservation assurance boundary invalid');
  assert(responsibilityTrace.responsibility_attribution.status === 'traceable_not_adjudicated' &&
    responsibilityTrace.claims.responsibility_chain_traceable === true &&
    responsibilityTrace.claims.responsibility_for_outcome_adjudicated === false,
    'ResponsibilityEventChain: ResponsibilityTrace assurance boundary invalid');
  assert(causalAssessment.assessment_result.status === 'bounded_association_supported_with_unresolved_alternatives' &&
    causalAssessment.assessment_result.causal_proof_established === false &&
    causalAssessment.claims.bounded_transition_mechanism_association_supported === true &&
    causalAssessment.claims.responsibility_for_outcome_adjudicated === false,
    'ResponsibilityEventChain: CausalAttribution assurance boundary invalid');
  assert(counterfactualAssessment.assessment_result.status === 'structural_intervention_sensitivity_with_unresolved_reproduction' &&
    counterfactualAssessment.assessment_result.model_relative_sensitivity_status === 'sensitivity_supported' &&
    counterfactualAssessment.assessment_result.causal_proof_established === false &&
    counterfactualAssessment.intervention_model.model_completeness_established === false &&
    counterfactualAssessment.intervention_model.external_consequence_model_present === false,
    'ResponsibilityEventChain: CounterfactualIntervention assurance boundary invalid');
  const contribution = qualificationDecision(causalQualification, 'originating_execution_contributed_to_exact_transition');
  const sensitivity = qualificationDecision(causalQualification, 'model_relative_intervention_sensitivity');
  assert(causalQualification.qualification_result.status === 'bounded_predicates_qualified_stronger_claims_withheld' &&
    causalQualification.qualification_result.universal_causal_truth_established === false &&
    contribution && contribution.status === 'qualified' && contribution.establishes_predicate === true &&
    sensitivity && sensitivity.status === 'qualified' && sensitivity.establishes_predicate === true &&
    causalQualification.claims.responsibility_for_outcome_adjudicated === false,
    'ResponsibilityEventChain: CausalClaimQualification assurance boundary invalid');
  assert(responsibilityAttribution.attribution_result.status === 'bounded_responsibility_attribution_supported_stronger_claims_withheld' &&
    responsibilityAttribution.claims.policy_relative_responsibility_attribution_established === true &&
    responsibilityAttribution.claims.exact_transition_responsibility_attributed === true &&
    responsibilityAttribution.claims.responsibility_for_outcome_adjudicated === false &&
    responsibilityAttribution.claims.legal_liability_established === false &&
    responsibilityAttribution.claims.moral_blame_assigned === false,
    'ResponsibilityEventChain: ResponsibilityAttribution assurance boundary invalid');

  const times = sources.map((artifact) => Date.parse(stageTime(artifact)));
  for (let i = 1; i < times.length; i += 1) {
    assert(times[i] > times[i - 1],
      `ResponsibilityEventChain: local stage temporal inversion between ${types[i - 1]} and ${types[i]}`);
  }

  return { sources, types, canonicalSemantic: clone(canonicalSemantic), effect: clone(effect) };
}

function assuranceSnapshot(sequence) {
  return {
    outcome_observed: sequence >= 0,
    responsibility_chain_traceable: sequence >= 1,
    bounded_causal_association_supported: sequence >= 2,
    model_relative_intervention_sensitivity_assessed: sequence >= 3,
    bounded_causal_predicates_qualified: sequence >= 4,
    policy_relative_responsibility_attribution_established: sequence >= 5,
    generalized_external_consequence_causality_established: false,
    causal_proof_certified: false,
    responsibility_adjudicated: false,
    legal_liability_established: false,
    moral_blame_assigned: false,
    truth_certified: false
  };
}
function eventDigestMaterial(event) {
  const material = clone(event);
  delete material.event_digest;
  return material;
}
async function deriveEvents(validated) {
  const events = [];
  for (let sequence = 0; sequence < validated.sources.length; sequence += 1) {
    const source = validated.sources[sequence];
    const sourceBinding = await artifactBinding(source);
    const predecessorDigest = sequence === 0 ? null : clone(events[sequence - 1].event_digest);
    const idHash = await Binding.sha256Hex(Binding.utf8Bytes(
      `${sequence}|${EVENT_KINDS[sequence]}|${sourceBinding.digest.value}|${predecessorDigest ? predecessorDigest.value : 'genesis'}`
    ));
    const event = {
      sequence,
      event_id: `urn:uu-aap:responsibility-event:${idHash.slice(0, 24)}`,
      event_kind: EVENT_KINDS[sequence],
      stage_time: stageTime(source),
      source_binding: sourceBinding,
      semantic_binding: clone(validated.canonicalSemantic),
      effect_frontier: clone(validated.effect),
      predecessor_event_digest: predecessorDigest,
      assurance_snapshot: assuranceSnapshot(sequence)
    };
    event.event_digest = digest(await digestJson(eventDigestMaterial(event)));
    events.push(event);
  }
  return events;
}
function chainDigestMaterial({ builtAt, semanticBinding, effectFrontier, events }) {
  return {
    chain_profile: CHAIN_PROFILE,
    built_at: builtAt,
    semantic_binding: clone(semanticBinding),
    effect_frontier: clone(effectFrontier),
    event_heads: events.map((event) => ({
      sequence: event.sequence,
      event_id: event.event_id,
      event_digest: clone(event.event_digest)
    }))
  };
}
async function deriveChainIdentity({ builtAt, semanticBinding, effectFrontier, events }) {
  const value = await digestJson(chainDigestMaterial({ builtAt, semanticBinding, effectFrontier, events }));
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(`${value}|${events[0].event_digest.value}|${events[events.length - 1].event_digest.value}`));
  return {
    chainDigest: digest(value),
    chainId: `urn:uu-aap:responsibility-event-chain:${idHash.slice(0, 24)}`
  };
}

async function buildResponsibilityEventChain({
  outcomeObservation,
  responsibilityTrace,
  causalAssessment,
  counterfactualAssessment,
  causalQualification,
  responsibilityAttribution,
  builtAt
}) {
  const validated = await validateSourceArtifacts({
    outcomeObservation, responsibilityTrace, causalAssessment, counterfactualAssessment,
    causalQualification, responsibilityAttribution
  });
  const builtMs = Date.parse(builtAt);
  assert(Number.isFinite(builtMs) && builtMs > Date.parse(responsibilityAttribution.assessed_at),
    'ResponsibilityEventChain: chain must be built after ResponsibilityAttributionAssessment');
  const events = await deriveEvents(validated);
  const identity = await deriveChainIdentity({
    builtAt,
    semanticBinding: validated.canonicalSemantic,
    effectFrontier: validated.effect,
    events
  });
  const last = events[events.length - 1];
  const chain = {
    $schema: './responsibility-event-chain.schema.json',
    artifact_type: 'ResponsibilityEventChain',
    artifact_version: '0.1',
    chain_id: identity.chainId,
    built_at: builtAt,
    chain_profile: CHAIN_PROFILE,
    semantic_binding: clone(validated.canonicalSemantic),
    effect_frontier: clone(validated.effect),
    events,
    head: {
      sequence: last.sequence,
      event_id: last.event_id,
      event_digest: clone(last.event_digest)
    },
    chain_digest: identity.chainDigest,
    verification: {
      source_artifacts_exact: true,
      source_lineage_exact: true,
      semantic_frontier_exact: true,
      effect_frontier_exact: true,
      event_order_exact: true,
      event_digests_exact: true,
      predecessor_digest_chain_exact: true,
      head_exact: true,
      chain_digest_exact: true,
      local_stage_order_preserved: true,
      historical_assurance_snapshots_exact: true,
      scalar_scoring_absent: true,
      kontur_untouched_by_profile: true
    },
    claims: {
      multi_event_responsibility_trace_established: true,
      append_only_digest_chain_established: true,
      exact_transition_effect_frontier_preserved: true,
      historical_assurance_snapshots_preserved: true,
      local_stage_order_established: true,
      complete_global_wall_clock_chronology_established: false,
      generalized_external_consequence_causality_established: false,
      universal_causal_truth_established: false,
      causal_proof_certified: false,
      responsibility_for_outcome_adjudicated: false,
      legal_responsibility_determined: false,
      legal_liability_established: false,
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
  await validateResponsibilityEventChain({
    chain,
    outcomeObservation,
    responsibilityTrace,
    causalAssessment,
    counterfactualAssessment,
    causalQualification,
    responsibilityAttribution
  });
  return chain;
}

async function validateResponsibilityEventChain({
  chain,
  outcomeObservation,
  responsibilityTrace,
  causalAssessment,
  counterfactualAssessment,
  causalQualification,
  responsibilityAttribution
}) {
  assert(chain && chain.artifact_type === 'ResponsibilityEventChain' && chain.artifact_version === '0.1',
    'ResponsibilityEventChain: invalid chain artifact');
  assert(chain.chain_profile === CHAIN_PROFILE, 'ResponsibilityEventChain: chain profile substitution');
  assert(!hasScalarKey(chain), 'ResponsibilityEventChain: scalar responsibility/probability scores are prohibited in v0.1');
  assertFalseClaims(chain.claims, STRONG_FALSE_CLAIMS, 'ResponsibilityEventChain');

  const validated = await validateSourceArtifacts({
    outcomeObservation, responsibilityTrace, causalAssessment, counterfactualAssessment,
    causalQualification, responsibilityAttribution
  });
  assert(Date.parse(chain.built_at) > Date.parse(responsibilityAttribution.assessed_at),
    'ResponsibilityEventChain: chain must be built after ResponsibilityAttributionAssessment');
  assert(sameSemantic(chain.semantic_binding, validated.canonicalSemantic),
    'ResponsibilityEventChain: chain semantic frontier substitution');
  assert(await digestJson(chain.effect_frontier) === await digestJson(validated.effect),
    'ResponsibilityEventChain: chain effect frontier substitution');

  assert(Array.isArray(chain.events) && chain.events.length === EVENT_KINDS.length,
    'ResponsibilityEventChain: exactly six reference events required');
  assert(sameArray(chain.events.map((event) => event.event_kind), EVENT_KINDS),
    'ResponsibilityEventChain: event kind/order substitution');
  assert(sameArray(chain.events.map((event) => event.sequence), [0, 1, 2, 3, 4, 5]),
    'ResponsibilityEventChain: event sequence substitution');
  assert(new Set(chain.events.map((event) => event.event_id)).size === EVENT_KINDS.length,
    'ResponsibilityEventChain: duplicate event IDs');

  const expectedEvents = await deriveEvents(validated);
  assert(await digestJson(chain.events) === await digestJson(expectedEvents),
    'ResponsibilityEventChain: event payload/digest chain substitution');

  for (let i = 0; i < chain.events.length; i += 1) {
    const event = chain.events[i];
    const recomputed = await digestJson(eventDigestMaterial(event));
    assert(event.event_digest && event.event_digest.value === recomputed,
      `ResponsibilityEventChain: event digest substitution at sequence ${i}`);
    if (i === 0) {
      assert(event.predecessor_event_digest === null,
        'ResponsibilityEventChain: genesis predecessor digest must be null');
    } else {
      assert(event.predecessor_event_digest && event.predecessor_event_digest.value === chain.events[i - 1].event_digest.value,
        `ResponsibilityEventChain: predecessor digest discontinuity at sequence ${i}`);
    }
    assert(await digestJson(event.assurance_snapshot) === await digestJson(assuranceSnapshot(i)),
      `ResponsibilityEventChain: historical assurance snapshot substitution at sequence ${i}`);
  }

  const last = chain.events[chain.events.length - 1];
  assert(chain.head && chain.head.sequence === last.sequence && chain.head.event_id === last.event_id &&
    chain.head.event_digest && chain.head.event_digest.value === last.event_digest.value,
    'ResponsibilityEventChain: chain head substitution');
  const identity = await deriveChainIdentity({
    builtAt: chain.built_at,
    semanticBinding: validated.canonicalSemantic,
    effectFrontier: validated.effect,
    events: expectedEvents
  });
  assert(chain.chain_digest && chain.chain_digest.value === identity.chainDigest.value,
    'ResponsibilityEventChain: chain digest substitution');
  assert(chain.chain_id === identity.chainId, 'ResponsibilityEventChain: chain ID substitution');

  assert(chain.claims.multi_event_responsibility_trace_established === true &&
    chain.claims.append_only_digest_chain_established === true &&
    chain.claims.exact_transition_effect_frontier_preserved === true &&
    chain.claims.historical_assurance_snapshots_preserved === true &&
    chain.claims.local_stage_order_established === true,
    'ResponsibilityEventChain: positive chain claims incomplete');
  return true;
}

module.exports = {
  CHAIN_PROFILE,
  EVENT_KINDS,
  digestJson,
  assuranceSnapshot,
  buildResponsibilityEventChain,
  validateResponsibilityEventChain
};
