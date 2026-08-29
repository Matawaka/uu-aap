'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const original = fs.readFileSync;
let reads = 0;
fs.readFileSync = function (...args) { reads += 1; return original.apply(this, args); };

const modulePath = require.resolve('./accessibility-review.js');
delete require.cache[modulePath];
const Review = require('./accessibility-review.js');

fs.readFileSync = original;
assert.strictEqual(reads, 0, 'import must not read files');
assert.strictEqual(typeof Review.assess, 'function');
assert.strictEqual(typeof Review.contrastRatio, 'function');
console.log('Accessibility Review v0.1 import safety: PASS');
