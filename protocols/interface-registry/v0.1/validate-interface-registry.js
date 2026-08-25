#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..', '..');
const REGISTRY_PATH = path.join(HERE, 'interface-registry.json');
const ADAPTER_ID = 'KONTURGameCompanionAdapter';
const CORE_ID = 'UU-AAP-Core';

const REQUIRED_NON_CLAIMS = new Set([
  'published_release_status',
  'version_compatibility_proven',
  'automatic_transition_authorized',
  'external_effect_performed',
  'authority_created',
  'optional_adapter_registration_is_core_membership',
  'pilot_observation_is_core_requirement',
  'runtime_activation_authorized',
  'reverse_dependency_authorized',
]);

const ADAPTER_NON_EFFECTS = new Set([
  'adapter registration != stable-core membership',
  'Core dependency != reverse Core dependency',
  'adapter evidence != ActionPermit',
  'listed adapter != runtime activation',
]);

function fail(message) {
  throw new Error(message);
}

function sameSet(actual, expected) {
  return Array.isArray(actual) &&
    actual.length === expected.size &&
    actual.every((value) => expected.has(value));
}

function validateRegistry(r, checkPaths = true) {
  if (r.artifact_type !== 'ReusableProtocolInterfaceRegistry' ||
      r.version !== '0.1' ||
      r.release_registry_equivalent !== false) {
    fail('registry identity/boundary invalid');
  }

  if (!Array.isArray(r.entries) || r.entries.length < 14) {
    fail('registry must contain existing stack plus KONTUR optional adapter');
  }

  const ids = new Set();
  for (const e of r.entries) {
    if (!e || typeof e !== 'object') fail('entry must be an object');
    if (ids.has(e.id)) fail('duplicate ' + e.id);
    ids.add(e.id);

    if (checkPaths && !fs.existsSync(path.join(ROOT, e.path))) {
      fail('missing path ' + e.path);
    }

    if (e.provider_neutral !== true ||
        e.external_effect_emission !== false ||
        e.next_interfaces_are_automatic !== false) {
      fail('unsafe interface flags ' + e.id);
    }

    for (const field of ['inputs', 'outputs', 'dependencies', 'non_effects', 'next_interfaces']) {
      if (!Array.isArray(e[field])) fail(`incomplete interface ${e.id}: ${field}`);
    }
    if (e.non_effects.length < 1) fail('missing non-effects ' + e.id);

    if (e.status === 'experimental' && ('release_tag' in e || 'published' in e)) {
      fail('experimental publication claim ' + e.id);
    }
  }

  for (const e of r.entries) {
    for (const d of e.dependencies) {
      if (!ids.has(d)) fail(`unknown dependency ${d} for ${e.id}`);
    }
    for (const n of e.next_interfaces) {
      if (!ids.has(n)) fail(`unknown next interface ${n} for ${e.id}`);
    }
  }

  const core = r.entries.find((e) => e.id === CORE_ID);
  if (!core) fail('missing Core registry entry');

  const adapters = r.entries.filter((e) => e.id === ADAPTER_ID);
  if (adapters.length !== 1) fail('exactly one KONTUR optional adapter entry required');
  const adapter = adapters[0];

  if (adapter.version !== '0.1' ||
      adapter.status !== 'experimental' ||
      adapter.path !== 'pilots/kontur-game-companion') {
    fail('KONTUR adapter identity/status/path invalid');
  }

  if (JSON.stringify(adapter.inputs) !== JSON.stringify(['typed Core receipts', 'local Game Companion evidence'])) {
    fail('KONTUR adapter typed inputs changed');
  }
  if (JSON.stringify(adapter.outputs) !== JSON.stringify(['synthetic Game Companion policy evidence'])) {
    fail('KONTUR adapter outputs changed');
  }
  if (JSON.stringify(adapter.dependencies) !== JSON.stringify([CORE_ID])) {
    fail('KONTUR adapter must depend only on Core');
  }
  if (adapter.next_interfaces.length !== 0) {
    fail('KONTUR adapter registration cannot create an automatic successor route');
  }
  if (!sameSet(adapter.non_effects, ADAPTER_NON_EFFECTS)) {
    fail('KONTUR adapter non-effects changed');
  }

  const exact = {
    interface_kind: 'OPTIONAL_ADAPTER',
    optional_adapter: true,
    dependency_direction: 'UU-AAP-Core->KONTURGameCompanionAdapter',
    core_membership: false,
    reverse_dependency_authorized: false,
    runtime_activation_authorized: false,
    stable_core_promotion: false,
    authority_created: false,
    pilot_evidence_can_create_core_requirement: false,
  };
  for (const [field, expected] of Object.entries(exact)) {
    if (adapter[field] !== expected) fail(`KONTUR adapter boundary invalid: ${field}`);
  }

  if (core.dependencies.includes(ADAPTER_ID) || core.next_interfaces.includes(ADAPTER_ID)) {
    fail('Core must not import or transition automatically to KONTUR');
  }

  for (const e of r.entries) {
    if (e.id !== ADAPTER_ID && e.dependencies.includes(ADAPTER_ID)) {
      fail(`reverse KONTUR dependency detected in ${e.id}`);
    }
  }

  if (adapter.outputs.some((x) => x === 'ActionPermit' || x === 'AuthorityReceipt')) {
    fail('optional adapter cannot emit Core authority/action permits');
  }

  if (!Array.isArray(r.non_claims)) fail('non_claims must be an array');
  for (const claim of REQUIRED_NON_CLAIMS) {
    if (!r.non_claims.includes(claim)) fail('missing non-claim ' + claim);
  }

  return true;
}

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
validateRegistry(registry, true);

