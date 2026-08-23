'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const Ledger = require('./responsibility-ledger.js');

function assert(v, m) { if (!v) throw new Error(`KONTUR Read-Only Replica: ${m}`); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
async function fsyncDir(p) { const h = await fsp.open(p, 'r'); try { await h.sync(); } finally { await h.close(); } }

async function readOnlyRecover(rootDir, ledgerPolicy) {
  const entriesDir = path.join(rootDir, 'entries');
  const st = await fsp.stat(entriesDir).catch(() => null);
  assert(st && st.isDirectory(), 'source entries directory missing');
  const names = (await fsp.readdir(entriesDir)).sort();
  for (const n of names) assert(/^\d{12}-[0-9a-f]{64}\.json$/.test(n), `invalid committed entry filename ${n}`);
  const entries = [], files = [], consumed = new Set();
  let previous = null;
  for (const name of names) {
    const raw = await fsp.readFile(path.join(entriesDir, name));
    let entry;
    try { entry = JSON.parse(raw.toString('utf8')); } catch (e) { throw new Error(`KONTUR Read-Only Replica: malformed committed entry ${name}: ${e.message}`); }
    assert(name === Ledger.entryFilename(entry), `filename/digest mismatch ${name}`);
    await Ledger.validateLedgerEntry({ entry, ledgerPolicy, previousEntry: previous, consumedNonces: consumed });
    assert(entry.sequence === entries.length + 1, 'non-contiguous recovered sequence');
    entries.push(entry); files.push({ name, sha256: sha256(raw), bytes: raw.length });
    if (entry.command_nonce !== null) consumed.add(entry.command_nonce);
    previous = entry;
  }
  const head = entries.length ? entries[entries.length - 1] : null;
  const signature = sha256(Buffer.from(JSON.stringify(files)));
  return { entries, head_entry: head, files, signature };
}

async function writeExact(filePath, bytes) {
  const h = await fsp.open(filePath, 'wx', 0o600);
  try { await h.writeFile(bytes); await h.sync(); } finally { await h.close(); }
}

async function manifestDigest(manifest) {
  const body = clone(manifest); delete body.manifest_digest;
  return Ledger.digestJson(body);
}

async function verifyReplica(snapshotDir) {
  const manifestPath = path.join(snapshotDir, 'replica-manifest.json');
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  assert(manifest.artifact_type === 'KONTURResponsibilityLedgerReadOnlyReplica' && manifest.artifact_version === '0.1', 'invalid replica manifest');
  assert(path.basename(snapshotDir) === manifest.snapshot_id, 'snapshot directory identity mismatch');
  assert(manifest.manifest_digest && manifest.manifest_digest.value === await manifestDigest(manifest), 'manifest digest mismatch');
  assert(manifest.claims && manifest.claims.source_chain_validated === true && manifest.claims.exact_entry_bytes_copied === true && manifest.claims.replica_head_matches_source === true, 'positive replica claims missing');
  for (const k of ['replica_authoritative','execution_authority_granted','distributed_consensus_established','kontur_activated','canonical_successor_created','legal_effect_established','truth_certified']) assert(manifest.claims[k] === false, `prohibited claim ${k}`);

  const policyBytes = await fsp.readFile(path.join(snapshotDir, 'ledger-policy.json'));
  assert(sha256(policyBytes) === manifest.ledger_policy_file.sha256 && policyBytes.length === manifest.ledger_policy_file.bytes, 'ledger policy bytes mismatch');
  const policy = JSON.parse(policyBytes.toString('utf8'));
  const recovered = await readOnlyRecover(snapshotDir, policy);
  assert(recovered.signature === manifest.entry_set_sha256, 'replica entry-set signature mismatch');
  assert(recovered.entries.length === manifest.entry_count, 'replica entry count mismatch');
  const headDigest = recovered.head_entry ? recovered.head_entry.entry_digest.value : null;
  assert(headDigest === manifest.head_entry_digest, 'replica recovered head mismatch');
  assert(JSON.stringify(recovered.files) === JSON.stringify(manifest.entry_files), 'replica entry file binding mismatch');
  const marker = await fsp.readFile(path.join(snapshotDir, 'NON_AUTHORITATIVE_REPLICA'), 'utf8');
  assert(marker === 'NON-AUTHORITATIVE READ-ONLY CONTINUITY REPLICA\n', 'replica boundary marker mismatch');
  return { snapshot_id: manifest.snapshot_id, entry_count: manifest.entry_count, head_entry_digest: manifest.head_entry_digest, verified: true };
}

async function createReplica(sourceRoot, policyPath, replicaRoot) {
  const policyBytes = await fsp.readFile(policyPath);
  const policy = JSON.parse(policyBytes.toString('utf8'));
  const before = await readOnlyRecover(sourceRoot, policy);
  const headDigest = before.head_entry ? before.head_entry.entry_digest.value : null;
  const seq = before.head_entry ? before.head_entry.sequence : 0;
  const idSeed = `${policy.ledger_id}|${seq}|${headDigest || 'empty'}|${before.signature}|${sha256(policyBytes)}`;
  const snapshotId = `${String(seq).padStart(12,'0')}-${sha256(Buffer.from(idSeed)).slice(0,32)}`;
  const snapshots = path.join(replicaRoot, 'snapshots');
  const tmpRoot = path.join(replicaRoot, 'tmp');
  await fsp.mkdir(snapshots, { recursive: true }); await fsp.mkdir(tmpRoot, { recursive: true });
  const finalDir = path.join(snapshots, snapshotId);
  assert(!fs.existsSync(finalDir), 'snapshot already exists; refusing overwrite');
  const tempDir = await fsp.mkdtemp(path.join(tmpRoot, 'replica-'));
  try {
    const destEntries = path.join(tempDir, 'entries'); await fsp.mkdir(destEntries);
    for (const file of before.files) {
      const raw = await fsp.readFile(path.join(sourceRoot, 'entries', file.name));
      assert(sha256(raw) === file.sha256 && raw.length === file.bytes, `source entry changed during copy ${file.name}`);
      await writeExact(path.join(destEntries, file.name), raw);
    }
    await writeExact(path.join(tempDir, 'ledger-policy.json'), policyBytes);
    await writeExact(path.join(tempDir, 'NON_AUTHORITATIVE_REPLICA'), Buffer.from('NON-AUTHORITATIVE READ-ONLY CONTINUITY REPLICA\n'));

    const after = await readOnlyRecover(sourceRoot, policy);
    assert(after.signature === before.signature && (after.head_entry ? after.head_entry.entry_digest.value : null) === headDigest, 'source ledger changed during replica capture; fail closed');
    const copied = await readOnlyRecover(tempDir, policy);
    assert(copied.signature === before.signature, 'copied entry set differs from validated source');

    const manifest = {
      artifact_type: 'KONTURResponsibilityLedgerReadOnlyReplica', artifact_version: '0.1', snapshot_id: snapshotId,
      captured_at: new Date().toISOString(), ledger_id: policy.ledger_id, entry_count: before.entries.length,
      head_entry_digest: headDigest, entry_set_sha256: before.signature, entry_files: before.files,
      ledger_policy_file: { name: 'ledger-policy.json', sha256: sha256(policyBytes), bytes: policyBytes.length },
      publication_model: 'validated_temp_snapshot_then_atomic_rename',
      claims: { source_chain_validated: true, exact_entry_bytes_copied: true, replica_head_matches_source: true,
        replica_authoritative: false, execution_authority_granted: false, distributed_consensus_established: false,
        kontur_activated: false, canonical_successor_created: false, legal_effect_established: false, truth_certified: false }
    };
    manifest.manifest_digest = { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: await manifestDigest(manifest) };
    await writeExact(path.join(tempDir, 'replica-manifest.json'), Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
    await fsyncDir(tempDir); await fsp.rename(tempDir, finalDir); await fsyncDir(snapshots);
    await verifyReplica(finalDir);
    return finalDir;
  } catch (e) { await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {}); throw e; }
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (cmd === 'create' && a && b && c) { console.log(await createReplica(a,b,c)); return; }
  if (cmd === 'verify' && a) { console.log(JSON.stringify(await verifyReplica(a), null, 2)); return; }
  throw new Error('usage: responsibility-ledger-replica.js create <source-ledger-root> <ledger-policy.json> <replica-root> | verify <snapshot-dir>');
}
if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { readOnlyRecover, createReplica, verifyReplica };
