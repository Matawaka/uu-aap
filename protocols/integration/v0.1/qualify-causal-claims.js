'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const POLICY_ID = 'urn:uu-aap:causal-qualification-policy:exact-local-git-transition:1';
const QUALIFICATION_SCOPE = 'urn:uu-aap:causal-qualification-scope:exact-local-git-transition-v0.1';
const PREDICATES = [
  'originating_execution_contributed_to_exact_transition',
  'model_relative_intervention_sensitivity',
  'necessary_cause',
  'sufficient_cause',
  'exclusive_cause',
  'counterfactual_causal_proof',
  'generalized_external_consequence_causality'
];
const ALLOWED_STATUSES = ['qualified', 'not_qualified', 'deferred', 'out_of_scope'];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score',
  'causal_score', 'responsibility_score', 'rating'
]);
const STRONG_FALSE_CLAIMS = [
  'necessary_cause_established',
  'sufficient_cause_established',
  'exclusive_cause_established',
  'counterfactual_causal_proof_certified',
  'generalized_external_consequence_causality_established',
  'universal_causal_truth_established',
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

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uniq(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v.length > 0))].sort();
}
function sameArray(a, b) { return a.length === b.length && a.every((value, i) => value === b[i]); }
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
async function artifactBinding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
function assertFalseClaims(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function scenarioByKind(assessment, kind) {
  return assessment.scenarios.find((scenario) => scenario.kind === kind);
}
function hypothesisByKind(assessment, kind) {
  return assessment.hypotheses.find((hypothesis) => hypothesis.kind === kind);
}

function validatePolicy(policy, qualifiedAt) {
  assert(policy && policy.artifact_type === 'UU-AAPCausalQualificationPolicy' && policy.artifact_version === '0.1',
    'CausalClaimQualification: valid CausalQualificationPolicy required');
  assert(policy.policy_id === POLICY_ID && policy.policy_version === 1,
    'CausalClaimQualification: policy ID/version substitution');
  assert(policy.qualification_scope === QUALIFICATION_SCOPE,
    'CausalClaimQualification: policy scope substitution');
  assert(policy.applies_to &&
    policy.applies_to.predecessor_artifact_type === 'CounterfactualInterventionAssessment' &&
    policy.applies_to.predecessor_artifact_version === '0.1' &&
    policy.applies_to.model_scope === 'exact_local_git_transition_mechanism' &&
    policy.applies_to.effect_scope === 'exact_local_git_transition_effect',
    'CausalClaimQualification: policy applicability substitution');
  assert(sameArray(policy.allowed_statuses, ALLOWED_STATUSES),
    'CausalClaimQualification: policy status vocabulary substitution');
  assert(policy.predicate_rules && sameArray(Object.keys(policy.predicate_rules), PREDICATES),
    'CausalClaimQualification: policy predicate vocabulary/order substitution');

  const expected = {
    originating_execution_contributed_to_exact_transition: ['qualified', true],
    model_relative_intervention_sensitivity: ['qualified', true],
    necessary_cause: ['deferred', false],
    sufficient_cause: ['deferred', false],
    exclusive_cause: ['deferred', false],
    counterfactual_causal_proof: ['not_qualified', false],
    generalized_external_consequence_causality: ['out_of_scope', false]
  };
  for (const predicate of PREDICATES) {
    const rule = policy.predicate_rules[predicate];
    assert(rule && rule.status === expected[predicate][0] && rule.establishes_predicate === expected[predicate][1],
      `CausalClaimQualification: policy rule substitution for ${predicate}`);
    assert(Array.isArray(rule.required_conditions) && rule.required_conditions.length > 0,
      `CausalClaimQualification: policy conditions missing for ${predicate}`);
    assert(Array.isArray(rule.reason_codes) && rule.reason_codes.length > 0,
      `CausalClaimQualification: policy reason codes missing for ${predicate}`);
  }
  assert(policy.claims && policy.claims.policy_establishes_universal_causal_truth === false &&
    policy.claims.policy_establishes_responsibility_adjudication === false &&
    policy.claims.policy_establishes_legal_liability === false &&
    policy.claims.policy_establishes_moral_blame === false,
    'CausalClaimQualification: policy assurance boundary overclaim');

  const qualifiedMs = Date.parse(qualifiedAt);
  const effectiveFromMs = Date.parse(policy.effective_from);
  assert(Number.isFinite(qualifiedMs) && Number.isFinite(effectiveFromMs) && qualifiedMs >= effectiveFromMs,
    'CausalClaimQualification: policy not yet effective');
  if (policy.effective_until !== null) {
    const effectiveUntilMs = Date.parse(policy.effective_until);
    assert(Number.isFinite(effectiveUntilMs) && qualifiedMs < effectiveUntilMs,
      'CausalClaimQualification: policy expired');
  }
  return true;
}

async function validatePredecessors({ counterfactualAssessment, causalAssessment, responsibilityTrace }) {
  assert(counterfactualAssessment && counterfactualAssessment.artifact_type === 'CounterfactualInterventionAssessment' &&
    counterfactualAssessment.artifact_version === '0.1',
    'CausalClaimQualification: CounterfactualInterventionAssessment required');
  assert(causalAssessment && causalAssessment.artifact_type === 'CausalAttributionAssessment' && causalAssessment.artifact_version === '0.1',
    'CausalClaimQualification: CausalAttributionAssessment required');
  assert(responsibilityTrace && responsibilityTrace.artifact_type === 'ResponsibilityTrace',
    'CausalClaimQualification: ResponsibilityTrace required');

  assertFalseClaims(counterfactualAssessment.claims, [
    'necessary_cause_established', 'sufficient_cause_established', 'exclusive_cause_established',
    'counterfactual_causal_proof_certified', 'generalized_external_consequence_causality_established',
    'causal_proof_certified', 'responsibility_for_outcome_adjudicated', 'legal_responsibility_determined',
    'legal_effect_established', 'moral_blame_assigned', 'moral_correctness_established', 'truth_certified',
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'poai_successor_record_identity_inferred', 'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'CounterfactualInterventionAssessment');
  assertFalseClaims(causalAssessment.claims, [
    'generalized_external_consequence_causality_established', 'causal_proof_certified',
    'exclusive_cause_established', 'necessary_cause_established', 'sufficient_cause_established',
    'counterfactual_causality_established', 'responsibility_for_outcome_adjudicated',
    'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned',
    'moral_correctness_established', 'truth_certified', 'remote_branch_or_ref_canonicality_established',
    'poai_materialization_event_recorded', 'poai_successor_record_identity_inferred',
    'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'CausalAttributionAssessment');
  assertFalseClaims(responsibilityTrace.claims, [
    'external_consequence_causality_established', 'causal_proof_certified',
    'responsibility_for_outcome_adjudicated', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_blame_assigned', 'moral_correctness_established', 'truth_certified',
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'poai_successor_record_identity_inferred', 'universal_canonicality_established', 'poai_v_conformance_established'
  ], 'ResponsibilityTrace');

  assert(counterfactualAssessment.assessment_result &&
    counterfactualAssessment.assessment_result.status === 'structural_intervention_sensitivity_with_unresolved_reproduction' &&
    counterfactualAssessment.assessment_result.model_relative_sensitivity_status === 'sensitivity_supported' &&
    counterfactualAssessment.assessment_result.alternative_reproduction_resolved === false &&
    counterfactualAssessment.assessment_result.causal_predicate_qualification_status === 'deferred' &&
    counterfactualAssessment.assessment_result.causal_proof_established === false,
    'CausalClaimQualification: predecessor counterfactual result boundary invalid');
  assert(counterfactualAssessment.intervention_model &&
    counterfactualAssessment.intervention_model.model_scope === 'exact_local_git_transition_mechanism' &&
    counterfactualAssessment.intervention_model.interpretation === 'structural_counterfactual_not_real_world_causal_proof' &&
    counterfactualAssessment.intervention_model.external_consequence_model_present === false &&
    counterfactualAssessment.intervention_model.model_completeness_established === false,
    'CausalClaimQualification: predecessor intervention model boundary invalid');

  const causalDigest = await digestJson(causalAssessment);
  const traceDigest = await digestJson(responsibilityTrace);
  assert(counterfactualAssessment.predecessor_bindings.causal_attribution.artifact_ref === causalAssessment.assessment_id &&
    counterfactualAssessment.predecessor_bindings.causal_attribution.digest.value === causalDigest,
    'CausalClaimQualification: Counterfactual/CausalAttribution binding substitution');
  assert(counterfactualAssessment.predecessor_bindings.responsibility_trace.artifact_ref === responsibilityTrace.trace_id &&
    counterfactualAssessment.predecessor_bindings.responsibility_trace.digest.value === traceDigest,
    'CausalClaimQualification: Counterfactual/ResponsibilityTrace binding substitution');
  assert(causalAssessment.predecessor_bindings.responsibility_trace.artifact_ref === responsibilityTrace.trace_id &&
    causalAssessment.predecessor_bindings.responsibility_trace.digest.value === traceDigest,
    'CausalClaimQualification: CausalAttribution/ResponsibilityTrace binding substitution');

  assert(sameSemantic(counterfactualAssessment.semantic_binding, causalAssessment.semantic_binding) &&
    sameSemantic(counterfactualAssessment.semantic_binding, responsibilityTrace.semantic_binding),
    'CausalClaimQualification: predecessor semantic frontier drift');
  assert(await digestJson(counterfactualAssessment.effect_under_assessment) === await digestJson(causalAssessment.effect_under_assessment),
    'CausalClaimQualification: predecessor effect frontier drift');

  assert(causalAssessment.assessment_result &&
    causalAssessment.assessment_result.status === 'bounded_association_supported_with_unresolved_alternatives' &&
    causalAssessment.assessment_result.causal_scope === 'bounded_transition_mechanism_only' &&
    causalAssessment.assessment_result.alternatives_considered === true &&
    causalAssessment.assessment_result.winner_selected === false &&
    causalAssessment.assessment_result.uncertainty_status === 'material_uncertainty_preserved' &&
    causalAssessment.assessment_result.causal_proof_established === false,
    'CausalClaimQualification: predecessor causal assessment boundary invalid');
  const origin = hypothesisByKind(causalAssessment, 'originating_execution_contributed');
  assert(origin && origin.support_status === 'supported',
    'CausalClaimQualification: originating execution hypothesis is not supported');
  assert(responsibilityTrace.responsibility_attribution &&
    responsibilityTrace.responsibility_attribution.status === 'traceable_not_adjudicated' &&
    responsibilityTrace.claims.responsibility_chain_traceable === true,
    'CausalClaimQualification: responsibility trace must remain traceable_not_adjudicated');

  const suppression = scenarioByKind(counterfactualAssessment, 'suppress_originating_execution');
  const alternative = scenarioByKind(counterfactualAssessment, 'alternative_reproduction_mechanism');
  assert(suppression && suppression.test_status === 'structurally_evaluated' &&
    suppression.comparison_result === 'effect_removed' && suppression.relation_status === 'sensitivity_supported',
    'CausalClaimQualification: suppression evidence does not support model-relative sensitivity');
  assert(alternative && alternative.test_status === 'not_executed' &&
    alternative.comparison_result === 'unknown' && alternative.relation_status === 'unresolved',
    'CausalClaimQualification: alternative reproduction is not explicitly unresolved');
  assert(counterfactualAssessment.predicate_tests.necessity.status === 'blocked_by_unresolved_alternative' &&
    counterfactualAssessment.predicate_tests.necessity.establishes_predicate === false,
    'CausalClaimQualification: necessity predecessor gate invalid');
  assert(counterfactualAssessment.predicate_tests.sufficiency.status === 'not_tested' &&
    counterfactualAssessment.predicate_tests.sufficiency.establishes_predicate === false,
    'CausalClaimQualification: sufficiency predecessor gate invalid');
  assert(counterfactualAssessment.predicate_tests.exclusivity.status === 'blocked_by_unresolved_alternative' &&
    counterfactualAssessment.predicate_tests.exclusivity.establishes_predicate === false,
    'CausalClaimQualification: exclusivity predecessor gate invalid');
  assert(counterfactualAssessment.predicate_tests.counterfactual_proof.establishes_proof === false,
    'CausalClaimQualification: counterfactual proof predecessor gate invalid');

  return { origin, suppression, alternative };
}

function decision(predicate, rule, evidenceRefs) {
  return {
    predicate,
    status: rule.status,
    qualification_scope: QUALIFICATION_SCOPE,
    reason_codes: uniq(rule.reason_codes),
    evidence_refs: uniq(evidenceRefs),
    establishes_predicate: rule.establishes_predicate
  };
}

function deriveDecisions({ policy, counterfactualAssessment, causalAssessment, responsibilityTrace, origin, suppression, alternative }) {
  assert(origin.support_status === 'supported',
    'CausalClaimQualification: contribution qualification lacks supported originating hypothesis');
  assert(suppression.test_status === 'structurally_evaluated' && suppression.comparison_result === 'effect_removed' &&
    suppression.relation_status === 'sensitivity_supported',
    'CausalClaimQualification: sensitivity qualification lacks structural suppression evidence');
  assert(alternative.test_status === 'not_executed' && alternative.relation_status === 'unresolved',
    'CausalClaimQualification: unresolved alternative required for necessity/exclusivity deferral');
  assert(counterfactualAssessment.predicate_tests.sufficiency.status === 'not_tested',
    'CausalClaimQualification: sufficiency must remain deferred while untested');
  assert(counterfactualAssessment.predicate_tests.counterfactual_proof.establishes_proof === false,
    'CausalClaimQualification: structural evidence cannot qualify counterfactual proof');
  assert(counterfactualAssessment.intervention_model.external_consequence_model_present === false,
    'CausalClaimQualification: generalized external causality cannot be qualified without external consequence model');

  const rules = policy.predicate_rules;
  return [
    decision(PREDICATES[0], rules[PREDICATES[0]], [causalAssessment.assessment_id, responsibilityTrace.trace_id]),
    decision(PREDICATES[1], rules[PREDICATES[1]], [counterfactualAssessment.intervention_assessment_id, suppression.scenario_id]),
    decision(PREDICATES[2], rules[PREDICATES[2]], [counterfactualAssessment.intervention_assessment_id, alternative.scenario_id]),
    decision(PREDICATES[3], rules[PREDICATES[3]], [counterfactualAssessment.intervention_assessment_id]),
    decision(PREDICATES[4], rules[PREDICATES[4]], [counterfactualAssessment.intervention_assessment_id, alternative.scenario_id]),
    decision(PREDICATES[5], rules[PREDICATES[5]], [counterfactualAssessment.intervention_assessment_id, causalAssessment.assessment_id]),
    decision(PREDICATES[6], rules[PREDICATES[6]], [counterfactualAssessment.intervention_assessment_id])
  ];
}

async function buildCausalClaimQualification({
  policy,
  counterfactualAssessment,
  causalAssessment,
  responsibilityTrace,
  qualifiedAt
}) {
  validatePolicy(policy, qualifiedAt);
  const evidence = await validatePredecessors({ counterfactualAssessment, causalAssessment, responsibilityTrace });
  const qualifiedMs = Date.parse(qualifiedAt);
  assert(Number.isFinite(qualifiedMs) && qualifiedMs > Date.parse(counterfactualAssessment.assessed_at),
    'CausalClaimQualification: qualification must occur after CounterfactualInterventionAssessment');

  const decisions = deriveDecisions({
    policy,
    counterfactualAssessment,
    causalAssessment,
    responsibilityTrace,
    ...evidence
  });
  const qualifiedCount = decisions.filter((item) => item.status === 'qualified' && item.establishes_predicate === true).length;
  assert(qualifiedCount === 2, 'CausalClaimQualification: exactly two bounded predicates may qualify in v0.1');

  const policyDigest = await digestJson(policy);
  const counterfactualDigest = await digestJson(counterfactualAssessment);
  const causalDigest = await digestJson(causalAssessment);
  const traceDigest = await digestJson(responsibilityTrace);
  const decisionsDigest = await digestJson(decisions);
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(
    `${policyDigest}|${counterfactualDigest}|${causalDigest}|${traceDigest}|${decisionsDigest}|${qualifiedAt}`
  ));

  const qualification = {
    $schema: './causal-claim-qualification.schema.json',
    artifact_type: 'CausalClaimQualification',
    artifact_version: '0.1',
    qualification_id: `urn:uu-aap:causal-claim-qualification:${idHash.slice(0, 24)}`,
    qualified_at: qualifiedAt,
    policy_binding: {
      artifact_type: policy.artifact_type,
      artifact_ref: policy.policy_id,
      policy_version: policy.policy_version,
      qualification_scope: policy.qualification_scope,
      digest: digest(policyDigest)
    },
    predecessor_bindings: {
      counterfactual_intervention: await artifactBinding(
        'CounterfactualInterventionAssessment', counterfactualAssessment.intervention_assessment_id, counterfactualAssessment),
      causal_attribution: await artifactBinding('CausalAttributionAssessment', causalAssessment.assessment_id, causalAssessment),
      responsibility_trace: await artifactBinding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace)
    },
    semantic_binding: clone(counterfactualAssessment.semantic_binding),
    effect_under_qualification: clone(counterfactualAssessment.effect_under_assessment),
    decisions,
    qualification_result: {
      status: 'bounded_predicates_qualified_stronger_claims_withheld',
      qualification_scope: policy.qualification_scope,
      policy_relative: true,
      qualified_predicate_count: 2,
      withheld_predicate_count: 5,
      uncertainty_status: 'material_uncertainty_preserved',
      universal_causal_truth_established: false
    },
    verification: {
      policy_exact: true,
      policy_effective: true,
      counterfactual_assessment_exact: true,
      causal_assessment_exact: true,
      responsibility_trace_exact: true,
      semantic_frontier_exact: true,
      effect_frontier_exact: true,
      policy_rules_applied_exactly: true,
      all_policy_predicates_decided_once: true,
      bounded_positive_predicates_supported: true,
      stronger_predicates_withheld: true,
      scalar_scoring_absent: true,
      predecessor_assurance_not_upgraded: true
    },
    claims: {
      exact_qualification_policy_applied: true,
      predecessor_evidence_verified: true,
      typed_causal_predicates_evaluated: true,
      bounded_execution_contribution_qualified: true,
      model_relative_intervention_sensitivity_qualified: true,
      stronger_causal_predicates_withheld: true,
      policy_scope_relativity_explicit: true,
      uncertainty_preserved: true,
      necessary_cause_established: false,
      sufficient_cause_established: false,
      exclusive_cause_established: false,
      counterfactual_causal_proof_certified: false,
      generalized_external_consequence_causality_established: false,
      universal_causal_truth_established: false,
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

  await validateCausalClaimQualification({ qualification, policy, counterfactualAssessment, causalAssessment, responsibilityTrace });
  return qualification;
}

async function validateCausalClaimQualification({ qualification, policy, counterfactualAssessment, causalAssessment, responsibilityTrace }) {
  assert(qualification && qualification.artifact_type === 'CausalClaimQualification' && qualification.artifact_version === '0.1',
    'CausalClaimQualification: invalid qualification artifact');
  assert(!hasScalarKey(qualification),
    'CausalClaimQualification: scalar probability/score fields are prohibited in v0.1');
  assertFalseClaims(qualification.claims, STRONG_FALSE_CLAIMS, 'CausalClaimQualification');
  validatePolicy(policy, qualification.qualified_at);
  const evidence = await validatePredecessors({ counterfactualAssessment, causalAssessment, responsibilityTrace });
  assert(Date.parse(qualification.qualified_at) > Date.parse(counterfactualAssessment.assessed_at),
    'CausalClaimQualification: qualification must occur after CounterfactualInterventionAssessment');

  const policyDigest = await digestJson(policy);
  assert(qualification.policy_binding.artifact_ref === policy.policy_id &&
    qualification.policy_binding.policy_version === policy.policy_version &&
    qualification.policy_binding.qualification_scope === policy.qualification_scope,
    'CausalClaimQualification: policy ref/version/scope substitution');
  assert(qualification.policy_binding.digest.value === policyDigest,
    'CausalClaimQualification: policy digest substitution');

  const expectedBindings = {
    counterfactual_intervention: await artifactBinding(
      'CounterfactualInterventionAssessment', counterfactualAssessment.intervention_assessment_id, counterfactualAssessment),
    causal_attribution: await artifactBinding('CausalAttributionAssessment', causalAssessment.assessment_id, causalAssessment),
    responsibility_trace: await artifactBinding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace)
  };
  for (const [name, expected] of Object.entries(expectedBindings)) {
    const actual = qualification.predecessor_bindings[name];
    assert(actual && actual.artifact_ref === expected.artifact_ref,
      `CausalClaimQualification: predecessor ${name} ref substitution`);
    assert(actual.digest.value === expected.digest.value,
      `CausalClaimQualification: predecessor ${name} digest substitution`);
  }

  assert(sameSemantic(qualification.semantic_binding, counterfactualAssessment.semantic_binding) &&
    sameSemantic(qualification.semantic_binding, causalAssessment.semantic_binding) &&
    sameSemantic(qualification.semantic_binding, responsibilityTrace.semantic_binding),
    'CausalClaimQualification: semantic frontier drift');
  assert(await digestJson(qualification.effect_under_qualification) === await digestJson(counterfactualAssessment.effect_under_assessment),
    'CausalClaimQualification: effect frontier substitution');

  assert(Array.isArray(qualification.decisions) && qualification.decisions.length === PREDICATES.length,
    'CausalClaimQualification: exactly seven predicate decisions required');
  assert(sameArray(qualification.decisions.map((item) => item.predicate), PREDICATES),
    'CausalClaimQualification: predicate decision set/order substitution');
  assert(new Set(qualification.decisions.map((item) => item.predicate)).size === PREDICATES.length,
    'CausalClaimQualification: duplicate predicate decisions');

  const expectedDecisions = deriveDecisions({
    policy,
    counterfactualAssessment,
    causalAssessment,
    responsibilityTrace,
    ...evidence
  });
  assert(await digestJson(qualification.decisions) === await digestJson(expectedDecisions),
    'CausalClaimQualification: policy decision derivation substitution');

  assert(qualification.qualification_result.status === 'bounded_predicates_qualified_stronger_claims_withheld' &&
    qualification.qualification_result.qualification_scope === QUALIFICATION_SCOPE &&
    qualification.qualification_result.policy_relative === true &&
    qualification.qualification_result.qualified_predicate_count === 2 &&
    qualification.qualification_result.withheld_predicate_count === 5 &&
    qualification.qualification_result.uncertainty_status === 'material_uncertainty_preserved' &&
    qualification.qualification_result.universal_causal_truth_established === false,
    'CausalClaimQualification: qualification result boundary substitution');

  assert(qualification.claims.bounded_execution_contribution_qualified === true &&
    qualification.claims.model_relative_intervention_sensitivity_qualified === true &&
    qualification.claims.stronger_causal_predicates_withheld === true &&
    qualification.claims.policy_scope_relativity_explicit === true &&
    qualification.claims.uncertainty_preserved === true,
    'CausalClaimQualification: positive qualification claims incomplete');
  return true;
}

module.exports = {
  POLICY_ID,
  QUALIFICATION_SCOPE,
  PREDICATES,
  digestJson,
  buildCausalClaimQualification,
  validateCausalClaimQualification
};
