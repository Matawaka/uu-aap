'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const here = __dirname;
const repoRoot = path.resolve(here, '../../..');
const registryPath = path.resolve(repoRoot, 'protocols/registry/v0.1/registry.json');
const defaultAttestationPath = path.join(here, 'attestations/ccrp-reference-implementation.v0.1.json');

function fail(message) { throw new Error(message); }
function assert(condition, message) { if (!condition) fail(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function git(args) { return cp.execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim(); }
function sha1(value) { return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value); }
function safePath(value) { return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.split('/').includes('..'); }
function safeTmpJson(value) { return typeof value === 'string' && /^\/tmp\/[A-Za-z0-9._-]+\.json$/.test(value); }

function exactKeys(object, keys, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: expected object`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(object, key), `${label}: missing ${key}`);
  for (const key of Object.keys(object)) assert(keys.includes(key), `${label}: unexpected property ${key}`);
}

function currentBlob(repositoryPath) {
  assert(safePath(repositoryPath), `unsafe repository path: ${repositoryPath}`);
  const absolute = path.resolve(repoRoot, repositoryPath);
  assert(absolute.startsWith(repoRoot + path.sep), `path escapes repository: ${repositoryPath}`);
  assert(fs.existsSync(absolute), `bound path does not exist: ${repositoryPath}`);
  return git(['hash-object', repositoryPath]);
}

function validateReleaseBoundArtifacts(items, releaseMap, expectedRole, label) {
  assert(Array.isArray(items) && items.length > 0, `${label}: artifact list must not be empty`);
  const paths = new Set();
  for (const item of items) {
    exactKeys(item, ['path', 'git_blob_sha'], `${label}:${item && item.path || 'unknown'}`);
    assert(safePath(item.path), `${label}: unsafe path ${item.path}`);
    assert(sha1(item.git_blob_sha), `${label}:${item.path}: invalid blob SHA`);
    assert(!paths.has(item.path), `${label}: duplicate path ${item.path}`);
    paths.add(item.path);
    const releaseArtifact = releaseMap.get(item.path);
    assert(releaseArtifact, `${label}:${item.path}: not bound by immutable release manifest`);
    if (expectedRole) assert(releaseArtifact.role === expectedRole, `${label}:${item.path}: expected release role ${expectedRole}, got ${releaseArtifact.role}`);
    assert(releaseArtifact.git_blob_sha === item.git_blob_sha, `${label}:${item.path}: attestation blob disagrees with release manifest`);
    const actual = currentBlob(item.path);
    assert(actual === item.git_blob_sha, `${label}:${item.path}: current repository blob drift; expected ${item.git_blob_sha}, got ${actual}`);
  }
}

function validateHarnessArtifacts(items, label) {
  assert(Array.isArray(items) && items.length > 0, `${label}: harness artifacts must not be empty`);
  const paths = new Set();
  for (const item of items) {
    exactKeys(item, ['path', 'git_blob_sha'], `${label}:${item && item.path || 'unknown'}`);
    assert(safePath(item.path), `${label}: unsafe path ${item.path}`);
    assert(sha1(item.git_blob_sha), `${label}:${item.path}: invalid blob SHA`);
    assert(!paths.has(item.path), `${label}: duplicate path ${item.path}`);
    paths.add(item.path);
    const actual = currentBlob(item.path);
    assert(actual === item.git_blob_sha, `${label}:${item.path}: harness blob drift; expected ${item.git_blob_sha}, got ${actual}`);
  }
}

function runNode(args, label) {
  const run = cp.spawnSync('node', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (run.error) fail(`${label}: execution error: ${run.error.message}`);
  assert(run.status === 0, `${label}: command failed with exit ${run.status}\n${run.stdout || ''}\n${run.stderr || ''}`);
}

function verifyAttestation(attestation, options = {}) {
  const rerunTests = options.rerunTests !== false;
  const registry = readJson(registryPath);

  exactKeys(attestation, [
    '$schema','artifact_type','artifact_version','attestation_id','scope','subject','protocol_binding',
    'dependency_artifacts','setup_evidence','attested_conformance_levels','test_evidence','verification_policy','non_claims'
  ], 'attestation');

  assert(attestation.$schema === '../capability-attestation.schema.json', 'attestation: schema binding mismatch');
  assert(attestation.artifact_type === 'ProtocolCapabilityAttestation', 'attestation: unexpected artifact_type');
  assert(attestation.artifact_version === '0.1', 'attestation: unexpected artifact_version');
  assert(attestation.scope === 'repository_scoped_reproducible_conformance', 'attestation: unexpected scope');
  assert(typeof attestation.attestation_id === 'string' && attestation.attestation_id.length > 0, 'attestation: missing attestation_id');

  exactKeys(attestation.subject, ['subject_id','kind','repository','artifact_set'], 'subject');
  assert(attestation.subject.kind === 'repository_reference_implementation', 'subject: unsupported kind');
  assert(attestation.subject.repository === 'github:Matawaka/uu-aap', 'subject: repository mismatch');

  const binding = attestation.protocol_binding;
  exactKeys(binding, ['registry_id','protocol_id','version','logical_uri','release_tag','release_commit','release_manifest_path','release_manifest_git_blob_sha'], 'protocol_binding');
  assert(binding.registry_id === registry.registry_id, 'protocol_binding: registry_id mismatch');
  const matches = registry.entries.filter((entry) => entry.protocol_id === binding.protocol_id && entry.version === binding.version);
  assert(matches.length === 1, 'protocol_binding: exact protocol/version is not uniquely registered');
  const entry = matches[0];
  assert(binding.logical_uri === entry.logical_uri, 'protocol_binding: logical_uri drift');
  assert(binding.release_tag === entry.release_tag, 'protocol_binding: release_tag drift');
  assert(binding.release_commit === entry.release_commit, 'protocol_binding: release_commit drift');
  assert(binding.release_manifest_path === entry.release_manifest_path, 'protocol_binding: release_manifest_path drift');
  assert(binding.release_manifest_git_blob_sha === entry.release_manifest_git_blob_sha, 'protocol_binding: release_manifest blob drift');

  const tagRef = `refs/tags/${binding.release_tag}`;
  assert(git(['rev-parse','--verify',`${tagRef}^{commit}`]) === binding.release_commit, 'protocol_binding: release tag moved');
  const taggedManifestBlob = git(['rev-parse','--verify',`${tagRef}:${binding.release_manifest_path}`]);
  assert(taggedManifestBlob === binding.release_manifest_git_blob_sha, 'protocol_binding: tagged release manifest blob mismatch');
  const releaseManifest = JSON.parse(git(['cat-file','blob',taggedManifestBlob]));
  assert(releaseManifest.protocol.id === binding.protocol_id && releaseManifest.protocol.version === binding.version, 'release manifest: protocol/version mismatch');
  assert(releaseManifest.release.planned_tag === binding.release_tag, 'release manifest: tag mismatch');

  const releaseArtifacts = new Map(releaseManifest.artifacts.map((artifact) => [artifact.path, artifact]));
  const releaseDependencies = new Map(releaseManifest.external_dependencies.map((artifact) => [artifact.path, artifact]));
  validateReleaseBoundArtifacts(attestation.subject.artifact_set, releaseArtifacts, 'reference_implementation', 'subject.artifact_set');
  validateReleaseBoundArtifacts(attestation.dependency_artifacts, releaseDependencies, null, 'dependency_artifacts');

  const allowedLevels = new Set(['C0','C1','C2','C3','C4','C5']);
  assert(Array.isArray(attestation.attested_conformance_levels) && attestation.attested_conformance_levels.length > 0, 'attested_conformance_levels: empty');
  assert(new Set(attestation.attested_conformance_levels).size === attestation.attested_conformance_levels.length, 'attested_conformance_levels: duplicates');
  for (const level of attestation.attested_conformance_levels) assert(allowedLevels.has(level), `attested_conformance_levels: unknown ${level}`);

  assert(Array.isArray(attestation.setup_evidence), 'setup_evidence: expected array');
  const setupLevels = new Set();
  let harnessArtifactCount = 0;
  const executedSetup = [];
  for (const setup of attestation.setup_evidence) {
    exactKeys(setup, ['level','harness_artifacts','runner','expected_exit_code'], `setup_evidence:${setup && setup.level || 'unknown'}`);
    assert(allowedLevels.has(setup.level), `setup_evidence: unknown level ${setup.level}`);
    assert(attestation.attested_conformance_levels.includes(setup.level), `setup_evidence:${setup.level}: level not attested`);
    assert(!setupLevels.has(setup.level), `setup_evidence:${setup.level}: duplicate level`);
    setupLevels.add(setup.level);
    validateHarnessArtifacts(setup.harness_artifacts, `setup_evidence:${setup.level}.harness_artifacts`);
    harnessArtifactCount += setup.harness_artifacts.length;
    exactKeys(setup.runner, ['executable','args'], `setup_evidence:${setup.level}.runner`);
    assert(setup.runner.executable === 'node', `setup_evidence:${setup.level}: only node runner is allowed`);
    assert(Array.isArray(setup.runner.args) && setup.runner.args.length === 3, `setup_evidence:${setup.level}: runner must have exactly three arguments`);
    assert(setup.harness_artifacts.some((item) => item.path === setup.runner.args[0]), `setup_evidence:${setup.level}: executable script is not a bound harness artifact`);
    assert(safeTmpJson(setup.runner.args[1]) && safeTmpJson(setup.runner.args[2]), `setup_evidence:${setup.level}: setup outputs must be constrained /tmp JSON paths`);
    assert(setup.runner.args[1] !== setup.runner.args[2], `setup_evidence:${setup.level}: setup outputs must be distinct`);
    assert(setup.expected_exit_code === 0, `setup_evidence:${setup.level}: expected exit code must be 0`);
    if (rerunTests) {
      runNode(setup.runner.args, `setup_evidence:${setup.level}`);
      executedSetup.push(setup.level);
    }
  }
  if (attestation.attested_conformance_levels.includes('C5')) assert(setupLevels.has('C5'), 'setup_evidence: C5 requires explicit reproducible setup evidence');

  assert(Array.isArray(attestation.test_evidence), 'test_evidence: expected array');
  assert(attestation.test_evidence.length === attestation.attested_conformance_levels.length, 'test_evidence: must cover each attested level exactly once');
  const evidenceLevels = new Set();
  const executed = [];
  for (const evidence of attestation.test_evidence) {
    exactKeys(evidence, ['level','test_path','git_blob_sha','runner','expected_exit_code'], `test_evidence:${evidence && evidence.level || 'unknown'}`);
    assert(allowedLevels.has(evidence.level), `test_evidence: unknown level ${evidence.level}`);
    assert(attestation.attested_conformance_levels.includes(evidence.level), `test_evidence:${evidence.level}: level not attested`);
    assert(!evidenceLevels.has(evidence.level), `test_evidence:${evidence.level}: duplicate level`);
    evidenceLevels.add(evidence.level);
    assert(safePath(evidence.test_path) && sha1(evidence.git_blob_sha), `test_evidence:${evidence.level}: invalid test binding`);
    assert(evidence.expected_exit_code === 0, `test_evidence:${evidence.level}: expected exit code must be 0`);
    const releaseTest = releaseArtifacts.get(evidence.test_path);
    assert(releaseTest && releaseTest.role === 'conformance_test', `test_evidence:${evidence.level}: test is not a release conformance_test`);
    assert(releaseTest.conformance.includes(evidence.level), `test_evidence:${evidence.level}: release test does not cover this level`);
    assert(releaseTest.git_blob_sha === evidence.git_blob_sha, `test_evidence:${evidence.level}: test blob disagrees with release manifest`);
    assert(currentBlob(evidence.test_path) === evidence.git_blob_sha, `test_evidence:${evidence.level}: current test blob drift`);
    exactKeys(evidence.runner, ['executable','args'], `test_evidence:${evidence.level}.runner`);
    assert(evidence.runner.executable === 'node', `test_evidence:${evidence.level}: only node runner is allowed`);
    assert(Array.isArray(evidence.runner.args) && evidence.runner.args.length === 1 && evidence.runner.args[0] === evidence.test_path, `test_evidence:${evidence.level}: command substitution detected`);
    if (rerunTests) {
      runNode([evidence.test_path], `test_evidence:${evidence.level}`);
      executed.push(evidence.level);
    }
  }
  for (const level of attestation.attested_conformance_levels) assert(evidenceLevels.has(level), `test_evidence: missing ${level}`);

  exactKeys(attestation.verification_policy, ['rerun_required','implementation_blob_match_required','dependency_blob_match_required','setup_harness_blob_match_required','test_blob_match_required','release_manifest_membership_required','command_binding'], 'verification_policy');
  for (const key of ['rerun_required','implementation_blob_match_required','dependency_blob_match_required','setup_harness_blob_match_required','test_blob_match_required','release_manifest_membership_required']) assert(attestation.verification_policy[key] === true, `verification_policy: ${key} must be true`);
  assert(attestation.verification_policy.command_binding === 'node_bound_paths_only', 'verification_policy: unsupported command binding');

  assert(Array.isArray(attestation.non_claims) && attestation.non_claims.length > 0, 'non_claims: empty');
  assert(new Set(attestation.non_claims).size === attestation.non_claims.length, 'non_claims: duplicates');
  for (const claim of ['production_deployment_identity_established','universal_operational_capability_established','legal_authority_established','execution_admission_established','materialization_permission_established']) assert(attestation.non_claims.includes(claim), `non_claims: required boundary missing ${claim}`);

  return {
    attestation_id: attestation.attestation_id,
    subject_id: attestation.subject.subject_id,
    protocol: `${binding.protocol_id}@${binding.version}`,
    release_commit: binding.release_commit,
    attested_conformance_levels: attestation.attested_conformance_levels,
    implementation_artifacts_verified: attestation.subject.artifact_set.length,
    dependency_artifacts_verified: attestation.dependency_artifacts.length,
    setup_harness_artifacts_verified: harnessArtifactCount,
    setup_levels_rerun: executedSetup,
    conformance_tests_verified: attestation.test_evidence.length,
    rerun_levels: executed,
    status: rerunTests ? 'reproducible_conformance_evidence' : 'binding_verification_passed'
  };
}

if (require.main === module) {
  const file = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultAttestationPath;
  console.log(JSON.stringify(verifyAttestation(readJson(file), { rerunTests: true }), null, 2));
}

module.exports = { verifyAttestation, readJson };
