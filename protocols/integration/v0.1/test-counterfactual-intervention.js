'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  buildCounterfactualInterventionAssessment,
  validateCounterfactualInterventionAssessment
} = require('./assess-counterfactual.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function runCausalAssessment(assessmentPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-causal-attribution.js', assessmentPath
  ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  assert(run.status === 0, `causal assessment prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
}

async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

function buildScenarios(causalAssessment, outcomeObservation) {
  return [
    {
      scenario_id: 'urn:uu-aap:counterfactual-scenario:factual-baseline',
      kind: 'factual_baseline',
      intervention: { variable: 'none', operation: 'none', value: 'factual' },
      held_fixed: ['base_revision', 'target', 'operation_ref'],
      test_status: 'observed_factual',
      comparison_result: 'effect_preserved',
      relation_status: 'factual_observed',
      evaluated_at: '2026-08-23T08:20:04Z',
      assumptions: ['predecessor_observation_is_immutable_baseline'],
      evidence_basis: {
        mode: 'observed_predecessor',
        source_refs: [outcomeObservation.outcome_observation_id]
      }
    },
    {
      scenario_id: 'urn:uu-aap:counterfactual-scenario:suppress-originating-execution',
      kind: 'suppress_originating_execution',
      intervention: {
        variable: 'originating_execution_occurrence',
        operation: 'set_absent',
        value: 'absent'
      },
      held_fixed: ['base_revision', 'target', 'operation_ref', 'non_intervened_semantics'],
      test_status: 'structurally_evaluated',
      comparison_result: 'effect_removed',
      relation_status: 'sensitivity_supported',
      evaluated_at: '2026-08-23T08:20:04Z',
      assumptions: [
        'predecessor_state_held_fixed',
        'no_alternative_transition_operator_invoked',
        'effect_definition_held_fixed'
      ],
      evidence_basis: {
        mode: 'derived_structural_model',
        source_refs: [causalAssessment.assessment_id]
      }
    },
    {
      scenario_id: 'urn:uu-aap:counterfactual-scenario:alternative-reproduction',
      kind: 'alternative_reproduction_mechanism',
      intervention: {
        variable: 'transition_mechanism_identity',
        operation: 'replace_with_alternative',
        value: 'independent_local_mechanism'
      },
      held_fixed: ['base_revision', 'target', 'effect_definition'],
      test_status: 'not_executed',
      comparison_result: 'unknown',
      relation_status: 'unresolved',
      evaluated_at: '2026-08-23T08:20:04Z',
      assumptions: ['alternative_mechanism_not_observed', 'effect_definition_held_fixed'],
      evidence_basis: {
        mode: 'unresolved_counterfactual',
        source_refs: [causalAssessment.assessment_id]
      }
    }
  ];
}

async function main() {
  const assessmentPath = process.argv[2] || '/tmp/counterfactual-intervention-assessment.json';
  const causalPath = '/tmp/counterfactual-causal-attribution.json';
  runCausalAssessment(causalPath);

  const causalAssessment = readJson(causalPath);
  const responsibilityTrace = readJson('/tmp/causal-responsibility-trace.json');
  const outcomeObservation = readJson('/tmp/causal-outcome-observation.json');
  const scenarios = buildScenarios(causalAssessment, outcomeObservation);
  const args = {
    causalAssessment,
    responsibilityTrace,
    outcomeObservation,
    scenarios: clone(scenarios),
    assessedAt: '2026-08-23T08:20:05Z',
    evidenceCutoff: '2026-08-23T08:20:04Z'
  };

  const assessment = await buildCounterfactualInterventionAssessment(args);
  assert(assessment.assessment_result.status === 'structural_intervention_sensitivity_with_unresolved_reproduction', 'assessment status mismatch');
  assert(assessment.assessment_result.intervention_scope === 'bounded_transition_mechanism_only', 'intervention scope mismatch');
  assert(assessment.assessment_result.factual_baseline_verified === true, 'factual baseline must be verified');
  assert(assessment.assessment_result.structural_suppression_evaluated === true, 'suppression must be structurally evaluated');
  assert(assessment.assessment_result.alternative_reproduction_resolved === false, 'alternative reproduction must remain unresolved');
  assert(assessment.assessment_result.model_relative_sensitivity_status === 'sensitivity_supported', 'sensitivity status mismatch');
  assert(assessment.assessment_result.causal_predicate_qualification_status === 'deferred', 'causal predicates must be deferred');
  assert(assessment.predicate_tests.necessity.status === 'blocked_by_unresolved_alternative', 'necessity must remain blocked');
  assert(assessment.predicate_tests.exclusivity.status === 'blocked_by_unresolved_alternative', 'exclusivity must remain blocked');
  assert(assessment.predicate_tests.sufficiency.status === 'not_tested', 'sufficiency must remain untested');
  assert(assessment.claims.model_relative_intervention_sensitivity_assessed === true, 'model-relative sensitivity must be assessed');
  assert(assessment.claims.necessary_cause_established === false, 'necessary cause must remain false');
  assert(assessment.claims.sufficient_cause_established === false, 'sufficient cause must remain false');
  assert(assessment.claims.exclusive_cause_established === false, 'exclusive cause must remain false');
  assert(assessment.claims.counterfactual_causal_proof_certified === false, 'counterfactual proof must remain false');

  const vectors = [];
  vectors.push(await reject('assessment_not_after_causal', async () => {
    await buildCounterfactualInterventionAssessment({
      ...args,
      assessedAt: causalAssessment.assessed_at,
      evidenceCutoff: causalAssessment.assessed_at
    });
  }, /after CausalAttributionAssessment/));

  vectors.push(await reject('cutoff_after_assessment', async () => {
    await buildCounterfactualInterventionAssessment({ ...args, evidenceCutoff: '2026-08-23T08:20:06Z' });
  }, /cutoff must not be later/));

  vectors.push(await reject('scenario_after_cutoff', async () => {
    const changed = clone(scenarios);
    changed[1].evaluated_at = '2026-08-23T08:20:05Z';
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /later than evidence cutoff/));

  vectors.push(await reject('predecessor_necessary_cause_overclaim', async () => {
    const causal = clone(causalAssessment);
    causal.claims.necessary_cause_established = true;
    await buildCounterfactualInterventionAssessment({ ...args, causalAssessment: causal });
  }, /prohibited claim necessary_cause_established/));

  vectors.push(await reject('causal_trace_digest_substitution', async () => {
    const causal = clone(causalAssessment);
    causal.predecessor_bindings.responsibility_trace.digest.value = '0'.repeat(64);
    await buildCounterfactualInterventionAssessment({ ...args, causalAssessment: causal });
  }, /ResponsibilityTrace binding substitution/));

  vectors.push(await reject('causal_outcome_ref_substitution', async () => {
    const causal = clone(causalAssessment);
    causal.predecessor_bindings.outcome_observation.artifact_ref = 'urn:uu-aap:outcome-observation:other';
    await buildCounterfactualInterventionAssessment({ ...args, causalAssessment: causal });
  }, /OutcomeObservation binding substitution/));

  vectors.push(await reject('duplicate_scenario_id', async () => {
    const changed = clone(scenarios);
    changed[1].scenario_id = changed[0].scenario_id;
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /duplicate scenario IDs/));

  vectors.push(await reject('missing_factual_baseline', async () => {
    const changed = clone(scenarios);
    changed[0].kind = 'suppress_originating_execution';
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /exactly one factual_baseline/));

  vectors.push(await reject('multiple_factual_baselines', async () => {
    const changed = clone(scenarios);
    changed[1].kind = 'factual_baseline';
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /exactly one factual_baseline|exactly one suppress_originating_execution/));

  vectors.push(await reject('missing_alternative_reproduction', async () => {
    const changed = clone(scenarios);
    changed[2].kind = 'suppress_originating_execution';
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /exactly one alternative_reproduction_mechanism|exactly one suppress_originating_execution/));

  vectors.push(await reject('baseline_intervention_substitution', async () => {
    const changed = clone(scenarios);
    changed[0].intervention.operation = 'set_absent';
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /factual baseline intervention must be none/));

  vectors.push(await reject('held_fixed_missing', async () => {
    const changed = clone(scenarios);
    changed[1].held_fixed = [];
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /held-fixed invariants required/));

  vectors.push(await reject('suppression_promoted_to_proof_like_state', async () => {
    const changed = clone(scenarios);
    changed[1].comparison_result = 'effect_preserved';
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /suppression scenario must remain structural sensitivity only/));

  vectors.push(await reject('alternative_reproduction_false_resolution', async () => {
    const changed = clone(scenarios);
    changed[2].test_status = 'structurally_evaluated';
    changed[2].comparison_result = 'effect_preserved';
    changed[2].relation_status = 'sensitivity_not_supported';
    await buildCounterfactualInterventionAssessment({ ...args, scenarios: changed });
  }, /unresolved alternative cannot be promoted/));

  const validate = (value) => validateCounterfactualInterventionAssessment({
    assessment: value,
    causalAssessment,
    responsibilityTrace,
    outcomeObservation
  });

  vectors.push(await reject('causal_binding_digest_substitution', async () => {
    const changed = clone(assessment);
    changed.predecessor_bindings.causal_attribution.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /causal_attribution digest substitution/));

  vectors.push(await reject('trace_binding_ref_substitution', async () => {
    const changed = clone(assessment);
    changed.predecessor_bindings.responsibility_trace.artifact_ref = 'urn:uu-aap:responsibility-trace:other';
    await validate(changed);
  }, /responsibility_trace ref substitution/));

  vectors.push(await reject('outcome_binding_digest_substitution', async () => {
    const changed = clone(assessment);
    changed.predecessor_bindings.outcome_observation.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /outcome_observation digest substitution/));

  vectors.push(await reject('semantic_frontier_drift', async () => {
    const changed = clone(assessment);
    changed.semantic_binding.action = 'other.action';
    await validate(changed);
  }, /semantic frontier drift/));

  vectors.push(await reject('effect_frontier_substitution', async () => {
    const changed = clone(assessment);
    changed.effect_under_assessment.tree_sha = '0'.repeat(40);
    await validate(changed);
  }, /effect frontier substitution/));

  vectors.push(await reject('scenario_comparison_effect_substitution', async () => {
    const changed = clone(assessment);
    changed.scenarios[1].comparison_effect_digest.value = '0'.repeat(64);
    await validate(changed);
  }, /scenario comparison effect substitution/));

  vectors.push(await reject('later_evidence_admitted', async () => {
    const changed = clone(assessment);
    changed.evidence_horizon.later_evidence_admitted = true;
    await validate(changed);
  }, /later evidence must not be silently admitted/));

  vectors.push(await reject('model_completeness_overclaim', async () => {
    const changed = clone(assessment);
    changed.intervention_model.model_completeness_established = true;
    await validate(changed);
  }, /model completeness\/external consequence overclaim/));

  vectors.push(await reject('external_consequence_model_overclaim', async () => {
    const changed = clone(assessment);
    changed.intervention_model.external_consequence_model_present = true;
    await validate(changed);
  }, /model completeness\/external consequence overclaim/));

  vectors.push(await reject('necessity_predicate_qualification_overclaim', async () => {
    const changed = clone(assessment);
    changed.predicate_tests.necessity.establishes_predicate = true;
    await validate(changed);
  }, /causal predicate qualification overclaim/));

  for (const [name, key] of [
    ['necessary_cause_overclaim', 'necessary_cause_established'],
    ['sufficient_cause_overclaim', 'sufficient_cause_established'],
    ['exclusive_cause_overclaim', 'exclusive_cause_established'],
    ['counterfactual_proof_overclaim', 'counterfactual_causal_proof_certified'],
    ['causal_proof_overclaim', 'causal_proof_certified'],
    ['responsibility_adjudication_overclaim', 'responsibility_for_outcome_adjudicated'],
    ['legal_overclaim', 'legal_responsibility_determined'],
    ['truth_overclaim', 'truth_certified']
  ]) {
    vectors.push(await reject(name, async () => {
      const changed = clone(assessment);
      changed.claims[key] = true;
      await validate(changed);
    }, new RegExp(`prohibited claim ${key}`)));
  }

  vectors.push(await reject('scalar_probability_injection', async () => {
    const changed = clone(assessment);
    changed.scenarios[1].probability = 0.9;
    await validate(changed);
  }, /scalar probability\/score fields/));

  fs.writeFileSync(assessmentPath, JSON.stringify(assessment, null, 2) + '\n');
  console.log(JSON.stringify({
    suite: 'UU-AAP CounterfactualInterventionAssessment v0.1',
    intervention_assessment_id: assessment.intervention_assessment_id,
    status: assessment.assessment_result.status,
    model_relative_sensitivity_status: assessment.assessment_result.model_relative_sensitivity_status,
    necessity_status: assessment.predicate_tests.necessity.status,
    sufficiency_status: assessment.predicate_tests.sufficiency.status,
    exclusivity_status: assessment.predicate_tests.exclusivity.status,
    causal_predicate_qualification_status: assessment.assessment_result.causal_predicate_qualification_status,
    causal_proof_certified: assessment.claims.causal_proof_certified,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
