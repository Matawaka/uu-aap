'use strict';

const assert = require('assert');
const fs = require('fs');

const writeNames = ['writeFileSync','writeFile','appendFileSync','appendFile','rmSync','unlinkSync','mkdirSync'];
const originals = new Map();
for (const name of writeNames) {
  if (typeof fs[name] === 'function') {
    originals.set(name, fs[name]);
    fs[name] = () => { throw new Error(`filesystem mutation during import: ${name}`); };
  }
}

const Runtime = require('./deployment-observation.js');
const Binding = require('./receipt-binding.js');
assert.equal(typeof Runtime.deriveReceipt, 'function');
assert.equal(typeof Binding.validateReceiptAgainstInput, 'function');

for (const [name, original] of originals) fs[name] = original;
console.log('MarketCloser deployment observation import safety: PASS');
