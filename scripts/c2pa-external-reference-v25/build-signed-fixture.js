'use strict';

// Deterministic *fixture definition* for signing via pinned c2patool.
// No production keys/credentials; never claims C2PA 2.5 conformance.
const crypto = require('node:crypto');
const fs = require('node:fs');

const [algorithm, recordPath, outputPath] = process.argv.slice(2);
const allowed = new Set(['sha256', 'sha384', 'sha512']);
if (!allowed.has(algorithm) || !recordPath || !outputPath) {
  console.error('usage: node build-signed-fixture.js <sha256|sha384|sha512> <record.json> <output.json>');
  process.exit(2);
}
const bytes = fs.readFileSync(recordPath);
const digest = crypto.createHash(algorithm).update(bytes).digest();

const manifest = {
  claim_generator_info: [{ name: 'UU-AAP bounded algorithm interoperability fixture', version: '0.3' }],
  assertions: [{
    label: 'c2pa.external-reference', kind: 'Cbor', created: false,
    data: {
      location: {
        url: 'https://example.org/uu-aap/records/c2pa-external-reference-v0.1.json',
        alg: algorithm, hash: Array.from(digest),
        'dc:format': 'application/json', size: bytes.length
      },
      description: 'Synthetic external governance record; no implied authority'
    }
  }]
};
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify({
  fixture: 'C2PA_EXTERNAL_REFERENCE_HASH_ALGORITHM_MATRIX_V0_3',
  algorithm,
  bytes: bytes.length,
  expectedHashHex: digest.toString('hex'),
  assertionLabel: 'c2pa.external-reference',
  gathered: true,
  productionAuthority: false,
  c2pa25ConformanceClaimed: false
}) + '\n');
