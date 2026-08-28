'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePaths = [
  path.join(__dirname, 'reference-transport.js'),
  path.join(__dirname, '../../../ial/v0.1/compact/ial-compact.js'),
  path.join(__dirname, '../../ai-gateway/v0.1/validate-gateway.js')
];

let stdout = '';
let stderr = '';
let fileReads = 0;

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
  fileReads += 1;
  return originalReadFileSync.apply(this, args);
};

let Transport;
try {
  for (const modulePath of modulePaths) {
    try {
      delete require.cache[require.resolve(modulePath)];
    } catch {
      // Module may not be cached yet.
    }
  }
  Transport = require(modulePaths[0]);
} finally {
  fs.readFileSync = originalReadFileSync;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

assert.strictEqual(stdout, '', 'SDK import must not write stdout');
assert.strictEqual(stderr, '', 'SDK import must not write stderr');
assert.strictEqual(fileReads, 0, 'SDK import must not read packet, fixture or product files');

for (const name of [
  'validatePacket',
  'createPacket',
  'inspectPacket',
  'validationReceipt',
  'runCli'
]) {
  assert.strictEqual(typeof Transport[name], 'function', `${name} must be exported`);
}

console.log('UU_AAP_AI_TRANSPORT_REFERENCE_IMPORT_SAFE_V0_1_PASS');
