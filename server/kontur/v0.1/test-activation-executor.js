'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const cp = require('child_process');
const Executor = require('./activation-executor.js');
const Ledger = require('./responsibility-ledger.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(v, m) { if (!v) throw new Error(m); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, v) { fs.writeFileSync(file, `${JSON.stringify(v, null, 2)}\n`); }
function iso(ms) { return new Date(ms).toISOString(); }
function run(command, args) {
  const r = cp.spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.error) throw r.error;
  assert(r.status === 0, `prerequisite failed: ${command} ${args.join(' ')}\n${r.stdout || ''}\n${r.stderr || ''}`);
  return (r.stdout || '').trim();
}
async function reject(name, fn, pattern) {
  let err = null;
  try { await fn(); } catch (e) { err = e; }
  assert(err, `${name}: expected failure`);
  if (pattern) assert(pattern.test(err.message), `${name}: unexpected error: ${err.message}`);
  return { name, error: err.message };
}
async function emptyLedger(root, policy) {
  const r = await Ledger.recoverLedger(root, policy);
  return r.entries.length === 0 && r.head_entry === null && r.authoritative_state === null;
}

async function main() {
  const out = process.argv[2] || '/tmp/kontur-activation-executor';
  const preflightDir = path.join(out, 'preflight');
  const ledgerRoot = path.join(out, 'ledger-positive');
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

  const declaredMs = Date.parse(preflight.evaluated_at) + 250;
  const executedMs = declaredMs + 750;
  const declaredAt = iso(declaredMs);
  const executedAt = iso(executedMs);
  const executeNonce = `urn:uu-aap:kontur:activation-intent-nonce:execute:${gitSha.slice(0, 16)}`;
  const command = await Executor.buildExecuteCommand({
    currentGitRevision, intent, preflight, executionPolicy, declaredAt,
    actorRef: 'urn:uu-aap:human-actor:repository-owner-final-execute-test-only',
    executeNonce, executionMode: 'test_only'
  });
  await Executor.validateExecuteCommand({ command, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });

  const baseArgs = {
    command, currentGitRevision, intent, preflight, frontier, readinessSignal,
    aggregationPolicy, responsibilityPolicy, activationPolicy, health, executionPolicy,
    ledgerPolicy, ledgerRoot, executedAt, parallelActiveHolders: []
  };
  const result = await Executor.executeActivation(baseArgs);
  writeJson(path.join(out, 'activation-execute-command.json'), command);
  writeJson(path.join(out, 'activation-execution-receipt.json'), result.receipt);
  writeJson(path.join(out, 'activation-transition-receipt.json'), result.transition_receipt);
  writeJson(path.join(out, 'genesis-ledger-entry.json'), result.ledger_entry);

  assert(result.receipt.execution_mode === 'test_only', 'test-only execution mode lost');
  assert(result.receipt.status === 'activation_completed_test_only', 'test-only activation status missing');
  assert(result.receipt.claims.live_kontur_activated === false, 'CI must never claim live KONTUR activation');
  assert(result.receipt.claims.local_kontur_activation_completed === true, 'isolated local test activation must complete');
  assert(result.recovered.entries.length === 1 && result.recovered.authoritative_state.lifecycle_state === 'active',
    'positive execution did not recover active genesis');
  assert(result.ledger_entry.command_nonce === executeNonce, 'execute nonce not durably committed');
  assert(result.ledger_entry.activation_execute_command.command_id === command.command_id,
    'final execute command bytes not durably embedded');

  const recoveryRaw = run('node', [
    'server/kontur/v0.1/recover-responsibility-ledger.js', ledgerRoot,
    'server/kontur/v0.1/policies/reference-server.responsibility-ledger-policy.json'
  ]);
  const externalRecovery = JSON.parse(recoveryRaw);
  assert(externalRecovery.entry_count === 1 && externalRecovery.lifecycle_state === 'active',
    'separate-process recovery did not confirm active genesis');
  assert(externalRecovery.consumed_nonces.includes(executeNonce),
    'separate-process recovery did not recover execute nonce');
  writeJson(path.join(out, 'separate-process-recovery.json'), externalRecovery);

  const vectors = [];
  vectors.push(await reject('execute_nonce_equals_intent_nonce', () => Executor.buildExecuteCommand({
    currentGitRevision, intent, preflight, executionPolicy, declaredAt,
    actorRef: 'urn:test:actor', executeNonce: intent.human_intent.nonce, executionMode: 'test_only'
  }), /execute nonce must differ|one-shot execute nonce/));

  vectors.push(await reject('git_revision_drift', async () => {
    const changed = clone(command); changed.git_revision = `git:${'0'.repeat(40)}`;
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /Git revision drift/));

  vectors.push(await reject('execute_command_expired', () => Executor.validateExecuteCommand({
    command, currentGitRevision, intent, preflight, executionPolicy,
    evaluatedAt: iso(Date.parse(command.valid_until) + 1)
  }), /expired or future-dated/));

  vectors.push(await reject('execute_command_future_dated', () => Executor.validateExecuteCommand({
    command, currentGitRevision, intent, preflight, executionPolicy,
    evaluatedAt: iso(Date.parse(command.declared_at) - 1)
  }), /expired or future-dated/));

  vectors.push(await reject('intent_binding_substitution', async () => {
    const changed = clone(command); changed.activation_intent_binding.digest.value = '0'.repeat(64);
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /intent binding substitution/));

  vectors.push(await reject('preflight_binding_substitution', async () => {
    const changed = clone(command); changed.activation_preflight_binding.digest.value = '0'.repeat(64);
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /preflight binding substitution/));

  vectors.push(await reject('holder_substitution', async () => {
    const changed = clone(command); changed.holder_id = 'urn:uu-aap:kontur:holder:other';
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /parameter substitution/));

  vectors.push(await reject('scope_substitution', async () => {
    const changed = clone(command); changed.responsibility_scopes = changed.responsibility_scopes.slice(0, 1);
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /parameter substitution/));

  vectors.push(await reject('epoch_substitution', async () => {
    const changed = clone(command); changed.fencing_epoch += 1;
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /parameter substitution/));

  vectors.push(await reject('lease_substitution', async () => {
    const changed = clone(command); changed.lease.expires_at = iso(Date.parse(changed.lease.expires_at) + 1000);
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /parameter substitution/));

  vectors.push(await reject('scalar_injection', async () => {
    const changed = clone(command); changed.responsibility_score = 1;
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /scalar fields prohibited/));

  vectors.push(await reject('command_activation_overclaim', async () => {
    const changed = clone(command); changed.claims.kernel_activated = true;
    await Executor.validateExecuteCommand({ command: changed, currentGitRevision, intent, preflight, executionPolicy, evaluatedAt: executedAt });
  }, /assurance boundary/));

  vectors.push(await reject('parallel_active_holder', () => Executor.executeActivation({
    ...baseArgs, ledgerRoot: path.join(out, 'ledger-parallel'),
    parallelActiveHolders: ['urn:uu-aap:kontur:holder:other']
  }), /parallel active holder/));

  vectors.push(await reject('stale_preflight', () => Executor.executeActivation({
    ...baseArgs, ledgerRoot: path.join(out, 'ledger-stale-preflight'),
    executedAt: iso(Date.parse(preflight.evaluated_at) + (executionPolicy.max_preflight_age_seconds + 1) * 1000)
  }), /preflight stale|execute command expired/));

  vectors.push(await reject('existing_genesis_head', () => Executor.executeActivation(baseArgs),
    /empty durable ledger|genesis activation/));

  const kernelFailRoot = path.join(out, 'ledger-kernel-failure');
  vectors.push(await reject('kernel_failure_zero_commit', () => Executor.executeActivation({
    ...baseArgs, ledgerRoot: kernelFailRoot,
    kernelTransition: async () => { throw new Error('simulated kernel failure'); }
  }), /simulated kernel failure/));
  assert(await emptyLedger(kernelFailRoot, ledgerPolicy), 'kernel failure must leave zero committed entries');

  const commitFailRoot = path.join(out, 'ledger-commit-failure');
  vectors.push(await reject('ledger_commit_failure_no_success_receipt', () => Executor.executeActivation({
    ...baseArgs, ledgerRoot: commitFailRoot,
    commitLedgerEntry: async () => { throw new Error('simulated durable commit failure'); }
  }), /simulated durable commit failure/));
  assert(await emptyLedger(commitFailRoot, ledgerPolicy), 'simulated pre-commit failure must leave zero committed entries');

  const recoveryFailRoot = path.join(out, 'ledger-post-commit-recovery-failure');
  vectors.push(await reject('post_commit_recovery_mismatch_no_success_receipt', () => Executor.executeActivation({
    ...baseArgs, ledgerRoot: recoveryFailRoot,
    postCommitRecoverLedger: async () => ({ entries: [], head_entry: null, authoritative_state: null, consumed_nonces: [] })
  }), /post-commit recovery/));
  const afterRecoveryFailure = await Ledger.recoverLedger(recoveryFailRoot, ledgerPolicy);
  assert(afterRecoveryFailure.entries.length === 1 && afterRecoveryFailure.authoritative_state.lifecycle_state === 'active',
    'post-commit receipt failure must preserve already committed genesis and block retry');

  const corruptRoot = path.join(out, 'ledger-corrupt-before-execute');
  await fsp.mkdir(path.join(corruptRoot, 'entries'), { recursive: true });
  await fsp.mkdir(path.join(corruptRoot, 'tmp'), { recursive: true });
  await fsp.writeFile(path.join(corruptRoot, 'entries', `${'0'.repeat(12)}-${'0'.repeat(64)}.json`), '{bad json', 'utf8');
  vectors.push(await reject('corrupt_ledger_before_execution', () => Executor.executeActivation({
    ...baseArgs, ledgerRoot: corruptRoot
  }), /malformed committed entry|invalid committed entry filename|committed filename/));

  vectors.push(await reject('execution_receipt_live_overclaim_in_test_mode', async () => {
    const changed = clone(result.receipt); changed.claims.live_kontur_activated = true;
    await Executor.validateExecutionReceipt({
      receipt: changed, command, preflight, transitionReceipt: result.transition_receipt,
      ledgerEntry: result.ledger_entry, recovered: result.recovered
    });
  }, /live activation claim\/mode mismatch/));

  vectors.push(await reject('execution_receipt_legal_overclaim', async () => {
    const changed = clone(result.receipt); changed.claims.legal_responsibility_determined = true;
    await Executor.validateExecutionReceipt({
      receipt: changed, command, preflight, transitionReceipt: result.transition_receipt,
      ledgerEntry: result.ledger_entry, recovered: result.recovered
    });
  }, /prohibited claim legal_responsibility_determined/));

  writeJson(path.join(out, 'summary.json'), {
    suite: 'KONTUR Activation Executor v0.1',
    git_revision: currentGitRevision,
    execution_mode: 'test_only',
    final_execute_command: command.command_id,
    execution_receipt: result.receipt.receipt_id,
    durable_genesis_sequence: result.recovered.head_entry.sequence,
    recovered_lifecycle_state: result.recovered.authoritative_state.lifecycle_state,
    separate_process_recovery_confirmed: true,
    live_kontur_activated: false,
    negative_vectors: vectors.length
  });
  console.log(JSON.stringify({
    suite: 'KONTUR Activation Executor v0.1',
    execution_mode: 'test_only',
    durable_genesis_sequence: 1,
    recovered_lifecycle_state: 'active',
    separate_process_recovery_confirmed: true,
    live_kontur_activated: false,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
