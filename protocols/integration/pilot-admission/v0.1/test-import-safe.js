'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'pilot-admission.js');
const originalRead = fs.readFileSync;
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;
const reads = [];
let stdout = '';
let stderr = '';

fs.readFileSync = function patchedRead(file, ...args) {
  reads.push(String(file));
  return originalRead.call(this, file, ...args);
};
process.stdout.write = function patchedStdout(chunk, ...args) {
  stdout += String(chunk);
  return true;
};
process.stderr.write = function patchedStderr(chunk, ...args) {
  stderr += String(chunk);
  return true;
};

let Runtime;
try {
  delete require.cache[require.resolve(target)];
  Runtime = require(target);
} finally {
  fs.readFileSync = originalRead;
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
}

assert.strictEqual(stdout, '', 'module import must not write stdout');
assert.strictEqual(stderr, '', 'module import must not write stderr');
assert.strictEqual(reads.filter(name => name.endsWith('.json')).length, 0, 'module import must not read JSON evidence');
assert.strictEqual(typeof Runtime.deriveReceipt, 'function');
assert.strictEqual(typeof Runtime.validateReceipt, 'function');

const candidate = JSON.parse(originalRead(path.join(__dirname, 'examples/marketer-pessimist-real-non-personal.candidate.json'), 'utf8'));
const receipt = Runtime.deriveReceipt(candidate);
assert.strictEqual(receipt.pilot.status, 'READY_FOR_HUMAN_PILOT_ADMISSION_REVIEW');

console.log('UU_AAP_PRODUCT_PILOT_ADMISSION_IMPORT_SAFE_PASS');
