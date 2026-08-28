'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const modulePaths = [
  path.join(__dirname, 'honest-hiring.js'),
  path.join(__dirname, 'result-binding.js'),
  path.join(__dirname, '../../../freeshield/v0.1/local-mvp/protective-assessment.js'),
  path.join(__dirname, '../../../freeshield/v0.1/local-mvp/receipt-binding.js')
];

let stdout = '';
let stderr = '';
const dataReads = [];
const originalStdout = process.stdout.write;
const originalStderr = process.stderr.write;
const originalRead = fs.readFileSync;
process.stdout.write = chunk => { stdout += String(chunk); return true; };
process.stderr.write = chunk => { stderr += String(chunk); return true; };
fs.readFileSync = function trackedRead(...args) {
  const file = String(args[0]);
  if (file.endsWith('.json')) dataReads.push(file);
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
assert.deepStrictEqual(dataReads, [], 'import must not read JSON fixtures/data');
for (const name of ['validateInput','deriveRequirementReceipt','deriveComparisonReceipt','deriveResult','validateResult','runCli']) {
  assert.strictEqual(typeof Runtime[name], 'function', `${name} must be exported`);
}

console.log('HONEST_HIRING_LOCAL_MVP_IMPORT_SAFE_V0_1_PASS');
