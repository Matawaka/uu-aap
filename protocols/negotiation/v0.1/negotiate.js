'use strict';

const fs = require('fs');
const path = require('path');

const here = __dirname;
const registryPath = path.resolve(here, '../../registry/v0.1/registry.json');

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function exactKeys(object, keys, label) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${label}: expected object`);
  for (const key of keys) {
    assert(Object.prototype.hasOwnProperty.call(object, key), `${label}: missing ${key}`);
  }
  for (const key of Object.keys(object)) {
    assert(keys.includes(key), `${label}: unexpected property ${key}`);
  }
}

function exactVersion(value, label) {
  assert(typeof value === 'string', `${label}: version must be a string`);
  assert(value !== 'latest', `${label}: mutable latest alias is forbidden`);
  assert(
    /^[0-9]+(?:\.[0-9]+){1,2}(?:[-+][0-9A-Za-z.-]+)?$/.test(value),
    `${label}: version must be exact; ranges and aliases are forbidden`
  );
}

function levels(value, label) {
  assert(Array.isArray(value) && value.length > 0, `${label}: conformance levels must be a non-empty array`);
  for (const level of value) {
    assert(typeof level === 'string' && level.length > 0, `${label}: invalid conformance level`);
  }
  assert(new Set(value).size === value.length, `${label}: duplicate conformance level`);
}

function loadRegistry() {
  return readJson(registryPath);
}

function resolveExact(registry, protocolId, version) {
  exactVersion(version, `${protocolId || 'unknown'}@${version || 'unknown'}`);
  const matches = registry.entries.filter(
    (entry) => entry.protocol_id === protocolId && entry.version === version
  );
  if (matches.length !== 1) return null;
  return matches[0];
}

function validateDeclaration(declaration, registry) {
  const topKeys = [
    '$schema',
    'artifact_type',
    'artifact_version',
    'declaration_id',
    'subject_id',
    'assertion_mode',
    'registry_id',
    'capabilities',
    'non_claims'
  ];
  exactKeys(declaration, topKeys, 'declaration');

  assert(declaration.$schema === './capability-declaration.schema.json', 'declaration: schema binding mismatch');
  assert(declaration.artifact_type === 'ProtocolCapabilityDeclaration', 'declaration: unexpected artifact_type');
  assert(declaration.artifact_version === '0.1', 'declaration: unexpected artifact_version');
  assert(typeof declaration.declaration_id === 'string' && declaration.declaration_id.length > 0, 'declaration: missing declaration_id');
  assert(typeof declaration.subject_id === 'string' && declaration.subject_id.length > 0, 'declaration: missing subject_id');
  assert(declaration.assertion_mode === 'self_declared', 'declaration: v0.1 only supports self_declared assertions');
  assert(declaration.registry_id === registry.registry_id, 'declaration: registry_id mismatch');
  assert(Array.isArray(declaration.capabilities) && declaration.capabilities.length > 0, 'declaration: capabilities must not be empty');

  const capabilityKeys = [
    'protocol_id',
    'version',
    'logical_uri',
    'release_commit',
    'conformance_levels'
  ];
  const identities = new Set();

  for (const capability of declaration.capabilities) {
    const label = `capability:${capability && capability.protocol_id || 'unknown'}:${capability && capability.version || 'unknown'}`;
    exactKeys(capability, capabilityKeys, label);
    assert(typeof capability.protocol_id === 'string' && capability.protocol_id.length > 0, `${label}: missing protocol_id`);
    exactVersion(capability.version, label);
    levels(capability.conformance_levels, label);

    const identity = `${capability.protocol_id}\u0000${capability.version}`;
    assert(!identities.has(identity), `${label}: duplicate exact capability declaration`);
    identities.add(identity);

    const entry = resolveExact(registry, capability.protocol_id, capability.version);
    assert(entry, `${label}: protocol/version is not uniquely registered`);
    assert(capability.logical_uri === entry.logical_uri, `${label}: logical_uri disagrees with registry`);
    assert(capability.release_commit === entry.release_commit, `${label}: release_commit disagrees with registry`);

    const registeredLevels = new Set(entry.conformance_levels);
    for (const level of capability.conformance_levels) {
      assert(registeredLevels.has(level), `${label}: conformance level ${level} is not present in registered release`);
    }
  }

  assert(Array.isArray(declaration.non_claims) && declaration.non_claims.length > 0, 'declaration: non_claims must not be empty');
  assert(new Set(declaration.non_claims).size === declaration.non_claims.length, 'declaration: duplicate non-claim');
  for (const claim of [
    'verified_operational_capability_established',
    'legal_identity_established',
    'legal_authority_established',
    'materialization_permission_established'
  ]) {
    assert(declaration.non_claims.includes(claim), `declaration: required non-claim missing: ${claim}`);
  }
}

function validateRequirement(requirement, registry) {
  const topKeys = [
    '$schema',
    'artifact_type',
    'artifact_version',
    'requirement_id',
    'registry_id',
    'requirements',
    'dependency_requirements',
    'matching_policy',
    'non_claims'
  ];
  exactKeys(requirement, topKeys, 'requirement');

  assert(requirement.$schema === './capability-requirement.schema.json', 'requirement: schema binding mismatch');
  assert(requirement.artifact_type === 'ProtocolCapabilityRequirement', 'requirement: unexpected artifact_type');
  assert(requirement.artifact_version === '0.1', 'requirement: unexpected artifact_version');
  assert(typeof requirement.requirement_id === 'string' && requirement.requirement_id.length > 0, 'requirement: missing requirement_id');
  assert(requirement.registry_id === registry.registry_id, 'requirement: registry_id mismatch');
  assert(Array.isArray(requirement.requirements) && requirement.requirements.length > 0, 'requirement: requirements must not be empty');
  assert(Array.isArray(requirement.dependency_requirements), 'requirement: dependency_requirements must be an array');

  const policyKeys = [
    'version_selection',
    'implicit_upgrade',
    'infer_conformance_hierarchy',
    'missing_requirement'
  ];
  exactKeys(requirement.matching_policy, policyKeys, 'matching_policy');
  assert(requirement.matching_policy.version_selection === 'exact_only', 'matching_policy: exact versions required');
  assert(requirement.matching_policy.implicit_upgrade === false, 'matching_policy: implicit upgrades forbidden');
  assert(requirement.matching_policy.infer_conformance_hierarchy === false, 'matching_policy: conformance hierarchy inference forbidden');
  assert(requirement.matching_policy.missing_requirement === 'incompatible', 'matching_policy: missing requirements must be incompatible');

  const requirementKeys = [
    'protocol_id',
    'version',
    'logical_uri',
    'required_conformance_levels'
  ];

  const all = [
    ...requirement.requirements.map((item) => ({ kind: 'capability', item })),
    ...requirement.dependency_requirements.map((item) => ({ kind: 'dependency', item }))
  ];

  const identities = new Set();
  for (const { kind, item } of all) {
    const label = `${kind}:${item && item.protocol_id || 'unknown'}:${item && item.version || 'unknown'}`;
    exactKeys(item, requirementKeys, label);
    assert(typeof item.protocol_id === 'string' && item.protocol_id.length > 0, `${label}: missing protocol_id`);
    exactVersion(item.version, label);
    levels(item.required_conformance_levels, label);

    const expectedUri = `urn:uu-aap:protocol:${item.protocol_id.toLowerCase()}:${item.version}`;
    assert(item.logical_uri === expectedUri, `${label}: logical_uri must deterministically match protocol_id and version`);

    const identity = `${kind}\u0000${item.protocol_id}\u0000${item.version}`;
    assert(!identities.has(identity), `${label}: duplicate exact requirement`);
    identities.add(identity);
  }

  assert(Array.isArray(requirement.non_claims) && requirement.non_claims.length > 0, 'requirement: non_claims must not be empty');
  assert(new Set(requirement.non_claims).size === requirement.non_claims.length, 'requirement: duplicate non-claim');
}

function evaluateOne(kind, item, declaration, registry) {
  const entry = resolveExact(registry, item.protocol_id, item.version);
  if (!entry) {
    return {
      match: null,
      failure: `${kind}:${item.protocol_id}@${item.version}: exact protocol/version is not uniquely registered`
    };
  }

  if (item.logical_uri !== entry.logical_uri) {
    return {
      match: null,
      failure: `${kind}:${item.protocol_id}@${item.version}: logical_uri disagrees with registry`
    };
  }

  const offered = declaration.capabilities.find(
    (capability) => capability.protocol_id === item.protocol_id && capability.version === item.version
  );

  if (!offered) {
    return {
      match: {
        kind,
        protocol_id: item.protocol_id,
        version: item.version,
        logical_uri: entry.logical_uri,
        release_commit: entry.release_commit,
        required_conformance_levels: item.required_conformance_levels,
        declared_conformance_levels: [],
        missing_conformance_levels: item.required_conformance_levels,
        satisfied: false
      },
      failure: `${kind}:${item.protocol_id}@${item.version}: capability is not declared`
    };
  }

  const declaredSet = new Set(offered.conformance_levels);
  const missing = item.required_conformance_levels.filter((level) => !declaredSet.has(level));

  return {
    match: {
      kind,
      protocol_id: item.protocol_id,
      version: item.version,
      logical_uri: entry.logical_uri,
      release_commit: entry.release_commit,
      required_conformance_levels: item.required_conformance_levels,
      declared_conformance_levels: offered.conformance_levels,
      missing_conformance_levels: missing,
      satisfied: missing.length === 0
    },
    failure: missing.length === 0
      ? null
      : `${kind}:${item.protocol_id}@${item.version}: missing explicit conformance levels ${missing.join(',')}`
  };
}

function negotiate(declaration, requirement, registry = loadRegistry()) {
  validateDeclaration(declaration, registry);
  validateRequirement(requirement, registry);

  const matches = [];
  const failures = [];
  const all = [
    ...requirement.requirements.map((item) => ({ kind: 'capability', item })),
    ...requirement.dependency_requirements.map((item) => ({ kind: 'dependency', item }))
  ];

  for (const { kind, item } of all) {
    const evaluation = evaluateOne(kind, item, declaration, registry);
    if (evaluation.match) matches.push(evaluation.match);
    if (evaluation.failure) failures.push(evaluation.failure);
  }

  return {
    $schema: './negotiation-result.schema.json',
    artifact_type: 'ProtocolCapabilityNegotiationResult',
    artifact_version: '0.1',
    declaration_id: declaration.declaration_id,
    requirement_id: requirement.requirement_id,
    status: failures.length === 0 ? 'declared_compatible' : 'incompatible',
    matches,
    failures: [...new Set(failures)],
    non_claims: [
      'verified_operational_capability_established',
      'legal_identity_established',
      'legal_authority_established',
      'context_admission_established',
      'execution_admission_established',
      'poai_v_conformance_established',
      'materialization_permission_established'
    ]
  };
}

if (require.main === module) {
  const [, , declarationFile, requirementFile] = process.argv;
  if (!declarationFile || !requirementFile) {
    console.error('Usage: node negotiate.js <capability-declaration.json> <capability-requirement.json>');
    process.exit(64);
  }

  const result = negotiate(
    readJson(path.resolve(process.cwd(), declarationFile)),
    readJson(path.resolve(process.cwd(), requirementFile))
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'declared_compatible') process.exitCode = 2;
}

module.exports = {
  negotiate,
  validateDeclaration,
  validateRequirement,
  resolveExact
};
