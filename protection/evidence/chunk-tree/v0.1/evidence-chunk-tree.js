'use strict';

const crypto = require('crypto');

const CLAIMS = Object.freeze({
  chunk_tree_structure_created: true,
  whole_file_sha256_recorded: true,
  partial_chunk_verification_supported: true,
  evidence_truth_certified: false,
  origin_established: false,
  canonicality_established: false,
  authority_established: false,
  legal_liability_determined: false,
  rescue_authorized: false,
  kontur_readiness_established: false,
  kontur_activation_authorized: false,
  kontur_activated: false
});

function assert(value, message) {
  if (!value) throw new Error(`Evidence Chunk Tree: ${message}`);
}

function exactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} object required`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label} keys mismatch`);
}

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function leafHash(chunk) {
  return sha256Hex(Buffer.concat([Buffer.from([0x00]), Buffer.from(chunk)]));
}

function nodeHash(leftHex, rightHex) {
  assert(/^[0-9a-f]{64}$/.test(leftHex) && /^[0-9a-f]{64}$/.test(rightHex), 'invalid node hash input');
  return sha256Hex(Buffer.concat([
    Buffer.from([0x01]),
    Buffer.from(leftHex, 'hex'),
    Buffer.from(rightHex, 'hex')
  ]));
}

function buildLevels(leafHashes) {
  assert(Array.isArray(leafHashes) && leafHashes.length > 0, 'leaf hashes required');
  leafHashes.forEach(hash => assert(/^[0-9a-f]{64}$/.test(hash), 'invalid leaf hash'));
  const levels = [leafHashes.slice()];
  while (levels[levels.length - 1].length > 1) {
    const current = levels[levels.length - 1];
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : current[i];
      next.push(nodeHash(left, right));
    }
    levels.push(next);
  }
  return levels;
}

function merkleRootFromLeaves(leafHashes) {
  return buildLevels(leafHashes).at(-1)[0];
}

function chunkBytes(buffer, chunkSize) {
  assert(Buffer.isBuffer(buffer) || buffer instanceof Uint8Array, 'bytes must be Buffer or Uint8Array');
  assert(Number.isSafeInteger(chunkSize) && chunkSize >= 1 && chunkSize <= 16 * 1024 * 1024, 'chunk_size invalid');
  const bytes = Buffer.from(buffer);
  if (bytes.length === 0) return [Buffer.alloc(0)];
  const chunks = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return chunks;
}

function manifestIdSeed(fileRef, fileSize, chunkSize, wholeFileSha256, merkleRoot, createdAt) {
  return `${fileRef}|${fileSize}|${chunkSize}|${wholeFileSha256}|${merkleRoot}|${createdAt}`;
}

function expectedChunkCount(fileSize, chunkSize) {
  return fileSize === 0 ? 1 : Math.ceil(fileSize / chunkSize);
}

function buildChunkTreeManifest({ bytes, fileRef, chunkSize = 1024 * 1024, createdAt }) {
  assert(typeof fileRef === 'string' && fileRef.length > 0 && fileRef.length <= 512, 'file_ref invalid');
  assert(Number.isFinite(Date.parse(createdAt)), 'created_at invalid');
  const data = Buffer.from(bytes);
  const chunks = chunkBytes(data, chunkSize);
  const leaves = chunks.map(leafHash);
  const root = merkleRootFromLeaves(leaves);
  const whole = sha256Hex(data);
  const idHash = sha256Hex(Buffer.from(manifestIdSeed(fileRef, data.length, chunkSize, whole, root, createdAt), 'utf8'));

  return {
    $schema: './evidence-chunk-tree.schema.json',
    artifact_type: 'EvidenceChunkTreeManifest',
    artifact_version: '0.1',
    tree_id: `urn:uu-aap:evidence:chunk-tree:${idHash.slice(0, 24)}`,
    created_at: createdAt,
    file_ref: fileRef,
    file_size: data.length,
    chunk_size: chunkSize,
    chunk_count: leaves.length,
    whole_file_sha256: whole,
    leaf_hashes: leaves,
    merkle_root: root,
    hash_domain: {
      algorithm: 'SHA-256',
      leaf_prefix_hex: '00',
      node_prefix_hex: '01',
      odd_node_rule: 'duplicate_last'
    },
    claims: { ...CLAIMS }
  };
}

