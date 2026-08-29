'use strict';

const Revalidation = require('./revalidation.js');
const Binding = require('./receipt-binding.js');
const { buildPositive } = require('./synthetic-positive-helper.js');

const clone = v => JSON.parse(JSON.stringify(v));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function inputFor(built) {
  const input = {
    protocol: Revalidation.PROTOCOL,
    version: Revalidation.VERSION,
    artifact_type: Revalidation.INPUT_TYPE,
    revalidation_id: 'urn:uu-aap:marketcloser:real-review-local-run-revalidation:synthetic-binding-001',
    origin: { repository: 'Matawaka/uu-aap', revision: Revalidation.ORIGIN_FRONTIER, tree: Revalidation.ORIGIN_TREE },
    materialization_source: {
      mode: 'local_private', path: built.materializationPath,
      expected_materialization_input_hash: built.materializationInput.content_hash
    },
    permit: clone(built.permit),
    observed_frontier: {
      repository: 'Matawaka/uu-aap', revision: Revalidation.ORIGIN_FRONTIER, tree: Revalidation.ORIGIN_TREE,
      observed_at: '2026-08-29T02:08:40Z'
    },
    revalidated_at: '2026-08-29T02:08:45Z',
    controls: {
      local_only: true, read_only: true, stress_test_run_available: false,
      real_stress_test_adapter_available: false, network_access_available: false,
      filesystem_write_available: false, provider_invocation_available: false,
      platform_mutation_available: false, response_candidate_available: false,
      publication_available: false, pilot_permit_available: false, action_permit_available: false,
      external_execution_available: false, external_effect_available: false
    },
    content_hash: ''
  };
  Revalidation.rehash(input);
  return input;
}

(async () => {
  const built = await buildPositive({
    gatePath: '/tmp/marketcloser-revalidation-binding-gate.json',
    materializationPath: '/tmp/marketcloser-revalidation-binding-materialization.json'
  });
  const input = inputFor(built);
  const receipt = Revalidation.deriveReceipt(input);
  assert(Binding.validateReceiptSourceBinding(input, receipt) === true, 'exact binding should pass');

  const substitutedFrontier = clone(input);
  substitutedFrontier.observed_frontier.observed_at = '2026-08-29T02:08:41Z';
  Revalidation.rehash(substitutedFrontier);
  let rejected = false;
  try { Binding.validateReceiptSourceBinding(substitutedFrontier, receipt); } catch (_) { rejected = true; }
  assert(rejected, 'frontier substitution must fail exact binding');

  const substitutedPermit = clone(input);
  substitutedPermit.permit.run.run_id = 'urn:uu-aap:marketcloser:real-review-run:synthetic-other-run';
  require('../../real-review-run-permit/v0.1/permit.js').rehash(substitutedPermit.permit);
  Revalidation.rehash(substitutedPermit);
  rejected = false;
  try { Binding.validateReceiptSourceBinding(substitutedPermit, receipt); } catch (_) { rejected = true; }
  assert(rejected, 'permit substitution must fail exact binding');

  console.log('MarketCloser local run revalidation exact source binding: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
