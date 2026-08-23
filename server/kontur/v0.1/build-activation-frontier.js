'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Aggregator = require('./readiness-aggregator.js');

function assert(value, message) { if (!value) throw new Error(message); }
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
function assertFalseClaims(claims) {
  for (const key of [
    'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
    'execution_authority_granted', 'legal_responsibility_determined', 'legal_effect_established',
    'moral_blame_assigned', 'truth_certified', 'poai_materialization_event_recorded',
    'universal_canonicality_established'
  ]) {
    assert(claims && claims[key] === false, `KONTUR Activation Frontier: prohibited claim ${key}`);
  }
}

async function buildActivationFrontier({
  gitRevision,
  aggregationPolicy,
  responsibilityPolicy,
  readinessSignal,
  aggregationReceipt,
  acceptanceReceipt,
  recordedAt
}) {
  assert(/^git:[0-9a-f]{40}$/.test(gitRevision), 'KONTUR Activation Frontier: exact Git revision required');
  assert(Number.isFinite(Date.parse(recordedAt)), 'KONTUR Activation Frontier: invalid recorded_at');
  assert(acceptanceReceipt && acceptanceReceipt.artifact_type === 'KONTURReadinessAcceptanceReceipt',
    'KONTUR Activation Frontier: readiness acceptance receipt required');
  assert(acceptanceReceipt.decision === 'accepted_for_activation_precondition' &&
    acceptanceReceipt.claims.readiness_signal_accepted === true &&
    acceptanceReceipt.claims.activation_permitted_by_readiness_boundary === true &&
    acceptanceReceipt.claims.human_activation_step_still_required === true,
    'KONTUR Activation Frontier: readiness acceptance boundary not established');
  assertFalseClaims(acceptanceReceipt.claims);

  const expectedSignal = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const expectedAggregation = await binding('KONTURReadinessAggregationReceipt', aggregationReceipt.aggregation_id, aggregationReceipt);
  const expectedAcceptance = await binding('KONTURReadinessAcceptanceReceipt', acceptanceReceipt.acceptance_id, acceptanceReceipt);
  const expectedAggregationPolicy = await binding('KONTURReadinessAggregationPolicy', aggregationPolicy.policy_id, aggregationPolicy);
  const expectedResponsibilityPolicy = await binding('KONTURResponsibilityPolicy', responsibilityPolicy.policy_id, responsibilityPolicy);

  assert(sameBinding(acceptanceReceipt.readiness_signal_binding, expectedSignal),
    'KONTUR Activation Frontier: acceptance/readiness lineage substitution');
  assert(sameBinding(acceptanceReceipt.aggregation_receipt_binding, expectedAggregation),
    'KONTUR Activation Frontier: acceptance/aggregation lineage substitution');
  assert(sameBinding(acceptanceReceipt.responsibility_policy_binding, expectedResponsibilityPolicy),
    'KONTUR Activation Frontier: acceptance/responsibility policy lineage substitution');
  assert(sameBinding(aggregationReceipt.policy_binding, expectedAggregationPolicy),
    'KONTUR Activation Frontier: aggregation policy lineage substitution');
  assert(sameBinding(aggregationReceipt.readiness_signal_binding, expectedSignal),
    'KONTUR Activation Frontier: aggregation/readiness lineage substitution');
  assert(readinessSignal.system_id === responsibilityPolicy.system_id &&
    readinessSignal.server_instance_id === responsibilityPolicy.server_instance_id &&
    acceptanceReceipt.system_id === readinessSignal.system_id &&
    acceptanceReceipt.server_instance_id === readinessSignal.server_instance_id,
    'KONTUR Activation Frontier: system/server identity drift');
  assert(readinessSignal.readiness_epoch === acceptanceReceipt.readiness_epoch &&
    readinessSignal.readiness_epoch === aggregationReceipt.readiness_epoch,
    'KONTUR Activation Frontier: readiness epoch drift');
  await Aggregator.validateReadinessAcceptanceReceipt({
    receipt: acceptanceReceipt,
    aggregationReceipt,
    readinessSignal,
    responsibilityPolicy
  });

  const seed = [
    gitRevision,
    expectedAggregationPolicy.digest.value,
    expectedResponsibilityPolicy.digest.value,
    expectedSignal.digest.value,
    expectedAggregation.digest.value,
    expectedAcceptance.digest.value,
    recordedAt
  ].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './kontur-activation-frontier.schema.json',
    artifact_type: 'KONTURActivationFrontierReceipt',
    artifact_version: '0.1',
    frontier_id: `urn:uu-aap:kontur:activation-frontier:${hash.slice(0, 24)}`,
    recorded_at: recordedAt,
    git_revision: gitRevision,
    system_id: readinessSignal.system_id,
    server_instance_id: readinessSignal.server_instance_id,
    readiness_epoch: readinessSignal.readiness_epoch,
    aggregation_policy_binding: expectedAggregationPolicy,
    responsibility_policy_binding: expectedResponsibilityPolicy,
    readiness_signal_binding: expectedSignal,
    aggregation_receipt_binding: expectedAggregation,
    acceptance_receipt_binding: expectedAcceptance,
    status: 'activation_prompt_may_be_requested',
    claims: {
      canonical_frontier_bound: true,
      readiness_accepted: true,
      activation_prompt_may_be_requested: true,
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
}

module.exports = { digestJson, buildActivationFrontier };
