'use strict';

const fs = require('fs');
const path = require('path');
const Revalidation = require(path.resolve(__dirname, '../../real-review-local-run-revalidation/v0.1/revalidation.js'));
const RevalidationPositive = require(path.resolve(__dirname, '../../real-review-local-run-revalidation/v0.1/synthetic-positive-helper.js'));

async function buildReadyRevalidation({
  gatePath = '/tmp/marketcloser-adapter-positive-gate.json',
  materializationPath = '/tmp/marketcloser-adapter-positive-materialization.json',
  revalidationPath = '/tmp/marketcloser-adapter-positive-revalidation.json'
} = {}) {
  const positive = await RevalidationPositive.buildPositive({ gatePath, materializationPath });
  const permit = positive.permit;
  const revalidationInput = {
    protocol: Revalidation.PROTOCOL,
    version: Revalidation.VERSION,
    artifact_type: Revalidation.INPUT_TYPE,
    revalidation_id: 'urn:uu-aap:marketcloser:real-review-local-run-revalidation:synthetic-adapter-positive-001',
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Revalidation.ORIGIN_FRONTIER,
      tree: Revalidation.ORIGIN_TREE
    },
    materialization_source: {
      mode: 'local_private',
      path: materializationPath,
      expected_materialization_input_hash: positive.materializationInput.content_hash
    },
    permit,
    observed_frontier: {
      repository: permit.execution_frontier.repository,
      revision: permit.execution_frontier.revision,
      tree: permit.execution_frontier.tree,
      observed_at: '2026-08-29T02:08:40Z'
    },
    revalidated_at: '2026-08-29T02:08:50Z',
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
  Revalidation.rehash(revalidationInput);
  Revalidation.validateInput(revalidationInput);
  const receipt = Revalidation.deriveReceipt(revalidationInput);
  if (receipt.classification !== 'SYNTHETIC_LOCAL_RUN_READY') {
    throw new Error(`synthetic revalidation not ready: ${receipt.classification}`);
  }
  fs.writeFileSync(revalidationPath, `${JSON.stringify(revalidationInput, null, 2)}\n`);
  return { ...positive, revalidationInput, revalidationReceipt: receipt, revalidationPath };
}

module.exports = { buildReadyRevalidation };
