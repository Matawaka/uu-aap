'use strict';

const fs = require('fs');
const path = require('path');

const beforeArgv = [...process.argv];
const beforeExitCode = process.exitCode;
const modulePath = path.resolve(__dirname, 'bridge.js');
const source = fs.readFileSync(modulePath, 'utf8');
const Bridge = require(modulePath);

if (process.exitCode !== beforeExitCode) throw new Error('import changed process.exitCode');
if (JSON.stringify(process.argv) !== JSON.stringify(beforeArgv)) throw new Error('import changed argv');
if (typeof Bridge.deriveReceipt !== 'function' || typeof Bridge.deriveMarketerIntake !== 'function') {
  throw new Error('expected SDK exports missing');
}
for (const token of ['child_process', "require('http')", "require('https')", 'fetch(', 'writeFileSync', 'appendFile', 'execSync', 'spawnSync']) {
  if (source.includes(token)) throw new Error(`forbidden production surface: ${token}`);
}

console.log('MarketCloser minimized bridge import safety: PASS');
