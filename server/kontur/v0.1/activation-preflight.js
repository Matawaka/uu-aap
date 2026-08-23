'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const REQUIRED_FALSE_CLAIMS = [
  'kernel_activated',
  'responsibility_state_created',
  'responsibility_accepted',
  'execution_authority_granted',
  'legal_responsibility_determined',
  'legal_effect_established',
  'moral_blame_assigned',
  'truth_certified',
  'poai_materialization_event_recorded',
  'universal_canonicality_established'
];

const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'likelihood', 'confidence_score',
  'readiness_score', 'responsibility_score', 'causal_score', 'rating', 'weight'
]);

function assert(value, message) {
  if (!value) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Activation Preflight: invalid ${label}`);
  return ms;
}

function uniqSorted(values) {
  return [...new Set(Array.isArray(values) ? values : [])].sort();
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
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

async function policyBinding(policy) {
  return {
    artifact_type: policy.artifact_type,
    artifact_ref: policy.policy_id,
    policy_version: policy.policy_version,
    digest: digest(await digestJson(policy))
  };
}

function sameBinding(left, right) {
  return !!left && !!right &&
    left.artifact_type === right.artifact_type &&
    left.artifact_ref === right.artifact_ref &&
    left.digest && right.digest && left.digest.value === right.digest.value;
}

function samePolicyBinding(left, right) {
  return sameBinding(left, right) && left.policy_version === right.policy_version;
}

function assertFalseClaims(claims, label) {
  for (const key of REQUIRED_FALSE_CLAIMS) {
    assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
  }
}

function assertActivationPolicy(policy, evaluatedMs = null) {
  assert(policy && policy.artifact_type === 'KONTURActivationPolicy' && policy.artifact_version === '0.1',
    'KONTUR Activation Preflight: KONTURActivationPolicy v0.1 required');
  assert(typeof policy.policy_id === 'string' && policy.policy_id.startsWith('urn:uu-aap:kontur:activation-policy:'),
    'KONTUR Activation Preflight: invalid activation policy ID');
  assert(Number.isInteger(policy.policy_version) && policy.policy_version >= 1,
    'KONTUR Activation Preflight: invalid activation policy version');
  assert(policy.allowed_transition === 'activate',
    'KONTUR Activation Preflight: activation policy may allow only activate');
  assert(Number.isInteger(policy.max_health_age_seconds) && policy.max_health_age_seconds > 0 && policy.max_health_age_seconds <= 300,
    'KONTUR Activation Preflight: invalid activation health freshness');
  assert(Number.isInteger(policy.max_intent_age_seconds) && policy.max_intent_age_seconds > 0 && policy.max_intent_age_seconds <= 900,
    'KONTUR Activation Preflight: invalid activation intent freshness');
  const req = policy.requirements || {};
  for (const key of [
    'exact_git_revision', 'exact_frontier_binding', 'exact_readiness_binding',
    'exact_policy_bindings', 'exact_system_server_identity', 'exact_epoch',
    'healthy_server', 'live_lease', 'no_parallel_active_holder',
    'explicit_human_activation_intent', 'genesis_activation_only', 'preflight_side_effect_free'
  ]) {
    assert(req[key] === true, `KONTUR Activation Preflight: activation policy requirement weakened: ${key}`);
  }
  assert(req.auto_activation_allowed === false,
    'KONTUR Activation Preflight: auto activation must remain prohibited');
  assert(policy.responsibility_scope_source === 'exact_responsibility_policy_allowlist',
    'KONTUR Activation Preflight: responsibility scope source weakened');
  assertFalseClaims(policy.claims, 'KONTURActivationPolicy');
  assert(policy.claims.activation_policy_defined === true,
    'KONTUR Activation Preflight: activation policy declaration missing');

  const effectiveFrom = parseTime(policy.effective_from, 'activation policy effective_from');
  const effectiveUntil = policy.effective_until === null ? null : parseTime(policy.effective_until, 'activation policy effective_until');
  if (effectiveUntil !== null) assert(effectiveFrom < effectiveUntil,
    'KONTUR Activation Preflight: invalid activation policy interval');
  if (evaluatedMs !== null) {
    assert(effectiveFrom <= evaluatedMs && (effectiveUntil === null || evaluatedMs < effectiveUntil),
      'KONTUR Activation Preflight: activation policy not effective');
  }
}

function assertAggregationPolicy(policy, activationPolicy) {
  assert(policy && policy.artifact_type === 'KONTURReadinessAggregationPolicy' && policy.artifact_version === '0.1',
    'KONTUR Activation Preflight: KONTURReadinessAggregationPolicy v0.1 required');
  assert(policy.system_id === activationPolicy.system_id && policy.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: aggregation policy identity mismatch');
  assert(policy.aggregation_rule === 'all_required_checks_pass',
    'KONTUR Activation Preflight: aggregation rule drift');
  assert(policy.claims && policy.claims.kernel_activated === false && policy.claims.execution_authority_granted === false,
    'KONTUR Activation Preflight: aggregation policy assurance boundary invalid');
}

function assertResponsibilityPolicy(policy, activationPolicy) {
  assert(policy && policy.artifact_type === 'KONTURResponsibilityPolicy' && policy.artifact_version === '0.1',
    'KONTUR Activation Preflight: KONTURResponsibilityPolicy v0.1 required');
  assert(policy.system_id === activationPolicy.system_id && policy.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: responsibility policy identity mismatch');
  assert(Array.isArray(policy.responsibility_scope_allowlist) && policy.responsibility_scope_allowlist.length > 0,
    'KONTUR Activation Preflight: responsibility scope allowlist missing');
  assert(policy.invariants && policy.invariants.single_active_holder === true &&
    policy.invariants.epoch_monotonic === true && policy.invariants.fencing_required === true &&
    policy.invariants.lease_required === true && policy.invariants.health_fail_closed === true,
    'KONTUR Activation Preflight: responsibility invariants weakened');
  assertFalseClaims(policy.claims, 'KONTURResponsibilityPolicy');
}

function assertFrontier(frontier, currentGitRevision) {
  assert(frontier && frontier.artifact_type === 'KONTURActivationFrontierReceipt' && frontier.artifact_version === '0.1',
    'KONTUR Activation Preflight: KONTURActivationFrontierReceipt v0.1 required');
  assert(frontier.status === 'activation_prompt_may_be_requested',
    'KONTUR Activation Preflight: frontier does not admit activation prompt');
  assert(frontier.git_revision === currentGitRevision,
    'KONTUR Activation Preflight: canonical Git revision drift');
  assert(frontier.claims && frontier.claims.canonical_frontier_bound === true &&
    frontier.claims.readiness_accepted === true && frontier.claims.activation_prompt_may_be_requested === true &&
    frontier.claims.human_activation_step_still_required === true,
    'KONTUR Activation Preflight: activation frontier assurance boundary invalid');
  assertFalseClaims(frontier.claims, 'KONTURActivationFrontierReceipt');
}

function assertReadinessSignal(signal, activationPolicy, evaluatedMs, epoch) {
  assert(signal && signal.artifact_type === 'KONTURReadinessSignal' && signal.artifact_version === '0.1',
    'KONTUR Activation Preflight: KONTURReadinessSignal v0.1 required');
  assert(signal.system_id === activationPolicy.system_id && signal.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: readiness identity mismatch');
  assert(signal.readiness_epoch === epoch,
    'KONTUR Activation Preflight: readiness epoch substitution');
  assert(signal.ready === true, 'KONTUR Activation Preflight: readiness signal is not ready');
  assert(Array.isArray(signal.checks) && signal.checks.length > 0 && signal.checks.every((item) => item.status === 'pass'),
    'KONTUR Activation Preflight: readiness checks are not all pass');
  const emitted = parseTime(signal.emitted_at, 'readiness emitted_at');
  const validUntil = parseTime(signal.valid_until, 'readiness valid_until');
  assert(emitted <= evaluatedMs && evaluatedMs < validUntil,
    'KONTUR Activation Preflight: readiness signal expired or not yet valid');
  assert(signal.claims && signal.claims.readiness_observed === true,
    'KONTUR Activation Preflight: readiness observation claim missing');
  assertFalseClaims(signal.claims, 'KONTURReadinessSignal');
}

function assertHealth(health, activationPolicy, evaluatedMs) {
  assert(health && health.artifact_type === 'KONTURServerHealthObservation' && health.artifact_version === '0.1',
    'KONTUR Activation Preflight: KONTURServerHealthObservation v0.1 required');
  assert(health.system_id === activationPolicy.system_id && health.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: health identity mismatch');
  assert(health.status === 'healthy' && Array.isArray(health.components) &&
    health.components.length > 0 && health.components.every((item) => item.status === 'pass'),
    'KONTUR Activation Preflight: server health is not healthy');
  const observed = parseTime(health.observed_at, 'health observed_at');
  assert(observed <= evaluatedMs,
    'KONTUR Activation Preflight: health observation is later than preflight');
  assert(evaluatedMs - observed <= activationPolicy.max_health_age_seconds * 1000,
    'KONTUR Activation Preflight: server health observation is stale');
  assert(health.claims && health.claims.server_health_observed === true && health.claims.global_readiness_established === false,
    'KONTUR Activation Preflight: health assurance boundary invalid');
  assertFalseClaims(health.claims, 'KONTURServerHealthObservation');
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

function assertScopes(scopes, responsibilityPolicy) {
  const normalized = uniqSorted(scopes);
  assert(normalized.length > 0, 'KONTUR Activation Preflight: non-empty responsibility scopes required');
  assert(normalized.length === scopes.length,
    'KONTUR Activation Preflight: duplicate responsibility scopes');
  for (const scope of normalized) {
    assert(responsibilityPolicy.responsibility_scope_allowlist.includes(scope),
      `KONTUR Activation Preflight: responsibility scope not allowed: ${scope}`);
  }
  return normalized;
}

async function assertFrontierBindings({ frontier, readinessSignal, aggregationPolicy, responsibilityPolicy }) {
  const readinessExpected = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const aggregationExpected = await binding('KONTURReadinessAggregationPolicy', aggregationPolicy.policy_id, aggregationPolicy);
  const responsibilityExpected = await binding('KONTURResponsibilityPolicy', responsibilityPolicy.policy_id, responsibilityPolicy);
  assert(sameBinding(frontier.readiness_signal_binding, readinessExpected),
    'KONTUR Activation Preflight: frontier readiness binding substitution');
  assert(sameBinding(frontier.aggregation_policy_binding, aggregationExpected),
    'KONTUR Activation Preflight: frontier aggregation policy binding substitution');
  assert(sameBinding(frontier.responsibility_policy_binding, responsibilityExpected),
    'KONTUR Activation Preflight: frontier responsibility policy binding substitution');
}

async function buildActivationIntent({
  currentGitRevision,
  frontier,
  readinessSignal,
  aggregationPolicy,
  responsibilityPolicy,
  activationPolicy,
  health,
  declaredAt,
  actorRef,
  intentNonce,
  holderId,
  responsibilityScopes,
  fencingEpoch,
  lease
}) {
  assert(/^git:[0-9a-f]{40}$/.test(currentGitRevision || ''),
    'KONTUR Activation Preflight: exact Git revision required');
  const declaredMs = parseTime(declaredAt, 'intent declared_at');
  assertActivationPolicy(activationPolicy, declaredMs);
  assertAggregationPolicy(aggregationPolicy, activationPolicy);
  assertResponsibilityPolicy(responsibilityPolicy, activationPolicy);
  assertFrontier(frontier, currentGitRevision);
  await assertFrontierBindings({ frontier, readinessSignal, aggregationPolicy, responsibilityPolicy });
  assert(frontier.system_id === activationPolicy.system_id && frontier.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: frontier identity mismatch');
  assert(frontier.readiness_epoch === readinessSignal.readiness_epoch,
    'KONTUR Activation Preflight: frontier/readiness epoch mismatch');
  assertReadinessSignal(readinessSignal, activationPolicy, declaredMs, frontier.readiness_epoch);
  assertHealth(health, activationPolicy, declaredMs);
  assert(typeof actorRef === 'string' && actorRef.length > 0,
    'KONTUR Activation Preflight: human actor reference required');
  assert(typeof intentNonce === 'string' && intentNonce.startsWith('urn:uu-aap:kontur:activation-intent-nonce:'),
    'KONTUR Activation Preflight: activation intent nonce required');
  assert(typeof holderId === 'string' && holderId.startsWith('urn:uu-aap:kontur:holder:'),
    'KONTUR Activation Preflight: valid responsibility holder required');
  const scopes = assertScopes(responsibilityScopes, responsibilityPolicy);
  assert(Number.isInteger(fencingEpoch) && fencingEpoch === frontier.readiness_epoch,
    'KONTUR Activation Preflight: fencing epoch must equal readiness epoch for genesis activation');
  assertLease(lease, holderId, activationPolicy.server_instance_id, declaredMs);
  assert(!hasScalarKey({ frontier, readinessSignal, aggregationPolicy, responsibilityPolicy, activationPolicy, health, lease }),
    'KONTUR Activation Preflight: scalar readiness/responsibility scores prohibited');

  const frontierBinding = await binding('KONTURActivationFrontierReceipt', frontier.frontier_id, frontier);
  const readinessBinding = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const healthBinding = await binding('KONTURServerHealthObservation', health.observation_id, health);
  const aggregationBinding = await policyBinding(aggregationPolicy);
  const responsibilityBinding = await policyBinding(responsibilityPolicy);
  const activationBinding = await policyBinding(activationPolicy);

  const seed = [
    currentGitRevision,
    frontierBinding.digest.value,
    readinessBinding.digest.value,
    aggregationBinding.digest.value,
    responsibilityBinding.digest.value,
    activationBinding.digest.value,
    healthBinding.digest.value,
    holderId,
    scopes.join(','),
    String(fencingEpoch),
    lease.lease_id,
    actorRef,
    intentNonce,
    declaredAt
  ].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './kontur-activation-intent.schema.json',
    artifact_type: 'KONTURActivationIntent',
    artifact_version: '0.1',
    intent_id: `urn:uu-aap:kontur:activation-intent:${hash.slice(0, 24)}`,
    declared_at: declaredAt,
    intended_transition: 'activate',
    git_revision: currentGitRevision,
    system_id: activationPolicy.system_id,
    server_instance_id: activationPolicy.server_instance_id,
    readiness_epoch: frontier.readiness_epoch,
    fencing_epoch: fencingEpoch,
    frontier_binding: frontierBinding,
    readiness_signal_binding: readinessBinding,
    aggregation_policy_binding: aggregationBinding,
    responsibility_policy_binding: responsibilityBinding,
    activation_policy_binding: activationBinding,
    health_binding: healthBinding,
    holder_id: holderId,
    responsibility_scopes: scopes,
    lease: clone(lease),
    human_intent: {
      actor_ref: actorRef,
      declaration_type: 'explicit_human_activation_intent',
      declared_at: declaredAt,
      nonce: intentNonce,
      explicit: true,
      identity_assurance: 'declared_not_cryptographically_verified'
    },
    claims: {
      human_activation_intent_declared: true,
      exact_activation_parameters_bound: true,
      human_identity_cryptographically_verified: false,
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

async function validateActivationIntent({
  intent,
  currentGitRevision,
  frontier,
  readinessSignal,
  aggregationPolicy,
  responsibilityPolicy,
  activationPolicy,
  health
}) {
  assert(intent && intent.artifact_type === 'KONTURActivationIntent' && intent.artifact_version === '0.1',
    'KONTUR Activation Preflight: invalid activation intent');
  assert(!hasScalarKey(intent), 'KONTUR Activation Preflight: scalar fields prohibited in activation intent');
  assertFalseClaims(intent.claims, 'KONTURActivationIntent');
  assert(intent.claims.human_activation_intent_declared === true &&
    intent.claims.exact_activation_parameters_bound === true &&
    intent.claims.human_identity_cryptographically_verified === false,
    'KONTUR Activation Preflight: activation intent assurance boundary invalid');
  assert(intent.intended_transition === 'activate',
    'KONTUR Activation Preflight: activation intent transition substitution');
  assert(intent.git_revision === currentGitRevision && frontier.git_revision === currentGitRevision,
    'KONTUR Activation Preflight: activation intent Git revision drift');
  assert(intent.system_id === activationPolicy.system_id && intent.server_instance_id === activationPolicy.server_instance_id,
    'KONTUR Activation Preflight: activation intent identity drift');
  assert(intent.readiness_epoch === frontier.readiness_epoch && intent.fencing_epoch === intent.readiness_epoch,
    'KONTUR Activation Preflight: activation intent epoch drift');
  assert(intent.human_intent && intent.human_intent.explicit === true &&
    intent.human_intent.declaration_type === 'explicit_human_activation_intent' &&
    intent.human_intent.declared_at === intent.declared_at &&
    intent.human_intent.identity_assurance === 'declared_not_cryptographically_verified',
    'KONTUR Activation Preflight: explicit human activation intent missing');
  const scopes = assertScopes(intent.responsibility_scopes, responsibilityPolicy);
  assert(sameArray(scopes, intent.responsibility_scopes),
    'KONTUR Activation Preflight: responsibility scopes are not canonical');
  assertLease(intent.lease, intent.holder_id, intent.server_instance_id, parseTime(intent.declared_at, 'intent declared_at'));

  const expectedFrontier = await binding('KONTURActivationFrontierReceipt', frontier.frontier_id, frontier);
  const expectedReadiness = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const expectedHealth = await binding('KONTURServerHealthObservation', health.observation_id, health);
  const expectedAggregation = await policyBinding(aggregationPolicy);
  const expectedResponsibility = await policyBinding(responsibilityPolicy);
  const expectedActivation = await policyBinding(activationPolicy);
  assert(sameBinding(intent.frontier_binding, expectedFrontier),
    'KONTUR Activation Preflight: intent frontier binding substitution');
  assert(sameBinding(intent.readiness_signal_binding, expectedReadiness),
    'KONTUR Activation Preflight: intent readiness binding substitution');
  assert(sameBinding(intent.health_binding, expectedHealth),
    'KONTUR Activation Preflight: intent health binding substitution');
  assert(samePolicyBinding(intent.aggregation_policy_binding, expectedAggregation),
    'KONTUR Activation Preflight: intent aggregation policy binding substitution');
  assert(samePolicyBinding(intent.responsibility_policy_binding, expectedResponsibility),
    'KONTUR Activation Preflight: intent responsibility policy binding substitution');
  assert(samePolicyBinding(intent.activation_policy_binding, expectedActivation),
    'KONTUR Activation Preflight: intent activation policy binding substitution');
  return true;
}

async function preflightActivation({
  intent,
  currentGitRevision,
  frontier,
  readinessSignal,
  aggregationPolicy,
  responsibilityPolicy,
  activationPolicy,
  health,
  evaluatedAt,
  parallelActiveHolders = [],
  currentResponsibilityState = null
}) {
  const evaluatedMs = parseTime(evaluatedAt, 'preflight evaluated_at');
  assertActivationPolicy(activationPolicy, evaluatedMs);
  assertAggregationPolicy(aggregationPolicy, activationPolicy);
  assertResponsibilityPolicy(responsibilityPolicy, activationPolicy);
  assertFrontier(frontier, currentGitRevision);
  await assertFrontierBindings({ frontier, readinessSignal, aggregationPolicy, responsibilityPolicy });
  await validateActivationIntent({
    intent, currentGitRevision, frontier, readinessSignal,
    aggregationPolicy, responsibilityPolicy, activationPolicy, health
  });

  const declaredMs = parseTime(intent.declared_at, 'intent declared_at');
  assert(declaredMs <= evaluatedMs,
    'KONTUR Activation Preflight: activation intent declared after preflight');
  assert(evaluatedMs - declaredMs <= activationPolicy.max_intent_age_seconds * 1000,
    'KONTUR Activation Preflight: activation intent is stale');
  assertReadinessSignal(readinessSignal, activationPolicy, evaluatedMs, intent.readiness_epoch);
  assertHealth(health, activationPolicy, evaluatedMs);
  assertLease(intent.lease, intent.holder_id, intent.server_instance_id, evaluatedMs);
  assert(Array.isArray(parallelActiveHolders) && parallelActiveHolders.length === 0,
    'KONTUR Activation Preflight: parallel active holder frontier detected');
  assert(currentResponsibilityState === null,
    'KONTUR Activation Preflight: genesis activation requires no current responsibility state');
  assert(intent.intended_transition === activationPolicy.allowed_transition && intent.intended_transition === 'activate',
    'KONTUR Activation Preflight: only activate transition is admissible');
  assert(!hasScalarKey({ intent, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy, activationPolicy, health }),
    'KONTUR Activation Preflight: scalar readiness/responsibility scores prohibited');

  const intentBinding = await binding('KONTURActivationIntent', intent.intent_id, intent);
  const frontierBinding = await binding('KONTURActivationFrontierReceipt', frontier.frontier_id, frontier);
  const readinessBinding = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const healthBinding = await binding('KONTURServerHealthObservation', health.observation_id, health);
  const aggregationBinding = await policyBinding(aggregationPolicy);
  const responsibilityBinding = await policyBinding(responsibilityPolicy);
  const activationBinding = await policyBinding(activationPolicy);
  const seed = [
    intentBinding.digest.value,
    frontierBinding.digest.value,
    readinessBinding.digest.value,
    healthBinding.digest.value,
    aggregationBinding.digest.value,
    responsibilityBinding.digest.value,
    activationBinding.digest.value,
    currentGitRevision,
    evaluatedAt
  ].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  const receipt = {
    $schema: './kontur-activation-preflight.schema.json',
    artifact_type: 'KONTURActivationPreflightReceipt',
    artifact_version: '0.1',
    preflight_id: `urn:uu-aap:kontur:activation-preflight:${hash.slice(0, 24)}`,
    evaluated_at: evaluatedAt,
    current_git_revision: currentGitRevision,
    intent_binding: intentBinding,
    frontier_binding: frontierBinding,
    readiness_signal_binding: readinessBinding,
    aggregation_policy_binding: aggregationBinding,
    responsibility_policy_binding: responsibilityBinding,
    activation_policy_binding: activationBinding,
    health_binding: healthBinding,
    system_id: intent.system_id,
    server_instance_id: intent.server_instance_id,
    readiness_epoch: intent.readiness_epoch,
    fencing_epoch: intent.fencing_epoch,
    holder_id: intent.holder_id,
    responsibility_scopes: clone(intent.responsibility_scopes),
    lease: clone(intent.lease),
    checks: {
      git_revision_exact: true,
      frontier_exact: true,
      frontier_admits_activation_prompt: true,
      readiness_signal_exact: true,
      readiness_signal_current: true,
      aggregation_policy_exact: true,
      responsibility_policy_exact: true,
      activation_policy_exact: true,
      activation_policy_effective: true,
      identity_exact: true,
      epoch_exact: true,
      health_exact: true,
      health_current: true,
      health_healthy: true,
      holder_exact: true,
      responsibility_scopes_exact: true,
      responsibility_scopes_allowed: true,
      lease_exact: true,
      lease_live: true,
      parallel_active_holder_absent: true,
      human_intent_explicit: true,
      human_intent_current: true,
      transition_activate_exact: true,
      genesis_activation_frontier: true,
      preflight_side_effect_free: true
    },
    decision: 'human_execute_step_may_proceed',
    claims: {
      activation_intent_verified: true,
      activation_preconditions_revalidated: true,
      human_execute_step_may_proceed: true,
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
  await validateActivationPreflightReceipt({
    receipt, intent, currentGitRevision, frontier, readinessSignal,
    aggregationPolicy, responsibilityPolicy, activationPolicy, health
  });
  return receipt;
}

async function validateActivationPreflightReceipt({
  receipt,
  intent,
  currentGitRevision,
  frontier,
  readinessSignal,
  aggregationPolicy,
  responsibilityPolicy,
  activationPolicy,
  health
}) {
  assert(receipt && receipt.artifact_type === 'KONTURActivationPreflightReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Activation Preflight: invalid preflight receipt');
  assert(!hasScalarKey(receipt), 'KONTUR Activation Preflight: scalar fields prohibited in preflight receipt');
  assertFalseClaims(receipt.claims, 'KONTURActivationPreflightReceipt');
  assert(receipt.claims.activation_intent_verified === true &&
    receipt.claims.activation_preconditions_revalidated === true &&
    receipt.claims.human_execute_step_may_proceed === true,
    'KONTUR Activation Preflight: positive preflight claims missing');
  assert(receipt.decision === 'human_execute_step_may_proceed',
    'KONTUR Activation Preflight: preflight decision substitution');
  assert(receipt.current_git_revision === currentGitRevision && receipt.current_git_revision === intent.git_revision,
    'KONTUR Activation Preflight: preflight Git revision drift');
  assert(receipt.system_id === intent.system_id && receipt.server_instance_id === intent.server_instance_id,
    'KONTUR Activation Preflight: preflight identity drift');
  assert(receipt.readiness_epoch === intent.readiness_epoch && receipt.fencing_epoch === intent.fencing_epoch,
    'KONTUR Activation Preflight: preflight epoch drift');
  assert(receipt.holder_id === intent.holder_id,
    'KONTUR Activation Preflight: preflight holder substitution');
  assert(sameArray(receipt.responsibility_scopes, intent.responsibility_scopes),
    'KONTUR Activation Preflight: preflight responsibility scope substitution');
  assert(JSON.stringify(receipt.lease) === JSON.stringify(intent.lease),
    'KONTUR Activation Preflight: preflight lease substitution');
  assert(Object.values(receipt.checks || {}).every((value) => value === true),
    'KONTUR Activation Preflight: preflight check not established');

  const expectedIntent = await binding('KONTURActivationIntent', intent.intent_id, intent);
  const expectedFrontier = await binding('KONTURActivationFrontierReceipt', frontier.frontier_id, frontier);
  const expectedReadiness = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  const expectedHealth = await binding('KONTURServerHealthObservation', health.observation_id, health);
  const expectedAggregation = await policyBinding(aggregationPolicy);
  const expectedResponsibility = await policyBinding(responsibilityPolicy);
  const expectedActivation = await policyBinding(activationPolicy);
  assert(sameBinding(receipt.intent_binding, expectedIntent),
    'KONTUR Activation Preflight: preflight intent binding substitution');
  assert(sameBinding(receipt.frontier_binding, expectedFrontier),
    'KONTUR Activation Preflight: preflight frontier binding substitution');
  assert(sameBinding(receipt.readiness_signal_binding, expectedReadiness),
    'KONTUR Activation Preflight: preflight readiness binding substitution');
  assert(sameBinding(receipt.health_binding, expectedHealth),
    'KONTUR Activation Preflight: preflight health binding substitution');
  assert(samePolicyBinding(receipt.aggregation_policy_binding, expectedAggregation),
    'KONTUR Activation Preflight: preflight aggregation policy binding substitution');
  assert(samePolicyBinding(receipt.responsibility_policy_binding, expectedResponsibility),
    'KONTUR Activation Preflight: preflight responsibility policy binding substitution');
  assert(samePolicyBinding(receipt.activation_policy_binding, expectedActivation),
    'KONTUR Activation Preflight: preflight activation policy binding substitution');
  return true;
}

module.exports = {
  digestJson,
  buildActivationIntent,
  validateActivationIntent,
  preflightActivation,
  validateActivationPreflightReceipt
};
