#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');

const probe = `
  const fs = require('fs');
  const originalWriteFileSync = fs.writeFileSync;
  const originalAppendFileSync = fs.appendFileSync;
  let writes = 0;
  fs.writeFileSync = function(...args) { writes += 1; return originalWriteFileSync.apply(this, args); };
  fs.appendFileSync = function(...args) { writes += 1; return originalAppendFileSync.apply(this, args); };
  require('./tooling/dependency-impact/v0.1/dependency-impact.js');
  if (writes !== 0) process.exit(9);
`;

const result = spawnSync(process.execPath, ['-e', probe], {
  cwd: process.cwd(),
  encoding: 'utf8'
});

assert.strictEqual(result.status, 0, result.stderr);
assert.strictEqual(result.stdout, '');
assert.strictEqual(result.stderr, '');
console.log('Dependency / Impact Graph import safety: PASS');
