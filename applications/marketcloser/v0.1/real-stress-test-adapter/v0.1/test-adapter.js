'use strict';

const fs = require('fs');
const path = require('path');
const Adapter = require('./adapter.js');
const Permit = require(path.resolve(__dirname, '../../real-review-run-permit/v0.1/permit.js'));
const Revalidation = require(path.resolve(__dirname, '../../real-review-local-run-revalidation/v0.1/revalidation.js'));
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fixturePath = path.resolve(__dirname, 'examples/synthetic-adapter-wait.input.json');

function adapterInputFor(revalidationPath, revalidationHash, id = 'synthetic-positive-001') {
  const input = {
    protocol: Adapter.PROTOCOL,
    version: Adapter.VERSION,
    artifact_type: Adapter.INPUT_TYPE,
    adapter_id: `urn:uu-aap:marketcloser:real-stress-test-adapter:${id}`,
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Adapter.ORIGIN_FRONTIER,
      tree: Adapter.ORIGIN_TREE
    },
    revalidation_source: {
      mode: 'local_private',
      path: revalidationPath,
      expected_revalidation_input_hash: revalidationHash
    },
    operation: Adapter.OPERATION,
    controls: {
      local_only: true,
      read_only: true,
      local_stress_test_compute_available: true,
      network_access_available: false,
      filesystem_write_available: false,
      provider_invocation_available: false,
      platform_mutation_available: false,
      response_candidate_available: false,
      human_disposition_available: false,
      publication_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      external_execution_available: false,
      external_effect_available: false
    },
    content_hash: ''
  };
  Adapter.rehash(input);
  return input;
}

(async () => {
  const wait = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  Adapter.validateInput(wait);
  const waitInspection = Adapter.inspect(wait);
  assert(waitInspection.adapter_status === 'REVALIDATION_NOT_READY', 'committed fixture must remain not ready');
  assert(waitInspection.stress_test_run === false, 'inspection cannot run stress-test');
  let rejected = false;
  try { Adapter.stressTest(wait); } catch (_) { rejected = true; }
  assert(rejected, 'stress-test must fail closed on non-ready committed fixture');

  const positive = await Positive.buildReadyRevalidation();
  const input = adapterInputFor(positive.revalidationPath, positive.revalidationInput.content_hash);
  Adapter.validateInput(input);
  const inspection = Adapter.inspect(input);
  assert(inspection.adapter_status === 'SYNTHETIC_ADAPTER_READY', 'positive synthetic adapter should be ready');
  assert(inspection.stress_test_run === false, 'ready inspection still cannot run');

  const receipt = Adapter.stressTest(input);
  assert(receipt.classification === 'SYNTHETIC_STRESS_TEST_COMPLETED', 'synthetic stress-test completion expected');
  assert(receipt.execution.local_compute_performed === true, 'local compute must be recorded');
  assert(receipt.permit_binding.logically_consumed === true, 'logical permit consumption required');
  assert(receipt.permit_binding.logical_invocation_count === 1, 'logical invocation count must remain one');
  assert(receipt.claims.deterministic_analysis_completed === true, 'analysis completion claim required');
  assert(receipt.claims.response_candidate_created === false, 'stress-test cannot create response candidate');
  assert(receipt.claims.human_disposition_recorded === false, 'stress-test cannot record human disposition');
  assert(receipt.claims.publication_authorized === false, 'stress-test cannot authorize publication');
  assert(receipt.next_safe_action === Adapter.NEXT_SAFE_ACTION, 'next action mismatch');

  const replay = Adapter.stressTest(input);
  assert(replay.content_hash === receipt.content_hash, 'pure replay must reproduce identical receipt');
  assert(replay.permit_binding.logical_invocation_id === receipt.permit_binding.logical_invocation_id,
    'same permit and candidate must preserve one logical invocation id');

  const candidateTamper = clone(positive.revalidationInput);
  candidateTamper.permit.bridge_binding.marketer_candidate_hash = `sha256:${'0'.repeat(64)}`;
  Permit.rehash(candidateTamper.permit);
  Revalidation.rehash(candidateTamper);
  const tamperPath = '/tmp/marketcloser-adapter-candidate-tamper-revalidation.json';
  fs.writeFileSync(tamperPath, `${JSON.stringify(candidateTamper, null, 2)}\n`);
  const tamperInput = adapterInputFor(tamperPath, candidateTamper.content_hash, 'synthetic-candidate-tamper-001');
  rejected = false;
  try { Adapter.stressTest(tamperInput); } catch (_) { rejected = true; }
  assert(rejected, 'candidate-substituted permit must fail before adapter execution');

  const stale = clone(positive.revalidationInput);
  stale.observed_frontier.revision = '0'.repeat(40);
  Revalidation.rehash(stale);
  const stalePath = '/tmp/marketcloser-adapter-stale-frontier-revalidation.json';
  fs.writeFileSync(stalePath, `${JSON.stringify(stale, null, 2)}\n`);
  const staleInput = adapterInputFor(stalePath, stale.content_hash, 'synthetic-stale-frontier-001');
  rejected = false;
  try { Adapter.stressTest(staleInput); } catch (_) { rejected = true; }
  assert(rejected, 'stale frontier must fail before adapter execution');

  fs.writeFileSync('/tmp/marketcloser-adapter-positive-input.json', `${JSON.stringify(input, null, 2)}\n`);
  fs.writeFileSync('/tmp/marketcloser-adapter-positive-receipt.json', `${JSON.stringify(receipt, null, 2)}\n`);
  console.log('MarketCloser Real Stress-Test Adapter v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });

module.exports = { adapterInputFor };
