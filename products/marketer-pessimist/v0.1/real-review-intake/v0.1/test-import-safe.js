'use strict';

const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

for (const file of ['real-review-intake.js', 'candidate-binding.js']) {
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(path.join(__dirname, file))})`], {
    encoding: 'utf8'
  });
  assert.strictEqual(result.status, 0, `${file} import failed: ${result.stderr}`);
  assert.strictEqual(result.stdout, '', `${file} import wrote stdout`);
  assert.strictEqual(result.stderr, '', `${file} import wrote stderr`);
}

const Runtime = require('./real-review-intake.js');
const Binding = require('./candidate-binding.js');
assert.strictEqual(typeof Runtime.validateInput, 'function');
assert.strictEqual(typeof Runtime.deriveCandidate, 'function');
assert.strictEqual(typeof Runtime.validateCandidate, 'function');
assert.strictEqual(typeof Binding.validateCandidateAgainstInput, 'function');

console.log('PASS: real review intake production imports are silent and reusable');