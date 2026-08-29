'use strict';

const fs = require('fs');
const path = require('path');
const Adapter = require(path.resolve(__dirname, '../../real-stress-test-adapter/v0.1/adapter.js'));
const AdapterPositive = require(path.resolve(__dirname, '../../real-stress-test-adapter/v0.1/synthetic-positive-helper.js'));

async function buildCompletedAnalysis({
  gatePath = '/tmp/marketcloser-disposition-positive-gate.json',
  materializationPath = '/tmp/marketcloser-disposition-positive-materialization.json',
  revalidationPath = '/tmp/marketcloser-disposition-positive-revalidation.json',
  adapterPath = '/tmp/marketcloser-disposition-positive-adapter.json'
} = {}) {
  const positive = await AdapterPositive.buildReadyRevalidation({ gatePath, materializationPath, revalidationPath });
  const input = {
    protocol: Adapter.PROTOCOL,
    version: Adapter.VERSION,
    artifact_type: Adapter.INPUT_TYPE,
    adapter_id: 'urn:uu-aap:marketcloser:real-stress-test-adapter:synthetic-disposition-positive-001',
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Adapter.ORIGIN_FRONTIER,
      tree: Adapter.ORIGIN_TREE
    },
    revalidation_source: {
      mode: 'local_private',
      path: revalidationPath,
      expected_revalidation_input_hash: positive.revalidationInput.content_hash
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
  Adapter.validateInput(input);
  fs.writeFileSync(adapterPath, `${JSON.stringify(input, null, 2)}\n`);
  const receipt = Adapter.stressTest(input);
  Adapter.validateReceipt(receipt);
  return { ...positive, adapterInput: input, analysisReceipt: receipt, adapterPath };
}

module.exports = { buildCompletedAnalysis };
