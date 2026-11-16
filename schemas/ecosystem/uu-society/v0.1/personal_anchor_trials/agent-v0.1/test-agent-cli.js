'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { handle, validate, limits } = require('./agent-core.js');
const { parseRequest } = require('./json-input.js');
const cli = path.join(__dirname, 'agent-cli.js');
const request = (operation, args = {}) => ({ interface_version: '0.1', operation, arguments: args });
function invoke(input, args = []) {
  const child = spawnSync(process.execPath, [cli, ...args], {
    input: typeof input === 'object' && !Buffer.isBuffer(input) ? JSON.stringify(input) : input,
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000, maxBuffer: limits.max_output_bytes + 4096,
  });
  assert.equal(child.error, undefined);
  const response = JSON.parse(child.stdout);
  assert.equal(validate('response')(response), true);
  assert.equal(child.stderr, '');
  return { response, child };
}

test('an independent process can discover, compare and replay without relying on its cwd', () => {
  const discovery = invoke(request('experiment.describe'));
  assert.equal(discovery.child.status, 0);
  assert.equal(discovery.response.result.catalogue.length, 16);
  const call = request('experiment.compare', { scenario_id: 'L02' });
  const compared = invoke(call);
  assert.deepEqual(compared.response, handle(call));
  const replayed = invoke(request('experiment.replay', { receipt: compared.response.result.receipt }));
  assert.equal(replayed.response.result.replay_matched, true);
});

test('custom decimal confidence survives strict JSON parsing as data', () => {
  const q = request('experiment.run', { arm: 'fresh_boundary', scenario: { id: 'decimal', events: [
    { type: 'issue', id: 'a' }, { type: 'complete', id: 'a', response: { confidence: 0.999999 } },
  ] } });
  assert.equal(invoke(q).response.execution_status, 'COMPLETED');
});

test('duplicate decoded keys, trailing documents, malformed JSON and invalid UTF-8 are rejected', () => {
  const inputs = ['{"operation":"a","operation":"b"}', '{"x":1,"\\u0078":2}',
    '{}{}', '{"x":', Buffer.from([0xff, 0xfe])];
  for (const raw of inputs) {
    const { response, child } = invoke(raw);
    assert.equal(response.error.code, 'INVALID_JSON');
    assert.equal(child.status, 2);
  }
});

test('JSON nesting, byte limits, ambiguous numbers and unpaired surrogates fail closed', () => {
  assert.throws(() => parseRequest(Buffer.from('['.repeat(40) + '0' + ']'.repeat(40))), /depth/);
  for (const raw of ['{"n":-0}', '{"n":1e400}', '{"n":9007199254740993}', '{"x":"\\ud800"}']) {
    assert.throws(() => parseRequest(Buffer.from(raw)));
  }
  const oversized = invoke(' '.repeat(limits.max_request_bytes + 1));
  assert.equal(oversized.response.error.code, 'REQUEST_LIMIT');
});

test('CLI arguments cannot expose reference rewriting or arbitrary commands', () => {
  const { response, child } = invoke(request('experiment.describe'), ['--write-reference']);
  assert.equal(response.error.code, 'INVALID_REQUEST');
  assert.equal(child.status, 2);
});
