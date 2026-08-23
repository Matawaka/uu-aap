'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  buildCausalClaimQualification,
  validateCausalClaimQualification
} = require('./qualify-causal-claims.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function runCounterfactualAssessment(outputPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-counterfactual-intervention.js', outputPath
  ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  assert(run.status === 0, `counterfactual prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
}

async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

async function main() {
  const outputPath = process.argv[2] || '/tmp/causal-claim-qualification.json';
  const counterfactualPath = '/tmp/qualification-counterfactual.json';
  runCounterfactualAssessment(counterfactualPath);

  const policy = readJson(path.join(
    repoRoot,
    'protocols/integration/v0.1/policies/exact-local-git-transition.causal-qualification-policy.json'
  ));
  const counterfactualAssessment = readJson(counterfactualPath);
  const causalAssessment = readJson('/tmp/counterfactual-causal-attribution.json');
  const responsibilityTrace = readJson('/tmp/causal-responsibility-trace.json');

  const args = {
    policy,
    counterfactualAssessment,
    causalAssessment,
    responsibilityTrace,
    qualifiedAt: '2026-08-23T08:40:00Z'
  };

  const qualification = await buildCausalClaimQualification(args);
  const decisions = Object.fromEntries(qualification.decisions.map((item) => [item.predicate, item]));

  assert(qualification.qualification_result.status === 'bounded_predicates_qualified_stronger_claims_withheld',
    'qualification result status mismatch');
  assert(qualification.qualification_result.policy_relative === true, 'qualification must be policy-relative');
  assert(qualification.qualification_result.qualified_predicate_count === 2, 'exactly two predicates must qualify');
  assert(qualification.qualification_result.withheld_predicate_count === 5, 'exactly five predicates must be withheld');
  assert(decisions.originating_execution_contributed_to_exact_transition.status === 'qualified' &&
    decisions.originating_execution_contributed_to_exact_transition.establishes_predicate === true,
    'bounded execution contribution must qualify');
  assert(decisions.model_relative_intervention_sensitivity.status === 'qualified' &&
    decisions.model_relative_intervention_sensitivity.establishes_predicate === true,
    'model-relative intervention sensitivity must qualify');
  assert(decisions.necessary_cause.status === 'deferred' && decisions.necessary_cause.establishes_predicate === false,
    'necessity must be deferred');
  assert(decisions.sufficient_cause.status === 'deferred' && decisions.sufficient_cause.establishes_predicate === false,
    'sufficiency must be deferred');
  assert(decisions.exclusive_cause.status === 'deferred' && decisions.exclusive_cause.establishes_predicate === false,
    'exclusivity must be deferred');
  assert(decisions.counterfactual_causal_proof.status === 'not_qualified', 'counterfactual proof must not qualify');
  assert(decisions.generalized_external_consequence_causality.status === 'out_of_scope',
    'generalized external causality must be out of scope');

  const vectors = [];

  vectors.push(await reject('policy_not_yet_effective', async () => {
    await buildCausalClaimQualification({ ...args, qualifiedAt: '2026-08-23T08:38:07Z' });
  }, /policy not yet effective/));

  vectors.push(await reject('policy_id_substitution', async () => {
    const changed = clone(policy);
    changed.policy_id = 'urn:uu-aap:causal-qualification-policy:other:1';
    await buildCausalClaimQualification({ ...args, policy: changed });
  }, /policy ID\/version substitution/));

  vectors.push(await reject('policy_version_substitution', async () => {
    const changed = clone(policy);
    changed.policy_version = 2;
    await buildCausalClaimQualification({ ...args, policy: changed });
  }, /policy ID\/version substitution/));

  vectors.push(await reject('policy_scope_substitution', async () => {
    const changed = clone(policy);
    changed.qualification_scope = 'urn:uu-aap:causal-qualification-scope:other';
    await buildCausalClaimQualification({ ...args, policy: changed });
  }, /policy scope substitution/));

  vectors.push(await reject('policy_predicate_rule_substitution', async () => {
    const changed = clone(policy);
    changed.predicate_rules.necessary_cause.status = 'qualified';
    changed.predicate_rules.necessary_cause.establishes_predicate = true;
    await buildCausalClaimQualification({ ...args, policy: changed });
  }, /policy rule substitution for necessary_cause/));

  vectors.push(await reject('origin_hypothesis_not_supported', async () => {
    const changed = clone(causalAssessment);
    changed.hypotheses.find((h) => h.kind === 'originating_execution_contributed').support_status = 'mixed';
    await buildCausalClaimQualification({ ...args, causalAssessment: changed });
  }, /Counterfactual\/CausalAttribution binding substitution|originating execution hypothesis is not supported/));

  vectors.push(await reject('trace_adjudication_upgrade', async () => {
    const changed = clone(responsibilityTrace);
    changed.responsibility_attribution.status = 'adjudicated';
    await buildCausalClaimQualification({ ...args, responsibilityTrace: changed });
  }, /Counterfactual\/ResponsibilityTrace binding substitution|trace must remain traceable_not_adjudicated/));

  vectors.push(await reject('suppression_sensitivity_removed', async () => {
    const changed = clone(counterfactualAssessment);
    const scenario = changed.scenarios.find((s) => s.kind === 'suppress_originating_execution');
    scenario.relation_status = 'sensitivity_not_supported';
    await buildCausalClaimQualification({ ...args, counterfactualAssessment: changed });
  }, /suppression evidence does not support model-relative sensitivity|predecessor counterfactual result boundary invalid/));

  vectors.push(await reject('alternative_false_resolution', async () => {
    const changed = clone(counterfactualAssessment);
    const scenario = changed.scenarios.find((s) => s.kind === 'alternative_reproduction_mechanism');
    scenario.test_status = 'structurally_evaluated';
    scenario.relation_status = 'sensitivity_not_supported';
    scenario.comparison_result = 'effect_preserved';
    await buildCausalClaimQualification({ ...args, counterfactualAssessment: changed });
  }, /alternative reproduction is not explicitly unresolved|predecessor counterfactual result boundary invalid/));

  vectors.push(await reject('sufficiency_predecessor_upgrade', async () => {
    const changed = clone(counterfactualAssessment);
    changed.predicate_tests.sufficiency.status = 'supported';
    await buildCausalClaimQualification({ ...args, counterfactualAssessment: changed });
  }, /sufficiency predecessor gate invalid/));

  vectors.push(await reject('counterfactual_proof_predecessor_upgrade', async () => {
    const changed = clone(counterfactualAssessment);
    changed.predicate_tests.counterfactual_proof.establishes_proof = true;
    await buildCausalClaimQualification({ ...args, counterfactualAssessment: changed });
  }, /counterfactual proof predecessor gate invalid/));

  vectors.push(await reject('external_model_upgrade', async () => {
    const changed = clone(counterfactualAssessment);
    changed.intervention_model.external_consequence_model_present = true;
    await buildCausalClaimQualification({ ...args, counterfactualAssessment: changed });
  }, /predecessor intervention model boundary invalid/));

  const validate = (value, overrides = {}) => validateCausalClaimQualification({
    qualification: value,
    policy: overrides.policy || policy,
    counterfactualAssessment: overrides.counterfactualAssessment || counterfactualAssessment,
    causalAssessment: overrides.causalAssessment || causalAssessment,
    responsibilityTrace: overrides.responsibilityTrace || responsibilityTrace
  });

  vectors.push(await reject('policy_binding_ref_substitution', async () => {
    const changed = clone(qualification);
    changed.policy_binding.artifact_ref = 'urn:uu-aap:causal-qualification-policy:other:1';
    await validate(changed);
  }, /policy ref\/version\/scope substitution/));

  vectors.push(await reject('policy_binding_digest_substitution', async () => {
    const changed = clone(qualification);
    changed.policy_binding.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /policy digest substitution/));

  vectors.push(await reject('counterfactual_binding_digest_substitution', async () => {
    const changed = clone(qualification);
    changed.predecessor_bindings.counterfactual_intervention.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /counterfactual_intervention digest substitution/));

  vectors.push(await reject('causal_binding_ref_substitution', async () => {
    const changed = clone(qualification);
    changed.predecessor_bindings.causal_attribution.artifact_ref = 'urn:uu-aap:causal-attribution-assessment:other';
    await validate(changed);
  }, /causal_attribution ref substitution/));

  vectors.push(await reject('trace_binding_digest_substitution', async () => {
    const changed = clone(qualification);
    changed.predecessor_bindings.responsibility_trace.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /responsibility_trace digest substitution/));

  vectors.push(await reject('semantic_frontier_drift', async () => {
    const changed = clone(qualification);
    changed.semantic_binding.action = 'other.action';
    await validate(changed);
  }, /semantic frontier drift/));

  vectors.push(await reject('effect_frontier_drift', async () => {
    const changed = clone(qualification);
    changed.effect_under_qualification.tree_sha = '0'.repeat(40);
    await validate(changed);
  }, /effect frontier substitution/));

  vectors.push(await reject('missing_predicate_decision', async () => {
    const changed = clone(qualification);
    changed.decisions.pop();
    await validate(changed);
  }, /exactly seven predicate decisions required/));

  vectors.push(await reject('duplicate_predicate_decision', async () => {
    const changed = clone(qualification);
    changed.decisions[1].predicate = changed.decisions[0].predicate;
    await validate(changed);
  }, /predicate decision set\/order substitution|duplicate predicate decisions/));

  vectors.push(await reject('contribution_decision_status_substitution', async () => {
    const changed = clone(qualification);
    changed.decisions[0].status = 'deferred';
    changed.decisions[0].establishes_predicate = false;
    await validate(changed);
  }, /policy decision derivation substitution/));

  vectors.push(await reject('sensitivity_reason_substitution', async () => {
    const changed = clone(qualification);
    changed.decisions[1].reason_codes = ['invented_reason'];
    await validate(changed);
  }, /policy decision derivation substitution/));

  for (const [name, index] of [
    ['necessary_cause_qualification_overclaim', 2],
    ['sufficient_cause_qualification_overclaim', 3],
    ['exclusive_cause_qualification_overclaim', 4],
    ['counterfactual_proof_qualification_overclaim', 5],
    ['external_causality_qualification_overclaim', 6]
  ]) {
    vectors.push(await reject(name, async () => {
      const changed = clone(qualification);
      changed.decisions[index].status = 'qualified';
      changed.decisions[index].establishes_predicate = true;
      await validate(changed);
    }, /policy decision derivation substitution/));
  }

  for (const key of [
    'necessary_cause_established',
    'sufficient_cause_established',
    'exclusive_cause_established',
    'counterfactual_causal_proof_certified',
    'generalized_external_consequence_causality_established',
    'universal_causal_truth_established',
    'responsibility_for_outcome_adjudicated',
    'legal_responsibility_determined',
    'moral_blame_assigned',
    'truth_certified'
  ]) {
    vectors.push(await reject(`${key}_claim_overclaim`, async () => {
      const changed = clone(qualification);
      changed.claims[key] = true;
      await validate(changed);
    }, new RegExp(`prohibited claim ${key}`)));
  }

  vectors.push(await reject('scalar_probability_injection', async () => {
    const changed = clone(qualification);
    changed.decisions[0].probability = 0.9;
    await validate(changed);
  }, /scalar probability\/score fields/));

  fs.writeFileSync(outputPath, JSON.stringify(qualification, null, 2) + '\n');
  console.log(JSON.stringify({
    suite: 'UU-AAP CausalClaimQualification v0.1',
    qualification_id: qualification.qualification_id,
    policy_id: qualification.policy_binding.artifact_ref,
    qualification_scope: qualification.qualification_result.qualification_scope,
    decisions: qualification.decisions.map((item) => ({
      predicate: item.predicate,
      status: item.status,
      establishes_predicate: item.establishes_predicate
    })),
    universal_causal_truth_established: qualification.claims.universal_causal_truth_established,
    responsibility_for_outcome_adjudicated: qualification.claims.responsibility_for_outcome_adjudicated,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
