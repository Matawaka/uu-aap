'use strict';

const fs = require('fs');
const path = require('path');
const Binding = require('../../../docs/poai/binding-receipt.js');

const POLICY_ID = 'urn:uu-aap:consequence-observation-source-adapter-main-binding-policy:github-actions-main:1';
const POLICY_TYPE = 'ConsequenceObservationSourceAdapterMainBindingPolicy';
const RECEIPT_TYPE = 'ConsequenceObservationSourceAdapterMainBindingReceipt';
const ADAPTER_POLICY_ID = 'urn:uu-aap:consequence-observation-source-adapter-policy:github-actions-runtime:1';
const SOURCE_WORKFLOW = 'ConsequenceObservation Source Adapter validation';
const REPOSITORY = 'Matawaka/uu-aap';

const FALSE_CLAIMS = [
  'provider_identity_cryptographically_attested',
  'github_remote_truth_certified',
  'new_external_consequence_observed',
  'consequence_truth_certified',
  'generalized_external_consequence_causality_established',
  'causal_proof_certified',
  'responsibility_for_consequence_attributed',
  'responsibility_for_outcome_adjudicated',
  'legal_liability_established',
  'legal_effect_established',
  'moral_blame_assigned',
  'moral_correctness_established',
  'truth_certified',
  'successor_append_may_proceed',
  'successor_append_executed',
  'global_replay_protection_established',
  'distributed_consensus_established',
  'poai_materialization_event_recorded',
  'universal_canonicality_established'
];

function assert(value, message) {
  if (!value) throw new Error(`MainSourceAdapterBinding: ${message}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function noScalarFields(value, at = '$') {
  const banned = /(score|probability|confidence|likelihood|responsibility_score)$/i;
  if (Array.isArray(value)) return value.forEach((item, i) => noScalarFields(item, `${at}[${i}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!banned.test(key), `${at}.${key}: scalar fields prohibited`);
    noScalarFields(child, `${at}.${key}`);
  }
}

async function digestOf(value) {
  const canonical = Binding.canonicalize(value, '$');
  return Binding.sha256Hex(Binding.utf8Bytes(canonical));
}

function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}

function artifactRef(value, fallback) {
  for (const key of ['binding_receipt_id', 'receipt_id', 'assessment_id', 'ingress_receipt_id', 'claim_id', 'source_evidence_id', 'observation_id']) {
    if (value && typeof value[key] === 'string' && value[key]) return value[key];
  }
  return fallback;
}

async function bindingFor(value, fallbackRef) {
  return {
    artifact_type: value.artifact_type || 'JSONArtifact',
    artifact_ref: artifactRef(value, fallbackRef),
    digest: digest(await digestOf(value))
  };
}

async function assertSameCanonical(left, right, label) {
  assert(left && right && await digestOf(left) === await digestOf(right), `${label} inconsistency`);
}

function validateHistoricalFrontierBinding(binding) {
  assert(binding && binding.artifact_type === 'ResponsibilityEventSuccessorLedgerEntry', 'historical frontier binding artifact substitution');
  assert(typeof binding.artifact_ref === 'string' && binding.artifact_ref.startsWith('urn:uu-aap:responsibility-event-successor-ledger-entry:'), 'historical frontier binding ref malformed');
  assert(binding.digest && binding.digest.canonicalization === 'RFC8785-JCS', 'historical frontier binding canonicalization substitution');
  assert(binding.digest.digest_algorithm === 'SHA-256' && binding.digest.digest_encoding === 'hex', 'historical frontier binding digest profile substitution');
  assert(/^[0-9a-f]{64}$/.test(binding.digest.value || ''), 'historical frontier binding digest malformed');
}

