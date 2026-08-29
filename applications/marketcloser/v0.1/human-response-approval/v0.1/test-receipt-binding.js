'use strict';

const Approval = require('./approval.js');
const Binding = require('./receipt-binding.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

function approvalInputFor(positive) {
  const input = {
    protocol: Approval.PROTOCOL,
    version: Approval.VERSION,
    artifact_type: Approval.INPUT_TYPE,
    approval_id: 'urn:uu-aap:marketcloser:human-response-approval:synthetic-binding-001',
    origin: { repository: 'Matawaka/uu-aap', revision: Approval.ORIGIN_FRONTIER, tree: Approval.ORIGIN_TREE },
    response_source: { mode: 'local_private', path: positive.responsePath, expected_response_input_hash: positive.responseInput.content_hash },
    response_candidate_receipt: positive.responseCandidateReceipt,
    decision: {
      context: 'synthetic_conformance',
      value: 'APPROVE_FOR_COPY_EXPORT',
      reviewer_ref: 'urn:synthetic:marketcloser:human-response-approver:binding',
      rationale: 'Synthetic exact-binding approval.'
    },
    decided_at: '2026-08-29T03:13:00Z',
    controls: {
      local_only: true, read_only: true, human_response_approval_recording_available: true,
      copy_export_authorization_available: true, copy_export_execution_available: false,
      publication_available: false, provider_invocation_available: false, network_access_available: false,
      platform_mutation_available: false, campaign_send_available: false, pilot_permit_available: false,
      action_permit_available: false, external_execution_available: false, external_effect_available: false
    },
    content_hash: ''
  };
  Approval.rehash(input);
  return input;
}

(async () => {
  const positive = await Positive.buildReadyResponseCandidate({ responsePath: '/tmp/marketcloser-approval-binding-response.json' });
  const input = approvalInputFor(positive);
  const receipt = Approval.deriveReceipt(input);
  Binding.validateReceiptForSource(input, receipt);

  const substitutions = [
    source => { source.approval_id = 'urn:uu-aap:marketcloser:human-response-approval:synthetic-binding-substitution'; },
    source => { source.decision.reviewer_ref = 'urn:synthetic:marketcloser:human-response-approver:substituted'; },
    source => { source.decision.rationale = 'Substituted approval rationale.'; },
    source => { source.decision.value = 'REQUEST_RESPONSE_CHANGES'; }
  ];
  for (const mutate of substitutions) {
    const source = clone(input);
    mutate(source);
    Approval.rehash(source);
    let rejected = false;
    try { Binding.validateReceiptForSource(source, receipt); } catch (_) { rejected = true; }
    assert(rejected, 'source-substituted approval receipt binding must fail closed');
  }

  const changed = clone(receipt);
  changed.response_binding.draft_hash = `sha256:${'0'.repeat(64)}`;
  Approval.rehash(changed);
  let rejected = false;
  try { Binding.validateReceiptForSource(input, changed); } catch (_) { rejected = true; }
  assert(rejected, 'receipt-substituted draft binding must fail closed');

  console.log('MarketCloser human response approval exact source binding: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
