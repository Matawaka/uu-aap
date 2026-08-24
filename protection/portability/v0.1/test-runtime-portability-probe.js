'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Probe = require('./runtime-portability-probe.js');

const NOW = '2026-08-24T04:00:00Z';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function mustReject(label, fn) {
  let rejected = false;
  try { await fn(); } catch (_) { rejected = true; }
  assert.strictEqual(rejected, true, `${label}: expected fail-closed rejection`);
}

(async () => {
  const live = await Probe.probeRuntime({ observedAt: NOW });
  assert.strictEqual(live.artifact_type, 'RuntimePortabilityReceipt');
  assert.strictEqual(live.capabilities.temporary_workspace.status, 'observed_supported');
  assert(['observed_supported', 'observed_unavailable'].includes(live.capabilities.file_fsync.status));
  assert(['observed_supported', 'observed_unavailable'].includes(live.capabilities.directory_fsync.status));
  assert.strictEqual(await Probe.verifyReceipt(live), true);
  assert.strictEqual(live.claims.runtime_capabilities_observed, true);
  for (const key of Probe.FALSE_CLAIMS) assert.strictEqual(live.claims[key], false, key);

  const syntheticRuntime = {
    platform: 'synthetic-os',
    arch: 'synthetic-arch',
    node_version: 'v24.0.0',
    temp_root_strategy: 'os_native'
  };
  const unavailableDirectory = {
    temporary_workspace: Probe.observedSupported(),
    file_fsync: Probe.observedSupported(),
    directory_fsync: Probe.observedUnavailable({ code: 'SYNTHETIC_NO_DIR_FSYNC' })
  };
  const synthetic = await Probe.buildReceipt({
    observedAt: NOW,
    runtime: syntheticRuntime,
    capabilities: unavailableDirectory
  });
  assert.strictEqual(synthetic.capabilities.directory_fsync.status, 'observed_unavailable');
  assert.strictEqual(synthetic.capabilities.directory_fsync.error_code, 'SYNTHETIC_NO_DIR_FSYNC');
  assert.strictEqual(synthetic.claims.durability_requirement_satisfied, false);
  assert.strictEqual(synthetic.claims.durability_fallback_authorized, false);
  assert.strictEqual(await Probe.verifyReceipt(synthetic), true);

  const synthetic2 = await Probe.buildReceipt({
    observedAt: NOW,
    runtime: syntheticRuntime,
    capabilities: unavailableDirectory
  });
  assert.deepStrictEqual(synthetic2, synthetic, 'fixed observation inputs must be deterministic');

  const overclaim = clone(synthetic);
  overclaim.claims.durability_fallback_authorized = true;
  await mustReject('fallback authorization overclaim', async () => Probe.verifyReceipt(overclaim));

  const konturOverclaim = clone(synthetic);
  konturOverclaim.claims.kontur_readiness_established = true;
  await mustReject('KONTUR readiness overclaim', async () => Probe.verifyReceipt(konturOverclaim));

  const statusMismatch = clone(synthetic);
  statusMismatch.capabilities.directory_fsync.status = 'observed_supported';
  await mustReject('supported status with error code', async () => Probe.verifyReceipt(statusMismatch));

  const unavailableWithoutCode = clone(synthetic);
  unavailableWithoutCode.capabilities.directory_fsync.error_code = '';
  await mustReject('unavailable status without error code', async () => Probe.verifyReceipt(unavailableWithoutCode));

  const idTamper = clone(synthetic);
  idTamper.receipt_id = `urn:uu-aap:portability:runtime:${'0'.repeat(24)}`;
  await mustReject('receipt id tamper', async () => Probe.verifyReceipt(idTamper));

  const unexpected = clone(synthetic);
  unexpected.runtime.kernel = 'invented';
  await mustReject('unexpected runtime field', async () => Probe.verifyReceipt(unexpected));

  const badTime = clone(synthetic);
  badTime.observed_at = 'not-a-time';
  await mustReject('invalid observation time', async () => Probe.verifyReceipt(badTime));

  const nonexistent = path.join(os.tmpdir(), `uu-aap-missing-${Date.now()}`, 'nope');
  assert.strictEqual(fs.existsSync(nonexistent), false);
  await mustReject('missing temp parent', async () => Probe.probeRuntime({ observedAt: NOW, tempParent: nonexistent }));

  console.log('Runtime Portability Probe v0.1: PASS');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
