'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const FALSE_CLAIMS = [
  'cross_platform_equivalence_proven',
  'durability_requirement_satisfied',
  'durability_fallback_authorized',
  'authority_established',
  'canonicality_established',
  'legal_liability_determined',
  'kontur_readiness_established',
  'kontur_activation_authorized',
  'kontur_activated'
];

function assert(value, message) {
  if (!value) throw new Error(`Runtime Portability Probe: ${message}`);
}

function errorCode(error) {
  if (error && typeof error.code === 'string' && error.code.length > 0) return error.code;
  if (error && typeof error.name === 'string' && error.name.length > 0) return error.name;
  return 'UNKNOWN_ERROR';
}

function observedSupported() {
  return { status: 'observed_supported', error_code: null };
}

function observedUnavailable(error) {
  return { status: 'observed_unavailable', error_code: errorCode(error) };
}

async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}

function probeFileFsync(workspace) {
  const file = path.join(workspace, 'file-fsync-probe.bin');
  let fd = null;
  try {
    fd = fs.openSync(file, 'wx', 0o600);
    fs.writeSync(fd, Buffer.from('uu-aap-portability-probe\n', 'utf8'));
    fs.fsyncSync(fd);
    return observedSupported();
  } catch (error) {
    return observedUnavailable(error);
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) { /* probe cleanup only */ }
    }
    try { fs.rmSync(file, { force: true }); } catch (_) { /* probe cleanup only */ }
  }
}

function probeDirectoryFsync(workspace) {
  let fd = null;
  try {
    fd = fs.openSync(workspace, 'r');
    fs.fsyncSync(fd);
    return observedSupported();
  } catch (error) {
    return observedUnavailable(error);
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_) { /* probe cleanup only */ }
    }
  }
}

function assertCapability(capability, label) {
  assert(capability && typeof capability === 'object' && !Array.isArray(capability), `${label} capability required`);
  assert(JSON.stringify(Object.keys(capability).sort()) === JSON.stringify(['error_code', 'status']), `${label} capability fields mismatch`);
  assert(['observed_supported', 'observed_unavailable'].includes(capability.status), `${label} status invalid`);
  if (capability.status === 'observed_supported') assert(capability.error_code === null, `${label} supported status requires null error_code`);
  if (capability.status === 'observed_unavailable') assert(typeof capability.error_code === 'string' && capability.error_code.length > 0, `${label} unavailable status requires error_code`);
}

function assertReceiptSemantics(receipt) {
  assert(receipt && typeof receipt === 'object' && !Array.isArray(receipt), 'receipt object required');
  const top = ['$schema', 'artifact_type', 'artifact_version', 'capabilities', 'claims', 'observed_at', 'receipt_id', 'runtime'];
  assert(JSON.stringify(Object.keys(receipt).sort()) === JSON.stringify(top), 'receipt top-level fields mismatch');
  assert(receipt.$schema === './runtime-portability-receipt.schema.json', 'schema ref mismatch');
  assert(receipt.artifact_type === 'RuntimePortabilityReceipt' && receipt.artifact_version === '0.1', 'artifact type/version mismatch');
  assert(/^urn:uu-aap:portability:runtime:[0-9a-f]{24}$/.test(receipt.receipt_id), 'receipt_id invalid');
  assert(Number.isFinite(Date.parse(receipt.observed_at)), 'observed_at invalid');

  const runtime = receipt.runtime;
  assert(runtime && JSON.stringify(Object.keys(runtime).sort()) === JSON.stringify(['arch', 'node_version', 'platform', 'temp_root_strategy']), 'runtime fields mismatch');
  assert(typeof runtime.platform === 'string' && runtime.platform.length > 0, 'runtime platform invalid');
  assert(typeof runtime.arch === 'string' && runtime.arch.length > 0, 'runtime arch invalid');
  assert(/^v[0-9]+\.[0-9]+\.[0-9]+/.test(runtime.node_version), 'runtime node_version invalid');
  assert(runtime.temp_root_strategy === 'os_native', 'temp root strategy mismatch');

  assert(receipt.capabilities && JSON.stringify(Object.keys(receipt.capabilities).sort()) === JSON.stringify(['directory_fsync', 'file_fsync', 'temporary_workspace']), 'capability set mismatch');
  assertCapability(receipt.capabilities.temporary_workspace, 'temporary_workspace');
  assertCapability(receipt.capabilities.file_fsync, 'file_fsync');
  assertCapability(receipt.capabilities.directory_fsync, 'directory_fsync');
  assert(receipt.capabilities.temporary_workspace.status === 'observed_supported', 'receipt requires successful temporary workspace observation');

  const claims = receipt.claims;
  const expectedClaims = ['authority_established', 'canonicality_established', 'cross_platform_equivalence_proven', 'durability_fallback_authorized', 'durability_requirement_satisfied', 'kontur_activated', 'kontur_activation_authorized', 'kontur_readiness_established', 'legal_liability_determined', 'runtime_capabilities_observed'];
  assert(claims && JSON.stringify(Object.keys(claims).sort()) === JSON.stringify(expectedClaims), 'claims fields mismatch');
  assert(claims.runtime_capabilities_observed === true, 'runtime_capabilities_observed must be true');
  for (const key of FALSE_CLAIMS) assert(claims[key] === false, `unsafe claim ${key}`);
}

