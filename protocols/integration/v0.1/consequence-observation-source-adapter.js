'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Ingress = require('./consequence-observation-ingress.js');
const Assessment = require('./assess-consequence-observation.js');
const Runtime = require('./observe-github-actions-runtime.js');

const POLICY_ID = 'urn:uu-aap:consequence-observation-source-adapter-policy:github-actions-runtime:1';
const ADAPTER_SCOPE = 'urn:uu-aap:consequence-observation-source-adapter-scope:github-actions-runtime-v0.1';
const ASSESSMENT_POLICY_ID = 'urn:uu-aap:consequence-observation-assessment-policy:bounded-source-admissibility:1';
const WORKFLOW_NAME = 'ConsequenceObservation Source Adapter validation';
const REPOSITORY = 'Matawaka/uu-aap';
const SCALAR_KEYS = new Set(['score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score', 'causal_score', 'responsibility_score', 'blame_score', 'rating']);
const FALSE_CLAIMS = [
  'provider_identity_cryptographically_attested', 'github_remote_truth_certified',
  'new_external_consequence_observed', 'consequence_truth_certified',
  'generalized_external_consequence_causality_established', 'causal_proof_certified',
  'responsibility_for_consequence_attributed', 'responsibility_for_outcome_adjudicated',
  'legal_liability_established', 'legal_effect_established', 'moral_blame_assigned',
  'truth_certified', 'successor_append_executed', 'successor_append_may_proceed',
  'global_replay_protection_established', 'distributed_consensus_established',
  'poai_materialization_event_recorded', 'universal_canonicality_established'
];

function assert(value, message) {
  if (!value) throw new Error(`ConsequenceObservationSourceAdapter: ${message}`);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalEqual(a, b) {
  try { return Binding.canonicalize(a, '$a') === Binding.canonicalize(b, '$b'); }
  catch (_) { return false; }
}
function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
}
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `invalid ${label}`);
  return ms;
}
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
function assertFalseClaims(claims, label) {
  for (const key of FALSE_CLAIMS) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}

function validatePolicy(policy, evaluatedAt) {
  assert(policy && policy.artifact_type === 'ConsequenceObservationSourceAdapterPolicy' && policy.artifact_version === '0.1', 'source adapter policy v0.1 required');
  assert(policy.policy_id === POLICY_ID && policy.policy_version === 1, 'policy ID/version substitution');
  assert(policy.adapter_scope === ADAPTER_SCOPE, 'policy scope substitution');
  const expectedProfile = {
    producer_id: Runtime.PRODUCER_ID,
    producer_artifact_type: Runtime.ARTIFACT_TYPE,
    producer_artifact_version: Runtime.ARTIFACT_VERSION,
    repository: REPOSITORY,
    workflow_name: WORKFLOW_NAME,
    allowed_event_names: ['pull_request', 'push'],
    observation_method: 'system_record',
    consequence_class: 'other'
  };
  assert(canonicalEqual(policy.registered_profile, expectedProfile), 'registered producer profile substitution');
  assert(canonicalEqual(policy.required_predecessor, {
    assessment_artifact_type: 'ConsequenceObservationAssessment',
    assessment_artifact_version: '0.1',
    assessment_policy_id: ASSESSMENT_POLICY_ID,
    assessment_status: 'deferred_source_profile_required'
  }), 'required predecessor substitution');
  const inv = policy.invariants || {};
  assert(inv.exact_byte_bindings_required === true && inv.live_observed_claim_required === true &&
    inv.fixture_source_allowed === false && inv.event_payload_byte_digest_required === true &&
    inv.event_ref_semantics_required === true &&
    inv.provider_identity_is_runtime_declared_not_cryptographically_attested === true &&
    inv.typed_successor_source_eligibility_allowed === true &&
    inv.successor_append_execution_allowed === false && inv.successor_append_permission_allowed === false &&
    inv.policy_relative_only === true && inv.scalar_scores_allowed === false,
    'policy invariants weakened');
  assert(policy.claims && policy.claims.source_adapter_policy_defined === true && policy.claims.registered_profile_count_one === true, 'policy positive claims missing');
  assertFalseClaims(policy.claims, 'policy');
  assert(!hasScalarKey(policy), 'scalar fields prohibited in policy');
  const evaluatedMs = parseTime(evaluatedAt, 'evaluated_at');
  assert(evaluatedMs >= parseTime(policy.effective_from, 'policy effective_from'), 'policy not yet effective');
  if (policy.effective_until !== null) assert(evaluatedMs < parseTime(policy.effective_until, 'policy effective_until'), 'policy expired');
  return true;
}

