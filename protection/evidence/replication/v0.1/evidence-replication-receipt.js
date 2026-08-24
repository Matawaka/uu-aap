'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../../docs/poai/binding-receipt.js'));

const CLAIMS = Object.freeze({
  byte_equivalent_set_verified: true,
  source_destination_descriptor_sets_match: true,
  distinct_carrier_refs_declared: true,
  physical_independence_proven: false,
  origin_established: false,
  canonical_successor_established: false,
  authority_transferred: false,
  custody_transferred: false,
  evidence_truth_certified: false,
  legal_liability_determined: false,
  rescue_authorized: false,
  kontur_readiness_established: false,
  kontur_activation_authorized: false,
  kontur_activated: false
});

function assert(value, message) {
  if (!value) throw new Error(`Evidence Replication Receipt: ${message}`);
}

function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} object required`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch`);
}

function digestShape(value, label) {
  exactKeys(value, ['canonicalization', 'digest_algorithm', 'digest_encoding', 'value'], label);
  assert(value.canonicalization === 'RFC8785-JCS', `${label} canonicalization mismatch`);
  assert(value.digest_algorithm === 'SHA-256', `${label} algorithm mismatch`);
  assert(value.digest_encoding === 'hex', `${label} encoding mismatch`);
  assert(/^[0-9a-f]{64}$/.test(value.value), `${label} value invalid`);
}

function digest(value) {
  return {
    canonicalization: 'RFC8785-JCS',
    digest_algorithm: 'SHA-256',
    digest_encoding: 'hex',
    value
  };
}

async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}

function canonicalPath(value) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= 512, 'file path invalid');
  assert(!value.includes('\\'), 'backslash path rejected');
  assert(!path.posix.isAbsolute(value), 'absolute path rejected');
  assert(!/^[A-Za-z]:/.test(value), 'drive-qualified path rejected');
  assert(!value.includes('//'), 'non-canonical repeated separator rejected');
  const parts = value.split('/');
  assert(parts.every(part => part.length > 0 && part !== '.' && part !== '..'), 'dot/traversal path rejected');
  assert(path.posix.normalize(value) === value, 'non-canonical path rejected');
  return value;
}

function validateFile(file) {
  exactKeys(file, ['path', 'role', 'bytes', 'sha256'], 'file descriptor');
  canonicalPath(file.path);
  assert(typeof file.role === 'string' && file.role.length > 0 && file.role.length <= 128, 'file role invalid');
  assert(Number.isSafeInteger(file.bytes) && file.bytes >= 0, 'file byte length invalid');
  assert(/^[0-9a-f]{64}$/.test(file.sha256), 'file SHA-256 invalid');
}

function sortedFiles(files) {
  return files.map(file => ({ ...file })).sort((a, b) => {
    const byPath = a.path.localeCompare(b.path);
    return byPath !== 0 ? byPath : a.role.localeCompare(b.role);
  });
}

async function computeFileSetDigest(files) {
  assert(Array.isArray(files) && files.length > 0, 'non-empty files array required');
  files.forEach(validateFile);
  const sorted = sortedFiles(files);
  assert(JSON.stringify(sorted) === JSON.stringify(files), 'file descriptors must use canonical ordering');
  const paths = new Set();
  for (const file of files) {
    assert(!paths.has(file.path), `duplicate file path ${file.path}`);
    paths.add(file.path);
  }
  return digest(await digestJson(files));
}

async function validateSnapshot(snapshot, label) {
  exactKeys(snapshot, ['snapshot_ref', 'carrier_ref', 'file_count', 'files', 'file_set_digest'], label);
  assert(typeof snapshot.snapshot_ref === 'string' && snapshot.snapshot_ref.length > 0 && snapshot.snapshot_ref.length <= 512,
    `${label} snapshot_ref invalid`);
  assert(typeof snapshot.carrier_ref === 'string' && snapshot.carrier_ref.length > 0 && snapshot.carrier_ref.length <= 512,
    `${label} carrier_ref invalid`);
  assert(Array.isArray(snapshot.files) && snapshot.files.length > 0, `${label} files required`);
  assert(Number.isSafeInteger(snapshot.file_count) && snapshot.file_count === snapshot.files.length,
    `${label} file_count mismatch`);
  digestShape(snapshot.file_set_digest, `${label} file_set_digest`);
  const computed = await computeFileSetDigest(snapshot.files);
  assert(computed.value === snapshot.file_set_digest.value, `${label} file_set_digest mismatch`);
  return computed;
}

function descriptorsEqual(left, right) {
  return Binding.canonicalize(left, '$') === Binding.canonicalize(right, '$');
}

