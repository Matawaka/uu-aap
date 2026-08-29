'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const original = fs.readFileSync;
let jsonReads = 0;
fs.readFileSync = function (...args) {
  const target = String(args[0]);
  if (target.endsWith('.json')) jsonReads += 1;
  return original.apply(this, args);
};

const modulePath = require.resolve('./accessibility-rereview.js');
delete require.cache[modulePath];
const ReReview = require('./accessibility-rereview.js');

fs.readFileSync = original;
assert.strictEqual(jsonReads, 0, 'import must not read review input JSON');
assert.strictEqual(typeof ReReview.assess, 'function');
assert.strictEqual(typeof ReReview.toV01Input, 'function');
console.log('Accessibility Re-review v0.2 import safety: PASS');
