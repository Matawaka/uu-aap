'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const script = path.join(ROOT, 'validate-authorize-admission.js');

const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
assert.strictEqual(imported.status, 0, imported.stderr);
assert.strictEqual(imported.stdout, '');
assert.strictEqual(imported.stderr, '');

const api = require('./validate-authorize-admission.js');
for (const key of ['computeContentHash','runConformance','stableCanonicalize','validateAssessment']) {
  assert.strictEqual(typeof api[key], 'function', `${key} must be exported`);
}

const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'conformance.fixture.json'), 'utf8'));
const bundlePath = process.env.UU_AAP_PRE_ACTION_FIXTURE || path.join(ROOT, '..', '..', 'pre-action-evidence-bundle', 'v0.1', 'conformance.fixture.json');
const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
assert.strictEqual(api.validateAssessment(fixture, bundle), true);
assert.strictEqual(api.computeContentHash(fixture), fixture.content_hash);
process.stdout.write('PASS Pre-Action Authorize Admission import-safe validator seam\n');
