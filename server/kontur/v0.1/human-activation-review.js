'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const REVIEW_PACKET_TTL_MS = 24 * 60 * 60 * 1000;

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

const PACKET_FALSE_CLAIMS = [
  'human_review_decision_recorded', 'activation_intent_preparation_authorized', 'activation_intent_created',
  'preflight_requested', 'execute_command_created', 'kernel_activated', 'responsibility_state_created',
  'responsibility_accepted', 'execution_authority_granted', 'permission_expansion_authorized',
  'permission_bypass_authorized', 'repository_ownership_transferred', 'canonical_origin_mutated',
  'legal_authority_established', 'truth_certified', 'distributed_consensus_established'
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

function assertDigestShape(value, label) {
  assert(value && value.canonicalization === 'RFC8785-JCS', `${label}: canonicalization mismatch`);
  assert(value.digest_algorithm === 'SHA-256' && value.digest_encoding === 'hex', `${label}: digest algorithm mismatch`);
  assert(/^[0-9a-f]{64}$/.test(value.value), `${label}: invalid digest`);
}

function assertBindingEquals(actual, expected, label) {
  assert(actual && typeof actual === 'object', `${label}: binding required`);
  assert(actual.artifact_type === expected.artifact_type, `${label}: artifact_type mismatch`);
  assert(actual.artifact_ref === expected.artifact_ref, `${label}: artifact_ref mismatch`);
  assertDigestShape(actual.digest, label);
  assert(actual.digest.value === expected.digest.value, `${label}: digest mismatch`);
}

function parseTime(value, label) {
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed), `Human Activation Review: invalid ${label}`);
  return parsed;
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

async function assertCheckpointBindsVerification(projectCheckpoint, currentMainVerification) {
  const expected = await binding(
    'KONTURCurrentMainFrontierVerificationReceipt',
    currentMainVerification.verification_id,
    currentMainVerification
  );
  assertBindingEquals(
    projectCheckpoint.current_main_frontier_verification_binding,
    expected,
    'Human Activation Review: checkpoint/current-main predecessor binding'
  );
  return expected;
}

function assertReviewPacketSemantics(reviewPacket) {
  assert(reviewPacket && reviewPacket.artifact_type === 'KONTURHumanActivationReviewPacket' && reviewPacket.artifact_version === '0.1',
    'Human Activation Review: exact review packet required');
  assert(reviewPacket.project_id === 'Matawaka/uu-aap', 'Human Activation Review: packet project mismatch');
  assert(/^git:[0-9a-f]{40}$/.test(reviewPacket.git_revision), 'Human Activation Review: packet git revision invalid');
  const prepared = parseTime(reviewPacket.prepared_at, 'packet prepared_at');
  const expires = parseTime(reviewPacket.expires_at, 'packet expires_at');
  assert(expires > prepared, 'Human Activation Review: packet expiry must follow preparation');
  assert(expires - prepared === REVIEW_PACKET_TTL_MS, 'Human Activation Review: packet TTL mismatch');
  assert(reviewPacket.review_state === 'ready_for_human_activation_review' && reviewPacket.safe_next_step === 'human_review_decision_only',
    'Human Activation Review: packet not review-ready');
  assert(Array.isArray(reviewPacket.required_human_confirmations), 'Human Activation Review: packet confirmations list required');
  assert(reviewPacket.required_human_confirmations.length === REQUIRED_CONFIRMATIONS.length,
    'Human Activation Review: packet confirmations list length mismatch');
  REQUIRED_CONFIRMATIONS.forEach((key, index) => {
    assert(reviewPacket.required_human_confirmations[index] === key,
      `Human Activation Review: packet confirmation order/content mismatch at ${key}`);
  });
  assert(reviewPacket.project_readiness_checkpoint_binding &&
    reviewPacket.project_readiness_checkpoint_binding.artifact_type === 'ProjectReadinessCheckpointReceipt',
  'Human Activation Review: packet checkpoint binding type mismatch');
  assert(reviewPacket.current_main_frontier_verification_binding &&
    reviewPacket.current_main_frontier_verification_binding.artifact_type === 'KONTURCurrentMainFrontierVerificationReceipt',
  'Human Activation Review: packet current-main binding type mismatch');
  assertDigestShape(reviewPacket.project_readiness_checkpoint_binding.digest, 'Human Activation Review: packet checkpoint binding');
  assertDigestShape(reviewPacket.current_main_frontier_verification_binding.digest, 'Human Activation Review: packet current-main binding');
  const claims = reviewPacket.claims || {};
  assert(claims.project_readiness_checkpoint_verified === true, 'Human Activation Review: packet checkpoint claim missing');
  assert(claims.current_main_frontier_verified === true, 'Human Activation Review: packet current-main claim missing');
  assert(claims.human_activation_review_ready === true, 'Human Activation Review: packet review-ready claim missing');
  for (const key of PACKET_FALSE_CLAIMS) {
    assert(claims[key] === false, `Human Activation Review: unsafe packet claim ${key}`);
  }
}

