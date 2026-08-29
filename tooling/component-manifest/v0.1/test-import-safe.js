'use strict';

const assert = require('assert');
const childProcess = require('child_process');
const path = require('path');

const validatorPath = path.resolve(__dirname, 'validate-component-manifest.js');
const script = `
  const fs = require('fs');
  const originalRead = fs.readFileSync;
  let reads = 0;
  fs.readFileSync = function (...args) { reads += 1; return originalRead.apply(this, args); };
  const originalOut = process.stdout.write;
  const originalErr = process.stderr.write;
  let out = '';
  let err = '';
  process.stdout.write = chunk => { out += String(chunk); return true; };
  process.stderr.write = chunk => { err += String(chunk); return true; };
  require(${JSON.stringify(validatorPath)});
  process.stdout.write = originalOut;
  process.stderr.write = originalErr;
  if (out !== '' || err !== '' || reads !== 1) {
    // One read is Node loading the module source itself; no manifest/fixture read is allowed on import.
    process.exit(1);
  }
`;

const result = childProcess.spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
assert.strictEqual(result.status, 0, result.stderr || result.stdout || 'import safety probe failed');
console.log('Component Manifest import-safety PASS');
