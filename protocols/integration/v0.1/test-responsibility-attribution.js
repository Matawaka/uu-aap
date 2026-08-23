'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const {
  buildResponsibilityAttributionAssessment,
  validateResponsibilityAttributionAssessment
} = require('./assess-responsibility-attribution.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function runCausalQualification(outputPath) {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-causal-claim-qualification.js', outputPath
  ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  assert(run.status === 0, `causal qualification prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
}

async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

async function main() {
  const outputPath = process.argv[2] || '/tmp/responsibility-attribution.json';
  const qualificationPath = '/tmp/responsibility-attribution-qualification.json';
  runCausalQualification(qualificationPath);

  const policy = readJson(path.join(
    repoRoot,
    'protocols/integration/v0.1/policies/exact-local-git-transition.responsibility-attribution-policy.json'
  ));
  const causalQualification = readJson(qualificationPath);
  const responsibilityTrace = readJson('/tmp/causal-responsibility-trace.json');
  const outcomeObservation = readJson('/tmp/causal-outcome-observation.json');

  const args = {
    policy,
    causalQualification,
    responsibilityTrace,
    outcomeObservation,
    assessedAt: '2026-08-23T08:41:00Z'
  };

  const assessment = await buildResponsibilityAttributionAssessment(args);
  const decisions = Object.fromEntries(assessment.decisions.map((item) => [item.predicate, item]));

  assert(assessment.attribution_result.status === 'bounded_responsibility_attribution_supported_stronger_claims_withheld',
    'attribution result status mismatch');
  assert(assessment.attribution_result.policy_relative === true, 'attribution must be policy-relative');
  assert(assessment.attribution_result.attributed_predicate_count === 2, 'exactly two responsibility predicates must be attributed');
  assert(assessment.attribution_result.withheld_predicate_count === 4, 'exactly four responsibility predicates must be withheld');
  assert(decisions.accepted_action_responsibility_applies.status === 'attributed' &&
    decisions.accepted_action_responsibility_applies.establishes_predicate === true,
    'accepted action responsibility must be attributed');
  assert(decisions.exact_transition_responsibility_attribution.status === 'attributed' &&
    decisions.exact_transition_responsibility_attribution.establishes_predicate === true,
    'exact transition responsibility must be attributed');
  assert(decisions.external_consequence_responsibility.status === 'out_of_scope' &&
    decisions.external_consequence_responsibility.establishes_predicate === false,
    'external consequence responsibility must remain out of scope');
  assert(decisions.responsibility_adjudication.status === 'not_adjudicated',
    'responsibility adjudication must remain not adjudicated');
  assert(decisions.legal_liability.status === 'not_adjudicated', 'legal liability must remain not adjudicated');
  assert(decisions.moral_blame.status === 'not_adjudicated', 'moral blame must remain not adjudicated');
  assert(assessment.claims.policy_relative_responsibility_attribution_established === true,
    'bounded policy-relative attribution must be established');
  assert(assessment.claims.responsibility_for_outcome_adjudicated === false &&
    assessment.claims.legal_liability_established === false && assessment.claims.moral_blame_assigned === false,
    'stronger responsibility claims must remain false');

  const vectors = [];

  vectors.push(await reject('policy_not_yet_effective', async () => {
    await buildResponsibilityAttributionAssessment({ ...args, assessedAt: '2026-08-23T08:40:00Z' });
  }, /policy not yet effective/));

  vectors.push(await reject('logical_stage_temporal_inversion', async () => {
    const changedPolicy = clone(policy);
    changedPolicy.effective_from = '2026-08-23T08:39:00Z';
    await buildResponsibilityAttributionAssessment({ ...args, policy: changedPolicy, assessedAt: causalQualification.qualified_at });
  }, /assessment must occur after CausalClaimQualification/));

  vectors.push(await reject('policy_id_substitution', async () => {
    const changed = clone(policy);
    changed.policy_id = 'urn:uu-aap:responsibility-attribution-policy:other:1';
    await buildResponsibilityAttributionAssessment({ ...args, policy: changed });
  }, /policy ID\/version substitution/));

  vectors.push(await reject('policy_version_substitution', async () => {
    const changed = clone(policy);
    changed.policy_version = 2;
    await buildResponsibilityAttributionAssessment({ ...args, policy: changed });
  }, /policy ID\/version substitution/));

  vectors.push(await reject('policy_scope_substitution', async () => {
    const changed = clone(policy);
    changed.attribution_scope = 'urn:uu-aap:responsibility-attribution-scope:other';
    await buildResponsibilityAttributionAssessment({ ...args, policy: changed });
  }, /policy scope substitution/));

  vectors.push(await reject('policy_rule_substitution', async () => {
    const changed = clone(policy);
    changed.predicate_rules.legal_liability.status = 'attributed';
    changed.predicate_rules.legal_liability.establishes_predicate = true;
    await buildResponsibilityAttributionAssessment({ ...args, policy: changed });
  }, /policy rule substitution for legal_liability/));

  vectors.push(await reject('qualified_contribution_downgraded', async () => {
    const changed = clone(causalQualification);
    const contribution = changed.decisions.find((d) => d.predicate === 'originating_execution_contributed_to_exact_transition');
    contribution.status = 'deferred';
    contribution.establishes_predicate = false;
    await buildResponsibilityAttributionAssessment({ ...args, causalQualification: changed });
  }, /originating execution contribution is not qualified/));

  vectors.push(await reject('stronger_causal_predicate_upgrade', async () => {
    const changed = clone(causalQualification);
    const necessary = changed.decisions.find((d) => d.predicate === 'necessary_cause');
    necessary.status = 'qualified';
    necessary.establishes_predicate = true;
    await buildResponsibilityAttributionAssessment({ ...args, causalQualification: changed });
  }, /stronger causal predicate unexpectedly established/));

  vectors.push(await reject('causal_responsibility_overclaim', async () => {
    const changed = clone(causalQualification);
    changed.claims.responsibility_for_outcome_adjudicated = true;
    await buildResponsibilityAttributionAssessment({ ...args, causalQualification: changed });
  }, /prohibited claim responsibility_for_outcome_adjudicated/));

  vectors.push(await reject('trace_adjudication_upgrade', async () => {
    const changed = clone(responsibilityTrace);
    changed.responsibility_attribution.status = 'adjudicated';
    await buildResponsibilityAttributionAssessment({ ...args, responsibilityTrace: changed });
  }, /CausalClaimQualification\/ResponsibilityTrace binding substitution|responsibility trace boundary invalid/));

  vectors.push(await reject('originating_action_removed_from_scope', async () => {
    const changed = clone(responsibilityTrace);
    changed.accepted_responsibility_scope = ['other.action'];
    changed.scope_intersection = ['other.action'];
    await buildResponsibilityAttributionAssessment({ ...args, responsibilityTrace: changed });
  }, /CausalClaimQualification\/ResponsibilityTrace binding substitution|originating action is outside accepted responsibility scope/));

  vectors.push(await reject('scope_intersection_drift', async () => {
    const changed = clone(responsibilityTrace);
    changed.scope_intersection = ['other.action'];
    await buildResponsibilityAttributionAssessment({ ...args, responsibilityTrace: changed });
  }, /CausalClaimQualification\/ResponsibilityTrace binding substitution|responsibility scope intersection drift/));

  vectors.push(await reject('responsible_party_drift', async () => {
    const changed = clone(responsibilityTrace);
    changed.semantic_binding.responsible_party_id = 'urn:ial:party:other';
    await buildResponsibilityAttributionAssessment({ ...args, responsibilityTrace: changed });
  }, /CausalClaimQualification\/ResponsibilityTrace binding substitution|predecessor semantic frontier drift|responsible party drift/));

  vectors.push(await reject('outcome_external_consequence_upgrade', async () => {
    const changed = clone(outcomeObservation);
    changed.claims.external_consequence_observed = true;
    await buildResponsibilityAttributionAssessment({ ...args, outcomeObservation: changed });
  }, /ResponsibilityTrace\/OutcomeObservation binding substitution|outcome observation assurance boundary invalid/));

  const validate = (value, overrides = {}) => validateResponsibilityAttributionAssessment({
    assessment: value,
    policy: overrides.policy || policy,
    causalQualification: overrides.causalQualification || causalQualification,
    responsibilityTrace: overrides.responsibilityTrace || responsibilityTrace,
    outcomeObservation: overrides.outcomeObservation || outcomeObservation
  });

  vectors.push(await reject('policy_binding_ref_substitution', async () => {
    const changed = clone(assessment);
    changed.policy_binding.artifact_ref = 'urn:uu-aap:responsibility-attribution-policy:other:1';
    await validate(changed);
  }, /policy ref\/version\/scope substitution/));

  vectors.push(await reject('policy_binding_digest_substitution', async () => {
    const changed = clone(assessment);
    changed.policy_binding.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /policy digest substitution/));

  vectors.push(await reject('qualification_binding_ref_substitution', async () => {
    const changed = clone(assessment);
    changed.predecessor_bindings.causal_claim_qualification.artifact_ref = 'urn:uu-aap:causal-claim-qualification:other';
    await validate(changed);
  }, /causal_claim_qualification ref substitution/));

  vectors.push(await reject('qualification_binding_digest_substitution', async () => {
    const changed = clone(assessment);
    changed.predecessor_bindings.causal_claim_qualification.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /causal_claim_qualification digest substitution/));

  vectors.push(await reject('trace_binding_digest_substitution', async () => {
    const changed = clone(assessment);
    changed.predecessor_bindings.responsibility_trace.digest.value = '0'.repeat(64);
    await validate(changed);
  }, /responsibility_trace digest substitution/));

  vectors.push(await reject('outcome_binding_ref_substitution', async () => {
    const changed = clone(assessment);
    changed.predecessor_bindings.outcome_observation.artifact_ref = 'urn:uu-aap:outcome-observation:other';
    await validate(changed);
  }, /outcome_observation ref substitution/));

  vectors.push(await reject('semantic_frontier_drift', async () => {
    const changed = clone(assessment);
    changed.semantic_binding.action = 'other.action';
    await validate(changed);
  }, /semantic frontier drift/));

  vectors.push(await reject('effect_frontier_drift', async () => {
    const changed = clone(assessment);
    changed.effect_under_attribution.tree_sha = '0'.repeat(40);
    await validate(changed);
  }, /effect frontier substitution/));

  vectors.push(await reject('responsibility_basis_scope_substitution', async () => {
    const changed = clone(assessment);
    changed.responsibility_basis.accepted_responsibility_scope = ['other.action'];
    await validate(changed);
  }, /responsibility basis substitution/));

  vectors.push(await reject('responsibility_basis_party_substitution', async () => {
    const changed = clone(assessment);
    changed.responsibility_basis.responsible_party_id = 'urn:ial:party:other';
    await validate(changed);
  }, /responsibility basis substitution/));

  vectors.push(await reject('causal_basis_stronger_predicate_substitution', async () => {
    const changed = clone(assessment);
    changed.causal_basis.predicate = 'model_relative_intervention_sensitivity';
    await validate(changed);
  }, /causal basis substitution/));

  vectors.push(await reject('missing_predicate_decision', async () => {
    const changed = clone(assessment);
    changed.decisions.pop();
    await validate(changed);
  }, /exactly six predicate decisions required/));

  vectors.push(await reject('duplicate_predicate_decision', async () => {
    const changed = clone(assessment);
    changed.decisions[1].predicate = changed.decisions[0].predicate;
    await validate(changed);
  }, /predicate decision set\/order substitution|duplicate predicate decisions/));

  vectors.push(await reject('reordered_predicate_decisions', async () => {
    const changed = clone(assessment);
    [changed.decisions[0], changed.decisions[1]] = [changed.decisions[1], changed.decisions[0]];
    await validate(changed);
  }, /predicate decision set\/order substitution/));

  vectors.push(await reject('attributed_decision_status_substitution', async () => {
    const changed = clone(assessment);
    changed.decisions[1].status = 'not_attributed';
    changed.decisions[1].establishes_predicate = false;
    await validate(changed);
  }, /policy decision derivation substitution/));

  vectors.push(await reject('decision_reason_substitution', async () => {
    const changed = clone(assessment);
    changed.decisions[0].reason_codes = ['invented_reason'];
    await validate(changed);
  }, /policy decision derivation substitution/));

  for (const [name, index] of [
    ['external_consequence_attribution_overclaim', 2],
    ['responsibility_adjudication_overclaim', 3],
    ['legal_liability_overclaim', 4],
    ['moral_blame_overclaim', 5]
  ]) {
    vectors.push(await reject(name, async () => {
      const changed = clone(assessment);
      changed.decisions[index].status = 'attributed';
      changed.decisions[index].establishes_predicate = true;
      await validate(changed);
    }, /policy decision derivation substitution/));
  }

  for (const key of [
    'external_consequence_responsibility_established',
    'responsibility_for_outcome_adjudicated',
    'responsibility_adjudication_completed',
    'legal_responsibility_determined',
    'legal_liability_established',
    'moral_blame_assigned',
    'moral_correctness_established',
    'universal_responsibility_established',
    'universal_causality_established',
    'truth_certified'
  ]) {
    vectors.push(await reject(`${key}_claim_overclaim`, async () => {
      const changed = clone(assessment);
      changed.claims[key] = true;
      await validate(changed);
    }, new RegExp(`prohibited claim ${key}`)));
  }

  vectors.push(await reject('scalar_responsibility_score_injection', async () => {
    const changed = clone(assessment);
    changed.responsibility_score = 0.9;
    await validate(changed);
  }, /scalar responsibility\/probability scores/));

  vectors.push(await reject('scalar_probability_injection', async () => {
    const changed = clone(assessment);
    changed.decisions[0].probability = 0.9;
    await validate(changed);
  }, /scalar responsibility\/probability scores/));

  vectors.push(await reject('assessment_timestamp_regression', async () => {
    const changed = clone(assessment);
    changed.assessed_at = causalQualification.qualified_at;
    await validate(changed);
  }, /policy not yet effective|assessment must occur after CausalClaimQualification/));

  fs.writeFileSync(outputPath, JSON.stringify(assessment, null, 2) + '\n');
  console.log(JSON.stringify({
    suite: 'UU-AAP ResponsibilityAttributionAssessment v0.1',
    attribution_id: assessment.attribution_id,
    policy_id: assessment.policy_binding.artifact_ref,
    attribution_scope: assessment.attribution_result.attribution_scope,
    decisions: assessment.decisions.map((item) => ({
      predicate: item.predicate,
      status: item.status,
      establishes_predicate: item.establishes_predicate
    })),
    policy_relative_responsibility_attribution_established: assessment.claims.policy_relative_responsibility_attribution_established,
    responsibility_for_outcome_adjudicated: assessment.claims.responsibility_for_outcome_adjudicated,
    legal_liability_established: assessment.claims.legal_liability_established,
    moral_blame_assigned: assessment.claims.moral_blame_assigned,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
