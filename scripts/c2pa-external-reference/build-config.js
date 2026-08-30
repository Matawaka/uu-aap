'use strict';

const crypto = require('crypto');
const fs = require('fs');

const [recordPath, outputPath] = process.argv.slice(2);
if (!recordPath || !outputPath) {
  console.error('usage: node build-config.js <external-record.json> <manifest-config.json>');
  process.exit(2);
}

const record = fs.readFileSync(recordPath);
const digest = crypto.createHash('sha256').update(record).digest();
const externalUrl = 'https://example.org/uu-aap/records/c2pa-external-reference-v0.1.json';

const config = {
  claim_generator_info: [
    {
      name: 'UU-AAP C2PA interoperability fixture',
      version: '0.1'
    }
  ],
  assertions: [
    {
      label: 'c2pa.external-reference',
      kind: 'Cbor',
      created: false,
      data: {
        location: {
          url: externalUrl,
          alg: 'sha256',
          hash: [...digest],
          'dc:format': 'application/json',
          size: record.length
        },
        description: 'Hash-bound external UU-AAP governance record fixture'
      }
    }
  ]
};

fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  schema: 'urn:uu-aap:c2pa-external-reference-build-receipt:0.1',
  assertion_label: 'c2pa.external-reference',
  assertion_created: false,
  external_url: externalUrl,
  digest_alg: 'sha256',
  digest_hex: digest.toString('hex'),
  digest_base64: digest.toString('base64'),
  record_bytes: record.length,
  custom_assertion_namespace_registered: false,
  c2pa_conformance_claimed: false
}, null, 2)}\n`);
