'use strict';

const assert = require('assert');

let stdoutWrites = 0;
let stderrWrites = 0;
const stdoutWrite = process.stdout.write;
const stderrWrite = process.stderr.write;

process.stdout.write = function (...args) {
  stdoutWrites += 1;
  return true;
};
process.stderr.write = function (...args) {
  stderrWrites += 1;
  return true;
};

let Runtime;
try {
  Runtime = require('./receipt-runtime.js');
} finally {
  process.stdout.write = stdoutWrite;
  process.stderr.write = stderrWrite;
}

assert(Runtime && Runtime.VERSION === '0.1');
assert.strictEqual(stdoutWrites, 0, 'Receipt Runtime wrote to stdout during import');
assert.strictEqual(stderrWrites, 0, 'Receipt Runtime wrote to stderr during import');
assert.strictEqual(typeof Runtime.computeContentHash, 'function');
assert.strictEqual(typeof Runtime.rehash, 'function');
assert.strictEqual(typeof Runtime.verifyContentHash, 'function');

console.log('Receipt Runtime SDK v0.1 import safety: PASS');
