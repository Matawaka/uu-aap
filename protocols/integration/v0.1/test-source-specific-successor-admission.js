'use strict';

const fs = require('fs');
const path = require('path');
const Admission = require('./admit-main-bound-consequence-source.js');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function assert(v, m) { if (!v) throw new Error(`SourceSpecificSuccessorAdmissionTest: ${m}`); }
async function reject(label, fn) {
  try { await fn(); }
  catch (error) { console.log(`REJECTED ${label}: ${error.message}`); return 1; }
  throw new Error(`SourceSpecificSuccessorAdmissionTest: negative vector accepted: ${label}`);
}

async function main() {
  const bundleDir = process.argv[2];
  const runPath = process.argv[3];
  const artifactPath = process.argv[4];
  const outDir = process.argv[5] || '/tmp/source-specific-successor-admission';
  assert(bundleDir && runPath && artifactPath, 'usage: test <main-binding-bundle-dir> <upstream-run.json> <upstream-artifact.json> [out-dir]');

  const root = __dirname;
  const policy = readJson(path.join(root, 'policies', 'github-actions-main-bound.source-specific-successor-admission-policy.json'));
  const mainBindingReceipt = readJson(path.join(bundleDir, 'consequence-observation-source-adapter-main-binding-receipt.json'));
  const upstreamRun = readJson(runPath);
  const upstreamArtifact = readJson(artifactPath);

  const receipt = await Admission.buildReceipt({ policy, mainBindingReceipt, upstreamRun, upstreamArtifact, env: process.env });
  await Admission.verifyReceipt({ receipt, policy, mainBindingReceipt, upstreamRun, upstreamArtifact });
  assert(receipt.main_binding_receipt_binding.digest.value === await Admission.digestOf(mainBindingReceipt), 'input digest mismatch');
  assert(receipt.decision.successor_adapter_registered === false, 'adapter registered unexpectedly');
  assert(receipt.decision.successor_policy_modified === false, 'successor policy modified unexpectedly');
  assert(receipt.decision.successor_append_may_proceed === false, 'append permitted unexpectedly');
  assert(receipt.decision.successor_append_executed === false, 'append executed unexpectedly');

  let negative = 0;
  const badInput = async (label, mutator) => {
    const v = clone(mainBindingReceipt); mutator(v);
    negative += await reject(label, () => Admission.buildReceipt({ policy, mainBindingReceipt: v, upstreamRun, upstreamArtifact, env: process.env }));
  };
  const badPolicy = async (label, mutator) => {
    const v = clone(policy); mutator(v);
    negative += await reject(label, () => Admission.buildReceipt({ policy: v, mainBindingReceipt, upstreamRun, upstreamArtifact, env: process.env }));
  };
  const badRun = async (label, mutator) => {
    const v = clone(upstreamRun); mutator(v);
    negative += await reject(label, () => Admission.buildReceipt({ policy, mainBindingReceipt, upstreamRun: v, upstreamArtifact, env: process.env }));
  };
  const badArtifact = async (label, mutator) => {
    const v = clone(upstreamArtifact); mutator(v);
    negative += await reject(label, () => Admission.buildReceipt({ policy, mainBindingReceipt, upstreamRun, upstreamArtifact: v, env: process.env }));
  };
  const badReceipt = async (label, mutator) => {
    const v = clone(receipt); mutator(v);
    negative += await reject(label, () => Admission.verifyReceipt({ receipt: v, policy, mainBindingReceipt, upstreamRun, upstreamArtifact }));
  };

  await badInput('candidate_main_binding_receipt', v => {
    v.evaluator_context.context_class = 'candidate_pull_request';
    v.evaluator_context.event_name = 'pull_request';
    v.evaluator_context.ref = 'refs/pull/251/merge';
  });
  await badInput('wrong_main_binding_evaluator_sha', v => { v.evaluator_context.sha = '1'.repeat(40); });
  await badInput('wrong_original_source_revision', v => { v.expected_source_revision = '2'.repeat(40); });
  await badInput('historical_bytes_overclaim', v => { v.decision.historical_frontier_bytes_reverified = true; });
  await badInput('historical_binding_consistency_removed', v => { v.decision.historical_frontier_binding_consistency_verified = false; });
  await badInput('main_bound_evidence_removed', v => { v.decision.main_bound_source_evidence_verified = false; });
  await badInput('future_successor_presentation_removed', v => { v.decision.source_may_be_presented_to_future_successor_policy = false; });
  await badInput('upstream_append_permission_escalation', v => { v.decision.successor_append_may_proceed = true; });
  await badInput('upstream_external_consequence_overclaim', v => { v.claims.new_external_consequence_observed = true; });
  await badInput('upstream_scalar_score', v => { v.responsibility_score = 1; });

  await badRun('wrong_upstream_event', v => { v.event = 'pull_request'; });
  await badRun('wrong_upstream_sha', v => { v.head_sha = '3'.repeat(40); });
  await badRun('failed_upstream_run', v => { v.conclusion = 'failure'; });

  await badArtifact('wrong_upstream_artifact_name', v => { v.name = 'consequence-source-main-binding-' + '4'.repeat(40); });
  await badArtifact('expired_upstream_artifact', v => { v.expired = true; });
  await badArtifact('malformed_upstream_archive_digest', v => { v.archive_digest = 'sha256:bad'; });

  await badPolicy('adapter_registration_policy_escalation', v => { v.invariants.successor_adapter_registration_allowed = true; });
  await badPolicy('successor_policy_mutation_escalation', v => { v.invariants.successor_policy_modification_allowed = true; });
  await badPolicy('append_permission_policy_escalation', v => { v.invariants.successor_append_permission_allowed = true; });
  await badPolicy('append_execution_policy_escalation', v => { v.invariants.successor_append_execution_allowed = true; });
  await badPolicy('server_runtime_dependency_escalation', v => { v.invariants.server_runtime_dependency_required = true; });
  await badPolicy('scalar_policy_allowance', v => { v.invariants.scalar_scores_allowed = true; });
  await badPolicy('source_profile_substitution', v => { v.admitted_source_profile.producer_id = 'urn:example:other'; });

  await badReceipt('input_digest_substitution', v => { v.main_binding_receipt_binding.digest.value = '5'.repeat(64); });
  await badReceipt('historical_frontier_binding_substitution', v => { v.historical_frontier_binding.digest.value = '6'.repeat(64); });
  await badReceipt('adapter_registered_escalation', v => { v.decision.successor_adapter_registered = true; });
  await badReceipt('successor_policy_modified_escalation', v => { v.decision.successor_policy_modified = true; });
  await badReceipt('append_permission_escalation', v => { v.decision.successor_append_may_proceed = true; });
  await badReceipt('append_execution_escalation', v => { v.decision.successor_append_executed = true; });
  await badReceipt('causal_proof_escalation', v => { v.claims.causal_proof_certified = true; });
  await badReceipt('responsibility_escalation', v => { v.claims.responsibility_for_consequence_attributed = true; });
  await badReceipt('legal_escalation', v => { v.claims.legal_liability_established = true; });
  await badReceipt('moral_escalation', v => { v.claims.moral_blame_assigned = true; });
  await badReceipt('truth_escalation', v => { v.claims.truth_certified = true; });
  await badReceipt('scalar_receipt_score', v => { v.confidence = 1; });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'source-specific-successor-admission-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  const summary = {
    suite: 'UU-AAP SourceSpecificSuccessorAdmission v0.1',
    upstream_main_revision: receipt.upstream_main_revision,
    original_source_revision: receipt.original_source_revision,
    upstream_run_id: receipt.upstream_workflow_run.run_id,
    upstream_artifact_id: receipt.upstream_artifact.artifact_id,
    admission_receipt_id: receipt.admission_receipt_id,
    evaluator_context_class: receipt.evaluator_context.context_class,
    exact_main_binding_receipt_verified: receipt.decision.exact_main_binding_receipt_verified,
    main_bound_source_binding_accepted: receipt.decision.main_bound_source_binding_accepted,
    historical_frontier_binding_consistency_preserved: receipt.decision.historical_frontier_binding_consistency_preserved,
    historical_frontier_bytes_reverified: receipt.decision.historical_frontier_bytes_reverified,
    source_profile_admitted_for_successor_adapter_design: receipt.decision.source_profile_admitted_for_successor_adapter_design,
    future_successor_adapter_registration_may_be_proposed: receipt.decision.future_successor_adapter_registration_may_be_proposed,
    successor_adapter_registered: receipt.decision.successor_adapter_registered,
    successor_policy_modified: receipt.decision.successor_policy_modified,
    successor_append_may_proceed: receipt.decision.successor_append_may_proceed,
    successor_append_executed: receipt.decision.successor_append_executed,
    server_runtime_dependency_required: policy.invariants.server_runtime_dependency_required,
    negative_vectors: negative
  };
  fs.writeFileSync(path.join(outDir, 'source-specific-successor-admission-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exit(1);
});
