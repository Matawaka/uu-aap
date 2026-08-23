'use strict';

const Binding = require('../../../docs/poai/binding-receipt.js');

const POLICY_ID = 'urn:uu-aap:source-specific-successor-admission-policy:github-actions-main-bound:1';
const POLICY_TYPE = 'SourceSpecificSuccessorAdmissionPolicy';
const RECEIPT_TYPE = 'SourceSpecificSuccessorAdmissionReceipt';
const INPUT_TYPE = 'ConsequenceObservationSourceAdapterMainBindingReceipt';
const REPOSITORY = 'Matawaka/uu-aap';
const UPSTREAM_WORKFLOW = 'ConsequenceObservation Source Adapter Main Binding validation';
const UPSTREAM_MAIN_SHA = '4c76d80ead3e0d8d3af14375a3478cc72beddefa';
const ORIGINAL_SOURCE_SHA = '0ea85faa957cd924c250e0cea0d0758f855d4fd0';
const MAIN_BINDING_POLICY_ID = 'urn:uu-aap:consequence-observation-source-adapter-main-binding-policy:github-actions-main:1';

const FALSE_CLAIMS = [
  'successor_adapter_registered',
  'successor_policy_modified',
  'successor_append_may_proceed',
  'successor_append_executed',
  'new_external_consequence_observed',
  'generalized_external_consequence_causality_established',
  'causal_proof_certified',
  'responsibility_for_consequence_attributed',
  'responsibility_for_outcome_adjudicated',
  'legal_liability_established',
  'legal_effect_established',
  'moral_blame_assigned',
  'moral_correctness_established',
  'truth_certified',
  'global_replay_protection_established',
  'distributed_consensus_established',
  'poai_materialization_event_recorded',
  'universal_canonicality_established'
];

function assert(value, message) {
  if (!value) throw new Error(`SourceSpecificSuccessorAdmission: ${message}`);
}

function noScalarFields(value, at = '$') {
  const banned = /(score|probability|confidence|likelihood|readiness_score|responsibility_score)$/i;
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
  return {
    canonicalization: 'RFC8785-JCS',
    digest_algorithm: 'SHA-256',
    digest_encoding: 'hex',
    value
  };
}

async function bindingFor(value, artifactRef) {
  return {
    artifact_type: value.artifact_type,
    artifact_ref: artifactRef,
    digest: digest(await digestOf(value))
  };
}

function validatePolicy(policy) {
  assert(policy && policy.artifact_type === POLICY_TYPE && policy.artifact_version === '0.1', 'policy artifact substitution');
  assert(policy.policy_id === POLICY_ID && policy.policy_version === 1, 'policy identity substitution');
  assert(policy.repository === REPOSITORY, 'policy repository substitution');
  assert(policy.upstream_workflow === UPSTREAM_WORKFLOW, 'policy upstream workflow substitution');
  assert(policy.upstream_artifact_prefix === 'consequence-source-main-binding-', 'policy artifact prefix substitution');
  assert(policy.required_upstream_main_revision === UPSTREAM_MAIN_SHA, 'policy upstream main revision substitution');
  assert(policy.required_original_source_revision === ORIGINAL_SOURCE_SHA, 'policy original source revision substitution');
  assert(policy.accepted_input.artifact_type === INPUT_TYPE && policy.accepted_input.artifact_version === '0.1', 'policy accepted input substitution');
  const p = policy.admitted_source_profile || {};
  assert(p.producer_id === 'urn:uu-aap:producer:github-actions-runtime', 'source producer substitution');
  assert(p.producer_artifact_type === 'GitHubActionsRuntimeObservation' && p.producer_artifact_version === '0.1', 'source producer type substitution');
  assert(p.source_adapter_policy_id === 'urn:uu-aap:consequence-observation-source-adapter-policy:github-actions-runtime:1', 'source adapter policy substitution');
  assert(p.source_context_class === 'main_push', 'source context substitution');

  const inv = policy.invariants || {};
  for (const key of [
    'exact_main_binding_receipt_required',
    'exact_upstream_artifact_required',
    'input_digest_binding_required',
    'main_bound_receipt_required',
    'candidate_receipt_prohibited',
    'historical_frontier_binding_consistency_required',
    'source_profile_admission_only',
    'future_adapter_registration_proposal_allowed'
  ]) assert(inv[key] === true, `policy invariant weakened: ${key}`);
  assert(inv.historical_frontier_bytes_reverification_required === false, 'historical byte reverification overclaim');
  assert(inv.successor_adapter_registration_allowed === false, 'adapter registration escalation');
  assert(inv.successor_policy_modification_allowed === false, 'successor policy mutation escalation');
  assert(inv.successor_append_permission_allowed === false, 'append permission escalation');
  assert(inv.successor_append_execution_allowed === false, 'append execution escalation');
  assert(inv.server_runtime_dependency_required === false, 'server runtime dependency escalation');
  assert(inv.scalar_scores_allowed === false, 'scalar score allowance escalation');

  assert(policy.claims.source_specific_successor_admission_policy_defined === true, 'policy positive claim missing');
  for (const key of FALSE_CLAIMS) assert(policy.claims[key] === false, `policy prohibited claim ${key}`);
  noScalarFields(policy);
}

