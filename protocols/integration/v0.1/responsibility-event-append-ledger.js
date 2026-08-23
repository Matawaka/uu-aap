'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const { digestJson, validateResponsibilityEventChain } = require('./build-responsibility-event-chain.js');
const { validateResponsibilityEventChainReobservationReceipt } = require('./observe-responsibility-event-chain.js');
const { validateResponsibilityEventAppendReceipt } = require('./append-responsibility-event.js');

const SCALAR_KEYS = new Set([
  'score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score',
  'causal_score', 'responsibility_score', 'blame_score', 'rating'
]);
const FALSE_CLAIMS = [
  'distributed_consensus_established', 'global_replay_protection_established',
  'new_external_consequence_observed', 'causal_proof_certified',
  'responsibility_for_outcome_adjudicated', 'legal_liability_established',
  'moral_blame_assigned', 'truth_certified', 'universal_canonicality_established',
  'poai_materialization_event_recorded'
];

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalEqual(left, right) {
  try { return Binding.canonicalize(left, '$left') === Binding.canonicalize(right, '$right'); }
  catch (_) { return false; }
}
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `ResponsibilityEventAppendLedger: invalid ${label}`);
  return ms;
}
function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
function sameBinding(left, right) {
  return !!left && !!right && left.artifact_type === right.artifact_type &&
    left.artifact_ref === right.artifact_ref && left.digest && right.digest &&
    left.digest.value === right.digest.value;
}
function sameHead(left, right) {
  return !!left && !!right && left.sequence === right.sequence && left.event_id === right.event_id &&
    left.event_digest && right.event_digest && left.event_digest.value === right.event_digest.value;
}
function assertFalseClaims(claims, label) {
  for (const key of FALSE_CLAIMS) {
    assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
  }
}

function assertLedgerPolicy(policy) {
  assert(policy && policy.artifact_type === 'ResponsibilityEventAppendLedgerPolicy' && policy.artifact_version === '0.1',
    'ResponsibilityEventAppendLedger: policy v0.1 required');
  assert(policy.policy_id === 'urn:uu-aap:responsibility-event-append-ledger-policy:local-filesystem:1',
    'ResponsibilityEventAppendLedger: policy ID substitution');
  assert(policy.policy_version === 1,
    'ResponsibilityEventAppendLedger: policy version substitution');
  assert(policy.ledger_id === 'urn:uu-aap:responsibility-event-append-ledger:reference-local-v0.1',
    'ResponsibilityEventAppendLedger: ledger ID substitution');
  assert(policy.storage_scope === 'local_filesystem_append_ledger' && policy.storage_model === 'immutable_entry_files',
    'ResponsibilityEventAppendLedger: storage boundary weakened');
  assert(policy.atomic_publication === 'temp_fsync_rename_dir_fsync' &&
    policy.head_authority === 'validated_entry_chain_replay' &&
    policy.replay_scope === 'ledger_local_history' && policy.corruption_mode === 'fail_closed',
    'ResponsibilityEventAppendLedger: durability/replay policy weakened');
  const i = policy.invariants || {};
  for (const key of [
    'writer_lock_required', 'atomic_publication_required', 'file_fsync_required',
    'entries_directory_fsync_required', 'immutable_committed_entries', 'contiguous_sequence_required',
    'predecessor_entry_digest_required', 'predecessor_event_head_required',
    'duplicate_append_receipt_rejected', 'duplicate_event_identity_rejected',
    'stale_head_fork_rejected', 'recovery_validation_required'
  ]) assert(i[key] === true, `ResponsibilityEventAppendLedger: required invariant ${key} missing`);
  assert(i.mutable_head_authoritative === false && i.temporary_file_authoritative === false &&
    i.scalar_responsibility_score_allowed === false,
    'ResponsibilityEventAppendLedger: forbidden policy capability enabled');
  assert(policy.claims && policy.claims.ledger_local_durable_replay_policy_defined === true,
    'ResponsibilityEventAppendLedger: positive policy claim missing');
  assertFalseClaims(policy.claims, 'ResponsibilityEventAppendLedgerPolicy');
}

