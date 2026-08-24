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

const CHECKPOINT_CLAIMS = {
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
};

const CURRENT_MAIN_CLAIMS = {
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
};

const PACKET_CLAIMS = {
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
};

function assert(value, message) {
  if (!value) throw new Error(message);
}

function assertExactKeys(value, expectedKeys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}: exact contract keys required`);
}

function assertExactClaims(actual, expected, label) {
  assertExactKeys(actual, Object.keys(expected), label);
  for (const [key, value] of Object.entries(expected)) {
    assert(actual[key] === value, `${label}: claim ${key} mismatch`);
  }
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
  assertExactKeys(value, ['canonicalization', 'digest_algorithm', 'digest_encoding', 'value'], label);
  assert(value.canonicalization === 'RFC8785-JCS', `${label}: canonicalization mismatch`);
  assert(value.digest_algorithm === 'SHA-256' && value.digest_encoding === 'hex', `${label}: digest algorithm mismatch`);
  assert(/^[0-9a-f]{64}$/.test(value.value), `${label}: invalid digest`);
}

function assertBindingShape(value, artifactType, artifactRefPattern, label) {
  assertExactKeys(value, ['artifact_type', 'artifact_ref', 'digest'], label);
  assert(value.artifact_type === artifactType, `${label}: artifact_type mismatch`);
  assert(artifactRefPattern.test(value.artifact_ref), `${label}: artifact_ref mismatch`);
  assertDigestShape(value.digest, `${label} digest`);
}

function assertBindingEquals(actual, expected, label) {
  assertBindingShape(actual, expected.artifact_type, new RegExp(`^${expected.artifact_ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), label);
  assert(actual.digest.value === expected.digest.value, `${label}: digest mismatch`);
}

function parseTime(value, label) {
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed), `Human Activation Review: invalid ${label}`);
  return parsed;
}

function assertCheckpoint(checkpoint, gitRevision) {
  assertExactKeys(checkpoint, [
    '$schema', 'artifact_type', 'artifact_version', 'checkpoint_id', 'recorded_at', 'project_id',
    'git_revision', 'convergence_manifest_binding', 'current_main_frontier_verification_binding',
    'status', 'claims'
  ], 'Human Activation Review: checkpoint');
  assert(/(^|.*\/)project-readiness-checkpoint\.schema\.json$/.test(checkpoint.$schema),
    'Human Activation Review: checkpoint schema mismatch');
  assert(checkpoint.artifact_type === 'ProjectReadinessCheckpointReceipt' && checkpoint.artifact_version === '0.1',
    'Human Activation Review: exact ProjectReadinessCheckpointReceipt v0.1 required');
  assert(/^urn:uu-aap:architecture:readiness-checkpoint:/.test(checkpoint.checkpoint_id),
    'Human Activation Review: checkpoint id mismatch');
  parseTime(checkpoint.recorded_at, 'checkpoint recorded_at');
  assert(checkpoint.project_id === 'Matawaka/uu-aap', 'Human Activation Review: checkpoint project mismatch');
  assert(checkpoint.git_revision === gitRevision, 'Human Activation Review: checkpoint revision drift');
  assertBindingShape(
    checkpoint.convergence_manifest_binding,
    'ArchitectureConvergenceReadinessManifest',
    /^schemas\/architecture\/v0\.1\/examples\/architecture-convergence-readiness\.example\.json$/,
    'Human Activation Review: checkpoint convergence binding'
  );
  assertBindingShape(
    checkpoint.current_main_frontier_verification_binding,
    'KONTURCurrentMainFrontierVerificationReceipt',
    /^urn:uu-aap:kontur:current-main-frontier-verification:/,
    'Human Activation Review: checkpoint current-main binding'
  );
  assert(checkpoint.status === 'project_readiness_checkpoint_established',
    'Human Activation Review: project readiness checkpoint not established');
  assertExactClaims(checkpoint.claims, CHECKPOINT_CLAIMS, 'Human Activation Review: checkpoint claims');
}

