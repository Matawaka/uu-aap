'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

for (const file of ['engine.js','adapter.js','receipt-binding.js']) {
  const target = path.resolve(__dirname, file);
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(target)})`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${file} import failed: ${result.stderr}`);
  if (result.stdout !== '' || result.stderr !== '') throw new Error(`${file} import must be silent`);
}
console.log('MarketCloser real stress-test adapter import safety: PASS');