function validateUpstreamRun(run) {
  assert(run && /^[1-9][0-9]*$/.test(String(run.run_id)), 'upstream run ID missing');
  assert(run.workflow_name === UPSTREAM_WORKFLOW, 'upstream workflow substitution');
  assert(run.event === 'push' && run.head_branch === 'main', 'upstream run must be push/main');
  assert(run.head_sha === UPSTREAM_MAIN_SHA, 'upstream run SHA substitution');
  assert(run.status === 'completed' && run.conclusion === 'success', 'upstream run must be completed/success');
}

function validateUpstreamArtifact(artifact) {
  assert(artifact && /^[1-9][0-9]*$/.test(String(artifact.artifact_id)), 'upstream artifact ID missing');
  assert(artifact.name === `consequence-source-main-binding-${UPSTREAM_MAIN_SHA}`, 'upstream artifact name substitution');
  assert(Number.isInteger(artifact.size_in_bytes) && artifact.size_in_bytes > 0, 'upstream artifact empty');
  assert(artifact.expired === false, 'upstream artifact expired');
  if (artifact.archive_digest !== null && artifact.archive_digest !== undefined) {
    assert(/^sha256:[0-9a-f]{64}$/.test(artifact.archive_digest), 'upstream artifact digest malformed');
  }
}

function validateMainBindingReceipt(receipt, upstreamRun) {
  assert(receipt && receipt.artifact_type === INPUT_TYPE && receipt.artifact_version === '0.1', 'main-binding receipt artifact substitution');
  assert(receipt.policy_binding && receipt.policy_binding.artifact_ref === MAIN_BINDING_POLICY_ID, 'main-binding policy identity substitution');
  assert(receipt.expected_source_revision === ORIGINAL_SOURCE_SHA, 'original source revision substitution');

  assert(receipt.evaluator_context.context_class === 'main_push', 'candidate main-binding receipt prohibited');
  assert(receipt.evaluator_context.event_name === 'push' && receipt.evaluator_context.ref === 'refs/heads/main', 'main-binding evaluator context substitution');
  assert(receipt.evaluator_context.sha === UPSTREAM_MAIN_SHA, 'main-binding evaluator SHA substitution');
  assert(String(receipt.evaluator_context.run_id) === String(upstreamRun.run_id), 'main-binding evaluator/upstream run ID mismatch');

  assert(receipt.runtime_context.context_class === 'main_push' && receipt.runtime_context.event_name === 'push', 'source runtime context substitution');
  assert(receipt.runtime_context.sha === ORIGINAL_SOURCE_SHA && receipt.runtime_context.ref === 'refs/heads/main', 'source runtime revision substitution');
  assert(receipt.source_workflow_run.head_sha === ORIGINAL_SOURCE_SHA, 'source workflow revision substitution');

  const d = receipt.decision || {};
  assert(d.status === 'verified_main_bound_source_adapter_evidence', 'main-binding status substitution');
  assert(d.policy_relative === true, 'main-binding must remain policy-relative');
  assert(d.exact_push_run_verified === true && d.exact_artifact_verified === true && d.bundle_integrity_verified === true, 'main-binding verification incomplete');
  assert(d.historical_frontier_binding_consistency_verified === true, 'historical frontier binding consistency missing');
  assert(d.historical_frontier_bytes_reverified === false, 'historical frontier bytes overclaimed');
  assert(d.main_bound_source_evidence_verified === true, 'main-bound source evidence not verified');
  assert(d.source_may_be_presented_to_future_successor_policy === true, 'source not eligible for admission presentation');
  assert(d.candidate_binding_receipt === false && d.main_bound_binding_receipt === true, 'candidate receipt prohibited');
  assert(d.successor_append_may_proceed === false && d.successor_append_executed === false, 'upstream receipt append escalation');
  assert(d.requires_separate_successor_consumer_policy === true, 'separate successor consumer policy boundary missing');

  const c = receipt.claims || {};
  assert(c.historical_frontier_binding_consistency_verified === true, 'historical binding claim missing');
  assert(c.historical_frontier_bytes_reverified === false, 'historical byte claim overclaimed');
  assert(c.main_bound_source_evidence_verified === true && c.stronger_claims_withheld === true, 'upstream assurance boundary weakened');
  for (const key of [
    'new_external_consequence_observed',
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
  ]) assert(c[key] === false, `upstream prohibited claim ${key}`);

  assert(receipt.historical_frontier_binding && receipt.historical_frontier_binding.artifact_type === 'ResponsibilityEventSuccessorLedgerEntry', 'historical frontier binding type substitution');
  noScalarFields(receipt);
}

