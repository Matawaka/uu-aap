'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Kernel = require('./responsibility-kernel.js');

const FALSE_CLAIMS = [
  'distributed_consensus_established',
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
  'readiness_score', 'responsibility_score', 'causal_score', 'rating', 'weight'
]);

function assert(value, message) {
  if (!value) throw new Error(message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Responsibility Ledger: invalid ${label}`);
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
  return {
    canonicalization: 'RFC8785-JCS',
    digest_algorithm: 'SHA-256',
    digest_encoding: 'hex',
    value
  };
}

async function binding(artifactType, artifactRef, artifact) {
  return {
    artifact_type: artifactType,
    artifact_ref: artifactRef,
    digest: digest(await digestJson(artifact))
  };
}

function sameBinding(left, right) {
  return !!left && !!right &&
    left.artifact_type === right.artifact_type &&
    left.artifact_ref === right.artifact_ref &&
    left.digest && right.digest && left.digest.value === right.digest.value;
}

function canonicalEqual(left, right) {
  try {
    return Binding.canonicalize(left, '$left') === Binding.canonicalize(right, '$right');
  } catch (_) {
    return false;
  }
}

function assertFalseClaims(claims, label) {
  for (const key of FALSE_CLAIMS) {
    if (claims && Object.prototype.hasOwnProperty.call(claims, key)) {
      assert(claims[key] === false, `${label}: prohibited claim ${key}`);
    }
  }
}

function assertLedgerPolicy(policy) {
  assert(policy && policy.artifact_type === 'KONTURResponsibilityLedgerPolicy' && policy.artifact_version === '0.1',
    'KONTUR Responsibility Ledger: KONTURResponsibilityLedgerPolicy v0.1 required');
  assert(typeof policy.policy_id === 'string' && policy.policy_id.startsWith('urn:uu-aap:kontur:responsibility-ledger-policy:'),
    'KONTUR Responsibility Ledger: invalid ledger policy ID');
  assert(Number.isInteger(policy.policy_version) && policy.policy_version >= 1,
    'KONTUR Responsibility Ledger: invalid ledger policy version');
  assert(typeof policy.ledger_id === 'string' && policy.ledger_id.startsWith('urn:uu-aap:kontur:responsibility-ledger:'),
    'KONTUR Responsibility Ledger: invalid ledger ID');
  assert(policy.storage_model === 'immutable_entry_files',
    'KONTUR Responsibility Ledger: storage model weakened');
  assert(policy.atomic_publication === 'temp_fsync_rename_dir_fsync',
    'KONTUR Responsibility Ledger: atomic publication weakened');
  assert(policy.head_authority === 'validated_entry_chain',
    'KONTUR Responsibility Ledger: mutable head cannot become authoritative');
  assert(policy.replay_scope === 'ledger_history',
    'KONTUR Responsibility Ledger: replay scope drift');
  assert(policy.corruption_mode === 'fail_closed',
    'KONTUR Responsibility Ledger: corruption mode must fail closed');
  assert(policy.claims && policy.claims.mutable_head_authoritative === false &&
    policy.claims.temporary_file_authoritative === false &&
    policy.claims.ledger_relative_replay_protection_defined === true,
    'KONTUR Responsibility Ledger: ledger assurance boundary invalid');
  assertFalseClaims(policy.claims, 'KONTURResponsibilityLedgerPolicy');
}

function artifactRef(artifact) {
  if (!artifact || typeof artifact !== 'object') return null;
  for (const key of ['entry_id', 'policy_id', 'signal_id', 'state_id', 'receipt_id', 'preflight_id', 'intent_id', 'frontier_id', 'observation_id']) {
    if (typeof artifact[key] === 'string' && artifact[key].length > 0) return artifact[key];
  }
  return null;
}

async function exactBinding(artifact, expectedType = null) {
  assert(artifact && typeof artifact === 'object', 'KONTUR Responsibility Ledger: artifact bytes required for binding');
  const type = expectedType || artifact.artifact_type;
  assert(typeof type === 'string' && type.length > 0, 'KONTUR Responsibility Ledger: artifact type required');
  const ref = artifactRef(artifact);
  assert(ref, `KONTUR Responsibility Ledger: artifact ref required for ${type}`);
  return binding(type, ref, artifact);
}

function entryBody(entry) {
  const body = clone(entry);
  delete body.entry_digest;
  return body;
}

async function expectedEntryDigest(entry) {
  return digest(await digestJson(entryBody(entry)));
}

function entryFilename(entry) {
  return `${String(entry.sequence).padStart(12, '0')}-${entry.entry_digest.value}.json`;
}

async function entryBinding(entry) {
  return binding('KONTURResponsibilityLedgerEntry', entry.entry_id, entry);
}

function validateActivationPreflightBoundary(preflight) {
  assert(preflight && preflight.artifact_type === 'KONTURActivationPreflightReceipt' && preflight.artifact_version === '0.1',
    'KONTUR Responsibility Ledger: valid activation preflight required for genesis activation');
  assert(preflight.decision === 'human_execute_step_may_proceed',
    'KONTUR Responsibility Ledger: activation preflight does not admit human execute step');
  assert(preflight.claims && preflight.claims.activation_intent_verified === true &&
    preflight.claims.activation_preconditions_revalidated === true &&
    preflight.claims.human_execute_step_may_proceed === true,
    'KONTUR Responsibility Ledger: activation preflight positive boundary missing');
  for (const key of ['kernel_activated', 'responsibility_state_created', 'responsibility_accepted', 'execution_authority_granted']) {
    assert(preflight.claims[key] === false, `KONTUR Responsibility Ledger: preflight overclaim ${key}`);
  }
  assertFalseClaims(preflight.claims, 'KONTURActivationPreflightReceipt');
}

async function validateLedgerEntry({ entry, ledgerPolicy, previousEntry = null, consumedNonces = new Set() }) {
  assertLedgerPolicy(ledgerPolicy);
  assert(entry && entry.artifact_type === 'KONTURResponsibilityLedgerEntry' && entry.artifact_version === '0.1',
    'KONTUR Responsibility Ledger: invalid ledger entry');
  assert(!hasScalarKey(entry), 'KONTUR Responsibility Ledger: scalar score/probability fields prohibited');
  assert(entry.ledger_id === ledgerPolicy.ledger_id,
    'KONTUR Responsibility Ledger: ledger ID mismatch');
  assert(entry.system_id === ledgerPolicy.system_id && entry.server_instance_id === ledgerPolicy.server_instance_id,
    'KONTUR Responsibility Ledger: system/server identity mismatch');
  assert(Number.isInteger(entry.sequence) && entry.sequence >= 1,
    'KONTUR Responsibility Ledger: invalid sequence');
  parseTime(entry.committed_at, 'committed_at');
  assertFalseClaims(entry.claims, 'KONTURResponsibilityLedgerEntry');
  assert(entry.claims && entry.claims.local_durable_commit_established === true &&
    entry.claims.authoritative_head_derivable === true &&
    entry.claims.embedded_historical_evidence_bound === true &&
    entry.claims.ledger_relative_replay_protection_applied === true,
    'KONTUR Responsibility Ledger: positive ledger claims missing');

  assert(canonicalEqual(entry.ledger_policy, ledgerPolicy),
    'KONTUR Responsibility Ledger: embedded ledger policy drift');
  const expectedLedgerPolicyBinding = await exactBinding(ledgerPolicy, 'KONTURResponsibilityLedgerPolicy');
  assert(sameBinding(entry.ledger_policy_binding, expectedLedgerPolicyBinding),
    'KONTUR Responsibility Ledger: ledger policy binding substitution');

  const responsibilityPolicy = entry.responsibility_policy;
  assert(responsibilityPolicy && responsibilityPolicy.artifact_type === 'KONTURResponsibilityPolicy' && responsibilityPolicy.artifact_version === '0.1',
    'KONTUR Responsibility Ledger: embedded Responsibility Policy required');
  assert(responsibilityPolicy.system_id === ledgerPolicy.system_id &&
    responsibilityPolicy.server_instance_id === ledgerPolicy.server_instance_id,
    'KONTUR Responsibility Ledger: Responsibility Policy identity mismatch');
  const expectedResponsibilityPolicyBinding = await exactBinding(responsibilityPolicy, 'KONTURResponsibilityPolicy');
  assert(sameBinding(entry.responsibility_policy_binding, expectedResponsibilityPolicyBinding),
    'KONTUR Responsibility Ledger: Responsibility Policy binding substitution');

  if (previousEntry === null) {
    assert(entry.sequence === 1, 'KONTUR Responsibility Ledger: genesis sequence must be 1');
    assert(entry.previous_entry_binding === null,
      'KONTUR Responsibility Ledger: genesis previous entry must be null');
    assert(entry.transition_kind === 'activate',
      'KONTUR Responsibility Ledger: genesis ledger entry must be activation');
  } else {
    assert(entry.sequence === previousEntry.sequence + 1,
      'KONTUR Responsibility Ledger: sequence gap or duplicate');
    const previousBinding = await entryBinding(previousEntry);
    assert(sameBinding(entry.previous_entry_binding, previousBinding),
      'KONTUR Responsibility Ledger: previous entry digest mismatch');
    assert(entry.ledger_policy_binding.digest.value === previousEntry.ledger_policy_binding.digest.value,
      'KONTUR Responsibility Ledger: ledger policy migration requires a typed successor protocol');
    assert(entry.responsibility_policy_binding.digest.value === previousEntry.responsibility_policy_binding.digest.value,
      'KONTUR Responsibility Ledger: Responsibility Policy migration requires a typed successor protocol');
    assert(parseTime(entry.committed_at, 'committed_at') >= parseTime(previousEntry.committed_at, 'previous committed_at'),
      'KONTUR Responsibility Ledger: commit time regression');
    assert(previousEntry.responsibility_state.lifecycle_state !== 'retired',
      'KONTUR Responsibility Ledger: retired state is terminal');
  }

  const state = entry.responsibility_state;
  const receipt = entry.transition_receipt;
  assert(state && state.artifact_type === 'KONTURResponsibilityState' && state.artifact_version === '0.1',
    'KONTUR Responsibility Ledger: embedded responsibility state required');
  assert(receipt && receipt.artifact_type === 'KONTURResponsibilityTransitionReceipt' && receipt.artifact_version === '0.1',
    'KONTUR Responsibility Ledger: embedded transition receipt required');
  assert(receipt.transition_kind === entry.transition_kind,
    'KONTUR Responsibility Ledger: transition kind mismatch');
  assert(canonicalEqual(state, receipt.resulting_state),
    'KONTUR Responsibility Ledger: embedded state differs from transition receipt state');
  assert(state.generation === entry.sequence,
    'KONTUR Responsibility Ledger: ledger sequence must match responsibility generation');

  const expectedStateBinding = await exactBinding(state, 'KONTURResponsibilityState');
  const expectedReceiptBinding = await exactBinding(receipt, 'KONTURResponsibilityTransitionReceipt');
  assert(sameBinding(entry.responsibility_state_binding, expectedStateBinding),
    'KONTUR Responsibility Ledger: responsibility state digest substitution');
  assert(sameBinding(entry.transition_receipt_binding, expectedReceiptBinding),
    'KONTUR Responsibility Ledger: transition receipt digest substitution');

  const readinessRequired = entry.transition_kind === 'activate' || entry.transition_kind === 'resume';
  if (readinessRequired) {
    assert(entry.readiness_signal && entry.readiness_signal.artifact_type === 'KONTURReadinessSignal',
      'KONTUR Responsibility Ledger: fresh readiness bytes required for activate/resume');
    const expectedReadinessBinding = await exactBinding(entry.readiness_signal, 'KONTURReadinessSignal');
    assert(sameBinding(entry.readiness_signal_binding, expectedReadinessBinding),
      'KONTUR Responsibility Ledger: readiness signal digest substitution');
  } else {
    assert(entry.readiness_signal === null && entry.readiness_signal_binding === null,
      'KONTUR Responsibility Ledger: non-readiness transition cannot inject fresh readiness bytes');
  }

  const predecessorState = previousEntry ? previousEntry.responsibility_state : null;
  await Kernel.validateResponsibilityTransitionReceipt({
    receipt,
    policy: responsibilityPolicy,
    readinessSignal: readinessRequired ? entry.readiness_signal : null,
    predecessorState
  });

  if (entry.transition_kind === 'activate') {
    assert(typeof entry.command_nonce === 'string' && entry.command_nonce.startsWith('urn:uu-aap:kontur:activation-intent-nonce:'),
      'KONTUR Responsibility Ledger: activation command nonce required');
    assert(entry.activation_preflight !== null,
      'KONTUR Responsibility Ledger: activation preflight bytes required');
    validateActivationPreflightBoundary(entry.activation_preflight);
    const expectedPreflightBinding = await exactBinding(entry.activation_preflight, 'KONTURActivationPreflightReceipt');
    assert(sameBinding(entry.activation_preflight_binding, expectedPreflightBinding),
      'KONTUR Responsibility Ledger: activation preflight binding substitution');
    assert(sameBinding(entry.trigger_binding, expectedPreflightBinding),
      'KONTUR Responsibility Ledger: activation trigger must be exact preflight binding');
  } else {
    assert(entry.activation_preflight === null && entry.activation_preflight_binding === null,
      'KONTUR Responsibility Ledger: activation preflight may appear only on activation entry');
  }

  if (entry.command_nonce !== null) {
    assert(typeof entry.command_nonce === 'string' && entry.command_nonce.length > 0,
      'KONTUR Responsibility Ledger: invalid command nonce');
    assert(!consumedNonces.has(entry.command_nonce),
      'KONTUR Responsibility Ledger: command nonce replay detected');
  }

  const expectedDigest = await expectedEntryDigest(entry);
  assert(entry.entry_digest && entry.entry_digest.value === expectedDigest.value,
    'KONTUR Responsibility Ledger: ledger entry digest mismatch');
  return true;
}

async function buildLedgerEntry({
  ledgerPolicy,
  responsibilityPolicy,
  transitionReceipt,
  readinessSignal = null,
  previousEntry = null,
  triggerArtifact,
  commandNonce = null,
  activationPreflight = null,
  committedAt
}) {
  assertLedgerPolicy(ledgerPolicy);
  assert(triggerArtifact && typeof triggerArtifact === 'object',
    'KONTUR Responsibility Ledger: trigger artifact required');
  parseTime(committedAt, 'committed_at');

  const state = clone(transitionReceipt.resulting_state);
  const sequence = previousEntry ? previousEntry.sequence + 1 : 1;
  const ledgerPolicyBinding = await exactBinding(ledgerPolicy, 'KONTURResponsibilityLedgerPolicy');
  const responsibilityPolicyBinding = await exactBinding(responsibilityPolicy, 'KONTURResponsibilityPolicy');
  const stateBinding = await exactBinding(state, 'KONTURResponsibilityState');
  const receiptBinding = await exactBinding(transitionReceipt, 'KONTURResponsibilityTransitionReceipt');
  const triggerBinding = await exactBinding(triggerArtifact);
  const previousBinding = previousEntry ? await entryBinding(previousEntry) : null;
  const readinessBinding = readinessSignal ? await exactBinding(readinessSignal, 'KONTURReadinessSignal') : null;
  const preflightBinding = activationPreflight ? await exactBinding(activationPreflight, 'KONTURActivationPreflightReceipt') : null;

  const seed = `${ledgerPolicy.ledger_id}|${sequence}|${previousBinding ? previousBinding.digest.value : 'genesis'}|${receiptBinding.digest.value}|${committedAt}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  const entry = {
    $schema: './kontur-responsibility-ledger-entry.schema.json',
    artifact_type: 'KONTURResponsibilityLedgerEntry',
    artifact_version: '0.1',
    entry_id: `urn:uu-aap:kontur:responsibility-ledger-entry:${idHash.slice(0, 24)}`,
    ledger_id: ledgerPolicy.ledger_id,
    sequence,
    committed_at: committedAt,
    system_id: ledgerPolicy.system_id,
    server_instance_id: ledgerPolicy.server_instance_id,
    previous_entry_binding: previousBinding,
    transition_kind: transitionReceipt.transition_kind,
    ledger_policy: clone(ledgerPolicy),
    ledger_policy_binding: ledgerPolicyBinding,
    responsibility_policy: clone(responsibilityPolicy),
    responsibility_policy_binding: responsibilityPolicyBinding,
    readiness_signal: readinessSignal ? clone(readinessSignal) : null,
    readiness_signal_binding: readinessBinding,
    responsibility_state: state,
    responsibility_state_binding: stateBinding,
    transition_receipt: clone(transitionReceipt),
    transition_receipt_binding: receiptBinding,
    trigger_binding: triggerBinding,
    command_nonce: commandNonce,
    activation_preflight: activationPreflight ? clone(activationPreflight) : null,
    activation_preflight_binding: preflightBinding,
    claims: {
      local_durable_commit_established: true,
      authoritative_head_derivable: true,
      embedded_historical_evidence_bound: true,
      ledger_relative_replay_protection_applied: true,
      distributed_consensus_established: false,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      universal_causality_established: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  entry.entry_digest = await expectedEntryDigest(entry);
  const consumed = new Set();
  if (previousEntry && previousEntry.command_nonce) consumed.add(previousEntry.command_nonce);
  await validateLedgerEntry({ entry, ledgerPolicy, previousEntry, consumedNonces: consumed });
  return entry;
}

async function ensureLedgerDirectories(rootDir) {
  await fsp.mkdir(rootDir, { recursive: true });
  await fsp.mkdir(path.join(rootDir, 'entries'), { recursive: true });
  await fsp.mkdir(path.join(rootDir, 'tmp'), { recursive: true });
}

async function fsyncDirectory(dirPath) {
  const handle = await fsp.open(dirPath, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function recoverLedger(rootDir, ledgerPolicy) {
  assertLedgerPolicy(ledgerPolicy);
  await ensureLedgerDirectories(rootDir);
  const entriesDir = path.join(rootDir, 'entries');
  const names = (await fsp.readdir(entriesDir)).sort();
  for (const name of names) {
    assert(/^\d{12}-[0-9a-f]{64}\.json$/.test(name),
      `KONTUR Responsibility Ledger: invalid committed entry filename ${name}`);
  }

  const entries = [];
  const consumedNonces = new Set();
  let previousEntry = null;
  for (const name of names) {
    const filePath = path.join(entriesDir, name);
    let entry;
    try {
      entry = JSON.parse(await fsp.readFile(filePath, 'utf8'));
    } catch (error) {
      throw new Error(`KONTUR Responsibility Ledger: malformed committed entry ${name}: ${error.message}`);
    }
    assert(name === entryFilename(entry),
      `KONTUR Responsibility Ledger: committed filename/digest mismatch ${name}`);
    await validateLedgerEntry({ entry, ledgerPolicy, previousEntry, consumedNonces });
    assert(entry.sequence === entries.length + 1,
      'KONTUR Responsibility Ledger: non-contiguous recovered sequence');
    entries.push(entry);
    if (entry.command_nonce !== null) consumedNonces.add(entry.command_nonce);
    previousEntry = entry;
  }

  const head = entries.length ? entries[entries.length - 1] : null;
  const state = head ? clone(head.responsibility_state) : null;
  return {
    ledger_id: ledgerPolicy.ledger_id,
    entries,
    head_entry: head,
    authoritative_state: state,
    fencing_epoch: state ? state.fencing_epoch : null,
    holder_id: state ? state.holder_id : null,
    responsibility_scopes: state ? clone(state.responsibility_scopes) : [],
    consumed_nonces: [...consumedNonces].sort(),
    terminal: !!state && state.lifecycle_state === 'retired'
  };
}

async function withWriterLock(rootDir, fn) {
  await ensureLedgerDirectories(rootDir);
  const lockPath = path.join(rootDir, '.writer.lock');
  let handle;
  try {
    handle = await fsp.open(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Error('KONTUR Responsibility Ledger: writer lock already held; fail closed');
    }
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
    const consumedNonces = new Set(recovered.consumed_nonces);
    await validateLedgerEntry({ entry, ledgerPolicy, previousEntry, consumedNonces });

    const entriesDir = path.join(rootDir, 'entries');
    const tmpDir = path.join(rootDir, 'tmp');
    const name = entryFilename(entry);
    const sequencePrefix = `${String(entry.sequence).padStart(12, '0')}-`;
    const existing = await fsp.readdir(entriesDir);
    assert(!existing.some((candidate) => candidate.startsWith(sequencePrefix)),
      'KONTUR Responsibility Ledger: duplicate committed sequence');

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
      if (handle) {
        try { await handle.close(); } catch (_) {}
      }
      try { await fsp.unlink(tempPath); } catch (_) {}
      throw error;
    }

    const after = await recoverLedger(rootDir, ledgerPolicy);
    assert(after.head_entry && after.head_entry.entry_digest.value === entry.entry_digest.value,
      'KONTUR Responsibility Ledger: durable head does not match committed entry');
    return after;
  });
}

async function buildAndCommitLedgerEntry(rootDir, args) {
  const recovered = await recoverLedger(rootDir, args.ledgerPolicy);
  const entry = await buildLedgerEntry({ ...args, previousEntry: recovered.head_entry });
  return commitLedgerEntry(rootDir, entry, args.ledgerPolicy);
}

module.exports = {
  digestJson,
  binding,
  entryBinding,
  entryFilename,
  expectedEntryDigest,
  validateLedgerEntry,
  buildLedgerEntry,
  recoverLedger,
  commitLedgerEntry,
  buildAndCommitLedgerEntry
};