async function policyBinding(policy) {
  return binding('ResponsibilityEventAppendLedgerPolicy', policy.policy_id, policy);
}
async function chainBinding(chain) {
  return binding('ResponsibilityEventChain', chain.chain_id, chain);
}
async function appendBinding(receipt) {
  return binding('ResponsibilityEventAppendReceipt', receipt.append_receipt_id, receipt);
}
async function entryBinding(entry) {
  return binding('ResponsibilityEventAppendLedgerEntry', entry.entry_id, entry);
}

function sourceArgs(bundle) {
  const s = bundle.origin_sources;
  return {
    outcomeObservation: s.outcome_observation,
    responsibilityTrace: s.responsibility_trace,
    causalAssessment: s.causal_assessment,
    counterfactualAssessment: s.counterfactual_assessment,
    causalQualification: s.causal_qualification,
    responsibilityAttribution: s.responsibility_attribution
  };
}

async function validateValidationBundle(bundle) {
  assert(bundle && typeof bundle === 'object', 'ResponsibilityEventAppendLedger: validation bundle required');
  const baseChain = bundle.base_chain;
  const reobservation = bundle.reobservation;
  const appendReceipt = bundle.append_receipt;
  const sources = sourceArgs(bundle);
  await validateResponsibilityEventChain({ chain: baseChain, ...sources });
  await validateResponsibilityEventChainReobservationReceipt({
    receipt: reobservation, chain: baseChain, ...sources
  });
  await validateResponsibilityEventAppendReceipt({
    receipt: appendReceipt, baseChain, reobservation, ...sources
  });
  assert(baseChain.events.length === 6 && baseChain.head.sequence === 5,
    'ResponsibilityEventAppendLedger: v0.1 frozen base chain boundary changed');
  assert(appendReceipt.appended_event.sequence === 6 && appendReceipt.extended_head.sequence === 6,
    'ResponsibilityEventAppendLedger: v0.1 accepts only first successor append receipt');
  assert(appendReceipt.claims.new_external_consequence_observed === false,
    'ResponsibilityEventAppendLedger: fictional external consequence cannot enter v0.1 ledger');
  return { baseChain, reobservation, appendReceipt };
}

function entryBody(entry) {
  const body = clone(entry);
  delete body.entry_digest;
  return body;
}
async function expectedEntryDigest(entry) { return digest(await digestJson(entryBody(entry))); }
function entryFilename(entry) {
  return `${String(entry.sequence).padStart(12, '0')}-${entry.entry_digest.value}.json`;
}

