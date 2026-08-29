'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Runtime = require('./receipt-runtime.js');

const ROOT = path.resolve(__dirname, '../../..');
const Transport = require(path.join(ROOT, 'protocols/integration/ai-transport-reference/v0.1/reference-transport.js'));
const CopyExport = require(path.join(ROOT, 'applications/marketcloser/v0.1/copy-export-receipt/v0.1/copy-export.js'));
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'differential-baseline.json'), 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function consumer(id) {
  const item = baseline.consumers.find(entry => entry.component_id === id);
  assert(item, `missing differential baseline consumer: ${id}`);
  return item;
}

assert.strictEqual(baseline.artifact_type, 'UU-AAP-Receipt-Runtime-Differential-Baseline');
assert.strictEqual(baseline.version, '0.1');
assert.strictEqual(baseline.origin_frontier, 'eddc49d2b3978558c35f029d9a5bfb46b5e4f6c1');
assert.strictEqual(baseline.claims.universal_canonicalization_proven, false);
assert.strictEqual(baseline.claims.semantic_compatibility_proven, false);
assert.strictEqual(baseline.claims.authority_created, false);

const transportBaseline = consumer('AI-Transport-Reference');
const copyBaseline = consumer('MarketCloser-Copy-Export-Receipt');

const vector = {
  z: [{ b: 2, a: 1 }],
  a: { y: true, x: null },
  content_hash: `sha256:${'f'.repeat(64)}`
};

const transportProjection = clone(vector);
transportProjection.content_hash = '';
const historicalTransportCanonical = JSON.stringify(Transport.canonicalize(transportProjection));
const sharedTransportCanonical = Runtime.canonicalJson(transportBaseline.profile, vector);
assert.strictEqual(sharedTransportCanonical, historicalTransportCanonical);
assert.strictEqual(Transport.computeContentHash(vector), transportBaseline.historical_hash);
assert.strictEqual(Runtime.computeContentHash(transportBaseline.profile, vector), transportBaseline.historical_hash);

const legacyTransportRehash = clone(vector);
const sharedTransportRehash = clone(vector);
Transport.rehash(legacyTransportRehash);
Runtime.rehash(transportBaseline.profile, sharedTransportRehash);
assert.deepStrictEqual(sharedTransportRehash, legacyTransportRehash);
assert.strictEqual(Runtime.verifyContentHash(transportBaseline.profile, sharedTransportRehash), true);

const copyFixture = JSON.parse(fs.readFileSync(path.join(ROOT, copyBaseline.fixture_path), 'utf8'));
const copyProjection = clone(copyFixture);
delete copyProjection.content_hash;
const historicalCopyCanonical = JSON.stringify(CopyExport.canonicalize(copyProjection));
const sharedCopyCanonical = Runtime.canonicalJson(copyBaseline.profile, copyFixture);
assert.strictEqual(sharedCopyCanonical, historicalCopyCanonical);
assert.strictEqual(CopyExport.computeContentHash(copyFixture), copyBaseline.historical_hash);
assert.strictEqual(Runtime.computeContentHash(copyBaseline.profile, copyFixture), copyBaseline.historical_hash);
assert.strictEqual(copyFixture.content_hash, copyBaseline.historical_hash);
assert.strictEqual(Runtime.verifyContentHash(copyBaseline.profile, copyFixture), true);

const legacyCopyRehash = clone(copyFixture);
const sharedCopyRehash = clone(copyFixture);
CopyExport.rehash(legacyCopyRehash);
Runtime.rehash(copyBaseline.profile, sharedCopyRehash);
assert.deepStrictEqual(sharedCopyRehash, legacyCopyRehash);

assert.notStrictEqual(
  Runtime.computeContentHash(Runtime.PROFILE_OMIT_CONTENT_HASH, vector),
  transportBaseline.historical_hash,
  'wrong omit profile unexpectedly reproduced zero-field historical identity'
);
assert.notStrictEqual(
  Runtime.computeContentHash(Runtime.PROFILE_ZERO_CONTENT_HASH, copyFixture),
  copyBaseline.historical_hash,
  'wrong zero-field profile unexpectedly reproduced omit-field historical identity'
);

assert.throws(
  () => Runtime.computeContentHash('unknown-profile', vector),
  /unknown receipt identity profile/
);
assert.strictEqual(Runtime.verifyContentHash(transportBaseline.profile, { ...vector, content_hash: 'invalid' }), false);
assert.throws(() => Runtime.rehash(transportBaseline.profile, []), /must be an object/);

const nestedLeft = { b: [{ y: 2, x: 1 }], a: true };
const nestedRight = { a: true, b: [{ x: 1, y: 2 }] };
assert.strictEqual(Runtime.deepEqualCanonical(nestedLeft, nestedRight), true);

console.log('Receipt Runtime SDK v0.1 differential parity: PASS');
