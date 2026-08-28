'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePaths = [
  path.join(__dirname, 'protective-assessment.js'),
  path.join(__dirname, 'receipt-binding.js')
];
let stdout = '';
let stderr = '';
const jsonReads = [];
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;
const originalRead = fs.readFileSync;
process.stdout.write = chunk => { stdout += String(chunk); return true; };
process.stderr.write = chunk => { stderr += String(chunk); return true; };
fs.readFileSync = function trackedRead(...args) {
  const file = String(args[0]);
  if (file.endsWith('.json')) jsonReads.push(file);
  return originalRead.apply(this, args);
};
let Runtime;
try {
  for (const modulePath of modulePaths) {
    try { delete require.cache[require.resolve(modulePath)]; } catch {}
  }
  Runtime = require(modulePaths[0]);
  require(modulePaths[1]);
} finally {
  fs.readFileSync = originalRead;
  process.stdout.write = originalStdout;
  process.stderr.write = originalStderr;
}
assert.strictEqual(stdout, '', 'import must not write stdout');
assert.strictEqual(stderr, '', 'import must not write stderr');
assert.deepStrictEqual(jsonReads, [], 'import must not load JSON fixtures/data');
for (const name of ['validateInput', 'deriveAssessment', 'validateReceipt', 'validationReceipt', 'runCli']) {
  assert.strictEqual(typeof Runtime[name], 'function', `${name} must be exported`);
}
console.log('FREESHIELD_LOCAL_MVP_IMPORT_SAFE_V0_1_PASS');
