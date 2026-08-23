'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const REQUIRED_FALSE_CLAIMS = [
  'legal_responsibility_determined',
  'legal_effect_established',
  'moral_blame_assigned',
  'truth_certified',
  'universal_causality_established',
  'poai_materialization_event_recorded',
  'universal_canonicality_established'
];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'likelihood', 'confidence_score',
  'responsibility_score', 'causal_score', 'rating', 'weight'
]);
const TRANSITIONS = new Set(['activate', 'heartbeat', 'degrade', 'suspend', 'resume', 'retire']);

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function uniq(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter((v) => typeof v === 'string' && v.length > 0))].sort();
}
function sameArray(a, b) { return a.length === b.length && a.every((v, i) => v === b[i]); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Responsibility Kernel: invalid ${label}`);
  return ms;
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
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
function assertFalseClaims(claims, keys, label) {
  for (const key of keys) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function sameBinding(left, right) {
  return !!left && !!right && left.artifact_type === right.artifact_type &&
    left.artifact_ref === right.artifact_ref && left.digest && right.digest &&
    left.digest.value === right.digest.value;
}

function assertPolicy(policy) {
  assert(policy && policy.artifact_type === 'KONTURResponsibilityPolicy' && policy.artifact_version === '0.1',
    'KONTUR Responsibility Kernel: KONTURResponsibilityPolicy v0.1 required');
  assert(typeof policy.policy_id === 'string' && policy.policy_id.startsWith('urn:uu-aap:kontur:responsibility-policy:'),
    'KONTUR Responsibility Kernel: invalid policy ID');
  assert(Number.isInteger(policy.policy_version) && policy.policy_version >= 1,
    'KONTUR Responsibility Kernel: invalid policy version');
  const inv = policy.invariants || {};
  assert(inv.single_active_holder === true && inv.epoch_monotonic === true && inv.fencing_required === true &&
    inv.lease_required === true && inv.successor_generation_increment === 1 && inv.health_fail_closed === true &&
    inv.fresh_readiness_required_for_recovery === true && inv.retired_terminal === true &&
    inv.scalar_responsibility_score_allowed === false,
    'KONTUR Responsibility Kernel: policy invariants weakened');
  assert(Array.isArray(policy.required_readiness_checks) && policy.required_readiness_checks.length > 0,
    'KONTUR Responsibility Kernel: required readiness checks missing');
  assert(new Set(policy.required_readiness_checks).size === policy.required_readiness_checks.length,
    'KONTUR Responsibility Kernel: duplicate policy readiness checks');
  assert(Array.isArray(policy.responsibility_scope_allowlist) && policy.responsibility_scope_allowlist.length > 0,
    'KONTUR Responsibility Kernel: responsibility scope allowlist missing');
  assertFalseClaims(policy.claims, REQUIRED_FALSE_CLAIMS, 'KONTURResponsibilityPolicy');
}

function validateHealth(health, evaluatedMs) {
  assert(health && ['healthy', 'degraded', 'critical'].includes(health.status),
    'KONTUR Responsibility Kernel: invalid health status');
  const observedMs = parseTime(health.observed_at, 'health observed_at');
  assert(observedMs <= evaluatedMs, 'KONTUR Responsibility Kernel: health observation is later than evaluation');
  assert(Array.isArray(health.components) && health.components.length > 0,
    'KONTUR Responsibility Kernel: health components required');
  const ids = health.components.map((c) => c.component_id);
  assert(new Set(ids).size === ids.length, 'KONTUR Responsibility Kernel: duplicate health component IDs');
  for (const component of health.components) {
    assert(typeof component.component_id === 'string' && component.component_id.length > 0 &&
      ['pass', 'degraded', 'fail'].includes(component.status),
      'KONTUR Responsibility Kernel: invalid health component');
  }
  const statuses = health.components.map((c) => c.status);
  if (health.status === 'healthy') assert(statuses.every((s) => s === 'pass'),
    'KONTUR Responsibility Kernel: healthy state requires every component to pass');
  if (health.status === 'degraded') assert(statuses.some((s) => s === 'degraded') && !statuses.includes('fail'),
    'KONTUR Responsibility Kernel: degraded state requires degradation without critical failure');
  if (health.status === 'critical') assert(statuses.includes('fail'),
    'KONTUR Responsibility Kernel: critical state requires a failed component');
}

function validateLease(lease, evaluatedMs, holderId, serverInstanceId, requireLive) {
  assert(lease && typeof lease.lease_id === 'string' && lease.lease_id.startsWith('urn:uu-aap:kontur:lease:'),
    'KONTUR Responsibility Kernel: valid lease ID required');
  assert(lease.holder_id === holderId, 'KONTUR Responsibility Kernel: lease holder mismatch');
  assert(lease.server_instance_id === serverInstanceId, 'KONTUR Responsibility Kernel: lease server mismatch');
  const issuedMs = parseTime(lease.issued_at, 'lease issued_at');
  const expiresMs = parseTime(lease.expires_at, 'lease expires_at');
  assert(issuedMs < expiresMs, 'KONTUR Responsibility Kernel: lease interval invalid');
  assert(issuedMs <= evaluatedMs, 'KONTUR Responsibility Kernel: lease not yet issued');
  if (requireLive) assert(evaluatedMs < expiresMs, 'KONTUR Responsibility Kernel: expired lease cannot maintain active responsibility');
  return { issuedMs, expiresMs };
}

function validateReadiness(signal, policy, evaluatedMs, minimumEpoch) {
  assert(signal && signal.artifact_type === 'KONTURReadinessSignal' && signal.artifact_version === '0.1',
    'KONTUR Responsibility Kernel: KONTURReadinessSignal v0.1 required');
  assert(signal.system_id === policy.system_id, 'KONTUR Responsibility Kernel: readiness system identity mismatch');
  assert(signal.server_instance_id === policy.server_instance_id, 'KONTUR Responsibility Kernel: readiness server identity mismatch');
  assert(Number.isInteger(signal.readiness_epoch) && signal.readiness_epoch >= minimumEpoch,
    'KONTUR Responsibility Kernel: stale readiness epoch');
  const emittedMs = parseTime(signal.emitted_at, 'readiness emitted_at');
  const validUntilMs = parseTime(signal.valid_until, 'readiness valid_until');
  assert(emittedMs < validUntilMs, 'KONTUR Responsibility Kernel: readiness validity interval invalid');
  assert(emittedMs <= evaluatedMs && evaluatedMs < validUntilMs,
    'KONTUR Responsibility Kernel: readiness signal expired or not yet valid');
  assert(signal.ready === true, 'KONTUR Responsibility Kernel: readiness signal is not ready');
  assert(Array.isArray(signal.checks) && signal.checks.length > 0,
    'KONTUR Responsibility Kernel: readiness checks required');
  const checkIds = signal.checks.map((c) => c.check_id);
  assert(new Set(checkIds).size === checkIds.length, 'KONTUR Responsibility Kernel: duplicate readiness checks');
  for (const check of signal.checks) {
    assert(check.status === 'pass', `KONTUR Responsibility Kernel: readiness check failed: ${check.check_id}`);
    assert(typeof check.evidence_ref === 'string' && check.evidence_ref.length > 0,
      'KONTUR Responsibility Kernel: readiness evidence ref required');
    assert(parseTime(check.observed_at, 'readiness check observed_at') <= emittedMs,
      'KONTUR Responsibility Kernel: readiness check observed after signal emission');
  }
  for (const required of policy.required_readiness_checks) {
    assert(checkIds.includes(required), `KONTUR Responsibility Kernel: missing readiness check ${required}`);
  }
  assert(signal.claims && signal.claims.readiness_observed === true &&
    signal.claims.execution_authority_granted === false && signal.claims.responsibility_accepted === false &&
    signal.claims.kernel_activated === false,
    'KONTUR Responsibility Kernel: readiness assurance boundary invalid');
  assert(signal.claims.legal_responsibility_determined === false && signal.claims.moral_blame_assigned === false &&
    signal.claims.truth_certified === false && signal.claims.poai_materialization_event_recorded === false &&
    signal.claims.universal_canonicality_established === false,
    'KONTUR Responsibility Kernel: readiness overclaim');
}

function validateScopes(scopes, policy) {
  const normalized = uniq(scopes);
  assert(normalized.length > 0, 'KONTUR Responsibility Kernel: non-empty responsibility scope required');
  for (const scope of normalized) assert(policy.responsibility_scope_allowlist.includes(scope),
    `KONTUR Responsibility Kernel: responsibility scope not allowed: ${scope}`);
  return normalized;
}

function assertPredecessorBoundary(state, policy) {
  assert(state && state.artifact_type === 'KONTURResponsibilityState' && state.artifact_version === '0.1',
    'KONTUR Responsibility Kernel: valid predecessor state required');
  assert(state.system_id === policy.system_id && state.server_instance_id === policy.server_instance_id,
    'KONTUR Responsibility Kernel: predecessor identity drift');
  assert(state.lifecycle_state !== 'retired', 'KONTUR Responsibility Kernel: retired state is terminal');
  assert(state.claims.kernel_responsibility_state_established === true &&
    state.claims.execution_authority_granted === false,
    'KONTUR Responsibility Kernel: predecessor assurance boundary invalid');
  assertFalseClaims(state.claims, REQUIRED_FALSE_CLAIMS, 'KONTURResponsibilityState');
}

function assertSameResponsibility(predecessor, holderId, scopes) {
  assert(holderId === predecessor.holder_id,
    'KONTUR Responsibility Kernel: holder substitution requires a typed handoff transition');
  assert(sameArray(uniq(scopes), uniq(predecessor.responsibility_scopes)),
    'KONTUR Responsibility Kernel: responsibility scope substitution requires a typed successor protocol');
}

async function transitionResponsibility({
  policy,
  readinessSignal = null,
  predecessorState = null,
  transitionKind,
  evaluatedAt,
  holderId,
  responsibilityScopes,
  fencingEpoch,
  lease,
  health,
  triggerRef,
  parallelActiveHolders = []
}) {
  assertPolicy(policy);
  assert(TRANSITIONS.has(transitionKind), 'KONTUR Responsibility Kernel: unsupported transition');
  assert(!hasScalarKey({ policy, readinessSignal, predecessorState, holderId, responsibilityScopes, fencingEpoch, lease, health }),
    'KONTUR Responsibility Kernel: scalar responsibility/probability scores are prohibited in v0.1');
  const evaluatedMs = parseTime(evaluatedAt, 'evaluated_at');
  assert(typeof holderId === 'string' && holderId.startsWith('urn:uu-aap:kontur:holder:'),
    'KONTUR Responsibility Kernel: valid holder ID required');
  const scopes = validateScopes(responsibilityScopes, policy);
  assert(Number.isInteger(fencingEpoch) && fencingEpoch >= 1,
    'KONTUR Responsibility Kernel: valid fencing epoch required');
  assert(typeof triggerRef === 'string' && triggerRef.length > 0,
    'KONTUR Responsibility Kernel: transition trigger ref required');
  assert(Array.isArray(parallelActiveHolders) && parallelActiveHolders.length === 0,
    'KONTUR Responsibility Kernel: parallel active holder detected');
  validateHealth(health, evaluatedMs);

  let generation;
  let lifecycleState;
  let predecessorBinding = null;
  let readinessBinding;
  let leaseLiveRequired = false;

  if (transitionKind === 'activate') {
    assert(predecessorState === null, 'KONTUR Responsibility Kernel: activation must be genesis without predecessor state');
    validateReadiness(readinessSignal, policy, evaluatedMs, 1);
    assert(fencingEpoch === readinessSignal.readiness_epoch,
      'KONTUR Responsibility Kernel: activation fencing epoch must equal readiness epoch');
    assert(health.status === 'healthy', 'KONTUR Responsibility Kernel: activation requires healthy server state');
    generation = 1;
    lifecycleState = 'active';
    leaseLiveRequired = true;
    readinessBinding = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
  } else {
    assertPredecessorBoundary(predecessorState, policy);
    assertSameResponsibility(predecessorState, holderId, scopes);
    generation = predecessorState.generation + policy.invariants.successor_generation_increment;
    predecessorBinding = await binding('KONTURResponsibilityState', predecessorState.state_id, predecessorState);
    readinessBinding = clone(predecessorState.readiness_binding);

    if (transitionKind === 'heartbeat') {
      assert(predecessorState.lifecycle_state === 'active', 'KONTUR Responsibility Kernel: heartbeat requires active predecessor');
      assert(readinessSignal === null, 'KONTUR Responsibility Kernel: heartbeat cannot silently replace readiness evidence');
      assert(fencingEpoch === predecessorState.fencing_epoch, 'KONTUR Responsibility Kernel: heartbeat fencing epoch drift');
      assert(health.status === 'healthy', 'KONTUR Responsibility Kernel: heartbeat cannot preserve active state with unhealthy server');
      lifecycleState = 'active';
      leaseLiveRequired = true;
    }

    if (transitionKind === 'degrade') {
      assert(predecessorState.lifecycle_state === 'active', 'KONTUR Responsibility Kernel: degrade requires active predecessor');
      assert(readinessSignal === null, 'KONTUR Responsibility Kernel: degrade cannot replace readiness evidence');
      assert(fencingEpoch === predecessorState.fencing_epoch, 'KONTUR Responsibility Kernel: degrade fencing epoch drift');
      assert(health.status === 'degraded', 'KONTUR Responsibility Kernel: degraded transition requires degraded health');
      lifecycleState = 'degraded';
      leaseLiveRequired = true;
    }

    if (transitionKind === 'suspend') {
      assert(['active', 'degraded'].includes(predecessorState.lifecycle_state),
        'KONTUR Responsibility Kernel: suspend requires active or degraded predecessor');
      assert(readinessSignal === null, 'KONTUR Responsibility Kernel: suspend cannot replace readiness evidence');
      assert(fencingEpoch === predecessorState.fencing_epoch, 'KONTUR Responsibility Kernel: suspend fencing epoch drift');
      const leaseTimes = validateLease(lease, evaluatedMs, holderId, policy.server_instance_id, false);
      const expired = evaluatedMs >= leaseTimes.expiresMs;
      const critical = health.status === 'critical';
      const explicit = triggerRef.startsWith('urn:uu-aap:kontur:suspension:');
      assert(expired || critical || explicit,
        'KONTUR Responsibility Kernel: suspension requires expired lease, critical health, or explicit suspension trigger');
      lifecycleState = 'suspended';
    }

    if (transitionKind === 'resume') {
      assert(['degraded', 'suspended'].includes(predecessorState.lifecycle_state),
        'KONTUR Responsibility Kernel: resume requires degraded or suspended predecessor');
      validateReadiness(readinessSignal, policy, evaluatedMs, predecessorState.fencing_epoch + 1);
      assert(fencingEpoch === readinessSignal.readiness_epoch && fencingEpoch > predecessorState.fencing_epoch,
        'KONTUR Responsibility Kernel: resume requires fresh monotonic readiness/fencing epoch');
      assert(health.status === 'healthy', 'KONTUR Responsibility Kernel: resume requires healthy server state');
      lifecycleState = 'active';
      leaseLiveRequired = true;
      readinessBinding = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
    }

    if (transitionKind === 'retire') {
      assert(['active', 'degraded', 'suspended'].includes(predecessorState.lifecycle_state),
        'KONTUR Responsibility Kernel: retire predecessor invalid');
      assert(readinessSignal === null, 'KONTUR Responsibility Kernel: retire cannot replace readiness evidence');
      assert(fencingEpoch === predecessorState.fencing_epoch, 'KONTUR Responsibility Kernel: retire fencing epoch drift');
      lifecycleState = 'retired';
    }
  }

  assert(lifecycleState, 'KONTUR Responsibility Kernel: transition did not resolve a lifecycle state');
  if (transitionKind !== 'suspend') validateLease(lease, evaluatedMs, holderId, policy.server_instance_id, leaseLiveRequired);
  const policyBinding = await binding('KONTURResponsibilityPolicy', policy.policy_id, policy);
  const stateSeed = `${policyBinding.digest.value}|${readinessBinding.digest.value}|${predecessorBinding ? predecessorBinding.digest.value : 'genesis'}|${generation}|${lifecycleState}|${holderId}|${scopes.join(',')}|${fencingEpoch}|${lease.lease_id}|${evaluatedAt}`;
  const stateHash = await Binding.sha256Hex(Binding.utf8Bytes(stateSeed));
  const resultingState = {
    $schema: './kontur-responsibility-artifacts.schema.json#/$defs/state',
    artifact_type: 'KONTURResponsibilityState',
    artifact_version: '0.1',
    state_id: `urn:uu-aap:kontur:responsibility-state:${stateHash.slice(0, 24)}`,
    generation,
    lifecycle_state: lifecycleState,
    system_id: policy.system_id,
    server_instance_id: policy.server_instance_id,
    holder_id: holderId,
    responsibility_scopes: scopes,
    fencing_epoch: fencingEpoch,
    lease: clone(lease),
    policy_binding: policyBinding,
    readiness_binding: readinessBinding,
    predecessor_state_binding: predecessorBinding,
    health: clone(health),
    last_transition: { kind: transitionKind, at: evaluatedAt, trigger_ref: triggerRef },
    claims: {
      kernel_responsibility_state_established: true,
      structural_responsibility_holder_bound: true,
      responsibility_scope_bound: true,
      lease_and_fencing_frontier_established: true,
      execution_authority_granted: false,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      universal_causality_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  const resultingStateBinding = await binding('KONTURResponsibilityState', resultingState.state_id, resultingState);
  const receiptSeed = `${resultingStateBinding.digest.value}|${policyBinding.digest.value}|${readinessBinding.digest.value}|${transitionKind}|${evaluatedAt}`;
  const receiptHash = await Binding.sha256Hex(Binding.utf8Bytes(receiptSeed));
  const receipt = {
    $schema: './kontur-responsibility-artifacts.schema.json',
    artifact_type: 'KONTURResponsibilityTransitionReceipt',
    artifact_version: '0.1',
    receipt_id: `urn:uu-aap:kontur:responsibility-transition:${receiptHash.slice(0, 24)}`,
    evaluated_at: evaluatedAt,
    transition_kind: transitionKind,
    predecessor_state_binding: predecessorBinding,
    policy_binding: policyBinding,
    readiness_binding: readinessBinding,
    resulting_state_binding: resultingStateBinding,
    resulting_state: resultingState,
    verification: {
      policy_exact: true,
      readiness_exact: true,
      identity_exact: true,
      generation_monotonic: true,
      fencing_monotonic: true,
      lease_checked: true,
      health_transition_checked: true,
      single_active_holder_checked: true,
      predecessor_exact: true,
      fail_closed_boundary_preserved: true
    },
    claims: {
      server_responsibility_transition_recorded: true,
      persistent_responsibility_state_derived: true,
      readiness_trigger_consumed_under_policy: true,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      universal_causality_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  await validateResponsibilityTransitionReceipt({ receipt, policy, readinessSignal, predecessorState });
  return receipt;
}

async function validateResponsibilityTransitionReceipt({ receipt, policy, readinessSignal = null, predecessorState = null }) {
  assertPolicy(policy);
  assert(receipt && receipt.artifact_type === 'KONTURResponsibilityTransitionReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Responsibility Kernel: invalid transition receipt');
  assert(!hasScalarKey(receipt), 'KONTUR Responsibility Kernel: scalar responsibility/probability scores are prohibited in v0.1');
  assertFalseClaims(receipt.claims, REQUIRED_FALSE_CLAIMS, 'KONTURResponsibilityTransitionReceipt');
  const expectedPolicy = await binding('KONTURResponsibilityPolicy', policy.policy_id, policy);
  assert(sameBinding(receipt.policy_binding, expectedPolicy), 'KONTUR Responsibility Kernel: policy binding substitution');

  const state = receipt.resulting_state;
  assert(state && state.artifact_type === 'KONTURResponsibilityState' && state.artifact_version === '0.1',
    'KONTUR Responsibility Kernel: resulting responsibility state missing');
  assertFalseClaims(state.claims, REQUIRED_FALSE_CLAIMS, 'KONTURResponsibilityState');
  assert(state.claims.execution_authority_granted === false,
    'KONTUR Responsibility Kernel: responsibility state cannot grant execution authority');
  assert(state.system_id === policy.system_id && state.server_instance_id === policy.server_instance_id,
    'KONTUR Responsibility Kernel: resulting state identity drift');
  assert(sameBinding(state.policy_binding, expectedPolicy), 'KONTUR Responsibility Kernel: state policy binding substitution');
  assert(state.last_transition.kind === receipt.transition_kind && state.last_transition.at === receipt.evaluated_at,
    'KONTUR Responsibility Kernel: transition metadata mismatch');
  const stateBinding = await binding('KONTURResponsibilityState', state.state_id, state);
  assert(sameBinding(receipt.resulting_state_binding, stateBinding),
    'KONTUR Responsibility Kernel: resulting state binding substitution');

  if (receipt.transition_kind === 'activate') {
    assert(predecessorState === null && receipt.predecessor_state_binding === null && state.predecessor_state_binding === null,
      'KONTUR Responsibility Kernel: activation predecessor substitution');
    assert(state.generation === 1, 'KONTUR Responsibility Kernel: activation generation must be 1');
    assert(state.lifecycle_state === 'active', 'KONTUR Responsibility Kernel: activation must result in active state');
    assert(readinessSignal, 'KONTUR Responsibility Kernel: activation readiness signal required for validation');
    const expectedReadiness = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
    assert(sameBinding(receipt.readiness_binding, expectedReadiness) && sameBinding(state.readiness_binding, expectedReadiness),
      'KONTUR Responsibility Kernel: activation readiness binding substitution');
  } else {
    assert(predecessorState, 'KONTUR Responsibility Kernel: non-genesis transition requires predecessor state');
    const expectedPredecessor = await binding('KONTURResponsibilityState', predecessorState.state_id, predecessorState);
    assert(sameBinding(receipt.predecessor_state_binding, expectedPredecessor) &&
      sameBinding(state.predecessor_state_binding, expectedPredecessor),
      'KONTUR Responsibility Kernel: predecessor state binding substitution');
    assert(state.generation === predecessorState.generation + 1,
      'KONTUR Responsibility Kernel: successor generation must increment by one');
    assert(state.holder_id === predecessorState.holder_id,
      'KONTUR Responsibility Kernel: holder substitution detected');
    assert(sameArray(uniq(state.responsibility_scopes), uniq(predecessorState.responsibility_scopes)),
      'KONTUR Responsibility Kernel: responsibility scope substitution detected');
    assert(state.fencing_epoch >= predecessorState.fencing_epoch,
      'KONTUR Responsibility Kernel: fencing epoch regression');

    if (receipt.transition_kind === 'resume') {
      assert(readinessSignal, 'KONTUR Responsibility Kernel: resume readiness signal required for validation');
      const expectedReadiness = await binding('KONTURReadinessSignal', readinessSignal.signal_id, readinessSignal);
      assert(sameBinding(receipt.readiness_binding, expectedReadiness) && sameBinding(state.readiness_binding, expectedReadiness),
        'KONTUR Responsibility Kernel: resume readiness binding substitution');
      assert(state.fencing_epoch > predecessorState.fencing_epoch,
        'KONTUR Responsibility Kernel: resume requires strictly newer fencing epoch');
    } else {
      assert(readinessSignal === null,
        'KONTUR Responsibility Kernel: non-recovery transition cannot silently consume fresh readiness evidence');
      assert(sameBinding(receipt.readiness_binding, predecessorState.readiness_binding) &&
        sameBinding(state.readiness_binding, predecessorState.readiness_binding),
        'KONTUR Responsibility Kernel: readiness frontier changed without recovery transition');
      assert(state.fencing_epoch === predecessorState.fencing_epoch,
        'KONTUR Responsibility Kernel: fencing epoch changed without fresh readiness');
    }
  }

  const evaluatedMs = parseTime(receipt.evaluated_at, 'receipt evaluated_at');
  validateHealth(state.health, evaluatedMs);
  const leaseTimes = validateLease(state.lease, evaluatedMs, state.holder_id, state.server_instance_id,
    ['active', 'degraded'].includes(state.lifecycle_state));
  if (state.lifecycle_state === 'active') assert(state.health.status === 'healthy',
    'KONTUR Responsibility Kernel: active state requires healthy server');
  if (state.lifecycle_state === 'degraded') assert(state.health.status === 'degraded',
    'KONTUR Responsibility Kernel: degraded state requires degraded health');
  if (receipt.transition_kind === 'suspend') {
    const expired = evaluatedMs >= leaseTimes.expiresMs;
    const critical = state.health.status === 'critical';
    const explicit = state.last_transition.trigger_ref.startsWith('urn:uu-aap:kontur:suspension:');
    assert(state.lifecycle_state === 'suspended' && (expired || critical || explicit),
      'KONTUR Responsibility Kernel: invalid suspension result');
  }
  if (receipt.transition_kind === 'retire') assert(state.lifecycle_state === 'retired',
    'KONTUR Responsibility Kernel: retirement must produce terminal retired state');
  return true;
}

module.exports = {
  digestJson,
  transitionResponsibility,
  validateResponsibilityTransitionReceipt
};
