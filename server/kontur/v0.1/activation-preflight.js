'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const PROHIBITED = [
  'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
  'execution_authority_granted', 'legal_responsibility_determined', 'legal_effect_established',
  'moral_blame_assigned', 'truth_certified', 'poai_materialization_event_recorded',
  'universal_canonicality_established'
];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'likelihood', 'confidence_score',
  'readiness_score', 'responsibility_score', 'causal_score', 'rating', 'weight'
]);
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

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Activation Preflight: invalid ${label}`);
  return ms;
}
function uniqSorted(values) { return [...new Set(Array.isArray(values) ? values : [])].sort(); }
function sameArray(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
function assertExactKeys(value, expectedKeys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort()), `${label}: exact contract keys required`);
}
function assertExactClaims(actual, expected, label) {
  assertExactKeys(actual, Object.keys(expected), label);
  for (const [key, value] of Object.entries(expected)) assert(actual[key] === value, `${label}: claim ${key} mismatch`);
}
function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
}
function assertNoTrueProhibitedClaims(claims, label) {
  assert(claims && typeof claims === 'object', `${label}: claims required`);
  for (const key of PROHIBITED) {
    if (Object.prototype.hasOwnProperty.call(claims, key)) {
      assert(claims[key] === false, `${label}: prohibited claim ${key}`);
    }
  }
}
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(artifactType, artifactRef, artifact) {
  return { artifact_type: artifactType, artifact_ref: artifactRef, digest: digest(await digestJson(artifact)) };
}
async function policyBinding(policy) {
  return {
    artifact_type: policy.artifact_type,
    artifact_ref: policy.policy_id,
    policy_version: policy.policy_version,
    digest: digest(await digestJson(policy))
  };
}
function sameBinding(left, right) {
  return !!left && !!right && left.artifact_type === right.artifact_type &&
    left.artifact_ref === right.artifact_ref && left.digest && right.digest &&
    left.digest.canonicalization === 'RFC8785-JCS' && right.digest.canonicalization === 'RFC8785-JCS' &&
    left.digest.digest_algorithm === 'SHA-256' && right.digest.digest_algorithm === 'SHA-256' &&
    left.digest.digest_encoding === 'hex' && right.digest.digest_encoding === 'hex' &&
    left.digest.value === right.digest.value;
}
function samePolicyBinding(left, right) {
  return sameBinding(left, right) && left.policy_version === right.policy_version;
}

function assertActivationPolicy(policy, evaluatedMs) {
  assert(policy && policy.artifact_type === 'KONTURActivationPolicy' && policy.artifact_version === '0.1',
    'KONTUR Activation Preflight: activation policy v0.1 required');
  assert(typeof policy.policy_id === 'string' && policy.policy_id.startsWith('urn:uu-aap:kontur:activation-policy:'),
    'KONTUR Activation Preflight: invalid activation policy ID');
  assert(Number.isInteger(policy.policy_version) && policy.policy_version >= 1,
    'KONTUR Activation Preflight: invalid activation policy version');
  assert(policy.allowed_transition === 'activate',
    'KONTUR Activation Preflight: activation policy may allow only activate');
  assert(Number.isInteger(policy.max_health_age_seconds) && policy.max_health_age_seconds > 0 && policy.max_health_age_seconds <= 300,
    'KONTUR Activation Preflight: invalid health freshness');
  assert(Number.isInteger(policy.max_intent_age_seconds) && policy.max_intent_age_seconds > 0 && policy.max_intent_age_seconds <= 900,
    'KONTUR Activation Preflight: invalid intent freshness');
  const req = policy.requirements || {};
  for (const key of [
    'exact_git_revision', 'exact_frontier_binding', 'exact_readiness_binding', 'exact_policy_bindings',
    'exact_system_server_identity', 'exact_epoch', 'healthy_server', 'live_lease',
    'no_parallel_active_holder', 'explicit_human_activation_intent', 'genesis_activation_only',
    'preflight_side_effect_free'
  ]) assert(req[key] === true, `KONTUR Activation Preflight: weakened requirement ${key}`);
  assert(req.auto_activation_allowed === false,
    'KONTUR Activation Preflight: auto activation must remain prohibited');
  assert(policy.responsibility_scope_source === 'exact_responsibility_policy_allowlist',
    'KONTUR Activation Preflight: scope source weakened');
  assert(policy.claims && policy.claims.activation_policy_defined === true,
    'KONTUR Activation Preflight: activation policy claim missing');
  assertNoTrueProhibitedClaims(policy.claims, 'KONTURActivationPolicy');
  const from = parseTime(policy.effective_from, 'activation policy effective_from');
  const until = policy.effective_until === null ? null : parseTime(policy.effective_until, 'activation policy effective_until');
  if (until !== null) assert(from < until, 'KONTUR Activation Preflight: invalid activation policy interval');
  assert(from <= evaluatedMs && (until === null || evaluatedMs < until),
    'KONTUR Activation Preflight: activation policy not effective');
}

function assertAggregationPolicy(policy, activationPolicy) {
  assert(policy && policy.artifact_type === 'KONTURReadinessAggregationPolicy' && policy.artifact_version === '0.1',
    'KONTUR Activation Preflight: aggregation policy v0.1 required');
  assert(policy.system_id === activationPolicy.system_id && policy.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: aggregation policy identity mismatch');
  assert(policy.aggregation_rule === 'all_required_checks_pass',
    'KONTUR Activation Preflight: aggregation rule drift');
  assertNoTrueProhibitedClaims(policy.claims, 'KONTURReadinessAggregationPolicy');
}

function assertResponsibilityPolicy(policy, activationPolicy) {
  assert(policy && policy.artifact_type === 'KONTURResponsibilityPolicy' && policy.artifact_version === '0.1',
    'KONTUR Activation Preflight: responsibility policy v0.1 required');
  assert(policy.system_id === activationPolicy.system_id && policy.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: responsibility policy identity mismatch');
  assert(Array.isArray(policy.responsibility_scope_allowlist) && policy.responsibility_scope_allowlist.length > 0,
    'KONTUR Activation Preflight: responsibility scope allowlist missing');
  const inv = policy.invariants || {};
  assert(inv.single_active_holder === true && inv.epoch_monotonic === true && inv.fencing_required === true &&
    inv.lease_required === true && inv.health_fail_closed === true,
    'KONTUR Activation Preflight: responsibility invariants weakened');
  assertNoTrueProhibitedClaims(policy.claims, 'KONTURResponsibilityPolicy');
}

function assertFrontier(frontier, currentGitRevision, activationPolicy) {
  assert(frontier && frontier.artifact_type === 'KONTURActivationFrontierReceipt' && frontier.artifact_version === '0.1',
    'KONTUR Activation Preflight: activation frontier v0.1 required');
  assert(frontier.status === 'activation_prompt_may_be_requested',
    'KONTUR Activation Preflight: frontier does not admit activation prompt');
  assert(frontier.git_revision === currentGitRevision,
    'KONTUR Activation Preflight: canonical Git revision drift');
  assert(frontier.system_id === activationPolicy.system_id && frontier.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: frontier identity mismatch');
  assert(frontier.claims && frontier.claims.canonical_frontier_bound === true &&
    frontier.claims.readiness_accepted === true && frontier.claims.activation_prompt_may_be_requested === true &&
    frontier.claims.human_activation_step_still_required === true,
    'KONTUR Activation Preflight: frontier assurance boundary invalid');
  assertNoTrueProhibitedClaims(frontier.claims, 'KONTURActivationFrontierReceipt');
}

function assertReadiness(signal, activationPolicy, evaluatedMs, epoch) {
  assert(signal && signal.artifact_type === 'KONTURReadinessSignal' && signal.artifact_version === '0.1',
    'KONTUR Activation Preflight: readiness signal v0.1 required');
  assert(signal.system_id === activationPolicy.system_id && signal.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: readiness identity mismatch');
  assert(signal.readiness_epoch === epoch, 'KONTUR Activation Preflight: readiness epoch substitution');
  assert(signal.ready === true && Array.isArray(signal.checks) && signal.checks.length > 0 &&
    signal.checks.every((item) => item.status === 'pass'),
    'KONTUR Activation Preflight: readiness signal not fully ready');
  const emitted = parseTime(signal.emitted_at, 'readiness emitted_at');
  const validUntil = parseTime(signal.valid_until, 'readiness valid_until');
  assert(emitted <= evaluatedMs && evaluatedMs < validUntil,
    'KONTUR Activation Preflight: readiness signal expired or not yet valid');
  assert(signal.claims && signal.claims.readiness_observed === true,
    'KONTUR Activation Preflight: readiness observation claim missing');
  assertNoTrueProhibitedClaims(signal.claims, 'KONTURReadinessSignal');
}

function assertHealth(health, activationPolicy, evaluatedMs) {
  assert(health && health.artifact_type === 'KONTURServerHealthObservation' && health.artifact_version === '0.1',
    'KONTUR Activation Preflight: server health observation v0.1 required');
  assert(health.system_id === activationPolicy.system_id && health.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: health identity mismatch');
  assert(health.status === 'healthy' && Array.isArray(health.components) && health.components.length > 0 &&
    health.components.every((item) => item.status === 'pass'),
    'KONTUR Activation Preflight: server health is not healthy');
  const observed = parseTime(health.observed_at, 'health observed_at');
  assert(observed <= evaluatedMs, 'KONTUR Activation Preflight: health observation is in the future');
  assert(evaluatedMs - observed <= activationPolicy.max_health_age_seconds * 1000,
    'KONTUR Activation Preflight: server health observation is stale');
  assert(health.claims && health.claims.server_health_observed === true && health.claims.global_readiness_established === false,
    'KONTUR Activation Preflight: health assurance boundary invalid');
  assertNoTrueProhibitedClaims(health.claims, 'KONTURServerHealthObservation');
}

function assertLease(lease, holderId, serverInstanceId, evaluatedMs) {
  assert(lease && typeof lease.lease_id === 'string' && lease.lease_id.startsWith('urn:uu-aap:kontur:lease:'),
    'KONTUR Activation Preflight: valid lease required');
  assert(lease.holder_id === holderId, 'KONTUR Activation Preflight: lease holder mismatch');
  assert(lease.server_instance_id === serverInstanceId, 'KONTUR Activation Preflight: lease server mismatch');
  const issued = parseTime(lease.issued_at, 'lease issued_at');
  const expires = parseTime(lease.expires_at, 'lease expires_at');
  assert(issued < expires, 'KONTUR Activation Preflight: invalid lease interval');
  assert(issued <= evaluatedMs && evaluatedMs < expires,
    'KONTUR Activation Preflight: lease expired or not yet issued');
}

function canonicalScopes(scopes, responsibilityPolicy) {
  const canonical = uniqSorted(scopes);
  assert(canonical.length > 0 && canonical.length === (Array.isArray(scopes) ? scopes.length : 0),
    'KONTUR Activation Preflight: invalid or duplicate responsibility scopes');
  for (const scope of canonical) assert(responsibilityPolicy.responsibility_scope_allowlist.includes(scope),
    `KONTUR Activation Preflight: responsibility scope not allowed: ${scope}`);
  return canonical;
}

async function assertFrontierBindings(frontier, readinessSignal, aggregationPolicy, responsibilityPolicy) {
  const readiness = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const aggregation = await binding('KONTURReadinessAggregationPolicy', aggregationPolicy.policy_id, aggregationPolicy);
  const responsibility = await binding('KONTURResponsibilityPolicy', responsibilityPolicy.policy_id, responsibilityPolicy);
  assert(sameBinding(frontier.readiness_signal_binding, readiness),
    'KONTUR Activation Preflight: frontier readiness binding substitution');
  assert(sameBinding(frontier.aggregation_policy_binding, aggregation),
    'KONTUR Activation Preflight: frontier aggregation policy binding substitution');
  assert(sameBinding(frontier.responsibility_policy_binding, responsibility),
    'KONTUR Activation Preflight: frontier responsibility policy binding substitution');
}

function assertHumanActivationReviewPacket(packet, currentGitRevision) {
  assertExactKeys(packet, [
    '$schema', 'artifact_type', 'artifact_version', 'review_packet_id', 'prepared_at', 'expires_at',
    'project_id', 'git_revision', 'project_readiness_checkpoint_binding',
    'current_main_frontier_verification_binding', 'required_human_confirmations', 'review_state',
    'safe_next_step', 'claims'
  ], 'KONTUR Activation Preflight: HAR packet');
  assert(packet.artifact_type === 'KONTURHumanActivationReviewPacket' && packet.artifact_version === '0.1',
    'KONTUR Activation Preflight: exact HAR packet v0.1 required');
  assert(typeof packet.review_packet_id === 'string' && packet.review_packet_id.startsWith('urn:uu-aap:kontur:human-activation-review-packet:'),
    'KONTUR Activation Preflight: invalid HAR packet ID');
  assert(packet.project_id === 'Matawaka/uu-aap' && packet.git_revision === currentGitRevision,
    'KONTUR Activation Preflight: HAR packet revision/project drift');
  const prepared = parseTime(packet.prepared_at, 'HAR packet prepared_at');
  const expires = parseTime(packet.expires_at, 'HAR packet expires_at');
  assert(expires > prepared, 'KONTUR Activation Preflight: HAR packet invalid validity interval');
  assert(Array.isArray(packet.required_human_confirmations) && sameArray(packet.required_human_confirmations, HAR_CONFIRMATIONS),
    'KONTUR Activation Preflight: HAR packet confirmations mismatch');
  assert(packet.review_state === 'ready_for_human_activation_review' && packet.safe_next_step === 'human_review_decision_only',
    'KONTUR Activation Preflight: HAR packet state mismatch');
  assertExactClaims(packet.claims, HAR_PACKET_CLAIMS, 'KONTUR Activation Preflight: HAR packet claims');
}

async function assertHumanActivationReviewApproval(packet, decision, currentGitRevision) {
  assertHumanActivationReviewPacket(packet, currentGitRevision);
  assertExactKeys(decision, [
    '$schema', 'artifact_type', 'artifact_version', 'decision_id', 'reviewed_at', 'review_packet_binding',
    'reviewer_ref', 'decision', 'confirmations', 'human_declaration', 'review_context', 'safe_effect', 'claims'
  ], 'KONTUR Activation Preflight: HAR decision');
  assert(decision.artifact_type === 'KONTURHumanActivationReviewDecision' && decision.artifact_version === '0.1',
    'KONTUR Activation Preflight: exact HAR decision v0.1 required');
  assert(/^urn:uu-aap:kontur:human-activation-review-decision:[0-9a-f]{24}$/.test(decision.decision_id || ''),
    'KONTUR Activation Preflight: invalid HAR decision ID');
  assert(typeof decision.reviewer_ref === 'string' && decision.reviewer_ref.length > 0,
    'KONTUR Activation Preflight: HAR reviewer_ref required');
  assert(decision.decision === 'approve_intent_preparation' &&
    decision.safe_effect === 'activation_intent_preparation_may_be_requested',
    'KONTUR Activation Preflight: HAR did not approve intent preparation');
  assertExactKeys(decision.confirmations, HAR_CONFIRMATIONS, 'KONTUR Activation Preflight: HAR confirmations');
  HAR_CONFIRMATIONS.forEach((key) => assert(decision.confirmations[key] === true,
    `KONTUR Activation Preflight: HAR approval requires ${key}=true`));
  assertExactKeys(decision.human_declaration, ['declaration_type', 'typed_confirmation', 'nonce', 'explicit'],
    'KONTUR Activation Preflight: HAR human declaration');
  assert(decision.human_declaration.declaration_type === 'approve_intent_preparation_only' &&
    decision.human_declaration.typed_confirmation === 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY' &&
    /^urn:uu-aap:kontur:human-activation-review-nonce:/.test(decision.human_declaration.nonce || '') &&
    decision.human_declaration.explicit === true,
    'KONTUR Activation Preflight: explicit HAR approval declaration required');
  assertExactKeys(decision.review_context, [
    'observed_current_git_revision', 'observed_at', 'packet_expires_at',
    'prior_decisions_complete', 'prior_decision_count', 'replay_guard'
  ], 'KONTUR Activation Preflight: HAR review context');
  assert(decision.review_context.observed_current_git_revision === currentGitRevision,
    'KONTUR Activation Preflight: HAR decision revision drift');
  const prepared = parseTime(packet.prepared_at, 'HAR packet prepared_at');
  const reviewed = parseTime(decision.reviewed_at, 'HAR decision reviewed_at');
  const observed = parseTime(decision.review_context.observed_at, 'HAR decision observed_at');
  const expires = parseTime(packet.expires_at, 'HAR packet expires_at');
  assert(reviewed >= prepared && observed >= reviewed && reviewed <= expires && observed <= expires &&
    decision.review_context.packet_expires_at === packet.expires_at,
    'KONTUR Activation Preflight: HAR decision time/expiry mismatch');
  assert(decision.review_context.prior_decisions_complete === true &&
    Number.isSafeInteger(decision.review_context.prior_decision_count) && decision.review_context.prior_decision_count >= 0,
    'KONTUR Activation Preflight: HAR prior decision history not complete');
  assertExactKeys(decision.review_context.replay_guard, ['nonce_not_seen', 'packet_not_previously_decided'],
    'KONTUR Activation Preflight: HAR replay guard');
  assert(decision.review_context.replay_guard.nonce_not_seen === true &&
    decision.review_context.replay_guard.packet_not_previously_decided === true,
    'KONTUR Activation Preflight: HAR replay guard not satisfied');
  assertExactClaims(decision.claims, HAR_DECISION_CLAIMS, 'KONTUR Activation Preflight: HAR decision claims');

  const expectedPacketBinding = await binding('KONTURHumanActivationReviewPacket', packet.review_packet_id, packet);
  assert(sameBinding(decision.review_packet_binding, expectedPacketBinding),
    'KONTUR Activation Preflight: HAR decision/packet binding substitution');

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
  const idHash = await digestJson(identitySeed);
  assert(decision.decision_id === `urn:uu-aap:kontur:human-activation-review-decision:${idHash.slice(0, 24)}`,
    'KONTUR Activation Preflight: HAR decision_id binding mismatch');
}

async function buildActivationIntent(args) {
  const {
    currentGitRevision, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy,
    activationPolicy, humanActivationReviewPacket, humanActivationReviewDecision, health,
    declaredAt, actorRef, intentNonce, holderId, responsibilityScopes, fencingEpoch, lease
  } = args;
  assert(/^git:[0-9a-f]{40}$/.test(currentGitRevision || ''),
    'KONTUR Activation Preflight: exact Git revision required');
  const declaredMs = parseTime(declaredAt, 'intent declared_at');
  assertActivationPolicy(activationPolicy, declaredMs);
  assertAggregationPolicy(aggregationPolicy, activationPolicy);
  assertResponsibilityPolicy(responsibilityPolicy, activationPolicy);
  assertFrontier(frontier, currentGitRevision, activationPolicy);
  await assertFrontierBindings(frontier, readinessSignal, aggregationPolicy, responsibilityPolicy);
  await assertHumanActivationReviewApproval(humanActivationReviewPacket, humanActivationReviewDecision, currentGitRevision);
  assert(frontier.readiness_epoch === readinessSignal.readiness_epoch,
    'KONTUR Activation Preflight: frontier/readiness epoch mismatch');
  assertReadiness(readinessSignal, activationPolicy, declaredMs, frontier.readiness_epoch);
  assertHealth(health, activationPolicy, declaredMs);
  assert(typeof actorRef === 'string' && actorRef.length > 0,
    'KONTUR Activation Preflight: human actor reference required');
  assert(typeof intentNonce === 'string' && intentNonce.startsWith('urn:uu-aap:kontur:activation-intent-nonce:'),
    'KONTUR Activation Preflight: intent nonce required');
  assert(typeof holderId === 'string' && holderId.startsWith('urn:uu-aap:kontur:holder:'),
    'KONTUR Activation Preflight: valid responsibility holder required');
  const scopes = canonicalScopes(responsibilityScopes, responsibilityPolicy);
  assert(Number.isInteger(fencingEpoch) && fencingEpoch === frontier.readiness_epoch,
    'KONTUR Activation Preflight: fencing epoch must equal readiness epoch');
  assertLease(lease, holderId, activationPolicy.server_instance_id, declaredMs);
  assert(!hasScalarKey(args), 'KONTUR Activation Preflight: scalar scores prohibited');

  const frontierBinding = await binding('KONTURActivationFrontierReceipt', frontier.frontier_id, frontier);
  const readinessBinding = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const healthBinding = await binding('KONTURServerHealthObservation', health.observation_id, health);
  const aggregationBinding = await policyBinding(aggregationPolicy);
  const responsibilityBinding = await policyBinding(responsibilityPolicy);
  const activationBinding = await policyBinding(activationPolicy);
  const harDecisionBinding = await binding(
    'KONTURHumanActivationReviewDecision',
    humanActivationReviewDecision.decision_id,
    humanActivationReviewDecision
  );
  const seed = [
    currentGitRevision, frontierBinding.digest.value, readinessBinding.digest.value,
    aggregationBinding.digest.value, responsibilityBinding.digest.value, activationBinding.digest.value,
    harDecisionBinding.digest.value, healthBinding.digest.value, holderId, scopes.join(','), String(fencingEpoch),
    lease.lease_id, actorRef, intentNonce, declaredAt
  ].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  return {
    $schema: './kontur-activation-intent.schema.json',
    artifact_type: 'KONTURActivationIntent', artifact_version: '0.1',
    intent_id: `urn:uu-aap:kontur:activation-intent:${hash.slice(0, 24)}`,
    declared_at: declaredAt, intended_transition: 'activate', git_revision: currentGitRevision,
    system_id: activationPolicy.system_id, server_instance_id: activationPolicy.server_instance_id,
    readiness_epoch: frontier.readiness_epoch, fencing_epoch: fencingEpoch,
    frontier_binding: frontierBinding, readiness_signal_binding: readinessBinding,
    aggregation_policy_binding: aggregationBinding, responsibility_policy_binding: responsibilityBinding,
    activation_policy_binding: activationBinding,
    human_activation_review_decision_binding: harDecisionBinding,
    human_activation_review_evidence: {
      review_packet: clone(humanActivationReviewPacket),
      decision: clone(humanActivationReviewDecision)
    },
    health_binding: healthBinding,
    holder_id: holderId, responsibility_scopes: scopes, lease: clone(lease),
    human_intent: {
      actor_ref: actorRef, declaration_type: 'explicit_human_activation_intent',
      declared_at: declaredAt, nonce: intentNonce, explicit: true,
      identity_assurance: 'declared_not_cryptographically_verified'
    },
    claims: {
      human_activation_intent_declared: true,
      exact_activation_parameters_bound: true,
      human_activation_review_approval_bound: true,
      human_identity_cryptographically_verified: false,
      kernel_activated: false, responsibility_state_created: false, responsibility_accepted: false,
      execution_authority_granted: false, legal_responsibility_determined: false,
      legal_effect_established: false, moral_blame_assigned: false, truth_certified: false,
      poai_materialization_event_recorded: false, universal_canonicality_established: false
    }
  };
}

async function validateActivationIntent({
  intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy,
  activationPolicy, humanActivationReviewPacket = null, humanActivationReviewDecision = null, health
}) {
  assert(intent && intent.artifact_type === 'KONTURActivationIntent' && intent.artifact_version === '0.1',
    'KONTUR Activation Preflight: exact activation intent v0.1 required');
  assert(intendedKeys(intent), 'KONTUR Activation Preflight: activation intent exact contract keys required');
  assertExactKeys(intent.human_activation_review_evidence, ['review_packet', 'decision'],
    'KONTUR Activation Preflight: embedded HAR evidence');
  const embeddedPacket = intent.human_activation_review_evidence.review_packet;
  const embeddedDecision = intent.human_activation_review_evidence.decision;
  if (humanActivationReviewPacket !== null) {
    assert(await digestJson(humanActivationReviewPacket) === await digestJson(embeddedPacket),
      'KONTUR Activation Preflight: external/embedded HAR packet substitution');
  }
  if (humanActivationReviewDecision !== null) {
    assert(await digestJson(humanActivationReviewDecision) === await digestJson(embeddedDecision),
      'KONTUR Activation Preflight: external/embedded HAR decision substitution');
  }

  const declaredMs = parseTime(intent.declared_at, 'intent declared_at');
  assertActivationPolicy(activationPolicy, declaredMs);
  assertAggregationPolicy(aggregationPolicy, activationPolicy);
  assertResponsibilityPolicy(responsibilityPolicy, activationPolicy);
  assertFrontier(frontier, currentGitRevision, activationPolicy);
  await assertFrontierBindings(frontier, readinessSignal, aggregationPolicy, responsibilityPolicy);
  await assertHumanActivationReviewApproval(embeddedPacket, embeddedDecision, currentGitRevision);
  assertReadiness(readinessSignal, activationPolicy, declaredMs, frontier.readiness_epoch);
  assertHealth(health, activationPolicy, declaredMs);
  assert(intent.intended_transition === 'activate', 'KONTUR Activation Preflight: transition substitution');
  assert(intent.git_revision === currentGitRevision, 'KONTUR Activation Preflight: intent Git revision drift');
  assert(intent.system_id === activationPolicy.system_id && intent.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: intent system/server identity substitution');
  assert(intent.readiness_epoch === frontier.readiness_epoch && intent.fencing_epoch === frontier.readiness_epoch,
    'KONTUR Activation Preflight: intent epoch substitution');
  assert(sameBinding(intent.frontier_binding, await binding('KONTURActivationFrontierReceipt', frontier.frontier_id, frontier)),
    'KONTUR Activation Preflight: intent frontier binding substitution');
  assert(sameBinding(intent.readiness_signal_binding, await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal)),
    'KONTUR Activation Preflight: intent readiness binding substitution');
  assert(samePolicyBinding(intent.aggregation_policy_binding, await policyBinding(aggregationPolicy)),
    'KONTUR Activation Preflight: intent aggregation policy binding substitution');
  assert(samePolicyBinding(intent.responsibility_policy_binding, await policyBinding(responsibilityPolicy)),
    'KONTUR Activation Preflight: intent responsibility policy binding substitution');
  assert(samePolicyBinding(intent.activation_policy_binding, await policyBinding(activationPolicy)),
    'KONTUR Activation Preflight: intent activation policy binding substitution');
  assert(sameBinding(
    intent.human_activation_review_decision_binding,
    await binding('KONTURHumanActivationReviewDecision', embeddedDecision.decision_id, embeddedDecision)
  ), 'KONTUR Activation Preflight: intent HAR decision binding substitution');
  assert(sameBinding(intent.health_binding, await binding('KONTURServerHealthObservation', health.observation_id, health)),
    'KONTUR Activation Preflight: intent health binding substitution');
  assert(typeof intent.holder_id === 'string' && intent.holder_id.startsWith('urn:uu-aap:kontur:holder:'),
    'KONTUR Activation Preflight: invalid intent holder');
  const scopes = canonicalScopes(intent.responsibility_scopes, responsibilityPolicy);
  assert(sameArray(intent.responsibility_scopes, scopes), 'KONTUR Activation Preflight: intent scopes must be canonical');
  assertLease(intent.lease, intent.holder_id, activationPolicy.server_instance_id, declaredMs);
  assert(intent.human_intent && intent.human_intent.explicit === true &&
    intent.human_intent.declaration_type === 'explicit_human_activation_intent',
    'KONTUR Activation Preflight: explicit human activation intent missing');
  assert(intent.human_intent.declared_at === intent.declared_at,
    'KONTUR Activation Preflight: human intent timestamp substitution');
  assert(typeof intent.human_intent.actor_ref === 'string' && intent.human_intent.actor_ref.length > 0,
    'KONTUR Activation Preflight: human actor reference required');
  assert(typeof intent.human_intent.nonce === 'string' && intent.human_intent.nonce.startsWith('urn:uu-aap:kontur:activation-intent-nonce:'),
    'KONTUR Activation Preflight: human intent nonce required');
  assert(intent.human_intent.identity_assurance === 'declared_not_cryptographically_verified',
    'KONTUR Activation Preflight: unsupported human identity assurance');
  assert(intent.claims && intent.claims.human_activation_intent_declared === true &&
    intent.claims.exact_activation_parameters_bound === true &&
    intent.claims.human_activation_review_approval_bound === true &&
    intent.claims.human_identity_cryptographically_verified === false,
    'KONTUR Activation Preflight: intent claims invalid');
  assertNoTrueProhibitedClaims(intent.claims, 'KONTURActivationIntent');
  assert(!hasScalarKey(intent), 'KONTUR Activation Preflight: scalar scores prohibited');
  return true;
}

function intendedKeys(intent) {
  const expected = [
    '$schema', 'artifact_type', 'artifact_version', 'intent_id', 'declared_at', 'intended_transition',
    'git_revision', 'system_id', 'server_instance_id', 'readiness_epoch', 'fencing_epoch',
    'frontier_binding', 'readiness_signal_binding', 'aggregation_policy_binding', 'responsibility_policy_binding',
    'activation_policy_binding', 'human_activation_review_decision_binding', 'human_activation_review_evidence',
    'health_binding', 'holder_id', 'responsibility_scopes', 'lease', 'human_intent', 'claims'
  ].sort();
  return JSON.stringify(Object.keys(intent).sort()) === JSON.stringify(expected);
}

async function preflightActivation({
  intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy,
  activationPolicy, humanActivationReviewPacket = null, humanActivationReviewDecision = null, health,
  evaluatedAt, parallelActiveHolders, currentResponsibilityState
}) {
  const evaluatedMs = parseTime(evaluatedAt, 'evaluated_at');
  await validateActivationIntent({
    intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy,
    responsibilityPolicy, activationPolicy, humanActivationReviewPacket, humanActivationReviewDecision, health
  });
  assertActivationPolicy(activationPolicy, evaluatedMs);
  assertReadiness(readinessSignal, activationPolicy, evaluatedMs, frontier.readiness_epoch);
  assertHealth(health, activationPolicy, evaluatedMs);
  assert(evaluatedMs - parseTime(intent.declared_at, 'intent declared_at') <= activationPolicy.max_intent_age_seconds * 1000,
    'KONTUR Activation Preflight: activation intent is stale or future-dated');
  assert(parseTime(intent.declared_at, 'intent declared_at') <= evaluatedMs,
    'KONTUR Activation Preflight: activation intent is stale or future-dated');
  assertLease(intent.lease, intent.holder_id, activationPolicy.server_instance_id, evaluatedMs);
  assert(Array.isArray(parallelActiveHolders) && parallelActiveHolders.length === 0,
    'KONTUR Activation Preflight: parallel active holder detected');
  assert(currentResponsibilityState === null,
    'KONTUR Activation Preflight: genesis activation requires no current responsibility state');

  const intentBinding = await binding('KONTURActivationIntent', intent.intent_id, intent);
  const seed = [intentBinding.digest.value, evaluatedAt, currentGitRevision].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  return {
    $schema: './kontur-activation-preflight-receipt.schema.json',
    artifact_type: 'KONTURActivationPreflightReceipt', artifact_version: '0.1',
    preflight_id: `urn:uu-aap:kontur:activation-preflight:${hash.slice(0, 24)}`,
    evaluated_at: evaluatedAt, decision: 'human_execute_step_may_proceed',
    current_git_revision: currentGitRevision, system_id: activationPolicy.system_id,
    server_instance_id: activationPolicy.server_instance_id, readiness_epoch: frontier.readiness_epoch,
    fencing_epoch: intent.fencing_epoch, holder_id: intent.holder_id,
    responsibility_scopes: [...intent.responsibility_scopes], lease: clone(intent.lease),
    intent_binding: intentBinding,
    claims: {
      activation_intent_verified: true, activation_preconditions_revalidated: true,
      human_execute_step_may_proceed: true, kernel_activated: false,
      responsibility_state_created: false, responsibility_accepted: false,
      execution_authority_granted: false, legal_responsibility_determined: false,
      truth_certified: false, universal_canonicality_established: false
    }
  };
}

async function validateActivationPreflightReceipt({
  receipt, intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy,
  responsibilityPolicy, activationPolicy, humanActivationReviewPacket = null,
  humanActivationReviewDecision = null, health
}) {
  assert(receipt && receipt.artifact_type === 'KONTURActivationPreflightReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Activation Preflight: exact preflight receipt v0.1 required');
  assert(receipt.decision === 'human_execute_step_may_proceed', 'KONTUR Activation Preflight: invalid preflight decision');
  assert(receipt.current_git_revision === currentGitRevision, 'KONTUR Activation Preflight: preflight Git revision drift');
  await validateActivationIntent({
    intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy,
    responsibilityPolicy, activationPolicy, humanActivationReviewPacket, humanActivationReviewDecision, health
  });
  assert(sameBinding(receipt.intent_binding, await binding('KONTURActivationIntent', intent.intent_id, intent)),
    'KONTUR Activation Preflight: preflight intent binding substitution');
  assert(receipt.system_id === intent.system_id && receipt.server_instance_id === intent.server_instance_id,
    'KONTUR Activation Preflight: preflight system/server substitution');
  assert(receipt.readiness_epoch === intent.readiness_epoch && receipt.fencing_epoch === intent.fencing_epoch,
    'KONTUR Activation Preflight: preflight epoch substitution');
  assert(receipt.holder_id === intent.holder_id && sameArray(receipt.responsibility_scopes, intent.responsibility_scopes),
    'KONTUR Activation Preflight: preflight holder/scope substitution');
  assert(JSON.stringify(receipt.lease) === JSON.stringify(intent.lease),
    'KONTUR Activation Preflight: preflight lease substitution');
  assert(receipt.claims && receipt.claims.activation_intent_verified === true &&
    receipt.claims.activation_preconditions_revalidated === true &&
    receipt.claims.human_execute_step_may_proceed === true,
    'KONTUR Activation Preflight: preflight positive claims missing');
  assertNoTrueProhibitedClaims(receipt.claims, 'KONTURActivationPreflightReceipt');
  assert(!hasScalarKey(receipt), 'KONTUR Activation Preflight: scalar scores prohibited');
  return true;
}

module.exports = {
  digestJson,
  buildActivationIntent,
  validateActivationIntent,
  preflightActivation,
  validateActivationPreflightReceipt
};
