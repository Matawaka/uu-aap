'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { completeProvenance, digestJson } = require('./complete-provenance.js');

const repoRoot = path.resolve(__dirname, '../../..');
const preload = path.resolve(__dirname, 'origin-capture-preload.js');

function assert(condition, message) { if (!condition) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

function runBoundedClosure(paths) {
  const env = {
    ...process.env,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --require=${preload}`.trim(),
    UU_AAP_CONTEXT_FRAME_PATH: paths.contextFrame,
    UU_AAP_INTENT_ARTIFACT_PATH: paths.intent,
    UU_AAP_ORIGIN_ENVELOPE_PATH: paths.originEnvelope,
    UU_AAP_EVIDENCE_BUNDLE_PATH: paths.evidenceBundle
  };
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-provenance-closure.js',
    paths.closure,
    paths.canonicalization,
    paths.observation,
    paths.commit,
    paths.decision,
    paths.decisionInput,
    paths.revalidation
  ], { cwd: repoRoot, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  assert(run.status === 0, `bounded provenance prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
  for (const required of [paths.contextFrame, paths.intent, paths.originEnvelope, paths.evidenceBundle]) {
    assert(fs.existsSync(required), `origin capture missing ${required}`);
  }
}

async function expectReject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

async function main() {
  const completionPath = process.argv[2] || '/tmp/provenance-completion.json';
  const paths = {
    closure: '/tmp/origin-bounded-closure.json',
    canonicalization: '/tmp/origin-canonicalization.json',
    observation: '/tmp/origin-observation.json',
    commit: '/tmp/origin-commit.json',
    decision: '/tmp/origin-decision.json',
    decisionInput: '/tmp/origin-decision-input.json',
    revalidation: '/tmp/origin-revalidation.json',
    contextFrame: '/tmp/origin-context-frame.json',
    intent: '/tmp/origin-intent.json',
    originEnvelope: '/tmp/origin-envelope.json',
    evidenceBundle: '/tmp/origin-evidence-bundle.json'
  };

  runBoundedClosure(paths);

  const args = {
    boundedClosure: readJson(paths.closure),
    contextFrame: readJson(paths.contextFrame),
    intentArtifact: readJson(paths.intent),
    originEnvelope: readJson(paths.originEnvelope),
    evidenceBundle: readJson(paths.evidenceBundle),
    commitDecisionInput: readJson(paths.decisionInput),
    commitDecision: readJson(paths.decision),
    canonicalizationReceipt: readJson(paths.canonicalization),
    completedAt: '2026-08-23T08:10:00Z'
  };

  const completion = await completeProvenance(args);
  assert(completion.claims.bounded_chain_preserved === true, 'bounded closure must be preserved');
  assert(completion.claims.context_frame_provenance_established === true, 'ContextFrame provenance missing');
  assert(completion.claims.intent_provenance_established === true, 'Intent provenance missing');
  assert(completion.claims.all_upstream_evidence_artifact_bytes_bound === true, 'upstream bytes must be bound');
  assert(completion.claims.machine_semantic_origin_provenance_complete === true, 'machine semantic-origin provenance must complete');
  assert(completion.claims.human_cognitive_origin_provenance_established === false, 'human cognitive origin must remain unclaimed');
  assert(completion.claims.policy_relative_canonicality_preserved === true, 'policy-relative canonicality must be preserved');
  assert(completion.origin_bindings.length === 3, 'expected ContextFrame, Intent, Operation origin bindings');
  assert(completion.upstream_evidence_bindings.length === 6, 'expected six exact-byte upstream evidence bindings');
  assert(completion.origin_bindings[0].artifact_type === 'ContextFrame', 'ContextFrame binding order mismatch');
  assert(completion.origin_bindings[1].artifact_type === 'IntentArtifact', 'Intent binding order mismatch');
  assert(completion.origin_bindings[2].artifact_type === 'CCRPOperationIntent', 'Operation binding order mismatch');

  const expectedDecisionInputDigest = await digestJson(args.commitDecisionInput);
  const expectedDecisionDigest = await digestJson(args.commitDecision);
  assert(args.evidenceBundle.decision_input_digest.value === expectedDecisionInputDigest,
    'capture must bind exact DecisionInput bytes from same execution');
  assert(args.evidenceBundle.decision_result_digest.value === expectedDecisionDigest,
    'capture must bind exact DecisionResult bytes from same execution');

  for (const key of [
    'remote_branch_or_ref_canonicality_established', 'poai_materialization_event_recorded',
    'poai_successor_record_identity_inferred', 'universal_canonicality_established', 'truth_certified',
    'causal_proof_certified', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_correctness_established', 'poai_v_conformance_established'
  ]) assert(completion.claims[key] === false, `completion must keep ${key}=false`);

  const vectors = [];
  const fresh = () => clone(args);

  vectors.push(await expectReject('context_source_digest_substitution', async () => {
    const a = fresh();
    a.contextFrame.source_contexts[0].digest.value = '0'.repeat(64);
    await completeProvenance(a);
  }, /OriginEnvelope ContextFrame binding mismatch/));

  vectors.push(await expectReject('intent_context_ref_substitution', async () => {
    const a = fresh();
    a.intentArtifact.context_frame_ref = 'urn:uu-aap:context-frame:other';
    await completeProvenance(a);
  }, /Intent\/ContextFrame ref substitution/));

  vectors.push(await expectReject('intent_action_substitution', async () => {
    const a = fresh();
    a.intentArtifact.action = 'other.action';
    await completeProvenance(a);
  }, /Intent\/operation semantic substitution/));

  vectors.push(await expectReject('intent_base_revision_substitution', async () => {
    const a = fresh();
    a.intentArtifact.base_revision = `git:${'0'.repeat(40)}`;
    await completeProvenance(a);
  }, /Intent\/operation semantic substitution/));

  vectors.push(await expectReject('origin_operation_digest_substitution', async () => {
    const a = fresh();
    a.originEnvelope.operation_binding.digest.value = '0'.repeat(64);
    await completeProvenance(a);
  }, /OriginEnvelope operation binding mismatch/));

  vectors.push(await expectReject('bundle_decision_input_digest_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.decision_input_digest.value = '0'.repeat(64);
    await completeProvenance(a);
  }, /DecisionInput digest mismatch/));

  vectors.push(await expectReject('bundle_decision_result_digest_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.decision_result_digest.value = '0'.repeat(64);
    await completeProvenance(a);
  }, /DecisionResult digest mismatch/));

  vectors.push(await expectReject('handoff_offer_ref_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.upstream.handoff_offer.artifact_ref = 'urn:ial:responsibility-handoff-offer:other';
    await completeProvenance(a);
  }, /handoff_offer ref substitution/));

  vectors.push(await expectReject('handoff_acceptance_digest_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.upstream.handoff_acceptance.digest.value = '0'.repeat(64);
    await completeProvenance(a);
  }, /handoff_acceptance digest substitution/));

  vectors.push(await expectReject('handoff_intent_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.upstream.handoff_offer.artifact.effect_ref.intent_id = 'urn:ial:intent:other';
    a.evidenceBundle.upstream.handoff_offer.digest.value = await digestJson(a.evidenceBundle.upstream.handoff_offer.artifact);
    await completeProvenance(a);
  }, /handoff offer does not bind origin intent/));

  vectors.push(await expectReject('authority_scope_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.upstream.authority_verification.artifact.required_scope = 'other.scope';
    a.evidenceBundle.upstream.authority_verification.digest.value = await digestJson(a.evidenceBundle.upstream.authority_verification.artifact);
    await completeProvenance(a);
  }, /authority semantic mismatch/));

  vectors.push(await expectReject('admission_operation_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.upstream.execution_admission.artifact.operation_ref = 'urn:ccrp:operation:other';
    a.evidenceBundle.upstream.execution_admission.digest.value = await digestJson(a.evidenceBundle.upstream.execution_admission.artifact);
    await completeProvenance(a);
  }, /execution admission semantic mismatch/));

  vectors.push(await expectReject('pre_materialization_action_substitution', async () => {
    const a = fresh();
    a.evidenceBundle.upstream.pre_materialization.artifact.requested_action = 'other.action';
    a.evidenceBundle.upstream.pre_materialization.digest.value = await digestJson(a.evidenceBundle.upstream.pre_materialization.artifact);
    await completeProvenance(a);
  }, /pre-materialization semantic mismatch/));

  vectors.push(await expectReject('bounded_evidence_frontier_substitution', async () => {
    const a = fresh();
    a.boundedClosure.evidence_frontier.handoff_result_ref = 'urn:ial:boundary-assessment:other';
    await completeProvenance(a);
  }, /bounded closure evidence frontier mismatch/));

  vectors.push(await expectReject('canonicality_removed', async () => {
    const a = fresh();
    a.canonicalizationReceipt.claims.policy_relative_canonicality_established = false;
    await completeProvenance(a);
  }, /policy-relative canonicality must already be established/));

  vectors.push(await expectReject('remote_canonicality_overclaim', async () => {
    const a = fresh();
    a.canonicalizationReceipt.claims.remote_branch_or_ref_canonicality_established = true;
    await completeProvenance(a);
  }, /prohibited claim remote_branch_or_ref_canonicality_established/));

  vectors.push(await expectReject('truth_overclaim', async () => {
    const a = fresh();
    a.canonicalizationReceipt.claims.truth_certified = true;
    await completeProvenance(a);
  }, /prohibited claim truth_certified/));

  fs.writeFileSync(completionPath, JSON.stringify(completion, null, 2) + '\n');
  console.log(JSON.stringify({
    suite: 'UU-AAP semantic-origin provenance completion v0.1',
    completion_id: completion.completion_id,
    machine_semantic_origin_provenance_complete: completion.claims.machine_semantic_origin_provenance_complete,
    all_upstream_evidence_artifact_bytes_bound: completion.claims.all_upstream_evidence_artifact_bytes_bound,
    human_cognitive_origin_provenance_established: completion.claims.human_cognitive_origin_provenance_established,
    policy_relative_canonicality_preserved: completion.claims.policy_relative_canonicality_preserved,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
