'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const POLICY_ID = 'urn:uu-aap:responsibility-attribution-policy:exact-local-git-transition:1';
const ATTRIBUTION_SCOPE = 'urn:uu-aap:responsibility-attribution-scope:exact-local-git-transition-v0.1';
const CAUSAL_QUALIFICATION_SCOPE = 'urn:uu-aap:causal-qualification-scope:exact-local-git-transition-v0.1';
const PREDICATES = [
  'accepted_action_responsibility_applies',
  'exact_transition_responsibility_attribution',
  'external_consequence_responsibility',
  'responsibility_adjudication',
  'legal_liability',
  'moral_blame'
];
const ALLOWED_STATUSES = ['attributed', 'not_attributed', 'not_adjudicated', 'out_of_scope'];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score',
  'causal_score', 'responsibility_score', 'blame_score', 'rating'
]);
const STRONG_FALSE_CLAIMS = [
  'external_consequence_responsibility_established',
  'responsibility_for_outcome_adjudicated',
  'responsibility_adjudication_completed',
  'legal_responsibility_determined',
  'legal_liability_established',
  'legal_effect_established',
  'moral_blame_assigned',
  'moral_correctness_established',
  'universal_responsibility_established',
  'universal_causality_established',
  'truth_certified',
  'remote_branch_or_ref_canonicality_established',
  'poai_materialization_event_recorded',
  'poai_successor_record_identity_inferred',
  'universal_canonicality_established',
  'poai_v_conformance_established'
];

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uniq(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v.length > 0))].sort();
}
function sameArray(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
function semantics(value) {
  return [value.action, value.target, value.operation_ref, value.base_revision, value.responsible_party_id, value.executor_implementation_id];
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
async function artifactBinding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
function assertFalseClaims(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function decisionByPredicate(qualification, predicate) {
  return qualification.decisions.find((item) => item.predicate === predicate);
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

function validatePolicy(policy, assessedAt) {
  assert(policy && policy.artifact_type === 'UU-AAPResponsibilityAttributionPolicy' && policy.artifact_version === '0.1',
    'ResponsibilityAttributionAssessment: valid ResponsibilityAttributionPolicy required');
  assert(policy.policy_id === POLICY_ID && policy.policy_version === 1,
    'ResponsibilityAttributionAssessment: policy ID/version substitution');
  assert(policy.attribution_scope === ATTRIBUTION_SCOPE,
    'ResponsibilityAttributionAssessment: policy scope substitution');
  assert(policy.applies_to &&
    policy.applies_to.causal_qualification_artifact_type === 'CausalClaimQualification' &&
    policy.applies_to.causal_qualification_artifact_version === '0.1' &&
    policy.applies_to.responsibility_trace_artifact_type === 'ResponsibilityTrace' &&
    policy.applies_to.responsibility_trace_artifact_version === '0.1' &&
    policy.applies_to.outcome_observation_artifact_type === 'OutcomeObservationReceipt' &&
    policy.applies_to.outcome_observation_artifact_version === '0.1' &&
    policy.applies_to.effect_scope === 'exact_local_git_transition_effect',
    'ResponsibilityAttributionAssessment: policy applicability substitution');
  assert(sameArray(policy.allowed_statuses, ALLOWED_STATUSES),
    'ResponsibilityAttributionAssessment: policy status vocabulary substitution');
  assert(policy.predicate_rules && sameArray(Object.keys(policy.predicate_rules), PREDICATES),
    'ResponsibilityAttributionAssessment: policy predicate vocabulary/order substitution');

  const expected = {
    accepted_action_responsibility_applies: ['attributed', true],
    exact_transition_responsibility_attribution: ['attributed', true],
    external_consequence_responsibility: ['out_of_scope', false],
    responsibility_adjudication: ['not_adjudicated', false],
    legal_liability: ['not_adjudicated', false],
    moral_blame: ['not_adjudicated', false]
  };
  for (const predicate of PREDICATES) {
    const rule = policy.predicate_rules[predicate];
    assert(rule && rule.status === expected[predicate][0] && rule.establishes_predicate === expected[predicate][1],
      `ResponsibilityAttributionAssessment: policy rule substitution for ${predicate}`);
    assert(Array.isArray(rule.required_conditions) && rule.required_conditions.length > 0,
      `ResponsibilityAttributionAssessment: policy conditions missing for ${predicate}`);
    assert(Array.isArray(rule.reason_codes) && rule.reason_codes.length > 0,
      `ResponsibilityAttributionAssessment: policy reason codes missing for ${predicate}`);
  }
  assert(policy.claims &&
    policy.claims.policy_establishes_universal_responsibility === false &&
    policy.claims.policy_establishes_responsibility_adjudication === false &&
    policy.claims.policy_establishes_legal_liability === false &&
    policy.claims.policy_establishes_moral_blame === false &&
    policy.claims.policy_establishes_external_consequence_responsibility === false,
    'ResponsibilityAttributionAssessment: policy assurance boundary overclaim');

  const assessedMs = Date.parse(assessedAt);
  const effectiveFromMs = Date.parse(policy.effective_from);
  assert(Number.isFinite(assessedMs) && Number.isFinite(effectiveFromMs) && assessedMs >= effectiveFromMs,
    'ResponsibilityAttributionAssessment: policy not yet effective');
  if (policy.effective_until !== null) {
    const untilMs = Date.parse(policy.effective_until);
    assert(Number.isFinite(untilMs) && assessedMs < untilMs,
      'ResponsibilityAttributionAssessment: policy expired');
  }
  return true;
}

async function validatePredecessors({ causalQualification, responsibilityTrace, outcomeObservation }) {
  assert(causalQualification && causalQualification.artifact_type === 'CausalClaimQualification' && causalQualification.artifact_version === '0.1',
    'ResponsibilityAttributionAssessment: CausalClaimQualification v0.1 required');
  assert(responsibilityTrace && responsibilityTrace.artifact_type === 'ResponsibilityTrace' && responsibilityTrace.artifact_version === '0.1',
    'ResponsibilityAttributionAssessment: ResponsibilityTrace v0.1 required');
  assert(outcomeObservation && outcomeObservation.artifact_type === 'OutcomeObservationReceipt' && outcomeObservation.artifact_version === '0.1',
    'ResponsibilityAttributionAssessment: OutcomeObservationReceipt v0.1 required');
  assert(!hasScalarKey({ causalQualification, responsibilityTrace, outcomeObservation }),
    'ResponsibilityAttributionAssessment: scalar probability/score fields are prohibited in predecessors');

  assert(causalQualification.qualification_result &&
    causalQualification.qualification_result.status === 'bounded_predicates_qualified_stronger_claims_withheld' &&
    causalQualification.qualification_result.qualification_scope === CAUSAL_QUALIFICATION_SCOPE &&
    causalQualification.qualification_result.policy_relative === true &&
    causalQualification.qualification_result.universal_causal_truth_established === false,
    'ResponsibilityAttributionAssessment: causal qualification boundary invalid');
  assert(causalQualification.claims &&
    causalQualification.claims.bounded_execution_contribution_qualified === true &&
    causalQualification.claims.stronger_causal_predicates_withheld === true,
    'ResponsibilityAttributionAssessment: bounded causal qualification missing');
  assertFalseClaims(causalQualification.claims, [
    'necessary_cause_established', 'sufficient_cause_established', 'exclusive_cause_established',
    'counterfactual_causal_proof_certified', 'generalized_external_consequence_causality_established',
    'universal_causal_truth_established', 'responsibility_for_outcome_adjudicated',
    'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned',
    'moral_correctness_established', 'truth_certified', 'remote_branch_or_ref_canonicality_established',
    'poai_materialization_event_recorded', 'poai_successor_record_identity_inferred',
    'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'CausalClaimQualification');

  const contribution = decisionByPredicate(causalQualification, 'originating_execution_contributed_to_exact_transition');
  assert(contribution && contribution.status === 'qualified' && contribution.establishes_predicate === true &&
    contribution.qualification_scope === CAUSAL_QUALIFICATION_SCOPE,
    'ResponsibilityAttributionAssessment: originating execution contribution is not qualified');
  for (const predicate of ['necessary_cause', 'sufficient_cause', 'exclusive_cause', 'counterfactual_causal_proof', 'generalized_external_consequence_causality']) {
    const item = decisionByPredicate(causalQualification, predicate);
    assert(item && item.establishes_predicate === false,
      `ResponsibilityAttributionAssessment: stronger causal predicate unexpectedly established: ${predicate}`);
  }

  assert(responsibilityTrace.responsibility_attribution &&
    responsibilityTrace.responsibility_attribution.status === 'traceable_not_adjudicated' &&
    responsibilityTrace.responsibility_attribution.accepted_scope_preserved === true &&
    responsibilityTrace.responsibility_attribution.responsibility_for_outcome_adjudicated === false &&
    responsibilityTrace.responsibility_attribution.legal_liability_established === false &&
    responsibilityTrace.responsibility_attribution.moral_blame_assigned === false,
    'ResponsibilityAttributionAssessment: responsibility trace boundary invalid');
  assert(responsibilityTrace.claims &&
    responsibilityTrace.claims.responsibility_chain_traceable === true &&
    responsibilityTrace.claims.accepted_responsibility_scope_preserved === true,
    'ResponsibilityAttributionAssessment: responsibility trace positive claims missing');
  assertFalseClaims(responsibilityTrace.claims, [
    'external_consequence_causality_established', 'causal_proof_certified',
    'responsibility_for_outcome_adjudicated', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_blame_assigned', 'moral_correctness_established', 'truth_certified',
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'poai_successor_record_identity_inferred', 'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'ResponsibilityTrace');

  const acceptedScope = uniq(responsibilityTrace.accepted_responsibility_scope);
  assert(acceptedScope.length > 0, 'ResponsibilityAttributionAssessment: accepted responsibility scope missing');
  assert(acceptedScope.includes(responsibilityTrace.semantic_binding.action),
    'ResponsibilityAttributionAssessment: originating action is outside accepted responsibility scope');
  assert(sameArray(uniq(responsibilityTrace.scope_intersection), [responsibilityTrace.semantic_binding.action]),
    'ResponsibilityAttributionAssessment: responsibility scope intersection drift');

  assert(outcomeObservation.claims &&
    outcomeObservation.claims.exact_transition_effect_observed === true &&
    outcomeObservation.claims.outcome_observed === true &&
    outcomeObservation.claims.external_consequence_observed === false &&
    outcomeObservation.claims.external_consequence_causality_established === false &&
    outcomeObservation.claims.responsibility_for_outcome_established === false,
    'ResponsibilityAttributionAssessment: outcome observation assurance boundary invalid');
  assertFalseClaims(outcomeObservation.claims, [
    'external_consequence_causality_established', 'causal_proof_certified',
    'responsibility_for_outcome_established', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_blame_assigned', 'truth_certified', 'remote_branch_or_ref_canonicality_established',
    'poai_materialization_event_recorded', 'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'OutcomeObservationReceipt');

  const traceDigest = await digestJson(responsibilityTrace);
  const outcomeDigest = await digestJson(outcomeObservation);
  assert(causalQualification.predecessor_bindings &&
    causalQualification.predecessor_bindings.responsibility_trace.artifact_ref === responsibilityTrace.trace_id &&
    causalQualification.predecessor_bindings.responsibility_trace.digest.value === traceDigest,
    'ResponsibilityAttributionAssessment: CausalClaimQualification/ResponsibilityTrace binding substitution');
  assert(responsibilityTrace.outcome_observation_binding &&
    responsibilityTrace.outcome_observation_binding.artifact_ref === outcomeObservation.outcome_observation_id &&
    responsibilityTrace.outcome_observation_binding.digest.value === outcomeDigest,
    'ResponsibilityAttributionAssessment: ResponsibilityTrace/OutcomeObservation binding substitution');

  assert(sameSemantic(causalQualification.semantic_binding, responsibilityTrace.semantic_binding) &&
    sameSemantic(causalQualification.semantic_binding, outcomeObservation.semantic_binding),
    'ResponsibilityAttributionAssessment: predecessor semantic frontier drift');
  assert(causalQualification.semantic_binding.responsible_party_id === responsibilityTrace.semantic_binding.responsible_party_id &&
    responsibilityTrace.semantic_binding.responsible_party_id === outcomeObservation.semantic_binding.responsible_party_id,
    'ResponsibilityAttributionAssessment: responsible party drift');

  const observedEffect = outcomeEffect(outcomeObservation);
  assert(await digestJson(causalQualification.effect_under_qualification) === await digestJson(observedEffect),
    'ResponsibilityAttributionAssessment: predecessor effect frontier drift');
  assert(responsibilityTrace.effect_relation === 'exact_state_transition_effect',
    'ResponsibilityAttributionAssessment: responsibility trace effect relation drift');

  return { contribution, acceptedScope, observedEffect };
}

function decision(predicate, rule, evidenceRefs) {
  return {
    predicate,
    status: rule.status,
    attribution_scope: ATTRIBUTION_SCOPE,
    reason_codes: uniq(rule.reason_codes),
    evidence_refs: uniq(evidenceRefs),
    establishes_predicate: rule.establishes_predicate
  };
}

function deriveDecisions({ policy, causalQualification, responsibilityTrace, outcomeObservation, contribution }) {
  assert(contribution.status === 'qualified' && contribution.establishes_predicate === true,
    'ResponsibilityAttributionAssessment: exact contribution qualification required');
  assert(responsibilityTrace.responsibility_attribution.status === 'traceable_not_adjudicated',
    'ResponsibilityAttributionAssessment: trace must remain not adjudicated');
  assert(responsibilityTrace.accepted_responsibility_scope.includes(responsibilityTrace.semantic_binding.action),
    'ResponsibilityAttributionAssessment: accepted action responsibility basis missing');
  assert(outcomeObservation.claims.external_consequence_observed === false &&
    causalQualification.claims.generalized_external_consequence_causality_established === false,
    'ResponsibilityAttributionAssessment: external consequence responsibility cannot be attributed');

  const rules = policy.predicate_rules;
  return [
    decision(PREDICATES[0], rules[PREDICATES[0]], [responsibilityTrace.trace_id, causalQualification.qualification_id]),
    decision(PREDICATES[1], rules[PREDICATES[1]], [responsibilityTrace.trace_id, causalQualification.qualification_id, outcomeObservation.outcome_observation_id]),
    decision(PREDICATES[2], rules[PREDICATES[2]], [outcomeObservation.outcome_observation_id, causalQualification.qualification_id]),
    decision(PREDICATES[3], rules[PREDICATES[3]], [responsibilityTrace.trace_id, causalQualification.qualification_id]),
    decision(PREDICATES[4], rules[PREDICATES[4]], [responsibilityTrace.trace_id, causalQualification.qualification_id]),
    decision(PREDICATES[5], rules[PREDICATES[5]], [responsibilityTrace.trace_id, causalQualification.qualification_id])
  ];
}

async function buildResponsibilityAttributionAssessment({
  policy,
  causalQualification,
  responsibilityTrace,
  outcomeObservation,
  assessedAt
}) {
  validatePolicy(policy, assessedAt);
  const evidence = await validatePredecessors({ causalQualification, responsibilityTrace, outcomeObservation });
  const assessedMs = Date.parse(assessedAt);
  assert(Number.isFinite(assessedMs), 'ResponsibilityAttributionAssessment: invalid assessed_at');
  assert(assessedMs > Date.parse(causalQualification.qualified_at),
    'ResponsibilityAttributionAssessment: assessment must occur after CausalClaimQualification');
  assert(assessedMs > Date.parse(responsibilityTrace.traced_at),
    'ResponsibilityAttributionAssessment: assessment must occur after ResponsibilityTrace');
  assert(assessedMs > Date.parse(outcomeObservation.observed_at),
    'ResponsibilityAttributionAssessment: assessment must occur after OutcomeObservationReceipt');

  const decisions = deriveDecisions({
    policy, causalQualification, responsibilityTrace, outcomeObservation, contribution: evidence.contribution
  });
  const attributedCount = decisions.filter((item) => item.status === 'attributed' && item.establishes_predicate === true).length;
  assert(attributedCount === 2,
    'ResponsibilityAttributionAssessment: exactly two bounded responsibility predicates may be attributed in v0.1');

  const policyDigest = await digestJson(policy);
  const qualificationDigest = await digestJson(causalQualification);
  const traceDigest = await digestJson(responsibilityTrace);
  const outcomeDigest = await digestJson(outcomeObservation);
  const decisionsDigest = await digestJson(decisions);
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(
    `${policyDigest}|${qualificationDigest}|${traceDigest}|${outcomeDigest}|${decisionsDigest}|${assessedAt}`
  ));

  const assessment = {
    $schema: './responsibility-attribution.schema.json',
    artifact_type: 'ResponsibilityAttributionAssessment',
    artifact_version: '0.1',
    attribution_id: `urn:uu-aap:responsibility-attribution-assessment:${idHash.slice(0, 24)}`,
    assessed_at: assessedAt,
    policy_binding: {
      artifact_type: policy.artifact_type,
      artifact_ref: policy.policy_id,
      policy_version: policy.policy_version,
      attribution_scope: policy.attribution_scope,
      digest: digest(policyDigest)
    },
    predecessor_bindings: {
      causal_claim_qualification: await artifactBinding('CausalClaimQualification', causalQualification.qualification_id, causalQualification),
      responsibility_trace: await artifactBinding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace),
      outcome_observation: await artifactBinding('OutcomeObservationReceipt', outcomeObservation.outcome_observation_id, outcomeObservation)
    },
    semantic_binding: clone(causalQualification.semantic_binding),
    responsibility_basis: {
      responsible_party_id: responsibilityTrace.semantic_binding.responsible_party_id,
      accepted_responsibility_scope: clone(responsibilityTrace.accepted_responsibility_scope),
      scope_intersection: clone(responsibilityTrace.scope_intersection),
      originating_action: responsibilityTrace.semantic_binding.action,
      scope_relation: 'originating_action_within_accepted_scope',
      trace_status: 'traceable_not_adjudicated'
    },
    causal_basis: {
      predicate: evidence.contribution.predicate,
      qualification_status: evidence.contribution.status,
      qualification_scope: evidence.contribution.qualification_scope,
      establishes_predicate: evidence.contribution.establishes_predicate,
      stronger_causal_predicates_withheld: true
    },
    effect_under_attribution: clone(causalQualification.effect_under_qualification),
    decisions,
    attribution_result: {
      status: 'bounded_responsibility_attribution_supported_stronger_claims_withheld',
      attribution_scope: policy.attribution_scope,
      policy_relative: true,
      attributed_predicate_count: 2,
      withheld_predicate_count: 4,
      uncertainty_status: 'material_uncertainty_preserved',
      responsibility_adjudicated: false,
      external_consequence_responsibility_established: false,
      legal_liability_established: false,
      moral_blame_assigned: false
    },
    verification: {
      policy_exact: true,
      policy_effective: true,
      causal_qualification_exact: true,
      responsibility_trace_exact: true,
      outcome_observation_exact: true,
      semantic_frontier_exact: true,
      effect_frontier_exact: true,
      responsible_party_exact: true,
      accepted_scope_exact: true,
      originating_action_in_accepted_scope: true,
      qualified_contribution_exact: true,
      policy_rules_applied_exactly: true,
      all_policy_predicates_decided_once: true,
      stronger_responsibility_claims_withheld: true,
      scalar_scoring_absent: true,
      predecessor_assurance_not_upgraded: true,
      logical_stage_order_preserved: true
    },
    claims: {
      exact_attribution_policy_applied: true,
      predecessor_evidence_verified: true,
      accepted_responsibility_scope_applies_to_originating_action: true,
      qualified_causal_contribution_bound_to_same_effect: true,
      policy_relative_responsibility_attribution_established: true,
      exact_transition_responsibility_attributed: true,
      stronger_responsibility_claims_withheld: true,
      external_consequence_responsibility_established: false,
      responsibility_for_outcome_adjudicated: false,
      responsibility_adjudication_completed: false,
      legal_responsibility_determined: false,
      legal_liability_established: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      moral_correctness_established: false,
      universal_responsibility_established: false,
      universal_causality_established: false,
      truth_certified: false,
      remote_branch_or_ref_canonicality_established: false,
      poai_materialization_event_recorded: false,
      poai_successor_record_identity_inferred: false,
      universal_canonicality_established: false,
      poai_v_conformance_established: false
    }
  };
  await validateResponsibilityAttributionAssessment({ assessment, policy, causalQualification, responsibilityTrace, outcomeObservation });
  return assessment;
}

async function validateResponsibilityAttributionAssessment({
  assessment,
  policy,
  causalQualification,
  responsibilityTrace,
  outcomeObservation
}) {
  assert(assessment && assessment.artifact_type === 'ResponsibilityAttributionAssessment' && assessment.artifact_version === '0.1',
    'ResponsibilityAttributionAssessment: invalid assessment artifact');
  assert(!hasScalarKey(assessment),
    'ResponsibilityAttributionAssessment: scalar responsibility/probability scores are prohibited in v0.1');
  assertFalseClaims(assessment.claims, STRONG_FALSE_CLAIMS, 'ResponsibilityAttributionAssessment');
  validatePolicy(policy, assessment.assessed_at);
  const evidence = await validatePredecessors({ causalQualification, responsibilityTrace, outcomeObservation });

  const assessedMs = Date.parse(assessment.assessed_at);
  assert(assessedMs > Date.parse(causalQualification.qualified_at),
    'ResponsibilityAttributionAssessment: assessment must occur after CausalClaimQualification');
  assert(assessedMs > Date.parse(responsibilityTrace.traced_at),
    'ResponsibilityAttributionAssessment: assessment must occur after ResponsibilityTrace');
  assert(assessedMs > Date.parse(outcomeObservation.observed_at),
    'ResponsibilityAttributionAssessment: assessment must occur after OutcomeObservationReceipt');

  const policyDigest = await digestJson(policy);
  assert(assessment.policy_binding.artifact_ref === policy.policy_id &&
    assessment.policy_binding.policy_version === policy.policy_version &&
    assessment.policy_binding.attribution_scope === policy.attribution_scope,
    'ResponsibilityAttributionAssessment: policy ref/version/scope substitution');
  assert(assessment.policy_binding.digest.value === policyDigest,
    'ResponsibilityAttributionAssessment: policy digest substitution');

  const expectedBindings = {
    causal_claim_qualification: await artifactBinding('CausalClaimQualification', causalQualification.qualification_id, causalQualification),
    responsibility_trace: await artifactBinding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace),
    outcome_observation: await artifactBinding('OutcomeObservationReceipt', outcomeObservation.outcome_observation_id, outcomeObservation)
  };
  for (const [name, expected] of Object.entries(expectedBindings)) {
    const actual = assessment.predecessor_bindings[name];
    assert(actual && actual.artifact_ref === expected.artifact_ref,
      `ResponsibilityAttributionAssessment: predecessor ${name} ref substitution`);
    assert(actual.digest.value === expected.digest.value,
      `ResponsibilityAttributionAssessment: predecessor ${name} digest substitution`);
  }

  assert(sameSemantic(assessment.semantic_binding, causalQualification.semantic_binding) &&
    sameSemantic(assessment.semantic_binding, responsibilityTrace.semantic_binding) &&
    sameSemantic(assessment.semantic_binding, outcomeObservation.semantic_binding),
    'ResponsibilityAttributionAssessment: semantic frontier drift');
  assert(await digestJson(assessment.effect_under_attribution) === await digestJson(causalQualification.effect_under_qualification) &&
    await digestJson(assessment.effect_under_attribution) === await digestJson(evidence.observedEffect),
    'ResponsibilityAttributionAssessment: effect frontier substitution');

  assert(assessment.responsibility_basis.responsible_party_id === responsibilityTrace.semantic_binding.responsible_party_id &&
    sameArray(uniq(assessment.responsibility_basis.accepted_responsibility_scope), uniq(responsibilityTrace.accepted_responsibility_scope)) &&
    sameArray(uniq(assessment.responsibility_basis.scope_intersection), uniq(responsibilityTrace.scope_intersection)) &&
    assessment.responsibility_basis.originating_action === responsibilityTrace.semantic_binding.action &&
    assessment.responsibility_basis.scope_relation === 'originating_action_within_accepted_scope' &&
    assessment.responsibility_basis.trace_status === 'traceable_not_adjudicated',
    'ResponsibilityAttributionAssessment: responsibility basis substitution');

  assert(assessment.causal_basis.predicate === evidence.contribution.predicate &&
    assessment.causal_basis.qualification_status === evidence.contribution.status &&
    assessment.causal_basis.qualification_scope === evidence.contribution.qualification_scope &&
    assessment.causal_basis.establishes_predicate === true &&
    assessment.causal_basis.stronger_causal_predicates_withheld === true,
    'ResponsibilityAttributionAssessment: causal basis substitution');

  assert(Array.isArray(assessment.decisions) && assessment.decisions.length === PREDICATES.length,
    'ResponsibilityAttributionAssessment: exactly six predicate decisions required');
  assert(sameArray(assessment.decisions.map((item) => item.predicate), PREDICATES),
    'ResponsibilityAttributionAssessment: predicate decision set/order substitution');
  assert(new Set(assessment.decisions.map((item) => item.predicate)).size === PREDICATES.length,
    'ResponsibilityAttributionAssessment: duplicate predicate decisions');
  const expectedDecisions = deriveDecisions({
    policy, causalQualification, responsibilityTrace, outcomeObservation, contribution: evidence.contribution
  });
  assert(await digestJson(assessment.decisions) === await digestJson(expectedDecisions),
    'ResponsibilityAttributionAssessment: policy decision derivation substitution');

  assert(assessment.attribution_result.status === 'bounded_responsibility_attribution_supported_stronger_claims_withheld' &&
    assessment.attribution_result.attribution_scope === ATTRIBUTION_SCOPE &&
    assessment.attribution_result.policy_relative === true &&
    assessment.attribution_result.attributed_predicate_count === 2 &&
    assessment.attribution_result.withheld_predicate_count === 4 &&
    assessment.attribution_result.uncertainty_status === 'material_uncertainty_preserved' &&
    assessment.attribution_result.responsibility_adjudicated === false &&
    assessment.attribution_result.external_consequence_responsibility_established === false &&
    assessment.attribution_result.legal_liability_established === false &&
    assessment.attribution_result.moral_blame_assigned === false,
    'ResponsibilityAttributionAssessment: attribution result boundary substitution');

  assert(assessment.claims.accepted_responsibility_scope_applies_to_originating_action === true &&
    assessment.claims.qualified_causal_contribution_bound_to_same_effect === true &&
    assessment.claims.policy_relative_responsibility_attribution_established === true &&
    assessment.claims.exact_transition_responsibility_attributed === true &&
    assessment.claims.stronger_responsibility_claims_withheld === true,
    'ResponsibilityAttributionAssessment: positive attribution claims incomplete');
  return true;
}

module.exports = {
  POLICY_ID,
  ATTRIBUTION_SCOPE,
  PREDICATES,
  digestJson,
  buildResponsibilityAttributionAssessment,
  validateResponsibilityAttributionAssessment
};