function validatePolicy(policy) {
  assert(policy && policy.artifact_type === POLICY_TYPE && policy.artifact_version === '0.1', 'policy artifact substitution');
  assert(policy.policy_id === POLICY_ID && policy.policy_version === 1, 'policy ID/version substitution');
  assert(policy.repository === REPOSITORY, 'policy repository substitution');
  assert(policy.source_workflow === SOURCE_WORKFLOW, 'policy workflow substitution');
  assert(policy.artifact_name_prefix === 'consequence-source-adapter-', 'policy artifact prefix substitution');
  const inv = policy.invariants || {};
  for (const key of [
    'exact_push_event_required', 'exact_main_ref_required', 'workflow_success_required',
    'artifact_name_revision_bound', 'artifact_not_expired_required', 'bundle_schema_valid_required',
    'bundle_cross_digest_binding_required', 'historical_frontier_binding_consistency_required',
    'adapter_receipt_main_bound_required', 'adapter_receipt_candidate_prohibited',
    'source_revision_explicit_required'
  ]) assert(inv[key] === true, `policy invariant weakened: ${key}`);
  assert(inv.historical_frontier_bytes_reverification_required === false, 'historical frontier byte-reverification overclaim');
  assert(inv.successor_append_permission_allowed === false, 'policy append permission escalation');
  assert(inv.successor_append_execution_allowed === false, 'policy append execution escalation');
  assert(inv.server_runtime_dependency_required === false, 'server runtime dependency escalation');
  assert(inv.scalar_scores_allowed === false, 'policy scalar-score allowance escalation');
  assert(policy.claims && policy.claims.main_binding_policy_defined === true, 'policy positive claim missing');
  for (const key of FALSE_CLAIMS) assert(policy.claims[key] === false, `policy prohibited claim ${key}`);
  noScalarFields(policy);
}

function validateSourceRun(run, expectedSha) {
  assert(run && String(run.run_id).match(/^[1-9][0-9]*$/), 'source run ID missing');
  assert(run.workflow_name === SOURCE_WORKFLOW, 'source workflow substitution');
  assert(run.event === 'push', 'source workflow event must be push');
  assert(run.head_branch === 'main', 'source workflow branch must be main');
  assert(run.head_sha === expectedSha, 'source workflow SHA substitution');
  assert(run.status === 'completed' && run.conclusion === 'success', 'source workflow must be completed/success');
}

function validateSourceArtifact(artifact, expectedSha) {
  assert(artifact && String(artifact.artifact_id).match(/^[1-9][0-9]*$/), 'source artifact ID missing');
  assert(artifact.name === `consequence-source-adapter-${expectedSha}`, 'source artifact name/revision substitution');
  assert(Number.isInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, 'source artifact empty');
  assert(artifact.expired === false, 'source artifact expired');
  if (artifact.archive_digest !== null && artifact.archive_digest !== undefined) {
    assert(/^sha256:[0-9a-f]{64}$/.test(artifact.archive_digest), 'source artifact archive digest malformed');
  }
}

async function assertBinding(binding, artifact, label) {
  assert(binding && binding.digest && binding.digest.value === await digestOf(artifact), `${label} digest binding substitution`);
}

