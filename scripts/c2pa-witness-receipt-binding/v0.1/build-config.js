'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { validateSourceReceipt } = require('./verify-binding');

const [profilePath, receiptPath, outputPath] = process.argv.slice(2);
if (!profilePath || !receiptPath || !outputPath) {
  console.error('usage: node build-config.js <profile.json> <accepted-source-receipt.json> <manifest-config.json>');
  process.exit(2);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const receiptBytes = fs.readFileSync(receiptPath);
const source = validateSourceReceipt(profile, receiptBytes);

if (profile.assertion_label !== 'c2pa.external-reference') {
  throw new Error(`unexpected assertion label: ${profile.assertion_label}`);
}
if (profile.digest_alg !== 'sha256') throw new Error(`unsupported digest algorithm: ${profile.digest_alg}`);
if (profile.media_type !== 'application/json') throw new Error(`unexpected media type: ${profile.media_type}`);

const digest = crypto.createHash('sha256').update(receiptBytes).digest();
const config = {
  claim_generator_info: [
    {
      name: 'UU-AAP accepted witness-receipt C2PA binding fixture',
      version: '0.1'
    }
  ],
  assertions: [
    {
      label: profile.assertion_label,
      kind: 'Cbor',
      created: false,
      data: {
        location: {
          url: profile.external_url,
          alg: profile.digest_alg,
          hash: [...digest],
          'dc:format': profile.media_type,
          size: receiptBytes.length
        },
        description: 'Hash-bound reference to the exact accepted UU-AAP witness-attribution qualification receipt; binding does not promote receipt semantics.'
      }
    }
  ]
};

fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  schema: 'urn:uu-aap:c2pa-witness-receipt-binding-build-receipt:0.1',
  tracking_issue: profile.tracking_issue,
  source_receipt_git_blob: source.blobSha,
  source_receipt_sha256: source.fileSha,
  source_receipt_bytes: receiptBytes.length,
  source_receipt_fingerprint_sha256: source.receipt.receipt_fingerprint_sha256,
  assertion_label: profile.assertion_label,
  assertion_created: false,
  external_url: profile.external_url,
  digest_alg: profile.digest_alg,
  digest_hex: digest.toString('hex'),
  media_type: profile.media_type,
  custom_assertion_namespace_registered: false,
  authority_created: false,
  truth_certified: false,
  historical_source_receipt_rewritten: false
}, null, 2)}\n`);