async function replicationEvidenceDigest(source, destination, observedAt) {
  return digest(await digestJson({
    source_snapshot_ref: source.snapshot_ref,
    source_carrier_ref: source.carrier_ref,
    destination_snapshot_ref: destination.snapshot_ref,
    destination_carrier_ref: destination.carrier_ref,
    file_set_digest: source.file_set_digest.value,
    observed_at: observedAt
  }));
}

async function buildReplicationReceipt({ sourceSnapshot, destinationSnapshot, observedAt }) {
  assert(Number.isFinite(Date.parse(observedAt)), 'observed_at invalid');
  await validateSnapshot(sourceSnapshot, 'source snapshot');
  await validateSnapshot(destinationSnapshot, 'destination snapshot');
  assert(sourceSnapshot.snapshot_ref !== destinationSnapshot.snapshot_ref, 'source and destination snapshot refs must differ');
  assert(sourceSnapshot.carrier_ref !== destinationSnapshot.carrier_ref, 'source and destination carrier refs must differ');
  assert(sourceSnapshot.file_set_digest.value === destinationSnapshot.file_set_digest.value,
    'source and destination file-set digests differ');
  assert(descriptorsEqual(sourceSnapshot.files, destinationSnapshot.files),
    'source and destination descriptor sets differ');

  const evidenceDigest = await replicationEvidenceDigest(sourceSnapshot, destinationSnapshot, observedAt);
  const idSeed = `${evidenceDigest.value}|${observedAt}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(idSeed));

  return {
    $schema: './evidence-replication-receipt.schema.json',
    artifact_type: 'EvidenceReplicationReceipt',
    artifact_version: '0.1',
    replication_id: `urn:uu-aap:evidence:replication:${idHash.slice(0, 24)}`,
    observed_at: observedAt,
    source_snapshot: JSON.parse(JSON.stringify(sourceSnapshot)),
    destination_snapshot: JSON.parse(JSON.stringify(destinationSnapshot)),
    replication_evidence_digest: evidenceDigest,
    result: 'byte_equivalent_set_verified',
    claims: { ...CLAIMS }
  };
}

async function verifyReplicationReceipt(receipt) {
  exactKeys(receipt, [
    '$schema', 'artifact_type', 'artifact_version', 'replication_id', 'observed_at',
    'source_snapshot', 'destination_snapshot', 'replication_evidence_digest', 'result', 'claims'
  ], 'receipt');
  assert(receipt.$schema === './evidence-replication-receipt.schema.json', 'schema ref mismatch');
  assert(receipt.artifact_type === 'EvidenceReplicationReceipt' && receipt.artifact_version === '0.1', 'artifact contract mismatch');
  assert(/^urn:uu-aap:evidence:replication:[0-9a-f]{24}$/.test(receipt.replication_id), 'replication_id invalid');
  assert(Number.isFinite(Date.parse(receipt.observed_at)), 'observed_at invalid');
  assert(receipt.result === 'byte_equivalent_set_verified', 'result mismatch');

  await validateSnapshot(receipt.source_snapshot, 'source snapshot');
  await validateSnapshot(receipt.destination_snapshot, 'destination snapshot');
  assert(receipt.source_snapshot.snapshot_ref !== receipt.destination_snapshot.snapshot_ref,
    'source and destination snapshot refs must differ');
  assert(receipt.source_snapshot.carrier_ref !== receipt.destination_snapshot.carrier_ref,
    'source and destination carrier refs must differ');
  assert(receipt.source_snapshot.file_set_digest.value === receipt.destination_snapshot.file_set_digest.value,
    'source and destination file-set digests differ');
  assert(descriptorsEqual(receipt.source_snapshot.files, receipt.destination_snapshot.files),
    'source and destination descriptor sets differ');

  digestShape(receipt.replication_evidence_digest, 'replication_evidence_digest');
  const expectedEvidence = await replicationEvidenceDigest(receipt.source_snapshot, receipt.destination_snapshot, receipt.observed_at);
  assert(receipt.replication_evidence_digest.value === expectedEvidence.value, 'replication evidence digest mismatch');

  exactKeys(receipt.claims, Object.keys(CLAIMS), 'claims');
  for (const [key, expected] of Object.entries(CLAIMS)) {
    assert(receipt.claims[key] === expected, `claim ${key} mismatch`);
  }

  const idSeed = `${expectedEvidence.value}|${receipt.observed_at}`;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(idSeed));
  assert(receipt.replication_id === `urn:uu-aap:evidence:replication:${idHash.slice(0, 24)}`,
    'replication_id binding mismatch');
  return true;
}

module.exports = {
  CLAIMS,
  computeFileSetDigest,
  buildReplicationReceipt,
  verifyReplicationReceipt
};
