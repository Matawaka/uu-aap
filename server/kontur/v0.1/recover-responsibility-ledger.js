'use strict';

const fs = require('fs');
const path = require('path');
const Ledger = require('./responsibility-ledger.js');

async function main() {
  const rootDir = process.argv[2];
  const policyPath = process.argv[3] || path.resolve(__dirname, 'policies/reference-server.responsibility-ledger-policy.json');
  if (!rootDir) throw new Error('usage: node recover-responsibility-ledger.js <ledger-dir> [ledger-policy.json]');
  const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const recovered = await Ledger.recoverLedger(rootDir, policy);
  console.log(JSON.stringify({
    ledger_id: recovered.ledger_id,
    entry_count: recovered.entries.length,
    head_entry_id: recovered.head_entry ? recovered.head_entry.entry_id : null,
    authoritative_state_id: recovered.authoritative_state ? recovered.authoritative_state.state_id : null,
    lifecycle_state: recovered.authoritative_state ? recovered.authoritative_state.lifecycle_state : null,
    fencing_epoch: recovered.fencing_epoch,
    holder_id: recovered.holder_id,
    responsibility_scopes: recovered.responsibility_scopes,
    consumed_nonces: recovered.consumed_nonces,
    terminal: recovered.terminal
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
