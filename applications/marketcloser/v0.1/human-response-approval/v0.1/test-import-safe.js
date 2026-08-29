'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

for (const file of ['approval.js','receipt-binding.js']) {
  const target = path.resolve(__dirname, file);
  const result = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(target)})`], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${file} import failed: ${result.stderr}`);
  if (result.stdout !== '' || result.stderr !== '') throw new Error(`${file} import emitted output`);
}

console.log('MarketCloser Human Response Approval import safety: PASS');
