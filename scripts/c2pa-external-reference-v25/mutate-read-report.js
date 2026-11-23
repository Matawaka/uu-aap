'use strict';

// Deterministic hostile read-report mutations for the isolated signed-fixture
// CI lane. These are NOT new signed manifests or C2PA-valid subject assets.
const fs = require('node:fs');

const [kind, inputPath, outputPath] = process.argv.slice(2);
const cases = new Set(['algorithm', 'hash', 'url', 'label', 'validation']);
if (!cases.has(kind) || !inputPath || !outputPath) {
  console.error('usage: node mutate-read-report.js <algorithm|hash|url|label|validation> <input.json> <output.json>');
  process.exit(2);
}
const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const activeId = report.active_manifest || report.activeManifest;
const active = report.manifests?.[activeId];
const assertion = active?.assertions?.find(a => a?.label === 'c2pa.external-reference');
if (!assertion?.data?.location) throw new Error('cannot locate intended external-reference assertion');
const location = assertion.data.location;

switch (kind) {
  case 'algorithm':
    location.alg = location.alg === 'sha512' ? 'sha384' : 'sha512';
    break;
  case 'hash':
    if (Array.isArray(location.hash) && location.hash.length) {
      location.hash[0] ^= 0x01;
    } else if (typeof location.hash === 'string') {
      const bytes = Buffer.from(location.hash, 'base64');
      if (bytes.length === 0) throw new Error('missing hash bytes');
      bytes[0] ^= 0x01;
      location.hash = bytes.toString('base64');
    } else {
      throw new Error('unrecognized original hash representation');
    }
    break;
  case 'url':
    location.url += '.changed';
    break;
  case 'label':
    assertion.data.label = 'c2pa.actions';
    break;
  case 'validation':
    if (report.validation_results) {
      report.validation_results.validation_state = 'Invalid';
    } else if (report.validationResults) {
      report.validationResults.validationState = 'Invalid';
    } else {
      report.validation_state = 'Invalid';
    }
    break;
}
fs.writeFileSync(outputPath, JSON.stringify(report) + '\n');
