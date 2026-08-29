'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const original = fs.readFileSync;
let inputReads = 0;

fs.readFileSync = function (target, ...rest) {
  if (typeof target === 'string' && target.endsWith('.json')) inputReads += 1;
  return original.call(this, target, ...rest);
};

const modulePath = require.resolve('./accessibility-review.js');
delete require.cache[modulePath];
const Review = require('./accessibility-review.js');

fs.readFileSync = original;
assert.strictEqual(inputReads, 0, 'import must not read review input JSON');
assert.strictEqual(typeof Review.assess, 'function');
assert.strictEqual(typeof Review.contrastRatio, 'function');
console.log('Accessibility Review v0.1 import safety: PASS');
