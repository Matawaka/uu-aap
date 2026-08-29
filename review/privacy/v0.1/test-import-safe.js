'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const original = fs.readFileSync;
let jsonReads = 0;
fs.readFileSync = function (...args) {
  const p = String(args[0] || '');
  if (p.endsWith('.json')) jsonReads += 1;
  return original.apply(this, args);
};
const modulePath = require.resolve('./privacy-review.js');
delete require.cache[modulePath];
const Review = require('./privacy-review.js');
fs.readFileSync = original;
assert.strictEqual(jsonReads, 0, 'import must not read review JSON');
assert.strictEqual(typeof Review.assess, 'function');
console.log('Privacy / Anti-Coercion Review v0.1 import safety: PASS');
