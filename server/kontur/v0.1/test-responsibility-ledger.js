'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const cp = require('child_process');
const Kernel = require('./responsibility-kernel.js');
const Ledger = require('./responsibility-ledger.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function iso(ms) { return new Date(ms).toISOString(); }
function run(command, args) {
  const result = cp.spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  assert(result.status === 0, `prerequisite failed: ${command} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return (result.stdout || '').trim();
}
async function reject(name, fn, pattern = null) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}
async function copyDir(source, target) {
  await fsp.rm(target, { recursive: true, force: true });
  await fsp.cp(source, target, { recursive: true });
}
async function firstEntryFile(ledgerDir) {
  const names = (await fsp.readdir(path.join(ledgerDir, 'entries'))).sort();
  return path.join(ledgerDir, 'entries', names[0]);
}

async function main() {
  const outputDir = process.argv[2] || '/tmp/kontur-responsibility-ledger-test';
  const preflightDir = path.join(outputDir, 'preflight');
  const ledgerDir = path.join(outputDir, 'ledger');
  await fsp.rm(outputDir, { recursive: true, force: true });
  await fsp.mkdir(outputDir, { recursive: true });

  // Reproduce fresh readiness + human activation intent + preflight on this exact checkout.
  run('node', ['server/kontur/v0.1/test-activation-preflight.js', preflightDir]);

  const intent = readJson(path.join(preflightDir, 'activation-intent.json'));
  const preflight = readJson(path.join(preflightDir, 'activation-preflight.json'));
  const readinessSignal = readJson(path.join(preflightDir, 'readiness/readiness-signal.json'));
  const health = readJson(path.join(preflightDir, 'readiness/server-health.json'));
  const responsibilityPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-policy.json'));
  const ledgerPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-ledger-policy.json'));

  // TEST-ONLY activation: state exists only inside this runner's temporary directory.
  // This is not a live KONTUR activation and is never written into the repository.
  const activationAt = iso(Date.parse(preflight.evaluated_at) + 1000);
  const activationReceipt = await Kernel.transitionResponsibility({
    policy: responsibilityPolicy,
    readinessSignal,
    predecessorState: null,
    transitionKind: 'activate',
    evaluatedAt: activationAt,
    holderId: preflight.holder_id,
    responsibilityScopes: preflight.responsibility_scopes,
    fencingEpoch: preflight.fencing_epoch,
    lease: preflight.lease,
    health,
    triggerRef: preflight.preflight_id,
    parallelActiveHolders: []
  });

  const activationEntry = await Ledger.buildLedgerEntry({
    ledgerPolicy,
    responsibilityPolicy,
    transitionReceipt: activationReceipt,
    readinessSignal,
    previousEntry: null,
    triggerArtifact: preflight,
    commandNonce: intent.human_intent.nonce,
    activationPreflight: preflight,
    committedAt: iso(Date.parse(activationAt) + 1000)
  });
  let recovered = await Ledger.commitLedgerEntry(ledgerDir, activationEntry, ledgerPolicy);
  assert(recovered.entries.length === 1, 'genesis ledger entry not committed');
  assert(recovered.authoritative_state.lifecycle_state === 'active', 'genesis recovered state must be active');
  assert(recovered.consumed_nonces.includes(intent.human_intent.nonce), 'activation nonce must be consumed');

  const heartbeatAt = iso(Date.parse(activationAt) + 2000);
  const heartbeatTrigger = {
    artifact_type: 'KONTURTestTrigger',
    artifact_version: '0.1-test-only',
    observation_id: 'urn:uu-aap:kontur:test-trigger:heartbeat:1',
    observed_at: heartbeatAt
  };
  const heartbeatReceipt = await Kernel.transitionResponsibility({
    policy: responsibilityPolicy,
    readinessSignal: null,
    predecessorState: activationReceipt.resulting_state,
    transitionKind: 'heartbeat',
    evaluatedAt: heartbeatAt,
    holderId: preflight.holder_id,
    responsibilityScopes: preflight.responsibility_scopes,
    fencingEpoch: preflight.fencing_epoch,
    lease: preflight.lease,
    health,
    triggerRef: heartbeatTrigger.observation_id,
    parallelActiveHolders: []
  });
  const heartbeatEntry = await Ledger.buildLedgerEntry({
    ledgerPolicy,
    responsibilityPolicy,
    transitionReceipt: heartbeatReceipt,
    previousEntry: activationEntry,
    triggerArtifact: heartbeatTrigger,
    committedAt: iso(Date.parse(heartbeatAt) + 1000)
  });
  recovered = await Ledger.commitLedgerEntry(ledgerDir, heartbeatEntry, ledgerPolicy);
  assert(recovered.entries.length === 2 && recovered.authoritative_state.generation === 2,
    'successor ledger entry not recovered');

  // A separate Node process must recover the same authoritative head.
  const restart = JSON.parse(run('node', [
    'server/kontur/v0.1/recover-responsibility-ledger.js',
    ledgerDir,
    path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-ledger-policy.json')
  ]));
  assert(restart.entry_count === 2, 'restart recovery entry count mismatch');
  assert(restart.authoritative_state_id === heartbeatReceipt.resulting_state.state_id,
    'restart recovery authoritative state mismatch');
  assert(restart.fencing_epoch === preflight.fencing_epoch,
    'restart recovery fencing epoch mismatch');
  assert(restart.consumed_nonces.includes(intent.human_intent.nonce),
    'restart recovery lost consumed nonce');

  // Temporary and cache-like files are non-authoritative.
  await fsp.writeFile(path.join(ledgerDir, 'tmp', 'stale-uncommitted.tmp'), '{not-authoritative', 'utf8');
  await fsp.writeFile(path.join(ledgerDir, 'HEAD.json'), JSON.stringify({ fake: true }), 'utf8');
  recovered = await Ledger.recoverLedger(ledgerDir, ledgerPolicy);
  assert(recovered.entries.length === 2 && recovered.authoritative_state.state_id === heartbeatReceipt.resulting_state.state_id,
    'temporary/cache file changed authoritative ledger head');

  const vectors = [];
  vectors.push(await reject('previous_digest_substitution', async () => {
    const changed = clone(heartbeatEntry);
    changed.previous_entry_binding.digest.value = '0'.repeat(64);
    await Ledger.validateLedgerEntry({ changed, entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /previous entry digest mismatch/));

  vectors.push(await reject('sequence_gap', async () => {
    const changed = clone(heartbeatEntry); changed.sequence = 4;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /sequence gap or duplicate/));

  vectors.push(await reject('state_digest_substitution', async () => {
    const changed = clone(heartbeatEntry); changed.responsibility_state_binding.digest.value = '0'.repeat(64);
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /state digest substitution/));

  vectors.push(await reject('receipt_digest_substitution', async () => {
    const changed = clone(heartbeatEntry); changed.transition_receipt_binding.digest.value = '0'.repeat(64);
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /transition receipt digest substitution/));

  vectors.push(await reject('embedded_state_receipt_mismatch', async () => {
    const changed = clone(heartbeatEntry); changed.responsibility_state.state_id = 'urn:uu-aap:kontur:responsibility-state:substituted';
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /embedded state differs/));

  vectors.push(await reject('wrong_server_identity', async () => {
    const changed = clone(heartbeatEntry); changed.server_instance_id = 'urn:uu-aap:kontur:server:other';
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /system\/server identity mismatch/));

  vectors.push(await reject('ledger_policy_substitution', async () => {
    const changed = clone(heartbeatEntry); changed.ledger_policy.policy_version += 1;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /embedded ledger policy drift/));

  vectors.push(await reject('responsibility_policy_substitution', async () => {
    const changed = clone(heartbeatEntry); changed.responsibility_policy.policy_version += 1;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /Responsibility Policy binding substitution|policy binding substitution/));

  vectors.push(await reject('fencing_epoch_regression', async () => {
    const changed = clone(heartbeatEntry); changed.responsibility_state.fencing_epoch = 0;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /embedded state differs|state digest substitution|fencing epoch regression/));

  vectors.push(await reject('holder_drift', async () => {
    const changed = clone(heartbeatEntry); changed.responsibility_state.holder_id = 'urn:uu-aap:kontur:holder:other';
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /embedded state differs|holder substitution/));

  vectors.push(await reject('scope_drift', async () => {
    const changed = clone(heartbeatEntry); changed.responsibility_state.responsibility_scopes = ['server.readiness.consume'];
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /embedded state differs|scope substitution/));

  vectors.push(await reject('scalar_score_injection', async () => {
    const changed = clone(heartbeatEntry); changed.responsibility_score = 1;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /scalar score/));

  vectors.push(await reject('legal_overclaim', async () => {
    const changed = clone(heartbeatEntry); changed.claims.legal_responsibility_determined = true;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /prohibited claim legal_responsibility_determined/));

  vectors.push(await reject('truth_overclaim', async () => {
    const changed = clone(heartbeatEntry); changed.claims.truth_certified = true;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /prohibited claim truth_certified/));

  vectors.push(await reject('distributed_consensus_overclaim', async () => {
    const changed = clone(heartbeatEntry); changed.claims.distributed_consensus_established = true;
    await Ledger.validateLedgerEntry({ entry: changed, ledgerPolicy, previousEntry: activationEntry, consumedNonces: new Set([intent.human_intent.nonce]) });
  }, /prohibited claim distributed_consensus_established/));

  // Build a valid generation-3 heartbeat but try to reuse the original activation nonce.
  const replayAt = iso(Date.parse(heartbeatAt) + 2000);
  const replayTrigger = {
    artifact_type: 'KONTURTestTrigger', artifact_version: '0.1-test-only',
    observation_id: 'urn:uu-aap:kontur:test-trigger:heartbeat:replay', observed_at: replayAt
  };
  const generation3Receipt = await Kernel.transitionResponsibility({
    policy: responsibilityPolicy, readinessSignal: null, predecessorState: heartbeatReceipt.resulting_state,
    transitionKind: 'heartbeat', evaluatedAt: replayAt, holderId: preflight.holder_id,
    responsibilityScopes: preflight.responsibility_scopes, fencingEpoch: preflight.fencing_epoch,
    lease: preflight.lease, health, triggerRef: replayTrigger.observation_id, parallelActiveHolders: []
  });
  const replayEntry = await Ledger.buildLedgerEntry({
    ledgerPolicy, responsibilityPolicy, transitionReceipt: generation3Receipt,
    previousEntry: heartbeatEntry, triggerArtifact: replayTrigger,
    commandNonce: intent.human_intent.nonce, committedAt: iso(Date.parse(replayAt) + 1000)
  });
  vectors.push(await reject('command_nonce_replay', () => Ledger.commitLedgerEntry(ledgerDir, replayEntry, ledgerPolicy), /command nonce replay/));

  // A held writer lock blocks any writer instead of guessing that a lock is stale.
  await fsp.writeFile(path.join(ledgerDir, '.writer.lock'), 'held\n', 'utf8');
  vectors.push(await reject('parallel_writer_lock', () => Ledger.commitLedgerEntry(ledgerDir, replayEntry, ledgerPolicy), /writer lock already held/));
  await fsp.unlink(path.join(ledgerDir, '.writer.lock'));

  // Corruption tests use isolated copies so the canonical test ledger remains recoverable.
  const malformedDir = path.join(outputDir, 'ledger-malformed');
  await copyDir(ledgerDir, malformedDir);
  await fsp.writeFile(path.join(malformedDir, 'entries', `000000000003-${'a'.repeat(64)}.json`), '{', 'utf8');
  vectors.push(await reject('malformed_committed_entry', () => Ledger.recoverLedger(malformedDir, ledgerPolicy), /malformed committed entry/));

  const corruptDir = path.join(outputDir, 'ledger-corrupt');
  await copyDir(ledgerDir, corruptDir);
  const corruptFile = await firstEntryFile(corruptDir);
  const corrupt = JSON.parse(await fsp.readFile(corruptFile, 'utf8'));
  corrupt.entry_id = 'urn:uu-aap:kontur:responsibility-ledger-entry:corrupted';
  await fsp.writeFile(corruptFile, `${JSON.stringify(corrupt, null, 2)}\n`, 'utf8');
  vectors.push(await reject('corrupted_committed_bytes', () => Ledger.recoverLedger(corruptDir, ledgerPolicy), /filename\/digest mismatch|entry digest mismatch/));

  const duplicateDir = path.join(outputDir, 'ledger-duplicate-sequence');
  await copyDir(ledgerDir, duplicateDir);
  const duplicate = clone(heartbeatEntry);
  duplicate.entry_id = 'urn:uu-aap:kontur:responsibility-ledger-entry:duplicate-sequence';
  duplicate.entry_digest = await Ledger.expectedEntryDigest(duplicate);
  await fsp.writeFile(path.join(duplicateDir, 'entries', Ledger.entryFilename(duplicate)), `${JSON.stringify(duplicate, null, 2)}\n`, 'utf8');
  vectors.push(await reject('duplicate_committed_sequence', () => Ledger.recoverLedger(duplicateDir, ledgerPolicy), /sequence gap or duplicate|non-contiguous recovered sequence/));

  // Commit a terminal retirement as generation 3.
  const retireAt = iso(Date.parse(heartbeatAt) + 3000);
  const retireTrigger = {
    artifact_type: 'KONTURTestTrigger', artifact_version: '0.1-test-only',
    observation_id: 'urn:uu-aap:kontur:test-trigger:retire:1', observed_at: retireAt
  };
  const retireReceipt = await Kernel.transitionResponsibility({
    policy: responsibilityPolicy, readinessSignal: null, predecessorState: heartbeatReceipt.resulting_state,
    transitionKind: 'retire', evaluatedAt: retireAt, holderId: preflight.holder_id,
    responsibilityScopes: preflight.responsibility_scopes, fencingEpoch: preflight.fencing_epoch,
    lease: preflight.lease, health, triggerRef: retireTrigger.observation_id, parallelActiveHolders: []
  });
  const retireEntry = await Ledger.buildLedgerEntry({
    ledgerPolicy, responsibilityPolicy, transitionReceipt: retireReceipt,
    previousEntry: heartbeatEntry, triggerArtifact: retireTrigger,
    committedAt: iso(Date.parse(retireAt) + 1000)
  });
  recovered = await Ledger.commitLedgerEntry(ledgerDir, retireEntry, ledgerPolicy);
  assert(recovered.entries.length === 3 && recovered.terminal === true,
    'retired ledger head must be terminal');

  vectors.push(await reject('successor_after_retired', async () => {
    await Kernel.transitionResponsibility({
      policy: responsibilityPolicy, readinessSignal: null, predecessorState: retireReceipt.resulting_state,
      transitionKind: 'heartbeat', evaluatedAt: iso(Date.parse(retireAt) + 2000), holderId: preflight.holder_id,
      responsibilityScopes: preflight.responsibility_scopes, fencingEpoch: preflight.fencing_epoch,
      lease: preflight.lease, health, triggerRef: 'urn:uu-aap:kontur:test-trigger:after-retired', parallelActiveHolders: []
    });
  }, /retired state is terminal/));

  const finalRestart = JSON.parse(run('node', [
    'server/kontur/v0.1/recover-responsibility-ledger.js', ledgerDir,
    path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-ledger-policy.json')
  ]));
  assert(finalRestart.entry_count === 3 && finalRestart.terminal === true,
    'final restart recovery lost terminal ledger state');

  const summary = {
    suite: 'KONTUR Durable Responsibility Ledger v0.1',
    test_only_activation: true,
    live_kontur_activated: false,
    ledger_id: ledgerPolicy.ledger_id,
    entry_count: recovered.entries.length,
    authoritative_state_id: recovered.authoritative_state.state_id,
    lifecycle_state: recovered.authoritative_state.lifecycle_state,
    fencing_epoch: recovered.fencing_epoch,
    consumed_nonce_count: recovered.consumed_nonces.length,
    restart_recovery_verified: true,
    temp_file_non_authoritative_verified: true,
    mutable_head_non_authoritative_verified: true,
    negative_vectors: vectors.length,
    distributed_consensus_established: false,
    legal_responsibility_determined: false,
    truth_certified: false
  };
  await fsp.writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
