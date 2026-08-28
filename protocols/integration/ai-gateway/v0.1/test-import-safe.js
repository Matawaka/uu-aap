'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePath = path.join(__dirname, 'validate-gateway.js');

let stdout = '';
let stderr = '';
const fileReads = [];

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
  fileReads.push(String(args[0]));
  return originalReadFileSync.apply(this, args);
};

let gateway;
try {
  delete require.cache[require.resolve(modulePath)];
  gateway = require(modulePath);
} finally {
  fs.readFileSync = originalReadFileSync;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

assert.strictEqual(stdout, '', 'import must not write stdout');
assert.strictEqual(stderr, '', 'import must not write stderr');
assert.strictEqual(
  fileReads.some(file => file.endsWith('conformance.fixture.json')),
  false,
  'import must not read conformance fixture'
);
for (const name of [
  'validateCapability',
  'validateRequest',
  'validateDecision',
  'validateObservation',
  'hash',
  'runConformance'
]) {
  assert.strictEqual(typeof gateway[name], 'function', `${name} must be exported`);
}

gateway.runConformance();

console.log('UU_AAP_AI_GATEWAY_IMPORT_SAFE_V0_1_PASS');
