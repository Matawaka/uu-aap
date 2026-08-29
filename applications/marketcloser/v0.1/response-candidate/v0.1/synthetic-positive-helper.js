'use strict';

const fs = require('fs');
const path = require('path');
const Response = require('./response-candidate.js');
const Disposition = require(path.resolve(__dirname, '../../human-analysis-disposition/v0.1/disposition.js'));
const DispositionPositive = require(path.resolve(__dirname, '../../human-analysis-disposition/v0.1/synthetic-positive-helper.js'));

async function buildAcceptedDisposition({
  gatePath = '/tmp/marketcloser-response-positive-gate.json',
  materializationPath = '/tmp/marketcloser-response-positive-materialization.json',
  revalidationPath = '/tmp/marketcloser-response-positive-revalidation.json',
  adapterPath = '/tmp/marketcloser-response-positive-adapter.json',
  dispositionPath = '/tmp/marketcloser-response-positive-disposition.json'
} = {}) {
  const positive = await DispositionPositive.buildCompletedAnalysis({ gatePath, materializationPath, revalidationPath, adapterPath });
  const dispositionInput = {
    protocol: Disposition.PROTOCOL,
    version: Disposition.VERSION,
    artifact_type: Disposition.INPUT_TYPE,
    disposition_id: 'urn:uu-aap:marketcloser:human-analysis-disposition:synthetic-response-positive-001',
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Disposition.ORIGIN_FRONTIER,
      tree: Disposition.ORIGIN_TREE
    },
    analysis_source: {
      mode: 'local_private',
      path: adapterPath,
      expected_adapter_input_hash: positive.adapterInput.content_hash
    },
    analysis_receipt: positive.analysisReceipt,
    decision: {
      context: 'synthetic_conformance',
      value: 'ACCEPT_FOR_HUMAN_USE',
      reviewer_ref: 'urn:synthetic:marketcloser:response-candidate-reviewer:001',
      rationale: 'Synthetic conformance acceptance used only to test bounded response-candidate construction.'
    },
    decided_at: '2026-08-29T02:54:00Z',
    controls: {
      local_only: true,
      read_only: true,
      human_disposition_recording_available: true,
      response_candidate_available: false,
      publication_available: false,
      provider_invocation_available: false,
      network_access_available: false,
      platform_mutation_available: false,
      campaign_send_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      external_execution_available: false,
      external_effect_available: false
    },
    content_hash: ''
  };
  Disposition.rehash(dispositionInput);
  Disposition.validateInput(dispositionInput);
  const dispositionReceipt = Disposition.deriveReceipt(dispositionInput);
  if (dispositionReceipt.classification !== 'ANALYSIS_ACCEPTED_FOR_HUMAN_USE') {
    throw new Error(`synthetic disposition not accepted: ${dispositionReceipt.classification}`);
  }
  fs.writeFileSync(dispositionPath, `${JSON.stringify(dispositionInput, null, 2)}\n`);
  return { ...positive, dispositionInput, dispositionReceipt, dispositionPath };
}

async function buildReadyResponseInput({ responsePath = '/tmp/marketcloser-response-positive-input.json', ...paths } = {}) {
  const positive = await buildAcceptedDisposition(paths);
  const chain = Response.reconstructAcceptedChain(positive.dispositionInput, positive.dispositionReceipt);
  const selected = chain.candidate.bounded_case.claim_package.material_statements.slice(0, 2).map(item => item.statement_id);
  if (selected.length === 0) throw new Error('synthetic candidate has no material statements');
  const input = {
    protocol: Response.PROTOCOL,
    version: Response.VERSION,
    artifact_type: Response.INPUT_TYPE,
    request_id: 'urn:uu-aap:marketcloser:response-candidate-request:synthetic-positive-001',
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Response.ORIGIN_FRONTIER,
      tree: Response.ORIGIN_TREE
    },
    disposition_source: {
      mode: 'local_private',
      path: positive.dispositionPath,
      expected_disposition_input_hash: positive.dispositionInput.content_hash
    },
    disposition_receipt: positive.dispositionReceipt,
    customer_context: {
      mode: 'synthetic_conformance',
      context_id: 'urn:synthetic:marketcloser:response-context:001',
      language: 'ru',
      response_purpose: 'public_review_response_candidate',
      tone: 'neutral_professional',
      selected_statement_ids: selected,
      include_uncertainty_disclosures: true,
      privacy: {
        human_minimization_reviewed: true,
        personal_data_present: false,
        sensitive_personal_data_present: false,
        reviewer_identity_present: false,
        protected_attribute_data_present: false,
        psychological_vulnerability_data_present: false,
        cross_context_identifier_present: false,
        raw_review_content_present: false,
        business_pressure_included: false
      }
    },
    controls: {
      local_only: true,
      read_only: true,
      response_candidate_construction_available: true,
      human_response_approval_available: false,
      copy_export_available: false,
      publication_available: false,
      provider_invocation_available: false,
      network_access_available: false,
      platform_mutation_available: false,
      campaign_send_available: false,
      pilot_permit_available: false,
      action_permit_available: false,
      external_execution_available: false,
      external_effect_available: false
    },
    content_hash: ''
  };
  Response.rehash(input);
  Response.validateInput(input);
  fs.writeFileSync(responsePath, `${JSON.stringify(input, null, 2)}\n`);
  return { ...positive, responseInput: input, responsePath, chain };
}

module.exports = { buildAcceptedDisposition, buildReadyResponseInput };
