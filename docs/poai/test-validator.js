'use strict';
const fs = require('fs');
const path = require('path');
const { validatePoAI } = require('./validator.js');

const root = path.resolve(__dirname, '../..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

const validFiles = [
  'proposals/poai/test-vectors/valid/minimal-t.json',
  'proposals/poai/examples/vibe-coding-reality.poai.json',
  'proposals/poai/examples/quasi-existent-future.synthetic.poai.json',
  'proposals/poai/examples/quasi-existent-future.synthetic.successor.poai.json'
];
const invalidDir = path.join(root, 'proposals/poai/test-vectors/invalid');
const invalidFiles = fs.readdirSync(invalidDir).filter((name) => name.endsWith('.json')).map((name) => `proposals/poai/test-vectors/invalid/${name}`);

let failed = false;
for (const file of validFiles) {
  const result = validatePoAI(read(file));
  if (!result.valid) {
    failed = true;
    console.error(`Expected valid: ${file}`);
    console.error(result.errors);
  } else {
    console.log(`PASS valid: ${file}`);
  }
}
for (const file of invalidFiles) {
  const result = validatePoAI(read(file));
  if (result.valid) {
    failed = true;
    console.error(`Expected invalid: ${file}`);
  } else {
    console.log(`PASS invalid: ${file} -> ${result.errors.map((e) => e.code).join(', ')}`);
  }
}
if (failed) process.exit(1);
console.log(`Level 3 validator parity smoke test passed: ${validFiles.length} valid, ${invalidFiles.length} invalid.`);