function evaluatorContext(env) {
  assert(env.GITHUB_ACTIONS === 'true', 'GitHub Actions evaluator required');
  assert(/^[0-9a-f]{40}$/.test(env.GITHUB_SHA || ''), 'evaluator SHA missing');
  assert(/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID || ''), 'evaluator run ID missing');
  if (env.GITHUB_EVENT_NAME === 'pull_request') {
    assert(/^refs\/pull\/[1-9][0-9]*\/merge$/.test(env.GITHUB_REF || ''), 'PR evaluator ref invalid');
    return { context_class: 'candidate_pull_request', event_name: 'pull_request', sha: env.GITHUB_SHA, ref: env.GITHUB_REF, run_id: env.GITHUB_RUN_ID };
  }
  if (env.GITHUB_EVENT_NAME === 'push') {
    assert(env.GITHUB_REF === 'refs/heads/main', 'push evaluator must bind refs/heads/main');
    return { context_class: 'main_push', event_name: 'push', sha: env.GITHUB_SHA, ref: env.GITHUB_REF, run_id: env.GITHUB_RUN_ID };
  }
  throw new Error('SourceSpecificSuccessorAdmission: evaluator event must be pull_request or push');
}

async function buildReceipt({ policy, mainBindingReceipt, upstreamRun, upstreamArtifact, evaluatedAt, env = process.env }) {
  validatePolicy(policy);
  validateUpstreamRun(upstreamRun);
  validateUpstreamArtifact(upstreamArtifact);
  validateMainBindingReceipt(mainBindingReceipt, upstreamRun);
  const context = evaluatorContext(env);

  const policyBinding = await bindingFor(policy, POLICY_ID);
  const inputBinding = await bindingFor(mainBindingReceipt, mainBindingReceipt.binding_receipt_id);
  const mainBound = context.context_class === 'main_push';

  const runOut = {
    run_id: String(upstreamRun.run_id),
    run_number: String(upstreamRun.run_number),
    run_attempt: String(upstreamRun.run_attempt),
    event: upstreamRun.event,
    head_branch: upstreamRun.head_branch,
    head_sha: upstreamRun.head_sha,
    status: upstreamRun.status,
    conclusion: upstreamRun.conclusion,
    workflow_name: upstreamRun.workflow_name
  };
  const artifactOut = {
    artifact_id: String(upstreamArtifact.artifact_id),
    name: upstreamArtifact.name,
    size_in_bytes: upstreamArtifact.size_in_bytes,
    expired: upstreamArtifact.expired,
    archive_digest: upstreamArtifact.archive_digest || null
  };
  const sourceProfile = {
    producer_id: policy.admitted_source_profile.producer_id,
    producer_artifact_type: policy.admitted_source_profile.producer_artifact_type,
    producer_artifact_version: policy.admitted_source_profile.producer_artifact_version,
    source_adapter_policy_id: policy.admitted_source_profile.source_adapter_policy_id,
    context_class: policy.admitted_source_profile.source_context_class
  };

  const seed = {
    policy_digest: policyBinding.digest.value,
    input_digest: inputBinding.digest.value,
    upstream_run_id: runOut.run_id,
    upstream_artifact_id: artifactOut.artifact_id,
    evaluator: context
  };
  const idDigest = await digestOf(seed);

  const receipt = {
    $schema: './source-specific-successor-admission-receipt.schema.json',
    artifact_type: RECEIPT_TYPE,
    artifact_version: '0.1',
    admission_receipt_id: `urn:uu-aap:source-specific-successor-admission-receipt:${idDigest.slice(0, 24)}`,
    evaluated_at: evaluatedAt || new Date().toISOString(),
    policy_binding: policyBinding,
    upstream_workflow_run: runOut,
    upstream_artifact: artifactOut,
    main_binding_receipt_binding: inputBinding,
    upstream_main_revision: UPSTREAM_MAIN_SHA,
    original_source_revision: ORIGINAL_SOURCE_SHA,
    source_profile: sourceProfile,
    historical_frontier_binding: mainBindingReceipt.historical_frontier_binding,
    evaluator_context: context,
    decision: {
      status: 'admitted_for_future_successor_adapter_design',
      policy_relative: true,
      exact_main_binding_receipt_verified: true,
      main_bound_source_binding_accepted: true,
      historical_frontier_binding_consistency_preserved: true,
      historical_frontier_bytes_reverified: false,
      source_profile_admitted_for_successor_adapter_design: true,
      source_semantics_admitted: true,
      future_successor_adapter_registration_may_be_proposed: true,
      candidate_admission_receipt: !mainBound,
      main_bound_admission_receipt: mainBound,
      successor_adapter_registered: false,
      successor_policy_modified: false,
      successor_append_may_proceed: false,
      successor_append_executed: false,
      requires_separate_adapter_registration_policy: true,
      requires_separate_append_admission: true
    },
    claims: {
      source_specific_successor_admission_policy_applied: true,
      exact_main_binding_receipt_verified: true,
      main_bound_source_binding_accepted: true,
      historical_frontier_binding_consistency_preserved: true,
      historical_frontier_bytes_reverified: false,
      source_profile_admitted_for_successor_adapter_design: true,
      source_semantics_admitted: true,
      stronger_claims_withheld: true,
      successor_adapter_registered: false,
      successor_policy_modified: false,
      successor_append_may_proceed: false,
      successor_append_executed: false,
      new_external_consequence_observed: false,
      generalized_external_consequence_causality_established: false,
      causal_proof_certified: false,
      responsibility_for_consequence_attributed: false,
      responsibility_for_outcome_adjudicated: false,
      legal_liability_established: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      moral_correctness_established: false,
      truth_certified: false,
      global_replay_protection_established: false,
      distributed_consensus_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  noScalarFields(receipt);
  return receipt;
}

async function verifyReceipt({ receipt, policy, mainBindingReceipt, upstreamRun, upstreamArtifact }) {
  validatePolicy(policy);
  validateUpstreamRun(upstreamRun);
  validateUpstreamArtifact(upstreamArtifact);
  validateMainBindingReceipt(mainBindingReceipt, upstreamRun);
  assert(receipt && receipt.artifact_type === RECEIPT_TYPE && receipt.artifact_version === '0.1', 'admission receipt artifact substitution');
  assert(receipt.policy_binding.artifact_ref === POLICY_ID, 'admission policy ref substitution');
  assert(receipt.policy_binding.digest.value === await digestOf(policy), 'admission policy digest substitution');
  assert(receipt.main_binding_receipt_binding.artifact_ref === mainBindingReceipt.binding_receipt_id, 'main-binding receipt ref substitution');
  assert(receipt.main_binding_receipt_binding.digest.value === await digestOf(mainBindingReceipt), 'main-binding receipt digest substitution');
  assert(receipt.upstream_main_revision === UPSTREAM_MAIN_SHA && receipt.original_source_revision === ORIGINAL_SOURCE_SHA, 'admission revision substitution');
  assert(JSON.stringify(receipt.historical_frontier_binding) === JSON.stringify(mainBindingReceipt.historical_frontier_binding), 'historical frontier binding substitution');

  const d = receipt.decision || {};
  assert(d.status === 'admitted_for_future_successor_adapter_design' && d.policy_relative === true, 'admission decision substitution');
  assert(d.exact_main_binding_receipt_verified === true && d.main_bound_source_binding_accepted === true, 'admission verification missing');
  assert(d.historical_frontier_binding_consistency_preserved === true && d.historical_frontier_bytes_reverified === false, 'historical assurance boundary substitution');
  assert(d.source_profile_admitted_for_successor_adapter_design === true && d.source_semantics_admitted === true, 'source admission missing');
  assert(d.future_successor_adapter_registration_may_be_proposed === true, 'future adapter proposal boundary missing');
  assert(d.successor_adapter_registered === false && d.successor_policy_modified === false, 'registration/policy mutation escalation');
  assert(d.successor_append_may_proceed === false && d.successor_append_executed === false, 'append escalation');
  assert(d.requires_separate_adapter_registration_policy === true && d.requires_separate_append_admission === true, 'separate future policy boundary missing');

  const c = receipt.claims || {};
  assert(c.source_specific_successor_admission_policy_applied === true, 'admission policy application claim missing');
  assert(c.exact_main_binding_receipt_verified === true && c.main_bound_source_binding_accepted === true, 'admission evidence claim missing');
  assert(c.historical_frontier_binding_consistency_preserved === true && c.historical_frontier_bytes_reverified === false, 'historical claim substitution');
  assert(c.source_profile_admitted_for_successor_adapter_design === true && c.source_semantics_admitted === true && c.stronger_claims_withheld === true, 'admission assurance claim missing');
  for (const key of FALSE_CLAIMS) assert(c[key] === false, `admission prohibited claim ${key}`);
  noScalarFields(receipt);
  return true;
}

module.exports = {
  POLICY_ID,
  RECEIPT_TYPE,
  UPSTREAM_MAIN_SHA,
  ORIGINAL_SOURCE_SHA,
  digestOf,
  validatePolicy,
  validateUpstreamRun,
  validateUpstreamArtifact,
  validateMainBindingReceipt,
  evaluatorContext,
  buildReceipt,
  verifyReceipt
};
