'use strict';

const before = { stdout: process.stdout.write, stderr: process.stderr.write, exitCode: process.exitCode };
const modulePath = './disposition.js';
const imported = require(modulePath);

if (!imported || typeof imported.deriveReceipt !== 'function' || typeof imported.validateReceipt !== 'function') {
  throw new Error('disposition module exports incomplete');
}
if (process.stdout.write !== before.stdout || process.stderr.write !== before.stderr || process.exitCode !== before.exitCode) {
  throw new Error('import changed process output/exit state');
}
console.log('MarketCloser Human Analysis Disposition Gate import safety: PASS');
