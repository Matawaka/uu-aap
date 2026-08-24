'use strict';

const assert = require('assert');
const Replication = require('./evidence-replication-receipt.js');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

const FILES = [
  { path: 'evidence/checkpoint.json', role: 'checkpoint', bytes: 128, sha256: '1'.repeat(64) },
  { path: 'evidence/frontier.json', role: 'frontier', bytes: 256, sha256: '2'.repeat(64) },
  { path: 'logs/summary.txt', role: 'summary', bytes: 42, sha256: '3'.repeat(64) }
];

async function snapshot(snapshotRef, carrierRef, files = FILES) {
  return {
    snapshot_ref: snapshotRef,
    carrier_ref: carrierRef,
    file_count: files.length,
    files: clone(files),
    file_set_digest: await Replication.computeFileSetDigest(files)
  };
}

async function mustReject(label, fn) {
  let rejected = false;
  try { await fn(); } catch (_) { rejected = true; }
  assert.strictEqual(rejected, true, `${label}: expected fail-closed rejection`);
}

(async () => {
  const source = await snapshot('urn:test:snapshot:source', 'carrier:primary');
  const destination = await snapshot('urn:test:snapshot:destination', 'carrier:offline-copy');

  const receipt = await Replication.buildReplicationReceipt({
    sourceSnapshot: source,
    destinationSnapshot: destination,
    observedAt: '2026-08-24T04:20:00Z'
  });

  assert.strictEqual(await Replication.verifyReplicationReceipt(receipt), true);
  assert.strictEqual(receipt.result, 'byte_equivalent_set_verified');
  assert.strictEqual(receipt.claims.byte_equivalent_set_verified, true);
  assert.strictEqual(receipt.claims.source_destination_descriptor_sets_match, true);
  assert.strictEqual(receipt.claims.distinct_carrier_refs_declared, true);
  for (const key of [
    'physical_independence_proven', 'origin_established', 'canonical_successor_established',
    'authority_transferred', 'custody_transferred', 'evidence_truth_certified',
    'legal_liability_determined', 'rescue_authorized', 'kontur_readiness_established',
    'kontur_activation_authorized', 'kontur_activated'
  ]) assert.strictEqual(receipt.claims[key], false, key);

  const deterministic = await Replication.buildReplicationReceipt({
    sourceSnapshot: source,
    destinationSnapshot: destination,
    observedAt: '2026-08-24T04:20:00Z'
  });
  assert.deepStrictEqual(deterministic, receipt, 'fixed inputs must be deterministic');

  await mustReject('source/destination descriptor tamper', async () => {
    const dst = clone(destination);
    dst.files[2].sha256 = '4'.repeat(64);
    dst.file_set_digest = await Replication.computeFileSetDigest(dst.files);
    await Replication.buildReplicationReceipt({ sourceSnapshot: source, destinationSnapshot: dst, observedAt: '2026-08-24T04:20:00Z' });
  });

  await mustReject('declared destination set digest tamper', async () => {
    const dst = clone(destination);
    dst.file_set_digest.value = 'f'.repeat(64);
    await Replication.buildReplicationReceipt({ sourceSnapshot: source, destinationSnapshot: dst, observedAt: '2026-08-24T04:20:00Z' });
  });

  await mustReject('same carrier cannot masquerade as replication', async () => {
    const dst = clone(destination);
    dst.carrier_ref = source.carrier_ref;
    await Replication.buildReplicationReceipt({ sourceSnapshot: source, destinationSnapshot: dst, observedAt: '2026-08-24T04:20:00Z' });
  });

  await mustReject('same snapshot ref cannot masquerade as replication', async () => {
    const dst = clone(destination);
    dst.snapshot_ref = source.snapshot_ref;
    await Replication.buildReplicationReceipt({ sourceSnapshot: source, destinationSnapshot: dst, observedAt: '2026-08-24T04:20:00Z' });
  });

  await mustReject('duplicate file path', async () => {
    const files = clone(FILES);
    files[1].path = files[0].path;
    await Replication.computeFileSetDigest(files);
  });

  await mustReject('path traversal', async () => {
    const files = clone(FILES);
    files[0].path = '../escape.json';
    await Replication.computeFileSetDigest(files);
  });

  await mustReject('backslash path', async () => {
    const files = clone(FILES);
    files[0].path = 'evidence\\checkpoint.json';
    await Replication.computeFileSetDigest(files);
  });

  await mustReject('noncanonical ordering', async () => {
    const files = clone(FILES).reverse();
    await Replication.computeFileSetDigest(files);
  });

  await mustReject('receipt evidence digest tamper', async () => {
    const bad = clone(receipt);
    bad.replication_evidence_digest.value = 'a'.repeat(64);
    await Replication.verifyReplicationReceipt(bad);
  });

  await mustReject('receipt unsafe authority overclaim', async () => {
    const bad = clone(receipt);
    bad.claims.authority_transferred = true;
    await Replication.verifyReplicationReceipt(bad);
  });

  await mustReject('receipt unsafe KONTUR overclaim', async () => {
    const bad = clone(receipt);
    bad.claims.kontur_readiness_established = true;
    await Replication.verifyReplicationReceipt(bad);
  });

  await mustReject('receipt unexpected claim', async () => {
    const bad = clone(receipt);
    bad.claims.replication_is_canonical = true;
    await Replication.verifyReplicationReceipt(bad);
  });

  await mustReject('receipt source descriptor changed after issuance', async () => {
    const bad = clone(receipt);
    bad.source_snapshot.files[0].bytes += 1;
    await Replication.verifyReplicationReceipt(bad);
  });

  console.log('Evidence Replication Receipt v0.1: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
