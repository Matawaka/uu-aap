'use strict';

const fs = require('fs');
const path = require('path');
const Ledger = require('./responsibility-event-successor-ledger.js');

async function main() {
  const rootDir = process.argv[2];
  const storagePolicyPath = process.argv[3];
  const successorPolicyPath = process.argv[4];
  const outputPath = process.argv[5];
  if (!rootDir || !storagePolicyPath || !successorPolicyPath || !outputPath) {
    throw new Error('usage: node recover-responsibility-event-successor-ledger.js <ledger-root> <storage-policy.json> <successor-policy.json> <output.json>');
  }
  const storagePolicy = JSON.parse(fs.readFileSync(path.resolve(storagePolicyPath), 'utf8'));
  const successorPolicy = JSON.parse(fs.readFileSync(path.resolve(successorPolicyPath), 'utf8'));
  const recovered = await Ledger.recoverSuccessorLedger(path.resolve(rootDir), storagePolicy, successorPolicy);
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(recovered, null, 2)}\n`);
  console.log(JSON.stringify({
    ledger_id: recovered.ledger_id,
    entry_count: recovered.entries.length,
    authoritative_successor_head: recovered.authoritative_successor_head,
    accepted_append_receipt_count: recovered.accepted_append_receipt_ids.length,
    accepted_event_count: recovered.accepted_event_ids.length,
    generic_successor_history_recovered: recovered.claims.generic_successor_history_recovered,
    global_replay_protection_established: recovered.claims.global_replay_protection_established,
    distributed_consensus_established: recovered.claims.distributed_consensus_established
  }, null, 2));
}

main().catch((error) => { console.error(error && error.stack ? error.stack : error); process.exit(1); });
