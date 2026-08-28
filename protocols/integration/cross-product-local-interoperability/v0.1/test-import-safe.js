'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePath = path.join(__dirname, 'local-interoperability.js');
let stdout = '';
let stderr = '';
const jsonReads = [];

const originalStdoutWrite = process.stdout.write;
const originalStderrWrite = process.stderr.write;
const originalReadFileSync = fs.readFileSync;

process.stdout.write = function trackedStdout(chunk) {
  stdout += String(chunk);
  return true;
};
process.stderr.write = function trackedStderr(chunk) {
  stderr += String(chunk);
  return true;
};
fs.readFileSync = function trackedRead(...args) {
  const target = String(args[0]);
  if (target.endsWith('.json')) jsonReads.push(target);
  return originalReadFileSync.apply(this, args);
};

let Interop;
try {
  delete require.cache[require.resolve(modulePath)];
  Interop = require(modulePath);
} finally {
  fs.readFileSync = originalReadFileSync;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
}

assert.strictEqual(stdout, '', 'import must not write stdout');
assert.strictEqual(stderr, '', 'import must not write stderr');
assert.deepStrictEqual(jsonReads, [], 'import must not read JSON fixtures or scenario data');

for (const name of [
  'validateScenario',
  'buildReceipt',
  'validateReceipt',
  'validationReceipt',
  'computeContentHash',
  'rehash',
  'runCli'
]) {
  assert.strictEqual(typeof Interop[name], 'function', `${name} must be exported`);
}

const help = Interop.runCli(['help']);
assert.strictEqual(help.exitCode, 0);
assert.match(help.text, /validate/);
assert.match(help.text, /inspect/);
assert.doesNotMatch(help.text, /send <|execute <|publish </);

console.log('CROSS_PRODUCT_LOCAL_INTEROP_IMPORT_SAFE_V0_1_PASS');
