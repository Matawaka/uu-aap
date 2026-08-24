'use strict';

const cp = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const Executor = require('./activation-executor.js');
const Designation = require('./live-host-designation.js');
const Host = require('./live-host-eligibility.js');
const RuntimeHost = require('./live-host-runtime-observer.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function iso(ms) { return new Date(ms).toISOString(); }
function run(command, args) {
  const result = cp.spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error) throw result.error;
  assert(result.status === 0,
    `prerequisite failed: ${command} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
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
  const out = process.argv[2] || '/tmp/kontur-live-host-runtime-reobservation';
  const preflightDir = path.join(out, 'preflight');
  const durableLedgerRoot = path.join(out, 'candidate-live-ledger');
  await fsp.rm(out, { recursive: true, force: true });
  await fsp.mkdir(durableLedgerRoot, { recursive: true });

  run('node', ['server/kontur/v0.1/test-activation-preflight.js', preflightDir]);
  const intent = readJson(path.join(preflightDir, 'activation-intent.json'));
  const preflight = readJson(path.join(preflightDir, 'activation-preflight.json'));
  const executionPolicy = readJson(path.join(
    repoRoot, 'server/kontur/v0.1/policies/reference-server.activation-execution-policy.json'
  ));
  const gitSha = run('git', ['rev-parse', 'HEAD']);
  const currentGitRevision = `git:${gitSha}`;
  const canonicalRepoRoot = fs.realpathSync(repoRoot);
  const canonicalLedgerRoot = fs.realpathSync(durableLedgerRoot);
  const preflightMs = Date.parse(preflight.evaluated_at);
  const observedAt = iso(preflightMs - 500);
  const declaredAt = iso(preflightMs + 250);
  const executedAt = iso(preflightMs + 500);

  const designation = await Designation.buildLiveHostDesignationDecision({
    declaredAt: iso(preflightMs - 2500),
    designatorRef: 'urn:uu-aap:human-actor:runtime-reobservation-synthetic-designator',
    systemId: executionPolicy.system_id,
    serverInstanceId: executionPolicy.server_instance_id,
    hostId: 'urn:uu-aap:kontur:host:runtime-reobservation-fixture',
    repositoryRoot: canonicalRepoRoot,
    durableLedgerRoot: canonicalLedgerRoot,
    typedConfirmation: 'DESIGNATE_KONTUR_LIVE_HOST',
    nonce: `urn:uu-aap:kontur:live-host-designation-nonce:runtime-${gitSha.slice(0, 12)}`
  });
  const profile = await Host.buildLiveHostProfile({
    createdAt: iso(preflightMs - 2000),
    designationDecision: designation
  });
  assert(profile.human_designation_binding.artifact_ref === designation.decision_id,
    'runtime fixture profile must bind explicit synthetic designation');

  // Deliberately forge the environment layer exactly the way the lower-level
  // pure evaluator permits for tests. This receipt is structurally positive,
  // but it is not evidence that the current process actually observed those facts.
  const callerAssertedEligibility = await Host.evaluateLiveHostEligibility({
    profile,
    expectedGitRevision: currentGitRevision,
    observedAt,
    environment: {
      repositoryRoot: canonicalRepoRoot,
      durableLedgerRoot: canonicalLedgerRoot,
      durableLedgerRootExists: true,
      durableLedgerRootReadable: true,
      durableLedgerRootWritable: true,
      durableLedgerRootOutsideRepository: true,
      ciEnvironmentDetected: false,
      temporarySandboxDetected: false,
      runtimeBoundary: 'host_local',
      processIdentity: 'caller-asserted:not-runtime-observed',
      workspaceRoot: canonicalRepoRoot,
      observedGitRevision: currentGitRevision
    }
  });
  assert(callerAssertedEligibility.decision === 'live_host_eligible',
    'fixture must prove the lower-level evaluator can encode caller assertions');

  const command = await Executor.buildExecuteCommand({
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    declaredAt,
    actorRef: 'urn:uu-aap:human-actor:runtime-reobservation-final-fixture',
    executeNonce: `urn:uu-aap:kontur:activation-intent-nonce:execute:runtime-${gitSha.slice(0, 12)}`,
    executionMode: 'live',
    liveHostProfile: profile,
    liveHostEligibilityReceipt: callerAssertedEligibility
  });
  await Executor.validateExecuteCommand({
    command,
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    evaluatedAt: executedAt,
    liveHostProfile: profile,
    liveHostEligibilityReceipt: callerAssertedEligibility
  });

  const actualCiEligibility = await RuntimeHost.observeAndEvaluateLiveHostEligibility({
    profile,
    expectedGitRevision: currentGitRevision,
    observedAt,
    ledgerRoot: canonicalLedgerRoot
  });
  if (process.env.GITHUB_ACTIONS === 'true') {
    assert(actualCiEligibility.decision === 'live_host_ineligible',
      'GitHub Actions must not self-qualify as a live host');
    assert(actualCiEligibility.observations.ci_environment_detected === true,
      'GitHub Actions CI observation missing');
  }

  const sandboxEligibility = await RuntimeHost.observeAndEvaluateLiveHostEligibility({
    profile,
    expectedGitRevision: currentGitRevision,
    observedAt,
    ledgerRoot: canonicalLedgerRoot,
    environment: { ...process.env, KONTUR_TEMPORARY_SANDBOX: '1' }
  });
  assert(sandboxEligibility.decision === 'live_host_ineligible' &&
    sandboxEligibility.observations.temporary_sandbox_detected === true,
    'explicit temporary sandbox marker must fail closed');

  let kernelCalls = 0;
  let initialRecoveryCalls = 0;
  let commitCalls = 0;
  let postRecoveryCalls = 0;
  const rejection = await reject('caller_asserted_positive_receipt_reobserved_before_effect', () =>
    Executor.executeActivation({
      command,
      currentGitRevision,
      intent,
      preflight,
      executionPolicy,
      executedAt,
      ledgerRoot: canonicalLedgerRoot,
      liveHostProfile: profile,
      liveHostEligibilityReceipt: callerAssertedEligibility,
      kernelTransition: async () => { kernelCalls += 1; throw new Error('kernel must not be reached'); },
      initialRecoverLedger: async () => { initialRecoveryCalls += 1; throw new Error('ledger recovery must not be reached'); },
      commitLedgerEntry: async () => { commitCalls += 1; throw new Error('ledger commit must not be reached'); },
      postCommitRecoverLedger: async () => { postRecoveryCalls += 1; throw new Error('post recovery must not be reached'); }
    }), /runtime re-observation differs|current runtime is not live-host eligible/
  );

  assert(kernelCalls === 0, 'runtime rejection must precede Kernel');
  assert(initialRecoveryCalls === 0, 'runtime rejection must precede ledger recovery');
  assert(commitCalls === 0, 'runtime rejection must precede ledger commit');
  assert(postRecoveryCalls === 0, 'runtime rejection must precede post-commit recovery');

  // A raw receipt that copies the current process identity but lies only about
  // sandbox status must also fail deterministic reconstruction.
  const observedEnvironment = RuntimeHost.observeLiveHostEnvironment({
    profile,
    ledgerRoot: canonicalLedgerRoot,
    environment: { ...process.env, KONTUR_TEMPORARY_SANDBOX: '1' }
  });
  const liedEnvironment = {
    ...observedEnvironment,
    temporarySandboxDetected: false,
    runtimeBoundary: 'host_local'
  };
  const sandboxLieReceipt = await Host.evaluateLiveHostEligibility({
    profile,
    expectedGitRevision: currentGitRevision,
    observedAt,
    environment: liedEnvironment
  });
  assert(sandboxLieReceipt.decision === 'live_host_eligible' ||
    sandboxLieReceipt.observations.ci_environment_detected === true,
    'sandbox lie fixture must remain bounded by CI observation');
  await reject('sandbox_boolean_cannot_override_runtime_marker', () =>
    RuntimeHost.assertRuntimeMatchesEligibilityReceipt({
      profile,
      receipt: sandboxLieReceipt,
      expectedGitRevision: currentGitRevision,
      ledgerRoot: canonicalLedgerRoot,
      environment: { ...process.env, KONTUR_TEMPORARY_SANDBOX: '1' }
    }), /runtime re-observation differs|current runtime is not live-host eligible/
  );

  const result = {
    artifact_type: 'KONTURLiveHostRuntimeReobservationTestResult',
    artifact_version: '0.1',
    git_revision: currentGitRevision,
    synthetic_designation_decision_id: designation.decision_id,
    caller_asserted_positive_receipt_id: callerAssertedEligibility.receipt_id,
    caller_asserted_positive_command_validated_in_memory_only: true,
    actual_runtime_decision: actualCiEligibility.decision,
    ci_environment_detected: actualCiEligibility.observations.ci_environment_detected,
    sandbox_marker_decision: sandboxEligibility.decision,
    execution_attempt_rejected_before_effect: true,
    kernel_calls: kernelCalls,
    initial_ledger_recovery_calls: initialRecoveryCalls,
    ledger_commit_calls: commitCalls,
    post_commit_recovery_calls: postRecoveryCalls,
    live_execute_completed: false,
    rejection
  };
  writeJson(path.join(out, 'runtime-reobservation-vectors.json'), result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
