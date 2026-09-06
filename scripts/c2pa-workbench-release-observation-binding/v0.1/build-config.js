'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { validateSourceObservation } = require('./verify-binding');

const [profilePath, sourcePath, outputPath] = process.argv.slice(2);
if (![profilePath, sourcePath, outputPath].every(Boolean)) {
  console.error('usage: node build-config.js <profile> <source-observation> <manifest-config>');
  process.exit(2);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const sourceBytes = fs.readFileSync(sourcePath);
const source = validateSourceObservation(profile, sourceBytes);
if (profile.assertion_label !== 'c2pa.external-reference') throw new Error('custom assertion namespace not allowed');
if (profile.digest_alg !== 'sha256') throw new Error('unsupported digest algorithm');
if (profile.media_type !== 'application/json') throw new Error('unexpected media type');
const digest = crypto.createHash('sha256').update(sourceBytes).digest();

const config = {
  claim_generator_info: [{ name: 'Matawaka Workbench release observation C2PA fixture', version: '0.1' }],
  assertions: [{
    label: profile.assertion_label,
    kind: 'Cbor',
    created: false,
    data: {
      location: {
        url: profile.external_url,
        alg: profile.digest_alg,
        hash: [...digest],
        'dc:format': profile.media_type,
        size: sourceBytes.length
      },
      description: 'Hash-bound reference to an independently reproducible Workbench public-release observation; binding does not create authority, truth, tag-signature trust, or retroactive release inclusion.'
    }
  }]
};
fs.writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  schema: 'urn:uu-aap:c2pa-workbench-release-observation-binding-build-receipt:0.1',
  tracking_issue: profile.tracking_issue,
  source_checkpoint_commit: profile.source_checkpoint_commit,
  source_observation_git_blob: source.blobSha,
  source_observation_sha256: source.fileSha,
  source_observation_bytes: sourceBytes.length,
  assertion_label: profile.assertion_label,
  assertion_created: false,
  external_url: profile.external_url,
  digest_alg: profile.digest_alg,
  digest_hex: digest.toString('hex'),
  media_type: profile.media_type,
  custom_assertion_namespace_registered: false,
  publication_authority_proven: false,
  truth_certified: false,
  git_tag_signature_verified: false,
  historical_operator_publication_receipt_reconstructed: false
}, null, 2)}\n`);