async function validateBundle({ bundle, adapterPolicy, expectedSha, sourceRun }) {
  const o = bundle.runtime_observation;
  const s = bundle.source_evidence;
  const c = bundle.claim;
  const i = bundle.ingress_receipt;
  const a = bundle.assessment;
  const r = bundle.adapter_receipt;
  const summary = bundle.summary;

  assert(o.artifact_type === 'GitHubActionsRuntimeObservation' && o.artifact_version === '0.1', 'runtime observation artifact substitution');
  assert(o.context_class === 'main_push' && o.event_name === 'push', 'runtime observation is not main push');
  assert(o.repository === REPOSITORY && o.workflow_name === SOURCE_WORKFLOW, 'runtime observation producer profile substitution');
  assert(o.sha === expectedSha && o.ref === 'refs/heads/main', 'runtime observation main revision/ref substitution');
  assert(String(o.run_id) === String(sourceRun.run_id), 'runtime observation/source run ID mismatch');

  assert(a.artifact_type === 'ConsequenceObservationAssessment' && a.artifact_version === '0.1', 'assessment artifact substitution');
  assert(a.status === 'deferred_source_profile_required', 'generic assessment historical status drift');
  assert(a.assessment_result.observation_qualified === false, 'generic assessment observation qualification escalation');
  assert(a.assessment_result.source_profile_registered === false, 'generic assessment source-profile escalation');
  assert(a.assessment_result.successor_adapter_eligible === false, 'generic assessment successor eligibility escalation');
  assert(a.assessment_result.successor_append_may_proceed === false, 'generic assessment append permission escalation');

  assert(r.artifact_type === 'ConsequenceObservationSourceAdapterReceipt' && r.artifact_version === '0.1', 'adapter receipt artifact substitution');
  assert(r.runtime_context.context_class === 'main_push' && r.runtime_context.event_name === 'push', 'adapter receipt runtime context substitution');
  assert(r.runtime_context.sha === expectedSha && r.runtime_context.ref === 'refs/heads/main', 'adapter receipt revision/ref substitution');
  assert(String(r.runtime_context.run_id) === String(sourceRun.run_id), 'adapter receipt/source run ID mismatch');
  assert(r.profile_decision.status === 'eligible_as_typed_successor_source', 'adapter receipt status substitution');
  assert(r.profile_decision.source_specific_observation_semantics_qualified === true, 'source-specific semantics not qualified');
  assert(r.profile_decision.typed_successor_source_eligible === true, 'typed successor source not eligible');
  assert(r.profile_decision.candidate_evidence === false && r.profile_decision.main_bound_evidence === true, 'adapter receipt is not main-bound');
  assert(r.profile_decision.successor_append_may_proceed === false && r.profile_decision.successor_append_executed === false, 'adapter receipt cannot permit or execute append');

  assert(r.policy_binding.artifact_ref === ADAPTER_POLICY_ID, 'adapter policy ref substitution');
  await assertBinding(r.policy_binding, adapterPolicy, 'adapter policy');
  await assertBinding(r.assessment_binding, a, 'assessment');
  await assertBinding(r.ingress_receipt_binding, i, 'ingress receipt');
  await assertBinding(r.claim_binding, c, 'claim');
  await assertBinding(r.source_evidence_binding, s, 'source evidence');
  await assertBinding(r.producer_observation_binding, o, 'producer observation');

  validateHistoricalFrontierBinding(a.frontier_entry_binding);
  validateHistoricalFrontierBinding(r.frontier_entry_binding);
  await assertSameCanonical(a.frontier_entry_binding, r.frontier_entry_binding, 'historical frontier binding');
  for (const field of ['responsibility_event_head', 'semantic_frontier', 'effect_frontier']) {
    await assertSameCanonical(c[field], i[field], `${field} claim/ingress`);
    await assertSameCanonical(c[field], a[field], `${field} claim/assessment`);
    await assertSameCanonical(c[field], r[field], `${field} claim/adapter`);
  }

  assert(s.source_payload && await digestOf(s.source_payload) === await digestOf(o), 'source wrapper/runtime payload mismatch');
  assert(summary.runtime_context_class === 'main_push' && summary.event_name === 'push', 'summary main-push context substitution');
  assert(summary.runtime_sha === expectedSha && summary.runtime_ref === 'refs/heads/main', 'summary revision/ref substitution');
  assert(String(summary.run_id) === String(sourceRun.run_id), 'summary/source run ID mismatch');
  assert(summary.generic_assessment_status === 'deferred_source_profile_required', 'summary assessment status drift');
  assert(summary.source_specific_observation_semantics_qualified === true && summary.typed_successor_source_eligible === true, 'summary typed-source qualification missing');
  assert(summary.successor_append_may_proceed === false && summary.successor_append_executed === false, 'summary append escalation');

  for (const key of FALSE_CLAIMS) {
    if (Object.prototype.hasOwnProperty.call(r.claims, key)) assert(r.claims[key] === false, `adapter receipt prohibited claim ${key}`);
  }
  noScalarFields(bundle);
}

