'use strict';

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const cp = require('child_process');
const PreflightCore = require('./activation-preflight-core.js');
const ExecutorCore = require('./activation-executor-core.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
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
  const out = process.argv[2] || path.join(os.tmpdir(), 'kontur-core-entrypoint-failclosed');
  const preflightDir = path.join(out, 'preflight');
  await fsp.rm(out, { recursive: true, force: true });
  await fsp.mkdir(out, { recursive: true });

  run('node', ['server/kontur/v0.1/test-activation-preflight.js', preflightDir]);

  const readinessDir = path.join(preflightDir, 'readiness');
  const frontier = readJson(path.join(readinessDir, 'activation-frontier.json'));
  const readinessSignal = readJson(path.join(readinessDir, 'readiness-signal.json'));
  const health = readJson(path.join(readinessDir, 'server-health.json'));
  const intent = readJson(path.join(preflightDir, 'activation-intent.json'));
  const preflight = readJson(path.join(preflightDir, 'activation-preflight.json'));
  const aggregationPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.readiness-aggregation-policy.json'));
  const responsibilityPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-policy.json'));
  const activationPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.activation-policy.json'));
  const executionPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.activation-execution-policy.json'));
  const ledgerPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-ledger-policy.json'));
  const gitSha = run('git', ['rev-parse', 'HEAD']);
  const currentGitRevision = `git:${gitSha}`;

  const legacyIntent = clone(intent);
  delete legacyIntent.human_activation_review_decision_binding;
  delete legacyIntent.human_activation_review_evidence;
  delete legacyIntent.claims.human_activation_review_approval_bound;

  const basePreflightCtx = {
    intent: legacyIntent,
    currentGitRevision,
    frontier,
    readinessSignal,
    aggregationPolicy,
    responsibilityPolicy,
    activationPolicy,
    health,
    evaluatedAt: preflight.evaluated_at,
    parallelActiveHolders: [],
    currentResponsibilityState: null
  };

  const vectors = [];
  vectors.push(await reject(
    'direct_preflight_core_cannot_issue_positive_receipt_without_HAR_binding',
    () => PreflightCore.preflightActivation(basePreflightCtx),
    /HAR-bound activation intent|exact contract keys|required|HAR/i
  ));

  vectors.push(await reject(
    'direct_preflight_core_cannot_validate_positive_receipt_without_HAR_binding',
    () => PreflightCore.validateActivationPreflightReceipt({
      ...basePreflightCtx,
      receipt: preflight
    }),
    /HAR-bound activation intent|exact contract keys|required|HAR/i
  ));

  const declaredMs = Date.parse(preflight.evaluated_at) + 250;
  const executedMs = declaredMs + 500;
  const declaredAt = iso(declaredMs);
  const executedAt = iso(executedMs);
  const executeNonce = `urn:uu-aap:kontur:activation-intent-nonce:execute:core-bypass-${gitSha.slice(0, 12)}`;

  const legacyLiveCommand = await ExecutorCore.buildExecuteCommand({
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    declaredAt,
    actorRef: 'urn:uu-aap:human-actor:core-bypass-regression',
    executeNonce,
    executionMode: 'live'
  });

  let kernelCalls = 0;
  let recoverCalls = 0;
  const liveRoot = path.join(out, 'live-direct-core-attempt');
  vectors.push(await reject(
    'direct_executor_core_live_path_reenters_public_host_gate_before_mutation',
    () => ExecutorCore.executeActivation({
      command: legacyLiveCommand,
      currentGitRevision,
      intent,
      preflight,
      frontier,
      readinessSignal,
      aggregationPolicy,
      responsibilityPolicy,
      activationPolicy,
      health,
      executionPolicy,
      ledgerPolicy,
      ledgerRoot: liveRoot,
      executedAt,
      parallelActiveHolders: [],
      kernelTransition: async () => { kernelCalls += 1; throw new Error('kernel must not be reached'); },
      initialRecoverLedger: async () => { recoverCalls += 1; throw new Error('ledger recovery must not be reached'); }
    }),
    /live command missing embedded host eligibility evidence|live host eligibility fields required|live mode requires exact live host eligibility evidence/i
  ));
  assert(kernelCalls === 0 && recoverCalls === 0,
    'direct live core bypass reached Kernel or ledger recovery before host gate');
  assert(!fs.existsSync(liveRoot), 'direct live core bypass created a ledger root');

  const testOnlyCommand = await ExecutorCore.buildExecuteCommand({
    currentGitRevision,
    intent,
    preflight,
    executionPolicy,
    declaredAt,
    actorRef: 'urn:uu-aap:human-actor:test-only-root-regression',
    executeNonce: `urn:uu-aap:kontur:activation-intent-nonce:execute:test-only-${gitSha.slice(0, 12)}`,
    executionMode: 'test_only'
  });

  const nonTempRoot = path.join(repoRoot, 'server', 'kontur', 'v0.1', '.forbidden-test-ledger');
  let nonTempRecoverCalls = 0;
  vectors.push(await reject(
    'test_only_cannot_target_non_temp_ledger_root',
    () => ExecutorCore.executeActivation({
      command: testOnlyCommand,
      currentGitRevision,
      intent,
      preflight,
      frontier,
      readinessSignal,
      aggregationPolicy,
      responsibilityPolicy,
      activationPolicy,
      health,
      executionPolicy,
      ledgerPolicy,
      ledgerRoot: nonTempRoot,
      executedAt,
      parallelActiveHolders: [],
      initialRecoverLedger: async () => { nonTempRecoverCalls += 1; throw new Error('ledger recovery must not be reached'); }
    }),
    /test_only ledger root must remain under the OS temporary root/i
  ));
  assert(nonTempRecoverCalls === 0, 'non-temp test_only path reached ledger recovery');
  assert(!fs.existsSync(nonTempRoot), 'non-temp test_only path created repository state');

  const symlinkTarget = path.join(repoRoot, 'server', 'kontur', 'v0.1');
  const symlinkRoot = path.join(out, 'escape-link');
  await fsp.symlink(symlinkTarget, symlinkRoot, 'dir');
  let symlinkRecoverCalls = 0;
  vectors.push(await reject(
    'test_only_temp_symlink_cannot_escape_to_repository',
    () => ExecutorCore.executeActivation({
      command: testOnlyCommand,
      currentGitRevision,
      intent,
      preflight,
      frontier,
      readinessSignal,
      aggregationPolicy,
      responsibilityPolicy,
      activationPolicy,
      health,
      executionPolicy,
      ledgerPolicy,
      ledgerRoot: path.join(symlinkRoot, 'ledger'),
      executedAt,
      parallelActiveHolders: [],
      initialRecoverLedger: async () => { symlinkRecoverCalls += 1; throw new Error('ledger recovery must not be reached'); }
    }),
    /test_only ledger root must remain under the OS temporary root/i
  ));
  assert(symlinkRecoverCalls === 0, 'symlink escape reached ledger recovery');

  const summary = {
    artifact_type: 'KONTURCoreEntrypointFailClosedRegressionSummary',
    artifact_version: '0.1',
    canonical_git_revision: currentGitRevision,
    vectors,
    direct_live_kernel_calls: kernelCalls,
    direct_live_recovery_calls: recoverCalls,
    non_temp_recovery_calls: nonTempRecoverCalls,
    symlink_escape_recovery_calls: symlinkRecoverCalls,
    repository_mutated: false,
    live_kontur_activated: false
  };
  fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
