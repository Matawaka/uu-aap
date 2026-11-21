'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { checkReceipt, checkReplay, checkEnvelope, expectedSource, hash, fileHash,
  agentDir, agentRequire } = require('./check-consumer.js');
const { Client } = agentRequire('@modelcontextprotocol/client');
const { StdioClientTransport } = agentRequire('@modelcontextprotocol/client/stdio');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8'));
const cli = { name: 'json-cli', protocol: null, async close() {}, async call(operation, args) {
  const p = spawnSync(process.execPath, [path.join(agentDir, 'agent-cli.js')], {
    input: JSON.stringify({ interface_version: '0.1', operation, arguments: args }),
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(p.error, undefined); assert.equal(p.stderr, '');
  assert([0, 2].includes(p.status));
  const response = JSON.parse(p.stdout);
  assert.equal(p.status, response.execution_status === 'COMPLETED' ? 0 : 2);
  return response;
} };
async function mcp(mode) {
  const client = new Client({ name: 'uu-aap-policy-trial-consumer', version: '0.1.0' },
    mode === 'modern' ? { versionNegotiation: { mode: 'auto' } } : {});
  const transport = new StdioClientTransport({ command: process.execPath,
    args: [path.join(agentDir, 'mcp-server.js')], cwd: os.tmpdir(), stderr: 'pipe' });
  let errors = '';
  transport.stderr?.on('data', b => { errors += b; });
  try {
    await client.connect(transport);
    const protocol = mode === 'modern' ? '2026-07-28' : '2025-11-25';
    assert.equal(client.getNegotiatedProtocolVersion(), protocol);
    const tools = await client.listTools();
    assert.deepEqual(tools.tools.map(t => t.name).sort(),
      ['experiment.compare', 'experiment.describe', 'experiment.replay', 'experiment.run']);
    return { name: `mcp-${mode}`, protocol,
      async call(operation, args) {
        const result = await client.callTool({ name: operation, arguments: args });
        if (result.isError && !result.structuredContent) {
          assert.match(result.content.map(c => c.text ?? '').join('\n'),
            /Input validation error: Invalid arguments for tool experiment\.run:/);
          return { transport_error: 'INPUT_SCHEMA_REJECTED' };
        }
        assert.equal(Boolean(result.isError), result.structuredContent.execution_status === 'ERROR');
        return result.structuredContent;
      }, async close() { await client.close(); assert.equal(errors, ''); } };
  } catch (error) { await client.close(); throw error; }
}
async function refused(lane, operation, args) {
  let response;
  try { response = await lane.call(operation, args); }
  catch (error) {
    assert(['experiment.recover', 'experiment.exchange_token'].includes(operation));
    assert.equal(error.code, -32602);
    assert.equal(error.message, `Tool ${operation} not found`);
    return { operation, rejection: 'MCP_TOOL_NOT_FOUND', protocol_error_code: error.code };
  }
  if (response.transport_error === 'INPUT_SCHEMA_REJECTED') {
    return { operation, rejection: response.transport_error };
  }
  assert.equal(response.execution_status, 'ERROR', `${lane.name} unexpectedly accepted ${operation}`);
  const code = ['experiment.recover', 'experiment.exchange_token'].includes(operation) ?
    'UNSUPPORTED_OPERATION' : 'INVALID_REQUEST';
  assert.equal(response.error.code, code);
  return { operation, rejection: code };
}
async function run() {
  // Preflight source bytes before any subprocess starts. New tests never repin the old engine.
  const source = expectedSource();
  const lanes = [cli];
  try {
    lanes.push(await mcp('modern'));
    lanes.push(await mcp('legacy'));
    const refusals = [];
    for (const lane of lanes) {
      const described = await lane.call('experiment.describe', {});
      checkEnvelope(described, 'experiment.describe');
      assert.deepEqual(described.result.source, source);
      assert.equal(described.result.end_to_end_status, 'NOT_EXECUTED');
      assert.equal(described.result.catalogue.length, 16);
      assert.deepEqual(described.result.tools.map(t => t.name).sort(),
        ['experiment.compare', 'experiment.describe', 'experiment.replay', 'experiment.run']);
      refusals.push({ route: lane.name, observations: [
        await refused(lane, 'experiment.recover', {}),
        await refused(lane, 'experiment.exchange_token', {}),
        await refused(lane, 'experiment.run', { scenario_id: 'L00', arm: 'fresh_boundary', authority_created: true }),
        await refused(lane, 'experiment.run', { scenario_id: 'L00', arm: 'fresh_boundary', expected: 'AUTHORIZED' }),
      ] });
    }
    const results = [];
    for (const c of cases) {
      const args = { scenario: c.scenario, ...(c.hypothesis === null ? {} : { hypothesis: c.hypothesis }) };
      const compared = [];
      const routeResults = [];
      for (const lane of lanes) {
        const response = await lane.call('experiment.compare', args);
        const conclusion = checkReceipt(response, c);
        const receipt = response.result.receipt;
        compared.push(receipt);
        const singleHashes = {};
        for (const arm of ['fresh_boundary', 'cached_boundary']) {
          const single = await lane.call('experiment.run', { ...args, arm });
          checkReceipt(single, c, 'experiment.run', arm);
          const singleReceipt = single.result.receipt;
          assert.deepEqual(singleReceipt.payload.observations,
            receipt.payload.observations.filter(o => o.arm === arm), 'run and compare differ');
          checkReplay(await lane.call('experiment.replay', { receipt: singleReceipt }), singleReceipt);
          singleHashes[arm] = singleReceipt.receipt_hash;
        }
        checkReplay(await lane.call('experiment.replay', { receipt }), receipt);
        routeResults.push({ route: lane.name, comparison_receipt_hash: receipt.receipt_hash,
          single_receipt_hashes: singleHashes, own_replays_matched: 3, conclusion });
      }
      assert.deepEqual(compared[0], compared[1], 'CLI and modern MCP differ');
      assert.deepEqual(compared[0], compared[2], 'CLI and legacy MCP differ');
      // Every ordered pair of distinct routes reproduces the other's comparison receipt.
      const cross = [];
      for (let from = 0; from < lanes.length; from++) {
        for (let to = 0; to < lanes.length; to++) {
          if (from === to) continue;
          checkReplay(await lanes[to].call('experiment.replay', { receipt: compared[from] }), compared[from]);
          cross.push({ from: lanes[from].name, to: lanes[to].name, replay_matched: true });
        }
      }
      results.push({ case_id: c.id, receipt: compared[0], routes: routeResults, cross_route_replays: cross });
    }
    // Corrected public hashes cannot turn a negative observation into a reproduced result.
    const tampered = structuredClone(results.find(r => r.case_id === 'P02').receipt);
    const row = tampered.payload.observations[0].receipts[0];
    row.contract_status = 'READY'; row.contract_reason = null;
    delete row.receipt_hash; row.receipt_hash = hash(row);
    delete tampered.receipt_hash; tampered.receipt_hash = hash(tampered);
    for (const lane of lanes) {
      const failure = await lane.call('experiment.replay', { receipt: tampered });
      assert.equal(failure.execution_status, 'ERROR');
      assert.equal(failure.error.code, 'REPLAY_RESULT_MISMATCH');
      // A failed replay must not poison the following valid request.
      checkReplay(await lane.call('experiment.replay', { receipt: results[0].receipt }), results[0].receipt);
    }
    return { schema: 'uuaap.personal-anchor.consumer-trials/v0.1',
      scope: 'DETERMINISTIC_SUBPROCESS_CONSUMER_NOT_AUTONOMOUS_AGENT',
      source, consumer_source_sha256: Object.fromEntries([
        'cases.json', 'interface-pins.json', 'check-consumer.js', 'run-consumer-trials.js', 'test-consumer.js',
      ].map(n => [n, fileHash(path.join(__dirname, n))])),
      routes: lanes.map(l => ({ name: l.name, protocol_version: l.protocol })),
      summary: { cases: cases.length, route_case_comparisons: results.length * lanes.length,
        run_receipts_replayed: results.length * lanes.length * 2,
        comparison_receipts_replayed: results.length * lanes.length,
        ordered_cross_route_replays: results.length * lanes.length * (lanes.length - 1),
        corrected_hash_tamper_rejections: lanes.length, refused_operations_per_route: 4,
        differential_cases: results.filter(r => r.receipt.payload.comparison.length > 0).length },
      preserved_limits: { autonomous_agent_trial: 'NOT_EXECUTED', recovery_endpoint: 'NOT_IMPLEMENTED',
        token_exchange_endpoint: 'NOT_IMPLEMENTED', final_effect_boundary: 'NOT_IMPLEMENTED',
        real_person_continuity: 'NOT_EXECUTED', audio_trials: 'NOT_EXECUTED',
        independent_verification: false, identity_established: false, authority_created: false,
        external_effects_performed: false }, refusals, results };
  } finally {
    for (const lane of lanes.reverse()) await lane.close();
  }
}
async function main() {
  const flags = process.argv.slice(2);
  assert(flags.length <= 1 && (flags.length === 0 || ['--write-reference', '--check-reference'].includes(flags[0])),
    'use no flags, --write-reference or --check-reference');
  const report = await run();
  const target = path.join(__dirname, 'reference-report.json');
  if (flags[0] === '--write-reference') fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  else if (flags[0] === '--check-reference') assert.deepEqual(report, JSON.parse(fs.readFileSync(target, 'utf8')));
  else { process.stdout.write(JSON.stringify(report, null, 2) + '\n'); return; }
  process.stdout.write(JSON.stringify({ status: 'CONSUMER_TRIALS_MATCHED', ...report.summary }) + '\n');
}
if (require.main === module) main().catch(error => { process.stderr.write(error.stack + '\n'); process.exitCode = 1; });
module.exports = { run };
