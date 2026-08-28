'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const target = path.resolve(__dirname, 'authority-gate.js');
const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(target)});`], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(`import failed: ${result.stderr || result.stdout}`);
if ((result.stdout || '').trim() !== '' || (result.stderr || '').trim() !== '') {
  throw new Error(`import produced output: stdout=${JSON.stringify(result.stdout)} stderr=${JSON.stringify(result.stderr)}`);
}
console.log('MarketCloser authority gate import safety: PASS');