function verifyManifestStructure(manifest) {
  exactKeys(manifest, [
    '$schema', 'artifact_type', 'artifact_version', 'tree_id', 'created_at', 'file_ref',
    'file_size', 'chunk_size', 'chunk_count', 'whole_file_sha256', 'leaf_hashes',
    'merkle_root', 'hash_domain', 'claims'
  ], 'manifest');
  assert(manifest.artifact_type === 'EvidenceChunkTreeManifest' && manifest.artifact_version === '0.1', 'artifact contract mismatch');
  assert(manifest.$schema === './evidence-chunk-tree.schema.json', 'schema ref mismatch');
  assert(/^urn:uu-aap:evidence:chunk-tree:[0-9a-f]{24}$/.test(manifest.tree_id), 'tree_id invalid');
  assert(Number.isFinite(Date.parse(manifest.created_at)), 'created_at invalid');
  assert(typeof manifest.file_ref === 'string' && manifest.file_ref.length > 0 && manifest.file_ref.length <= 512, 'file_ref invalid');
  assert(Number.isSafeInteger(manifest.file_size) && manifest.file_size >= 0, 'file_size invalid');
  assert(Number.isSafeInteger(manifest.chunk_size) && manifest.chunk_size >= 1 && manifest.chunk_size <= 16 * 1024 * 1024, 'chunk_size invalid');
  assert(Number.isSafeInteger(manifest.chunk_count) && manifest.chunk_count >= 1, 'chunk_count invalid');
  assert(manifest.chunk_count === expectedChunkCount(manifest.file_size, manifest.chunk_size), 'chunk geometry mismatch');
  assert(Array.isArray(manifest.leaf_hashes) && manifest.leaf_hashes.length === manifest.chunk_count, 'leaf count mismatch');
  manifest.leaf_hashes.forEach(hash => assert(/^[0-9a-f]{64}$/.test(hash), 'leaf hash invalid'));
  assert(/^[0-9a-f]{64}$/.test(manifest.whole_file_sha256), 'whole-file SHA invalid');
  assert(/^[0-9a-f]{64}$/.test(manifest.merkle_root), 'merkle root invalid');
  assert(manifest.merkle_root === merkleRootFromLeaves(manifest.leaf_hashes), 'merkle root mismatch');

  exactKeys(manifest.hash_domain, ['algorithm', 'leaf_prefix_hex', 'node_prefix_hex', 'odd_node_rule'], 'hash_domain');
  assert(manifest.hash_domain.algorithm === 'SHA-256', 'hash algorithm mismatch');
  assert(manifest.hash_domain.leaf_prefix_hex === '00' && manifest.hash_domain.node_prefix_hex === '01', 'hash domain mismatch');
  assert(manifest.hash_domain.odd_node_rule === 'duplicate_last', 'odd-node rule mismatch');

  exactKeys(manifest.claims, Object.keys(CLAIMS), 'claims');
  for (const [key, expected] of Object.entries(CLAIMS)) {
    assert(manifest.claims[key] === expected, `claim ${key} mismatch`);
  }

  const idHash = sha256Hex(Buffer.from(manifestIdSeed(
    manifest.file_ref,
    manifest.file_size,
    manifest.chunk_size,
    manifest.whole_file_sha256,
    manifest.merkle_root,
    manifest.created_at
  ), 'utf8'));
  assert(manifest.tree_id === `urn:uu-aap:evidence:chunk-tree:${idHash.slice(0, 24)}`, 'tree_id binding mismatch');
  return true;
}

function buildChunkProof(manifest, chunkIndex) {
  verifyManifestStructure(manifest);
  assert(Number.isSafeInteger(chunkIndex) && chunkIndex >= 0 && chunkIndex < manifest.chunk_count, 'chunk index out of range');
  const levels = buildLevels(manifest.leaf_hashes);
  const siblings = [];
  let index = chunkIndex;
  for (let level = 0; level < levels.length - 1; level += 1) {
    const nodes = levels[level];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : Math.min(index + 1, nodes.length - 1);
    siblings.push({
      position: isRight ? 'left' : 'right',
      hash: nodes[siblingIndex]
    });
    index = Math.floor(index / 2);
  }
  return {
    chunk_index: chunkIndex,
    expected_leaf_hash: manifest.leaf_hashes[chunkIndex],
    merkle_root: manifest.merkle_root,
    siblings
  };
}

function verifyChunkProof({ chunk, proof, manifest }) {
  verifyManifestStructure(manifest);
  exactKeys(proof, ['chunk_index', 'expected_leaf_hash', 'merkle_root', 'siblings'], 'proof');
  assert(Number.isSafeInteger(proof.chunk_index), 'proof chunk index invalid');
  assert(proof.chunk_index >= 0 && proof.chunk_index < manifest.chunk_count, 'proof chunk index out of range');
  assert(proof.expected_leaf_hash === manifest.leaf_hashes[proof.chunk_index], 'proof expected leaf mismatch');
  assert(proof.merkle_root === manifest.merkle_root, 'proof root mismatch');
  assert(Array.isArray(proof.siblings), 'proof siblings required');

  let current = leafHash(Buffer.from(chunk));
  assert(current === proof.expected_leaf_hash, 'chunk bytes do not match expected leaf');
  for (const sibling of proof.siblings) {
    exactKeys(sibling, ['position', 'hash'], 'proof sibling');
    assert(sibling.position === 'left' || sibling.position === 'right', 'proof sibling position invalid');
    assert(/^[0-9a-f]{64}$/.test(sibling.hash), 'proof sibling hash invalid');
    current = sibling.position === 'left' ? nodeHash(sibling.hash, current) : nodeHash(current, sibling.hash);
  }
  assert(current === manifest.merkle_root, 'chunk proof root verification failed');
  return true;
}

module.exports = {
  CLAIMS,
  leafHash,
  nodeHash,
  merkleRootFromLeaves,
  buildChunkTreeManifest,
  verifyManifestStructure,
  buildChunkProof,
  verifyChunkProof
};
