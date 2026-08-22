'use strict';

const fs = require('fs');
const assert = require('assert');
const crypto = require('crypto');
const {
  ARTIFACT_TYPE,
  CANONICALIZATION_ID,
  canonicalize,
  utf8Bytes,
  buildBindingReceipt,
  validateBindingReceipt,
  verifyReceiptAgainstArtifact
} = require('./binding-receipt.js');

const outputPath = process.argv[2] || '/tmp/binding-receipt.json';

(async () => {
  const artifactA = {
    protocol: 'PoAI',
    protocol_version: '0.0.1',
    profile: 'T',
    record_id: 'urn:poai:record:binding-test:1',
    nested: { z: 3, a: 'alpha' },
    values: [3, 2, 1],
    flag: true
  };

  const artifactB = JSON.parse('{"values":[3,2,1],"flag":true,"nested":{"a":"alpha","z":3},"record_id":"urn:poai:record:binding-test:1","profile":"T","protocol_version":"0.0.1","protocol":"PoAI"}');
  const artifactChanged = { ...artifactA, flag: false };

  const canonicalA = canonicalize(artifactA);
  const canonicalB = canonicalize(artifactB);
  assert.strictEqual(canonicalA, canonicalB, 'Equivalent JSON must canonicalize identically.');
  assert.strictEqual(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.strictEqual(canonicalize([3, { b: 1, a: 2 }, 1]), '[3,{"a":2,"b":1},1]');

  const rfcSortingVector = {
    '\u20ac': 'Euro Sign',
    '\r': 'Carriage Return',
    '\ufb33': 'Hebrew Letter Dalet With Dagesh',
    '1': 'One',
    '\ud83d\ude00': 'Emoji: Grinning Face',
    '\u0080': 'Control',
    '\u00f6': 'Latin Small Letter O With Diaeresis'
  };
  const sorted = canonicalize(rfcSortingVector);
  const markers = ['"\\r"', '"1"', '"\u0080"', '"ö"', '"€"', '"😀"', '"דּ"'];
  let prior = -1;
  for (const marker of markers) {
    const at = sorted.indexOf(marker);
    assert(at > prior, `RFC 8785 UTF-16 property order failed at ${marker}.`);
    prior = at;
  }

  assert.throws(() => canonicalize({ n: -0 }), /negative zero/);
  assert.throws(() => canonicalize({ n: NaN }), /non-finite/);
  assert.throws(() => canonicalize({ n: Infinity }), /non-finite/);
  assert.throws(() => canonicalize({ s: '\ud800' }), /unpaired high surrogate/);

  const receiptA = await buildBindingReceipt(artifactA);
  const receiptB = await buildBindingReceipt(artifactB);
  const receiptChanged = await buildBindingReceipt(artifactChanged);

  assert.strictEqual(receiptA.artifact_type, ARTIFACT_TYPE);
  assert.strictEqual(receiptA.binding.canonicalization, CANONICALIZATION_ID);
  assert.strictEqual(receiptA.bound_artifact.artifact_type, 'PoAIDecisionRecord');
  assert.strictEqual(receiptA.bound_artifact.artifact_id, artifactA.record_id);
  assert.strictEqual(receiptA.binding.digest, receiptB.binding.digest, 'Formatting/key order must not change digest.');
  assert.notStrictEqual(receiptA.binding.digest, receiptChanged.binding.digest, 'Semantic change must change digest.');

  const directDigest = crypto.createHash('sha256').update(Buffer.from(utf8Bytes(canonicalA))).digest('hex');
  assert.strictEqual(receiptA.binding.digest, directDigest, 'Receipt digest must equal independent Node SHA-256 over canonical UTF-8 bytes.');
  assert.strictEqual(receiptA.binding.canonical_byte_length, Buffer.byteLength(canonicalA, 'utf8'));
  assert.deepStrictEqual(validateBindingReceipt(receiptA), []);
  assert.strictEqual(Object.values(receiptA.claims).every((v) => v === false), true);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(receiptA, 'protocol'), false);

  const verification = await verifyReceiptAgainstArtifact(receiptA, artifactB);
  assert.strictEqual(verification.matches, true, 'Receipt must verify against semantically identical JSON.');
  const mismatch = await verifyReceiptAgainstArtifact(receiptA, artifactChanged);
  assert.strictEqual(mismatch.matches, false, 'Receipt must not verify after semantic change.');

  fs.writeFileSync(outputPath, `${JSON.stringify(receiptA, null, 2)}\n`, 'utf8');
  console.log(`Binding receipt test PASS: ${receiptA.binding.digest}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});