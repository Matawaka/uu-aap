'use strict';

const fs = require('fs');
const childProcess = require('child_process');

let writeAttempted = false;
let processAttempted = false;
let networkAttempted = false;

const originalWrite = fs.writeFileSync;
const originalAppend = fs.appendFileSync;
const originalExec = childProcess.exec;
const originalExecSync = childProcess.execSync;
const originalSpawn = childProcess.spawn;
const originalFetch = global.fetch;

fs.writeFileSync = () => { writeAttempted = true; throw new Error('write attempted during import'); };
fs.appendFileSync = () => { writeAttempted = true; throw new Error('append attempted during import'); };
childProcess.exec = () => { processAttempted = true; throw new Error('exec attempted during import'); };
childProcess.execSync = () => { processAttempted = true; throw new Error('execSync attempted during import'); };
childProcess.spawn = () => { processAttempted = true; throw new Error('spawn attempted during import'); };
global.fetch = () => { networkAttempted = true; throw new Error('fetch attempted during import'); };

try {
  require('./response-candidate.js');
  require('./receipt-binding.js');
} finally {
  fs.writeFileSync = originalWrite;
  fs.appendFileSync = originalAppend;
  childProcess.exec = originalExec;
  childProcess.execSync = originalExecSync;
  childProcess.spawn = originalSpawn;
  global.fetch = originalFetch;
}

if (writeAttempted || processAttempted || networkAttempted) throw new Error('response candidate modules are not import-safe');
console.log('MarketCloser response candidate import safety: PASS');
