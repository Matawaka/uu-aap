#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MANIFEST_VERSION = '0.1';
const EDGE_KINDS = new Set([
  'RUNTIME_IMPORT',
  'SCHEMA',
  'EVIDENCE',
  'CONFORMANCE',
  'TRANSPORT',
  'OPTIONAL_ADAPTER',
  'TEST_ONLY'
]);
const COMPONENT_KINDS = new Set([
  'CORE', 'PROFILE', 'RUNTIME', 'ADAPTER', 'TRANSPORT', 'PRODUCT', 'APPLICATION', 'TOOLING'
]);
const STATUSES = new Set(['stable', 'experimental', 'candidate', 'historical']);
const EXECUTABLES = new Set(['node', 'python', 'python3']);
const REQUIRED_NON_EFFECTS = new Set([
  'manifest_presence_does_not_publish_or_release',
  'dependency_edge_does_not_transfer_authority',
  'declared_interface_does_not_prove_compatibility',
  'manifest_validation_does_not_attest_runtime_behavior',
  'manifest_presence_does_not_activate_runtime'
]);

function fail(message) {
  const error = new Error(message);
  error.name = 'ComponentManifestValidationError';
  throw error;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertExactKeys(object, allowed, location) {
  if (!isPlainObject(object)) fail(`${location} must be an object`);
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) fail(`${location} contains unknown field: ${key}`);
  }
}

function assertString(value, location) {
  if (typeof value !== 'string' || value.length === 0) fail(`${location} must be a non-empty string`);
}

function assertStringArray(value, location) {
  if (!Array.isArray(value)) fail(`${location} must be an array`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${location}[${index}]`);
    if (seen.has(item)) fail(`${location} contains duplicate value: ${item}`);
    seen.add(item);
  });
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const output = {};
    for (const key of Object.keys(value).sort()) output[key] = canonicalize(value[key]);
    return output;
  }
  return value;
}

function identityProjection(manifest) {
  return { ...manifest, content_hash: '' };
}

function computeContentHash(manifest) {
  const compact = JSON.stringify(canonicalize(identityProjection(manifest)));
  return `sha256:${crypto.createHash('sha256').update(compact, 'utf8').digest('hex')}`;
}

function validateExports(exports) {
  assertExactKeys(exports, new Set(['interfaces', 'receipt_types', 'schemas', 'runtime_entrypoints']), 'exports');
  for (const field of ['interfaces', 'receipt_types', 'schemas', 'runtime_entrypoints']) {
    assertStringArray(exports[field], `exports.${field}`);
  }
}

function validateDependencies(dependencies) {
  if (!Array.isArray(dependencies)) fail('dependencies must be an array');
  const seen = new Set();
  dependencies.forEach((dependency, index) => {
    const location = `dependencies[${index}]`;
    assertExactKeys(dependency, new Set(['component_id', 'edge_kind', 'required', 'interface', 'notes']), location);
    assertString(dependency.component_id, `${location}.component_id`);
    if (!EDGE_KINDS.has(dependency.edge_kind)) fail(`${location}.edge_kind is not supported: ${dependency.edge_kind}`);
    if (typeof dependency.required !== 'boolean') fail(`${location}.required must be boolean`);
    if (dependency.interface !== undefined && dependency.interface !== null) assertString(dependency.interface, `${location}.interface`);
    if (dependency.notes !== undefined && dependency.notes !== null) assertString(dependency.notes, `${location}.notes`);
    const key = `${dependency.component_id}\u0000${dependency.edge_kind}\u0000${dependency.interface || ''}`;
    if (seen.has(key)) fail(`duplicate dependency edge: ${dependency.component_id} ${dependency.edge_kind}`);
    seen.add(key);
  });
}

function validateConformance(conformance) {
  assertExactKeys(conformance, new Set(['commands']), 'conformance');
  if (!Array.isArray(conformance.commands)) fail('conformance.commands must be an array');
  conformance.commands.forEach((command, index) => {
    const location = `conformance.commands[${index}]`;
    assertExactKeys(command, new Set(['executable', 'args']), location);
    if (!EXECUTABLES.has(command.executable)) fail(`${location}.executable is not allowed`);
    if (!Array.isArray(command.args) || command.args.length === 0) fail(`${location}.args must be a non-empty array`);
    command.args.forEach((arg, argIndex) => {
      assertString(arg, `${location}.args[${argIndex}]`);
      if (/\b(?:sh|bash|zsh|cmd|powershell)\b/.test(arg) || /[;&|`]/.test(arg)) {
        fail(`${location} contains shell-composed argument: ${arg}`);
      }
    });
  });
}

