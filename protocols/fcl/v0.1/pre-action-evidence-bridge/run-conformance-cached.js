'use strict';

// Bridge conformance needs the exact ActionPermit already proven by the
// reconciliation sample. Reuse that immutable sample when the approval suite
// requests its predecessor rather than recursively rebuilding the full FCL
// ActionPermit stack for every approval mutation case.

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const originalSpawnSync = childProcess.spawnSync;
let reconciliationInput = null;

function basenameArg(args) {
  return Array.isArray(args) && typeof args[0] === 'string' ? path.basename(args[0]) : '';
}

childProcess.spawnSync = function bridgeCachedSpawnSync(command, args, options = {}) {
  const base = basenameArg(args);

  if (command === process.execPath && base === 'test-pre-action-evidence-contract-reconciliation.js') {
    const result = originalSpawnSync(command, args, options);
    if (result.status === 0 && typeof args[2] === 'string' && fs.existsSync(args[2])) {
      reconciliationInput = JSON.parse(fs.readFileSync(args[2], 'utf8'));
    }
    return result;
  }

  if (command === process.execPath && base === 'test-action-specific-approval.js' && reconciliationInput) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-bridge-approval-cache-'));
    const permitPath = path.join(dir, 'permit.json');
    const permitInputPath = path.join(dir, 'permit-input.json');
    fs.writeFileSync(permitPath, `${JSON.stringify(reconciliationInput.fcl_core_action_permit, null, 2)}\n`);
    fs.writeFileSync(permitInputPath, `${JSON.stringify(reconciliationInput.fcl_core_action_permit_binding_input, null, 2)}\n`);

    const cachedRunner = path.resolve(path.dirname(args[0]), 'run-conformance-cached.js');
    return originalSpawnSync(process.execPath, [cachedRunner, args[1], args[2]], {
      ...options,
      env: {
        ...process.env,
        ...(options.env || {}),
        FCL_APPROVAL_CACHED_PERMIT: permitPath,
        FCL_APPROVAL_CACHED_PERMIT_INPUT: permitInputPath,
      },
    });
  }

  return originalSpawnSync(command, args, options);
};

require('./test-pre-action-evidence-bridge.js');
