'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const SCENARIO_KINDS = new Set([
  'factual_baseline',
  'suppress_originating_execution',
  'alternative_reproduction_mechanism'
]);
const TEST_STATUSES = new Set(['observed_factual', 'structurally_evaluated', 'not_executed', 'inconclusive']);
const COMPARISON_RESULTS = new Set(['effect_preserved', 'effect_removed', 'effect_changed', 'unknown']);
const RELATION_STATUSES = new Set(['factual_observed', 'sensitivity_supported', 'sensitivity_not_supported', 'unresolved']);
const EVIDENCE_MODES = new Set(['observed_predecessor', 'derived_structural_model', 'unresolved_counterfactual']);
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score',
  'causal_score', 'responsibility_score', 'rating'
]);
const CAUSAL_FALSE_CLAIMS = [
  'generalized_external_consequence_causality_established', 'causal_proof_certified',
  'exclusive_cause_established', 'necessary_cause_established', 'sufficient_cause_established',
  'counterfactual_causality_established', 'responsibility_for_outcome_adjudicated',
  'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned',
  'moral_correctness_established', 'truth_certified', 'remote_branch_or_ref_canonicality_established',
  'poai_materialization_event_recorded', 'poai_successor_record_identity_inferred',
  'universal_canonicality_established', 'poai_v_conformance_established'
];
const ASSESSMENT_FALSE_CLAIMS = [
  'necessary_cause_established', 'sufficient_cause_established', 'exclusive_cause_established',
  'counterfactual_causal_proof_certified', 'generalized_external_consequence_causality_established',
  'causal_proof_certified', 'responsibility_for_outcome_adjudicated', 'legal_responsibility_determined',
  'legal_effect_established', 'moral_blame_assigned', 'moral_correctness_established', 'truth_certified',
  'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
  'poai_successor_record_identity_inferred', 'universal_canonicality_established', 'poai_v_conformance_established'
];

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uniq(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v.length > 0))].sort();
}
function sameArray(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
function baseRevision(value) { return value.base_revision || (value.predecessor && value.predecessor.revision) || null; }
function semantics(value) {
  return [value.action, value.target, value.operation_ref, baseRevision(value), value.responsible_party_id, value.executor_implementation_id];
}
function sameSemantic(a, b) {
  const left = semantics(a), right = semantics(b);
  return left.length === right.length && left.every((v, i) => v === right[i]);
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
async function binding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
function assertFalseClaims(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function scenarioByKind(scenarios, kind) { return scenarios.find((s) => s.kind === kind); }

function normalizeScenario(source, effectDigest) {
  return {
    scenario_id: source.scenario_id,
    kind: source.kind,
    intervention: {
      variable: source.intervention && source.intervention.variable,
      operation: source.intervention && source.intervention.operation,
      value: source.intervention && source.intervention.value
    },
    held_fixed: uniq(source.held_fixed),
    comparison_effect_digest: digest(effectDigest),
    test_status: source.test_status,
    comparison_result: source.comparison_result,
    relation_status: source.relation_status,
    evaluated_at: source.evaluated_at,
    assumptions: uniq(source.assumptions),
    evidence_basis: {
      mode: source.evidence_basis && source.evidence_basis.mode,
      source_refs: uniq(source.evidence_basis && source.evidence_basis.source_refs)
    },
    establishes_necessary_cause: false,
    establishes_sufficient_cause: false,
    establishes_exclusive_cause: false,
    establishes_counterfactual_causal_proof: false
  };
}

function validateScenarioSemantics(scenario, { causalAssessment, outcomeObservation, cutoffMs }) {
  assert(typeof scenario.scenario_id === 'string' && scenario.scenario_id.startsWith('urn:uu-aap:counterfactual-scenario:'),
    'CounterfactualInterventionAssessment: invalid scenario ID');
  assert(SCENARIO_KINDS.has(scenario.kind), `CounterfactualInterventionAssessment: unsupported scenario kind ${scenario.kind}`);
  assert(TEST_STATUSES.has(scenario.test_status), 'CounterfactualInterventionAssessment: invalid test status');
  assert(COMPARISON_RESULTS.has(scenario.comparison_result), 'CounterfactualInterventionAssessment: invalid comparison result');
  assert(RELATION_STATUSES.has(scenario.relation_status), 'CounterfactualInterventionAssessment: invalid relation status');
  assert(EVIDENCE_MODES.has(scenario.evidence_basis.mode), 'CounterfactualInterventionAssessment: invalid evidence mode');
  assert(typeof scenario.intervention.variable === 'string' && typeof scenario.intervention.operation === 'string' &&
    typeof scenario.intervention.value === 'string', 'CounterfactualInterventionAssessment: explicit intervention required');
  assert(Array.isArray(scenario.held_fixed) && scenario.held_fixed.length >= 2,
    'CounterfactualInterventionAssessment: held-fixed invariants required');
  assert(Array.isArray(scenario.assumptions) && scenario.assumptions.length >= 1,
    'CounterfactualInterventionAssessment: scenario assumptions required');
  const evaluatedMs = Date.parse(scenario.evaluated_at);
  assert(Number.isFinite(evaluatedMs) && evaluatedMs <= cutoffMs,
    `CounterfactualInterventionAssessment: scenario ${scenario.scenario_id} is later than evidence cutoff`);
  assert(scenario.establishes_necessary_cause === false && scenario.establishes_sufficient_cause === false &&
    scenario.establishes_exclusive_cause === false && scenario.establishes_counterfactual_causal_proof === false,
    'CounterfactualInterventionAssessment: scenario cannot certify causal predicates in v0.1');

  if (scenario.kind === 'factual_baseline') {
    assert(scenario.intervention.variable === 'none' && scenario.intervention.operation === 'none' && scenario.intervention.value === 'factual',
      'CounterfactualInterventionAssessment: factual baseline intervention must be none');
    assert(scenario.test_status === 'observed_factual' && scenario.comparison_result === 'effect_preserved' &&
      scenario.relation_status === 'factual_observed',
      'CounterfactualInterventionAssessment: factual baseline state invalid');
    assert(scenario.evidence_basis.mode === 'observed_predecessor' &&
      scenario.evidence_basis.source_refs.includes(outcomeObservation.outcome_observation_id),
      'CounterfactualInterventionAssessment: factual baseline must bind predecessor observation');
  }

  if (scenario.kind === 'suppress_originating_execution') {
    assert(scenario.intervention.variable === 'originating_execution_occurrence' &&
      scenario.intervention.operation === 'set_absent' && scenario.intervention.value === 'absent',
      'CounterfactualInterventionAssessment: suppression intervention mismatch');
    assert(scenario.test_status === 'structurally_evaluated' && scenario.comparison_result === 'effect_removed' &&
      scenario.relation_status === 'sensitivity_supported',
      'CounterfactualInterventionAssessment: suppression scenario must remain structural sensitivity only');
    assert(scenario.evidence_basis.mode === 'derived_structural_model' &&
      scenario.evidence_basis.source_refs.includes(causalAssessment.assessment_id),
      'CounterfactualInterventionAssessment: suppression scenario must bind causal assessment');
    assert(scenario.assumptions.includes('predecessor_state_held_fixed') &&
      scenario.assumptions.includes('no_alternative_transition_operator_invoked'),
      'CounterfactualInterventionAssessment: suppression assumptions incomplete');
  }

  if (scenario.kind === 'alternative_reproduction_mechanism') {
    assert(scenario.intervention.variable === 'transition_mechanism_identity' &&
      scenario.intervention.operation === 'replace_with_alternative' &&
      scenario.intervention.value === 'independent_local_mechanism',
      'CounterfactualInterventionAssessment: alternative reproduction intervention mismatch');
    assert(scenario.test_status === 'not_executed' && scenario.comparison_result === 'unknown' &&
      scenario.relation_status === 'unresolved',
      'CounterfactualInterventionAssessment: unresolved alternative cannot be promoted without execution');
    assert(scenario.evidence_basis.mode === 'unresolved_counterfactual' &&
      scenario.evidence_basis.source_refs.includes(causalAssessment.assessment_id),
      'CounterfactualInterventionAssessment: alternative reproduction must bind causal assessment');
    assert(scenario.assumptions.includes('alternative_mechanism_not_observed'),
      'CounterfactualInterventionAssessment: unresolved alternative assumption required');
  }
}

async function buildCounterfactualInterventionAssessment({
  causalAssessment,
  responsibilityTrace,
  outcomeObservation,
  scenarios,
  assessedAt,
  evidenceCutoff
}) {
  assert(causalAssessment && causalAssessment.artifact_type === 'CausalAttributionAssessment' && causalAssessment.artifact_version === '0.1',
    'CounterfactualInterventionAssessment: CausalAttributionAssessment required');
  assert(responsibilityTrace && responsibilityTrace.artifact_type === 'ResponsibilityTrace',
    'CounterfactualInterventionAssessment: ResponsibilityTrace required');
  assert(outcomeObservation && outcomeObservation.artifact_type === 'OutcomeObservationReceipt',
    'CounterfactualInterventionAssessment: OutcomeObservationReceipt required');

  assertFalseClaims(causalAssessment.claims, CAUSAL_FALSE_CLAIMS, 'CausalAttributionAssessment');
  assert(causalAssessment.assessment_result && causalAssessment.assessment_result.causal_proof_established === false &&
    causalAssessment.assessment_result.winner_selected === false &&
    causalAssessment.assessment_result.uncertainty_status === 'material_uncertainty_preserved',
    'CounterfactualInterventionAssessment: predecessor causal boundary invalid');
  assert(responsibilityTrace.responsibility_attribution.status === 'traceable_not_adjudicated' &&
    responsibilityTrace.claims.responsibility_chain_traceable === true,
    'CounterfactualInterventionAssessment: responsibility predecessor boundary invalid');
  assert(outcomeObservation.claims.exact_transition_effect_observed === true,
    'CounterfactualInterventionAssessment: exact observed effect required');

  const traceDigest = await digestJson(responsibilityTrace);
  const outcomeDigest = await digestJson(outcomeObservation);
  assert(causalAssessment.predecessor_bindings.responsibility_trace.artifact_ref === responsibilityTrace.trace_id &&
    causalAssessment.predecessor_bindings.responsibility_trace.digest.value === traceDigest,
    'CounterfactualInterventionAssessment: causal assessment/ResponsibilityTrace binding substitution');
  assert(causalAssessment.predecessor_bindings.outcome_observation.artifact_ref === outcomeObservation.outcome_observation_id &&
    causalAssessment.predecessor_bindings.outcome_observation.digest.value === outcomeDigest,
    'CounterfactualInterventionAssessment: causal assessment/OutcomeObservation binding substitution');
  assert(sameSemantic(causalAssessment.semantic_binding, responsibilityTrace.semantic_binding) &&
    sameSemantic(causalAssessment.semantic_binding, outcomeObservation.semantic_binding),
    'CounterfactualInterventionAssessment: predecessor semantic frontier drift');

  const effect = causalAssessment.effect_under_assessment;
  const observed = outcomeObservation.observed_state;
  assert(effect.scope === 'exact_local_git_transition_effect' && effect.relation === 'exact_state_transition_effect',
    'CounterfactualInterventionAssessment: predecessor effect scope invalid');
  assert(effect.revision === observed.revision && effect.commit_sha === observed.commit_sha && effect.tree_sha === observed.tree_sha,
    'CounterfactualInterventionAssessment: predecessor effect frontier substitution');
  assert(sameArray(uniq(effect.changed_paths), uniq(observed.changed_paths)),
    'CounterfactualInterventionAssessment: predecessor effect path substitution');
  assert(await digestJson(effect.effect_objects) === await digestJson(observed.effect_objects),
    'CounterfactualInterventionAssessment: predecessor effect object substitution');

  const assessedMs = Date.parse(assessedAt), cutoffMs = Date.parse(evidenceCutoff);
  assert(Number.isFinite(assessedMs) && Number.isFinite(cutoffMs) && cutoffMs <= assessedMs,
    'CounterfactualInterventionAssessment: evidence cutoff must not be later than assessed_at');
  assert(assessedMs > Date.parse(causalAssessment.assessed_at),
    'CounterfactualInterventionAssessment: assessment must occur after CausalAttributionAssessment');

  assert(Array.isArray(scenarios) && scenarios.length === 3,
    'CounterfactualInterventionAssessment: exactly three v0.1 scenarios required');
  const effectDigest = await digestJson(effect);
  const normalized = scenarios.map((s) => normalizeScenario(s, effectDigest));
  assert(new Set(normalized.map((s) => s.scenario_id)).size === normalized.length,
    'CounterfactualInterventionAssessment: duplicate scenario IDs');
  const kinds = normalized.map((s) => s.kind);
  for (const kind of SCENARIO_KINDS) {
    assert(kinds.filter((x) => x === kind).length === 1,
      `CounterfactualInterventionAssessment: exactly one ${kind} scenario required`);
  }
  for (const scenario of normalized) validateScenarioSemantics(scenario, { causalAssessment, outcomeObservation, cutoffMs });

  const baseline = scenarioByKind(normalized, 'factual_baseline');
  const suppression = scenarioByKind(normalized, 'suppress_originating_execution');
  const alternative = scenarioByKind(normalized, 'alternative_reproduction_mechanism');
  assert(baseline && suppression && alternative, 'CounterfactualInterventionAssessment: required scenario set incomplete');

  const causalDigest = await digestJson(causalAssessment);
  const scenarioDigest = await digestJson(normalized);
  const seed = `${causalDigest}|${traceDigest}|${outcomeDigest}|${effectDigest}|${scenarioDigest}|${evidenceCutoff}|${assessedAt}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  const assessment = {
    $schema: './counterfactual-intervention.schema.json',
    artifact_type: 'CounterfactualInterventionAssessment',
    artifact_version: '0.1',
    intervention_assessment_id: `urn:uu-aap:counterfactual-intervention-assessment:${idHash.slice(0, 24)}`,
    assessed_at: assessedAt,
    predecessor_bindings: {
      causal_attribution: await binding('CausalAttributionAssessment', causalAssessment.assessment_id, causalAssessment),
      responsibility_trace: await binding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace),
      outcome_observation: await binding('OutcomeObservationReceipt', outcomeObservation.outcome_observation_id, outcomeObservation)
    },
    semantic_binding: clone(causalAssessment.semantic_binding),
    effect_under_assessment: clone(effect),
    intervention_model: {
      model_scope: 'exact_local_git_transition_mechanism',
      interpretation: 'structural_counterfactual_not_real_world_causal_proof',
      held_fixed_global: [
        'base_revision', 'target', 'operation_ref', 'responsible_party_id',
        'executor_implementation_id', 'non_intervened_semantics'
      ],
      external_consequence_model_present: false,
      model_completeness_established: false
    },
    evidence_horizon: {
      evidence_cutoff: evidenceCutoff,
      later_evidence_admitted: false
    },
    scenarios: normalized,
    predicate_tests: {
      necessity: {
        status: 'blocked_by_unresolved_alternative',
        model_relative_sensitivity_supported: suppression.relation_status === 'sensitivity_supported',
        establishes_predicate: false
      },
      sufficiency: {
        status: 'not_tested',
        establishes_predicate: false
      },
      exclusivity: {
        status: 'blocked_by_unresolved_alternative',
        establishes_predicate: false
      },
      counterfactual_proof: {
        status: 'not_certified',
        establishes_proof: false
      }
    },
    assessment_result: {
      status: 'structural_intervention_sensitivity_with_unresolved_reproduction',
      intervention_scope: 'bounded_transition_mechanism_only',
      factual_baseline_verified: true,
      structural_suppression_evaluated: true,
      alternative_reproduction_resolved: false,
      model_relative_sensitivity_status: 'sensitivity_supported',
      causal_predicate_qualification_status: 'deferred',
      uncertainty_status: 'material_uncertainty_preserved',
      causal_proof_established: false
    },
    verification: {
      causal_assessment_exact: true,
      responsibility_trace_exact: true,
      outcome_observation_exact: true,
      semantic_frontier_exact: true,
      effect_frontier_exact: true,
      evidence_horizon_enforced: true,
      factual_baseline_exact: true,
      suppression_intervention_structurally_evaluated: true,
      alternative_reproduction_explicit_and_unresolved: true,
      held_fixed_invariants_explicit: true,
      scalar_scoring_absent: true,
      predecessor_assurance_not_upgraded: true
    },
    claims: {
      predecessor_causal_assessment_verified: true,
      counterfactual_scenarios_defined: true,
      factual_baseline_bound: true,
      intervention_assumptions_explicit: true,
      structural_intervention_comparison_evaluated: true,
      alternative_reproduction_scenario_explicit: true,
      model_relative_intervention_sensitivity_assessed: true,
      uncertainty_and_unresolved_alternatives_preserved: true,
      necessary_cause_established: false,
      sufficient_cause_established: false,
      exclusive_cause_established: false,
      counterfactual_causal_proof_certified: false,
      generalized_external_consequence_causality_established: false,
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

  await validateCounterfactualInterventionAssessment({ assessment, causalAssessment, responsibilityTrace, outcomeObservation });
  return assessment;
}

async function validateCounterfactualInterventionAssessment({ assessment, causalAssessment, responsibilityTrace, outcomeObservation }) {
  assert(assessment && assessment.artifact_type === 'CounterfactualInterventionAssessment' && assessment.artifact_version === '0.1',
    'CounterfactualInterventionAssessment: invalid assessment artifact');
  assert(!hasScalarKey(assessment),
    'CounterfactualInterventionAssessment: scalar probability/score fields are prohibited in v0.1');
  assertFalseClaims(assessment.claims, ASSESSMENT_FALSE_CLAIMS, 'CounterfactualInterventionAssessment');
  assert(assessment.assessment_result.causal_proof_established === false &&
    assessment.assessment_result.causal_predicate_qualification_status === 'deferred' &&
    assessment.assessment_result.alternative_reproduction_resolved === false,
    'CounterfactualInterventionAssessment: result cannot qualify causal predicates in v0.1');
  assert(assessment.intervention_model.external_consequence_model_present === false &&
    assessment.intervention_model.model_completeness_established === false,
    'CounterfactualInterventionAssessment: model completeness/external consequence overclaim');

  assertFalseClaims(causalAssessment.claims, CAUSAL_FALSE_CLAIMS, 'CausalAttributionAssessment');
  const expectedBindings = {
    causal_attribution: await binding('CausalAttributionAssessment', causalAssessment.assessment_id, causalAssessment),
    responsibility_trace: await binding('ResponsibilityTrace', responsibilityTrace.trace_id, responsibilityTrace),
    outcome_observation: await binding('OutcomeObservationReceipt', outcomeObservation.outcome_observation_id, outcomeObservation)
  };
  for (const [name, expected] of Object.entries(expectedBindings)) {
    const actual = assessment.predecessor_bindings[name];
    assert(actual && actual.artifact_ref === expected.artifact_ref,
      `CounterfactualInterventionAssessment: predecessor ${name} ref substitution`);
    assert(actual.digest.value === expected.digest.value,
      `CounterfactualInterventionAssessment: predecessor ${name} digest substitution`);
  }

  assert(sameSemantic(assessment.semantic_binding, causalAssessment.semantic_binding) &&
    sameSemantic(assessment.semantic_binding, responsibilityTrace.semantic_binding) &&
    sameSemantic(assessment.semantic_binding, outcomeObservation.semantic_binding),
    'CounterfactualInterventionAssessment: semantic frontier drift');
  assert(await digestJson(assessment.effect_under_assessment) === await digestJson(causalAssessment.effect_under_assessment),
    'CounterfactualInterventionAssessment: effect frontier substitution');

  const cutoffMs = Date.parse(assessment.evidence_horizon.evidence_cutoff);
  const assessedMs = Date.parse(assessment.assessed_at);
  assert(Number.isFinite(cutoffMs) && Number.isFinite(assessedMs) && cutoffMs <= assessedMs,
    'CounterfactualInterventionAssessment: evidence cutoff must not be later than assessed_at');
  assert(assessedMs > Date.parse(causalAssessment.assessed_at),
    'CounterfactualInterventionAssessment: assessment must occur after CausalAttributionAssessment');
  assert(assessment.evidence_horizon.later_evidence_admitted === false,
    'CounterfactualInterventionAssessment: later evidence must not be silently admitted');

  assert(Array.isArray(assessment.scenarios) && assessment.scenarios.length === 3,
    'CounterfactualInterventionAssessment: exactly three v0.1 scenarios required');
  assert(new Set(assessment.scenarios.map((s) => s.scenario_id)).size === assessment.scenarios.length,
    'CounterfactualInterventionAssessment: duplicate scenario IDs');
  const effectDigest = await digestJson(causalAssessment.effect_under_assessment);
  for (const scenario of assessment.scenarios) {
    assert(scenario.comparison_effect_digest.value === effectDigest,
      'CounterfactualInterventionAssessment: scenario comparison effect substitution');
    validateScenarioSemantics(scenario, { causalAssessment, outcomeObservation, cutoffMs });
  }
  for (const kind of SCENARIO_KINDS) {
    assert(assessment.scenarios.filter((s) => s.kind === kind).length === 1,
      `CounterfactualInterventionAssessment: exactly one ${kind} scenario required`);
  }

  const suppression = scenarioByKind(assessment.scenarios, 'suppress_originating_execution');
  const alternative = scenarioByKind(assessment.scenarios, 'alternative_reproduction_mechanism');
  assert(suppression.relation_status === 'sensitivity_supported',
    'CounterfactualInterventionAssessment: structural sensitivity result missing');
  assert(alternative.test_status === 'not_executed' && alternative.relation_status === 'unresolved',
    'CounterfactualInterventionAssessment: unresolved alternative must remain unresolved');

  assert(assessment.predicate_tests.necessity.establishes_predicate === false &&
    assessment.predicate_tests.sufficiency.establishes_predicate === false &&
    assessment.predicate_tests.exclusivity.establishes_predicate === false &&
    assessment.predicate_tests.counterfactual_proof.establishes_proof === false,
    'CounterfactualInterventionAssessment: causal predicate qualification overclaim');
  assert(assessment.predicate_tests.necessity.status === 'blocked_by_unresolved_alternative' &&
    assessment.predicate_tests.exclusivity.status === 'blocked_by_unresolved_alternative',
    'CounterfactualInterventionAssessment: unresolved alternative must block necessity/exclusivity qualification');
  return true;
}

module.exports = {
  digestJson,
  buildCounterfactualInterventionAssessment,
  validateCounterfactualInterventionAssessment
};
