'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const modulePath = path.join(__dirname, 'release-candidate-checkpoint.js');
const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(modulePath)})`], {
  encoding: 'utf8',
  env: { PATH: process.env.PATH },
});

assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, '');
assert.equal(result.stderr, '');
console.log('Release Candidate Checkpoint v0.2 import-safety passed');
