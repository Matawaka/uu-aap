'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const here = __dirname;
const repoRoot = path.resolve(here, '../../..');
const registryPath = path.join(here, 'registry.json');
const schemaPath = path.join(here, 'registry.schema.json');

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exactKeys(object, required, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: expected object`);
  for (const key of required) {
    assert(Object.prototype.hasOwnProperty.call(object, key), `${label}: missing ${key}`);
  }
  for (const key of Object.keys(object)) {
    assert(required.includes(key), `${label}: unexpected property ${key}`);
  }
}

function git(args) {
  return cp.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function safeRepositoryPath(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.split('/').includes('..');
}

function safeTag(value) {
  return typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(value) &&
    !value.includes('..') &&
    !value.includes('@{') &&
    !value.endsWith('/') &&
    !value.endsWith('.');
}

function sha1(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
}

(function main() {
  const registry = readJson(registryPath);
  const schema = readJson(schemaPath);

  assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', 'Registry schema must use JSON Schema Draft 2020-12');

  const topKeys = [
    '$schema',
    'artifact_type',
    'artifact_version',
    'registry_id',
    'scope',
    'repository',
    'resolution_policy',
    'entries',
    'non_claims'
  ];
  exactKeys(registry, topKeys, 'registry');

  assert(registry.$schema === './registry.schema.json', 'Registry must bind the local schema');
  assert(registry.artifact_type === 'ProtocolRegistry', 'Unexpected artifact_type');
  assert(registry.artifact_version === '0.1', 'Unexpected artifact_version');
  assert(registry.registry_id === 'urn:uu-aap:protocol-registry:v0.1', 'Unexpected registry_id');
  assert(registry.scope === 'repository_scoped', 'Registry scope must remain repository_scoped');
  assert(registry.repository === 'github:Matawaka/uu-aap', 'Unexpected repository binding');

  const policyKeys = [
    'selection',
    'mutable_latest_alias',
    'implicit_upgrade',
    'ambiguity',
    'missing_version',
    'tag_drift',
    'manifest_blob_mismatch'
  ];
  exactKeys(registry.resolution_policy, policyKeys, 'resolution_policy');
  assert(registry.resolution_policy.selection === 'exact_protocol_id_and_version_only', 'Registry must use exact resolution');
  assert(registry.resolution_policy.mutable_latest_alias === false, 'Mutable latest alias must not exist in v0.1');
  assert(registry.resolution_policy.implicit_upgrade === false, 'Implicit upgrade must be disabled');
  for (const key of ['ambiguity', 'missing_version', 'tag_drift', 'manifest_blob_mismatch']) {
    assert(registry.resolution_policy[key] === 'fail_closed', `${key} must fail closed`);
  }

  assert(Array.isArray(registry.entries) && registry.entries.length > 0, 'Registry entries must not be empty');

  const identityKeys = new Set();
  const logicalUris = new Set();
  const releaseTags = new Set();

  const entryKeys = [
    'logical_uri',
    'protocol_id',
    'version',
    'status',
    'semantic_source_status',
    'release_tag',
    'release_commit',
    'release_tree',
    'release_manifest_path',
    'release_manifest_git_blob_sha',
    'publication_checkpoint_path',
    'publication_checkpoint_git_blob_sha',
    'conformance_levels'
  ];

  for (const entry of registry.entries) {
    const label = `entry:${entry && entry.protocol_id || 'unknown'}:${entry && entry.version || 'unknown'}`;
    exactKeys(entry, entryKeys, label);

    assert(typeof entry.protocol_id === 'string' && entry.protocol_id.length > 0, `${label}: missing protocol_id`);
    assert(typeof entry.version === 'string' && entry.version.length > 0, `${label}: missing version`);
    assert(entry.status === 'published', `${label}: status must be published`);
    assert(typeof entry.semantic_source_status === 'string' && entry.semantic_source_status.length > 0, `${label}: missing semantic_source_status`);

    const expectedLogicalUri = `urn:uu-aap:protocol:${entry.protocol_id.toLowerCase()}:${entry.version}`;
    assert(entry.logical_uri === expectedLogicalUri, `${label}: logical_uri must deterministically match protocol_id and version`);

    const identityKey = `${entry.protocol_id}\u0000${entry.version}`;
    assert(!identityKeys.has(identityKey), `${label}: duplicate protocol_id/version`);
    identityKeys.add(identityKey);
    assert(!logicalUris.has(entry.logical_uri), `${label}: duplicate logical_uri`);
    logicalUris.add(entry.logical_uri);
    assert(!releaseTags.has(entry.release_tag), `${label}: release tag reused by multiple entries`);
    releaseTags.add(entry.release_tag);

    assert(safeTag(entry.release_tag), `${label}: unsafe release_tag`);
    assert(sha1(entry.release_commit), `${label}: invalid release_commit`);
    assert(sha1(entry.release_tree), `${label}: invalid release_tree`);
    assert(sha1(entry.release_manifest_git_blob_sha), `${label}: invalid release_manifest_git_blob_sha`);
    assert(sha1(entry.publication_checkpoint_git_blob_sha), `${label}: invalid publication_checkpoint_git_blob_sha`);
    assert(safeRepositoryPath(entry.release_manifest_path), `${label}: unsafe release_manifest_path`);
    assert(safeRepositoryPath(entry.publication_checkpoint_path), `${label}: unsafe publication_checkpoint_path`);
    assert(Array.isArray(entry.conformance_levels) && entry.conformance_levels.length > 0, `${label}: missing conformance_levels`);
    assert(new Set(entry.conformance_levels).size === entry.conformance_levels.length, `${label}: duplicate conformance level`);

    const tagRef = `refs/tags/${entry.release_tag}`;
    const actualCommit = git(['rev-parse', '--verify', `${tagRef}^{commit}`]);
    assert(actualCommit === entry.release_commit, `${label}: tag drift; expected commit ${entry.release_commit}, got ${actualCommit}`);

    const actualTree = git(['rev-parse', '--verify', `${tagRef}^{tree}`]);
    assert(actualTree === entry.release_tree, `${label}: release tree mismatch; expected ${entry.release_tree}, got ${actualTree}`);

    const actualManifestBlob = git(['rev-parse', '--verify', `${tagRef}:${entry.release_manifest_path}`]);
    assert(actualManifestBlob === entry.release_manifest_git_blob_sha, `${label}: tagged release-manifest blob mismatch`);

    const checkpointAbsolute = path.resolve(repoRoot, entry.publication_checkpoint_path);
    assert(checkpointAbsolute.startsWith(repoRoot + path.sep), `${label}: checkpoint path escapes repository`);
    assert(fs.existsSync(checkpointAbsolute), `${label}: publication checkpoint does not exist`);
    const actualCheckpointBlob = git(['hash-object', entry.publication_checkpoint_path]);
    assert(actualCheckpointBlob === entry.publication_checkpoint_git_blob_sha, `${label}: publication checkpoint blob mismatch`);

    const taggedManifest = JSON.parse(git(['cat-file', 'blob', actualManifestBlob]));
    assert(taggedManifest.artifact_type === 'CCRPReleaseManifest' || entry.protocol_id !== 'CCRP', `${label}: CCRP release manifest artifact_type mismatch`);
    assert(taggedManifest.protocol && taggedManifest.protocol.id === entry.protocol_id, `${label}: release manifest protocol_id mismatch`);
    assert(taggedManifest.protocol.version === entry.version, `${label}: release manifest version mismatch`);
    assert(taggedManifest.protocol.semantic_source_status === entry.semantic_source_status, `${label}: semantic source status mismatch`);
    assert(taggedManifest.release && taggedManifest.release.planned_tag === entry.release_tag, `${label}: release manifest tag mismatch`);
    assert(
      taggedManifest.conformance && JSON.stringify(taggedManifest.conformance.levels) === JSON.stringify(entry.conformance_levels),
      `${label}: conformance level mismatch`
    );

    const checkpoint = readJson(checkpointAbsolute);
    assert(checkpoint.release && checkpoint.release.tag === entry.release_tag, `${label}: checkpoint tag mismatch`);
    assert(checkpoint.release.commit === entry.release_commit, `${label}: checkpoint commit mismatch`);
    assert(checkpoint.release.tree === entry.release_tree, `${label}: checkpoint tree mismatch`);
  }

  assert(Array.isArray(registry.non_claims) && registry.non_claims.length > 0, 'Registry non_claims must not be empty');
  assert(new Set(registry.non_claims).size === registry.non_claims.length, 'Registry non_claims must be unique');
  for (const claim of [
    'universal_canonicality_established',
    'version_compatibility_established',
    'dependency_solution_established',
    'poai_v_conformance_established',
    'materialization_permission_established'
  ]) {
    assert(registry.non_claims.includes(claim), `Required non-claim missing: ${claim}`);
  }

  console.log(JSON.stringify({
    registry_id: registry.registry_id,
    resolution: registry.resolution_policy.selection,
    entries: registry.entries.length,
    registered_protocols: registry.entries.map((entry) => `${entry.protocol_id}@${entry.version}`),
    git_binding_integrity: 'passed'
  }, null, 2));
})();
