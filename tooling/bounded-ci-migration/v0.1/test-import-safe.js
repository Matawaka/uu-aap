#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const childProcess = require('child_process');

const modulePath = path.resolve(__dirname, 'bounded-ci-migration.js');
const originalSpawnSync = childProcess.spawnSync;
let spawnCount = 0;
let stdout = '';
let stderr = '';

childProcess.spawnSync = (...args) => {
  spawnCount += 1;
  return originalSpawnSync(...args);
};
const originalOut = process.stdout.write;
const originalErr = process.stderr.write;
process.stdout.write = (chunk) => { stdout += String(chunk); return true; };
process.stderr.write = (chunk) => { stderr += String(chunk); return true; };

try {
  delete require.cache[modulePath];
  const imported = require(modulePath);
  assert.strictEqual(typeof imported.buildMigrationContext, 'function');
  assert.strictEqual(typeof imported.verifyMigration, 'function');
  assert.strictEqual(typeof imported.runMigratedSlice, 'function');
  assert.strictEqual(typeof imported.verifyProductionWorkflowMigration, 'function');
} finally {
  childProcess.spawnSync = originalSpawnSync;
  process.stdout.write = originalOut;
  process.stderr.write = originalErr;
}

assert.strictEqual(spawnCount, 0);
assert.strictEqual(stdout, '');
assert.strictEqual(stderr, '');
console.log('Bounded CI Migration import safety: PASS');
