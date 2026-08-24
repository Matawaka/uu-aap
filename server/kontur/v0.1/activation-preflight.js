'use strict';

// HAR-bound public activation-preflight surface.
// The preserved v0.1 preflight machine lives in activation-preflight-core.js.
// This wrapper adds the missing Formal Human Activation Review provenance gate
// without changing the underlying readiness / health / lease / executor boundary.

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Core = require('./activation-preflight-core.js');

const HAR_CONFIRMATIONS = [
  'exact_revision_and_review_packet_understood',
  'existing_permissions_only',
  'no_permission_bypass_or_escalation',
  'activation_intent_is_separate_future_artifact',
  'preflight_is_separate_and_must_be_fresh',
  'execute_command_requires_separate_human_step',
  'holder_scopes_and_lease_must_be_explicit_before_intent',
  'activation_does_not_establish_legal_truth_or_universal_authority'
];

const HAR_PACKET_CLAIMS = {
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

const HAR_DECISION_CLAIMS = {
  human_review_decision_recorded: true,
  activation_intent_preparation_may_be_requested: true,
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

const INTENT_KEYS = [
  '$schema', 'artifact_type', 'artifact_version', 'intent_id', 'declared_at', 'intended_transition',
  'git_revision', 'system_id', 'server_instance_id', 'readiness_epoch', 'fencing_epoch',
  'frontier_binding', 'readiness_signal_binding', 'aggregation_policy_binding',
  'responsibility_policy_binding', 'activation_policy_binding',
  'human_activation_review_decision_binding', 'human_activation_review_evidence', 'health_binding',
  'holder_id', 'responsibility_scopes', 'lease', 'human_intent', 'claims'
];

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Activation Preflight: invalid ${label}`);
  return ms;
}
function assertExactKeys(value, expectedKeys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  assert(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort()),
    `${label}: exact contract keys required`
  );
}
function assertExactClaims(actual, expected, label) {
  assertExactKeys(actual, Object.keys(expected), label);
  for (const [key, value] of Object.entries(expected)) {
    assert(actual[key] === value, `${label}: claim ${key} mismatch`);
  }
}
function assertDigestShape(value, label) {
  assertExactKeys(value, ['canonicalization', 'digest_algorithm', 'digest_encoding', 'value'], label);
  assert(value.canonicalization === 'RFC8785-JCS', `${label}: canonicalization mismatch`);
  assert(value.digest_algorithm === 'SHA-256' && value.digest_encoding === 'hex', `${label}: digest algorithm mismatch`);
  assert(/^[0-9a-f]{64}$/.test(value.value), `${label}: invalid digest`);
}
function assertBindingShape(value, artifactType, refPattern, label) {
  assertExactKeys(value, ['artifact_type', 'artifact_ref', 'digest'], label);
  assert(value.artifact_type === artifactType, `${label}: artifact_type mismatch`);
  assert(refPattern.test(value.artifact_ref), `${label}: artifact_ref mismatch`);
  assertDigestShape(value.digest, `${label} digest`);
}
function sameBinding(left, right) {
  return !!left && !!right &&
    left.artifact_type === right.artifact_type &&
    left.artifact_ref === right.artifact_ref &&
    left.digest && right.digest &&
    left.digest.canonicalization === right.digest.canonicalization &&
    left.digest.digest_algorithm === right.digest.digest_algorithm &&
    left.digest.digest_encoding === right.digest.digest_encoding &&
    left.digest.value === right.digest.value;
}
async function digestJson(value) { return Core.digestJson(value); }
async function binding(artifactType, artifactRef, artifact) {
  return {
    artifact_type: artifactType,
    artifact_ref: artifactRef,
    digest: {
      canonicalization: 'RFC8785-JCS',
      digest_algorithm: 'SHA-256',
      digest_encoding: 'hex',
      value: await digestJson(artifact)
    }
  };
}
async function rawSha256(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(value));
}

async function assertHarPacket(packet, currentGitRevision) {
  const label = 'KONTUR Activation Preflight: HAR packet';
  assertExactKeys(packet, [
    '$schema', 'artifact_type', 'artifact_version', 'review_packet_id', 'prepared_at', 'expires_at',
    'project_id', 'git_revision', 'project_readiness_checkpoint_binding',
    'current_main_frontier_verification_binding', 'required_human_confirmations', 'review_state',
    'safe_next_step', 'claims'
  ], label);
  assert(/(^|.*\/)kontur-human-activation-review-packet\.schema\.json$/.test(packet.$schema),
    `${label}: schema mismatch`);
  assert(packet.artifact_type === 'KONTURHumanActivationReviewPacket' && packet.artifact_version === '0.1',
    `${label}: exact v0.1 packet required`);
  assert(/^urn:uu-aap:kontur:human-activation-review-packet:[0-9a-f]{24}$/.test(packet.review_packet_id),
    `${label}: invalid packet ID`);
  assert(packet.project_id === 'Matawaka/uu-aap', `${label}: project mismatch`);
  assert(packet.git_revision === currentGitRevision, `${label}: revision drift`);

  const prepared = parseTime(packet.prepared_at, 'HAR packet prepared_at');
  const expires = parseTime(packet.expires_at, 'HAR packet expires_at');
  assert(expires - prepared === 24 * 60 * 60 * 1000, `${label}: TTL mismatch`);

  assertBindingShape(
    packet.project_readiness_checkpoint_binding,
    'ProjectReadinessCheckpointReceipt',
    /^urn:uu-aap:architecture:readiness-checkpoint:/,
    `${label}: readiness checkpoint binding`
  );
  assertBindingShape(
    packet.current_main_frontier_verification_binding,
    'KONTURCurrentMainFrontierVerificationReceipt',
    /^urn:uu-aap:kontur:current-main-frontier-verification:/,
    `${label}: current-main binding`
  );

  assert(Array.isArray(packet.required_human_confirmations), `${label}: confirmations required`);
  assert(
    JSON.stringify(packet.required_human_confirmations) === JSON.stringify(HAR_CONFIRMATIONS),
    `${label}: confirmation order/content mismatch`
  );
  assert(packet.review_state === 'ready_for_human_activation_review', `${label}: review_state mismatch`);
  assert(packet.safe_next_step === 'human_review_decision_only', `${label}: safe_next_step mismatch`);
  assertExactClaims(packet.claims, HAR_PACKET_CLAIMS, `${label}: claims`);

  const packetSeed = [
    packet.git_revision,
    packet.project_readiness_checkpoint_binding.digest.value,
    packet.current_main_frontier_verification_binding.digest.value,
    packet.prepared_at,
    packet.expires_at
  ].join('|');
  const packetHash = await rawSha256(packetSeed);
  assert(
    packet.review_packet_id === `urn:uu-aap:kontur:human-activation-review-packet:${packetHash.slice(0, 24)}`,
    `${label}: deterministic packet ID mismatch`
  );
}

async function assertHarApproval(packet, decision, currentGitRevision) {
  await assertHarPacket(packet, currentGitRevision);
  const label = 'KONTUR Activation Preflight: HAR decision';
  assertExactKeys(decision, [
    '$schema', 'artifact_type', 'artifact_version', 'decision_id', 'reviewed_at',
    'review_packet_binding', 'reviewer_ref', 'decision', 'confirmations',
    'human_declaration', 'review_context', 'safe_effect', 'claims'
  ], label);
  assert(/(^|.*\/)kontur-human-activation-review-decision\.schema\.json$/.test(decision.$schema),
    `${label}: schema mismatch`);
  assert(decision.artifact_type === 'KONTURHumanActivationReviewDecision' && decision.artifact_version === '0.1',
    `${label}: exact v0.1 decision required`);
  assert(/^urn:uu-aap:kontur:human-activation-review-decision:[0-9a-f]{24}$/.test(decision.decision_id),
    `${label}: invalid decision ID`);
  assert(typeof decision.reviewer_ref === 'string' && decision.reviewer_ref.length > 0,
    `${label}: reviewer_ref required`);
  assert(decision.decision === 'approve_intent_preparation', `${label}: did not approve intent preparation`);
  assert(decision.safe_effect === 'activation_intent_preparation_may_be_requested', `${label}: safe effect mismatch`);

  assertExactKeys(decision.confirmations, HAR_CONFIRMATIONS, `${label}: confirmations`);
  HAR_CONFIRMATIONS.forEach((key) => {
    assert(decision.confirmations[key] === true, `${label}: approval requires ${key}=true`);
  });

  assertExactKeys(
    decision.human_declaration,
    ['declaration_type', 'typed_confirmation', 'nonce', 'explicit'],
    `${label}: human declaration`
  );
  assert(decision.human_declaration.declaration_type === 'approve_intent_preparation_only',
    `${label}: declaration_type mismatch`);
  assert(decision.human_declaration.typed_confirmation === 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
    `${label}: typed confirmation mismatch`);
  assert(/^urn:uu-aap:kontur:human-activation-review-nonce:/.test(decision.human_declaration.nonce),
    `${label}: nonce invalid`);
  assert(decision.human_declaration.explicit === true, `${label}: declaration not explicit`);

  assertExactKeys(decision.review_context, [
    'observed_current_git_revision', 'observed_at', 'packet_expires_at',
    'prior_decisions_complete', 'prior_decision_count', 'replay_guard'
  ], `${label}: review context`);
  assert(decision.review_context.observed_current_git_revision === currentGitRevision,
    `${label}: revision drift`);
  const prepared = parseTime(packet.prepared_at, 'HAR packet prepared_at');
  const reviewed = parseTime(decision.reviewed_at, 'HAR reviewed_at');
  const observed = parseTime(decision.review_context.observed_at, 'HAR observed_at');
  const expires = parseTime(packet.expires_at, 'HAR packet expires_at');
  assert(prepared <= reviewed && reviewed <= observed && observed <= expires,
    `${label}: decision outside packet validity/order`);
  assert(decision.review_context.packet_expires_at === packet.expires_at,
    `${label}: packet expiry substitution`);
  assert(decision.review_context.prior_decisions_complete === true,
    `${label}: complete prior decision history required`);
  assert(Number.isSafeInteger(decision.review_context.prior_decision_count) && decision.review_context.prior_decision_count >= 0,
    `${label}: invalid prior_decision_count`);
  assertExactKeys(
    decision.review_context.replay_guard,
    ['nonce_not_seen', 'packet_not_previously_decided'],
    `${label}: replay guard`
  );
  assert(decision.review_context.replay_guard.nonce_not_seen === true &&
    decision.review_context.replay_guard.packet_not_previously_decided === true,
    `${label}: replay guard not satisfied`);
  assertExactClaims(decision.claims, HAR_DECISION_CLAIMS, `${label}: claims`);

  assertBindingShape(
    decision.review_packet_binding,
    'KONTURHumanActivationReviewPacket',
    /^urn:uu-aap:kontur:human-activation-review-packet:/,
    `${label}: packet binding`
  );
  const expectedPacketBinding = await binding(
    'KONTURHumanActivationReviewPacket',
    packet.review_packet_id,
    packet
  );
  assert(sameBinding(decision.review_packet_binding, expectedPacketBinding),
    `${label}: packet binding substitution`);

  const identitySeed = {
    artifact_type: 'KONTURHumanActivationReviewDecisionIdentitySeed',
    artifact_version: '0.1',
    review_packet_binding: decision.review_packet_binding,
    reviewer_ref: decision.reviewer_ref,
    decision: decision.decision,
    human_declaration_nonce: decision.human_declaration.nonce,
    reviewed_at: decision.reviewed_at,
    observed_current_git_revision: decision.review_context.observed_current_git_revision,
    observed_at: decision.review_context.observed_at
  };
  const decisionHash = await digestJson(identitySeed);
  assert(
    decision.decision_id === `urn:uu-aap:kontur:human-activation-review-decision:${decisionHash.slice(0, 24)}`,
    `${label}: decision_id binding mismatch`
  );
}

function assertIntentKeys(intent) {
  assertExactKeys(intent, INTENT_KEYS, 'KONTUR Activation Preflight: HAR-bound activation intent');
  assertExactKeys(
    intent.human_activation_review_evidence,
    ['review_packet', 'decision'],
    'KONTUR Activation Preflight: embedded HAR evidence'
  );
}

async function intentIdentityHash(intent) {
  const seed = [
    intent.git_revision,
    intent.frontier_binding.digest.value,
    intent.readiness_signal_binding.digest.value,
    intent.aggregation_policy_binding.digest.value,
    intent.responsibility_policy_binding.digest.value,
    intent.activation_policy_binding.digest.value,
    intent.human_activation_review_decision_binding.digest.value,
    intent.health_binding.digest.value,
    intent.holder_id,
    intent.responsibility_scopes.join(','),
    String(intent.fencing_epoch),
    intent.lease.lease_id,
    intent.human_intent.actor_ref,
    intent.human_intent.nonce,
    intent.declared_at
  ].join('|');
  return rawSha256(seed);
}

async function buildActivationIntent(args) {
  const { humanActivationReviewPacket, humanActivationReviewDecision, currentGitRevision } = args;
  await assertHarApproval(humanActivationReviewPacket, humanActivationReviewDecision, currentGitRevision);

  const intent = await Core.buildActivationIntent(args);
  const decisionBinding = await binding(
    'KONTURHumanActivationReviewDecision',
    humanActivationReviewDecision.decision_id,
    humanActivationReviewDecision
  );

  intent.human_activation_review_decision_binding = decisionBinding;
  intent.human_activation_review_evidence = {
    review_packet: clone(humanActivationReviewPacket),
    decision: clone(humanActivationReviewDecision)
  };
  intent.claims.human_activation_review_approval_bound = true;
  const hash = await intentIdentityHash(intent);
  intent.intent_id = `urn:uu-aap:kontur:activation-intent:${hash.slice(0, 24)}`;
  assertIntentKeys(intent);
  return intent;
}

async function validateActivationIntent(ctx) {
  const { intent, currentGitRevision } = ctx;
  assertIntentKeys(intent);

  const embeddedPacket = intent.human_activation_review_evidence.review_packet;
  const embeddedDecision = intent.human_activation_review_evidence.decision;
  if (ctx.humanActivationReviewPacket !== undefined && ctx.humanActivationReviewPacket !== null) {
    assert(
      await digestJson(ctx.humanActivationReviewPacket) === await digestJson(embeddedPacket),
      'KONTUR Activation Preflight: external/embedded HAR packet substitution'
    );
  }
  if (ctx.humanActivationReviewDecision !== undefined && ctx.humanActivationReviewDecision !== null) {
    assert(
      await digestJson(ctx.humanActivationReviewDecision) === await digestJson(embeddedDecision),
      'KONTUR Activation Preflight: external/embedded HAR decision substitution'
    );
  }

  await assertHarApproval(embeddedPacket, embeddedDecision, currentGitRevision);
  assertBindingShape(
    intent.human_activation_review_decision_binding,
    'KONTURHumanActivationReviewDecision',
    /^urn:uu-aap:kontur:human-activation-review-decision:/,
    'KONTUR Activation Preflight: intent HAR decision binding'
  );
  const expectedDecisionBinding = await binding(
    'KONTURHumanActivationReviewDecision',
    embeddedDecision.decision_id,
    embeddedDecision
  );
  assert(sameBinding(intent.human_activation_review_decision_binding, expectedDecisionBinding),
    'KONTUR Activation Preflight: intent HAR decision binding substitution');
  assert(intent.claims && intent.claims.human_activation_review_approval_bound === true,
    'KONTUR Activation Preflight: HAR approval bound claim missing');

  await Core.validateActivationIntent(ctx);

  const expectedHash = await intentIdentityHash(intent);
  assert(
    intent.intent_id === `urn:uu-aap:kontur:activation-intent:${expectedHash.slice(0, 24)}`,
    'KONTUR Activation Preflight: HAR-bound activation intent ID mismatch'
  );
  return true;
}

async function preflightActivation(ctx) {
  await validateActivationIntent(ctx);
  return Core.preflightActivation(ctx);
}

async function validateActivationPreflightReceipt(ctx) {
  await validateActivationIntent(ctx);
  return Core.validateActivationPreflightReceipt(ctx);
}

module.exports = {
  digestJson,
  buildActivationIntent,
  validateActivationIntent,
  preflightActivation,
  validateActivationPreflightReceipt
};
