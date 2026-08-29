'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const Manifest = require('./validate-component-manifest.js');

const root = path.resolve(__dirname, '../../..');
const corePath = path.join(__dirname, 'examples/uu-aap-core.component.json');
const transportPath = path.join(__dirname, 'examples/ai-transport-reference.component.json');

function load(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

for (const file of [corePath, transportPath]) {
  const manifest = load(file);
  const result = Manifest.validateManifest(manifest, { repositoryRoot: root });
  assert.strictEqual(result.valid, true);
}

{
  const manifest = load(transportPath);
  manifest.dependencies[0].edge_kind = 'AUTHORITY_TRANSFER';
  manifest.content_hash = Manifest.computeContentHash(manifest);
  assert.throws(() => Manifest.validateManifest(manifest, { repositoryRoot: root }), /edge_kind/);
}

{
  const manifest = load(corePath);
  manifest.effect_ceiling.creates_authority = true;
  manifest.content_hash = Manifest.computeContentHash(manifest);
  assert.throws(() => Manifest.validateManifest(manifest, { repositoryRoot: root }), /creates_authority/);
}

{
  const manifest = load(corePath);
  manifest.non_effects = manifest.non_effects.filter(item => item !== 'declared_interface_does_not_prove_compatibility');
  manifest.content_hash = Manifest.computeContentHash(manifest);
  assert.throws(() => Manifest.validateManifest(manifest, { repositoryRoot: root }), /missing required non_effect/);
}

{
  const manifest = load(corePath);
  manifest.component.path = '../escape';
  manifest.content_hash = Manifest.computeContentHash(manifest);
  assert.throws(() => Manifest.validateManifest(manifest, { repositoryRoot: root }), /escapes root/);
}

{
  const manifest = load(corePath);
  manifest.content_hash = manifest.content_hash.replace(/.$/, manifest.content_hash.endsWith('0') ? '1' : '0');
  assert.throws(() => Manifest.validateManifest(manifest, { repositoryRoot: root }), /content_hash mismatch/);
}

console.log('Component Manifest v0.1 conformance PASS');
