'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Assessment = require('./assess-consequence-observation.js');
const Adapter = require('./consequence-observation-successor-adapter.js');

const repoRoot = path.resolve(__dirname, '../../..');
const assert = (value, message) => { if (!value) throw new Error(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (caught) { error = caught; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error ${error.message}`);
  return { name, error: error.message };
}
function runIngressPrerequisite() {
  const result = cp.spawnSync('node', ['protocols/integration/v0.1/test-consequence-observation-ingress.js'], {
    cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  assert(result.status === 0, `consequence ingress prerequisite failed\n${result.stdout || ''}\n${result.stderr || ''}`);
}

async function main() {
  runIngressPrerequisite();

  const assessmentPolicy = readJson(path.join(repoRoot, 'protocols/integration/v0.1/policies/reference.consequence-observation-assessment-policy.json'));
  const ingressPolicy = readJson(path.join(repoRoot, 'protocols/integration/v0.1/policies/reference.consequence-observation-ingress-policy.json'));
  const frontier = readJson('/tmp/responsibility-event-successor-ledger-entry-2.json');
  const notYetClaim = readJson('/tmp/consequence-observation-claim-not-yet.json');
  const notYetIngress = readJson('/tmp/consequence-observation-ingress-not-yet.json');
  const fixtureSource = readJson('/tmp/consequence-observation-source-fixture.json');
  const fixtureClaim = readJson('/tmp/consequence-observation-claim-observed-fixture.json');
  const fixtureIngress = readJson('/tmp/consequence-observation-ingress-observed-fixture.json');

  const noObservation = await Assessment.buildAssessment({
    assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim,
    sourceEvidence: null, frontierEntry: frontier, assessedAt: '2026-08-23T08:43:16Z'
  });
  const fixtureAssessment = await Assessment.buildAssessment({
    assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim,
    sourceEvidence: fixtureSource, frontierEntry: frontier, assessedAt: '2026-08-23T08:43:17Z'
  });

  assert(noObservation.status === 'not_qualified_no_observation', 'no-observation assessment status mismatch');
  assert(noObservation.assessment_result.reason === 'no_observation', 'no-observation reason mismatch');
  assert(fixtureAssessment.status === 'not_qualified_test_fixture', 'fixture assessment status mismatch');
  assert(fixtureAssessment.assessment_result.reason === 'test_fixture', 'fixture reason mismatch');
  for (const value of [noObservation, fixtureAssessment]) {
    assert(value.claims.observation_admissibility_assessed === true, 'assessment must establish only bounded assessment fact');
    assert(value.assessment_result.observation_qualified === false, 'v0.1 must not qualify external observation');
    assert(value.assessment_result.source_profile_registered === false, 'v0.1 source profile registry must remain empty');
    assert(value.assessment_result.successor_adapter_eligible === false, 'assessment cannot authorize successor adapter');
    assert(value.assessment_result.successor_append_may_proceed === false, 'assessment cannot authorize successor append');
    assert(value.claims.new_external_consequence_observed === false, 'assessment cannot establish external consequence');
    assert(value.claims.causal_proof_certified === false, 'assessment cannot establish causality');
    assert(value.claims.responsibility_for_consequence_attributed === false, 'assessment cannot attribute responsibility');
  }
  const fixtureProfileGate = fixtureAssessment.gate_decisions.find((item) => item.gate === 'producer_profile_recognized');
  const fixtureSemanticsGate = fixtureAssessment.gate_decisions.find((item) => item.gate === 'source_semantics_profile_satisfied');
  assert(fixtureProfileGate.status === 'out_of_scope' && fixtureProfileGate.establishes_gate === false, 'fixture profile must stay out of live scope');
  assert(fixtureSemanticsGate.status === 'not_qualified' && fixtureSemanticsGate.establishes_gate === false, 'fixture semantic profile must not qualify');

  const adapterDecision = Adapter.evaluateConsequenceSuccessorAdapter({ ingressReceipt: fixtureIngress });
  assert(adapterDecision.decision === 'blocked' && adapterDecision.successor_append_may_proceed === false,
    'existing generic successor adapter must remain blocked after assessment');

  writeJson('/tmp/consequence-observation-assessment-no-observation.json', noObservation);
  writeJson('/tmp/consequence-observation-assessment-fixture.json', fixtureAssessment);

  const vectors = [];
  vectors.push(await reject('policy_id_substitution', async () => {
    const p = clone(assessmentPolicy); p.policy_id = 'urn:other'; Assessment.validatePolicy(p, noObservation.assessed_at);
  }, /policy ID\/version substitution/));
  vectors.push(await reject('policy_scope_substitution', async () => {
    const p = clone(assessmentPolicy); p.assessment_scope = 'urn:other'; Assessment.validatePolicy(p, noObservation.assessed_at);
  }, /policy scope substitution/));
  vectors.push(await reject('policy_gate_rule_substitution', async () => {
    const p = clone(assessmentPolicy); p.gate_rules.observation_present.reason_codes = ['forged']; Assessment.validatePolicy(p, noObservation.assessed_at);
  }, /policy rule substitution/));
  vectors.push(await reject('policy_live_profile_injection', async () => {
    const p = clone(assessmentPolicy); p.registered_live_source_profiles.push({ producer_id: 'urn:forged' }); Assessment.validatePolicy(p, noObservation.assessed_at);
  }, /source profile registry must remain empty/));
  vectors.push(await reject('policy_live_qualification_escalation', async () => {
    const p = clone(assessmentPolicy); p.invariants.live_observation_qualification_allowed = true; Assessment.validatePolicy(p, noObservation.assessed_at);
  }, /policy invariants weakened/));
  vectors.push(await reject('policy_successor_authorization_escalation', async () => {
    const p = clone(assessmentPolicy); p.invariants.successor_adapter_authorization_allowed = true; Assessment.validatePolicy(p, noObservation.assessed_at);
  }, /policy invariants weakened/));
  vectors.push(await reject('policy_scalar_injection', async () => {
    const p = clone(assessmentPolicy); p.confidence_score = 1; Assessment.validatePolicy(p, noObservation.assessed_at);
  }, /scalar fields prohibited/));

  vectors.push(await reject('assessment_policy_binding_substitution', async () => {
    const x = clone(noObservation); x.policy_binding.digest.value = '0'.repeat(64);
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /assessment policy binding substitution/));
  vectors.push(await reject('ingress_policy_binding_substitution', async () => {
    const x = clone(noObservation); x.ingress_policy_binding.digest.value = '0'.repeat(64);
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /ingress policy binding substitution/));
  vectors.push(await reject('ingress_receipt_binding_substitution', async () => {
    const x = clone(noObservation); x.ingress_receipt_binding.digest.value = '0'.repeat(64);
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /ingress receipt binding substitution/));
  vectors.push(await reject('claim_binding_substitution', async () => {
    const x = clone(noObservation); x.claim_binding.digest.value = '0'.repeat(64);
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /claim binding substitution/));
  vectors.push(await reject('source_binding_substitution', async () => {
    const x = clone(fixtureAssessment); x.source_evidence_binding.digest.value = '0'.repeat(64);
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /source evidence binding substitution/));
  vectors.push(await reject('frontier_entry_binding_substitution', async () => {
    const x = clone(noObservation); x.frontier_entry_binding.digest.value = '0'.repeat(64);
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /frontier entry binding substitution/));
  vectors.push(await reject('assessment_head_substitution', async () => {
    const x = clone(noObservation); x.responsibility_event_head.event_digest.value = '0'.repeat(64);
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /event head substitution/));
  vectors.push(await reject('assessment_semantic_frontier_substitution', async () => {
    const x = clone(noObservation); x.semantic_frontier = { forged: true };
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /semantic frontier substitution/));
  vectors.push(await reject('assessment_effect_frontier_substitution', async () => {
    const x = clone(noObservation); x.effect_frontier = { forged: true };
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /effect frontier substitution/));
  vectors.push(await reject('assessment_gate_decision_substitution', async () => {
    const x = clone(fixtureAssessment); x.gate_decisions[2].status = 'qualified'; x.gate_decisions[2].establishes_gate = true;
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /gate decisions substitution/));
  vectors.push(await reject('assessment_status_substitution', async () => {
    const x = clone(fixtureAssessment); x.status = 'deferred_source_profile_required';
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /assessment result substitution/));
  vectors.push(await reject('assessment_observation_qualification_escalation', async () => {
    const x = clone(fixtureAssessment); x.assessment_result.observation_qualified = true;
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /assessment result substitution|cannot qualify live observation/));
  vectors.push(await reject('assessment_source_profile_forgery', async () => {
    const x = clone(fixtureAssessment); x.assessment_result.source_profile_registered = true;
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /assessment result substitution|cannot qualify live observation/));
  vectors.push(await reject('assessment_successor_adapter_escalation', async () => {
    const x = clone(fixtureAssessment); x.assessment_result.successor_adapter_eligible = true;
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /assessment result substitution|cannot qualify live observation/));
  vectors.push(await reject('assessment_successor_append_escalation', async () => {
    const x = clone(fixtureAssessment); x.assessment_result.successor_append_may_proceed = true;
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /assessment result substitution|cannot qualify live observation/));
  vectors.push(await reject('assessment_before_ingress', async () => {
    const x = clone(noObservation); x.assessed_at = '2026-08-23T08:43:00Z';
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /assessment before ingress receipt|policy not yet effective/));
  vectors.push(await reject('assessment_id_substitution', async () => {
    const x = clone(noObservation); x.assessment_id = `urn:uu-aap:consequence-observation-assessment:${'0'.repeat(24)}`;
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /assessment ID substitution/));

  vectors.push(await reject('source_payload_mutation', async () => {
    const source = clone(fixtureSource); source.source_payload.machine_state = 'mutated';
    await Assessment.validateAssessment({ assessment: fixtureAssessment, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: source, frontierEntry: frontier });
  }, /source payload digest substitution/));
  vectors.push(await reject('source_observation_removed', async () => {
    const source = clone(fixtureSource); source.observation_present = false;
    await Assessment.validateAssessment({ assessment: fixtureAssessment, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: source, frontierEntry: frontier });
  }, /source evidence ID substitution|observed claim requires source observation_present/));
  vectors.push(await reject('fixture_relabelled_live', async () => {
    const claim = clone(fixtureClaim); claim.environment = 'live';
    await Assessment.validateAssessment({ assessment: fixtureAssessment, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim, sourceEvidence: fixtureSource, frontierEntry: frontier });
  }, /live observed claim cannot use fixture source|claim ID substitution|claim binding substitution/));
  vectors.push(await reject('observation_horizon_inversion', async () => {
    const claim = clone(notYetClaim); claim.evidence_cutoff = '2026-08-23T08:44:00Z';
    await Assessment.validateAssessment({ assessment: noObservation, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim, sourceEvidence: null, frontierEntry: frontier });
  }, /evidence cutoff after claimed_at|observation horizon inversion/));

  for (const [name, key] of [
    ['external_consequence_overclaim', 'new_external_consequence_observed'],
    ['causal_overclaim', 'causal_proof_certified'],
    ['responsibility_overclaim', 'responsibility_for_consequence_attributed'],
    ['legal_overclaim', 'legal_liability_established'],
    ['moral_overclaim', 'moral_blame_assigned'],
    ['truth_overclaim', 'truth_certified'],
    ['successor_authorization_overclaim', 'successor_adapter_authorized']
  ]) {
    vectors.push(await reject(name, async () => {
      const x = clone(fixtureAssessment); x.claims[key] = true;
      await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: fixtureIngress, claim: fixtureClaim, sourceEvidence: fixtureSource, frontierEntry: frontier });
    }, new RegExp(`prohibited claim ${key}`)));
  }
  vectors.push(await reject('assessment_scalar_injection', async () => {
    const x = clone(noObservation); x.probability = 0.5;
    await Assessment.validateAssessment({ assessment: x, assessmentPolicy, ingressPolicy, ingressReceipt: notYetIngress, claim: notYetClaim, sourceEvidence: null, frontierEntry: frontier });
  }, /scalar fields prohibited/));
  vectors.push(await reject('generic_successor_adapter_still_blocked', async () => {
    Adapter.assertConsequenceSuccessorAppendMayProceed({ ingressReceipt: fixtureIngress });
  }, /source-specific adapter not registered/));

  console.log(JSON.stringify({
    suite: 'UU-AAP ConsequenceObservationAssessment v0.1',
    frontier_sequence: frontier.resulting_event_head.sequence,
    assessments_built: 2,
    no_observation_status: noObservation.status,
    fixture_status: fixtureAssessment.status,
    registered_live_source_profiles: assessmentPolicy.registered_live_source_profiles.length,
    live_observation_qualified: false,
    successor_adapter_eligible: false,
    successor_append_may_proceed: false,
    kontur_touched: false,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
