'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const CHECK_ORDER = [
  'protocol_registry_ready',
  'coordination_ready',
  'authority_ready',
  'provenance_ready',
  'causal_qualification_ready',
  'server_health_ready'
];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'likelihood', 'confidence_score',
  'readiness_score', 'responsibility_score', 'causal_score', 'rating', 'weight'
]);

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Readiness Aggregator: invalid ${label}`);
  return ms;
}
function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
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
function sameBinding(left, right) {
  return !!left && !!right && left.artifact_type === right.artifact_type &&
    left.artifact_ref === right.artifact_ref && left.digest && right.digest &&
    left.digest.value === right.digest.value;
}
function assertFalse(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}

function validateAggregationPolicy(policy, evaluatedMs) {
  assert(policy && policy.artifact_type === 'KONTURReadinessAggregationPolicy' && policy.artifact_version === '0.1',
    'KONTUR Readiness Aggregator: KONTURReadinessAggregationPolicy v0.1 required');
  assert(policy.policy_id === 'urn:uu-aap:kontur:readiness-aggregation-policy:reference-server:1' && policy.policy_version === 1,
    'KONTUR Readiness Aggregator: policy ID/version substitution');
  assert(policy.aggregation_scope === 'urn:uu-aap:kontur:readiness-aggregation-scope:reference-server-v0.1',
    'KONTUR Readiness Aggregator: aggregation scope substitution');
  assert(policy.system_id === 'urn:uu-aap:kontur:system:server-responsibility' &&
    policy.server_instance_id === 'urn:uu-aap:kontur:server:reference-primary',
    'KONTUR Readiness Aggregator: policy identity substitution');
  assert(policy.aggregation_rule === 'all_required_checks_pass',
    'KONTUR Readiness Aggregator: unsupported aggregation rule');
  const effectiveFrom = parseTime(policy.effective_from, 'policy effective_from');
  const effectiveUntil = policy.effective_until === null ? null : parseTime(policy.effective_until, 'policy effective_until');
  assert(evaluatedMs >= effectiveFrom && (effectiveUntil === null || evaluatedMs < effectiveUntil),
    'KONTUR Readiness Aggregator: policy not effective');
  assert(Number.isInteger(policy.evidence_freshness_seconds) && policy.evidence_freshness_seconds > 0,
    'KONTUR Readiness Aggregator: invalid evidence freshness');
  assert(Number.isInteger(policy.signal_validity_seconds) && policy.signal_validity_seconds > 0,
    'KONTUR Readiness Aggregator: invalid signal validity');
  assert(policy.producer_independence_required === true && policy.epoch_rule === 'explicit_monotonic_server_epoch',
    'KONTUR Readiness Aggregator: independence/epoch rule weakened');
  assert(Array.isArray(policy.required_checks) && policy.required_checks.length === CHECK_ORDER.length,
    'KONTUR Readiness Aggregator: exactly six policy checks required');
  const checkIds = policy.required_checks.map((rule) => rule.check_id);
  assert(JSON.stringify(checkIds) === JSON.stringify(CHECK_ORDER),
    'KONTUR Readiness Aggregator: policy check order/vocabulary substitution');
  const producerIds = policy.required_checks.map((rule) => rule.producer_id);
  assert(new Set(producerIds).size === producerIds.length,
    'KONTUR Readiness Aggregator: policy producers must be independent');
  assertFalse(policy.claims, [
    'global_readiness_self_certifiable_by_single_source', 'execution_authority_granted',
    'responsibility_accepted', 'kernel_activated', 'legal_responsibility_determined',
    'moral_blame_assigned', 'truth_certified', 'poai_materialization_event_recorded',
    'universal_canonicality_established'
  ], 'KONTURReadinessAggregationPolicy');
}

function sourceArtifactRef(checkId, artifact) {
  if (checkId === 'protocol_registry_ready') return artifact.registry_id;
  if (checkId === 'coordination_ready') return artifact.result_id;
  if (checkId === 'authority_ready') return artifact.verification_id;
  if (checkId === 'provenance_ready') return artifact.completion_id;
  if (checkId === 'causal_qualification_ready') return artifact.qualification_id;
  if (checkId === 'server_health_ready') return artifact.observation_id;
  return null;
}

function validateSourceSemantic(checkId, artifact, policy) {
  assert(artifact && typeof artifact === 'object', `KONTUR Readiness Aggregator: ${checkId} artifact required`);
  if (checkId === 'protocol_registry_ready') {
    assert(artifact.artifact_type === 'ProtocolRegistry' && artifact.artifact_version === '0.1',
      'KONTUR Readiness Aggregator: registry artifact type mismatch');
    assert(artifact.registry_id === 'urn:uu-aap:protocol-registry:v0.1' && artifact.scope === 'repository_scoped' &&
      artifact.repository === 'github:Matawaka/uu-aap',
      'KONTUR Readiness Aggregator: registry frontier mismatch');
    assert(artifact.resolution_policy && artifact.resolution_policy.selection === 'exact_protocol_id_and_version_only' &&
      artifact.resolution_policy.mutable_latest_alias === false && artifact.resolution_policy.implicit_upgrade === false,
      'KONTUR Readiness Aggregator: registry resolution weakened');
    assert(Array.isArray(artifact.entries) && artifact.entries.length > 0 && artifact.entries.every((entry) => entry.status === 'published'),
      'KONTUR Readiness Aggregator: registry does not contain published protocol entries');
    return;
  }

  if (checkId === 'coordination_ready') {
    assert(artifact.artifact_type === 'CCRPPolicyCoordinationResult' && artifact.conformance_level === 'CCRP/C5',
      'KONTUR Readiness Aggregator: coordination artifact type mismatch');
    assert(artifact.decision === 'coordinated' && Array.isArray(artifact.reason_codes) && artifact.reason_codes.length === 0 &&
      artifact.checks && Object.values(artifact.checks).every(Boolean),
      'KONTUR Readiness Aggregator: CCRP/C5 coordination not established');
    assert(artifact.requested_target === 'github:Matawaka/uu-aap',
      'KONTUR Readiness Aggregator: coordination target mismatch');
    assert(artifact.claims.policy_integrated_coordination_established === true &&
      artifact.claims.external_poai_authority_input_established === true &&
      artifact.claims.context_admission_input_established === true &&
      artifact.claims.execution_admission_input_established === true,
      'KONTUR Readiness Aggregator: coordination positive claims incomplete');
    assertFalse(artifact.claims, [
      'execution_admitted', 'materialization_permitted', 'poai_authority_established',
      'canonical_state_established', 'policy_relative_canonicality_established',
      'universal_canonicality_established', 'truth_certified', 'causal_proof_certified',
      'legal_responsibility_determined', 'legal_authority_established', 'legal_effect_established',
      'poai_v_conformance_established'
    ], 'CCRPPolicyCoordinationResult');
    return;
  }

  if (checkId === 'authority_ready') {
    assert(artifact.artifact_type === 'PoAIAuthorityVerificationResult' && artifact.artifact_version === '0.1-experimental',
      'KONTUR Readiness Aggregator: authority artifact type mismatch');
    assert(artifact.status === 'established' && Array.isArray(artifact.errors) && artifact.errors.length === 0,
      'KONTUR Readiness Aggregator: authority not established');
    assert(artifact.target === 'github:Matawaka/uu-aap' &&
      artifact.claims.root_declared === true && artifact.claims.root_evidence_observed === true &&
      artifact.claims.root_accepted_by_policy === true && artifact.claims.issuer_entitlement_chain_valid === true &&
      artifact.claims.materialization_authority_established === true,
      'KONTUR Readiness Aggregator: authority frontier incomplete');
    assertFalse(artifact.claims, [
      'policy_control_authority_established', 'legal_identity_verified', 'legal_authority_established',
      'universal_authority_established', 'universal_canonicality_established', 'truth_certified',
      'causal_proof_certified', 'legal_responsibility_determined', 'moral_correctness_established',
      'legal_effect_established', 'poai_v_conformance_established'
    ], 'PoAIAuthorityVerificationResult');
    return;
  }

  if (checkId === 'provenance_ready') {
    assert(artifact.artifact_type === 'ProvenanceCompletionReceipt' && artifact.artifact_version === '0.1',
      'KONTUR Readiness Aggregator: provenance artifact type mismatch');
    assert(artifact.semantic_binding && artifact.semantic_binding.target === 'github:Matawaka/uu-aap',
      'KONTUR Readiness Aggregator: provenance target mismatch');
    assert(artifact.claims.bounded_chain_preserved === true &&
      artifact.claims.context_frame_provenance_established === true &&
      artifact.claims.intent_provenance_established === true &&
      artifact.claims.all_upstream_evidence_artifact_bytes_bound === true &&
      artifact.claims.machine_semantic_origin_provenance_complete === true &&
      artifact.claims.policy_relative_canonicality_preserved === true,
      'KONTUR Readiness Aggregator: provenance completion incomplete');
    assertFalse(artifact.claims, [
      'human_cognitive_origin_provenance_established', 'remote_branch_or_ref_canonicality_established',
      'poai_materialization_event_recorded', 'poai_successor_record_identity_inferred',
      'universal_canonicality_established', 'truth_certified', 'causal_proof_certified',
      'legal_responsibility_determined', 'legal_effect_established', 'moral_correctness_established',
      'poai_v_conformance_established'
    ], 'ProvenanceCompletionReceipt');
    return;
  }

  if (checkId === 'causal_qualification_ready') {
    assert(artifact.artifact_type === 'CausalClaimQualification' && artifact.artifact_version === '0.1',
      'KONTUR Readiness Aggregator: causal qualification artifact type mismatch');
    assert(artifact.semantic_binding && artifact.semantic_binding.target === 'github:Matawaka/uu-aap',
      'KONTUR Readiness Aggregator: causal qualification target mismatch');
    assert(artifact.qualification_result && artifact.qualification_result.status === 'bounded_predicates_qualified_stronger_claims_withheld' &&
      artifact.qualification_result.policy_relative === true && artifact.qualification_result.qualified_predicate_count === 2 &&
      artifact.qualification_result.withheld_predicate_count === 5 &&
      artifact.qualification_result.universal_causal_truth_established === false,
      'KONTUR Readiness Aggregator: causal qualification boundary invalid');
    assert(artifact.claims.exact_qualification_policy_applied === true &&
      artifact.claims.predecessor_evidence_verified === true && artifact.claims.typed_causal_predicates_evaluated === true &&
      artifact.claims.bounded_execution_contribution_qualified === true &&
      artifact.claims.model_relative_intervention_sensitivity_qualified === true &&
      artifact.claims.stronger_causal_predicates_withheld === true && artifact.claims.uncertainty_preserved === true,
      'KONTUR Readiness Aggregator: causal qualification positive claims incomplete');
    assertFalse(artifact.claims, [
      'necessary_cause_established', 'sufficient_cause_established', 'exclusive_cause_established',
      'counterfactual_causal_proof_certified', 'generalized_external_consequence_causality_established',
      'universal_causal_truth_established', 'responsibility_for_outcome_adjudicated',
      'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned',
      'moral_correctness_established', 'truth_certified', 'remote_branch_or_ref_canonicality_established',
      'poai_materialization_event_recorded', 'poai_successor_record_identity_inferred',
      'universal_canonicality_established', 'poai_v_conformance_established'
    ], 'CausalClaimQualification');
    return;
  }

  if (checkId === 'server_health_ready') {
    assert(artifact.artifact_type === 'KONTURServerHealthObservation' && artifact.artifact_version === '0.1',
      'KONTUR Readiness Aggregator: server health artifact type mismatch');
    assert(artifact.system_id === policy.system_id && artifact.server_instance_id === policy.server_instance_id,
      'KONTUR Readiness Aggregator: server health identity mismatch');
    assert(artifact.status === 'healthy' && Array.isArray(artifact.components) && artifact.components.length > 0 &&
      artifact.components.every((component) => component.status === 'pass'),
      'KONTUR Readiness Aggregator: server health is not healthy');
    assert(artifact.claims.server_health_observed === true,
      'KONTUR Readiness Aggregator: server health observation claim missing');
    assertFalse(artifact.claims, [
      'global_readiness_established', 'execution_authority_granted', 'responsibility_accepted',
      'kernel_activated', 'legal_responsibility_determined', 'moral_blame_assigned',
      'truth_certified', 'universal_canonicality_established'
    ], 'KONTURServerHealthObservation');
    return;
  }

  throw new Error(`KONTUR Readiness Aggregator: unsupported check ${checkId}`);
}

async function buildEvidenceRecord({ checkId, producerId, artifact, observedAt, policy, aggregatedMs }) {
  const rule = policy.required_checks.find((item) => item.check_id === checkId);
  assert(rule, `KONTUR Readiness Aggregator: check not declared by policy: ${checkId}`);
  assert(producerId === rule.producer_id, `KONTUR Readiness Aggregator: producer substitution for ${checkId}`);
  assert(artifact && artifact.artifact_type === rule.allowed_artifact_type,
    `KONTUR Readiness Aggregator: source artifact type substitution for ${checkId}`);
  validateSourceSemantic(checkId, artifact, policy);
  const observedMs = parseTime(observedAt, `${checkId} observed_at`);
  assert(observedMs <= aggregatedMs, `KONTUR Readiness Aggregator: ${checkId} observed after aggregation`);
  assert(aggregatedMs - observedMs <= policy.evidence_freshness_seconds * 1000,
    `KONTUR Readiness Aggregator: stale evidence for ${checkId}`);
  const ref = sourceArtifactRef(checkId, artifact);
  assert(typeof ref === 'string' && ref.length > 0, `KONTUR Readiness Aggregator: missing source artifact ref for ${checkId}`);
  return {
    check_id: checkId,
    producer_id: producerId,
    source_artifact_type: artifact.artifact_type,
    source_artifact_ref: ref,
    source_artifact_digest: digest(await digestJson(artifact)),
    observed_at: observedAt,
    decision: 'pass',
    reason_codes: ['source_semantics_valid', 'source_digest_bound', 'source_assurance_boundary_preserved'],
    claims: {
      source_validation_observed: true,
      global_readiness_established: false,
      kernel_activated: false,
      execution_authority_granted: false,
      legal_responsibility_determined: false,
      truth_certified: false
    }
  };
}

async function aggregateReadiness({ policy, sources, aggregatedAt, readinessEpoch }) {
  const aggregatedMs = parseTime(aggregatedAt, 'aggregated_at');
  validateAggregationPolicy(policy, aggregatedMs);
  assert(!hasScalarKey({ policy, sources, readinessEpoch }),
    'KONTUR Readiness Aggregator: scalar readiness/responsibility scores prohibited');
  assert(Number.isInteger(readinessEpoch) && readinessEpoch >= 1,
    'KONTUR Readiness Aggregator: explicit positive readiness epoch required');
  assert(Array.isArray(sources) && sources.length === CHECK_ORDER.length,
    'KONTUR Readiness Aggregator: exactly six source evidence inputs required');
  const checkIds = sources.map((source) => source.checkId);
  assert(new Set(checkIds).size === CHECK_ORDER.length && CHECK_ORDER.every((check) => checkIds.includes(check)),
    'KONTUR Readiness Aggregator: missing or duplicate required check');
  const producerIds = sources.map((source) => source.producerId);
  assert(new Set(producerIds).size === producerIds.length,
    'KONTUR Readiness Aggregator: producer independence violated');

  const records = [];
  for (const checkId of CHECK_ORDER) {
    const source = sources.find((item) => item.checkId === checkId);
    records.push(await buildEvidenceRecord({ ...source, checkId, policy, aggregatedMs }));
  }
  assert(records.every((record) => record.decision === 'pass'),
    'KONTUR Readiness Aggregator: all required checks must pass');

  const evidenceDigest = await digestJson(records);
  const evidenceSeed = `${policy.policy_id}|${readinessEpoch}|${aggregatedAt}|${evidenceDigest}`;
  const evidenceHash = await Binding.sha256Hex(Binding.utf8Bytes(evidenceSeed));
  const evidenceSet = {
    $schema: './kontur-readiness-aggregation.schema.json#/$defs/evidenceSet',
    artifact_type: 'KONTURReadinessEvidenceSet',
    artifact_version: '0.1',
    evidence_set_id: `urn:uu-aap:kontur:readiness-evidence-set:${evidenceHash.slice(0, 24)}`,
    system_id: policy.system_id,
    server_instance_id: policy.server_instance_id,
    captured_at: aggregatedAt,
    evidence: records,
    claims: {
      six_source_frontier_bound: true,
      producer_independence_preserved: true,
      global_readiness_established: false,
      kernel_activated: false,
      truth_certified: false
    }
  };

  const policyBinding = await binding('KONTURReadinessAggregationPolicy', policy.policy_id, policy);
  const evidenceSetBinding = await binding('KONTURReadinessEvidenceSet', evidenceSet.evidence_set_id, evidenceSet);
  const validUntil = new Date(aggregatedMs + policy.signal_validity_seconds * 1000).toISOString();
  const signalSeed = `${policyBinding.digest.value}|${evidenceSetBinding.digest.value}|${readinessEpoch}|${aggregatedAt}|${validUntil}`;
  const signalHash = await Binding.sha256Hex(Binding.utf8Bytes(signalSeed));
  const readinessSignal = {
    $schema: './kontur-readiness-signal.schema.json',
    artifact_type: 'KONTURReadinessSignal',
    artifact_version: '0.1',
    signal_id: `urn:uu-aap:kontur:readiness:${signalHash.slice(0, 24)}`,
    system_id: policy.system_id,
    server_instance_id: policy.server_instance_id,
    readiness_epoch: readinessEpoch,
    emitted_at: aggregatedAt,
    valid_until: validUntil,
    source_ref: evidenceSet.evidence_set_id,
    checks: records.map((record) => ({
      check_id: record.check_id,
      status: 'pass',
      observed_at: record.observed_at,
      evidence_ref: record.source_artifact_ref
    })),
    ready: true,
    claims: {
      readiness_observed: true,
      execution_authority_granted: false,
      responsibility_accepted: false,
      kernel_activated: false,
      legal_responsibility_determined: false,
      moral_blame_assigned: false,
      truth_certified: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  const readinessSignalBinding = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const aggregationSeed = `${policyBinding.digest.value}|${evidenceSetBinding.digest.value}|${readinessSignalBinding.digest.value}|${aggregatedAt}`;
  const aggregationHash = await Binding.sha256Hex(Binding.utf8Bytes(aggregationSeed));
  const receipt = {
    $schema: './kontur-readiness-aggregation.schema.json',
    artifact_type: 'KONTURReadinessAggregationReceipt',
    artifact_version: '0.1',
    aggregation_id: `urn:uu-aap:kontur:readiness-aggregation:${aggregationHash.slice(0, 24)}`,
    aggregated_at: aggregatedAt,
    policy_binding: policyBinding,
    evidence_set_binding: evidenceSetBinding,
    evidence_set: evidenceSet,
    readiness_epoch: readinessEpoch,
    decisions: records.map((record) => ({
      check_id: record.check_id,
      producer_id: record.producer_id,
      status: 'pass',
      evidence_ref: record.source_artifact_ref
    })),
    aggregation_result: {
      rule: 'all_required_checks_pass',
      ready: true,
      passed_check_count: 6,
      failed_check_count: 0,
      producer_independence_verified: true
    },
    readiness_signal_binding: readinessSignalBinding,
    readiness_signal_ref: readinessSignal.signal_id,
    verification: {
      policy_exact: true,
      evidence_set_exact: true,
      six_required_checks_exact: true,
      producer_independence_exact: true,
      source_artifact_types_exact: true,
      source_digests_exact: true,
      evidence_freshness_enforced: true,
      all_checks_pass: true,
      epoch_explicit: true,
      signal_boundary_preserved: true
    },
    claims: {
      global_readiness_aggregated: true,
      readiness_signal_emitted: true,
      single_source_self_certified_global_readiness: false,
      kernel_activated: false,
      responsibility_state_created: false,
      execution_authority_granted: false,
      legal_responsibility_determined: false,
      moral_blame_assigned: false,
      truth_certified: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  await validateAggregationReceipt({ receipt, readinessSignal, policy, sources });
  return { evidenceSet, readinessSignal, receipt };
}

async function validateAggregationReceipt({ receipt, readinessSignal, policy, sources }) {
  const aggregatedMs = parseTime(receipt && receipt.aggregated_at, 'receipt aggregated_at');
  validateAggregationPolicy(policy, aggregatedMs);
  assert(receipt && receipt.artifact_type === 'KONTURReadinessAggregationReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Readiness Aggregator: invalid aggregation receipt');
  assert(!hasScalarKey(receipt), 'KONTUR Readiness Aggregator: scalar score injected into aggregation receipt');
  const expectedPolicy = await binding('KONTURReadinessAggregationPolicy', policy.policy_id, policy);
  assert(sameBinding(receipt.policy_binding, expectedPolicy), 'KONTUR Readiness Aggregator: policy binding substitution');
  const expectedEvidenceSet = await binding('KONTURReadinessEvidenceSet', receipt.evidence_set.evidence_set_id, receipt.evidence_set);
  assert(sameBinding(receipt.evidence_set_binding, expectedEvidenceSet), 'KONTUR Readiness Aggregator: evidence set binding substitution');
  const expectedSignal = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  assert(sameBinding(receipt.readiness_signal_binding, expectedSignal) && receipt.readiness_signal_ref === readinessSignal.signal_id,
    'KONTUR Readiness Aggregator: readiness signal binding substitution');
  assert(readinessSignal.source_ref === receipt.evidence_set.evidence_set_id && readinessSignal.readiness_epoch === receipt.readiness_epoch,
    'KONTUR Readiness Aggregator: signal lineage/epoch mismatch');
  assert(readinessSignal.ready === true && receipt.aggregation_result.ready === true,
    'KONTUR Readiness Aggregator: positive aggregation must emit ready signal');
  assert(Array.isArray(receipt.evidence_set.evidence) && receipt.evidence_set.evidence.length === 6 &&
    Array.isArray(receipt.decisions) && receipt.decisions.length === 6,
    'KONTUR Readiness Aggregator: exact six-source frontier required');
  const producerIds = receipt.evidence_set.evidence.map((record) => record.producer_id);
  assert(new Set(producerIds).size === 6, 'KONTUR Readiness Aggregator: producer independence lost');
  for (const checkId of CHECK_ORDER) {
    const record = receipt.evidence_set.evidence.find((item) => item.check_id === checkId);
    const decision = receipt.decisions.find((item) => item.check_id === checkId);
    const signalCheck = readinessSignal.checks.find((item) => item.check_id === checkId);
    assert(record && decision && signalCheck, `KONTUR Readiness Aggregator: missing ${checkId} lineage`);
    assert(record.decision === 'pass' && decision.status === 'pass' && signalCheck.status === 'pass',
      `KONTUR Readiness Aggregator: ${checkId} did not remain pass`);
    assert(decision.producer_id === record.producer_id && decision.evidence_ref === record.source_artifact_ref &&
      signalCheck.evidence_ref === record.source_artifact_ref && signalCheck.observed_at === record.observed_at,
      `KONTUR Readiness Aggregator: ${checkId} evidence lineage drift`);
    const source = sources.find((item) => item.checkId === checkId);
    assert(source, `KONTUR Readiness Aggregator: source artifact missing during validation: ${checkId}`);
    assert(record.source_artifact_digest.value === await digestJson(source.artifact),
      `KONTUR Readiness Aggregator: ${checkId} source digest substitution`);
    validateSourceSemantic(checkId, source.artifact, policy);
  }
  assert(receipt.claims.global_readiness_aggregated === true && receipt.claims.readiness_signal_emitted === true,
    'KONTUR Readiness Aggregator: positive readiness claims missing');
  assertFalse(receipt.claims, [
    'single_source_self_certified_global_readiness', 'kernel_activated', 'responsibility_state_created',
    'execution_authority_granted', 'legal_responsibility_determined', 'moral_blame_assigned',
    'truth_certified', 'poai_materialization_event_recorded', 'universal_canonicality_established'
  ], 'KONTURReadinessAggregationReceipt');
  return true;
}

function validateResponsibilityPolicyBoundary(policy) {
  assert(policy && policy.artifact_type === 'KONTURResponsibilityPolicy' && policy.artifact_version === '0.1',
    'KONTUR Readiness Acceptance: KONTURResponsibilityPolicy v0.1 required');
  assert(policy.policy_id === 'urn:uu-aap:kontur:responsibility-policy:reference-server:1' && policy.policy_version === 1,
    'KONTUR Readiness Acceptance: responsibility policy substitution');
  assert(policy.system_id === 'urn:uu-aap:kontur:system:server-responsibility' &&
    policy.server_instance_id === 'urn:uu-aap:kontur:server:reference-primary',
    'KONTUR Readiness Acceptance: responsibility policy identity mismatch');
  assert(Array.isArray(policy.required_readiness_checks) &&
    JSON.stringify(policy.required_readiness_checks) === JSON.stringify(CHECK_ORDER),
    'KONTUR Readiness Acceptance: responsibility policy readiness vocabulary mismatch');
  assert(policy.invariants && policy.invariants.single_active_holder === true && policy.invariants.epoch_monotonic === true &&
    policy.invariants.fencing_required === true && policy.invariants.fresh_readiness_required_for_recovery === true,
    'KONTUR Readiness Acceptance: responsibility policy invariants weakened');
  assertFalse(policy.claims, [
    'legal_responsibility_determined', 'legal_effect_established', 'moral_blame_assigned',
    'truth_certified', 'universal_causality_established', 'poai_materialization_event_recorded',
    'universal_canonicality_established'
  ], 'KONTURResponsibilityPolicy');
}

function validateKernelReadinessBoundary(signal, responsibilityPolicy, evaluatedMs, minimumEpoch) {
  assert(signal && signal.artifact_type === 'KONTURReadinessSignal' && signal.artifact_version === '0.1',
    'KONTUR Readiness Acceptance: KONTURReadinessSignal v0.1 required');
  assert(signal.system_id === responsibilityPolicy.system_id && signal.server_instance_id === responsibilityPolicy.server_instance_id,
    'KONTUR Readiness Acceptance: signal identity mismatch');
  assert(Number.isInteger(signal.readiness_epoch) && signal.readiness_epoch >= minimumEpoch,
    'KONTUR Readiness Acceptance: stale readiness epoch');
  const emittedMs = parseTime(signal.emitted_at, 'signal emitted_at');
  const validUntilMs = parseTime(signal.valid_until, 'signal valid_until');
  assert(emittedMs < validUntilMs && emittedMs <= evaluatedMs && evaluatedMs < validUntilMs,
    'KONTUR Readiness Acceptance: readiness signal expired or not yet valid');
  assert(signal.ready === true, 'KONTUR Readiness Acceptance: signal not ready');
  assert(Array.isArray(signal.checks) && signal.checks.length === CHECK_ORDER.length,
    'KONTUR Readiness Acceptance: exact readiness check set required');
  const ids = signal.checks.map((check) => check.check_id);
  assert(new Set(ids).size === ids.length && CHECK_ORDER.every((id) => ids.includes(id)),
    'KONTUR Readiness Acceptance: missing or duplicate readiness check');
  for (const check of signal.checks) {
    assert(check.status === 'pass' && typeof check.evidence_ref === 'string' && check.evidence_ref.length > 0,
      `KONTUR Readiness Acceptance: failed readiness check ${check.check_id}`);
    assert(parseTime(check.observed_at, `${check.check_id} observed_at`) <= emittedMs,
      `KONTUR Readiness Acceptance: ${check.check_id} observed after signal emission`);
  }
  for (const required of responsibilityPolicy.required_readiness_checks) {
    assert(ids.includes(required), `KONTUR Readiness Acceptance: missing policy check ${required}`);
  }
  assert(signal.claims.readiness_observed === true,
    'KONTUR Readiness Acceptance: readiness observation claim missing');
  assertFalse(signal.claims, [
    'execution_authority_granted', 'responsibility_accepted', 'kernel_activated',
    'legal_responsibility_determined', 'moral_blame_assigned', 'truth_certified',
    'poai_materialization_event_recorded', 'universal_canonicality_established'
  ], 'KONTURReadinessSignal');
}

async function dryRunAcceptReadiness({
  aggregationReceipt,
  readinessSignal,
  responsibilityPolicy,
  evaluatedAt,
  minimumEpoch = 1,
  parallelActiveHolders = []
}) {
  const evaluatedMs = parseTime(evaluatedAt, 'acceptance evaluated_at');
  assert(!hasScalarKey({ aggregationReceipt, readinessSignal, responsibilityPolicy }),
    'KONTUR Readiness Acceptance: scalar score prohibited');
  validateResponsibilityPolicyBoundary(responsibilityPolicy);
  validateKernelReadinessBoundary(readinessSignal, responsibilityPolicy, evaluatedMs, minimumEpoch);
  assert(Array.isArray(parallelActiveHolders) && parallelActiveHolders.length === 0,
    'KONTUR Readiness Acceptance: parallel active holder frontier not empty');
  assert(aggregationReceipt && aggregationReceipt.artifact_type === 'KONTURReadinessAggregationReceipt' &&
    aggregationReceipt.claims.global_readiness_aggregated === true && aggregationReceipt.claims.kernel_activated === false,
    'KONTUR Readiness Acceptance: exact positive aggregation receipt required');
  const expectedSignal = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  assert(sameBinding(aggregationReceipt.readiness_signal_binding, expectedSignal) &&
    aggregationReceipt.readiness_signal_ref === readinessSignal.signal_id,
    'KONTUR Readiness Acceptance: aggregation/signal lineage substitution');
  assert(aggregationReceipt.readiness_epoch === readinessSignal.readiness_epoch,
    'KONTUR Readiness Acceptance: readiness epoch substitution');

  const aggregationBinding = await binding('KONTURReadinessAggregationReceipt', aggregationReceipt.aggregation_id, aggregationReceipt);
  const responsibilityPolicyBinding = await binding('KONTURResponsibilityPolicy', responsibilityPolicy.policy_id, responsibilityPolicy);
  const seed = `${aggregationBinding.digest.value}|${expectedSignal.digest.value}|${responsibilityPolicyBinding.digest.value}|${evaluatedAt}`;
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  const receipt = {
    $schema: './kontur-readiness-acceptance.schema.json',
    artifact_type: 'KONTURReadinessAcceptanceReceipt',
    artifact_version: '0.1',
    acceptance_id: `urn:uu-aap:kontur:readiness-acceptance:${hash.slice(0, 24)}`,
    evaluated_at: evaluatedAt,
    system_id: readinessSignal.system_id,
    server_instance_id: readinessSignal.server_instance_id,
    readiness_epoch: readinessSignal.readiness_epoch,
    aggregation_receipt_binding: aggregationBinding,
    readiness_signal_binding: expectedSignal,
    responsibility_policy_binding: responsibilityPolicyBinding,
    decision: 'accepted_for_activation_precondition',
    checks: {
      aggregation_lineage_exact: true,
      readiness_signal_exact: true,
      responsibility_policy_exact: true,
      identity_exact: true,
      freshness_valid: true,
      epoch_acceptable: true,
      all_required_checks_pass: true,
      no_parallel_active_holder_asserted: true,
      assurance_boundary_preserved: true
    },
    claims: {
      readiness_signal_accepted: true,
      activation_permitted_by_readiness_boundary: true,
      human_activation_step_still_required: true,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  await validateReadinessAcceptanceReceipt({ receipt, aggregationReceipt, readinessSignal, responsibilityPolicy });
  return receipt;
}

async function validateReadinessAcceptanceReceipt({ receipt, aggregationReceipt, readinessSignal, responsibilityPolicy }) {
  assert(receipt && receipt.artifact_type === 'KONTURReadinessAcceptanceReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Readiness Acceptance: invalid receipt');
  assert(!hasScalarKey(receipt), 'KONTUR Readiness Acceptance: scalar score injected');
  const expectedAggregation = await binding('KONTURReadinessAggregationReceipt', aggregationReceipt.aggregation_id, aggregationReceipt);
  const expectedSignal = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const expectedPolicy = await binding('KONTURResponsibilityPolicy', responsibilityPolicy.policy_id, responsibilityPolicy);
  assert(sameBinding(receipt.aggregation_receipt_binding, expectedAggregation),
    'KONTUR Readiness Acceptance: aggregation receipt binding substitution');
  assert(sameBinding(receipt.readiness_signal_binding, expectedSignal),
    'KONTUR Readiness Acceptance: readiness signal binding substitution');
  assert(sameBinding(receipt.responsibility_policy_binding, expectedPolicy),
    'KONTUR Readiness Acceptance: responsibility policy binding substitution');
  assert(receipt.system_id === readinessSignal.system_id && receipt.server_instance_id === readinessSignal.server_instance_id &&
    receipt.readiness_epoch === readinessSignal.readiness_epoch,
    'KONTUR Readiness Acceptance: identity/epoch drift');
  assert(receipt.decision === 'accepted_for_activation_precondition' &&
    Object.values(receipt.checks).every(Boolean),
    'KONTUR Readiness Acceptance: precondition not fully accepted');
  assert(receipt.claims.readiness_signal_accepted === true &&
    receipt.claims.activation_permitted_by_readiness_boundary === true &&
    receipt.claims.human_activation_step_still_required === true,
    'KONTUR Readiness Acceptance: positive precondition claims missing');
  assertFalse(receipt.claims, [
    'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
    'execution_authority_granted', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_blame_assigned', 'truth_certified', 'poai_materialization_event_recorded',
    'universal_canonicality_established'
  ], 'KONTURReadinessAcceptanceReceipt');
  return true;
}

module.exports = {
  CHECK_ORDER,
  digestJson,
  aggregateReadiness,
  validateAggregationReceipt,
  dryRunAcceptReadiness,
  validateReadinessAcceptanceReceipt,
  validateSourceSemantic
};