async function validateLedgerEntry({
  entry, ledgerPolicy, previousEntry = null,
  acceptedAppendIds = new Set(), acceptedEventIds = new Set(), acceptedEventDigests = new Set()
}) {
  assertLedgerPolicy(ledgerPolicy);
  assert(entry && entry.artifact_type === 'ResponsibilityEventAppendLedgerEntry' && entry.artifact_version === '0.1',
    'ResponsibilityEventAppendLedger: invalid ledger entry');
  assert(!hasScalarKey(entry), 'ResponsibilityEventAppendLedger: scalar score/probability fields prohibited');
  assert(entry.ledger_id === ledgerPolicy.ledger_id,
    'ResponsibilityEventAppendLedger: entry ledger ID mismatch');
  parseTime(entry.committed_at, 'committed_at');
  assertFalseClaims(entry.claims, 'ResponsibilityEventAppendLedgerEntry');
  assert(entry.claims.local_durable_commit_established === true &&
    entry.claims.authoritative_successor_head_derivable === true &&
    entry.claims.embedded_historical_evidence_bound === true &&
    entry.claims.ledger_local_durable_replay_protection_established === true &&
    entry.claims.accepted_append_identity_set_recoverable === true,
    'ResponsibilityEventAppendLedger: positive entry claims incomplete');

  assert(canonicalEqual(entry.ledger_policy, ledgerPolicy),
    'ResponsibilityEventAppendLedger: embedded policy substitution');
  const expectedPolicyBinding = await policyBinding(ledgerPolicy);
  assert(sameBinding(entry.ledger_policy_binding, expectedPolicyBinding),
    'ResponsibilityEventAppendLedger: policy binding substitution');

  const { baseChain, appendReceipt } = await validateValidationBundle(entry.validation_bundle);
  const expectedBaseBinding = await chainBinding(baseChain);
  const expectedAppendBinding = await appendBinding(appendReceipt);
  assert(sameBinding(entry.base_chain_binding, expectedBaseBinding),
    'ResponsibilityEventAppendLedger: base chain binding substitution');
  assert(sameBinding(entry.append_receipt_binding, expectedAppendBinding),
    'ResponsibilityEventAppendLedger: append receipt binding substitution');
  assert(sameHead(entry.predecessor_event_head, appendReceipt.base_head),
    'ResponsibilityEventAppendLedger: predecessor event head substitution');
  assert(sameHead(entry.resulting_event_head, appendReceipt.extended_head),
    'ResponsibilityEventAppendLedger: resulting event head substitution');
  assert(parseTime(entry.committed_at, 'committed_at') > parseTime(appendReceipt.appended_at, 'append receipt appended_at'),
    'ResponsibilityEventAppendLedger: commit must occur after append receipt');

  assert(!acceptedAppendIds.has(appendReceipt.append_receipt_id),
    'ResponsibilityEventAppendLedger: duplicate append receipt replay detected');
  assert(!acceptedEventIds.has(appendReceipt.appended_event.event_id),
    'ResponsibilityEventAppendLedger: duplicate appended event ID replay detected');
  assert(!acceptedEventDigests.has(appendReceipt.appended_event.event_digest.value),
    'ResponsibilityEventAppendLedger: duplicate appended event digest replay detected');

  if (previousEntry === null) {
    assert(entry.sequence === 0, 'ResponsibilityEventAppendLedger: genesis ledger sequence must be 0');
    assert(entry.previous_entry_binding === null,
      'ResponsibilityEventAppendLedger: genesis previous entry must be null');
    assert(sameHead(entry.predecessor_event_head, baseChain.head),
      'ResponsibilityEventAppendLedger: genesis append must extend frozen base head');
  } else {
    assert(entry.sequence === previousEntry.sequence + 1,
      'ResponsibilityEventAppendLedger: ledger sequence gap or duplicate');
    const expectedPrevious = await entryBinding(previousEntry);
    assert(sameBinding(entry.previous_entry_binding, expectedPrevious),
      'ResponsibilityEventAppendLedger: previous entry digest substitution');
    assert(sameHead(entry.predecessor_event_head, previousEntry.resulting_event_head),
      'ResponsibilityEventAppendLedger: stale-head/forked append rejected');
    assert(entry.ledger_policy_binding.digest.value === previousEntry.ledger_policy_binding.digest.value,
      'ResponsibilityEventAppendLedger: policy migration requires typed successor protocol');
    assert(entry.base_chain_binding.digest.value === previousEntry.base_chain_binding.digest.value,
      'ResponsibilityEventAppendLedger: base chain substitution across ledger history');
    assert(parseTime(entry.committed_at, 'committed_at') >= parseTime(previousEntry.committed_at, 'previous committed_at'),
      'ResponsibilityEventAppendLedger: commit time regression');
  }

  const expectedDigest = await expectedEntryDigest(entry);
  assert(entry.entry_digest && entry.entry_digest.value === expectedDigest.value,
    'ResponsibilityEventAppendLedger: ledger entry digest mismatch');
  return true;
}

