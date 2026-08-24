'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const FALSE_CLAIMS = [
  'artifact_container_durability_proven',
  'long_term_availability_proven',
  'evidence_truth_certified',
  'evidence_completeness_proven',
  'authority_established',
  'canonicality_established',
  'legal_liability_determined',
  'kontur_readiness_established',
  'kontur_activation_authorized',
  'kontur_activated'
];

function assert(value, message) {
  if (!value) throw new Error(`Evidence Availability Manifest: ${message}`);
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}

function normalizeRelativePath(value) {
  assert(typeof value === 'string' && value.length > 0, 'relative_path required');
  assert(!value.includes('\\'), 'relative_path must use forward slashes');
  assert(!value.includes('\0'), 'relative_path contains NUL');
  assert(!value.startsWith('/'), 'absolute path prohibited');
  const parts = value.split('/');
  assert(parts.every(part => part.length > 0 && part !== '.' && part !== '..'), 'path traversal or non-canonical segment prohibited');
  const normalized = path.posix.normalize(value);
  assert(normalized === value && normalized !== '.', 'relative_path must already be canonical');
  return normalized;
}

function assertSourceContext(ctx) {
  assert(ctx && typeof ctx === 'object' && !Array.isArray(ctx), 'source_context required');
  const keys = Object.keys(ctx).sort();
  assert(JSON.stringify(keys) === JSON.stringify(['git_revision', 'project_id', 'scope', 'tree_sha']), 'source_context fields mismatch');
  assert(ctx.project_id === 'Matawaka/uu-aap', 'source_context project mismatch');
  assert(/^git:[0-9a-f]{40}$/.test(ctx.git_revision), 'source_context git_revision invalid');
  assert(/^[0-9a-f]{40}$/.test(ctx.tree_sha), 'source_context tree_sha invalid');
  assert(typeof ctx.scope === 'string' && ctx.scope.length > 0 && ctx.scope.length <= 200, 'source_context scope invalid');
}

function resolveRegularFile(rootDir, relativePath) {
  const rootReal = fs.realpathSync(rootDir);
  const candidate = path.resolve(rootReal, ...relativePath.split('/'));
  const prefix = rootReal.endsWith(path.sep) ? rootReal : `${rootReal}${path.sep}`;
  assert(candidate.startsWith(prefix), `path escapes root: ${relativePath}`);
  const lst = fs.lstatSync(candidate);
  assert(!lst.isSymbolicLink(), `symlink file prohibited: ${relativePath}`);
  const real = fs.realpathSync(candidate);
  assert(real.startsWith(prefix), `resolved path escapes root: ${relativePath}`);
  const stat = fs.statSync(real);
  assert(stat.isFile(), `regular file required: ${relativePath}`);
  return { real, stat };
}

function assertFileSpecs(fileSpecs) {
  assert(Array.isArray(fileSpecs) && fileSpecs.length > 0, 'non-empty explicit file set required');
  const seen = new Set();
  for (const item of fileSpecs) {
    assert(item && typeof item === 'object' && !Array.isArray(item), 'file spec object required');
    const keys = Object.keys(item).sort();
    assert(JSON.stringify(keys) === JSON.stringify(['relative_path', 'role']), 'file spec fields mismatch');
    const relativePath = normalizeRelativePath(item.relative_path);
    assert(!seen.has(relativePath), `duplicate relative_path: ${relativePath}`);
    seen.add(relativePath);
    assert(typeof item.role === 'string' && item.role.length > 0 && item.role.length <= 120, `invalid role for ${relativePath}`);
  }
}

