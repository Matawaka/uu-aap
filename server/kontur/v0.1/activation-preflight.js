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

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Activation Preflight: invalid ${label}`);
  return ms;
}
function uniqSorted(values) { return [...new Set(Array.isArray(values) ? values : [])].sort(); }
function sameArray(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
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

function assertHumanActivationReviewDecision(decision, currentGitRevision) {
  assert(decision && decision.artifact_type === 'KONTURHumanActivationReviewDecision' && decision.artifact_version === '0.1',
    'KONTUR Activation Preflight: exact Human Activation Review decision v0.1 required');
  assert(typeof decision.decision_id === 'string' && decision.decision_id.startsWith('urn:uu-aap:kontur:human-activation-review-decision:'),
    'KONTUR Activation Preflight: invalid Human Activation Review decision ID');
  assert(decision.decision === 'approve_intent_preparation',
    'KONTUR Activation Preflight: Human Activation Review did not approve intent preparation');
  assert(decision.safe_effect === 'activation_intent_preparation_may_be_requested',
    'KONTUR Activation Preflight: Human Activation Review safe effect mismatch');
  assert(decision.claims && decision.claims.human_review_decision_recorded === true &&
    decision.claims.activation_intent_preparation_may_be_requested === true,
    'KONTUR Activation Preflight: Human Activation Review approval claim missing');
  for (const key of [
    'activation_intent_created', 'preflight_requested', 'execute_command_created', 'kernel_activated',
    'responsibility_state_created', 'responsibility_accepted', 'execution_authority_granted',
    'permission_expansion_authorized', 'permission_bypass_authorized', 'repository_ownership_transferred',
    'canonical_origin_mutated', 'legal_authority_established', 'truth_certified', 'distributed_consensus_established'
  ]) assert(decision.claims[key] === false, `KONTUR Activation Preflight: Human Activation Review prohibited claim ${key}`);
  assert(decision.review_context && decision.review_context.observed_current_git_revision === currentGitRevision,
    'KONTUR Activation Preflight: Human Activation Review revision drift');
  assert(decision.review_packet_binding && decision.review_packet_binding.artifact_type === 'KONTURHumanActivationReviewPacket',
    'KONTUR Activation Preflight: Human Activation Review packet binding required');
  assert(decision.human_declaration && decision.human_declaration.explicit === true &&
    decision.human_declaration.typed_confirmation === 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
    'KONTUR Activation Preflight: explicit Human Activation Review approval required');
}

async function buildActivationIntent(args) {
  const {
    currentGitRevision, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy,
    activationPolicy, humanActivationReviewDecision, health, declaredAt, actorRef, intentNonce, holderId,
    responsibilityScopes, fencingEpoch, lease
  } = args;
  assert(/^git:[0-9a-f]{40}$/.test(currentGitRevision || ''),
    'KONTUR Activation Preflight: exact Git revision required');
  const declaredMs = parseTime(declaredAt, 'intent declared_at');
  assertActivationPolicy(activationPolicy, declaredMs);
  assertAggregationPolicy(aggregationPolicy, activationPolicy);
  assertResponsibilityPolicy(responsibilityPolicy, activationPolicy);
  assertFrontier(frontier, currentGitRevision, activationPolicy);
  await assertFrontierBindings(frontier, readinessSignal, aggregationPolicy, responsibilityPolicy);
  assertHumanActivationReviewDecision(humanActivationReviewDecision, currentGitRevision);
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
  activationPolicy, humanActivationReviewDecision, health
}) {
  assert(intent && intent.artifact_type === 'KONTURActivationIntent' && intent.artifact_version === '0.1',
    'KONTUR Activation Preflight: exact activation intent v0.1 required');
  assert(intendedKeys(intent), 'KONTUR Activation Preflight: activation intent exact contract keys required');
  const declaredMs = parseTime(intent.declared_at, 'intent declared_at');
  assertActivationPolicy(activationPolicy, declaredMs);
  assertAggregationPolicy(aggregationPolicy, activationPolicy);
  assertResponsibilityPolicy(responsibilityPolicy, activationPolicy);
  assertFrontier(frontier, currentGitRevision, activationPolicy);
  await assertFrontierBindings(frontier, readinessSignal, aggregationPolicy, responsibilityPolicy);
  assertHumanActivationReviewDecision(humanActivationReviewDecision, currentGitRevision);
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
    await binding('KONTURHumanActivationReviewDecision', humanActivationReviewDecision.decision_id, humanActivationReviewDecision)
  ), 'KONTUR Activation Preflight: intent Human Activation Review decision binding substitution');
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
    'activation_policy_binding', 'human_activation_review_decision_binding', 'health_binding', 'holder_id',
    'responsibility_scopes', 'lease', 'human_intent', 'claims'
  ].sort();
  return JSON.stringify(Object.keys(intent).sort()) === JSON.stringify(expected);
}

async function preflightActivation({
  intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy,
  activationPolicy, humanActivationReviewDecision, health, evaluatedAt, parallelActiveHolders, currentResponsibilityState
}) {
  const evaluatedMs = parseTime(evaluatedAt, 'evaluated_at');
  await validateActivationIntent({
    intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy,
    responsibilityPolicy, activationPolicy, humanActivationReviewDecision, health
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
  responsibilityPolicy, activationPolicy, humanActivationReviewDecision, health
}) {
  assert(receipt && receipt.artifact_type === 'KONTURActivationPreflightReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Activation Preflight: exact preflight receipt v0.1 required');
  assert(receipt.decision === 'human_execute_step_may_proceed', 'KONTUR Activation Preflight: invalid preflight decision');
  assert(receipt.current_git_revision === currentGitRevision, 'KONTUR Activation Preflight: preflight Git revision drift');
  await validateActivationIntent({
    intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy,
    responsibilityPolicy, activationPolicy, humanActivationReviewDecision, health
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
