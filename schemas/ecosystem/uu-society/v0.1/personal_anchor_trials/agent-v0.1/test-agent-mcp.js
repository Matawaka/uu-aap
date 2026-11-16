'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const Ajv2020 = require('ajv/dist/2020');
const { handle } = require('./agent-core.js');

test('oversized MCP frames terminate within the transport budget', { timeout: 10000 }, () => {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync(process.execPath, [path.join(__dirname, 'mcp-server.js')], {
    input: 'x'.repeat(1048577), encoding: 'utf8', timeout: 8000, maxBuffer: 4096,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /MCP transport rejected a request/);
});

for (const mode of ['modern', 'legacy']) {
  test(`official SDK client in a separate process connection: ${mode}`, { timeout: 20000 }, async () => {
    const client = new Client({ name: 'uu-aap-trial-test-client', version: '0.1.0' },
      mode === 'modern' ? { versionNegotiation: { mode: 'auto' } } : {});
    const transport = new StdioClientTransport({ command: process.execPath,
      args: [path.join(__dirname, 'mcp-server.js')], cwd: require('node:os').tmpdir(), stderr: 'pipe' });
    let errors = '';
    transport.stderr?.on('data', data => { errors += data; });
    try {
      await client.connect(transport);
      assert.equal(client.getNegotiatedProtocolVersion(), mode === 'modern' ? '2026-07-28' : '2025-11-25');
      const listed = await client.listTools();
      assert.deepEqual(listed.tools.map(x => x.name).sort(),
        ['experiment.compare', 'experiment.describe', 'experiment.replay', 'experiment.run']);
      const outputs = new Map();
      for (const tool of listed.tools) {
        assert.equal(tool.annotations.readOnlyHint, true);
        assert.equal(tool.annotations.openWorldHint, false);
        outputs.set(tool.name, new Ajv2020({ strict: true, validateFormats: false }).compile(tool.outputSchema));
      }
      const discovery = await client.callTool({ name: 'experiment.describe', arguments: {} });
      assert.equal(discovery.structuredContent.result.catalogue.length, 16);
      const args = { scenario_id: 'L02' };
      const result = await client.callTool({ name: 'experiment.compare', arguments: args });
      assert.equal(outputs.get('experiment.compare')(result.structuredContent), true);
      assert.deepEqual(result.structuredContent,
        handle({ interface_version: '0.1', operation: 'experiment.compare', arguments: args }));
      const replayed = await client.callTool({ name: 'experiment.replay',
        arguments: { receipt: result.structuredContent.result.receipt } });
      assert.equal(replayed.structuredContent.result.replay_matched, true);
      const run = await client.callTool({ name: 'experiment.run', arguments: { scenario_id: 'L07', arm: 'fresh_boundary' } });
      assert.equal(run.structuredContent.result.receipt.payload.observations[0].receipts[0].response_status, 'RESPONSE_EXPIRED');
      const invalid = await client.callTool({ name: 'experiment.run', arguments: { scenario_id: 'L00', arm: 'fresh_boundary', command: 'arbitrary' } });
      assert.equal(invalid.isError, true);
    } finally {
      await client.close();
    }
    assert.equal(errors, '');
  });
}
