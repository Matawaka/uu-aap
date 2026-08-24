'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Core = require('./activation-executor-core.js');
const Host = require('./live-host-eligibility.js');

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Activation Executor: invalid ${label}`);
  return ms;
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
function sameBinding(a, b) {
  return !!a && !!b && a.artifact_type === b.artifact_type && a.artifact_ref === b.artifact_ref &&
    a.digest && b.digest && a.digest.canonicalization === b.digest.canonicalization &&
    a.digest.digest_algorithm === b.digest.digest_algorithm && a.digest.digest_encoding === b.digest.digest_encoding &&
    a.digest.value === b.digest.value;
}
function samePath(a, b) {
  return typeof a === 'string' && typeof b === 'string' && path.resolve(a) === path.resolve(b);
}

function assertLiveHostPolicy(policy) {
  assert(policy && Number.isInteger(policy.max_live_host_eligibility_age_seconds) &&
    policy.max_live_host_eligibility_age_seconds > 0 && policy.max_live_host_eligibility_age_seconds <= 60,
    'KONTUR Activation Executor: invalid live host eligibility freshness');
  const req = policy.requirements || {};
  assert(req.live_host_eligibility_required_for_live_mode === true,
    'KONTUR Activation Executor: live host eligibility requirement weakened');
  assert(req.live_ledger_root_matches_host_profile === true,
    'KONTUR Activation Executor: live ledger-root binding requirement weakened');
  assert(req.test_only_carries_no_live_host_eligibility === true,
    'KONTUR Activation Executor: test-only host-evidence separation weakened');
}

async function assertLiveHostGate({
  executionMode, currentGitRevision, executionPolicy, preflight,
  liveHostProfile, liveHostEligibilityReceipt, evaluatedAt, ledgerRoot = null
}) {
  assertLiveHostPolicy(executionPolicy);
  assert(['test_only', 'live'].includes(executionMode),
    'KONTUR Activation Executor: invalid execution mode');

  if (executionMode === 'test_only') {
    assert(liveHostProfile === null || liveHostProfile === undefined,
      'KONTUR Activation Executor: test_only must not carry live host profile');
    assert(liveHostEligibilityReceipt === null || liveHostEligibilityReceipt === undefined,
      'KONTUR Activation Executor: test_only must not carry live host eligibility receipt');
    return { binding: null, evidence: null };
  }

  assert(liveHostProfile && liveHostEligibilityReceipt,
    'KONTUR Activation Executor: live mode requires exact live host eligibility evidence');
  await Host.validateLiveHostProfile(liveHostProfile);
  await Host.validateLiveHostEligibilityReceipt({
    receipt: liveHostEligibilityReceipt,
    profile: liveHostProfile
  });

  assert(liveHostEligibilityReceipt.decision === 'live_host_eligible' &&
    liveHostEligibilityReceipt.safe_next_step === 'live_preflight_may_be_attempted' &&
    liveHostEligibilityReceipt.claims.live_host_eligibility_established === true &&
    liveHostEligibilityReceipt.claims.live_preflight_may_be_attempted === true,
    'KONTUR Activation Executor: live host is not eligible');
  assert(liveHostEligibilityReceipt.expected_git_revision === currentGitRevision &&
    liveHostEligibilityReceipt.observations.observed_git_revision === currentGitRevision &&
    liveHostEligibilityReceipt.observations.current_git_revision_exact === true,
    'KONTUR Activation Executor: live host eligibility Git revision drift');
  assert(liveHostProfile.system_id === executionPolicy.system_id &&
    liveHostProfile.server_instance_id === executionPolicy.server_instance_id &&
    liveHostEligibilityReceipt.system_id === executionPolicy.system_id &&
    liveHostEligibilityReceipt.server_instance_id === executionPolicy.server_instance_id,
    'KONTUR Activation Executor: live host system/server identity drift');

  const observedMs = parseTime(liveHostEligibilityReceipt.observed_at, 'live host eligibility observed_at');
  const preflightMs = parseTime(preflight.evaluated_at, 'preflight evaluated_at');
  const evaluatedMs = parseTime(evaluatedAt, 'live host eligibility evaluated_at');
  const maxAgeMs = executionPolicy.max_live_host_eligibility_age_seconds * 1000;
  assert(observedMs <= preflightMs && preflightMs - observedMs <= maxAgeMs,
    'KONTUR Activation Executor: live host eligibility must be fresh before preflight');
  assert(observedMs <= evaluatedMs && evaluatedMs - observedMs <= maxAgeMs,
    'KONTUR Activation Executor: live host eligibility stale or future-dated');

  assert(samePath(liveHostEligibilityReceipt.observations.observed_repository_root, liveHostProfile.repository_root),
    'KONTUR Activation Executor: live host repository-root drift');
  assert(samePath(liveHostEligibilityReceipt.observations.observed_durable_ledger_root, liveHostProfile.durable_ledger_root),
    'KONTUR Activation Executor: live host ledger-root observation drift');
  if (ledgerRoot !== null && ledgerRoot !== undefined) {
    assert(samePath(ledgerRoot, liveHostProfile.durable_ledger_root),
      'KONTUR Activation Executor: live ledger root differs from eligible host profile');
    assert(samePath(ledgerRoot, liveHostEligibilityReceipt.observations.observed_durable_ledger_root),
      'KONTUR Activation Executor: live ledger root differs from eligibility observation');
  }

  return {
    binding: await binding(
      'KONTURLiveHostEligibilityReceipt',
      liveHostEligibilityReceipt.receipt_id,
      liveHostEligibilityReceipt
    ),
    evidence: {
      profile: clone(liveHostProfile),
      receipt: clone(liveHostEligibilityReceipt)
    }
  };
}

async function commandIdentityHash(command) {
  const seed = {
    artifact_type: 'KONTURActivationExecuteCommandIdentitySeed',
    artifact_version: '0.1',
    git_revision: command.git_revision,
    activation_intent_binding: command.activation_intent_binding,
    activation_preflight_binding: command.activation_preflight_binding,
    execution_policy_binding: command.execution_policy_binding,
    execution_mode: command.execution_mode,
    live_host_eligibility_binding: command.live_host_eligibility_binding,
    holder_id: command.holder_id,
    responsibility_scopes: command.responsibility_scopes,
    fencing_epoch: command.fencing_epoch,
    lease: command.lease,
    human_execute: command.human_execute,
    declared_at: command.declared_at,
    valid_until: command.valid_until
  };
  return digestJson(seed);
}

async function buildExecuteCommand(args) {
  const {
    currentGitRevision, preflight, executionPolicy, declaredAt, executionMode,
    liveHostProfile = null, liveHostEligibilityReceipt = null
  } = args;
  const gate = await assertLiveHostGate({
    executionMode, currentGitRevision, executionPolicy, preflight,
    liveHostProfile, liveHostEligibilityReceipt, evaluatedAt: declaredAt
  });

  const command = await Core.buildExecuteCommand(args);
  command.live_host_eligibility_binding = gate.binding;
  command.live_host_eligibility_evidence = gate.evidence;
  command.command_id = `urn:uu-aap:kontur:activation-execute-command:${(await commandIdentityHash(command)).slice(0, 24)}`;
  return command;
}

async function validateExecuteCommand(args) {
  const {
    command, currentGitRevision, preflight, executionPolicy, evaluatedAt,
    liveHostProfile = undefined, liveHostEligibilityReceipt = undefined, ledgerRoot = null
  } = args;
  assert(command && command.artifact_type === 'KONTURActivationExecuteCommand',
    'KONTUR Activation Executor: activation execute command required');
  assert(Object.prototype.hasOwnProperty.call(command, 'live_host_eligibility_binding') &&
    Object.prototype.hasOwnProperty.call(command, 'live_host_eligibility_evidence'),
    'KONTUR Activation Executor: live host eligibility fields required');

  let embeddedProfile = null;
  let embeddedReceipt = null;
  if (command.execution_mode === 'live') {
    assert(command.live_host_eligibility_evidence &&
      command.live_host_eligibility_evidence.profile && command.live_host_eligibility_evidence.receipt,
      'KONTUR Activation Executor: live command missing embedded host eligibility evidence');
    embeddedProfile = command.live_host_eligibility_evidence.profile;
    embeddedReceipt = command.live_host_eligibility_evidence.receipt;
    if (liveHostProfile !== undefined && liveHostProfile !== null) {
      assert(await digestJson(liveHostProfile) === await digestJson(embeddedProfile),
        'KONTUR Activation Executor: external/embedded live host profile substitution');
    }
    if (liveHostEligibilityReceipt !== undefined && liveHostEligibilityReceipt !== null) {
      assert(await digestJson(liveHostEligibilityReceipt) === await digestJson(embeddedReceipt),
        'KONTUR Activation Executor: external/embedded live host eligibility substitution');
    }
  } else {
    assert(command.live_host_eligibility_binding === null && command.live_host_eligibility_evidence === null,
      'KONTUR Activation Executor: test_only command must not bind live host eligibility');
    assert(liveHostProfile === undefined || liveHostProfile === null,
      'KONTUR Activation Executor: test_only validation must not supply live host profile');
    assert(liveHostEligibilityReceipt === undefined || liveHostEligibilityReceipt === null,
      'KONTUR Activation Executor: test_only validation must not supply live host eligibility receipt');
  }

  const gate = await assertLiveHostGate({
    executionMode: command.execution_mode,
    currentGitRevision,
    executionPolicy,
    preflight,
    liveHostProfile: embeddedProfile,
    liveHostEligibilityReceipt: embeddedReceipt,
    evaluatedAt,
    ledgerRoot
  });
  assert(command.execution_mode === 'test_only' || sameBinding(command.live_host_eligibility_binding, gate.binding),
    'KONTUR Activation Executor: live host eligibility binding substitution');

  await Core.validateExecuteCommand(args);
  const expectedId = `urn:uu-aap:kontur:activation-execute-command:${(await commandIdentityHash(command)).slice(0, 24)}`;
  assert(command.command_id === expectedId,
    'KONTUR Activation Executor: deterministic execute command ID mismatch');
  return true;
}

async function executeActivation(args) {
  await validateExecuteCommand({
    command: args.command,
    currentGitRevision: args.currentGitRevision,
    intent: args.intent,
    preflight: args.preflight,
    executionPolicy: args.executionPolicy,
    evaluatedAt: args.executedAt,
    liveHostProfile: args.liveHostProfile,
    liveHostEligibilityReceipt: args.liveHostEligibilityReceipt,
    ledgerRoot: args.ledgerRoot
  });
  return Core.executeActivation(args);
}

module.exports = {
  digestJson,
  buildExecuteCommand,
  validateExecuteCommand,
  validateExecutionReceipt: Core.validateExecutionReceipt,
  executeActivation,
  augmentGenesisEntryWithExecuteCommand: Core.augmentGenesisEntryWithExecuteCommand
};
