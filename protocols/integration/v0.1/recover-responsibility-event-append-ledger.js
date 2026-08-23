'use strict';

const fs = require('fs');
const path = require('path');
const { recoverLedger } = require('./responsibility-event-append-ledger.js');

async function main() {
  const rootDir = process.argv[2];
  const policyPath = process.argv[3];
  const outputPath = process.argv[4] || null;
  if (!rootDir || !policyPath) throw new Error('usage: node recover-responsibility-event-append-ledger.js <ledger-dir> <policy-json> [output-json]');
  const policy = JSON.parse(fs.readFileSync(path.resolve(policyPath), 'utf8'));
  const recovered = await recoverLedger(path.resolve(rootDir), policy);
  if (outputPath) fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(recovered, null, 2)}\n`);
  console.log(JSON.stringify({
    ledger_id: recovered.ledger_id,
    entry_count: recovered.entries.length,
    authoritative_successor_head: recovered.authoritative_successor_head,
    accepted_append_receipt_ids: recovered.accepted_append_receipt_ids,
    accepted_event_ids: recovered.accepted_event_ids,
    ledger_local_durable_replay_protection_established: recovered.claims.ledger_local_durable_replay_protection_established,
    global_replay_protection_established: recovered.claims.global_replay_protection_established,
    distributed_consensus_established: recovered.claims.distributed_consensus_established
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
