'use strict';

const fs = require('fs');
const path = require('path');
const Approval = require(path.resolve(__dirname, '../../human-response-approval/v0.1/approval.js'));
const ApprovalPositive = require(path.resolve(__dirname, '../../human-response-approval/v0.1/synthetic-positive-helper.js'));

async function buildApprovedResponse({
  responsePath = '/tmp/marketcloser-copy-export-positive-response.json',
  approvalPath = '/tmp/marketcloser-copy-export-positive-approval.json',
  ...paths
} = {}) {
  const positive = await ApprovalPositive.buildReadyResponseCandidate({ responsePath, ...paths });
  const input = {
    protocol: Approval.PROTOCOL,
    version: Approval.VERSION,
    artifact_type: Approval.INPUT_TYPE,
    approval_id: 'urn:uu-aap:marketcloser:human-response-approval:synthetic-copy-export-positive-001',
    origin: { repository:'Matawaka/uu-aap', revision:Approval.ORIGIN_FRONTIER, tree:Approval.ORIGIN_TREE },
    response_source: { mode:'local_private', path:responsePath, expected_response_input_hash:positive.responseInput.content_hash },
    response_candidate_receipt: positive.responseCandidateReceipt,
    decision: {
      context:'synthetic_conformance',
      value:'APPROVE_FOR_COPY_EXPORT',
      reviewer_ref:'urn:synthetic:marketcloser:copy-export-approver:001',
      rationale:'Synthetic approval used only to test exact-draft copy/export event recording.'
    },
    decided_at:'2026-08-29T03:19:40Z',
    controls: {
      local_only:true,
      read_only:true,
      human_response_approval_recording_available:true,
      copy_export_authorization_available:true,
      copy_export_execution_available:false,
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
  Approval.rehash(input);
  Approval.validateInput(input);
  const receipt = Approval.deriveReceipt(input);
  if (receipt.classification !== 'APPROVED_FOR_COPY_EXPORT') throw new Error(`synthetic approval not ready: ${receipt.classification}`);
  fs.writeFileSync(approvalPath, `${JSON.stringify(input,null,2)}\n`);
  return { ...positive, approvalInput:input, approvalReceipt:receipt, approvalPath };
}

module.exports = { buildApprovedResponse };
