'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const runtimePath = path.join(__dirname, 'pilot-disposition.js');
const bindingPath = path.join(__dirname, 'receipt-binding.js');

for (const target of [runtimePath, bindingPath]) {
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(target)})`], {
    encoding: 'utf8',
    cwd: path.resolve(__dirname, '../../../..')
  });
  assert.strictEqual(result.status, 0, `${target}: import failed: ${result.stderr}`);
  assert.strictEqual(result.stdout, '', `${target}: import wrote stdout`);
  assert.strictEqual(result.stderr, '', `${target}: import wrote stderr`);
}

const Runtime = require('./pilot-disposition.js');
const Binding = require('./receipt-binding.js');
assert.strictEqual(Runtime.PROTOCOL, 'UU-AAP-PRODUCT-PILOT-HUMAN-DISPOSITION');
assert.strictEqual(Runtime.VERSION, '0.1');
assert.strictEqual(typeof Runtime.deriveReceipt, 'function');
assert.strictEqual(typeof Runtime.validateReceipt, 'function');
assert.strictEqual(typeof Binding.validateReceiptAgainstDisposition, 'function');

console.log('UU_AAP_PRODUCT_PILOT_HUMAN_DISPOSITION_IMPORT_SAFE_PASS');