function mutate(name, fn) {
  const x = structuredClone(registry);
  fn(x);
  try {
    validateRegistry(x, false);
    fail('mutation unexpectedly accepted: ' + name);
  } catch (err) {
    if (String(err.message).startsWith('mutation unexpectedly accepted:')) throw err;
  }
}

const mutations = [
  ['release-registry-conflation', (x) => { x.release_registry_equivalent = true; }],
  ['duplicate-id', (x) => { x.entries[1].id = x.entries[0].id; }],
  ['provider-neutral-false', (x) => { x.entries[2].provider_neutral = false; }],
  ['external-effect-emission', (x) => { x.entries[3].external_effect_emission = true; }],
  ['automatic-next-interface', (x) => { x.entries[4].next_interfaces_are_automatic = true; }],
  ['empty-non-effects', (x) => { x.entries[5].non_effects = []; }],
  ['unknown-dependency', (x) => { x.entries[6].dependencies = ['MISSING']; }],
  ['unknown-next-interface', (x) => { x.entries[7].next_interfaces = ['MISSING']; }],
  ['experimental-release-claim', (x) => { x.entries[8].release_tag = 'bad'; }],
  ['remove-adapter', (x) => { x.entries = x.entries.filter((e) => e.id !== ADAPTER_ID); }],
  ['adapter-promoted-stable', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).status = 'stable'; }],
  ['adapter-path-core', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).path = 'protocols/core/v0.1'; }],
  ['adapter-not-optional', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).optional_adapter = false; }],
  ['adapter-kind-core', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).interface_kind = 'CORE'; }],
  ['reverse-direction', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).dependency_direction = 'KONTURGameCompanionAdapter->UU-AAP-Core'; }],
  ['core-membership', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).core_membership = true; }],
  ['reverse-authorized', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).reverse_dependency_authorized = true; }],
  ['runtime-activation', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).runtime_activation_authorized = true; }],
  ['stable-core-promotion', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).stable_core_promotion = true; }],
  ['authority-created', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).authority_created = true; }],
  ['pilot-creates-core-requirement', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).pilot_evidence_can_create_core_requirement = true; }],
  ['adapter-loses-core-dependency', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).dependencies = []; }],
  ['adapter-gains-successor', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).next_interfaces = ['UU-AAP-Core']; }],
  ['adapter-action-permit-output', (x) => { x.entries.find((e) => e.id === ADAPTER_ID).outputs = ['ActionPermit']; }],
  ['core-imports-adapter', (x) => { x.entries.find((e) => e.id === CORE_ID).dependencies = [ADAPTER_ID]; }],
  ['integration-imports-adapter', (x) => { x.entries.find((e) => e.id === 'CapabilitySelection').dependencies = [ADAPTER_ID]; }],
  ['missing-optional-nonclaim', (x) => { x.non_claims = x.non_claims.filter((c) => c !== 'optional_adapter_registration_is_core_membership'); }],
  ['missing-reverse-nonclaim', (x) => { x.non_claims = x.non_claims.filter((c) => c !== 'reverse_dependency_authorized'); }],
];

for (const [name, fn] of mutations) mutate(name, fn);

console.log(
  `Reusable Protocol Interface Registry v0.1: ${registry.entries.length} interfaces valid; ` +
  `KONTUR optional Core->adapter edge fail-closed; ${mutations.length} unsafe registry mutations rejected; ` +
  `release registry unchanged.`
);