function validateEffectCeiling(effectCeiling) {
  const fields = [
    'external_effect_emission',
    'runtime_activation',
    'execution_admission',
    'creates_authority',
    'accepts_responsibility'
  ];
  assertExactKeys(effectCeiling, new Set(fields), 'effect_ceiling');
  for (const field of fields) {
    if (typeof effectCeiling[field] !== 'boolean') fail(`effect_ceiling.${field} must be boolean`);
    if (effectCeiling[field] !== false) {
      fail(`Component Manifest v0.1 first slice is no-effect metadata; effect_ceiling.${field} must be false`);
    }
  }
}

function validateCanonicalization(canonicalization) {
  assertExactKeys(canonicalization, new Set(['mode', 'profile_ref']), 'canonicalization');
  if (!['component_local', 'named_profile'].includes(canonicalization.mode)) fail('canonicalization.mode is invalid');
  if (canonicalization.mode === 'component_local' && canonicalization.profile_ref !== null) {
    fail('component_local canonicalization requires profile_ref=null');
  }
  if (canonicalization.mode === 'named_profile') assertString(canonicalization.profile_ref, 'canonicalization.profile_ref');
}

function validateRepositoryPaths(manifest, repositoryRoot) {
  const paths = [manifest.component.path, ...manifest.exports.schemas, ...manifest.exports.runtime_entrypoints];
  for (const relativePath of paths) {
    const normalized = path.normalize(relativePath);
    if (path.isAbsolute(relativePath) || normalized.startsWith('..')) fail(`repository path escapes root: ${relativePath}`);
    if (!fs.existsSync(path.join(repositoryRoot, normalized))) fail(`repository path does not exist: ${relativePath}`);
  }
}

function validateManifest(manifest, options = {}) {
  const repositoryRoot = options.repositoryRoot || process.cwd();
  assertExactKeys(manifest, new Set([
    'artifact_type', 'manifest_version', 'component', 'source_frontier', 'exports', 'dependencies',
    'conformance', 'effect_ceiling', 'canonicalization', 'evolution_ref', 'non_effects', 'content_hash'
  ]), 'manifest');

  if (manifest.artifact_type !== 'UU-AAP-Component-Manifest') fail('artifact_type must be UU-AAP-Component-Manifest');
  if (manifest.manifest_version !== MANIFEST_VERSION) fail(`manifest_version must be ${MANIFEST_VERSION}`);

  assertExactKeys(manifest.component, new Set(['id', 'version', 'kind', 'status', 'path']), 'component');
  assertString(manifest.component.id, 'component.id');
  assertString(manifest.component.version, 'component.version');
  if (!COMPONENT_KINDS.has(manifest.component.kind)) fail(`unsupported component.kind: ${manifest.component.kind}`);
  if (!STATUSES.has(manifest.component.status)) fail(`unsupported component.status: ${manifest.component.status}`);
  assertString(manifest.component.path, 'component.path');

  assertExactKeys(manifest.source_frontier, new Set(['repository', 'revision']), 'source_frontier');
  assertString(manifest.source_frontier.repository, 'source_frontier.repository');
  if (!/^[0-9a-f]{40}$/.test(manifest.source_frontier.revision)) fail('source_frontier.revision must be a 40-character lowercase Git SHA');

  validateExports(manifest.exports);
  validateDependencies(manifest.dependencies);
  validateConformance(manifest.conformance);
  validateEffectCeiling(manifest.effect_ceiling);
  validateCanonicalization(manifest.canonicalization);

  if (manifest.evolution_ref !== null && manifest.evolution_ref !== undefined) assertString(manifest.evolution_ref, 'evolution_ref');
  assertStringArray(manifest.non_effects, 'non_effects');
  for (const required of REQUIRED_NON_EFFECTS) {
    if (!manifest.non_effects.includes(required)) fail(`missing required non_effect: ${required}`);
  }

  validateRepositoryPaths(manifest, repositoryRoot);

  if (!/^sha256:[0-9a-f]{64}$/.test(manifest.content_hash)) fail('content_hash must be sha256:<64 lowercase hex>');
  const expectedHash = computeContentHash(manifest);
  if (manifest.content_hash !== expectedHash) fail(`content_hash mismatch: expected ${expectedHash}`);

  return {
    valid: true,
    component_id: manifest.component.id,
    component_version: manifest.component.version,
    dependency_count: manifest.dependencies.length,
    conformance_command_count: manifest.conformance.commands.length,
    content_hash: manifest.content_hash
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runCli(argv = process.argv.slice(2)) {
  if (argv.length !== 1 || argv[0] === '--help' || argv[0] === '-h') {
    const stream = argv.length === 1 ? process.stdout : process.stderr;
    stream.write('Usage: node tooling/component-manifest/v0.1/validate-component-manifest.js <manifest.json>\n');
    return argv.length === 1 ? 0 : 2;
  }
  try {
    const manifest = readJson(argv[0]);
    const result = validateManifest(manifest);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  MANIFEST_VERSION,
  EDGE_KINDS,
  canonicalize,
  identityProjection,
  computeContentHash,
  validateManifest,
  runCli
};

if (require.main === module) process.exitCode = runCli();
