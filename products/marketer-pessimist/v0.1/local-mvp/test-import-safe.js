'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePaths = [
  path.join(__dirname, 'stress-test.js'),
  path.join(__dirname, 'receipt-binding.js')
];

let stdout = '';
let stderr = '';
const dataReads = [];
const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalReadFileSync = fs.readFileSync;

process.stdout.write = function writeStdout(chunk) {
  stdout += String(chunk);
  return true;
};
process.stderr.write = function writeStderr(chunk) {
  stderr += String(chunk);
  return true;
};
fs.readFileSync = function trackedRead(...args) {
  const target = String(args[0]);
  if (target.endsWith('.json')) dataReads.push(target);
  return originalReadFileSync.apply(this, args);
};

let Runtime;
let Binding;
try {
  for (const modulePath of modulePaths) {
    try { delete require.cache[require.resolve(modulePath)]; } catch {}
  }
  Runtime = require(modulePaths[0]);
  Binding = require(modulePaths[1]);
} finally {
  fs.readFileSync = originalReadFileSync;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

assert.strictEqual(stdout, '', 'import must not write stdout');
assert.strictEqual(stderr, '', 'import must not write stderr');
assert.deepStrictEqual(dataReads, [], 'import must not read contract, fixture or input JSON data');
for (const name of ['validateInput', 'analyze', 'validateReceipt', 'validationReceipt', 'inspectInput', 'runCli']) {
  assert.strictEqual(typeof Runtime[name], 'function', `${name} must be exported`);
}
assert.strictEqual(typeof Binding.validateReceiptAgainstInput, 'function', 'source-aware receipt binding must be exported');

console.log('MARKETER_PESSIMIST_LOCAL_MVP_IMPORT_SAFE_V0_1_PASS');
