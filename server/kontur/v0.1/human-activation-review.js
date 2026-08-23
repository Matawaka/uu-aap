'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const REQUIRED_CONFIRMATIONS = [
  'exact_revision_and_review_packet_understood',
  'existing_permissions_only',
  'no_permission_bypass_or_escalation',
  'activation_intent_is_separate_future_artifact',
  'preflight_is_separate_and_must_be_fresh',
  'execute_command_requires_separate_human_step',
  'holder_scopes_and_lease_must_be_explicit_before_intent',
  'activation_does_not_establish_legal_truth_or_universal_authority'
];

function assert(value, message) {
  if (!value) throw new Error(message);
}

async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}

function digest(value) {
  return {
    canonicalization: 'RFC8785-JCS',
    digest_algorithm: 'SHA-256',
    digest_encoding: 'hex',
    value
  };
}

async function binding(artifactType, artifactRef, artifact) {
  return {
    artifact_type: artifactType,
    artifact_ref: artifactRef,
    digest: digest(await digestJson(artifact))
  };
}

function assertCheckpoint(checkpoint, gitRevision) {
  assert(checkpoint && checkpoint.artifact_type === 'ProjectReadinessCheckpointReceipt' && checkpoint.artifact_version === '0.1',
    'Human Activation Review: exact ProjectReadinessCheckpointReceipt v0.1 required');
  assert(checkpoint.project_id === 'Matawaka/uu-aap', 'Human Activation Review: checkpoint project mismatch');
  assert(checkpoint.git_revision === gitRevision, 'Human Activation Review: checkpoint revision drift');
  assert(checkpoint.status === 'project_readiness_checkpoint_established',
    'Human Activation Review: project readiness checkpoint not established');
  const claims = checkpoint.claims || {};
  assert(claims.project_readiness_checkpoint_established === true, 'Human Activation Review: checkpoint positive claim missing');
  assert(claims.current_main_frontier_verified === true, 'Human Activation Review: current-main frontier not verified');
  assert(claims.human_activation_step_still_required === true, 'Human Activation Review: human activation boundary missing');
  for (const key of [
    'kontur_activation_authorized', 'kontur_activated', 'execution_authority_granted',
    'repository_ownership_transferred', 'canonical_origin_mutated', 'legal_authority_established',
    'truth_certified', 'distributed_consensus_established', 'universal_architecture_completeness_proven'
  ]) assert(claims[key] === false, `Human Activation Review: unsafe checkpoint claim ${key}`);
}

function assertCurrentMainVerification(receipt, gitRevision) {
  assert(receipt && receipt.artifact_type === 'KONTURCurrentMainFrontierVerificationReceipt' && receipt.artifact_version === '0.1',
    'Human Activation Review: exact current-main verification receipt required');
  assert(receipt.repository === 'Matawaka/uu-aap', 'Human Activation Review: receipt repository mismatch');
  assert(receipt.decision === 'current_main_frontier_verified_for_workflow_event',
    'Human Activation Review: current-main frontier decision not verified');
  assert(receipt.frontier_git_revision === gitRevision, 'Human Activation Review: frontier revision drift');
  const ctx = receipt.workflow_context || {};
  assert(ctx.event_name === 'push' && ctx.ref === 'refs/heads/main',
    'Human Activation Review: canonical main push context required');
  assert(`git:${ctx.github_sha}` === gitRevision && ctx.github_sha === ctx.checkout_sha,
    'Human Activation Review: workflow SHA drift');
  const claims = receipt.claims || {};
  assert(claims.current_main_frontier_verified_for_workflow_event === true,
    'Human Activation Review: positive current-main verification claim required');
  assert(claims.activation_prompt_may_be_requested === true,
    'Human Activation Review: activation prompt eligibility missing');
  assert(claims.human_activation_step_still_required === true,
    'Human Activation Review: human activation step no longer required');
  for (const key of [
    'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
    'execution_authority_granted', 'repository_ownership_transferred', 'canonical_origin_mutated',
    'legal_responsibility_determined', 'truth_certified', 'universal_canonicality_established'
  ]) assert(claims[key] === false, `Human Activation Review: unsafe frontier claim ${key}`);
}

