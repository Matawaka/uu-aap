'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const here = __dirname;
const repoRoot = path.resolve(here, '../../..');
const manifestPath = path.join(here, 'release-manifest.json');
const schemaPath = path.join(here, 'release-manifest.schema.json');

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exactKeys(object, required, allowed, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: expected object`);
  for (const key of required) assert(Object.prototype.hasOwnProperty.call(object, key), `${label}: missing ${key}`);
  for (const key of Object.keys(object)) assert(allowed.includes(key), `${label}: unexpected property ${key}`);
}

function safeRepositoryPath(value) {
  return typeof value === 'string' &&
    value.length > 0 &&
    !path.isAbsolute(value) &&
    !value.split('/').includes('..');
}

function gitBlobSha(repositoryPath) {
  const absolute = path.resolve(repoRoot, repositoryPath);
  assert(
    absolute === repoRoot || absolute.startsWith(repoRoot + path.sep),
    `Path escapes repository: ${repositoryPath}`
  );
  assert(fs.existsSync(absolute), `Bound path does not exist: ${repositoryPath}`);
  return cp.execFileSync('git', ['hash-object', repositoryPath], {
    cwd: repoRoot,
    encoding: 'utf8'
  }).trim();
}

function verifyBindings(items, label, requireConformance) {
  assert(Array.isArray(items), `${label}: expected array`);
  const ids = new Set();
  const paths = new Set();

  for (const item of items) {
    const required = requireConformance
      ? ['id', 'role', 'conformance', 'path', 'git_blob_sha', 'media_type', 'normative']
      : ['id', 'role', 'path', 'git_blob_sha', 'media_type'];
    const allowed = required.slice();
    exactKeys(item, required, allowed, `${label}:${item && item.id || 'unknown'}`);

    assert(typeof item.id === 'string' && item.id.length > 0, `${label}: missing id`);
    assert(!ids.has(item.id), `${label}: duplicate id ${item.id}`);
    ids.add(item.id);

    assert(typeof item.role === 'string' && item.role.length > 0, `${label}:${item.id}: missing role`);
    assert(safeRepositoryPath(item.path), `${label}:${item.id}: unsafe path ${item.path}`);
    assert(!paths.has(item.path), `${label}: duplicate path ${item.path}`);
    paths.add(item.path);

    assert(
      typeof item.git_blob_sha === 'string' && /^[0-9a-f]{40}$/.test(item.git_blob_sha),
      `${label}:${item.id}: invalid git_blob_sha`
    );
    assert(typeof item.media_type === 'string' && item.media_type.length > 0, `${label}:${item.id}: missing media_type`);

    if (requireConformance) {
      assert(Array.isArray(item.conformance) && item.conformance.length > 0, `${label}:${item.id}: missing conformance`);
      for (const level of item.conformance) {
        assert(['C0', 'C1', 'C2', 'C3', 'C4', 'C5'].includes(level), `${label}:${item.id}: invalid conformance ${level}`);
      }
      assert(new Set(item.conformance).size === item.conformance.length, `${label}:${item.id}: duplicate conformance level`);
      assert(typeof item.normative === 'boolean', `${label}:${item.id}: normative must be boolean`);
    }

    const actual = gitBlobSha(item.path);
    assert(
      actual === item.git_blob_sha,
      `${label}: blob mismatch for ${item.path}; expected ${item.git_blob_sha}, got ${actual}`
    );
  }
}

(function main() {
  const manifest = readJson(manifestPath);
  const schema = readJson(schemaPath);

  assert(
    schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
    'Release schema must declare JSON Schema Draft 2020-12'
  );

  exactKeys(
    manifest,
    ['$schema', 'artifact_type', 'artifact_version', 'release_id', 'protocol', 'lineage', 'release', 'conformance', 'binding_model', 'artifacts', 'external_dependencies', 'non_claims'],
    ['$schema', 'artifact_type', 'artifact_version', 'release_id', 'protocol', 'lineage', 'release', 'conformance', 'binding_model', 'artifacts', 'external_dependencies', 'non_claims'],
    'manifest'
  );

  assert(manifest.$schema === './release-manifest.schema.json', 'Manifest schema binding must be local and exact');
  assert(manifest.artifact_type === 'CCRPReleaseManifest', 'Unexpected artifact_type');
  assert(manifest.artifact_version === '1.0', 'Unexpected artifact_version');
  assert(manifest.release_id === 'urn:ccrp:release:v0.1', 'Unexpected release_id');

  exactKeys(
    manifest.protocol,
    ['id', 'name', 'version', 'status', 'semantic_source_status', 'repository'],
    ['id', 'name', 'version', 'status', 'semantic_source_status', 'repository'],
    'protocol'
  );
  assert(manifest.protocol.id === 'CCRP', 'Protocol id must be CCRP');
  assert(manifest.protocol.version === '0.1', 'Protocol version must be 0.1');
  assert(manifest.protocol.repository === 'github:Matawaka/uu-aap', 'Repository binding mismatch');
  assert(['release_candidate', 'released'].includes(manifest.protocol.status), 'Invalid protocol status');

  exactKeys(
    manifest.lineage,
    ['predecessor_checkpoint', 'promotion_policy'],
    ['predecessor_checkpoint', 'promotion_policy'],
    'lineage'
  );
  exactKeys(
    manifest.lineage.predecessor_checkpoint,
    ['tag', 'commit', 'role'],
    ['tag', 'commit', 'role'],
    'lineage.predecessor_checkpoint'
  );
  assert(manifest.lineage.predecessor_checkpoint.tag === 'poai-ccrp-exp-v0.1', 'Frozen predecessor tag mismatch');
  assert(
    manifest.lineage.predecessor_checkpoint.commit === '33215e251310105e2fac591b17ae2d90522488d9',
    'Frozen predecessor commit mismatch'
  );
  assert(
    manifest.lineage.promotion_policy === 'content_addressed_binding_without_historical_rewrite',
    'Promotion policy mismatch'
  );

  exactKeys(
    manifest.release,
    ['planned_tag', 'target_policy', 'immutable_tag_required', 'github_release_required', 'canonical_state_update_after_publication'],
    ['planned_tag', 'target_policy', 'immutable_tag_required', 'github_release_required', 'canonical_state_update_after_publication'],
    'release'
  );
  assert(manifest.release.planned_tag === 'poai-ccrp-v0.1', 'Planned release tag mismatch');
  assert(manifest.release.target_policy === 'merge_commit_containing_this_manifest', 'Release target policy mismatch');
  assert(manifest.release.immutable_tag_required === true, 'Release tag must be immutable');
  assert(manifest.release.github_release_required === true, 'GitHub Release publication must be required');
  assert(manifest.release.canonical_state_update_after_publication === true, 'Canonical state must update after publication');

  exactKeys(
    manifest.conformance,
    ['levels', 'release_binding_validator', 'required_existing_checks', 'release_check'],
    ['levels', 'release_binding_validator', 'required_existing_checks', 'release_check'],
    'conformance'
  );
  const expectedLevels = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5'];
  assert(JSON.stringify(manifest.conformance.levels) === JSON.stringify(expectedLevels), 'Conformance levels must be exactly C0-C5');
  assert(
    manifest.conformance.release_binding_validator === 'protocols/ccrp/v0.1/validate-release.js',
    'Release validator path mismatch'
  );
  assert(manifest.conformance.release_check === 'CCRP release binding validation', 'Release check name mismatch');

  const expectedChecks = [
    'PoAI Genesis validation',
    'PoAI Authority Root validation',
    'CCRP validation',
    'PoAI CCRP pre-materialization validation'
  ];
  assert(
    JSON.stringify(manifest.conformance.required_existing_checks) === JSON.stringify(expectedChecks),
    'Existing required-check inventory mismatch'
  );

  exactKeys(
    manifest.binding_model,
    ['strategy', 'git_object_format', 'verification_command', 'copy_required', 'meaning'],
    ['strategy', 'git_object_format', 'verification_command', 'copy_required', 'meaning'],
    'binding_model'
  );
  assert(manifest.binding_model.strategy === 'repository_path_plus_git_blob_sha', 'Binding strategy mismatch');
  assert(manifest.binding_model.git_object_format === 'sha1', 'Git object format must be sha1 for this release');
  assert(manifest.binding_model.verification_command === 'git hash-object <path>', 'Verification command mismatch');
  assert(manifest.binding_model.copy_required === false, 'Release must not require duplicated implementation copies');

  assert(manifest.artifacts.length > 0, 'Artifact inventory must not be empty');
  verifyBindings(manifest.artifacts, 'artifacts', true);
  verifyBindings(manifest.external_dependencies, 'external_dependencies', false);

  const artifactIds = new Set(manifest.artifacts.map((artifact) => artifact.id));
  assert(artifactIds.has('ccrp-spec'), 'Normative CCRP specification binding is missing');
  const spec = manifest.artifacts.find((artifact) => artifact.id === 'ccrp-spec');
  assert(spec.normative === true && spec.role === 'normative_specification', 'CCRP specification role must be normative');

  for (const level of expectedLevels) {
    assert(
      manifest.artifacts.some((artifact) => artifact.conformance.includes(level)),
      `No release artifact represents ${level}`
    );
  }

  const requiredRoles = [
    'normative_specification',
    'schema',
    'reference_implementation',
    'conformance_test',
    'historical_checkpoint',
    'validation_workflow'
  ];
  for (const role of requiredRoles) {
    assert(manifest.artifacts.some((artifact) => artifact.role === role), `Required artifact role missing: ${role}`);
  }

  assert(Array.isArray(manifest.non_claims) && manifest.non_claims.length > 0, 'Explicit non-claims are required');
  assert(new Set(manifest.non_claims).size === manifest.non_claims.length, 'Duplicate non-claim');
  const requiredNonClaims = [
    'factual_truth_certified',
    'legal_authority_established',
    'universal_canonicality_established',
    'poai_v_conformance_established',
    'materialization_event_recorded_by_release_manifest'
  ];
  for (const nonClaim of requiredNonClaims) {
    assert(manifest.non_claims.includes(nonClaim), `Required non-claim missing: ${nonClaim}`);
  }

  console.log(JSON.stringify({
    release_id: manifest.release_id,
    protocol_status: manifest.protocol.status,
    predecessor_tag: manifest.lineage.predecessor_checkpoint.tag,
    planned_tag: manifest.release.planned_tag,
    conformance_levels: manifest.conformance.levels,
    bound_artifacts: manifest.artifacts.length,
    external_dependencies: manifest.external_dependencies.length,
    binding_integrity: 'passed'
  }, null, 2));
})();
