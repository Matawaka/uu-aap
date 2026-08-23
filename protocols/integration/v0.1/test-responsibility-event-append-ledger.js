'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const Ledger = require('./responsibility-event-append-ledger.js');

const repoRoot = path.resolve(__dirname, '../../..');
const assert = (v, m) => { if (!v) throw new Error(m); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);

function runAppend() {
  const run = cp.spawnSync('node', [
    'protocols/integration/v0.1/test-responsibility-event-append.js',
    '/tmp/append-ledger-append.json', '/tmp/append-ledger-reobservation.json'
  ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) throw run.error;
  assert(run.status === 0, `append prerequisite failed\n${run.stdout || ''}\n${run.stderr || ''}`);
}
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}
function copyLedger(source) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-aap-append-ledger-copy-'));
  fs.cpSync(source, target, { recursive: true });
  return target;
}
function committedEntryPath(rootDir) {
  const names = fs.readdirSync(path.join(rootDir, 'entries'));
  assert(names.length === 1, 'expected one committed entry');
  return path.join(rootDir, 'entries', names[0]);
}

async function main() {
  runAppend();
  const policyPath = path.join(repoRoot, 'protocols/integration/v0.1/policies/reference.responsibility-event-append-ledger-policy.json');
  const policy = readJson(policyPath);
  const validationBundle = {
    base_chain: readJson('/tmp/append-base-chain.json'),
    origin_sources: {
      outcome_observation: readJson('/tmp/causal-outcome-observation.json'),
      responsibility_trace: readJson('/tmp/causal-responsibility-trace.json'),
      causal_assessment: readJson('/tmp/counterfactual-causal-attribution.json'),
      counterfactual_assessment: readJson('/tmp/qualification-counterfactual.json'),
      causal_qualification: readJson('/tmp/responsibility-attribution-qualification.json'),
      responsibility_attribution: readJson('/tmp/event-chain-attribution.json')
    },
    reobservation: readJson('/tmp/append-ledger-reobservation.json'),
    append_receipt: readJson('/tmp/append-ledger-append.json')
  };
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-aap-append-ledger-'));
  const committedAt = '2026-08-23T08:43:02Z';
  const entry = await Ledger.buildLedgerEntry({ ledgerPolicy: policy, validationBundle, committedAt });
  const after = await Ledger.commitLedgerEntry(rootDir, entry, policy);

  assert(after.entries.length === 1, 'ledger must recover one committed entry');
  assert(after.authoritative_successor_head.sequence === 6, 'authoritative successor head must be sequence 6');
  assert(after.authoritative_successor_head.event_id === validationBundle.append_receipt.extended_head.event_id,
    'authoritative successor event ID mismatch');
  assert(after.accepted_append_receipt_ids.length === 1 &&
    after.accepted_append_receipt_ids[0] === validationBundle.append_receipt.append_receipt_id,
    'accepted append identity set mismatch');
  assert(after.claims.ledger_local_durable_replay_protection_established === true,
    'ledger-local durable replay protection must be established');
  assert(after.claims.global_replay_protection_established === false &&
    after.claims.distributed_consensus_established === false,
    'ledger must not overclaim global/distributed replay semantics');

  writeJson('/tmp/responsibility-event-append-ledger-entry.json', entry);
  const recoveryPath = '/tmp/responsibility-event-append-ledger-recovery.json';
  const recoveryRun = cp.spawnSync('node', [
    'protocols/integration/v0.1/recover-responsibility-event-append-ledger.js',
    rootDir, policyPath, recoveryPath
  ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (recoveryRun.error) throw recoveryRun.error;
  assert(recoveryRun.status === 0, `separate-process recovery failed\n${recoveryRun.stdout || ''}\n${recoveryRun.stderr || ''}`);
  const restarted = readJson(recoveryPath);
  assert(restarted.entries.length === 1 && restarted.authoritative_successor_head.sequence === 6,
    'separate process did not recover authoritative successor head');
  assert(restarted.head_entry.entry_digest.value === entry.entry_digest.value,
    'separate process recovered different entry digest');

  writeJson(path.join(rootDir, 'HEAD.json'), { sequence: 999, event_id: 'forged' });
  writeJson(path.join(rootDir, 'tmp', '000000000999-forged.tmp'), { forged: true });
  const ignoresMutableFiles = await Ledger.recoverLedger(rootDir, policy);
  assert(ignoresMutableFiles.authoritative_successor_head.sequence === 6,
    'mutable HEAD/tmp artifacts must not become authoritative');

  const vectors = [];
  const validateEntry = (candidate, overrides = {}) => Ledger.validateLedgerEntry({
    entry: candidate,
    ledgerPolicy: overrides.policy || policy,
    previousEntry: overrides.previousEntry === undefined ? null : overrides.previousEntry,
    acceptedAppendIds: overrides.acceptedAppendIds || new Set(),
    acceptedEventIds: overrides.acceptedEventIds || new Set(),
    acceptedEventDigests: overrides.acceptedEventDigests || new Set()
  });

  vectors.push(await reject('policy_id_substitution', async () => {
    const changed = clone(policy); changed.policy_id = 'urn:uu-aap:responsibility-event-append-ledger-policy:other:1';
    await Ledger.recoverLedger(rootDir, changed);
  }, /policy ID substitution/));
  vectors.push(await reject('policy_global_replay_overclaim', async () => {
    const changed = clone(policy); changed.claims.global_replay_protection_established = true;
    Ledger.assertLedgerPolicy(changed);
  }, /prohibited claim global_replay_protection_established/));
  vectors.push(await reject('entry_policy_binding_substitution', async () => {
    const changed = clone(entry); changed.ledger_policy_binding.digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /policy binding substitution/));
  vectors.push(await reject('entry_embedded_policy_substitution', async () => {
    const changed = clone(entry); changed.ledger_policy.policy_version = 2;
    await validateEntry(changed);
  }, /embedded policy substitution/));
  vectors.push(await reject('base_chain_binding_substitution', async () => {
    const changed = clone(entry); changed.base_chain_binding.digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /base chain binding substitution/));
  vectors.push(await reject('append_receipt_binding_substitution', async () => {
    const changed = clone(entry); changed.append_receipt_binding.digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /append receipt binding substitution/));
  vectors.push(await reject('embedded_base_chain_mutation', async () => {
    const changed = clone(entry); changed.validation_bundle.base_chain.head.event_digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /chain head substitution|event payload\/digest chain substitution/));
  vectors.push(await reject('embedded_append_receipt_mutation', async () => {
    const changed = clone(entry); changed.validation_bundle.append_receipt.extension_digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /extension digest substitution/));
  vectors.push(await reject('embedded_external_consequence_overclaim', async () => {
    const changed = clone(entry); changed.validation_bundle.append_receipt.claims.new_external_consequence_observed = true;
    await validateEntry(changed);
  }, /prohibited claim new_external_consequence_observed/));
  vectors.push(await reject('predecessor_event_head_substitution', async () => {
    const changed = clone(entry); changed.predecessor_event_head.event_digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /predecessor event head substitution/));
  vectors.push(await reject('resulting_event_head_substitution', async () => {
    const changed = clone(entry); changed.resulting_event_head.event_digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /resulting event head substitution/));
  vectors.push(await reject('genesis_sequence_skip', async () => {
    const changed = clone(entry); changed.sequence = 1;
    await validateEntry(changed);
  }, /genesis ledger sequence must be 0/));
  vectors.push(await reject('genesis_previous_entry_injection', async () => {
    const changed = clone(entry); changed.previous_entry_binding = await Ledger.entryBinding(entry);
    await validateEntry(changed);
  }, /genesis previous entry must be null/));
  vectors.push(await reject('commit_temporal_inversion', async () => {
    const changed = clone(entry); changed.committed_at = validationBundle.append_receipt.appended_at;
    await validateEntry(changed);
  }, /commit must occur after append receipt/));
  vectors.push(await reject('entry_digest_substitution', async () => {
    const changed = clone(entry); changed.entry_digest.value = '0'.repeat(64);
    await validateEntry(changed);
  }, /ledger entry digest mismatch/));
  vectors.push(await reject('entry_global_replay_overclaim', async () => {
    const changed = clone(entry); changed.claims.global_replay_protection_established = true;
    await validateEntry(changed);
  }, /prohibited claim global_replay_protection_established/));
  vectors.push(await reject('entry_legal_overclaim', async () => {
    const changed = clone(entry); changed.claims.legal_liability_established = true;
    await validateEntry(changed);
  }, /prohibited claim legal_liability_established/));
  vectors.push(await reject('entry_moral_overclaim', async () => {
    const changed = clone(entry); changed.claims.moral_blame_assigned = true;
    await validateEntry(changed);
  }, /prohibited claim moral_blame_assigned/));
  vectors.push(await reject('entry_truth_overclaim', async () => {
    const changed = clone(entry); changed.claims.truth_certified = true;
    await validateEntry(changed);
  }, /prohibited claim truth_certified/));
  vectors.push(await reject('scalar_probability_injection', async () => {
    const changed = clone(entry); changed.probability = 0.9;
    await validateEntry(changed);
  }, /scalar score\/probability fields prohibited/));
  vectors.push(await reject('scalar_responsibility_in_embedded_bundle', async () => {
    const changed = clone(entry); changed.validation_bundle.reobservation.responsibility_score = 1;
    await validateEntry(changed);
  }, /scalar score\/probability fields prohibited/));
  vectors.push(await reject('duplicate_append_receipt_replay', async () => {
    const changed = clone(entry);
    await validateEntry(changed, { acceptedAppendIds: new Set([validationBundle.append_receipt.append_receipt_id]) });
  }, /duplicate append receipt replay detected/));
  vectors.push(await reject('duplicate_event_id_replay', async () => {
    const changed = clone(entry);
    await validateEntry(changed, { acceptedEventIds: new Set([validationBundle.append_receipt.appended_event.event_id]) });
  }, /duplicate appended event ID replay detected/));
  vectors.push(await reject('duplicate_event_digest_replay', async () => {
    const changed = clone(entry);
    await validateEntry(changed, { acceptedEventDigests: new Set([validationBundle.append_receipt.appended_event.event_digest.value]) });
  }, /duplicate appended event digest replay detected/));
  vectors.push(await reject('stale_head_second_append', async () => {
    await Ledger.buildLedgerEntry({ ledgerPolicy: policy, validationBundle, previousEntry: entry, committedAt: '2026-08-23T08:43:03Z' });
  }, /stale-head\/forked append rejected/));
  vectors.push(await reject('writer_lock_conflict', async () => {
    const lockRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-aap-append-ledger-lock-'));
    fs.mkdirSync(path.join(lockRoot, 'entries'), { recursive: true });
    fs.mkdirSync(path.join(lockRoot, 'tmp'), { recursive: true });
    fs.writeFileSync(path.join(lockRoot, '.writer.lock'), 'held\n');
    await Ledger.commitLedgerEntry(lockRoot, entry, policy);
  }, /writer lock already held/));
  vectors.push(await reject('corrupted_committed_entry_json', async () => {
    const copy = copyLedger(rootDir); fs.writeFileSync(committedEntryPath(copy), '{bad');
    await Ledger.recoverLedger(copy, policy);
  }, /malformed committed entry/));
  vectors.push(await reject('committed_filename_digest_mismatch', async () => {
    const copy = copyLedger(rootDir); const oldPath = committedEntryPath(copy);
    const wrong = path.join(path.dirname(oldPath), `000000000000-${'0'.repeat(64)}.json`);
    fs.renameSync(oldPath, wrong); await Ledger.recoverLedger(copy, policy);
  }, /committed filename\/digest mismatch/));
  vectors.push(await reject('unknown_committed_filename', async () => {
    const copy = copyLedger(rootDir); fs.writeFileSync(path.join(copy, 'entries', 'HEAD.json'), '{}');
    await Ledger.recoverLedger(copy, policy);
  }, /invalid committed entry filename/));
  vectors.push(await reject('duplicate_committed_sequence', async () => {
    const copy = copyLedger(rootDir); const sourcePath = committedEntryPath(copy);
    const duplicate = clone(entry); duplicate.entry_id += ':duplicate'; duplicate.entry_digest = await Ledger.expectedEntryDigest(duplicate);
    writeJson(path.join(copy, 'entries', Ledger.entryFilename(duplicate)), duplicate);
    await Ledger.recoverLedger(copy, policy);
  }, /non-contiguous recovered sequence|duplicate append receipt replay detected|genesis ledger sequence must be 0/));

  console.log(JSON.stringify({
    suite: 'UU-AAP ResponsibilityEventAppendLedger v0.1',
    ledger_id: policy.ledger_id,
    entry_count: after.entries.length,
    authoritative_successor_head_sequence: after.authoritative_successor_head.sequence,
    authoritative_successor_event_id: after.authoritative_successor_head.event_id,
    accepted_append_receipt_count: after.accepted_append_receipt_ids.length,
    restart_recovery_verified: restarted.head_entry.entry_digest.value === entry.entry_digest.value,
    mutable_head_ignored: true,
    temporary_file_ignored: true,
    ledger_local_durable_replay_protection_established: after.claims.ledger_local_durable_replay_protection_established,
    global_replay_protection_established: after.claims.global_replay_protection_established,
    distributed_consensus_established: after.claims.distributed_consensus_established,
    new_external_consequence_observed: entry.claims.new_external_consequence_observed,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
