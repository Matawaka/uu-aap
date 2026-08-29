#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T5 = require('./implementation-substitution.js');
const ComponentManifest = require('../../component-manifest/v0.1/validate-component-manifest.js');
const ReceiptRuntime = require('../../receipt-runtime/v0.1/receipt-runtime.js');

const ROOT = path.resolve(__dirname, '../../..');
const MERGED_T4_FRONTIER = '5d9d9e0faf35230ede54e8f49c71e049311b7e4a';
const BASELINE_PATH = 'tooling/receipt-runtime/v0.1/differential-baseline.json';
const RUNTIME_MANIFEST_PATH = 'tooling/component-manifest/v0.1/examples/receipt-runtime.component.json';

const CASES = [
  {
    input: 'tooling/implementation-substitution/v0.1/examples/ai-transport-receipt-identity.input.json',
    manifest: 'tooling/component-manifest/v0.1/examples/ai-transport-reference.component.json',
    historicalHash: 'sha256:e1271d41f9092634d9ab571eb9844529962bb07c326934286ca6800d13dec185'
  },
  {
    input: 'tooling/implementation-substitution/v0.1/examples/marketcloser-copy-export-receipt-identity.input.json',
    manifest: 'tooling/component-manifest/v0.1/examples/marketcloser-copy-export-receipt.component.json',
    historicalHash: 'sha256:60ce7e57b32827551f2a0da3d18a1e2ea4fe4751f51f184de34e2c11142ec41c'
  }
];

function read(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

const baseline = read(BASELINE_PATH);
const runtimeManifest = read(RUNTIME_MANIFEST_PATH);
ComponentManifest.validateManifest(runtimeManifest, { repositoryRoot: ROOT });

assert.strictEqual(baseline.artifact_type, 'UU-AAP-Receipt-Runtime-Differential-Baseline');
assert.strictEqual(baseline.version, '0.1');
assert.strictEqual(baseline.claims.shared_runtime_proven_for_listed_profiles_only, true);
assert.strictEqual(baseline.claims.universal_canonicalization_proven, false);
assert.strictEqual(baseline.claims.semantic_compatibility_proven, false);
assert.strictEqual(baseline.claims.authority_created, false);
assert.strictEqual(baseline.claims.historical_receipts_rewritten, false);
assert.strictEqual(runtimeManifest.component.id, 'Receipt-Runtime');
assert(Object.values(runtimeManifest.effect_ceiling).every((value) => value === false));

for (const item of CASES) {
  const input = read(item.input);
  const consumerManifest = read(item.manifest);
  ComponentManifest.validateManifest(consumerManifest, { repositoryRoot: ROOT });
  T5.validateInput(input);

  assert.strictEqual(input.assessment_frontier.revision, MERGED_T4_FRONTIER);
  assert.strictEqual(input.consumer.component_id, consumerManifest.component.id);
  assert.strictEqual(input.substitution_scope.scope_id, 'receipt_identity_mechanics');
  assert.strictEqual(input.substitution_scope.whole_component_substitution, false);

  const baselineConsumer = baseline.consumers.find((consumer) =>
    consumer.component_id === input.consumer.component_id
  );
  assert(baselineConsumer, `missing T4 differential baseline for ${input.consumer.component_id}`);
  assert.strictEqual(baselineConsumer.source_path, input.incumbent.source_path);
  assert.strictEqual(baselineConsumer.source_blob_sha, input.incumbent.source_blob_sha);
  assert.strictEqual(baselineConsumer.historical_hash, item.historicalHash);
  assert(input.dimensions.semantic.evidence_refs.includes(item.historicalHash));

  const runtimeProfile = input.candidate.profile_ref.replace('Receipt-Runtime/', '');
  assert(ReceiptRuntime.PROFILE_IDS.includes(runtimeProfile));
  assert.strictEqual(baselineConsumer.profile, runtimeProfile);
  assert.strictEqual(consumerManifest.canonicalization.mode, 'named_profile');
  assert.strictEqual(consumerManifest.canonicalization.profile_ref, input.candidate.profile_ref);

  const runtimeEdge = consumerManifest.dependencies.find((dependency) =>
    dependency.component_id === 'Receipt-Runtime' &&
    dependency.edge_kind === 'RUNTIME_IMPORT' &&
    dependency.required === true
  );
  assert(runtimeEdge, `${input.consumer.component_id} lacks required Receipt-Runtime edge`);

  assert(Object.values(consumerManifest.effect_ceiling).every((value) => value === false));
  assert(Object.values(runtimeManifest.effect_ceiling).every((value) => value === false));

  const receipt = T5.buildReceipt(input);
  assert.strictEqual(receipt.decision, 'SUBSTITUTABLE');
  assert.strictEqual(receipt.assertions.consumer_specific, true);
  assert.strictEqual(receipt.assertions.scope_specific, true);
  assert.strictEqual(receipt.assertions.whole_component_substitution_assessed, false);
  assert.strictEqual(receipt.non_effects.implementation_selected, false);
  assert.strictEqual(receipt.non_effects.authority_created, false);
  assert.strictEqual(receipt.non_effects.universal_substitutability_established, false);
}

console.log('Implementation Substitution real T4 evidence: PASS');
