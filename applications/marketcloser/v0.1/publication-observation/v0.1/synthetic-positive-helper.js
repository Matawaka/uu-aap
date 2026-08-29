'use strict';

const fs = require('fs');
const path = require('path');
const CopyExport = require(path.resolve(__dirname, '../../copy-export-receipt/v0.1/copy-export.js'));
const CopyPositive = require(path.resolve(__dirname, '../../copy-export-receipt/v0.1/synthetic-positive-helper.js'));
const Publication = require('./publication-observation.js');

async function buildCopiedDraft({
  responsePath = '/tmp/marketcloser-publication-positive-response.json',
  approvalPath = '/tmp/marketcloser-publication-positive-approval.json',
  copyExportPath = '/tmp/marketcloser-publication-positive-copy-export.json',
  ...paths
} = {}) {
  const positive = await CopyPositive.buildApprovedResponse({ responsePath, approvalPath, ...paths });
  const draftHash = positive.approvalReceipt.response_binding.draft_hash;
  const input = {
    protocol:CopyExport.PROTOCOL,
    version:CopyExport.VERSION,
    artifact_type:CopyExport.INPUT_TYPE,
    copy_export_id:'urn:uu-aap:marketcloser:copy-export:synthetic-publication-positive-001',
    origin:{ repository:'Matawaka/uu-aap', revision:CopyExport.ORIGIN_FRONTIER, tree:CopyExport.ORIGIN_TREE },
    approval_source:{ mode:'local_private', path:approvalPath, expected_approval_input_hash:positive.approvalInput.content_hash },
    approval_receipt:positive.approvalReceipt,
    event:{
      context:'synthetic_conformance',
      method:'clipboard_copy',
      event_ref:'urn:synthetic:marketcloser:copy-export-event:publication-positive-001',
      actor_ref:'urn:synthetic:marketcloser:copy-export-actor:publication-positive-001',
      performed_at:'2026-08-29T03:28:00Z',
      draft_hash:draftHash,
      payload_hash:draftHash,
      application_event_observed:false,
      independently_verified:false
    },
    controls:{
      local_only:true,
      read_only:true,
      copy_export_event_recording_available:true,
      os_clipboard_mutation_available:false,
      filesystem_export_write_available:false,
      publication_available:false,
      provider_invocation_available:false,
      network_access_available:false,
      platform_mutation_available:false,
      campaign_send_available:false,
      pilot_permit_available:false,
      action_permit_available:false,
      external_execution_available:false,
      external_effect_available:false
    },
    content_hash:''
  };
  CopyExport.rehash(input);
  CopyExport.validateInput(input);
  const receipt = CopyExport.deriveReceipt(input);
  if (receipt.classification !== 'COPIED_PUBLICATION_UNVERIFIED') throw new Error(`synthetic copy/export not ready: ${receipt.classification}`);
  fs.writeFileSync(copyExportPath, `${JSON.stringify(input,null,2)}\n`);
  return { ...positive, copyExportInput:input, copyExportReceipt:receipt, copyExportPath };
}

function observationFor(copyReceipt, result = 'content_match', {
  context = 'synthetic_conformance',
  method = null,
  observationRef = null,
  observerRef = null,
  publicationUrl = 'https://publication.example.invalid/review/001',
  independentlyVerified = null
} = {}) {
  const methodByContext = {
    synthetic_conformance:'synthetic_probe',
    application_observed:'application_surface',
    human_asserted:'human_visual',
    independent_observer:'http_fetch'
  };
  const mismatchHash = copyReceipt.approval_binding.draft_hash === `sha256:${'f'.repeat(64)}` ? `sha256:${'e'.repeat(64)}` : `sha256:${'f'.repeat(64)}`;
  const observedContentHash = result === 'not_observed'
    ? null
    : result === 'content_match'
      ? copyReceipt.approval_binding.draft_hash
      : mismatchHash;
  return {
    context,
    method:method || methodByContext[context],
    observation_ref:observationRef || (context === 'synthetic_conformance'
      ? 'urn:synthetic:marketcloser:publication-observation-event:001'
      : 'urn:uu-aap:marketcloser:publication-observation-event:001'),
    observer_ref:observerRef || (context === 'synthetic_conformance'
      ? 'urn:synthetic:marketcloser:publication-observer:001'
      : 'urn:uu-aap:marketcloser:publication-observer:001'),
    observed_at:'2026-08-29T03:28:30Z',
    publication_url:publicationUrl,
    result,
    match_mode:Publication.MATCH_MODE,
    observed_content_hash:observedContentHash,
    independently_verified:independentlyVerified === null ? context === 'independent_observer' : independentlyVerified
  };
}

function publicationInputFor(positive, observation = null, id = 'synthetic-positive-001') {
  const input = {
    protocol:Publication.PROTOCOL,
    version:Publication.VERSION,
    artifact_type:Publication.INPUT_TYPE,
    observation_id:`urn:uu-aap:marketcloser:publication-observation:${id}`,
    origin:{ repository:'Matawaka/uu-aap', revision:Publication.ORIGIN_FRONTIER, tree:Publication.ORIGIN_TREE },
    copy_export_source:{ mode:'local_private', path:positive.copyExportPath, expected_copy_export_input_hash:positive.copyExportInput.content_hash },
    copy_export_receipt:positive.copyExportReceipt,
    observation,
    controls:{
      local_only:true,
      read_only:true,
      publication_observation_recording_available:true,
      network_fetch_available:false,
      publication_action_available:false,
      provider_invocation_available:false,
      platform_mutation_available:false,
      campaign_send_available:false,
      pilot_permit_available:false,
      action_permit_available:false,
      external_execution_available:false,
      external_effect_available:false
    },
    content_hash:''
  };
  Publication.rehash(input);
  return input;
}

async function buildPublicationInput({ result='content_match', publicationPath='/tmp/marketcloser-publication-positive-input.json', ...paths } = {}) {
  const positive = await buildCopiedDraft(paths);
  const input = publicationInputFor(positive, observationFor(positive.copyExportReceipt, result));
  Publication.validateInput(input);
  fs.writeFileSync(publicationPath, `${JSON.stringify(input,null,2)}\n`);
  return { ...positive, publicationInput:input, publicationPath };
}

module.exports = { buildCopiedDraft, observationFor, publicationInputFor, buildPublicationInput };