async function validateInputs({
  adapterPolicy, assessmentPolicy, ingressPolicy, assessment, ingressReceipt,
  claim, sourceEvidence, producerObservation, frontierEntry, evaluatedAt
}) {
  validatePolicy(adapterPolicy, evaluatedAt);
  await Runtime.validateRuntimeObservation(producerObservation);
  await Ingress.validateSourceEvidence(sourceEvidence);
  await Assessment.validateAssessment({ assessment, assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry });
  assert(!hasScalarKey({ assessment, ingressReceipt, claim, sourceEvidence, producerObservation, frontierEntry }), 'scalar fields prohibited in adapter inputs');
  assert(assessment.status === 'deferred_source_profile_required', 'predecessor assessment status substitution');
  assert(assessment.assessment_result && assessment.assessment_result.reason === 'source_profile_required' &&
    assessment.assessment_result.observation_qualified === false && assessment.assessment_result.source_profile_registered === false &&
    assessment.assessment_result.source_specific_adapter_required === true && assessment.assessment_result.successor_adapter_eligible === false &&
    assessment.assessment_result.successor_append_may_proceed === false,
    'predecessor assessment boundary substitution');
  assert(assessment.policy_binding && assessment.policy_binding.artifact_ref === ASSESSMENT_POLICY_ID, 'assessment policy identity substitution');
  assert(claim.environment === 'live' && claim.claimed_status === 'observed' && claim.observation_method === 'system_record' && claim.consequence_class === 'other', 'live observed system-record claim required');
  assert(sourceEvidence.observation_present === true && sourceEvidence.test_fixture_only === false, 'fixture or non-observed source prohibited');
  assert(sourceEvidence.producer_id === Runtime.PRODUCER_ID && sourceEvidence.producer_artifact_type === Runtime.ARTIFACT_TYPE &&
    sourceEvidence.producer_artifact_version === Runtime.ARTIFACT_VERSION && sourceEvidence.producer_artifact_ref === producerObservation.observation_id,
    'source producer identity substitution');
  assert(canonicalEqual(sourceEvidence.source_payload, producerObservation), 'source payload / producer observation mismatch');
  assert(sourceEvidence.captured_at === producerObservation.observed_at, 'source capture time / producer observation mismatch');
  assert(producerObservation.repository === REPOSITORY, 'repository substitution');
  assert(producerObservation.workflow_name === WORKFLOW_NAME, 'workflow name substitution');
  assert(adapterPolicy.registered_profile.allowed_event_names.includes(producerObservation.event_name), 'event outside registered profile');
  Runtime.validateEventRef(producerObservation.event_name, producerObservation.ref);
  assert(claim.consequence_subject_ref === producerObservation.run_ref, 'consequence subject / runtime run mismatch');
  assert(claim.observation_time === producerObservation.observed_at, 'claim observation time / runtime observation mismatch');
  assert(claim.evidence_refs.includes(producerObservation.observation_id), 'claim missing exact producer observation ref');
  const head = Ingress.frontierHead(frontierEntry);
  const context = Ingress.frontierContext(frontierEntry);
  assert(canonicalEqual(claim.responsibility_event_head, head) && canonicalEqual(ingressReceipt.responsibility_event_head, head) && canonicalEqual(assessment.responsibility_event_head, head), 'responsibility-event head drift');
  assert(canonicalEqual(claim.semantic_frontier, context.semantic_frontier) && canonicalEqual(ingressReceipt.semantic_frontier, context.semantic_frontier) && canonicalEqual(assessment.semantic_frontier, context.semantic_frontier), 'semantic frontier drift');
  assert(canonicalEqual(claim.effect_frontier, context.effect_frontier) && canonicalEqual(ingressReceipt.effect_frontier, context.effect_frontier) && canonicalEqual(assessment.effect_frontier, context.effect_frontier), 'effect frontier drift');
  const evaluatedMs = parseTime(evaluatedAt, 'evaluated_at');
  for (const [label, value] of [
    ['producer observed_at', producerObservation.observed_at],
    ['claim claimed_at', claim.claimed_at],
    ['ingress received_at', ingressReceipt.received_at],
    ['assessment assessed_at', assessment.assessed_at]
  ]) assert(evaluatedMs >= parseTime(value, label), `adapter evaluated before ${label}`);
  return true;
}

async function exactBindings({ adapterPolicy, assessment, ingressReceipt, claim, sourceEvidence, producerObservation, frontierEntry }) {
  return {
    policy: await binding('ConsequenceObservationSourceAdapterPolicy', adapterPolicy.policy_id, adapterPolicy),
    assessment: await binding('ConsequenceObservationAssessment', assessment.assessment_id, assessment),
    ingress: await binding('ConsequenceObservationIngressReceipt', ingressReceipt.receipt_id, ingressReceipt),
    claim: await binding('ConsequenceObservationClaim', claim.claim_id, claim),
    source: await binding('ConsequenceObservationSourceEvidence', sourceEvidence.source_evidence_id, sourceEvidence),
    producer: await binding('GitHubActionsRuntimeObservation', producerObservation.observation_id, producerObservation),
    frontier: await binding(frontierEntry.artifact_type, frontierEntry.entry_id, frontierEntry)
  };
}

