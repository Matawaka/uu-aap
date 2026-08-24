'use strict';

const assert = require('assert');
const ChunkTree = require('./evidence-chunk-tree.js');

function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function mustReject(label, fn) {
  let rejected = false;
  try { await fn(); } catch (_) { rejected = true; }
  assert.strictEqual(rejected, true, `${label}: expected fail-closed rejection`);
}

(async () => {
  const bytes = Buffer.from('abcdefghijklmnopqrstuvwxyz0123456789', 'utf8');
  const manifest = ChunkTree.buildChunkTreeManifest({
    bytes,
    fileRef: 'evidence:test.bin',
    chunkSize: 8,
    createdAt: '2026-08-24T04:30:00Z'
  });

  assert.strictEqual(ChunkTree.verifyManifestStructure(manifest), true);
  assert.strictEqual(manifest.file_size, bytes.length);
  assert.strictEqual(manifest.chunk_count, Math.ceil(bytes.length / 8));
  assert.strictEqual(manifest.claims.partial_chunk_verification_supported, true);
  for (const key of [
    'evidence_truth_certified', 'origin_established', 'canonicality_established',
    'authority_established', 'legal_liability_determined', 'rescue_authorized',
    'kontur_readiness_established', 'kontur_activation_authorized', 'kontur_activated'
  ]) assert.strictEqual(manifest.claims[key], false, key);

  const same = ChunkTree.buildChunkTreeManifest({
    bytes,
    fileRef: 'evidence:test.bin',
    chunkSize: 8,
    createdAt: '2026-08-24T04:30:00Z'
  });
  assert.deepStrictEqual(same, manifest, 'fixed inputs must be deterministic');

  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += manifest.chunk_size) {
    chunks.push(bytes.subarray(offset, Math.min(offset + manifest.chunk_size, bytes.length)));
  }
  for (let i = 0; i < chunks.length; i += 1) {
    const proof = ChunkTree.buildChunkProof(manifest, i);
    assert.strictEqual(ChunkTree.verifyChunkProof({ chunk: chunks[i], proof, manifest }), true);
  }

  const zero = ChunkTree.buildChunkTreeManifest({
    bytes: Buffer.alloc(0),
    fileRef: 'evidence:empty.bin',
    chunkSize: 8,
    createdAt: '2026-08-24T04:30:00Z'
  });
  assert.strictEqual(zero.file_size, 0);
  assert.strictEqual(zero.chunk_count, 1);
  assert.strictEqual(ChunkTree.verifyChunkProof({
    chunk: Buffer.alloc(0),
    proof: ChunkTree.buildChunkProof(zero, 0),
    manifest: zero
  }), true);

  await mustReject('tampered chunk bytes', () => {
    const proof = ChunkTree.buildChunkProof(manifest, 1);
    ChunkTree.verifyChunkProof({ chunk: Buffer.from('XXXXXXXX'), proof, manifest });
  });

  await mustReject('tampered leaf hash', () => {
    const bad = clone(manifest);
    bad.leaf_hashes[0] = 'f'.repeat(64);
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('tampered merkle root', () => {
    const bad = clone(manifest);
    bad.merkle_root = 'e'.repeat(64);
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('tampered tree id', () => {
    const bad = clone(manifest);
    bad.tree_id = `urn:uu-aap:evidence:chunk-tree:${'a'.repeat(24)}`;
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('wrong hash-domain prefix', () => {
    const bad = clone(manifest);
    bad.hash_domain.leaf_prefix_hex = 'ff';
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('unsafe authority overclaim', () => {
    const bad = clone(manifest);
    bad.claims.authority_established = true;
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('unsafe KONTUR overclaim', () => {
    const bad = clone(manifest);
    bad.claims.kontur_activation_authorized = true;
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('unexpected manifest field', () => {
    const bad = clone(manifest);
    bad.hidden_authority = true;
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('unexpected claim field', () => {
    const bad = clone(manifest);
    bad.claims.chunk_tree_is_truth = true;
    ChunkTree.verifyManifestStructure(bad);
  });

  await mustReject('chunk proof wrong index', () => {
    const proof = ChunkTree.buildChunkProof(manifest, 0);
    proof.chunk_index = 2;
    ChunkTree.verifyChunkProof({ chunk: chunks[0], proof, manifest });
  });

  await mustReject('chunk proof sibling tamper', () => {
    const proof = ChunkTree.buildChunkProof(manifest, 0);
    proof.siblings[0].hash = 'd'.repeat(64);
    ChunkTree.verifyChunkProof({ chunk: chunks[0], proof, manifest });
  });

  await mustReject('unexpected proof field', () => {
    const proof = ChunkTree.buildChunkProof(manifest, 0);
    proof.authority = true;
    ChunkTree.verifyChunkProof({ chunk: chunks[0], proof, manifest });
  });

  await mustReject('chunk index out of range', () => {
    ChunkTree.buildChunkProof(manifest, manifest.chunk_count);
  });

  await mustReject('invalid chunk size', () => {
    ChunkTree.buildChunkTreeManifest({
      bytes,
      fileRef: 'evidence:test.bin',
      chunkSize: 0,
      createdAt: '2026-08-24T04:30:00Z'
    });
  });

  console.log('Evidence Chunk Tree v0.1: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
