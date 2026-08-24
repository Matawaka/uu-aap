'use strict';

const assert = require('assert');
const Review = require('./human-activation-review.js');

const SHA = 'a'.repeat(40);
const GIT_REVISION = `git:${SHA}`;
const CHECKPOINT_TIME = '2026-08-24T00:40:00Z';
const PACKET_ONE_TIME = '2026-08-24T00:45:00Z';
const PACKET_TWO_TIME = '2026-08-24T00:50:00Z';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function verification() {
  return {
    $schema: './kontur-current-main-frontier-verification.schema.json',
    artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt',
    artifact_version: '0.1',
    verification_id: 'urn:uu-aap:kontur:current-main-frontier-verification:decision-id-binding-test',
    verified_at: CHECKPOINT_TIME,
    repository: 'Matawaka/uu-aap',
    workflow_context: {
      event_name: 'push',
      ref: 'refs/heads/main',
      github_sha: SHA,
      checkout_sha: SHA
    },
    frontier_binding: {
      artifact_type: 'KONTURActivationFrontierReceipt',
      artifact_ref: 'urn:uu-aap:kontur:activation-frontier:decision-id-binding-test',
      digest: {
        canonicalization: 'RFC8785-JCS',
        digest_algorithm: 'SHA-256',
        digest_encoding: 'hex',
        value: '3'.repeat(64)
      }
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
    checkpoint_id: 'urn:uu-aap:architecture:readiness-checkpoint:decision-id-binding-test',
    recorded_at: CHECKPOINT_TIME,
    project_id: 'Matawaka/uu-aap',
    git_revision: GIT_REVISION,
    convergence_manifest_binding: {
      artifact_type: 'ArchitectureConvergenceReadinessManifest',
      artifact_ref: 'schemas/architecture/v0.1/examples/architecture-convergence-readiness.example.json',
      digest: {
        canonicalization: 'RFC8785-JCS',
        digest_algorithm: 'SHA-256',
        digest_encoding: 'hex',
        value: '1'.repeat(64)
      }
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
  const digestValue = await Review.digestJson(currentMainVerification);
  const currentMainBinding = {
    artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt',
    artifact_ref: currentMainVerification.verification_id,
    digest: {
      canonicalization: 'RFC8785-JCS',
      digest_algorithm: 'SHA-256',
      digest_encoding: 'hex',
      value: digestValue
    }
  };
  return {
    currentMainVerification,
    projectCheckpoint: checkpoint(currentMainBinding)
  };
}

function confirmations(value = true) {
  return Object.fromEntries(Review.REQUIRED_CONFIRMATIONS.map(key => [key, value]));
}

async function buildApprove(packet, predecessorSet, nonce, reviewedAt, observedAt, priorDecisions = []) {
  return Review.buildReviewDecision({
    reviewPacket: packet,
    projectCheckpoint: predecessorSet.projectCheckpoint,
    currentMainVerification: predecessorSet.currentMainVerification,
    observedCurrentGitRevision: GIT_REVISION,
    observedAt,
    priorDecisions,
    priorDecisionsComplete: true,
    reviewerRef: 'human:reviewer:decision-id-binding-test',
    decision: 'approve_intent_preparation',
    confirmations: confirmations(true),
    typedConfirmation: 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
    nonce,
    reviewedAt
  });
}

async function mustRejectWith(label, expectedMessageFragment, fn) {
  let error = null;
  try {
    await fn();
  } catch (caught) {
    error = caught;
  }
  assert(error, `${label}: expected fail-closed rejection`);
  assert(
    String(error.message).includes(expectedMessageFragment),
    `${label}: expected ${expectedMessageFragment}, got ${error.message}`
  );
}

(async () => {
  const predecessorSet = await predecessors();

  const packetOne = await Review.buildReviewPacket({
    ...predecessorSet,
    gitRevision: GIT_REVISION,
    preparedAt: PACKET_ONE_TIME
  });
  const packetTwo = await Review.buildReviewPacket({
    ...predecessorSet,
    gitRevision: GIT_REVISION,
    preparedAt: PACKET_TWO_TIME
  });

  assert.notStrictEqual(packetOne.review_packet_id, packetTwo.review_packet_id);

  const priorApprove = await buildApprove(
    packetOne,
    predecessorSet,
    'urn:uu-aap:kontur:human-activation-review-nonce:decision-id-binding-prior',
    '2026-08-24T00:46:00Z',
    '2026-08-24T00:47:00Z'
  );

  const validSuccessor = await buildApprove(
    packetTwo,
    predecessorSet,
    'urn:uu-aap:kontur:human-activation-review-nonce:decision-id-binding-valid-successor',
    '2026-08-24T00:51:00Z',
    '2026-08-24T00:52:00Z',
    [priorApprove]
  );
  assert.strictEqual(validSuccessor.claims.human_review_decision_recorded, true);

  await mustRejectWith(
    'prior decision packet artifact_ref substitution with old decision_id',
    'decision_id binding mismatch',
    async () => {
      const tampered = clone(priorApprove);
      tampered.review_packet_binding.artifact_ref =
        'urn:uu-aap:kontur:human-activation-review-packet:syntactically-valid-substitution';
      await buildApprove(
        packetTwo,
        predecessorSet,
        'urn:uu-aap:kontur:human-activation-review-nonce:decision-id-binding-ref-tamper',
        '2026-08-24T00:53:00Z',
        '2026-08-24T00:54:00Z',
        [tampered]
      );
    }
  );

  await mustRejectWith(
    'prior decision packet digest substitution with old decision_id',
    'decision_id binding mismatch',
    async () => {
      const tampered = clone(priorApprove);
      tampered.review_packet_binding.digest.value = '8'.repeat(64);
      await buildApprove(
        packetTwo,
        predecessorSet,
        'urn:uu-aap:kontur:human-activation-review-nonce:decision-id-binding-digest-tamper',
        '2026-08-24T00:55:00Z',
        '2026-08-24T00:56:00Z',
        [tampered]
      );
    }
  );

  console.log('KONTUR Human Activation Review decision-ID packet-binding hardening: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