function evaluatorContext(env) {
  assert(env.GITHUB_ACTIONS === 'true', 'GitHub Actions evaluator required');
  assert(/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || ''), 'evaluator SHA missing');
  assert(/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID || ''), 'evaluator run ID missing');
  const event = env.GITHUB_EVENT_NAME;
  const ref = env.GITHUB_REF;
  if (event === 'pull_request') {
    assert(/^refs\/pull\/[1-9][0-9]*\/merge$/.test(ref || ''), 'PR evaluator ref invalid');
    return { context_class: 'candidate_pull_request', event_name: event, sha: env.GITHUB_SHA, ref, run_id: env.GITHUB_RUN_ID };
  }
  if (event === 'push') {
    assert(ref === 'refs/heads/main', 'push evaluator must bind refs/heads/main');
    return { context_class: 'main_push', event_name: event, sha: env.GITHUB_SHA, ref, run_id: env.GITHUB_RUN_ID };
  }
  throw new Error('MainSourceAdapterBinding: evaluator event must be pull_request or push');
}

async function buildReceipt({ policy, adapterPolicy, bundle, sourceRun, sourceArtifact, expectedSha, evaluatedAt, env = process.env }) {
  validatePolicy(policy);
  assert(/^[0-9a-f]{40}$/.test(expectedSha || ''), 'expected source revision required');
  validateSourceRun(sourceRun, expectedSha);
  validateSourceArtifact(sourceArtifact, expectedSha);
  await validateBundle({ bundle, adapterPolicy, expectedSha, sourceRun });
  const context = evaluatorContext(env);

  const policyBinding = await bindingFor(policy, POLICY_ID);
  const bundleBindings = {
    runtime_observation: await bindingFor(bundle.runtime_observation, bundle.runtime_observation.observation_id),
    source_evidence: await bindingFor(bundle.source_evidence, bundle.source_evidence.source_evidence_id),
    claim: await bindingFor(bundle.claim, bundle.claim.claim_id),
    ingress_receipt: await bindingFor(bundle.ingress_receipt, bundle.ingress_receipt.ingress_receipt_id),
    assessment: await bindingFor(bundle.assessment, bundle.assessment.assessment_id),
    adapter_receipt: await bindingFor(bundle.adapter_receipt, bundle.adapter_receipt.receipt_id),
    summary: await bindingFor(bundle.summary, `urn:uu-aap:consequence-observation-source-adapter-summary:${expectedSha}`)
  };

  const sourceWorkflowRun = {
    run_id: String(sourceRun.run_id), run_number: String(sourceRun.run_number), run_attempt: String(sourceRun.run_attempt),
    event: sourceRun.event, head_branch: sourceRun.head_branch, head_sha: sourceRun.head_sha,
    status: sourceRun.status, conclusion: sourceRun.conclusion, workflow_name: sourceRun.workflow_name
  };
  const sourceArtifactOut = {
    artifact_id: String(sourceArtifact.artifact_id), name: sourceArtifact.name,
    size_in_bytes: sourceArtifact.size_in_bytes, expired: sourceArtifact.expired,
    archive_digest: sourceArtifact.archive_digest || null
  };
  const runtimeContext = {
    context_class: bundle.runtime_observation.context_class,
    event_name: bundle.runtime_observation.event_name,
    repository: bundle.runtime_observation.repository,
    workflow_name: bundle.runtime_observation.workflow_name,
    run_id: String(bundle.runtime_observation.run_id),
    sha: bundle.runtime_observation.sha,
    ref: bundle.runtime_observation.ref
  };
  const historicalFrontierBinding = clone(bundle.adapter_receipt.frontier_entry_binding);

  const seed = {
    policy_digest: policyBinding.digest.value,
    expected_source_revision: expectedSha,
    source_run_id: sourceWorkflowRun.run_id,
    source_artifact_id: sourceArtifactOut.artifact_id,
    adapter_receipt_digest: bundleBindings.adapter_receipt.digest.value,
    historical_frontier_digest: historicalFrontierBinding.digest.value,
    evaluator: context
  };
  const idDigest = await digestOf(seed);
  const mainBound = context.context_class === 'main_push';
  const receipt = {
    $schema: './consequence-observation-source-adapter-main-binding-receipt.schema.json',
    artifact_type: RECEIPT_TYPE,
    artifact_version: '0.1',
    binding_receipt_id: `urn:uu-aap:consequence-observation-source-adapter-main-binding-receipt:${idDigest.slice(0, 24)}`,
    evaluated_at: evaluatedAt || new Date().toISOString(),
    policy_binding: policyBinding,
    expected_source_revision: expectedSha,
    source_workflow_run: sourceWorkflowRun,
    source_artifact: sourceArtifactOut,
    bundle_bindings: bundleBindings,
    historical_frontier_binding: historicalFrontierBinding,
    runtime_context: runtimeContext,
    evaluator_context: context,
    decision: {
      status: 'verified_main_bound_source_adapter_evidence',
      policy_relative: true,
      exact_push_run_verified: true,
      exact_artifact_verified: true,
      bundle_integrity_verified: true,
      historical_frontier_binding_consistency_verified: true,
      historical_frontier_bytes_reverified: false,
      main_bound_source_evidence_verified: true,
      source_may_be_presented_to_future_successor_policy: true,
      candidate_binding_receipt: !mainBound,
      main_bound_binding_receipt: mainBound,
      successor_append_may_proceed: false,
      successor_append_executed: false,
      requires_separate_successor_consumer_policy: true
    },
    claims: {
      main_binding_policy_applied: true,
      exact_push_run_verified: true,
      exact_artifact_verified: true,
      bundle_integrity_verified: true,
      historical_frontier_binding_consistency_verified: true,
      historical_frontier_bytes_reverified: false,
      main_bound_source_evidence_verified: true,
      stronger_claims_withheld: true,
      provider_identity_cryptographically_attested: false,
      github_remote_truth_certified: false,
      new_external_consequence_observed: false,
      consequence_truth_certified: false,
      generalized_external_consequence_causality_established: false,
      causal_proof_certified: false,
      responsibility_for_consequence_attributed: false,
      responsibility_for_outcome_adjudicated: false,
      legal_liability_established: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      moral_correctness_established: false,
      truth_certified: false,
      successor_append_may_proceed: false,
      successor_append_executed: false,
      global_replay_protection_established: false,
      distributed_consensus_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  noScalarFields(receipt);
  return receipt;
}

async function validateReceipt(args) {
  const rebuilt = await buildReceipt(args);
  const expected = args.receipt;
  assert(expected && await digestOf(expected) === await digestOf(rebuilt), 'binding receipt substitution');
  return true;
}

function readBundle(dir) {
  const load = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  return {
    runtime_observation: load('github-actions-runtime-observation.json'),
    source_evidence: load('consequence-observation-source-live.json'),
    claim: load('consequence-observation-claim-live.json'),
    ingress_receipt: load('consequence-observation-ingress-live.json'),
    assessment: load('consequence-observation-assessment-live-deferred.json'),
    adapter_receipt: load('consequence-observation-source-adapter-receipt.json'),
    summary: load('consequence-observation-source-adapter-summary.json')
  };
}

module.exports = {
  POLICY_ID, POLICY_TYPE, RECEIPT_TYPE, FALSE_CLAIMS,
  digestOf, bindingFor, validateHistoricalFrontierBinding, validatePolicy,
  validateSourceRun, validateSourceArtifact, validateBundle, evaluatorContext,
  buildReceipt, validateReceipt, readBundle
};
