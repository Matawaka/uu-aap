'use strict';

const assert = require('assert');
const Review = require('./human-activation-review.js');

const SHA = 'a'.repeat(40);
const GIT_REVISION = `git:${SHA}`;
const NOW = '2026-08-24T00:45:00Z';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function checkpoint() {
  return {
    $schema: './project-readiness-checkpoint.schema.json',
    artifact_type: 'ProjectReadinessCheckpointReceipt',
    artifact_version: '0.1',
    checkpoint_id: 'urn:uu-aap:architecture:readiness-checkpoint:test',
    recorded_at: NOW,
    project_id: 'Matawaka/uu-aap',
    git_revision: GIT_REVISION,
    convergence_manifest_binding: {
      artifact_type: 'ArchitectureConvergenceReadinessManifest', artifact_ref: 'test',
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: '1'.repeat(64) }
    },
    current_main_frontier_verification_binding: {
      artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt', artifact_ref: 'test',
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: '2'.repeat(64) }
    },
    status: 'project_readiness_checkpoint_established',
    claims: {
      cross_plane_integration_review_eligible: true,
      current_main_frontier_verified: true,
      project_readiness_checkpoint_established: true,
      human_activation_step_still_required: true,
      kontur_activation_authorized: false,
      kontur_activated: false,
      execution_authority_granted: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_authority_established: false,
      truth_certified: false,
      distributed_consensus_established: false,
      universal_architecture_completeness_proven: false,
      future_evolution_allowed: true
    }
  };
}

function verification() {
  return {
    $schema: './kontur-current-main-frontier-verification.schema.json',
    artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt',
    artifact_version: '0.1',
    verification_id: 'urn:uu-aap:kontur:current-main-frontier-verification:test',
    verified_at: NOW,
    repository: 'Matawaka/uu-aap',
    workflow_context: { event_name: 'push', ref: 'refs/heads/main', github_sha: SHA, checkout_sha: SHA },
    frontier_binding: {
      artifact_type: 'KONTURActivationFrontierReceipt', artifact_ref: 'test',
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: '3'.repeat(64) }
    },
    frontier_git_revision: GIT_REVISION,
    decision: 'current_main_frontier_verified_for_workflow_event',
    claims: {
      workflow_context_is_main_push: true,
      github_sha_matches_checkout_sha: true,
      frontier_revision_matches_github_sha: true,
      frontier_revision_matches_checkout_sha: true,
      current_main_frontier_verified_for_workflow_event: true,
      activation_prompt_may_be_requested: true,
      human_activation_step_still_required: true,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_responsibility_determined: false,
      truth_certified: false,
      universal_canonicality_established: false
    }
  };
}

function confirmations(value = true) {
  return Object.fromEntries(Review.REQUIRED_CONFIRMATIONS.map(key => [key, value]));
}

async function mustReject(label, fn) {
  let failed = false;
  try { await fn(); } catch (_) { failed = true; }
  assert.strictEqual(failed, true, `${label}: expected fail-closed rejection`);
}

