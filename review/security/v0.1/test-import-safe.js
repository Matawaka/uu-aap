'use strict';

const fs = require('node:fs');
let dataRead = false;
const original = fs.readFileSync;
fs.readFileSync = function patched(path, ...rest) {
  const text = String(path);
  if (text.endsWith('.json') && !text.includes('package.json')) dataRead = true;
  return original.call(this, path, ...rest);
};
require('./security-review.js');
fs.readFileSync = original;
if (dataRead) throw new Error('security review import must not read review data');
console.log('SECURITY_REVIEW_IMPORT_SAFE');