async function buildManifest({ rootDir, sourceContext, fileSpecs, recordedAt }) {
  assertSourceContext(sourceContext);
  assertFileSpecs(fileSpecs);
  assert(Number.isFinite(Date.parse(recordedAt)), 'recorded_at invalid');

  const files = [];
  for (const spec of fileSpecs) {
    const relativePath = normalizeRelativePath(spec.relative_path);
    const { real, stat } = resolveRegularFile(rootDir, relativePath);
    const bytes = fs.readFileSync(real);
    assert(bytes.length === stat.size, `size changed while hashing: ${relativePath}`);
    files.push({
      relative_path: relativePath,
      role: spec.role,
      size_bytes: bytes.length,
      sha256: sha256Bytes(bytes)
    });
  }
  files.sort((a, b) => a.relative_path.localeCompare(b.relative_path, 'en'));

  const setMaterial = {
    artifact_version: '0.1',
    source_context: { ...sourceContext },
    coverage_mode: 'explicit_file_set',
    files
  };
  const setDigestValue = await digestJson(setMaterial);
  const idSeed = `${setDigestValue}|${recordedAt}`;
  const manifestIdHash = sha256Bytes(Buffer.from(idSeed, 'utf8'));

  return {
    $schema: './evidence-availability-manifest.schema.json',
    artifact_type: 'EvidenceAvailabilityManifest',
    artifact_version: '0.1',
    manifest_id: `urn:uu-aap:evidence:availability-manifest:${manifestIdHash.slice(0, 24)}`,
    recorded_at: recordedAt,
    source_context: { ...sourceContext },
    coverage_mode: 'explicit_file_set',
    files,
    set_digest: {
      canonicalization: 'RFC8785-JCS',
      digest_algorithm: 'SHA-256',
      digest_encoding: 'hex',
      value: setDigestValue
    },
    claims: {
      explicit_files_hashed: true,
      manifest_self_verification_supported: true,
      artifact_container_durability_proven: false,
      long_term_availability_proven: false,
      evidence_truth_certified: false,
      evidence_completeness_proven: false,
      authority_established: false,
      canonicality_established: false,
      legal_liability_determined: false,
      kontur_readiness_established: false,
      kontur_activation_authorized: false,
      kontur_activated: false
    }
  };
}

function assertManifestShape(manifest) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'manifest object required');
  const expectedTop = ['$schema', 'artifact_type', 'artifact_version', 'claims', 'coverage_mode', 'files', 'manifest_id', 'recorded_at', 'set_digest', 'source_context'];
  assert(JSON.stringify(Object.keys(manifest).sort()) === JSON.stringify(expectedTop), 'manifest top-level fields mismatch');
  assert(manifest.$schema === './evidence-availability-manifest.schema.json', 'schema ref mismatch');
  assert(manifest.artifact_type === 'EvidenceAvailabilityManifest' && manifest.artifact_version === '0.1', 'artifact type/version mismatch');
  assert(/^urn:uu-aap:evidence:availability-manifest:[0-9a-f]{24}$/.test(manifest.manifest_id), 'manifest_id invalid');
  assert(Number.isFinite(Date.parse(manifest.recorded_at)), 'recorded_at invalid');
  assertSourceContext(manifest.source_context);
  assert(manifest.coverage_mode === 'explicit_file_set', 'coverage_mode mismatch');
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, 'files required');

  let previous = null;
  const seen = new Set();
  for (const entry of manifest.files) {
    assert(entry && typeof entry === 'object' && !Array.isArray(entry), 'file entry object required');
    assert(JSON.stringify(Object.keys(entry).sort()) === JSON.stringify(['relative_path', 'role', 'sha256', 'size_bytes']), 'file entry fields mismatch');
    const relativePath = normalizeRelativePath(entry.relative_path);
    assert(!seen.has(relativePath), `duplicate manifest path: ${relativePath}`);
    seen.add(relativePath);
    assert(previous === null || previous.localeCompare(relativePath, 'en') < 0, 'files must be strictly sorted by relative_path');
    previous = relativePath;
    assert(typeof entry.role === 'string' && entry.role.length > 0 && entry.role.length <= 120, `invalid role for ${relativePath}`);
    assert(Number.isInteger(entry.size_bytes) && entry.size_bytes >= 0, `invalid size for ${relativePath}`);
    assert(/^[0-9a-f]{64}$/.test(entry.sha256), `invalid sha256 for ${relativePath}`);
  }

  const digestKeys = ['canonicalization', 'digest_algorithm', 'digest_encoding', 'value'];
  assert(manifest.set_digest && JSON.stringify(Object.keys(manifest.set_digest).sort()) === JSON.stringify(digestKeys), 'set_digest fields mismatch');
  assert(manifest.set_digest.canonicalization === 'RFC8785-JCS', 'set_digest canonicalization mismatch');
  assert(manifest.set_digest.digest_algorithm === 'SHA-256' && manifest.set_digest.digest_encoding === 'hex', 'set_digest algorithm mismatch');
  assert(/^[0-9a-f]{64}$/.test(manifest.set_digest.value), 'set_digest value invalid');

  const expectedClaims = ['artifact_container_durability_proven', 'authority_established', 'canonicality_established', 'evidence_completeness_proven', 'evidence_truth_certified', 'explicit_files_hashed', 'kontur_activated', 'kontur_activation_authorized', 'kontur_readiness_established', 'legal_liability_determined', 'long_term_availability_proven', 'manifest_self_verification_supported'];
  assert(manifest.claims && JSON.stringify(Object.keys(manifest.claims).sort()) === JSON.stringify(expectedClaims), 'claims fields mismatch');
  assert(manifest.claims.explicit_files_hashed === true, 'explicit_files_hashed must be true');
  assert(manifest.claims.manifest_self_verification_supported === true, 'manifest_self_verification_supported must be true');
  for (const key of FALSE_CLAIMS) assert(manifest.claims[key] === false, `unsafe claim ${key}`);
}

