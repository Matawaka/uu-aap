'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { assertLiveC2paReport } = require('../c2pa-semantic-boundary/check-live-report');

const [reportPath, recordPath] = process.argv.slice(2);
if (!reportPath || !recordPath) {
  console.error('usage: node verify-reference.js <c2patool-report.json> <external-record.json>');
  process.exit(2);
}

function normalizeHash(value) {
  if (Array.isArray(value)) {
    return Buffer.from(value);
  }
  if (typeof value === 'string') {
    const asBase64 = Buffer.from(value, 'base64');
    if (asBase64.length > 0) return asBase64;
  }
  throw new Error('unsupported external-reference hash representation');
}

function activeManifest(report) {
  const label = report.active_manifest || report.activeManifest;
  if (!label) throw new Error('missing active manifest label');
  const manifests = report.manifests || {};
  const manifest = manifests[label];
  if (!manifest) throw new Error(`active manifest ${label} not found in report.manifests`);
  return { label, manifest };
}

function findExternalReference(manifest) {
  const assertions = Array.isArray(manifest.assertions) ? manifest.assertions : [];
  const matches = assertions.filter((a) => a && a.label === 'c2pa.external-reference');
  if (matches.length !== 1) {
    throw new Error(`expected exactly one c2pa.external-reference assertion, found ${matches.length}`);
  }
  return matches[0];
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const c2pa = assertLiveC2paReport(report);
const { label: activeLabel, manifest } = activeManifest(report);
const assertion = findExternalReference(manifest);
const data = assertion.data || {};
const location = data.location || {};

const record = fs.readFileSync(recordPath);
const digest = crypto.createHash('sha256').update(record).digest();
const boundHash = normalizeHash(location.hash);

if (location.url !== 'https://example.org/uu-aap/records/c2pa-external-reference-v0.1.json') {
  throw new Error(`unexpected external-reference URL: ${location.url}`);
}
if (location.alg !== 'sha256') throw new Error(`unexpected hash algorithm: ${location.alg}`);
if (location['dc:format'] !== 'application/json') {
  throw new Error(`unexpected external record media type: ${location['dc:format']}`);
}
if (location.size !== record.length) {
  throw new Error(`external record size mismatch: bound=${location.size} actual=${record.length}`);
}
if (!crypto.timingSafeEqual(boundHash, digest)) {
  throw new Error(`external record SHA-256 mismatch: bound=${boundHash.toString('hex')} actual=${digest.toString('hex')}`);
}
if (Object.prototype.hasOwnProperty.call(data, 'label')) {
  throw new Error('fixture must reference arbitrary external JSON and therefore must not claim a JUMBF assertion label');
}

process.stdout.write(`${JSON.stringify({
  schema: 'urn:uu-aap:c2pa-external-reference-verification-receipt:0.1',
  c2pa,
  active_manifest: activeLabel,
  assertion_label: assertion.label,
  external_url: location.url,
  digest_alg: location.alg,
  digest_hex: digest.toString('hex'),
  record_bytes: record.length,
  external_reference_hash_match: true,
  custom_assertion_namespace_registered: false,
  signer_interpreted_as_uu_aap_authority: false,
  c2pa_conformance_claimed: false,
  conclusion: 'The released asset contains a standard C2PA hashed external reference whose bound digest matches the external UU-AAP fixture. C2PA signer identity is not promoted into UU-AAP governance semantics.'
}, null, 2)}\n`);