async function buildLedgerEntry({ ledgerPolicy, validationBundle, previousEntry = null, committedAt }) {
  assertLedgerPolicy(ledgerPolicy);
  parseTime(committedAt, 'committed_at');
  const validated = await validateValidationBundle(validationBundle);
  const sequence = previousEntry ? previousEntry.sequence + 1 : 0;
  const previousBinding = previousEntry ? await entryBinding(previousEntry) : null;
  const baseBindingValue = await chainBinding(validated.baseChain);
  const appendBindingValue = await appendBinding(validated.appendReceipt);
  const policyBindingValue = await policyBinding(ledgerPolicy);
  const seed = `${ledgerPolicy.ledger_id}|${sequence}|${previousBinding ? previousBinding.digest.value : 'genesis'}|${appendBindingValue.digest.value}|${committedAt}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  const entry = {
    $schema: './responsibility-event-append-ledger-entry.schema.json',
    artifact_type: 'ResponsibilityEventAppendLedgerEntry',
    artifact_version: '0.1',
    entry_id: `urn:uu-aap:responsibility-event-append-ledger-entry:${idHash.slice(0, 24)}`,
    ledger_id: ledgerPolicy.ledger_id,
    sequence,
    committed_at: committedAt,
    previous_entry_binding: previousBinding,
    ledger_policy: clone(ledgerPolicy),
    ledger_policy_binding: policyBindingValue,
    validation_bundle: clone(validationBundle),
    base_chain_binding: baseBindingValue,
    append_receipt_binding: appendBindingValue,
    predecessor_event_head: clone(validated.appendReceipt.base_head),
    resulting_event_head: clone(validated.appendReceipt.extended_head),
    claims: {
      local_durable_commit_established: true,
      authoritative_successor_head_derivable: true,
      embedded_historical_evidence_bound: true,
      ledger_local_durable_replay_protection_established: true,
      accepted_append_identity_set_recoverable: true,
      distributed_consensus_established: false,
      global_replay_protection_established: false,
      new_external_consequence_observed: false,
      causal_proof_certified: false,
      responsibility_for_outcome_adjudicated: false,
      legal_liability_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      universal_canonicality_established: false,
      poai_materialization_event_recorded: false
    }
  };
  entry.entry_digest = await expectedEntryDigest(entry);
  await validateLedgerEntry({ entry, ledgerPolicy, previousEntry });
  return entry;
}

async function ensureLedgerDirectories(rootDir) {
  await fsp.mkdir(rootDir, { recursive: true });
  await fsp.mkdir(path.join(rootDir, 'entries'), { recursive: true });
  await fsp.mkdir(path.join(rootDir, 'tmp'), { recursive: true });
}
async function fsyncDirectory(dirPath) {
  const handle = await fsp.open(dirPath, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}

async function recoverLedger(rootDir, ledgerPolicy) {
  assertLedgerPolicy(ledgerPolicy);
  await ensureLedgerDirectories(rootDir);
  const entriesDir = path.join(rootDir, 'entries');
  const names = (await fsp.readdir(entriesDir)).sort();
  for (const name of names) {
    assert(/^\d{12}-[0-9a-f]{64}\.json$/.test(name),
      `ResponsibilityEventAppendLedger: invalid committed entry filename ${name}`);
  }
  const entries = [];
  const acceptedAppendIds = new Set();
  const acceptedEventIds = new Set();
  const acceptedEventDigests = new Set();
  let previousEntry = null;
  for (const name of names) {
    let entry;
    try { entry = JSON.parse(await fsp.readFile(path.join(entriesDir, name), 'utf8')); }
    catch (error) { throw new Error(`ResponsibilityEventAppendLedger: malformed committed entry ${name}: ${error.message}`); }
    assert(name === entryFilename(entry),
      `ResponsibilityEventAppendLedger: committed filename/digest mismatch ${name}`);
    await validateLedgerEntry({
      entry, ledgerPolicy, previousEntry, acceptedAppendIds, acceptedEventIds, acceptedEventDigests
    });
    assert(entry.sequence === entries.length,
      'ResponsibilityEventAppendLedger: non-contiguous recovered sequence');
    entries.push(entry);
    const receipt = entry.validation_bundle.append_receipt;
    acceptedAppendIds.add(receipt.append_receipt_id);
    acceptedEventIds.add(receipt.appended_event.event_id);
    acceptedEventDigests.add(receipt.appended_event.event_digest.value);
    previousEntry = entry;
  }
  const headEntry = entries.length ? entries[entries.length - 1] : null;
  return {
    ledger_id: ledgerPolicy.ledger_id,
    entries,
    head_entry: headEntry,
    authoritative_successor_head: headEntry ? clone(headEntry.resulting_event_head) : null,
    accepted_append_receipt_ids: [...acceptedAppendIds].sort(),
    accepted_event_ids: [...acceptedEventIds].sort(),
    accepted_event_digests: [...acceptedEventDigests].sort(),
    claims: {
      authoritative_successor_head_recovered: !!headEntry,
      ledger_local_durable_replay_protection_established: true,
      accepted_append_identity_set_recovered: true,
      global_replay_protection_established: false,
      distributed_consensus_established: false
    }
  };
}

async function withWriterLock(rootDir, fn) {
  await ensureLedgerDirectories(rootDir);
  const lockPath = path.join(rootDir, '.writer.lock');
  let handle;
  try { handle = await fsp.open(lockPath, 'wx', 0o600); }
  catch (error) {
    if (error && error.code === 'EEXIST') throw new Error('ResponsibilityEventAppendLedger: writer lock already held; fail closed');
    throw error;
  }
  try {
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() })}\n`, 'utf8');
    await handle.sync();
    return await fn();
  } finally {
    try { await handle.close(); } catch (_) {}
    try { await fsp.unlink(lockPath); } catch (_) {}
    try { await fsyncDirectory(rootDir); } catch (_) {}
  }
}

