#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const modulePath = path.resolve(__dirname, 'conformance-parity.js');
const originalRead = fs.readFileSync;
const reads = [];
let stdout = '';
let stderr = '';

fs.readFileSync = function trackedRead(...args) {
  reads.push(String(args[0]));
  return originalRead.apply(this, args);
};
const originalOut = process.stdout.write;
const originalErr = process.stderr.write;
process.stdout.write = (chunk) => { stdout += String(chunk); return true; };
process.stderr.write = (chunk) => { stderr += String(chunk); return true; };

try {
  delete require.cache[modulePath];
  const imported = require(modulePath);
  assert.strictEqual(typeof imported.assessParity, 'function');
} finally {
  fs.readFileSync = originalRead;
  process.stdout.write = originalOut;
  process.stderr.write = originalErr;
}

assert.strictEqual(stdout, '');
assert.strictEqual(stderr, '');
assert.strictEqual(reads.length, 0);
console.log('Conformance parity import safety: PASS');