(async () => {
  const packet = await Review.buildReviewPacket({
    projectCheckpoint: checkpoint(), currentMainVerification: verification(),
    gitRevision: GIT_REVISION, preparedAt: NOW
  });
  assert.strictEqual(packet.review_state, 'ready_for_human_activation_review');
  assert.strictEqual(packet.safe_next_step, 'human_review_decision_only');
  assert.deepStrictEqual(packet.required_human_confirmations, Review.REQUIRED_CONFIRMATIONS);
  assert.strictEqual(packet.claims.human_activation_review_ready, true);
  for (const key of [
    'human_review_decision_recorded', 'activation_intent_preparation_authorized', 'activation_intent_created',
    'preflight_requested', 'execute_command_created', 'kernel_activated', 'responsibility_state_created',
    'responsibility_accepted', 'execution_authority_granted', 'permission_expansion_authorized',
    'permission_bypass_authorized', 'repository_ownership_transferred', 'canonical_origin_mutated',
    'legal_authority_established', 'truth_certified', 'distributed_consensus_established'
  ]) assert.strictEqual(packet.claims[key], false, key);

  const packet2 = await Review.buildReviewPacket({
    projectCheckpoint: checkpoint(), currentMainVerification: verification(),
    gitRevision: GIT_REVISION, preparedAt: NOW
  });
  assert.deepStrictEqual(packet2, packet, 'fixed inputs must produce deterministic review packet');

  await mustReject('checkpoint revision drift', async () => {
    const c = checkpoint(); c.git_revision = `git:${'b'.repeat(40)}`;
    await Review.buildReviewPacket({ projectCheckpoint: c, currentMainVerification: verification(), gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('checkpoint claims activation', async () => {
    const c = checkpoint(); c.claims.kontur_activated = true;
    await Review.buildReviewPacket({ projectCheckpoint: c, currentMainVerification: verification(), gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('frontier non-main event', async () => {
    const v = verification(); v.workflow_context.event_name = 'pull_request';
    await Review.buildReviewPacket({ projectCheckpoint: checkpoint(), currentMainVerification: v, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('frontier revision drift', async () => {
    const v = verification(); v.frontier_git_revision = `git:${'c'.repeat(40)}`;
    await Review.buildReviewPacket({ projectCheckpoint: checkpoint(), currentMainVerification: v, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('frontier already activated', async () => {
    const v = verification(); v.claims.kernel_activated = true;
    await Review.buildReviewPacket({ projectCheckpoint: checkpoint(), currentMainVerification: v, gitRevision: GIT_REVISION, preparedAt: NOW });
  });

  const approve = await Review.buildReviewDecision({
    reviewPacket: packet,
    reviewerRef: 'human:reviewer:test',
    decision: 'approve_intent_preparation',
    confirmations: confirmations(true),
    typedConfirmation: 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
    nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:test-approve',
    reviewedAt: NOW
  });
  assert.strictEqual(approve.safe_effect, 'activation_intent_preparation_may_be_requested');
  assert.strictEqual(approve.claims.activation_intent_preparation_may_be_requested, true);
  for (const key of [
    'activation_intent_created', 'preflight_requested', 'execute_command_created', 'kernel_activated',
    'responsibility_state_created', 'responsibility_accepted', 'execution_authority_granted',
    'permission_expansion_authorized', 'permission_bypass_authorized', 'repository_ownership_transferred',
    'canonical_origin_mutated', 'legal_authority_established', 'truth_certified', 'distributed_consensus_established'
  ]) assert.strictEqual(approve.claims[key], false, key);

  await mustReject('approval wrong typed confirmation', async () => {
    await Review.buildReviewDecision({
      reviewPacket: packet, reviewerRef: 'human:reviewer:test', decision: 'approve_intent_preparation',
      confirmations: confirmations(true), typedConfirmation: 'APPROVE',
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:wrong-token', reviewedAt: NOW
    });
  });
  await mustReject('approval permission expansion not confirmed', async () => {
    const c = confirmations(true); c.existing_permissions_only = false;
    await Review.buildReviewDecision({
      reviewPacket: packet, reviewerRef: 'human:reviewer:test', decision: 'approve_intent_preparation',
      confirmations: c, typedConfirmation: 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:permission', reviewedAt: NOW
    });
  });
  await mustReject('approval bypass prohibition not confirmed', async () => {
    const c = confirmations(true); c.no_permission_bypass_or_escalation = false;
    await Review.buildReviewDecision({
      reviewPacket: packet, reviewerRef: 'human:reviewer:test', decision: 'approve_intent_preparation',
      confirmations: c, typedConfirmation: 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:bypass', reviewedAt: NOW
    });
  });

  const defer = await Review.buildReviewDecision({
    reviewPacket: packet, reviewerRef: 'human:reviewer:test', decision: 'defer',
    confirmations: confirmations(false), typedConfirmation: 'DEFER_KONTUR_ACTIVATION_REVIEW',
    nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:test-defer', reviewedAt: NOW
  });
  assert.strictEqual(defer.safe_effect, 'no-action');
  assert.strictEqual(defer.claims.activation_intent_preparation_may_be_requested, false);

  const reject = await Review.buildReviewDecision({
    reviewPacket: packet, reviewerRef: 'human:reviewer:test', decision: 'reject',
    confirmations: confirmations(false), typedConfirmation: 'REJECT_KONTUR_ACTIVATION_REVIEW',
    nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:test-reject', reviewedAt: NOW
  });
  assert.strictEqual(reject.safe_effect, 'no-action');
  assert.strictEqual(reject.claims.activation_intent_preparation_may_be_requested, false);

  console.log('KONTUR Human Activation Review v0.1: PASS');
})().catch(error => { console.error(error); process.exit(1); });
