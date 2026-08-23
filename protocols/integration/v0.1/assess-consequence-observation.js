'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Ingress = require('./consequence-observation-ingress.js');

const POLICY_ID = 'urn:uu-aap:consequence-observation-assessment-policy:bounded-source-admissibility:1';
const ASSESSMENT_SCOPE = 'urn:uu-aap:consequence-observation-assessment-scope:bounded-source-admissibility-v0.1';
const INGRESS_POLICY_ID = 'urn:uu-aap:consequence-observation-ingress-policy:responsibility-event-frontier:1';
const GATES = [
  'ingress_package_exact',
  'source_bytes_exact',
  'producer_profile_recognized',
  'producer_artifact_identity_exact',
  'observation_present',
  'observation_chronology_valid',
  'observation_horizon_valid',
  'frontier_exact',
  'fixture_excluded_from_live_qualification',
  'source_semantics_profile_satisfied'
];
const GATE_STATUSES = ['qualified', 'not_qualified', 'deferred', 'out_of_scope'];
const FRONTIER_TYPES = ['ResponsibilityEventAppendLedgerEntry', 'ResponsibilityEventSuccessorLedgerEntry'];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score',
  'causal_score', 'responsibility_score', 'blame_score', 'rating'
]);
const FALSE_CLAIMS = [
  'new_external_consequence_observed', 'consequence_truth_certified',
  'generalized_external_consequence_causality_established', 'causal_proof_certified',
  'responsibility_for_consequence_attributed', 'responsibility_for_outcome_adjudicated',
  'legal_liability_established', 'legal_effect_established', 'moral_blame_assigned',
  'truth_certified', 'successor_adapter_authorized', 'successor_append_may_proceed',
  'global_replay_protection_established', 'distributed_consensus_established',
  'poai_materialization_event_recorded', 'universal_canonicality_established'
];