async function commitLedgerEntry(rootDir, entry, ledgerPolicy) {
  return withWriterLock(rootDir, async () => {
    const recovered = await recoverLedger(rootDir, ledgerPolicy);
    const previousEntry = recovered.head_entry;
    await validateLedgerEntry({
      entry, ledgerPolicy, previousEntry,
      acceptedAppendIds: new Set(recovered.accepted_append_receipt_ids),
      acceptedEventIds: new Set(recovered.accepted_event_ids),
      acceptedEventDigests: new Set(recovered.accepted_event_digests)
    });
    const entriesDir = path.join(rootDir, 'entries');
    const tmpDir = path.join(rootDir, 'tmp');
    const name = entryFilename(entry);
    const prefix = `${String(entry.sequence).padStart(12, '0')}-`;
    const existing = await fsp.readdir(entriesDir);
    assert(!existing.some((candidate) => candidate.startsWith(prefix)),
      'ResponsibilityEventAppendLedger: duplicate committed ledger sequence');
    const finalPath = path.join(entriesDir, name);
    const tempPath = path.join(tmpDir, `${name}.${process.pid}.${Date.now()}.tmp`);
    let handle = null;
    try {
      handle = await fsp.open(tempPath, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(entry, null, 2)}\n`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fsp.rename(tempPath, finalPath);
      await fsyncDirectory(entriesDir);
    } catch (error) {
      if (handle) { try { await handle.close(); } catch (_) {} }
      try { await fsp.unlink(tempPath); } catch (_) {}
      throw error;
    }
    const after = await recoverLedger(rootDir, ledgerPolicy);
    assert(after.head_entry && after.head_entry.entry_digest.value === entry.entry_digest.value,
      'ResponsibilityEventAppendLedger: recovered durable head does not match committed entry');
    return after;
  });
}

async function buildAndCommitLedgerEntry(rootDir, args) {
  const recovered = await recoverLedger(rootDir, args.ledgerPolicy);
  const entry = await buildLedgerEntry({ ...args, previousEntry: recovered.head_entry });
  return commitLedgerEntry(rootDir, entry, args.ledgerPolicy);
}

module.exports = {
  assertLedgerPolicy,
  policyBinding,
  chainBinding,
  appendBinding,
  entryBinding,
  entryFilename,
  expectedEntryDigest,
  validateValidationBundle,
  validateLedgerEntry,
  buildLedgerEntry,
  recoverLedger,
  commitLedgerEntry,
  buildAndCommitLedgerEntry
};
