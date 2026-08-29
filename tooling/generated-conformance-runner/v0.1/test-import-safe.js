#!/usr/bin/env node
'use strict';

const assert = require('assert');
const childProcess = require('child_process');

const originalSpawnSync = childProcess.spawnSync;
let called = false;
childProcess.spawnSync = function forbiddenImportExecution() {
  called = true;
  throw new Error('spawnSync called during import');
};

try {
  const Runner = require('./generated-conformance-runner.js');
  assert.strictEqual(typeof Runner.buildExecutionPlan, 'function');
  assert.strictEqual(typeof Runner.executePlan, 'function');
  assert.strictEqual(typeof Runner.runCli, 'function');
  assert.strictEqual(called, false, 'runner executed a child process during import');
} finally {
  childProcess.spawnSync = originalSpawnSync;
}

console.log('Generated Conformance Runner import safety: PASS');
