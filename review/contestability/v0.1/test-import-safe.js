'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const original = fs.readFileSync;
let dataReads = 0;
fs.readFileSync = function (...args) {
  const target = String(args[0] || '');
  if (target.endsWith('.json')) dataReads += 1;
  return original.apply(this, args);
};

const modulePath = require.resolve('./contestability-review.js');
delete require.cache[modulePath];
const Review = require('./contestability-review.js');

fs.readFileSync = original;
assert.strictEqual(dataReads, 0, 'import must not read review input data');
assert.strictEqual(typeof Review.assess, 'function');
assert.strictEqual(typeof Review.validateInput, 'function');
console.log('Contestability Review v0.1 import safety: PASS');
