'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePaths = [
  path.join(__dirname, 'readiness-family-interop.js'),
  path.join(__dirname, '../../../../server/kontur/v0.1/readiness-aggregator.js')
];

let stdout = '';
let stderr = '';
const jsonReads = [];
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalReadFileSync = fs.readFileSync;

process.stdout.write = function writeStdout(chunk) {
  stdout += String(chunk);
  return true;
};
process.stderr.write = function writeStderr(chunk) {
  stderr += String(chunk);
  return true;
};
fs.readFileSync = function trackedRead(...args) {
  const file = String(args[0]);
  if (file.endsWith('.json')) jsonReads.push(file);
  return originalReadFileSync.apply(this, args);
};

let Interop;
try {
  for (const modulePath of modulePaths) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // Module may not be cached yet.
    }
  }
  Interop = require(modulePaths[0]);
} finally {
  fs.readFileSync = originalReadFileSync;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

assert.strictEqual(stdout, '', 'interop SDK import must not write stdout');
assert.strictEqual(stderr, '', 'interop SDK import must not write stderr');
assert.deepStrictEqual(jsonReads, [], 'interop SDK import must not load readiness/family data files');
for (const name of [
  'validateFamilyManifest',
  'validateReadinessEvidence',
  'validateInput',
  'buildInteropReceipt',
  'validateReceipt',
  'validationReceipt',
  'runCli'
]) {
  assert.strictEqual(typeof Interop[name], 'function', `${name} must be exported`);
}

console.log('KONTUR_FAMILY_READINESS_INTEROP_IMPORT_SAFE_V0_1_PASS');
