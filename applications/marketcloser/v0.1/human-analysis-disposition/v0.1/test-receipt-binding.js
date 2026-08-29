'use strict';

const fs = require('fs');
const path = require('path');
const Disposition = require('./disposition.js');
const Binding = require('./receipt-binding.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fixturePath = path.resolve(__dirname, 'examples/synthetic-disposition-wait.input.json');

function controls() {
  return {
    local_only: true, read_only: true, human_disposition_recording_available: true,
    response_candidate_available: false, publication_available: false, provider_invocation_available: false,
    network_access_available: false, platform_mutation_available: false, campaign_send_available: false,
    pilot_permit_available: false, action_permit_available: false, external_execution_available: false,
    external_effect_available: false
  };
}

(async () => {
  const waitingInput = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const waitingReceipt = Disposition.deriveReceipt(waitingInput);
  Binding.validateReceiptForInput(waitingInput, waitingReceipt);

  const positive = await Positive.buildCompletedAnalysis({
    gatePath: '/tmp/marketcloser-disposition-binding-gate.json',
    materializationPath: '/tmp/marketcloser-disposition-binding-materialization.json',
    revalidationPath: '/tmp/marketcloser-disposition-binding-revalidation.json',
    adapterPath: '/tmp/marketcloser-disposition-binding-adapter.json'
  });
  const input = {
    protocol: Disposition.PROTOCOL,
    version: Disposition.VERSION,
    artifact_type: Disposition.INPUT_TYPE,
    disposition_id: 'urn:uu-aap:marketcloser:human-analysis-disposition:synthetic-binding-001',
    origin: { repository:'Matawaka/uu-aap', revision:Disposition.ORIGIN_FRONTIER, tree:Disposition.ORIGIN_TREE },
    analysis_source: { mode:'local_private', path:positive.adapterPath, expected_adapter_input_hash:positive.adapterInput.content_hash },
    analysis_receipt: positive.analysisReceipt,
    decision: {
      context:'synthetic_conformance', value:'ACCEPT_FOR_HUMAN_USE',
      reviewer_ref:'urn:synthetic:marketcloser:analysis-reviewer:binding-001',
      rationale:'Synthetic exact binding acceptance rationale.'
    },
    decided_at:'2026-08-29T02:09:10Z',
    controls: controls(),
    content_hash:''
  };
  Disposition.rehash(input);
  const receipt = Disposition.deriveReceipt(input);
  Binding.validateReceiptForInput(input, receipt);

  const decisionSwap = clone(receipt);
  decisionSwap.human_decision.value = 'REJECT';
  decisionSwap.classification = 'ANALYSIS_REJECTED_FOR_HUMAN_USE';
  decisionSwap.next_safe_action = 'STOP_AFTER_ANALYSIS_REJECTION';
  Disposition.rehash(decisionSwap);
  let rejected = false;
  try { Binding.validateReceiptForInput(input, decisionSwap); } catch (_) { rejected = true; }
  assert(rejected, 'structurally valid decision substitution must fail exact source binding');

  const reviewerSwap = clone(receipt);
  reviewerSwap.human_decision.reviewer_ref = 'urn:synthetic:marketcloser:analysis-reviewer:other';
  Disposition.rehash(reviewerSwap);
  rejected = false;
  try { Binding.validateReceiptForInput(input, reviewerSwap); } catch (_) { rejected = true; }
  assert(rejected, 'reviewer substitution must fail exact source binding');

  const analysisSwap = clone(receipt);
  analysisSwap.analysis_binding.receipt_hash = `sha256:${'1'.repeat(64)}`;
  Disposition.rehash(analysisSwap);
  rejected = false;
  try { Binding.validateReceiptForInput(input, analysisSwap); } catch (_) { rejected = true; }
  assert(rejected, 'analysis hash substitution must fail exact source binding');

  console.log('MarketCloser human analysis disposition exact source binding: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
