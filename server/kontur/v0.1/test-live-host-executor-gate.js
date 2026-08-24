'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const cp = require('child_process');
const Executor = require('./activation-executor.js');
const Designation = require('./live-host-designation.js');
const Host = require('./live-host-eligibility.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function iso(ms) { return new Date(ms).toISOString(); }
function run(command, args) {
  const result = cp.spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  assert(result.status === 0, `prerequisite failed: ${command} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return (result.stdout || '').trim();
}
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

async function main() {
  const out = process.argv[2] || '/tmp/kontur-live-host-executor-gate';
  const preflightDir = path.join(out, 'preflight');
  await fsp.rm(out, { recursive: true, force: true });
  await fsp.mkdir(out, { recursive: true });

  run('node', ['server/kontur/v0.1/test-activation-preflight.js', preflightDir]);
  const intent = readJson(path.join(preflightDir, 'activation-intent.json'));
  const preflight = readJson(path.join(preflightDir, 'activation-preflight.json'));
  const executionPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.activation-execution-policy.json'));
  const gitSha = run('git', ['rev-parse', 'HEAD']);
  const currentGitRevision = `git:${gitSha}`;
  const preflightMs = Date.parse(preflight.evaluated_at);
  const observedAt = iso(preflightMs - 500);
  const declaredAt = iso(preflightMs + 250);
  const evaluatedAt = iso(preflightMs + 500);
  const durableLedgerRoot = path.resolve(out, 'synthetic-persistent-ledger-fixture');

  const designation = await Designation.buildLiveHostDesignationDecision({
    declaredAt: iso(preflightMs - 2500),
    designatorRef: 'urn:uu-aap:human-actor:synthetic-test-designator',
    systemId: executionPolicy.system_id,
    serverInstanceId: executionPolicy.server_instance_id,
    hostId: 'urn:uu-aap:kontur:host:synthetic-live-gate-fixture',
    repositoryRoot: repoRoot,
    durableLedgerRoot,
    typedConfirmation: 'DESIGNATE_KONTUR_LIVE_HOST',
    nonce: `urn:uu-aap:kontur:live-host-designation-nonce:synthetic-executor-${gitSha.slice(0, 12)}`
  });
  const profile = await Host.buildLiveHostProfile({
    createdAt: iso(preflightMs - 2000),
    designationDecision: designation
  });
  assert(profile.human_designation_binding.artifact_ref === designation.decision_id,
    'synthetic profile did not bind explicit designation decision');

  const eligibility = await Host.evaluateLiveHostEligibility({
    profile,
    expectedGitRevision: currentGitRevision,
    observedAt,
    environment: {
      repositoryRoot: repoRoot,
      durableLedgerRoot,
      durableLedgerRootExists: true,
      durableLedgerRootReadable: true,
      durableLedgerRootWritable: true,
      durableLedgerRootOutsideRepository: true,
      ciEnvironmentDetected: false,
      temporarySandboxDetected: false,
      runtimeBoundary: 'host_local',
      processIdentity: 'synthetic-test-fixture:not-a-live-host-claim',
      workspaceRoot: repoRoot,
      observedGitRevision: currentGitRevision
    }
  });
  assert(eligibility.decision === 'live_host_eligible', 'synthetic positive eligibility fixture failed');

  const liveCommand = await Executor.buildExecuteCommand({
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    declaredAt,
    actorRef: 'urn:uu-aap:human-actor:synthetic-final-execute-fixture',
    executeNonce: `urn:uu-aap:kontur:activation-intent-nonce:execute:synthetic-${gitSha.slice(0, 12)}`,
    executionMode: 'live',
    liveHostProfile: profile,
    liveHostEligibilityReceipt: eligibility
  });
  await Executor.validateExecuteCommand({
    command: liveCommand,
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    evaluatedAt,
    liveHostProfile: profile,
    liveHostEligibilityReceipt: eligibility
  });
  assert(liveCommand.live_host_eligibility_binding.artifact_ref === eligibility.receipt_id,
    'live command did not bind exact eligibility receipt');
  assert(liveCommand.live_host_eligibility_evidence.profile.profile_id === profile.profile_id,
    'live command did not embed exact host profile');
  assert(liveCommand.live_host_eligibility_evidence.profile.human_designation_binding.artifact_ref === designation.decision_id,
    'live command profile lost explicit human designation binding');
  assert(liveCommand.live_host_eligibility_evidence.receipt.receipt_id === eligibility.receipt_id,
    'live command did not embed exact host receipt');

  const testOnlyCommand = await Executor.buildExecuteCommand({
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    declaredAt,
    actorRef: 'urn:uu-aap:human-actor:test-only-host-gate-regression',
    executeNonce: `urn:uu-aap:kontur:activation-intent-nonce:execute:test-only-${gitSha.slice(0, 12)}`,
    executionMode: 'test_only'
  });
  await Executor.validateExecuteCommand({
    command: testOnlyCommand,
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    evaluatedAt
  });
  assert(testOnlyCommand.live_host_eligibility_binding === null && testOnlyCommand.live_host_eligibility_evidence === null,
    'test_only command carried live host evidence');

  const vectors = [];
  vectors.push(await reject('live_missing_host_evidence', () => Executor.buildExecuteCommand({
    currentGitRevision, intent, preflight, executionPolicy, declaredAt,
    actorRef: 'urn:test:actor',
    executeNonce: `urn:uu-aap:kontur:activation-intent-nonce:execute:missing-${gitSha.slice(0, 8)}`,
    executionMode: 'live'
  }), /requires exact live host eligibility evidence/));

  vectors.push(await reject('test_only_carries_live_evidence', () => Executor.buildExecuteCommand({
    currentGitRevision, intent, preflight, executionPolicy, declaredAt,
    actorRef: 'urn:test:actor',
    executeNonce: `urn:uu-aap:kontur:activation-intent-nonce:execute:test-with-live-${gitSha.slice(0, 8)}`,
    executionMode: 'test_only', liveHostProfile: profile, liveHostEligibilityReceipt: eligibility
  }), /test_only must not carry live host/));

  vectors.push(await reject('eligibility_binding_substitution', async () => {
    const changed = clone(liveCommand);
    changed.live_host_eligibility_binding.digest.value = '0'.repeat(64);
    await Executor.validateExecuteCommand({
      command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt
    });
  }, /live host eligibility binding substitution/));

  vectors.push(await reject('designation_binding_substitution_in_embedded_profile', async () => {
    const changed = clone(liveCommand);
    changed.live_host_eligibility_evidence.profile.human_designation_binding.digest.value = '0'.repeat(64);
    await Executor.validateExecuteCommand({
      command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt
    });
  }, /human designation binding substitution/));

  vectors.push(await reject('external_embedded_eligibility_substitution', async () => {
    const changed = clone(eligibility);
    changed.observed_at = iso(Date.parse(changed.observed_at) - 1);
    await Executor.validateExecuteCommand({
      command: liveCommand, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt,
      liveHostProfile: profile, liveHostEligibilityReceipt: changed
    });
  }, /external\/embedded live host eligibility substitution/));

  vectors.push(await reject('stale_live_host_eligibility', () => Executor.validateExecuteCommand({
    command: liveCommand,
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    evaluatedAt: iso(Date.parse(eligibility.observed_at) +
      (executionPolicy.max_live_host_eligibility_age_seconds + 1) * 1000)
  }), /live host eligibility stale/));

  const ineligible = await Host.evaluateLiveHostEligibility({
    profile,
    expectedGitRevision: currentGitRevision,
    observedAt,
    environment: {
      repositoryRoot: repoRoot,
      durableLedgerRoot,
      durableLedgerRootExists: true,
      durableLedgerRootReadable: true,
      durableLedgerRootWritable: true,
      durableLedgerRootOutsideRepository: true,
      ciEnvironmentDetected: false,
      temporarySandboxDetected: true,
      runtimeBoundary: 'unknown',
      processIdentity: 'synthetic-temporary-sandbox-fixture',
      workspaceRoot: repoRoot,
      observedGitRevision: currentGitRevision
    }
  });
  assert(ineligible.decision === 'live_host_ineligible', 'sandbox fixture must be ineligible');
  vectors.push(await reject('ineligible_host_cannot_build_live_command', () => Executor.buildExecuteCommand({
    currentGitRevision, intent, preflight, executionPolicy, declaredAt,
    actorRef: 'urn:test:actor',
    executeNonce: `urn:uu-aap:kontur:activation-intent-nonce:execute:ineligible-${gitSha.slice(0, 8)}`,
    executionMode: 'live', liveHostProfile: profile, liveHostEligibilityReceipt: ineligible
  }), /live host is not eligible/));

  vectors.push(await reject('live_ledger_root_substitution_before_core', () => Executor.executeActivation({
    command: liveCommand,
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    executedAt: evaluatedAt,
    ledgerRoot: path.resolve(out, 'different-ledger-root')
  }), /live ledger root differs from eligible host profile/));

  vectors.push(await reject('deterministic_command_id_substitution', async () => {
    const changed = clone(liveCommand);
    changed.command_id = `urn:uu-aap:kontur:activation-execute-command:${'0'.repeat(24)}`;
    await Executor.validateExecuteCommand({
      command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt
    });
  }, /deterministic execute command ID mismatch/));

  const changedTestOnly = clone(testOnlyCommand);
  changedTestOnly.live_host_eligibility_binding = liveCommand.live_host_eligibility_binding;
  changedTestOnly.live_host_eligibility_evidence = liveCommand.live_host_eligibility_evidence;
  vectors.push(await reject('test_only_command_host_binding_injection', () => Executor.validateExecuteCommand({
    command: changedTestOnly, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt
  }), /test_only command must not bind live host eligibility/));

  writeJson(path.join(out, 'gate-vectors.json'), {
    artifact_type: 'KONTURLiveHostExecutorGateTestResult',
    artifact_version: '0.1',
    git_revision: currentGitRevision,
    synthetic_fixture_only: true,
    synthetic_human_designation_only: true,
    live_execute_invoked: false,
    kernel_activated: false,
    durable_ledger_written: false,
    positive_live_command_validated_in_memory_only: true,
    test_only_command_preserved: true,
    designation_decision_id: designation.decision_id,
    vectors
  });

  console.log('PASS KONTUR live host -> executor gate');
  console.log(`vectors=${vectors.length}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