function assertCurrentMainVerification(receipt, gitRevision) {
  assertExactKeys(receipt, [
    '$schema', 'artifact_type', 'artifact_version', 'verification_id', 'verified_at', 'repository',
    'workflow_context', 'frontier_binding', 'frontier_git_revision', 'decision', 'claims'
  ], 'Human Activation Review: current-main receipt');
  assert(/(^|.*\/)kontur-current-main-frontier-verification\.schema\.json$/.test(receipt.$schema),
    'Human Activation Review: current-main schema mismatch');
  assert(receipt.artifact_type === 'KONTURCurrentMainFrontierVerificationReceipt' && receipt.artifact_version === '0.1',
    'Human Activation Review: exact current-main verification receipt required');
  assert(/^urn:uu-aap:kontur:current-main-frontier-verification:/.test(receipt.verification_id),
    'Human Activation Review: current-main verification id mismatch');
  parseTime(receipt.verified_at, 'current-main verified_at');
  assert(receipt.repository === 'Matawaka/uu-aap', 'Human Activation Review: receipt repository mismatch');
  assertExactKeys(receipt.workflow_context, ['event_name', 'ref', 'github_sha', 'checkout_sha'],
    'Human Activation Review: workflow context');
  const ctx = receipt.workflow_context;
  assert(ctx.event_name === 'push' && ctx.ref === 'refs/heads/main',
    'Human Activation Review: canonical main push context required');
  assert(/^[0-9a-f]{40}$/.test(ctx.github_sha) && /^[0-9a-f]{40}$/.test(ctx.checkout_sha),
    'Human Activation Review: invalid workflow SHA');
  assert(`git:${ctx.github_sha}` === gitRevision && ctx.github_sha === ctx.checkout_sha,
    'Human Activation Review: workflow SHA drift');
  assertBindingShape(
    receipt.frontier_binding,
    'KONTURActivationFrontierReceipt',
    /^urn:uu-aap:kontur:activation-frontier:/,
    'Human Activation Review: frontier binding'
  );
  assert(receipt.frontier_git_revision === gitRevision, 'Human Activation Review: frontier revision drift');
  assert(receipt.decision === 'current_main_frontier_verified_for_workflow_event',
    'Human Activation Review: current-main frontier decision not verified');
  assertExactClaims(receipt.claims, CURRENT_MAIN_CLAIMS, 'Human Activation Review: current-main claims');
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
  assertExactKeys(reviewPacket, [
    '$schema', 'artifact_type', 'artifact_version', 'review_packet_id', 'prepared_at', 'expires_at',
    'project_id', 'git_revision', 'project_readiness_checkpoint_binding',
    'current_main_frontier_verification_binding', 'required_human_confirmations', 'review_state',
    'safe_next_step', 'claims'
  ], 'Human Activation Review: review packet');
  assert(/(^|.*\/)kontur-human-activation-review-packet\.schema\.json$/.test(reviewPacket.$schema),
    'Human Activation Review: packet schema mismatch');
  assert(reviewPacket.artifact_type === 'KONTURHumanActivationReviewPacket' && reviewPacket.artifact_version === '0.1',
    'Human Activation Review: exact review packet required');
  assert(/^urn:uu-aap:kontur:human-activation-review-packet:/.test(reviewPacket.review_packet_id),
    'Human Activation Review: packet id mismatch');
  assert(reviewPacket.project_id === 'Matawaka/uu-aap', 'Human Activation Review: packet project mismatch');
  assert(/^git:[0-9a-f]{40}$/.test(reviewPacket.git_revision), 'Human Activation Review: packet git revision invalid');
  const prepared = parseTime(reviewPacket.prepared_at, 'packet prepared_at');
  const expires = parseTime(reviewPacket.expires_at, 'packet expires_at');
  assert(expires > prepared, 'Human Activation Review: packet expiry must follow preparation');
  assert(expires - prepared === REVIEW_PACKET_TTL_MS, 'Human Activation Review: packet TTL mismatch');
  assertBindingShape(
    reviewPacket.project_readiness_checkpoint_binding,
    'ProjectReadinessCheckpointReceipt',
    /^urn:uu-aap:architecture:readiness-checkpoint:/,
    'Human Activation Review: packet checkpoint binding'
  );
  assertBindingShape(
    reviewPacket.current_main_frontier_verification_binding,
    'KONTURCurrentMainFrontierVerificationReceipt',
    /^urn:uu-aap:kontur:current-main-frontier-verification:/,
    'Human Activation Review: packet current-main binding'
  );
  assert(Array.isArray(reviewPacket.required_human_confirmations), 'Human Activation Review: packet confirmations list required');
  assert(reviewPacket.required_human_confirmations.length === REQUIRED_CONFIRMATIONS.length,
    'Human Activation Review: packet confirmations list length mismatch');
  REQUIRED_CONFIRMATIONS.forEach((key, index) => {
    assert(reviewPacket.required_human_confirmations[index] === key,
      `Human Activation Review: packet confirmation order/content mismatch at ${key}`);
  });
  assert(reviewPacket.review_state === 'ready_for_human_activation_review' && reviewPacket.safe_next_step === 'human_review_decision_only',
    'Human Activation Review: packet not review-ready');
  assertExactClaims(reviewPacket.claims, PACKET_CLAIMS, 'Human Activation Review: packet claims');
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
    claims: { ...PACKET_CLAIMS }
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

function expectedDecisionClaims(positive) {
  return {
    human_review_decision_recorded: true,
    activation_intent_preparation_may_be_requested: positive,
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
  };
}

async function assertPriorDecisionEntry(entry) {
  const label = 'Human Activation Review: prior decision';
  assertExactKeys(entry, [
    '$schema', 'artifact_type', 'artifact_version', 'decision_id', 'reviewed_at',
    'review_packet_binding', 'reviewer_ref', 'decision', 'confirmations',
    'human_declaration', 'review_context', 'safe_effect', 'claims'
  ], label);
  assert(/(^|.*\/)kontur-human-activation-review-decision\.schema\.json$/.test(entry.$schema),
    `${label}: schema mismatch`);
  assert(entry.artifact_type === 'KONTURHumanActivationReviewDecision' && entry.artifact_version === '0.1',
    `${label}: exact KONTURHumanActivationReviewDecision v0.1 required`);
  assert(/^urn:uu-aap:kontur:human-activation-review-decision:[0-9a-f]{24}$/.test(entry.decision_id),
    `${label}: decision_id invalid`);
  const reviewedMs = parseTime(entry.reviewed_at, 'prior decision reviewed_at');

  assertBindingShape(
    entry.review_packet_binding,
    'KONTURHumanActivationReviewPacket',
    /^urn:uu-aap:kontur:human-activation-review-packet:/,
    `${label}: review packet binding`
  );

  assert(typeof entry.reviewer_ref === 'string' && entry.reviewer_ref.length > 0,
    `${label}: reviewer_ref required`);

  const expected = expectedDeclaration(entry.decision);

  assertExactKeys(entry.confirmations, REQUIRED_CONFIRMATIONS, `${label}: confirmations`);
  for (const key of REQUIRED_CONFIRMATIONS) {
    if (expected.positive) {
      assert(entry.confirmations[key] === true, `${label}: approval requires ${key}=true`);
    } else {
      assert(typeof entry.confirmations[key] === 'boolean', `${label}: confirmation ${key} must be boolean`);
    }
  }

  assertExactKeys(
    entry.human_declaration,
    ['declaration_type', 'typed_confirmation', 'nonce', 'explicit'],
    `${label}: human declaration`
  );
  assert(entry.human_declaration.declaration_type === expected.declaration_type,
    `${label}: declaration_type mismatch`);
  assert(entry.human_declaration.typed_confirmation === expected.typed_confirmation,
    `${label}: typed_confirmation mismatch`);
  assert(/^urn:uu-aap:kontur:human-activation-review-nonce:/.test(entry.human_declaration.nonce),
    `${label}: nonce invalid`);
  assert(entry.human_declaration.explicit === true, `${label}: declaration must be explicit`);

  assertExactKeys(
    entry.review_context,
    [
      'observed_current_git_revision', 'observed_at', 'packet_expires_at',
      'prior_decisions_complete', 'prior_decision_count', 'replay_guard'
    ],
    `${label}: review context`
  );
  assert(/^git:[0-9a-f]{40}$/.test(entry.review_context.observed_current_git_revision),
    `${label}: observed_current_git_revision invalid`);
  const observedMs = parseTime(entry.review_context.observed_at, 'prior decision observed_at');
  const expiresMs = parseTime(entry.review_context.packet_expires_at, 'prior decision packet_expires_at');
  assert(observedMs >= reviewedMs, `${label}: observed_at predates reviewed_at`);
  assert(reviewedMs <= expiresMs && observedMs <= expiresMs, `${label}: decision exceeds packet expiry`);
  assert(entry.review_context.prior_decisions_complete === true,
    `${label}: prior decision did not assert complete prior history`);
  assert(Number.isSafeInteger(entry.review_context.prior_decision_count) && entry.review_context.prior_decision_count >= 0,
    `${label}: prior_decision_count invalid`);
  assertExactKeys(
    entry.review_context.replay_guard,
    ['nonce_not_seen', 'packet_not_previously_decided'],
    `${label}: replay guard`
  );
  assert(entry.review_context.replay_guard.nonce_not_seen === true,
    `${label}: nonce_not_seen must be true`);
  assert(entry.review_context.replay_guard.packet_not_previously_decided === true,
    `${label}: packet_not_previously_decided must be true`);

  assert(entry.safe_effect === expected.safe_effect, `${label}: safe_effect mismatch`);
  assertExactClaims(entry.claims, expectedDecisionClaims(expected.positive), `${label}: claims`);

  const seed = [
    entry.review_packet_binding.digest.value,
    entry.reviewer_ref,
    entry.decision,
    entry.human_declaration.nonce,
    entry.reviewed_at,
    entry.review_context.observed_current_git_revision,
    entry.review_context.observed_at
  ].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  assert(
    entry.decision_id === `urn:uu-aap:kontur:human-activation-review-decision:${hash.slice(0, 24)}`,
    `${label}: decision_id binding mismatch`
  );
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
    await assertPriorDecisionEntry(prior);
    assert(prior.human_declaration.nonce !== nonce, 'Human Activation Review: decision nonce replay detected');
    assert(prior.review_packet_binding.digest.value !== packetBinding.digest.value,
      'Human Activation Review: review packet already has a recorded decision');
  }

  const expected = expectedDeclaration(decision);
  assert(typedConfirmation === expected.typed_confirmation, 'Human Activation Review: typed confirmation mismatch');
  assert(confirmations && typeof confirmations === 'object', 'Human Activation Review: confirmations required');
  assertExactKeys(confirmations, REQUIRED_CONFIRMATIONS, 'Human Activation Review: confirmations');
  for (const key of REQUIRED_CONFIRMATIONS) {
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
    claims: expectedDecisionClaims(expected.positive)
  };
}

module.exports = {
  REVIEW_PACKET_TTL_MS,
  REQUIRED_CONFIRMATIONS,
  digestJson,
  buildReviewPacket,
  buildReviewDecision
};