async function deriveReceipt({ adapterPolicy, assessment, ingressReceipt, claim, sourceEvidence, producerObservation, frontierEntry, evaluatedAt }) {
  const b = await exactBindings({ adapterPolicy, assessment, ingressReceipt, claim, sourceEvidence, producerObservation, frontierEntry });
  const seed = [b.policy.digest.value, b.assessment.digest.value, b.ingress.digest.value, b.claim.digest.value, b.source.digest.value, b.producer.digest.value, b.frontier.digest.value, evaluatedAt].join('|');
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  const candidate = producerObservation.context_class === 'candidate_pull_request';
  return {
    $schema: './consequence-observation-source-adapter-receipt.schema.json',
    artifact_type: 'ConsequenceObservationSourceAdapterReceipt',
    artifact_version: '0.1',
    receipt_id: `urn:uu-aap:consequence-observation-source-adapter-receipt:${idHash.slice(0, 24)}`,
    evaluated_at: evaluatedAt,
    policy_binding: b.policy,
    assessment_binding: b.assessment,
    ingress_receipt_binding: b.ingress,
    claim_binding: b.claim,
    source_evidence_binding: b.source,
    producer_observation_binding: b.producer,
    frontier_entry_binding: b.frontier,
    responsibility_event_head: clone(assessment.responsibility_event_head),
    semantic_frontier: clone(assessment.semantic_frontier),
    effect_frontier: clone(assessment.effect_frontier),
    runtime_context: {
      context_class: producerObservation.context_class,
      event_name: producerObservation.event_name,
      repository: producerObservation.repository,
      workflow_name: producerObservation.workflow_name,
      run_id: producerObservation.run_id,
      run_attempt: producerObservation.run_attempt,
      sha: producerObservation.sha,
      ref: producerObservation.ref,
      event_payload_digest: clone(producerObservation.event_payload_digest)
    },
    profile_decision: {
      status: 'eligible_as_typed_successor_source',
      policy_relative: true,
      source_specific_observation_semantics_qualified: true,
      typed_successor_source_eligible: true,
      candidate_evidence: candidate,
      main_bound_evidence: !candidate,
      successor_append_executed: false,
      successor_append_may_proceed: false,
      requires_separate_successor_append_operation: true
    },
    claims: {
      adapter_policy_applied: true,
      predecessor_assessment_deferred_profile_verified: true,
      exact_producer_profile_matched: true,
      source_specific_observation_semantics_qualified: true,
      typed_successor_source_eligible: true,
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
      truth_certified: false,
      successor_append_executed: false,
      successor_append_may_proceed: false,
      global_replay_protection_established: false,
      distributed_consensus_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
}

async function validateReceipt(args) {
  const { receipt } = args;
  assert(receipt && receipt.artifact_type === 'ConsequenceObservationSourceAdapterReceipt' && receipt.artifact_version === '0.1', 'adapter receipt v0.1 required');
  assert(!hasScalarKey(receipt), 'scalar fields prohibited in adapter receipt');
  await validateInputs({ ...args, evaluatedAt: receipt.evaluated_at });
  const expected = await deriveReceipt({ ...args, evaluatedAt: receipt.evaluated_at });
  assert(canonicalEqual(receipt, expected), 'adapter receipt substitution');
  assert(receipt.profile_decision.successor_append_executed === false && receipt.profile_decision.successor_append_may_proceed === false, 'source adapter cannot execute or permit successor append');
  assert(receipt.claims.adapter_policy_applied === true && receipt.claims.predecessor_assessment_deferred_profile_verified === true &&
    receipt.claims.exact_producer_profile_matched === true && receipt.claims.source_specific_observation_semantics_qualified === true &&
    receipt.claims.typed_successor_source_eligible === true && receipt.claims.stronger_claims_withheld === true,
    'adapter positive claims missing');
  assertFalseClaims(receipt.claims, 'receipt');
  return true;
}

async function buildReceipt(args) {
  await validateInputs(args);
  const receipt = await deriveReceipt(args);
  await validateReceipt({ ...args, receipt });
  return receipt;
}

module.exports = {
  POLICY_ID,
  ADAPTER_SCOPE,
  validatePolicy,
  validateInputs,
  exactBindings,
  buildReceipt,
  validateReceipt,
  digestJson,
  binding
};
