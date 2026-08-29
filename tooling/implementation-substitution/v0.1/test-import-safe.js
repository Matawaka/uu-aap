#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');

const script = [
  "const before={out:process.stdout.write,err:process.stderr.write,exit:process.exit};",
  "let wrote=false, exited=false;",
  "process.stdout.write=()=>{wrote=true;};",
  "process.stderr.write=()=>{wrote=true;};",
  "process.exit=()=>{exited=true;};",
  "const m=require('./tooling/implementation-substitution/v0.1/implementation-substitution.js');",
  "if(!m||typeof m.buildReceipt!=='function') throw new Error('missing buildReceipt export');",
  "process.stdout.write=before.out; process.stderr.write=before.err; process.exit=before.exit;",
  "if(wrote||exited) process.exit(7);"
].join('');

const result = spawnSync(process.execPath, ['-e', script], {
  cwd: require('path').resolve(__dirname, '../../..'),
  encoding: 'utf8'
});
assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert.strictEqual(result.stdout, '');
assert.strictEqual(result.stderr, '');

console.log('Implementation Substitution import safety: PASS');
