'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Runtime = require('./observe-github-actions-runtime.js');
const Ingress = require('./consequence-observation-ingress.js');
const Assessment = require('./assess-consequence-observation.js');
const Adapter = require('./consequence-observation-source-adapter.js');

const repoRoot = path.resolve(__dirname, '../../..');
const assert = (value, message) => { if (!value) throw new Error(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const plusMs = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();

async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (caught) { error = caught; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error ${error.message}`);
  return { name, error: error.message };
}

function runIngressPrerequisite() {
  const result = cp.spawnSync('node', ['protocols/integration/v0.1/test-consequence-observation-ingress.js'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  assert(result.status === 0, `consequence ingress prerequisite failed\n${result.stdout || ''}\n${result.stderr || ''}`);
}

async function main() {
  assert(process.env.GITHUB_ACTIONS === 'true', 'live source-adapter harness requires actual GitHub Actions runtime');
  runIngressPrerequisite();

  const adapterPolicy = readJson(path.join(repoRoot, 'protocols/integration/v0.1/policies/github-actions-runtime.consequence-observation-source-adapter-policy.json'));
  const assessmentPolicy = readJson(path.join(repoRoot, 'protocols/integration/v0.1/policies/reference.consequence-observation-assessment-policy.json'));
  const ingressPolicy = readJson(path.join(repoRoot, 'protocols/integration/v0.1/policies/reference.consequence-observation-ingress-policy.json'));
  const frontierEntry = readJson('/tmp/responsibility-event-successor-ledger-entry-2.json');

  const producerObservation = await Runtime.observeGitHubActionsRuntime();
  const sourceEvidence = await Ingress.buildSourceEvidence({
    producerId: Runtime.PRODUCER_ID,
    producerArtifactType: Runtime.ARTIFACT_TYPE,
    producerArtifactVersion: Runtime.ARTIFACT_VERSION,
    producerArtifactRef: producerObservation.observation_id,
    capturedAt: producerObservation.observed_at,
    observationPresent: true,
    testFixtureOnly: false,
    sourcePayload: producerObservation
  });

  const claimedAt = plusMs(producerObservation.observed_at, 1);
  const receivedAt = plusMs(producerObservation.observed_at, 2);
  const assessedAt = plusMs(producerObservation.observed_at, 3);
  const evaluatedAt = plusMs(producerObservation.observed_at, 4);

  const claim = await Ingress.buildClaim({
    frontierEntry,
    policy: ingressPolicy,
    sourceEvidence,
    environment: 'live',
    claimantDeclaration: 'undisclosed',
    claimantId: null,
    consequenceClass: 'other',
    consequenceSubjectRef: producerObservation.run_ref,
    claimedStatus: 'observed',
    claimedAt,
    observationTime: producerObservation.observed_at,
    evidenceCutoff: producerObservation.observed_at,
    observationMethod: 'system_record',
    evidenceRefs: [producerObservation.observation_id]
  });

  const ingressReceipt = await Ingress.buildIngressReceipt({
    policy: ingressPolicy,
    claim,
    frontierEntry,
    sourceEvidence,
    receivedAt
  });

  const assessment = await Assessment.buildAssessment({
    assessmentPolicy,
    ingressPolicy,
    ingressReceipt,
    claim,
    sourceEvidence,
    frontierEntry,
    assessedAt
  });
  assert(assessment.status === 'deferred_source_profile_required', 'generic assessment must remain deferred');
  assert(assessment.assessment_result.observation_qualified === false, 'generic assessment must remain non-qualifying');
  assert(assessment.assessment_result.successor_adapter_eligible === false, 'generic assessment must remain adapter-ineligible');

  const receipt = await Adapter.buildReceipt({
    adapterPolicy,
    assessmentPolicy,
    ingressPolicy,
    assessment,
    ingressReceipt,
    claim,
    sourceEvidence,
    producerObservation,
    frontierEntry,
    evaluatedAt
  });

  assert(receipt.profile_decision.status === 'eligible_as_typed_successor_source', 'typed successor-source eligibility missing');
  assert(receipt.profile_decision.source_specific_observation_semantics_qualified === true, 'source-specific semantics not qualified');
  assert(receipt.profile_decision.typed_successor_source_eligible === true, 'typed successor source not eligible');
  assert(receipt.profile_decision.successor_append_executed === false, 'adapter must not execute append');
  assert(receipt.profile_decision.successor_append_may_proceed === false, 'adapter must not permit append');
  assert(receipt.claims.new_external_consequence_observed === false, 'adapter must not universalize external consequence');
  assert(receipt.claims.causal_proof_certified === false, 'adapter must not establish causality');
  assert(receipt.claims.responsibility_for_consequence_attributed === false, 'adapter must not attribute responsibility');

  writeJson('/tmp/github-actions-runtime-observation.json', producerObservation);
  writeJson('/tmp/consequence-observation-source-live.json', sourceEvidence);
  writeJson('/tmp/consequence-observation-claim-live.json', claim);
  writeJson('/tmp/consequence-observation-ingress-live.json', ingressReceipt);
  writeJson('/tmp/consequence-observation-assessment-live-deferred.json', assessment);
  writeJson('/tmp/consequence-observation-source-adapter-receipt.json', receipt);

  const args = { adapterPolicy, assessmentPolicy, ingressPolicy, assessment, ingressReceipt, claim, sourceEvidence, producerObservation, frontierEntry };
  const vectors = [];

  vectors.push(await reject('runtime_requires_github_actions', async () => {
    const env = { ...process.env, GITHUB_ACTIONS: 'false' };
    await Runtime.observeGitHubActionsRuntime({ env, eventBytes: Buffer.from('{}') });
  }, /GITHUB_ACTIONS=true required/));
  vectors.push(await reject('runtime_event_payload_digest_substitution', async () => {
    const x = clone(producerObservation); x.event_payload_digest.value = '0'.repeat(64);
    await Runtime.validateRuntimeObservation(x);
  }, /observation ID substitution/));
  vectors.push(await reject('runtime_event_ref_mismatch', async () => {
    const x = clone(producerObservation);
    x.event_name = x.event_name === 'pull_request' ? 'push' : 'pull_request';
    await Runtime.validateRuntimeObservation(x);
  }, /must use PR merge ref|must bind refs\/heads\/main/));
  vectors.push(await reject('runtime_context_class_substitution', async () => {
    const x = clone(producerObservation); x.context_class = x.context_class === 'candidate_pull_request' ? 'main_push' : 'candidate_pull_request';
    await Runtime.validateRuntimeObservation(x);
  }, /context class substitution/));
  vectors.push(await reject('runtime_sha_substitution', async () => {
    const x = clone(producerObservation); x.sha = '0'.repeat(40);
    await Runtime.validateRuntimeObservation(x);
  }, /observation ID substitution/));
  vectors.push(await reject('runtime_run_ref_substitution', async () => {
    const x = clone(producerObservation); x.run_ref = 'urn:github-actions:run:1:attempt:1';
    await Runtime.validateRuntimeObservation(x);
  }, /run ref substitution/));
  vectors.push(await reject('runtime_provider_attestation_overclaim', async () => {
    const x = clone(producerObservation); x.claims.provider_identity_cryptographically_attested = true;
    await Runtime.validateRuntimeObservation(x);
  }, /prohibited claim provider_identity_cryptographically_attested/));
  vectors.push(await reject('runtime_scalar_injection', async () => {
    const x = clone(producerObservation); x.confidence_score = 1;
    await Runtime.validateRuntimeObservation(x);
  }, /scalar fields prohibited/));

  vectors.push(await reject('policy_id_substitution', async () => {
    const p = clone(adapterPolicy); p.policy_id = 'urn:other'; Adapter.validatePolicy(p, evaluatedAt);
  }, /policy ID\/version substitution/));
  vectors.push(await reject('policy_scope_substitution', async () => {
    const p = clone(adapterPolicy); p.adapter_scope = 'urn:other'; Adapter.validatePolicy(p, evaluatedAt);
  }, /policy scope substitution/));
  vectors.push(await reject('policy_profile_repository_substitution', async () => {
    const p = clone(adapterPolicy); p.registered_profile.repository = 'other/repo'; Adapter.validatePolicy(p, evaluatedAt);
  }, /registered producer profile substitution/));
  vectors.push(await reject('policy_append_permission_escalation', async () => {
    const p = clone(adapterPolicy); p.invariants.successor_append_permission_allowed = true; Adapter.validatePolicy(p, evaluatedAt);
  }, /policy invariants weakened/));
  vectors.push(await reject('policy_append_execution_escalation', async () => {
    const p = clone(adapterPolicy); p.invariants.successor_append_execution_allowed = true; Adapter.validatePolicy(p, evaluatedAt);
  }, /policy invariants weakened/));
  vectors.push(await reject('policy_scalar_injection', async () => {
    const p = clone(adapterPolicy); p.probability = 1; Adapter.validatePolicy(p, evaluatedAt);
  }, /scalar fields prohibited/));

  vectors.push(await reject('producer_repository_substitution', async () => {
    const p = clone(producerObservation); p.repository = 'other/repo';
    await Adapter.validateInputs({ ...args, producerObservation: p, evaluatedAt });
  }, /observation ID substitution|repository substitution|source payload \/ producer observation mismatch/));
  vectors.push(await reject('producer_workflow_substitution', async () => {
    const p = clone(producerObservation); p.workflow_name = 'Other workflow';
    await Adapter.validateInputs({ ...args, producerObservation: p, evaluatedAt });
  }, /observation ID substitution|workflow name substitution|source payload \/ producer observation mismatch/));
  vectors.push(await reject('source_fixture_substitution', async () => {
    const s = clone(sourceEvidence); s.test_fixture_only = true;
    await Adapter.validateInputs({ ...args, sourceEvidence: s, evaluatedAt });
  }, /source evidence ID substitution|fixture or non-observed source prohibited/));
  vectors.push(await reject('source_producer_id_substitution', async () => {
    const s = clone(sourceEvidence); s.producer_id = 'urn:other';
    await Adapter.validateInputs({ ...args, sourceEvidence: s, evaluatedAt });
  }, /source evidence ID substitution|source producer identity substitution/));
  vectors.push(await reject('source_payload_mutation', async () => {
    const s = clone(sourceEvidence); s.source_payload.run_id = '1';
    await Adapter.validateInputs({ ...args, sourceEvidence: s, evaluatedAt });
  }, /source payload digest substitution/));
  vectors.push(await reject('claim_environment_fixture', async () => {
    const c = clone(claim); c.environment = 'test_fixture';
    await Adapter.validateInputs({ ...args, claim: c, evaluatedAt });
  }, /claim ID substitution|live observed system-record claim required/));
  vectors.push(await reject('claim_subject_substitution', async () => {
    const c = clone(claim); c.consequence_subject_ref = 'urn:other';
    await Adapter.validateInputs({ ...args, claim: c, evaluatedAt });
  }, /claim ID substitution|consequence subject/));
  vectors.push(await reject('assessment_status_substitution', async () => {
    const a = clone(assessment); a.status = 'not_qualified_no_observation';
    await Adapter.validateInputs({ ...args, assessment: a, evaluatedAt });
  }, /assessment result substitution|predecessor assessment status substitution/));
  vectors.push(await reject('assessment_adapter_eligibility_escalation', async () => {
    const a = clone(assessment); a.assessment_result.successor_adapter_eligible = true;
    await Adapter.validateInputs({ ...args, assessment: a, evaluatedAt });
  }, /assessment result substitution|predecessor assessment boundary substitution/));
  vectors.push(await reject('frontier_head_substitution', async () => {
    const f = clone(frontierEntry); f.resulting_event_head.event_digest.value = '0'.repeat(64);
    await Adapter.validateInputs({ ...args, frontierEntry: f, evaluatedAt });
  }, /frontier embedded event\/head mismatch|frontier/));

  vectors.push(await reject('receipt_policy_binding_substitution', async () => {
    const r = clone(receipt); r.policy_binding.digest.value = '0'.repeat(64);
    await Adapter.validateReceipt({ ...args, receipt: r });
  }, /adapter receipt substitution/));
  vectors.push(await reject('receipt_producer_binding_substitution', async () => {
    const r = clone(receipt); r.producer_observation_binding.digest.value = '0'.repeat(64);
    await Adapter.validateReceipt({ ...args, receipt: r });
  }, /adapter receipt substitution/));
  vectors.push(await reject('receipt_candidate_main_flip', async () => {
    const r = clone(receipt); r.profile_decision.candidate_evidence = !r.profile_decision.candidate_evidence; r.profile_decision.main_bound_evidence = !r.profile_decision.main_bound_evidence;
    await Adapter.validateReceipt({ ...args, receipt: r });
  }, /adapter receipt substitution/));
  vectors.push(await reject('receipt_successor_permission_escalation', async () => {
    const r = clone(receipt); r.profile_decision.successor_append_may_proceed = true;
    await Adapter.validateReceipt({ ...args, receipt: r });
  }, /adapter receipt substitution|cannot execute or permit/));
  vectors.push(await reject('receipt_successor_execution_escalation', async () => {
    const r = clone(receipt); r.profile_decision.successor_append_executed = true;
    await Adapter.validateReceipt({ ...args, receipt: r });
  }, /adapter receipt substitution|cannot execute or permit/));

  for (const [name, key] of [
    ['receipt_github_truth_overclaim', 'github_remote_truth_certified'],
    ['receipt_external_consequence_overclaim', 'new_external_consequence_observed'],
    ['receipt_causal_overclaim', 'causal_proof_certified'],
    ['receipt_responsibility_overclaim', 'responsibility_for_consequence_attributed'],
    ['receipt_legal_overclaim', 'legal_liability_established'],
    ['receipt_moral_overclaim', 'moral_blame_assigned'],
    ['receipt_truth_overclaim', 'truth_certified'],
    ['receipt_poai_overclaim', 'poai_materialization_event_recorded'],
    ['receipt_universal_overclaim', 'universal_canonicality_established']
  ]) {
    vectors.push(await reject(name, async () => {
      const r = clone(receipt); r.claims[key] = true;
      await Adapter.validateReceipt({ ...args, receipt: r });
    }, /adapter receipt substitution|prohibited claim/));
  }
  vectors.push(await reject('receipt_scalar_injection', async () => {
    const r = clone(receipt); r.responsibility_score = 1;
    await Adapter.validateReceipt({ ...args, receipt: r });
  }, /scalar fields prohibited/));

  const summary = {
    suite: 'UU-AAP GitHub Actions source-specific consequence adapter v0.1',
    policy_id: adapterPolicy.policy_id,
    producer_id: producerObservation.producer_id,
    runtime_context_class: producerObservation.context_class,
    event_name: producerObservation.event_name,
    runtime_sha: producerObservation.sha,
    runtime_ref: producerObservation.ref,
    run_id: producerObservation.run_id,
    event_payload_sha256: producerObservation.event_payload_digest.value,
    generic_assessment_status: assessment.status,
    source_specific_observation_semantics_qualified: true,
    typed_successor_source_eligible: true,
    successor_append_may_proceed: false,
    successor_append_executed: false,
    kontur_touched: false,
    negative_vectors: vectors.length
  };
  writeJson('/tmp/consequence-observation-source-adapter-summary.json', summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