async function verifyManifest({ rootDir, manifest }) {
  assertManifestShape(manifest);

  const recomputedFiles = [];
  for (const entry of manifest.files) {
    const { real, stat } = resolveRegularFile(rootDir, entry.relative_path);
    const bytes = fs.readFileSync(real);
    assert(bytes.length === stat.size, `size changed while verifying: ${entry.relative_path}`);
    assert(bytes.length === entry.size_bytes, `size mismatch: ${entry.relative_path}`);
    const sha = sha256Bytes(bytes);
    assert(sha === entry.sha256, `sha256 mismatch: ${entry.relative_path}`);
    recomputedFiles.push({ ...entry });
  }

  const setMaterial = {
    artifact_version: '0.1',
    source_context: { ...manifest.source_context },
    coverage_mode: 'explicit_file_set',
    files: recomputedFiles
  };
  const setDigestValue = await digestJson(setMaterial);
  assert(setDigestValue === manifest.set_digest.value, 'set digest mismatch');
  const idSeed = `${setDigestValue}|${manifest.recorded_at}`;
  const expectedId = `urn:uu-aap:evidence:availability-manifest:${sha256Bytes(Buffer.from(idSeed, 'utf8')).slice(0, 24)}`;
  assert(manifest.manifest_id === expectedId, 'manifest id mismatch');

  return {
    artifact_type: 'EvidenceAvailabilityVerificationReceipt',
    artifact_version: '0.1',
    manifest_id: manifest.manifest_id,
    files_verified: recomputedFiles.length,
    set_digest_verified: true,
    exact_file_bytes_verified: true,
    claims: {
      evidence_truth_certified: false,
      evidence_completeness_proven: false,
      authority_established: false,
      canonicality_established: false,
      legal_liability_determined: false,
      kontur_activation_authorized: false,
      kontur_activated: false
    }
  };
}

async function cli(argv) {
  const [mode, rootDir, jsonPath, outOrRecordedAt, maybeRecordedAt] = argv;
  if (mode === 'build') {
    assert(rootDir && jsonPath && outOrRecordedAt && maybeRecordedAt, 'usage: build <root> <spec.json> <output.json> <recorded_at>');
    const spec = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    assert(spec && JSON.stringify(Object.keys(spec).sort()) === JSON.stringify(['files', 'source_context']), 'build spec fields mismatch');
    const manifest = await buildManifest({ rootDir, sourceContext: spec.source_context, fileSpecs: spec.files, recordedAt: maybeRecordedAt });
    fs.writeFileSync(outOrRecordedAt, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    console.log(`Evidence Availability Manifest built: ${manifest.manifest_id}`);
    return;
  }
  if (mode === 'verify') {
    assert(rootDir && jsonPath && !outOrRecordedAt && !maybeRecordedAt, 'usage: verify <root> <manifest.json>');
    const manifest = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const receipt = await verifyManifest({ rootDir, manifest });
    console.log(JSON.stringify(receipt));
    return;
  }
  throw new Error('Evidence Availability Manifest: mode must be build or verify');
}

if (require.main === module) {
  cli(process.argv.slice(2)).catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  FALSE_CLAIMS,
  normalizeRelativePath,
  digestJson,
  buildManifest,
  verifyManifest
};
