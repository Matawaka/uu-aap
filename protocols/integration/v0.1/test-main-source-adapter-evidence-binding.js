'use strict';

const fs = require('fs');
const path = require('path');
const Binder = require('./bind-main-source-adapter-evidence.js');

const repoRoot = path.resolve(__dirname, '../../..');
const assert = (v, m) => { if (!v) throw new Error(m); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);

async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (caught) { error = caught; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error ${error.message}`);
  return { name, error: error.message };
}

async function main() {
  const [evidenceDir, runMetadataPath, artifactMetadataPath, expectedSha, outputDir] = process.argv.slice(2);
  assert(evidenceDir && runMetadataPath && artifactMetadataPath && expectedSha && outputDir,
    'usage: node test-main-source-adapter-evidence-binding.js <evidence-dir> <run-json> <artifact-json> <expected-sha> <output-dir>');
  fs.mkdirSync(outputDir, { recursive: true });

  const policy = readJson(path.join(repoRoot, 'protocols/integration/v0.1/policies/github-actions-main.consequence-observation-source-adapter-main-binding-policy.json'));
  const adapterPolicy = readJson(path.join(repoRoot, 'protocols/integration/v0.1/policies/github-actions-runtime.consequence-observation-source-adapter-policy.json'));
  const sourceRun = readJson(runMetadataPath);
  const sourceArtifact = readJson(artifactMetadataPath);
  const bundle = Binder.readBundle(evidenceDir);
  const evaluatedAt = new Date().toISOString();

  const args = { policy, adapterPolicy, bundle, sourceRun, sourceArtifact, expectedSha, evaluatedAt, env: process.env };
  const receipt = await Binder.buildReceipt(args);

  assert(receipt.expected_source_revision === expectedSha, 'source revision binding missing');
  assert(receipt.runtime_context.context_class === 'main_push', 'source evidence must be main_push');
  assert(receipt.runtime_context.sha === expectedSha && receipt.runtime_context.ref === 'refs/heads/main', 'source main binding mismatch');
  assert(receipt.decision.status === 'verified_main_bound_source_adapter_evidence', 'main-binding status missing');
  assert(receipt.decision.exact_push_run_verified === true, 'push run not verified');
  assert(receipt.decision.exact_artifact_verified === true, 'artifact not verified');
  assert(receipt.decision.bundle_integrity_verified === true, 'bundle integrity not verified');
  assert(receipt.decision.historical_frontier_binding_consistency_verified === true, 'historical frontier binding consistency missing');
  assert(receipt.decision.historical_frontier_bytes_reverified === false, 'historical frontier bytes must not be claimed reverified');
  assert(receipt.historical_frontier_binding.digest.value === bundle.adapter_receipt.frontier_entry_binding.digest.value, 'historical frontier binding not preserved');
  assert(receipt.decision.main_bound_source_evidence_verified === true, 'main-bound source evidence not verified');
  assert(receipt.decision.source_may_be_presented_to_future_successor_policy === true, 'future successor presentation boundary missing');
  assert(receipt.decision.successor_append_may_proceed === false && receipt.decision.successor_append_executed === false, 'binding layer must not append');
  assert(policy.invariants.server_runtime_dependency_required === false, 'server runtime must not gate main-binding layer');
  assert(policy.invariants.historical_frontier_bytes_reverification_required === false, 'policy must not require unavailable historical bytes');
  assert(receipt.claims.causal_proof_certified === false && receipt.claims.responsibility_for_consequence_attributed === false, 'causal/responsibility overclaim');

  await Binder.validateReceipt({ ...args, receipt });
  writeJson(path.join(outputDir, 'consequence-observation-source-adapter-main-binding-receipt.json'), receipt);

  const vectors = [];
  vectors.push(await reject('source_run_sha_substitution', async () => {
    const x = clone(sourceRun); x.head_sha = '0'.repeat(40);
    await Binder.buildReceipt({ ...args, sourceRun: x });
  }, /source workflow SHA substitution/));
  vectors.push(await reject('source_run_event_substitution', async () => {
    const x = clone(sourceRun); x.event = 'pull_request';
    await Binder.buildReceipt({ ...args, sourceRun: x });
  }, /source workflow event must be push/));
  vectors.push(await reject('source_run_branch_substitution', async () => {
    const x = clone(sourceRun); x.head_branch = 'other';
    await Binder.buildReceipt({ ...args, sourceRun: x });
  }, /source workflow branch must be main/));
  vectors.push(await reject('source_run_failure_substitution', async () => {
    const x = clone(sourceRun); x.conclusion = 'failure';
    await Binder.buildReceipt({ ...args, sourceRun: x });
  }, /completed\/success/));
  vectors.push(await reject('artifact_name_revision_substitution', async () => {
    const x = clone(sourceArtifact); x.name = 'consequence-source-adapter-' + '0'.repeat(40);
    await Binder.buildReceipt({ ...args, sourceArtifact: x });
  }, /artifact name\/revision substitution/));
  vectors.push(await reject('artifact_expired', async () => {
    const x = clone(sourceArtifact); x.expired = true;
    await Binder.buildReceipt({ ...args, sourceArtifact: x });
  }, /artifact expired/));
  vectors.push(await reject('runtime_candidate_substitution', async () => {
    const b = clone(bundle); b.runtime_observation.context_class = 'candidate_pull_request';
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /runtime observation is not main push/));
  vectors.push(await reject('runtime_ref_substitution', async () => {
    const b = clone(bundle); b.runtime_observation.ref = 'refs/heads/other';
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /runtime observation main revision\/ref substitution/));
  vectors.push(await reject('runtime_run_id_substitution', async () => {
    const b = clone(bundle); b.runtime_observation.run_id = '1';
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /runtime observation\/source run ID mismatch/));
  vectors.push(await reject('assessment_status_escalation', async () => {
    const b = clone(bundle); b.assessment.status = 'qualified_observation';
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /historical status drift/));
  vectors.push(await reject('assessment_adapter_eligibility_escalation', async () => {
    const b = clone(bundle); b.assessment.assessment_result.successor_adapter_eligible = true;
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /successor eligibility escalation/));
  vectors.push(await reject('adapter_candidate_flip', async () => {
    const b = clone(bundle); b.adapter_receipt.profile_decision.candidate_evidence = true; b.adapter_receipt.profile_decision.main_bound_evidence = false;
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /adapter receipt is not main-bound/));
  vectors.push(await reject('adapter_append_permission_escalation', async () => {
    const b = clone(bundle); b.adapter_receipt.profile_decision.successor_append_may_proceed = true;
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /cannot permit or execute append/));
  vectors.push(await reject('adapter_policy_binding_substitution', async () => {
    const b = clone(bundle); b.adapter_receipt.policy_binding.digest.value = '0'.repeat(64);
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /adapter policy digest binding substitution/));
  vectors.push(await reject('historical_frontier_binding_substitution', async () => {
    const b = clone(bundle); b.adapter_receipt.frontier_entry_binding.digest.value = '0'.repeat(64);
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /historical frontier binding inconsistency/));
  vectors.push(await reject('historical_event_head_substitution', async () => {
    const b = clone(bundle); b.adapter_receipt.responsibility_event_head.event_digest.value = '0'.repeat(64);
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /responsibility_event_head claim\/adapter inconsistency/));
  vectors.push(await reject('historical_semantic_frontier_substitution', async () => {
    const b = clone(bundle); b.ingress_receipt.semantic_frontier.target = 'github:other/repo';
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /semantic_frontier claim\/ingress inconsistency/));
  vectors.push(await reject('historical_effect_frontier_substitution', async () => {
    const b = clone(bundle); b.assessment.effect_frontier.commit_sha = '0'.repeat(40);
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /effect_frontier claim\/assessment inconsistency/));
  vectors.push(await reject('source_payload_substitution', async () => {
    const b = clone(bundle); b.source_evidence.source_payload.run_id = '1';
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /source evidence digest binding substitution|source wrapper\/runtime payload mismatch/));
  vectors.push(await reject('summary_append_escalation', async () => {
    const b = clone(bundle); b.summary.successor_append_may_proceed = true;
    await Binder.buildReceipt({ ...args, bundle: b });
  }, /summary append escalation/));
  vectors.push(await reject('policy_server_dependency_escalation', async () => {
    const p = clone(policy); p.invariants.server_runtime_dependency_required = true;
    await Binder.buildReceipt({ ...args, policy: p });
  }, /server runtime dependency escalation/));
  vectors.push(await reject('policy_historical_byte_reverification_escalation', async () => {
    const p = clone(policy); p.invariants.historical_frontier_bytes_reverification_required = true;
    await Binder.buildReceipt({ ...args, policy: p });
  }, /historical frontier byte-reverification overclaim/));
  vectors.push(await reject('policy_append_permission_escalation', async () => {
    const p = clone(policy); p.invariants.successor_append_permission_allowed = true;
    await Binder.buildReceipt({ ...args, policy: p });
  }, /policy append permission escalation/));
  vectors.push(await reject('policy_causal_overclaim', async () => {
    const p = clone(policy); p.claims.causal_proof_certified = true;
    await Binder.buildReceipt({ ...args, policy: p });
  }, /policy prohibited claim causal_proof_certified/));
  vectors.push(await reject('policy_scalar_injection', async () => {
    const p = clone(policy); p.confidence_score = 1;
    await Binder.buildReceipt({ ...args, policy: p });
  }, /scalar fields prohibited/));
  vectors.push(await reject('receipt_append_permission_escalation', async () => {
    const r = clone(receipt); r.decision.successor_append_may_proceed = true;
    await Binder.validateReceipt({ ...args, receipt: r });
  }, /binding receipt substitution/));
  vectors.push(await reject('receipt_historical_bytes_overclaim', async () => {
    const r = clone(receipt); r.decision.historical_frontier_bytes_reverified = true;
    await Binder.validateReceipt({ ...args, receipt: r });
  }, /binding receipt substitution/));
  vectors.push(await reject('receipt_causal_overclaim', async () => {
    const r = clone(receipt); r.claims.causal_proof_certified = true;
    await Binder.validateReceipt({ ...args, receipt: r });
  }, /binding receipt substitution/));
  vectors.push(await reject('receipt_truth_overclaim', async () => {
    const r = clone(receipt); r.claims.truth_certified = true;
    await Binder.validateReceipt({ ...args, receipt: r });
  }, /binding receipt substitution/));
  vectors.push(await reject('receipt_scalar_injection', async () => {
    const r = clone(receipt); r.responsibility_score = 1;
    await Binder.validateReceipt({ ...args, receipt: r });
  }, /scalar fields prohibited|binding receipt substitution/));

  const summary = {
    suite: 'UU-AAP main-bound source-adapter evidence binding v0.1',
    expected_source_revision: expectedSha,
    source_run_id: receipt.source_workflow_run.run_id,
    source_artifact_id: receipt.source_artifact.artifact_id,
    source_artifact_name: receipt.source_artifact.name,
    source_runtime_context_class: receipt.runtime_context.context_class,
    source_runtime_ref: receipt.runtime_context.ref,
    evaluator_context_class: receipt.evaluator_context.context_class,
    historical_frontier_ref: receipt.historical_frontier_binding.artifact_ref,
    historical_frontier_digest: receipt.historical_frontier_binding.digest.value,
    historical_frontier_binding_consistency_verified: true,
    historical_frontier_bytes_reverified: false,
    exact_push_run_verified: true,
    exact_artifact_verified: true,
    bundle_integrity_verified: true,
    main_bound_source_evidence_verified: true,
    source_may_be_presented_to_future_successor_policy: true,
    successor_append_may_proceed: false,
    successor_append_executed: false,
    server_runtime_dependency_required: false,
    negative_vectors: vectors.length
  };
  writeJson(path.join(outputDir, 'consequence-observation-source-adapter-main-binding-summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