function assert(value, message) {
  if (!value) throw new Error(`ConsequenceObservationAssessment: ${message}`);
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
function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}
function assertFalseClaims(claims, label) {
  for (const key of FALSE_CLAIMS) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
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
function sameBinding(a, b) {
  return !!a && !!b && a.artifact_type === b.artifact_type && a.artifact_ref === b.artifact_ref &&
    a.digest && b.digest && a.digest.value === b.digest.value;
}

const EXPECTED_RULES = {
  ingress_package_exact: ['exact_ingress_package_revalidated'],
  source_bytes_exact: ['exact_source_bytes_revalidated', 'no_observation_source_not_applicable'],
  producer_profile_recognized: ['registered_source_profile_required', 'fixture_not_live_profile', 'no_observation_profile_not_applicable'],
  producer_artifact_identity_exact: ['producer_artifact_identity_exact', 'no_observation_source_not_applicable'],
  observation_present: ['source_declares_observation_present', 'claim_has_no_observation'],
  observation_chronology_valid: ['assessment_after_ingress_and_source'],
  observation_horizon_valid: ['evidence_cutoff_not_after_claim'],
  frontier_exact: ['authoritative_frontier_exact'],
  fixture_excluded_from_live_qualification: ['fixture_exclusion_enforced', 'live_environment_not_fixture'],
  source_semantics_profile_satisfied: ['source_specific_semantic_profile_required', 'fixture_not_live_semantic_profile', 'no_observation_semantics_not_applicable']
};

function validatePolicy(policy, assessedAt) {
  assert(policy && policy.artifact_type === 'ConsequenceObservationAssessmentPolicy' && policy.artifact_version === '0.1',
    'assessment policy v0.1 required');
  assert(policy.policy_id === POLICY_ID && policy.policy_version === 1, 'assessment policy ID/version substitution');
  assert(policy.assessment_scope === ASSESSMENT_SCOPE, 'assessment policy scope substitution');
  const applies = policy.applies_to || {};
  assert(applies.ingress_policy_id === INGRESS_POLICY_ID &&
    applies.ingress_receipt_artifact_type === 'ConsequenceObservationIngressReceipt' && applies.ingress_receipt_artifact_version === '0.1' &&
    applies.claim_artifact_type === 'ConsequenceObservationClaim' && applies.claim_artifact_version === '0.1' &&
    applies.source_evidence_artifact_type === 'ConsequenceObservationSourceEvidence' && applies.source_evidence_artifact_version === '0.1' &&
    sameArray(applies.frontier_artifact_types, FRONTIER_TYPES), 'assessment policy applicability substitution');
  assert(sameArray(policy.allowed_gate_statuses, GATE_STATUSES), 'assessment gate status vocabulary substitution');
  assert(policy.gate_rules && sameArray(Object.keys(policy.gate_rules), GATES), 'assessment gate vocabulary/order substitution');
  for (const gate of GATES) {
    const rule = policy.gate_rules[gate];
    assert(rule && rule.required === true && sameArray(rule.reason_codes, EXPECTED_RULES[gate]), `assessment policy rule substitution for ${gate}`);
  }
  assert(Array.isArray(policy.registered_live_source_profiles) && policy.registered_live_source_profiles.length === 0,
    'live source profile registry must remain empty in v0.1');
  const inv = policy.invariants || {};
  assert(inv.exact_byte_bindings_required === true && inv.frontier_exact_required === true &&
    inv.source_profile_required_for_live_observed === true && inv.live_observation_qualification_allowed === false &&
    inv.test_fixture_live_qualification_allowed === false && inv.successor_adapter_authorization_allowed === false &&
    inv.assessment_is_policy_relative === true && inv.scalar_scores_allowed === false,
    'assessment policy invariants weakened');
  assert(policy.claims && policy.claims.assessment_policy_defined === true && policy.claims.source_profile_registry_empty === true,
    'assessment policy positive claims missing');
  assertFalseClaims(policy.claims, 'assessment policy');
  assert(!hasScalarKey(policy), 'scalar fields prohibited in assessment policy');
  const assessedMs = parseTime(assessedAt, 'assessed_at');
  assert(assessedMs >= parseTime(policy.effective_from, 'policy effective_from'), 'assessment policy not yet effective');
  if (policy.effective_until !== null) assert(assessedMs < parseTime(policy.effective_until, 'policy effective_until'), 'assessment policy expired');
  return true;
}

async function expectedBindings({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry }) {
  return {
    policyBinding: await binding('ConsequenceObservationAssessmentPolicy', assessmentPolicy.policy_id, assessmentPolicy),
    ingressPolicyBinding: await binding('ConsequenceObservationIngressPolicy', ingressPolicy.policy_id, ingressPolicy),
    ingressReceiptBinding: await binding('ConsequenceObservationIngressReceipt', ingressReceipt.receipt_id, ingressReceipt),
    claimBinding: await binding('ConsequenceObservationClaim', claim.claim_id, claim),
    sourceEvidenceBinding: sourceEvidence ? await binding('ConsequenceObservationSourceEvidence', sourceEvidence.source_evidence_id, sourceEvidence) : null,
    frontierEntryBinding: await binding(frontierEntry.artifact_type, frontierEntry.entry_id, frontierEntry)
  };
}

async function validateInputs({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence = null, frontierEntry, assessedAt }) {
  validatePolicy(assessmentPolicy, assessedAt);
  assert(ingressPolicy && ingressPolicy.artifact_type === 'ConsequenceObservationIngressPolicy' && ingressPolicy.policy_id === INGRESS_POLICY_ID,
    'exact ingress policy required');
  assert(ingressReceipt && ingressReceipt.artifact_type === 'ConsequenceObservationIngressReceipt' && ingressReceipt.artifact_version === '0.1',
    'ingress receipt v0.1 required');
  assert(claim && claim.artifact_type === 'ConsequenceObservationClaim' && claim.artifact_version === '0.1', 'claim v0.1 required');
  assert(frontierEntry && FRONTIER_TYPES.includes(frontierEntry.artifact_type), 'supported authoritative frontier entry required');
  assert(!hasScalarKey({ ingressReceipt, claim, sourceEvidence, frontierEntry }), 'scalar fields prohibited in assessment inputs');
  await Ingress.validateIngressReceipt({ receipt: ingressReceipt, policy: ingressPolicy, claim, frontierEntry, sourceEvidence });
  const assessedMs = parseTime(assessedAt, 'assessed_at');
  assert(assessedMs >= parseTime(ingressReceipt.received_at, 'ingress received_at'), 'assessment before ingress receipt');
  assert(assessedMs >= parseTime(claim.claimed_at, 'claim claimed_at'), 'assessment before claim');
  assert(parseTime(claim.evidence_cutoff, 'evidence_cutoff') <= parseTime(claim.claimed_at, 'claim claimed_at'), 'observation horizon inversion');
  if (sourceEvidence) assert(assessedMs >= parseTime(sourceEvidence.captured_at, 'source captured_at'), 'assessment before source capture');
  assert(canonicalEqual(ingressReceipt.responsibility_event_head, Ingress.frontierHead(frontierEntry)), 'authoritative event head drift');
  const context = Ingress.frontierContext(frontierEntry);
  assert(canonicalEqual(ingressReceipt.semantic_frontier, context.semantic_frontier), 'authoritative semantic frontier drift');
  assert(canonicalEqual(ingressReceipt.effect_frontier, context.effect_frontier), 'authoritative effect frontier drift');
  return true;
}

function evidenceRefs({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry }) {
  const refs = [assessmentPolicy.policy_id, ingressPolicy.policy_id, ingressReceipt.receipt_id, claim.claim_id, frontierEntry.entry_id];
  if (sourceEvidence) refs.push(sourceEvidence.source_evidence_id, sourceEvidence.producer_artifact_ref);
  return [...new Set(refs)];
}

function gateDecisions({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry }) {
  const refs = evidenceRefs({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry });
  const observed = claim.claimed_status === 'observed';
  const fixture = claim.environment === 'test_fixture';
  return [
    { gate: 'ingress_package_exact', status: 'qualified', establishes_gate: true, reason_codes: ['exact_ingress_package_revalidated'], evidence_refs: refs },
    sourceEvidence
      ? { gate: 'source_bytes_exact', status: 'qualified', establishes_gate: true, reason_codes: ['exact_source_bytes_revalidated'], evidence_refs: refs }
      : { gate: 'source_bytes_exact', status: 'out_of_scope', establishes_gate: false, reason_codes: ['no_observation_source_not_applicable'], evidence_refs: refs },
    observed && !fixture
      ? { gate: 'producer_profile_recognized', status: 'deferred', establishes_gate: false, reason_codes: ['registered_source_profile_required'], evidence_refs: refs }
      : observed && fixture
        ? { gate: 'producer_profile_recognized', status: 'out_of_scope', establishes_gate: false, reason_codes: ['fixture_not_live_profile'], evidence_refs: refs }
        : { gate: 'producer_profile_recognized', status: 'out_of_scope', establishes_gate: false, reason_codes: ['no_observation_profile_not_applicable'], evidence_refs: refs },
    sourceEvidence
      ? { gate: 'producer_artifact_identity_exact', status: 'qualified', establishes_gate: true, reason_codes: ['producer_artifact_identity_exact'], evidence_refs: refs }
      : { gate: 'producer_artifact_identity_exact', status: 'out_of_scope', establishes_gate: false, reason_codes: ['no_observation_source_not_applicable'], evidence_refs: refs },
    observed
      ? { gate: 'observation_present', status: 'qualified', establishes_gate: true, reason_codes: ['source_declares_observation_present'], evidence_refs: refs }
      : { gate: 'observation_present', status: 'not_qualified', establishes_gate: false, reason_codes: ['claim_has_no_observation'], evidence_refs: refs },
    { gate: 'observation_chronology_valid', status: 'qualified', establishes_gate: true, reason_codes: ['assessment_after_ingress_and_source'], evidence_refs: refs },
    { gate: 'observation_horizon_valid', status: 'qualified', establishes_gate: true, reason_codes: ['evidence_cutoff_not_after_claim'], evidence_refs: refs },
    { gate: 'frontier_exact', status: 'qualified', establishes_gate: true, reason_codes: ['authoritative_frontier_exact'], evidence_refs: refs },
    fixture
      ? { gate: 'fixture_excluded_from_live_qualification', status: 'qualified', establishes_gate: true, reason_codes: ['fixture_exclusion_enforced'], evidence_refs: refs }
      : { gate: 'fixture_excluded_from_live_qualification', status: 'qualified', establishes_gate: true, reason_codes: ['live_environment_not_fixture'], evidence_refs: refs },
    !observed
      ? { gate: 'source_semantics_profile_satisfied', status: 'out_of_scope', establishes_gate: false, reason_codes: ['no_observation_semantics_not_applicable'], evidence_refs: refs }
      : fixture
        ? { gate: 'source_semantics_profile_satisfied', status: 'not_qualified', establishes_gate: false, reason_codes: ['fixture_not_live_semantic_profile'], evidence_refs: refs }
        : { gate: 'source_semantics_profile_satisfied', status: 'deferred', establishes_gate: false, reason_codes: ['source_specific_semantic_profile_required'], evidence_refs: refs }
  ];
}

function assessmentResult(claim) {
  let status, reason;
  if (claim.claimed_status !== 'observed') {
    status = 'not_qualified_no_observation';
    reason = 'no_observation';
  } else if (claim.environment === 'test_fixture') {
    status = 'not_qualified_test_fixture';
    reason = 'test_fixture';
  } else {
    status = 'deferred_source_profile_required';
    reason = 'source_profile_required';
  }
  return {
    status,
    result: {
      assessment_scope: ASSESSMENT_SCOPE,
      policy_relative: true,
      observation_qualified: false,
      source_profile_registered: false,
      source_specific_adapter_required: true,
      successor_adapter_eligible: false,
      successor_append_may_proceed: false,
      reason
    }
  };
}

async function buildAssessment({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence = null, frontierEntry, assessedAt }) {
  await validateInputs({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry, assessedAt });
  const bindings = await expectedBindings({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry });
  const resolved = assessmentResult(claim);
  const seed = [
    bindings.policyBinding.digest.value,
    bindings.ingressPolicyBinding.digest.value,
    bindings.ingressReceiptBinding.digest.value,
    bindings.claimBinding.digest.value,
    bindings.sourceEvidenceBinding ? bindings.sourceEvidenceBinding.digest.value : 'none',
    bindings.frontierEntryBinding.digest.value,
    assessedAt
  ].join('|');
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  const assessment = {
    $schema: './consequence-observation-assessment.schema.json',
    artifact_type: 'ConsequenceObservationAssessment',
    artifact_version: '0.1',
    assessment_id: `urn:uu-aap:consequence-observation-assessment:${idHash.slice(0, 24)}`,
    assessed_at: assessedAt,
    status: resolved.status,
    policy_binding: bindings.policyBinding,
    ingress_policy_binding: bindings.ingressPolicyBinding,
    ingress_receipt_binding: bindings.ingressReceiptBinding,
    claim_binding: bindings.claimBinding,
    source_evidence_binding: bindings.sourceEvidenceBinding,
    frontier_entry_binding: bindings.frontierEntryBinding,
    responsibility_event_head: clone(ingressReceipt.responsibility_event_head),
    semantic_frontier: clone(ingressReceipt.semantic_frontier),
    effect_frontier: clone(ingressReceipt.effect_frontier),
    gate_decisions: gateDecisions({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry }),
    assessment_result: resolved.result,
    claims: {
      assessment_policy_applied: true,
      ingress_package_verified: true,
      source_bytes_verified_if_present: true,
      responsibility_event_frontier_verified: true,
      observation_admissibility_assessed: true,
      stronger_claims_withheld: true,
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
      successor_adapter_authorized: false,
      successor_append_may_proceed: false,
      global_replay_protection_established: false,
      distributed_consensus_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  await validateAssessment({ assessment, assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry });
  return assessment;
}

async function validateAssessment({ assessment, assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence = null, frontierEntry }) {
  assert(assessment && assessment.artifact_type === 'ConsequenceObservationAssessment' && assessment.artifact_version === '0.1', 'assessment v0.1 required');
  assert(!hasScalarKey(assessment), 'scalar fields prohibited in assessment');
  await validateInputs({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry, assessedAt: assessment.assessed_at });
  const bindings = await expectedBindings({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry });
  assert(sameBinding(assessment.policy_binding, bindings.policyBinding), 'assessment policy binding substitution');
  assert(sameBinding(assessment.ingress_policy_binding, bindings.ingressPolicyBinding), 'ingress policy binding substitution');
  assert(sameBinding(assessment.ingress_receipt_binding, bindings.ingressReceiptBinding), 'ingress receipt binding substitution');
  assert(sameBinding(assessment.claim_binding, bindings.claimBinding), 'claim binding substitution');
  if (bindings.sourceEvidenceBinding) assert(sameBinding(assessment.source_evidence_binding, bindings.sourceEvidenceBinding), 'source evidence binding substitution');
  else assert(assessment.source_evidence_binding === null, 'source evidence binding must be null');
  assert(sameBinding(assessment.frontier_entry_binding, bindings.frontierEntryBinding), 'frontier entry binding substitution');
  assert(canonicalEqual(assessment.responsibility_event_head, ingressReceipt.responsibility_event_head), 'assessment event head substitution');
  assert(canonicalEqual(assessment.semantic_frontier, ingressReceipt.semantic_frontier), 'assessment semantic frontier substitution');
  assert(canonicalEqual(assessment.effect_frontier, ingressReceipt.effect_frontier), 'assessment effect frontier substitution');
  const expectedDecisions = gateDecisions({ assessmentPolicy, ingressPolicy, ingressReceipt, claim, sourceEvidence, frontierEntry });
  assert(canonicalEqual(assessment.gate_decisions, expectedDecisions), 'assessment gate decisions substitution');
  const resolved = assessmentResult(claim);
  assert(assessment.status === resolved.status && canonicalEqual(assessment.assessment_result, resolved.result), 'assessment result substitution');
  assert(assessment.assessment_result.observation_qualified === false && assessment.assessment_result.source_profile_registered === false &&
    assessment.assessment_result.successor_adapter_eligible === false && assessment.assessment_result.successor_append_may_proceed === false,
    'assessment v0.1 cannot qualify live observation or successor adapter');
  for (const key of [
    'assessment_policy_applied', 'ingress_package_verified', 'source_bytes_verified_if_present',
    'responsibility_event_frontier_verified', 'observation_admissibility_assessed', 'stronger_claims_withheld'
  ]) assert(assessment.claims && assessment.claims[key] === true, `positive claim ${key} missing`);
  assertFalseClaims(assessment.claims, 'assessment');
  const seed = [
    bindings.policyBinding.digest.value,
    bindings.ingressPolicyBinding.digest.value,
    bindings.ingressReceiptBinding.digest.value,
    bindings.claimBinding.digest.value,
    bindings.sourceEvidenceBinding ? bindings.sourceEvidenceBinding.digest.value : 'none',
    bindings.frontierEntryBinding.digest.value,
    assessment.assessed_at
  ].join('|');
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  assert(assessment.assessment_id === `urn:uu-aap:consequence-observation-assessment:${idHash.slice(0, 24)}`, 'assessment ID substitution');
  return true;
}

module.exports = {
  validatePolicy,
  validateInputs,
  expectedBindings,
  gateDecisions,
  assessmentResult,
  buildAssessment,
  validateAssessment,
  digestJson,
  binding
};