async function buildReviewPacket({ projectCheckpoint, currentMainVerification, gitRevision, preparedAt }) {
  assert(/^git:[0-9a-f]{40}$/.test(gitRevision), 'Human Activation Review: exact git revision required');
  assert(Number.isFinite(Date.parse(preparedAt)), 'Human Activation Review: invalid prepared_at');
  assertCheckpoint(projectCheckpoint, gitRevision);
  assertCurrentMainVerification(currentMainVerification, gitRevision);

  const checkpointBinding = await binding(
    'ProjectReadinessCheckpointReceipt',
    projectCheckpoint.checkpoint_id,
    projectCheckpoint
  );
  const verificationBinding = await binding(
    'KONTURCurrentMainFrontierVerificationReceipt',
    currentMainVerification.verification_id,
    currentMainVerification
  );
  const seed = [gitRevision, checkpointBinding.digest.value, verificationBinding.digest.value, preparedAt].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './kontur-human-activation-review-packet.schema.json',
    artifact_type: 'KONTURHumanActivationReviewPacket',
    artifact_version: '0.1',
    review_packet_id: `urn:uu-aap:kontur:human-activation-review-packet:${hash.slice(0, 24)}`,
    prepared_at: preparedAt,
    project_id: 'Matawaka/uu-aap',
    git_revision: gitRevision,
    project_readiness_checkpoint_binding: checkpointBinding,
    current_main_frontier_verification_binding: verificationBinding,
    required_human_confirmations: REQUIRED_CONFIRMATIONS.slice(),
    review_state: 'ready_for_human_activation_review',
    safe_next_step: 'human_review_decision_only',
    claims: {
      project_readiness_checkpoint_verified: true,
      current_main_frontier_verified: true,
      human_activation_review_ready: true,
      human_review_decision_recorded: false,
      activation_intent_preparation_authorized: false,
      activation_intent_created: false,
      preflight_requested: false,
      execute_command_created: false,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      permission_expansion_authorized: false,
      permission_bypass_authorized: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_authority_established: false,
      truth_certified: false,
      distributed_consensus_established: false
    }
  };
}

function expectedDeclaration(decision) {
  if (decision === 'approve_intent_preparation') {
    return {
      declaration_type: 'approve_intent_preparation_only',
      typed_confirmation: 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
      safe_effect: 'activation_intent_preparation_may_be_requested',
      positive: true
    };
  }
  if (decision === 'defer') {
    return {
      declaration_type: 'defer_activation_review',
      typed_confirmation: 'DEFER_KONTUR_ACTIVATION_REVIEW',
      safe_effect: 'no-action',
      positive: false
    };
  }
  if (decision === 'reject') {
    return {
      declaration_type: 'reject_activation_review',
      typed_confirmation: 'REJECT_KONTUR_ACTIVATION_REVIEW',
      safe_effect: 'no-action',
      positive: false
    };
  }
  throw new Error('Human Activation Review: unsupported decision');
}

async function buildReviewDecision({ reviewPacket, reviewerRef, decision, confirmations, typedConfirmation, nonce, reviewedAt }) {
  assert(reviewPacket && reviewPacket.artifact_type === 'KONTURHumanActivationReviewPacket' && reviewPacket.artifact_version === '0.1',
    'Human Activation Review: exact review packet required');
  assert(reviewPacket.review_state === 'ready_for_human_activation_review' && reviewPacket.safe_next_step === 'human_review_decision_only',
    'Human Activation Review: packet not review-ready');
  assert(reviewPacket.claims && reviewPacket.claims.human_review_decision_recorded === false,
    'Human Activation Review: packet already claims a decision');
  assert(reviewPacket.claims.activation_intent_preparation_authorized === false,
    'Human Activation Review: packet already authorizes intent preparation');
  assert(typeof reviewerRef === 'string' && reviewerRef.length > 0, 'Human Activation Review: reviewer_ref required');
  assert(Number.isFinite(Date.parse(reviewedAt)), 'Human Activation Review: invalid reviewed_at');
  assert(/^urn:uu-aap:kontur:human-activation-review-nonce:/.test(nonce), 'Human Activation Review: invalid nonce');

  const expected = expectedDeclaration(decision);
  assert(typedConfirmation === expected.typed_confirmation, 'Human Activation Review: typed confirmation mismatch');
  assert(confirmations && typeof confirmations === 'object', 'Human Activation Review: confirmations required');
  for (const key of REQUIRED_CONFIRMATIONS) {
    assert(Object.prototype.hasOwnProperty.call(confirmations, key), `Human Activation Review: missing confirmation ${key}`);
    if (expected.positive) assert(confirmations[key] === true, `Human Activation Review: approval requires ${key}=true`);
    else assert(typeof confirmations[key] === 'boolean', `Human Activation Review: confirmation ${key} must be boolean`);
  }

  const packetBinding = await binding('KONTURHumanActivationReviewPacket', reviewPacket.review_packet_id, reviewPacket);
  const seed = [packetBinding.digest.value, reviewerRef, decision, nonce, reviewedAt].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './kontur-human-activation-review-decision.schema.json',
    artifact_type: 'KONTURHumanActivationReviewDecision',
    artifact_version: '0.1',
    decision_id: `urn:uu-aap:kontur:human-activation-review-decision:${hash.slice(0, 24)}`,
    reviewed_at: reviewedAt,
    review_packet_binding: packetBinding,
    reviewer_ref: reviewerRef,
    decision,
    confirmations: { ...confirmations },
    human_declaration: {
      declaration_type: expected.declaration_type,
      typed_confirmation: expected.typed_confirmation,
      nonce,
      explicit: true
    },
    safe_effect: expected.safe_effect,
    claims: {
      human_review_decision_recorded: true,
      activation_intent_preparation_may_be_requested: expected.positive,
      activation_intent_created: false,
      preflight_requested: false,
      execute_command_created: false,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      permission_expansion_authorized: false,
      permission_bypass_authorized: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_authority_established: false,
      truth_certified: false,
      distributed_consensus_established: false
    }
  };
}

module.exports = {
  REQUIRED_CONFIRMATIONS,
  digestJson,
  buildReviewPacket,
  buildReviewDecision
};
