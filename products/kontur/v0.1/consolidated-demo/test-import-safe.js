'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePath = path.resolve(__dirname, 'kontur-consolidated-demo.js');
const originalRead = fs.readFileSync;
const originalOut = process.stdout.write;
const originalErr = process.stderr.write;
const reads = [];
let stdout = '';
let stderr = '';

try {
  fs.readFileSync = function patchedRead(target, ...args) {
    reads.push(String(target));
    return originalRead.call(this, target, ...args);
  };
  process.stdout.write = chunk => { stdout += String(chunk); return true; };
  process.stderr.write = chunk => { stderr += String(chunk); return true; };
  delete require.cache[require.resolve(modulePath)];
  require(modulePath);
} finally {
  fs.readFileSync = originalRead;
  process.stdout.write = originalOut;
  process.stderr.write = originalErr;
}

assert.strictEqual(stdout, '', 'module import must not write stdout');
assert.strictEqual(stderr, '', 'module import must not write stderr');
assert.strictEqual(reads.some(item => item.endsWith('.json')), false, `module import must not read data JSON: ${reads.join(', ')}`);
console.log('KONTUR_CONSOLIDATED_DEMO_IMPORT_SAFE_PASS');