async function buildReceipt({ observedAt, runtime, capabilities }) {
  assert(Number.isFinite(Date.parse(observedAt)), 'observed_at invalid');
  const core = {
    artifact_version: '0.1',
    observed_at: observedAt,
    runtime,
    capabilities
  };
  const digest = await digestJson(core);
  const receipt = {
    $schema: './runtime-portability-receipt.schema.json',
    artifact_type: 'RuntimePortabilityReceipt',
    artifact_version: '0.1',
    receipt_id: `urn:uu-aap:portability:runtime:${digest.slice(0, 24)}`,
    observed_at: observedAt,
    runtime,
    capabilities,
    claims: {
      runtime_capabilities_observed: true,
      cross_platform_equivalence_proven: false,
      durability_requirement_satisfied: false,
      durability_fallback_authorized: false,
      authority_established: false,
      canonicality_established: false,
      legal_liability_determined: false,
      kontur_readiness_established: false,
      kontur_activation_authorized: false,
      kontur_activated: false
    }
  };
  assertReceiptSemantics(receipt);
  return receipt;
}

async function probeRuntime({ observedAt = new Date().toISOString(), tempParent = os.tmpdir() } = {}) {
  assert(typeof tempParent === 'string' && tempParent.length > 0, 'temp parent required');
  const parentReal = fs.realpathSync(tempParent);
  let workspace = null;
  try {
    workspace = fs.mkdtempSync(path.join(parentReal, 'uu-aap-portability-v01-'));
    const capabilities = {
      temporary_workspace: observedSupported(),
      file_fsync: probeFileFsync(workspace),
      directory_fsync: probeDirectoryFsync(workspace)
    };
    return await buildReceipt({
      observedAt,
      runtime: {
        platform: process.platform,
        arch: process.arch,
        node_version: process.version,
        temp_root_strategy: 'os_native'
      },
      capabilities
    });
  } finally {
    if (workspace !== null) fs.rmSync(workspace, { recursive: true, force: true });
  }
}

async function verifyReceipt(receipt) {
  assertReceiptSemantics(receipt);
  const core = {
    artifact_version: '0.1',
    observed_at: receipt.observed_at,
    runtime: receipt.runtime,
    capabilities: receipt.capabilities
  };
  const digest = await digestJson(core);
  const expected = `urn:uu-aap:portability:runtime:${digest.slice(0, 24)}`;
  assert(receipt.receipt_id === expected, 'receipt identity mismatch');
  return true;
}

async function cli(argv) {
  const [mode, outputPath, observedAt] = argv;
  if (mode === 'probe') {
    assert(outputPath, 'usage: probe <output.json> [observed_at]');
    const receipt = await probeRuntime({ observedAt: observedAt || new Date().toISOString() });
    fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ receipt_id: receipt.receipt_id, capabilities: receipt.capabilities }));
    return;
  }
  if (mode === 'verify') {
    assert(outputPath && !observedAt, 'usage: verify <receipt.json>');
    const receipt = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    await verifyReceipt(receipt);
    console.log('Runtime Portability Receipt verified');
    return;
  }
  throw new Error('Runtime Portability Probe: mode must be probe or verify');
}

if (require.main === module) {
  cli(process.argv.slice(2)).catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  FALSE_CLAIMS,
  observedSupported,
  observedUnavailable,
  assertReceiptSemantics,
  buildReceipt,
  probeRuntime,
  verifyReceipt
};
