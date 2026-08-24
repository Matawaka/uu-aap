'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Preflight = require('./activation-preflight.js');
const Kernel = require('./responsibility-kernel.js');
const Ledger = require('./responsibility-ledger.js');

const FALSE_CLAIMS = [
  'execution_authority_granted', 'legal_responsibility_determined', 'legal_effect_established',
  'moral_blame_assigned', 'truth_certified', 'distributed_consensus_established',
  'poai_materialization_event_recorded', 'universal_canonicality_established'
];
const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'likelihood', 'confidence_score',
  'readiness_score', 'responsibility_score', 'causal_score', 'rating', 'weight'
]);

function assert(v, m) { if (!v) throw new Error(m); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function parseTime(v, label) {
  const ms = Date.parse(v);
  assert(Number.isFinite(ms), `KONTUR Activation Executor: invalid ${label}`);
  return ms;
}
function sameArray(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
}
function hasScalarKey(v) {
  if (!v || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some(hasScalarKey);
  return Object.entries(v).some(([k, child]) => SCALAR_KEYS.has(k) || hasScalarKey(child));
}
async function digestJson(v) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(v, '$')));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
async function policyBinding(policy) {
  return {
    artifact_type: policy.artifact_type,
    artifact_ref: policy.policy_id,
    policy_version: policy.policy_version,
    digest: digest(await digestJson(policy))
  };
}
function sameBinding(a, b) {
  return !!a && !!b && a.artifact_type === b.artifact_type && a.artifact_ref === b.artifact_ref &&
    a.digest && b.digest && a.digest.value === b.digest.value;
}
function samePolicyBinding(a, b) { return sameBinding(a, b) && a.policy_version === b.policy_version; }
function assertFalseClaims(claims, label) {
  for (const key of FALSE_CLAIMS) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function isWithin(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
function nearestExistingAncestor(value) {
  let current = path.resolve(value);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    assert(parent !== current, 'KONTUR Activation Executor: test_only ledger root has no existing ancestor');
    current = parent;
  }
  return current;
}
function assertTestOnlyLedgerRoot(ledgerRoot) {
  assert(typeof ledgerRoot === 'string' && ledgerRoot.length > 0,
    'KONTUR Activation Executor: test_only ledger root required');
  const tempRoot = fs.realpathSync(os.tmpdir());
  const existingAncestor = fs.realpathSync(nearestExistingAncestor(ledgerRoot));
  assert(isWithin(tempRoot, existingAncestor),
    'KONTUR Activation Executor: test_only ledger root must remain under the OS temporary root');
}

function assertExecutionPolicy(policy, evaluatedMs = null) {
  assert(policy && policy.artifact_type === 'KONTURActivationExecutionPolicy' && policy.artifact_version === '0.1',
    'KONTUR Activation Executor: KONTURActivationExecutionPolicy v0.1 required');
  assert(typeof policy.policy_id === 'string' && policy.policy_id.startsWith('urn:uu-aap:kontur:activation-execution-policy:'),
    'KONTUR Activation Executor: invalid execution policy ID');
  assert(Number.isInteger(policy.policy_version) && policy.policy_version >= 1,
    'KONTUR Activation Executor: invalid execution policy version');
  assert(Number.isInteger(policy.max_execute_command_age_seconds) && policy.max_execute_command_age_seconds > 0 && policy.max_execute_command_age_seconds <= 60,
    'KONTUR Activation Executor: invalid execute command freshness');
  assert(Number.isInteger(policy.max_preflight_age_seconds) && policy.max_preflight_age_seconds > 0 && policy.max_preflight_age_seconds <= 60,
    'KONTUR Activation Executor: invalid preflight freshness');
  const req = policy.requirements || {};
  for (const key of [
    'exact_git_revision', 'exact_intent_binding', 'exact_preflight_binding', 'fresh_preflight',
    'fresh_readiness', 'fresh_health', 'live_lease', 'empty_genesis_ledger', 'one_shot_execute_nonce',
    'execute_nonce_distinct_from_intent_nonce', 'kernel_activate_exactly_once', 'durable_genesis_commit',
    'post_commit_recovery', 'recovered_head_exact', 'test_only_ledger_root_ephemeral'
  ]) assert(req[key] === true, `KONTUR Activation Executor: execution policy requirement weakened: ${key}`);
  assert(req.automatic_retry_allowed === false && req.auto_activation_allowed === false,
    'KONTUR Activation Executor: automatic retry/activation must remain prohibited');
  assert(policy.claims && policy.claims.activation_execution_policy_defined === true,
    'KONTUR Activation Executor: execution policy declaration missing');
  assertFalseClaims(policy.claims, 'KONTURActivationExecutionPolicy');
  const start = parseTime(policy.effective_from, 'execution policy effective_from');
  const end = policy.effective_until === null ? null : parseTime(policy.effective_until, 'execution policy effective_until');
  if (end !== null) assert(start < end, 'KONTUR Activation Executor: invalid execution policy interval');
  if (evaluatedMs !== null) assert(start <= evaluatedMs && (end === null || evaluatedMs < end),
    'KONTUR Activation Executor: execution policy not effective');
}

async function buildExecuteCommand({ currentGitRevision, intent, preflight, executionPolicy, declaredAt, actorRef, executeNonce, executionMode }) {
  const declaredMs = parseTime(declaredAt, 'execute command declared_at');
  assertExecutionPolicy(executionPolicy, declaredMs);
  assert(/^git:[0-9a-f]{40}$/.test(currentGitRevision || ''), 'KONTUR Activation Executor: exact Git revision required');
  assert(intent && intent.artifact_type === 'KONTURActivationIntent', 'KONTUR Activation Executor: activation intent required');
  assert(preflight && preflight.artifact_type === 'KONTURActivationPreflightReceipt' && preflight.decision === 'human_execute_step_may_proceed',
    'KONTUR Activation Executor: positive activation preflight required');
  assert(currentGitRevision === intent.git_revision && currentGitRevision === preflight.current_git_revision,
    'KONTUR Activation Executor: Git revision drift before final command');
  assert(intent.system_id === executionPolicy.system_id && intent.server_instance_id === executionPolicy.server_instance_id &&
    preflight.system_id === executionPolicy.system_id && preflight.server_instance_id === executionPolicy.server_instance_id,
    'KONTUR Activation Executor: system/server identity drift');
  assert(intent.holder_id === preflight.holder_id && sameArray(intent.responsibility_scopes, preflight.responsibility_scopes) &&
    intent.fencing_epoch === preflight.fencing_epoch && JSON.stringify(intent.lease) === JSON.stringify(preflight.lease),
    'KONTUR Activation Executor: intent/preflight execution parameters drift');
  assert(typeof actorRef === 'string' && actorRef.length > 0, 'KONTUR Activation Executor: final human actor reference required');
  assert(typeof executeNonce === 'string' && executeNonce.startsWith('urn:uu-aap:kontur:activation-intent-nonce:execute:'),
    'KONTUR Activation Executor: one-shot execute nonce required');
  assert(executeNonce !== intent.human_intent.nonce,
    'KONTUR Activation Executor: execute nonce must differ from activation intent nonce');
  assert(['test_only', 'live'].includes(executionMode), 'KONTUR Activation Executor: invalid execution mode');
  assert(!hasScalarKey({ intent, preflight, executionPolicy }), 'KONTUR Activation Executor: scalar score/probability fields prohibited');

  const intentBinding = await binding('KONTURActivationIntent', intent.intent_id, intent);
  const preflightBinding = await binding('KONTURActivationPreflightReceipt', preflight.preflight_id, preflight);
  const executionPolicyBinding = await policyBinding(executionPolicy);
  const validUntil = new Date(declaredMs + executionPolicy.max_execute_command_age_seconds * 1000).toISOString();
  const seed = `${currentGitRevision}|${intentBinding.digest.value}|${preflightBinding.digest.value}|${executionPolicyBinding.digest.value}|${executeNonce}|${declaredAt}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  return {
    $schema: './kontur-activation-execute-command.schema.json',
    artifact_type: 'KONTURActivationExecuteCommand', artifact_version: '0.1',
    command_id: `urn:uu-aap:kontur:activation-execute-command:${idHash.slice(0, 24)}`,
    command: 'execute_kontur_activation', execution_mode: executionMode,
    declared_at: declaredAt, valid_until: validUntil, git_revision: currentGitRevision,
    system_id: executionPolicy.system_id, server_instance_id: executionPolicy.server_instance_id,
    activation_intent_binding: intentBinding, activation_preflight_binding: preflightBinding,
    execution_policy_binding: executionPolicyBinding,
    holder_id: intent.holder_id, responsibility_scopes: clone(intent.responsibility_scopes),
    fencing_epoch: intent.fencing_epoch, lease: clone(intent.lease),
    human_execute: {
      actor_ref: actorRef, declaration_type: 'explicit_final_human_execute', nonce: executeNonce,
      explicit: true, identity_assurance: 'declared_not_cryptographically_verified'
    },
    claims: {
      final_human_execute_declared: true, exact_execute_parameters_bound: true,
      human_identity_cryptographically_verified: false, kernel_activated: false,
      responsibility_state_created: false, local_kontur_activation_completed: false,
      execution_authority_granted: false, legal_responsibility_determined: false,
      legal_effect_established: false, moral_blame_assigned: false, truth_certified: false,
      distributed_consensus_established: false, poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
}

async function validateExecuteCommand({ command, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt }) {
  const evaluatedMs = parseTime(evaluatedAt, 'execute command evaluated_at');
  assertExecutionPolicy(executionPolicy, evaluatedMs);
  assert(command && command.artifact_type === 'KONTURActivationExecuteCommand' && command.artifact_version === '0.1',
    'KONTUR Activation Executor: invalid execute command');
  assert(command.command === 'execute_kontur_activation', 'KONTUR Activation Executor: execute command substitution');
  assert(['test_only', 'live'].includes(command.execution_mode), 'KONTUR Activation Executor: invalid execution mode');
  assert(!hasScalarKey(command), 'KONTUR Activation Executor: scalar fields prohibited in execute command');
  assertFalseClaims(command.claims, 'KONTURActivationExecuteCommand');
  assert(command.claims.final_human_execute_declared === true && command.claims.exact_execute_parameters_bound === true &&
    command.claims.kernel_activated === false && command.claims.local_kontur_activation_completed === false,
    'KONTUR Activation Executor: execute command assurance boundary invalid');
  assert(command.git_revision === currentGitRevision && currentGitRevision === intent.git_revision && currentGitRevision === preflight.current_git_revision,
    'KONTUR Activation Executor: execute command Git revision drift');
  assert(command.system_id === executionPolicy.system_id && command.server_instance_id === executionPolicy.server_instance_id,
    'KONTUR Activation Executor: execute command identity drift');
  assert(command.holder_id === intent.holder_id && command.holder_id === preflight.holder_id &&
    sameArray(command.responsibility_scopes, intent.responsibility_scopes) && sameArray(command.responsibility_scopes, preflight.responsibility_scopes) &&
    command.fencing_epoch === intent.fencing_epoch && command.fencing_epoch === preflight.fencing_epoch &&
    JSON.stringify(command.lease) === JSON.stringify(intent.lease) && JSON.stringify(command.lease) === JSON.stringify(preflight.lease),
    'KONTUR Activation Executor: execute command parameter substitution');
  assert(command.human_execute && command.human_execute.explicit === true && command.human_execute.declaration_type === 'explicit_final_human_execute',
    'KONTUR Activation Executor: explicit final human execute missing');
  assert(typeof command.human_execute.nonce === 'string' && command.human_execute.nonce.startsWith('urn:uu-aap:kontur:activation-intent-nonce:execute:'),
    'KONTUR Activation Executor: invalid execute nonce');
  assert(command.human_execute.nonce !== intent.human_intent.nonce,
    'KONTUR Activation Executor: execute nonce must differ from activation intent nonce');
  const declaredMs = parseTime(command.declared_at, 'execute command declared_at');
  const validUntilMs = parseTime(command.valid_until, 'execute command valid_until');
  assert(declaredMs <= evaluatedMs && evaluatedMs < validUntilMs,
    'KONTUR Activation Executor: execute command expired or future-dated');
  assert(validUntilMs - declaredMs === executionPolicy.max_execute_command_age_seconds * 1000,
    'KONTUR Activation Executor: execute command validity interval drift');
  assert(sameBinding(command.activation_intent_binding, await binding('KONTURActivationIntent', intent.intent_id, intent)),
    'KONTUR Activation Executor: execute command intent binding substitution');
  assert(sameBinding(command.activation_preflight_binding, await binding('KONTURActivationPreflightReceipt', preflight.preflight_id, preflight)),
    'KONTUR Activation Executor: execute command preflight binding substitution');
  assert(samePolicyBinding(command.execution_policy_binding, await policyBinding(executionPolicy)),
    'KONTUR Activation Executor: execute command execution-policy binding substitution');
  return true;
}

function assertFreshExecutionFrontier({ executedMs, intent, preflight, readinessSignal, health, activationPolicy, executionPolicy, lease }) {
  const preflightMs = parseTime(preflight.evaluated_at, 'preflight evaluated_at');
  assert(preflightMs <= executedMs && executedMs - preflightMs <= executionPolicy.max_preflight_age_seconds * 1000,
    'KONTUR Activation Executor: preflight stale or future-dated');
  const intentMs = parseTime(intent.declared_at, 'intent declared_at');
  assert(intentMs <= executedMs && executedMs - intentMs <= activationPolicy.max_intent_age_seconds * 1000,
    'KONTUR Activation Executor: activation intent stale or future-dated');
  const healthMs = parseTime(health.observed_at, 'health observed_at');
  assert(healthMs <= executedMs && executedMs - healthMs <= activationPolicy.max_health_age_seconds * 1000,
    'KONTUR Activation Executor: health stale or future-dated');
  const readinessEmitted = parseTime(readinessSignal.emitted_at, 'readiness emitted_at');
  const readinessUntil = parseTime(readinessSignal.valid_until, 'readiness valid_until');
  assert(readinessEmitted <= executedMs && executedMs < readinessUntil && readinessSignal.ready === true,
    'KONTUR Activation Executor: readiness stale, future-dated, or not ready');
  assert(Array.isArray(readinessSignal.checks) && readinessSignal.checks.every((item) => item.status === 'pass'),
    'KONTUR Activation Executor: readiness check failed');
  const issued = parseTime(lease.issued_at, 'lease issued_at');
  const expires = parseTime(lease.expires_at, 'lease expires_at');
  assert(issued <= executedMs && executedMs < expires, 'KONTUR Activation Executor: lease expired or future-dated');
}

async function augmentGenesisEntryWithExecuteCommand(entry, command) {
  const out = clone(entry);
  out.activation_execute_command = clone(command);
  out.activation_execute_command_binding = await binding('KONTURActivationExecuteCommand', command.command_id, command);
  out.entry_digest = await Ledger.expectedEntryDigest(out);
  return out;
}

async function validateExecutionReceipt({ receipt, command, preflight, transitionReceipt, ledgerEntry, recovered }) {
  assert(receipt && receipt.artifact_type === 'KONTURActivationExecutionReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Activation Executor: invalid execution receipt');
  assert(!hasScalarKey(receipt), 'KONTUR Activation Executor: scalar fields prohibited in execution receipt');
  assertFalseClaims(receipt.claims, 'KONTURActivationExecutionReceipt');
  for (const key of [
    'final_human_execute_command_verified', 'kernel_activation_transition_produced',
    'genesis_ledger_entry_durably_committed', 'authoritative_active_head_recovered',
    'structural_responsibility_state_established', 'local_kontur_activation_completed'
  ]) assert(receipt.claims[key] === true, `KONTUR Activation Executor: missing positive execution claim ${key}`);
  assert(receipt.claims.live_kontur_activated === (command.execution_mode === 'live'),
    'KONTUR Activation Executor: live activation claim/mode mismatch');
  assert(receipt.status === (command.execution_mode === 'live' ? 'activation_completed_live' : 'activation_completed_test_only'),
    'KONTUR Activation Executor: execution status/mode mismatch');
  const state = recovered && recovered.authoritative_state;
  assert(recovered && recovered.head_entry && state, 'KONTUR Activation Executor: recovered authoritative head missing');
  assert(recovered.entries.length === 1 && recovered.head_entry.sequence === 1 && state.generation === 1 && state.lifecycle_state === 'active',
    'KONTUR Activation Executor: recovered genesis state invalid');
  assert(sameBinding(receipt.execute_command_binding, await binding('KONTURActivationExecuteCommand', command.command_id, command)),
    'KONTUR Activation Executor: receipt command binding substitution');
  assert(sameBinding(receipt.activation_preflight_binding, await binding('KONTURActivationPreflightReceipt', preflight.preflight_id, preflight)),
    'KONTUR Activation Executor: receipt preflight binding substitution');
  assert(sameBinding(receipt.transition_receipt_binding, await binding('KONTURResponsibilityTransitionReceipt', transitionReceipt.receipt_id, transitionReceipt)),
    'KONTUR Activation Executor: receipt transition binding substitution');
  assert(sameBinding(receipt.ledger_entry_binding, await Ledger.entryBinding(ledgerEntry)),
    'KONTUR Activation Executor: receipt ledger binding substitution');
  assert(sameBinding(receipt.recovered_head_binding, await binding('KONTURResponsibilityState', state.state_id, state)),
    'KONTUR Activation Executor: receipt recovered-head binding substitution');
  assert(receipt.holder_id === state.holder_id && sameArray(receipt.responsibility_scopes, state.responsibility_scopes) &&
    receipt.fencing_epoch === state.fencing_epoch,
    'KONTUR Activation Executor: receipt recovered responsibility frontier drift');
  return true;
}

async function executeActivation(args) {
  const {
    command, currentGitRevision, intent, preflight, frontier, readinessSignal,
    aggregationPolicy, responsibilityPolicy, activationPolicy, health, executionPolicy,
    ledgerPolicy, ledgerRoot, executedAt, parallelActiveHolders = [],
    kernelTransition = Kernel.transitionResponsibility,
    buildLedgerEntry = Ledger.buildLedgerEntry,
    commitLedgerEntry = Ledger.commitLedgerEntry,
    initialRecoverLedger = Ledger.recoverLedger,
    postCommitRecoverLedger = Ledger.recoverLedger
  } = args;

  if (command && command.execution_mode === 'live') {
    const PublicExecutor = require('./activation-executor.js');
    assert(PublicExecutor && typeof PublicExecutor.validateExecuteCommand === 'function',
      'KONTUR Activation Executor: public live-host gate unavailable');
    await PublicExecutor.validateExecuteCommand({
      command, currentGitRevision, intent, preflight, executionPolicy,
      evaluatedAt: executedAt,
      liveHostProfile: args.liveHostProfile,
      liveHostEligibilityReceipt: args.liveHostEligibilityReceipt,
      ledgerRoot
    });
  } else if (command && command.execution_mode === 'test_only') {
    assertTestOnlyLedgerRoot(ledgerRoot);
  }

  const executedMs = parseTime(executedAt, 'executed_at');
  assertExecutionPolicy(executionPolicy, executedMs);
  await Preflight.validateActivationIntent({ intent, currentGitRevision, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy, activationPolicy, health });
  await Preflight.validateActivationPreflightReceipt({
    receipt: preflight, intent, currentGitRevision, frontier, readinessSignal,
    aggregationPolicy, responsibilityPolicy, activationPolicy, health
  });
  await validateExecuteCommand({ command, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  assertFreshExecutionFrontier({ executedMs, intent, preflight, readinessSignal, health, activationPolicy, executionPolicy, lease: command.lease });
  assert(Array.isArray(parallelActiveHolders) && parallelActiveHolders.length === 0,
    'KONTUR Activation Executor: parallel active holder detected');
  assert(ledgerPolicy.system_id === executionPolicy.system_id && ledgerPolicy.server_instance_id === executionPolicy.server_instance_id,
    'KONTUR Activation Executor: ledger identity drift');

  const before = await initialRecoverLedger(ledgerRoot, ledgerPolicy);
  assert(before.head_entry === null && before.authoritative_state === null && before.entries.length === 0,
    'KONTUR Activation Executor: genesis activation requires empty durable ledger');
  const consumed = new Set(before.consumed_nonces || []);
  assert(!consumed.has(command.human_execute.nonce) && !consumed.has(intent.human_intent.nonce),
    'KONTUR Activation Executor: activation nonce replay detected');

  let kernelCalls = 0;
  const transitionReceipt = await kernelTransition({
    policy: responsibilityPolicy, readinessSignal, predecessorState: null, transitionKind: 'activate',
    evaluatedAt: executedAt, holderId: command.holder_id, responsibilityScopes: command.responsibility_scopes,
    fencingEpoch: command.fencing_epoch, lease: command.lease, health, triggerRef: command.command_id,
    parallelActiveHolders
  });
  kernelCalls += 1;
  assert(kernelCalls === 1, 'KONTUR Activation Executor: Kernel activate must execute exactly once');

  let entry = await buildLedgerEntry({
    ledgerPolicy, responsibilityPolicy, transitionReceipt, readinessSignal, previousEntry: null,
    triggerArtifact: preflight, commandNonce: command.human_execute.nonce,
    activationPreflight: preflight, committedAt: executedAt
  });
  entry = await augmentGenesisEntryWithExecuteCommand(entry, command);
  const expectedCommandBinding = await binding('KONTURActivationExecuteCommand', command.command_id, command);
  assert(sameBinding(entry.activation_execute_command_binding, expectedCommandBinding),
    'KONTUR Activation Executor: durable execute-command binding missing');
  assert(entry.command_nonce === command.human_execute.nonce,
    'KONTUR Activation Executor: durable execute nonce mismatch');

  await commitLedgerEntry(ledgerRoot, entry, ledgerPolicy);
  const recovered = await postCommitRecoverLedger(ledgerRoot, ledgerPolicy);
  const state = recovered && recovered.authoritative_state;
  assert(recovered && recovered.head_entry && state, 'KONTUR Activation Executor: post-commit recovery did not return authoritative head');
  assert(recovered.entries.length === 1 && recovered.head_entry.entry_digest.value === entry.entry_digest.value,
    'KONTUR Activation Executor: recovered ledger entry differs from committed genesis');
  assert(recovered.head_entry.activation_execute_command_binding && sameBinding(recovered.head_entry.activation_execute_command_binding, expectedCommandBinding),
    'KONTUR Activation Executor: recovered execute-command binding mismatch');
  assert(state.state_id === transitionReceipt.resulting_state.state_id,
    'KONTUR Activation Executor: recovered responsibility state differs from Kernel result');
  assert(recovered.head_entry.sequence === 1 && state.generation === 1 && state.lifecycle_state === 'active' &&
    state.holder_id === command.holder_id && sameArray(state.responsibility_scopes, command.responsibility_scopes) &&
    state.fencing_epoch === command.fencing_epoch,
    'KONTUR Activation Executor: recovered active responsibility frontier mismatch');

  const commandBinding = expectedCommandBinding;
  const preflightBinding = await binding('KONTURActivationPreflightReceipt', preflight.preflight_id, preflight);
  const transitionBinding = await binding('KONTURResponsibilityTransitionReceipt', transitionReceipt.receipt_id, transitionReceipt);
  const ledgerEntryBinding = await Ledger.entryBinding(recovered.head_entry);
  const recoveredHeadBinding = await binding('KONTURResponsibilityState', state.state_id, state);
  const receiptHash = await Binding.sha256Hex(Binding.utf8Bytes(
    `${commandBinding.digest.value}|${ledgerEntryBinding.digest.value}|${recoveredHeadBinding.digest.value}|${executedAt}`
  ));
  const receipt = {
    $schema: './kontur-activation-execution-receipt.schema.json',
    artifact_type: 'KONTURActivationExecutionReceipt', artifact_version: '0.1',
    receipt_id: `urn:uu-aap:kontur:activation-execution:${receiptHash.slice(0, 24)}`,
    execution_mode: command.execution_mode,
    status: command.execution_mode === 'live' ? 'activation_completed_live' : 'activation_completed_test_only',
    completed_at: executedAt, git_revision: currentGitRevision,
    system_id: executionPolicy.system_id, server_instance_id: executionPolicy.server_instance_id,
    execute_command_binding: commandBinding, activation_preflight_binding: preflightBinding,
    transition_receipt_binding: transitionBinding, ledger_entry_binding: ledgerEntryBinding,
    recovered_head_binding: recoveredHeadBinding, ledger_sequence: 1, responsibility_generation: 1,
    lifecycle_state: 'active', holder_id: state.holder_id,
    responsibility_scopes: clone(state.responsibility_scopes), fencing_epoch: state.fencing_epoch,
    claims: {
      final_human_execute_command_verified: true, kernel_activation_transition_produced: true,
      genesis_ledger_entry_durably_committed: true, authoritative_active_head_recovered: true,
      structural_responsibility_state_established: true, local_kontur_activation_completed: true,
      live_kontur_activated: command.execution_mode === 'live', execution_authority_granted: false,
      legal_responsibility_determined: false, legal_effect_established: false,
      moral_blame_assigned: false, truth_certified: false, distributed_consensus_established: false,
      poai_materialization_event_recorded: false, universal_canonicality_established: false
    }
  };
  await validateExecutionReceipt({ receipt, command, preflight, transitionReceipt, ledgerEntry: recovered.head_entry, recovered });
  return { receipt, transition_receipt: transitionReceipt, ledger_entry: recovered.head_entry, recovered };
}

module.exports = {
  digestJson, buildExecuteCommand, validateExecuteCommand, validateExecutionReceipt,
  executeActivation, augmentGenesisEntryWithExecuteCommand
};