async function buildReviewPacket({ projectCheckpoint, currentMainVerification, gitRevision, preparedAt }) {
  assert(/^git:[0-9a-f]{40}$/.test(gitRevision), 'Human Activation Review: exact git revision required');
  const preparedMs = parseTime(preparedAt, 'prepared_at');
  assertCheckpoint(projectCheckpoint, gitRevision);
  assertCurrentMainVerification(currentMainVerification, gitRevision);
  assert(preparedMs >= parseTime(projectCheckpoint.recorded_at, 'checkpoint recorded_at'),
    'Human Activation Review: packet predates project checkpoint');
  assert(preparedMs >= parseTime(currentMainVerification.verified_at, 'current-main verified_at'),
    'Human Activation Review: packet predates current-main verification');

  const verificationBinding = await assertCheckpointBindsVerification(projectCheckpoint, currentMainVerification);
  const checkpointBinding = await binding(
    'ProjectReadinessCheckpointReceipt',
    projectCheckpoint.checkpoint_id,
    projectCheckpoint
  );
  const expiresAt = new Date(preparedMs + REVIEW_PACKET_TTL_MS).toISOString();
  const seed = [gitRevision, checkpointBinding.digest.value, verificationBinding.digest.value, preparedAt, expiresAt].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './kontur-human-activation-review-packet.schema.json',
    artifact_type: 'KONTURHumanActivationReviewPacket',
    artifact_version: '0.1',
    review_packet_id: `urn:uu-aap:kontur:human-activation-review-packet:${hash.slice(0, 24)}`,
    prepared_at: preparedAt,
    expires_at: expiresAt,
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

function assertPriorDecisionEntry(entry) {
  assert(entry && entry.artifact_type === 'KONTURHumanActivationReviewDecision' && entry.artifact_version === '0.1',
    'Human Activation Review: malformed prior decision history entry');
  assert(entry.review_packet_binding && entry.review_packet_binding.artifact_type === 'KONTURHumanActivationReviewPacket',
    'Human Activation Review: malformed prior packet binding');
  assertDigestShape(entry.review_packet_binding.digest, 'Human Activation Review: prior packet binding');
  assert(entry.human_declaration && /^urn:uu-aap:kontur:human-activation-review-nonce:/.test(entry.human_declaration.nonce),
    'Human Activation Review: malformed prior decision nonce');
}

async function buildReviewDecision({
  reviewPacket,
  projectCheckpoint,
  currentMainVerification,
  observedCurrentGitRevision,
  observedAt,
  priorDecisions,
  priorDecisionsComplete,
  reviewerRef,
  decision,
  confirmations,
  typedConfirmation,
  nonce,
  reviewedAt
}) {
  assertReviewPacketSemantics(reviewPacket);
  assert(/^git:[0-9a-f]{40}$/.test(observedCurrentGitRevision),
    'Human Activation Review: observed current git revision required');
  assert(observedCurrentGitRevision === reviewPacket.git_revision,
    'Human Activation Review: current-main drift since review packet preparation');
  const reviewedMs = parseTime(reviewedAt, 'reviewed_at');
  const observedMs = parseTime(observedAt, 'observed_at');
  const preparedMs = parseTime(reviewPacket.prepared_at, 'packet prepared_at');
  const expiresMs = parseTime(reviewPacket.expires_at, 'packet expires_at');
  assert(reviewedMs >= preparedMs, 'Human Activation Review: reviewed_at predates packet preparation');
  assert(observedMs >= reviewedMs, 'Human Activation Review: current-main observation predates review decision');
  assert(reviewedMs <= expiresMs && observedMs <= expiresMs, 'Human Activation Review: review packet expired');

  assert(projectCheckpoint && currentMainVerification,
    'Human Activation Review: predecessor artifacts required for decision-time packet revalidation');
  const rebuiltPacket = await buildReviewPacket({
    projectCheckpoint,
    currentMainVerification,
    gitRevision: reviewPacket.git_revision,
    preparedAt: reviewPacket.prepared_at
  });
  assert(await digestJson(rebuiltPacket) === await digestJson(reviewPacket),
    'Human Activation Review: packet content/predecessor substitution detected');

  assert(Array.isArray(priorDecisions), 'Human Activation Review: prior decision history required');
  assert(priorDecisionsComplete === true, 'Human Activation Review: complete prior decision history required');
  assert(typeof reviewerRef === 'string' && reviewerRef.length > 0, 'Human Activation Review: reviewer_ref required');
  assert(/^urn:uu-aap:kontur:human-activation-review-nonce:/.test(nonce), 'Human Activation Review: invalid nonce');

  const packetBinding = await binding('KONTURHumanActivationReviewPacket', reviewPacket.review_packet_id, reviewPacket);
  for (const prior of priorDecisions) {
    assertPriorDecisionEntry(prior);
    assert(prior.human_declaration.nonce !== nonce, 'Human Activation Review: decision nonce replay detected');
    assert(prior.review_packet_binding.digest.value !== packetBinding.digest.value,
      'Human Activation Review: review packet already has a recorded decision');
  }

  const expected = expectedDeclaration(decision);
  assert(typedConfirmation === expected.typed_confirmation, 'Human Activation Review: typed confirmation mismatch');
  assert(confirmations && typeof confirmations === 'object', 'Human Activation Review: confirmations required');
  for (const key of REQUIRED_CONFIRMATIONS) {
    assert(Object.prototype.hasOwnProperty.call(confirmations, key), `Human Activation Review: missing confirmation ${key}`);
    if (expected.positive) assert(confirmations[key] === true, `Human Activation Review: approval requires ${key}=true`);
    else assert(typeof confirmations[key] === 'boolean', `Human Activation Review: confirmation ${key} must be boolean`);
  }

  const seed = [packetBinding.digest.value, reviewerRef, decision, nonce, reviewedAt, observedCurrentGitRevision, observedAt].join('|');
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
    review_context: {
      observed_current_git_revision: observedCurrentGitRevision,
      observed_at: observedAt,
      packet_expires_at: reviewPacket.expires_at,
      prior_decisions_complete: true,
      prior_decision_count: priorDecisions.length,
      replay_guard: {
        nonce_not_seen: true,
        packet_not_previously_decided: true
      }
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
  REVIEW_PACKET_TTL_MS,
  REQUIRED_CONFIRMATIONS,
  digestJson,
  buildReviewPacket,
  buildReviewDecision
};
