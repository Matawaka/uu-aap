'use strict';

const assert = require('assert');
const Review = require('./human-activation-review.js');

const SHA = 'a'.repeat(40);
const GIT_REVISION = `git:${SHA}`;
const NOW = '2026-08-24T00:45:00Z';
const REVIEWED = '2026-08-24T00:46:00Z';
const OBSERVED = '2026-08-24T00:47:00Z';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

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
      artifact_type: 'KONTURActivationFrontierReceipt', artifact_ref: 'urn:uu-aap:kontur:activation-frontier:test',
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

function checkpoint(currentMainBinding) {
  return {
    $schema: './project-readiness-checkpoint.schema.json',
    artifact_type: 'ProjectReadinessCheckpointReceipt',
    artifact_version: '0.1',
    checkpoint_id: 'urn:uu-aap:architecture:readiness-checkpoint:test',
    recorded_at: NOW,
    project_id: 'Matawaka/uu-aap',
    git_revision: GIT_REVISION,
    convergence_manifest_binding: {
      artifact_type: 'ArchitectureConvergenceReadinessManifest',
      artifact_ref: 'schemas/architecture/v0.1/examples/architecture-convergence-readiness.example.json',
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: '1'.repeat(64) }
    },
    current_main_frontier_verification_binding: currentMainBinding,
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

async function predecessors() {
  const currentMainVerification = verification();
  const currentMainDigest = await Review.digestJson(currentMainVerification);
  const currentMainBinding = {
    artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt',
    artifact_ref: currentMainVerification.verification_id,
    digest: {
      canonicalization: 'RFC8785-JCS',
      digest_algorithm: 'SHA-256',
      digest_encoding: 'hex',
      value: currentMainDigest
    }
  };
  return {
    projectCheckpoint: checkpoint(currentMainBinding),
    currentMainVerification
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

async function decisionArgs(packet, predecessorSet, overrides = {}) {
  return {
    reviewPacket: packet,
    projectCheckpoint: predecessorSet.projectCheckpoint,
    currentMainVerification: predecessorSet.currentMainVerification,
    observedCurrentGitRevision: GIT_REVISION,
    observedAt: OBSERVED,
    priorDecisions: [],
    priorDecisionsComplete: true,
    reviewerRef: 'human:reviewer:test',
    decision: 'approve_intent_preparation',
    confirmations: confirmations(true),
    typedConfirmation: 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
    nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:test-approve',
    reviewedAt: REVIEWED,
    ...overrides
  };
}

(async () => {
  const predecessorSet = await predecessors();
  const packet = await Review.buildReviewPacket({
    ...predecessorSet,
    gitRevision: GIT_REVISION,
    preparedAt: NOW
  });
  assert.strictEqual(packet.review_state, 'ready_for_human_activation_review');
  assert.strictEqual(packet.safe_next_step, 'human_review_decision_only');
  assert.deepStrictEqual(packet.required_human_confirmations, Review.REQUIRED_CONFIRMATIONS);
  assert.strictEqual(Date.parse(packet.expires_at) - Date.parse(packet.prepared_at), Review.REVIEW_PACKET_TTL_MS);
  assert.strictEqual(packet.claims.human_activation_review_ready, true);
  for (const key of [
    'human_review_decision_recorded', 'activation_intent_preparation_authorized', 'activation_intent_created',
    'preflight_requested', 'execute_command_created', 'kernel_activated', 'responsibility_state_created',
    'responsibility_accepted', 'execution_authority_granted', 'permission_expansion_authorized',
    'permission_bypass_authorized', 'repository_ownership_transferred', 'canonical_origin_mutated',
    'legal_authority_established', 'truth_certified', 'distributed_consensus_established'
  ]) assert.strictEqual(packet.claims[key], false, key);

  const packet2 = await Review.buildReviewPacket({
    ...predecessorSet,
    gitRevision: GIT_REVISION,
    preparedAt: NOW
  });
  assert.deepStrictEqual(packet2, packet, 'fixed inputs must produce deterministic review packet');

  await mustReject('checkpoint revision drift', async () => {
    const p = clone(predecessorSet);
    p.projectCheckpoint.git_revision = `git:${'b'.repeat(40)}`;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('checkpoint claims activation', async () => {
    const p = clone(predecessorSet);
    p.projectCheckpoint.claims.kontur_activated = true;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('checkpoint/current-main receipt substitution', async () => {
    const p = clone(predecessorSet);
    p.projectCheckpoint.current_main_frontier_verification_binding.digest.value = 'f'.repeat(64);
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('structurally incomplete checkpoint claims', async () => {
    const p = clone(predecessorSet);
    delete p.projectCheckpoint.claims.future_evolution_allowed;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('checkpoint unexpected top-level field', async () => {
    const p = clone(predecessorSet);
    p.projectCheckpoint.unexpected = true;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('frontier non-main event', async () => {
    const p = clone(predecessorSet);
    p.currentMainVerification.workflow_context.event_name = 'pull_request';
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('frontier revision drift', async () => {
    const p = clone(predecessorSet);
    p.currentMainVerification.frontier_git_revision = `git:${'c'.repeat(40)}`;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('frontier already activated', async () => {
    const p = clone(predecessorSet);
    p.currentMainVerification.claims.kernel_activated = true;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('structurally incomplete current-main claims', async () => {
    const p = clone(predecessorSet);
    delete p.currentMainVerification.claims.workflow_context_is_main_push;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });
  await mustReject('current-main unexpected workflow context field', async () => {
    const p = clone(predecessorSet);
    p.currentMainVerification.workflow_context.unexpected = true;
    await Review.buildReviewPacket({ ...p, gitRevision: GIT_REVISION, preparedAt: NOW });
  });

  const approve = await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet));
  assert.strictEqual(approve.safe_effect, 'activation_intent_preparation_may_be_requested');
  assert.strictEqual(approve.claims.activation_intent_preparation_may_be_requested, true);
  assert.strictEqual(approve.review_context.observed_current_git_revision, GIT_REVISION);
  assert.strictEqual(approve.review_context.prior_decisions_complete, true);
  assert.strictEqual(approve.review_context.replay_guard.nonce_not_seen, true);
  for (const key of [
    'activation_intent_created', 'preflight_requested', 'execute_command_created', 'kernel_activated',
    'responsibility_state_created', 'responsibility_accepted', 'execution_authority_granted',
    'permission_expansion_authorized', 'permission_bypass_authorized', 'repository_ownership_transferred',
    'canonical_origin_mutated', 'legal_authority_established', 'truth_certified', 'distributed_consensus_established'
  ]) assert.strictEqual(approve.claims[key], false, key);

  await mustReject('decision packet content tamper', async () => {
    const tampered = clone(packet);
    tampered.current_main_frontier_verification_binding.digest.value = 'e'.repeat(64);
    await Review.buildReviewDecision(await decisionArgs(tampered, predecessorSet, {
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:packet-tamper'
    }));
  });
  await mustReject('decision predecessor substitution', async () => {
    const substituted = clone(predecessorSet);
    substituted.currentMainVerification.verification_id = 'urn:uu-aap:kontur:current-main-frontier-verification:substituted';
    await Review.buildReviewDecision(await decisionArgs(packet, substituted, {
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:predecessor-substitution'
    }));
  });
  await mustReject('current-main drift at decision time', async () => {
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      observedCurrentGitRevision: `git:${'d'.repeat(40)}`,
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:drift'
    }));
  });
  await mustReject('reviewed_at before packet preparation', async () => {
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      reviewedAt: '2026-08-24T00:44:00Z',
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:time-order'
    }));
  });
  await mustReject('expired review packet', async () => {
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      reviewedAt: '2026-08-25T00:46:00Z',
      observedAt: '2026-08-25T00:47:00Z',
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:expired'
    }));
  });
  await mustReject('incomplete prior decision history', async () => {
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      priorDecisionsComplete: false,
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:history'
    }));
  });
  await mustReject('decision nonce replay', async () => {
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      priorDecisions: [approve]
    }));
  });
  await mustReject('review packet single-decision replay', async () => {
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      priorDecisions: [approve],
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:different-but-same-packet'
    }));
  });

  await mustReject('approval wrong typed confirmation', async () => {
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      typedConfirmation: 'APPROVE',
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:wrong-token'
    }));
  });
  await mustReject('approval permission expansion not confirmed', async () => {
    const c = confirmations(true); c.existing_permissions_only = false;
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      confirmations: c,
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:permission'
    }));
  });
  await mustReject('approval bypass prohibition not confirmed', async () => {
    const c = confirmations(true); c.no_permission_bypass_or_escalation = false;
    await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
      confirmations: c,
      nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:bypass'
    }));
  });

  const defer = await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
    decision: 'defer',
    confirmations: confirmations(false),
    typedConfirmation: 'DEFER_KONTUR_ACTIVATION_REVIEW',
    nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:test-defer'
  }));
  assert.strictEqual(defer.safe_effect, 'no-action');
  assert.strictEqual(defer.claims.activation_intent_preparation_may_be_requested, false);

  const reject = await Review.buildReviewDecision(await decisionArgs(packet, predecessorSet, {
    decision: 'reject',
    confirmations: confirmations(false),
    typedConfirmation: 'REJECT_KONTUR_ACTIVATION_REVIEW',
    nonce: 'urn:uu-aap:kontur:human-activation-review-nonce:test-reject'
  }));
  assert.strictEqual(reject.safe_effect, 'no-action');
  assert.strictEqual(reject.claims.activation_intent_preparation_may_be_requested, false);

  console.log('KONTUR Human Activation Review v0.1 audit remediation: PASS');
})().catch(error => { console.error(error); process.exit(1); });
