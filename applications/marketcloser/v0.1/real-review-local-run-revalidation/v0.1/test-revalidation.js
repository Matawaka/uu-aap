'use strict';

const fs = require('fs');
const path = require('path');
const Revalidation = require('./revalidation.js');
const Permit = require('../../real-review-run-permit/v0.1/permit.js');
const { buildPositive } = require('./synthetic-positive-helper.js');

const fixturePath = path.resolve(__dirname, 'examples/synthetic-revalidation-wait.input.json');
const clone = v => JSON.parse(JSON.stringify(v));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function positiveInput(materializationPath, materializationHash, permit) {
  const input = {
    protocol: Revalidation.PROTOCOL,
    version: Revalidation.VERSION,
    artifact_type: Revalidation.INPUT_TYPE,
    revalidation_id: 'urn:uu-aap:marketcloser:real-review-local-run-revalidation:synthetic-positive-001',
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Revalidation.ORIGIN_FRONTIER,
      tree: Revalidation.ORIGIN_TREE
    },
    materialization_source: {
      mode: 'local_private',
      path: materializationPath,
      expected_materialization_input_hash: materializationHash
    },
    permit: clone(permit),
    observed_frontier: {
      repository: 'Matawaka/uu-aap',
      revision: Revalidation.ORIGIN_FRONTIER,
      tree: Revalidation.ORIGIN_TREE,
      observed_at: '2026-08-29T02:08:40Z'
    },
    revalidated_at: '2026-08-29T02:08:45Z',
    controls: {
      local_only: true,
      read_only: true,
      stress_test_run_available: false,
      real_stress_test_adapter_available: false,
      network_access_available: false,
      filesystem_write_available: false,
      provider_invocation_available: false,
      platform_mutation_available: false,
      response_candidate_available: false,
      publication_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      external_execution_available: false,
      external_effect_available: false
    },
    content_hash: ''
  };
  Revalidation.rehash(input);
  return input;
}

(async () => {
  const waitingInput = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  Revalidation.validateInput(waitingInput);
  const waiting = Revalidation.deriveReceipt(waitingInput);
  assert(waiting.classification === 'PERMIT_REQUIRED', 'committed fixture must require permit');
  assert(waiting.local_run_ready === false, 'committed fixture cannot be ready');
  assert(waiting.stress_test_run === false, 'revalidation cannot execute stress-test');

  const built = await buildPositive();
  const input = positiveInput(built.materializationPath, built.materializationInput.content_hash, built.permit);
  const ready = Revalidation.deriveReceipt(input);
  assert(ready.classification === 'SYNTHETIC_LOCAL_RUN_READY', 'synthetic positive must become ready');
  assert(ready.local_run_ready === true, 'synthetic positive readiness missing');
  assert(ready.stress_test_run === false, 'ready receipt still cannot run stress-test');
  assert(ready.candidate_binding.exact_materialization_match === true, 'exact permit/materialization binding missing');
  assert(Object.values(ready.authority_revalidation).every(Boolean), 'authority revalidation checks must all pass');
  assert(ready.next_safe_action === Revalidation.NEXT_SAFE_ACTION, 'ready next safe action mismatch');

  const consumed = clone(input);
  consumed.permit.consumed = true;
  Permit.rehash(consumed.permit);
  Revalidation.rehash(consumed);
  assert(Revalidation.deriveReceipt(consumed).classification === 'PERMIT_ALREADY_CONSUMED', 'consumed permit not rejected');

  const multi = clone(input);
  multi.permit.remaining_invocations = 2;
  multi.permit.max_invocations = 2;
  Permit.rehash(multi.permit);
  Revalidation.rehash(multi);
  assert(Revalidation.deriveReceipt(multi).classification === 'PERMIT_INVOCATION_COUNT_INVALID', 'multi-use permit not rejected');

  const expired = clone(input);
  expired.observed_frontier.observed_at = '2026-08-29T02:20:00Z';
  expired.revalidated_at = '2026-08-29T02:20:01Z';
  Revalidation.rehash(expired);
  assert(Revalidation.deriveReceipt(expired).classification === 'PERMIT_EXPIRED', 'expired permit not rejected');

  const staleFrontier = clone(input);
  staleFrontier.observed_frontier.revision = 'ffffffffffffffffffffffffffffffffffffffff';
  staleFrontier.observed_frontier.tree = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  Revalidation.rehash(staleFrontier);
  assert(Revalidation.deriveReceipt(staleFrontier).classification === 'PERMIT_FRONTIER_STALE', 'stale frontier not rejected');

  const candidateSwap = clone(input);
  candidateSwap.permit.bridge_binding.marketer_candidate_hash = `sha256:${'b'.repeat(64)}`;
  Permit.rehash(candidateSwap.permit);
  Revalidation.rehash(candidateSwap);
  assert(Revalidation.deriveReceipt(candidateSwap).classification === 'CANDIDATE_BINDING_MISMATCH', 'candidate substitution not rejected');

  const authorityStale = clone(input);
  authorityStale.observed_frontier.observed_at = '2026-08-29T03:09:00Z';
  authorityStale.revalidated_at = '2026-08-29T03:09:01Z';
  Revalidation.rehash(authorityStale);
  assert(Revalidation.deriveReceipt(authorityStale).classification === 'AUTHORITY_REVALIDATION_FAILED', 'stale authority result not rejected');

  const badHash = clone(input);
  badHash.permit.content_hash = `sha256:${'0'.repeat(64)}`;
  Revalidation.rehash(badHash);
  assert(Revalidation.deriveReceipt(badHash).classification === 'PERMIT_INVALID', 'invalid permit hash not rejected');

  console.log('MarketCloser Real Review Local Run Revalidation v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
