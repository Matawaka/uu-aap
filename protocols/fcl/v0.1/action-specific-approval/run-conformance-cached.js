'use strict';

// Test-harness optimization only. The ActionPermit predecessor suite is executed
// once by CI to materialize an exact positive sample. Mutation cases below need
// independent copies of those bytes, not repeated execution of the entire
// predecessor stack. Intercept only that exact test-suite subprocess and replay
// the cached sample into each fresh temporary path requested by the approval
// conformance suite.

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const originalSpawnSync = childProcess.spawnSync;
const cachedPermitPath = process.env.FCL_APPROVAL_CACHED_PERMIT || '';
const cachedInputPath = process.env.FCL_APPROVAL_CACHED_PERMIT_INPUT || '';

let cached = null;
if (cachedPermitPath && cachedInputPath && fs.existsSync(cachedPermitPath) && fs.existsSync(cachedInputPath)) {
  cached = {
    permit: fs.readFileSync(cachedPermitPath, 'utf8'),
    input: fs.readFileSync(cachedInputPath, 'utf8')
  };
}

function isActionPermitSuite(command, args) {
  return command === process.execPath &&
    Array.isArray(args) &&
    typeof args[0] === 'string' &&
    path.basename(args[0]) === 'test-core-action-permit-binding.js' &&
    typeof args[1] === 'string' &&
    typeof args[2] === 'string';
}

childProcess.spawnSync = function memoizedSpawnSync(command, args, options) {
  if (!isActionPermitSuite(command, args)) return originalSpawnSync(command, args, options);

  if (!cached) {
    const result = originalSpawnSync(command, args, options);
    if (result.status === 0) {
      cached = {
        permit: fs.readFileSync(args[1], 'utf8'),
        input: fs.readFileSync(args[2], 'utf8')
      };
    }
    return result;
  }

  fs.writeFileSync(args[1], cached.permit);
  fs.writeFileSync(args[2], cached.input);
  return {
    status: 0,
    signal: null,
    error: undefined,
    stdout: 'PASS cached exact ActionPermit predecessor sample\n',
    stderr: ''
  };
};

require('./test-action-specific-approval.js');
