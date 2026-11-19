'use strict';

// Checks a *real* c2patool readback and a separately supplied local fixture.
// C2PA validation status is checked by the existing P0.1 gate; this script
// only establishes exact digest binding for its synthetic P0.2 record.
const crypto = require('node:crypto');
const fs = require('node:fs');
const { assertLiveC2paReport } = require('../c2pa-semantic-boundary/check-live-report');

const [algorithm, reportPath, recordPath] = process.argv.slice(2);
if (!['sha256', 'sha384', 'sha512'].includes(algorithm) || !reportPath || !recordPath) {
  console.error('usage: node verify-signed-fixture.js <sha256|sha384|sha512> <c2patool-report.json> <record.json>');
  process.exit(2);
}

function digestFromReader(value, expectedLength) {
  let result;
  if (Array.isArray(value) &&
      value.length === expectedLength &&
      value.every(n => Number.isInteger(n) && n >= 0 && n <= 255)) {
    result = Buffer.from(value);
  } else if (typeof value === 'string' &&
             /^[A-Za-z0-9+/]+={0,2}$/.test(value) &&
             value.length % 4 === 0) {
    result = Buffer.from(value, 'base64');
    if (result.toString('base64') !== value) {
      throw new Error('noncanonical base64 hash bytes');
    }
  } else {
    throw new Error('unsupported or malformed hash bytes from c2patool reader');
  }
  if (result.length !== expectedLength) throw new Error('wrong hash length for declared digest algorithm');
  return result;
}

const bytes = fs.readFileSync(recordPath);
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const c2pa = assertLiveC2paReport(report);
const active = report.manifests?.[c2pa.active_manifest];
if (!active) throw new Error('active manifest not found in c2patool report');
const assertions = active.assertions || [];
if (!Array.isArray(assertions)) throw new Error('assertions must be an array');
const matches = assertions.filter(a => a?.label === 'c2pa.external-reference');
if (matches.length !== 1) throw new Error('expected one c2pa.external-reference assertion');
const data = matches[0]?.data || {};
const loc = data.location || {};
const hashLengths = { sha256: 32, sha384: 48, sha512: 64 };
if (loc.url !== 'https://example.org/uu-aap/records/c2pa-external-reference-v0.1.json') {
  throw new Error('external fixture URL mismatch');
}
if (loc.alg !== algorithm) throw new Error('algorithm mismatch in signed C2PA assertion');
if (loc['dc:format'] !== 'application/json') throw new Error('unexpected external media type');
if (loc.size !== bytes.length) throw new Error('signed external record size mismatch');
if (Object.prototype.hasOwnProperty.call(data, 'label')) {
  throw new Error('unexpected JUMBF label on arbitrary external JSON record');
}
const expected = digestFromReader(loc.hash, hashLengths[algorithm]);
const actual = crypto.createHash(algorithm).update(bytes).digest();
if (!crypto.timingSafeEqual(expected, actual)) {
  throw new Error('external reference digest mismatch');
}
process.stdout.write(JSON.stringify({
  schema: 'urn:uu-aap:c2pa-signed-external-reference-algorithm-receipt:0.3',
  algorithm,
  expectedDigestHex: actual.toString('hex'),
  externalRecordBytes: bytes.length,
  validatedC2paReportState: c2pa.validation_state,
  boundAssetAndRecordMatch: true,
  sdkVersion25ConformanceEstablished: false,
  crossSdkCompatibilityEstablished: false,
  signatureIsNotUuAapAuthority: true,
  externalReferenceIsNotActionPermit: true
}) + '\n');
