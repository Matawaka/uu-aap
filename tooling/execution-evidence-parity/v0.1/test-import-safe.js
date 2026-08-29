#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');

const modulePath = path.resolve(__dirname, 'execution-evidence-parity.js');
const originalRead = fs.readFileSync;
const originalSpawn = childProcess.spawnSync;
const reads = [];
let spawnCalls = 0;
let stdout = '';
let stderr = '';

fs.readFileSync = function trackedRead(...args) {
  reads.push(String(args[0]));
  return originalRead.apply(this, args);
};
childProcess.spawnSync = function trackedSpawn(...args) {
  spawnCalls += 1;
  return originalSpawn.apply(this, args);
};
const originalOut = process.stdout.write;
const originalErr = process.stderr.write;
process.stdout.write = (chunk) => { stdout += String(chunk); return true; };
process.stderr.write = (chunk) => { stderr += String(chunk); return true; };

try {
  delete require.cache[modulePath];
  const imported = require(modulePath);
  assert.strictEqual(typeof imported.assessExecutionEvidenceParity, 'function');
  assert.strictEqual(typeof imported.compareExecutionReceipts, 'function');
} finally {
  fs.readFileSync = originalRead;
  childProcess.spawnSync = originalSpawn;
  process.stdout.write = originalOut;
  process.stderr.write = originalErr;
}

assert.strictEqual(stdout, '');
assert.strictEqual(stderr, '');
assert.strictEqual(spawnCalls, 0);
// Node may read dependency source files through the module loader; import must not read repository evidence files itself.
assert.strictEqual(reads.filter((value) => value.endsWith('.json') || value.endsWith('.yml') || value.endsWith('.yaml')).length, 0);
console.log('Execution Evidence Parity import safety: PASS');
