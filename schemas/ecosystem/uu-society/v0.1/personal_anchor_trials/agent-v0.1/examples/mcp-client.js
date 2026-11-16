'use strict';

// Separate-process consumer: discovers tools instead of importing the engine.
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

async function main() {
  const client = new Client({ name: 'personal-anchor-example-agent', version: '0.1.0' },
    { versionNegotiation: { mode: 'auto' } });
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [path.join(__dirname, '../mcp-server.js')], stderr: 'pipe' });
  transport.stderr?.on('data', data => process.stderr.write(data));
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const described = await client.callTool({ name: 'experiment.describe', arguments: {} });
    const compared = await client.callTool({ name: 'experiment.compare', arguments: { scenario_id: 'L02' } });
    if (compared.isError) throw new Error('Experiment execution failed');
    const receipt = compared.structuredContent.result.receipt;
    const replayed = await client.callTool({ name: 'experiment.replay', arguments: { receipt } });
    if (replayed.isError) throw new Error('Receipt replay failed');
    process.stdout.write(JSON.stringify({
      protocol_version: client.getNegotiatedProtocolVersion(),
      tools: tools.tools.map(x => x.name),
      catalogue_size: described.structuredContent.result.catalogue.length,
      comparison: receipt.payload.comparison,
      replay: replayed.structuredContent.result,
      identity_established: false, authority_created: false,
    }, null, 2) + '\n');
  } finally { await client.close(); }
}

if (require.main === module) main().catch(() => {
  process.stderr.write('Example client failed.\n'); process.exitCode = 1;
});
