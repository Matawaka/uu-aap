'use strict';

const fs = require('fs');
const path = require('path');
const Approval = require('./approval.js');
const Response = require(path.resolve(__dirname, '../../response-candidate/v0.1/response-candidate.js'));
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fixturePath = path.resolve(__dirname, 'examples/synthetic-approval-wait.input.json');

function approvalInputFor(positive, decisionValue = null, id = 'synthetic-positive-001') {
  const input = {
    protocol: Approval.PROTOCOL,
    version: Approval.VERSION,
    artifact_type: Approval.INPUT_TYPE,
    approval_id: `urn:uu-aap:marketcloser:human-response-approval:${id}`,
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Approval.ORIGIN_FRONTIER,
      tree: Approval.ORIGIN_TREE
    },
    response_source: {
      mode: 'local_private',
      path: positive.responsePath,
      expected_response_input_hash: positive.responseInput.content_hash
    },
    response_candidate_receipt: positive.responseCandidateReceipt,
    decision: decisionValue === null ? null : {
      context: 'synthetic_conformance',
      value: decisionValue,
      reviewer_ref: 'urn:synthetic:marketcloser:human-response-approver:001',
      rationale: `Synthetic conformance decision: ${decisionValue}`
    },
    decided_at: decisionValue === null ? null : '2026-08-29T03:13:00Z',
    controls: {
      local_only: true,
      read_only: true,
      human_response_approval_recording_available: true,
      copy_export_authorization_available: true,
      copy_export_execution_available: false,
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
  Approval.rehash(input);
  return input;
}

(async () => {
  const wait = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  Approval.validateInput(wait);
  const waitReceipt = Approval.deriveReceipt(wait);
  assert(waitReceipt.classification === 'RESPONSE_CANDIDATE_REQUIRED', 'committed fixture must require response candidate');
  assert(waitReceipt.approved_for_copy_export === false && waitReceipt.copy_export_authorized === false,
    'committed fixture cannot authorize copy/export');

  const positive = await Positive.buildReadyResponseCandidate();
  const waitingDecision = approvalInputFor(positive, null, 'synthetic-decision-wait-001');
  const waitingReceipt = Approval.deriveReceipt(waitingDecision);
  assert(waitingReceipt.classification === 'HUMAN_RESPONSE_DECISION_REQUIRED', 'ready candidate must wait for explicit human decision');

  const expected = {
    REJECT_RESPONSE: 'RESPONSE_REJECTED',
    REQUEST_RESPONSE_CHANGES: 'RESPONSE_CHANGES_REQUIRED',
    APPROVE_FOR_COPY_EXPORT: 'APPROVED_FOR_COPY_EXPORT'
  };
  for (const [decision, classification] of Object.entries(expected)) {
    const input = approvalInputFor(positive, decision, `synthetic-${decision.toLowerCase().replaceAll('_','-')}`);
    Approval.validateInput(input);
    const receipt = Approval.deriveReceipt(input);
    assert(receipt.classification === classification, `${decision} classification mismatch`);
    const approved = decision === 'APPROVE_FOR_COPY_EXPORT';
    assert(receipt.approved_for_copy_export === approved, `${decision} approval mismatch`);
    assert(receipt.copy_export_authorized === approved, `${decision} copy-export authorization mismatch`);
    assert(receipt.claims.copy_export_performed === false, 'approval cannot perform copy/export');
    assert(receipt.claims.publication_authorized === false, 'approval cannot authorize publication');
    assert(receipt.claims.platform_mutated === false && receipt.claims.external_effect_performed === false,
      'approval cannot perform external effects');
    if (approved) {
      assert(receipt.response_binding.draft_hash === Approval.textHash(positive.responseCandidateReceipt.response_candidate.draft_text),
        'approved receipt must bind exact draft hash');
      fs.writeFileSync('/tmp/marketcloser-approval-positive-input.json', `${JSON.stringify(input, null, 2)}\n`);
      fs.writeFileSync('/tmp/marketcloser-approval-positive-receipt.json', `${JSON.stringify(receipt, null, 2)}\n`);
    }
  }

  const noCandidateDecision = clone(wait);
  noCandidateDecision.decision = {
    context: 'synthetic_conformance', value: 'APPROVE_FOR_COPY_EXPORT',
    reviewer_ref: 'urn:synthetic:marketcloser:human-response-approver:bad', rationale: 'Invalid approval without candidate.'
  };
  noCandidateDecision.decided_at = '2026-08-29T03:13:00Z';
  Approval.rehash(noCandidateDecision);
  let rejected = false;
  try { Approval.validateInput(noCandidateDecision); } catch (_) { rejected = true; }
  assert(rejected, 'decision without response candidate must fail closed');

  const substituted = approvalInputFor(positive, 'APPROVE_FOR_COPY_EXPORT', 'synthetic-substituted-receipt-001');
  substituted.response_candidate_receipt = clone(positive.responseCandidateReceipt);
  substituted.response_candidate_receipt.response_candidate.draft_text += '\nПодменённый текст.';
  Response.rehash(substituted.response_candidate_receipt);
  Approval.rehash(substituted);
  rejected = false;
  try { Approval.deriveReceipt(substituted); } catch (_) { rejected = true; }
  assert(rejected, 'structurally rehashed substituted draft must fail exact source binding');

  const approvedInput = approvalInputFor(positive, 'APPROVE_FOR_COPY_EXPORT', 'synthetic-overclaim-001');
  const overclaim = Approval.deriveReceipt(approvedInput);
  overclaim.claims.publication_authorized = true;
  Approval.rehash(overclaim);
  rejected = false;
  try { Approval.validateReceipt(overclaim); } catch (_) { rejected = true; }
  assert(rejected, 'publication overclaim must fail closed');

  console.log('MarketCloser Human Response Approval v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });

module.exports = { approvalInputFor };
