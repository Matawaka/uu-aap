'use strict';

const fs = require('fs');
const path = require('path');
const Disposition = require('./disposition.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fixturePath = path.resolve(__dirname, 'examples/synthetic-disposition-wait.input.json');

function inputFor(positive, decisionValue = null, id = 'synthetic-positive-001') {
  const input = {
    protocol: Disposition.PROTOCOL,
    version: Disposition.VERSION,
    artifact_type: Disposition.INPUT_TYPE,
    disposition_id: `urn:uu-aap:marketcloser:human-analysis-disposition:${id}`,
    origin: {
      repository: 'Matawaka/uu-aap',
      revision: Disposition.ORIGIN_FRONTIER,
      tree: Disposition.ORIGIN_TREE
    },
    analysis_source: {
      mode: 'local_private',
      path: positive.adapterPath,
      expected_adapter_input_hash: positive.adapterInput.content_hash
    },
    analysis_receipt: positive.analysisReceipt,
    decision: decisionValue === null ? null : {
      context: 'synthetic_conformance',
      value: decisionValue,
      reviewer_ref: 'urn:synthetic:marketcloser:analysis-reviewer:001',
      rationale: `Synthetic conformance rationale for ${decisionValue}.`
    },
    decided_at: decisionValue === null ? null : '2026-08-29T02:09:10Z',
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
  Disposition.rehash(input);
  return input;
}

(async () => {
  const waitingInput = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  Disposition.validateInput(waitingInput);
  const waiting = Disposition.deriveReceipt(waitingInput);
  assert(waiting.classification === 'ANALYSIS_RESULT_REQUIRED', 'committed fixture must require completed analysis');
  assert(waiting.human_disposition_recorded === false, 'waiting fixture cannot record disposition');
  assert(waiting.claims.response_candidate_created === false, 'waiting fixture cannot create response candidate');

  const positive = await Positive.buildCompletedAnalysis();
  const noDecisionInput = inputFor(positive, null, 'synthetic-decision-wait-001');
  const noDecision = Disposition.deriveReceipt(noDecisionInput);
  assert(noDecision.classification === 'HUMAN_DECISION_REQUIRED', 'completed analysis without decision must wait for human');
  assert(noDecision.analysis_binding.exact_receipt_revalidated === true, 'completed analysis must be exactly revalidated');
  assert(noDecision.human_disposition_recorded === false, 'no-decision case cannot record disposition');

  const expected = {
    REJECT: ['ANALYSIS_REJECTED_FOR_HUMAN_USE','STOP_AFTER_ANALYSIS_REJECTION'],
    CORRECT: ['ANALYSIS_CORRECTION_REQUIRED','ANALYSIS_CORRECTION_SUCCESSOR_REQUIRED'],
    REQUEST_MORE_EVIDENCE: ['MORE_EVIDENCE_REQUIRED','EVIDENCE_SUCCESSOR_REQUIRED'],
    ACCEPT_FOR_HUMAN_USE: ['ANALYSIS_ACCEPTED_FOR_HUMAN_USE','RESPONSE_CANDIDATE_CONSTRUCTION_REQUIRED']
  };

  let acceptedInput = null;
  let acceptedReceipt = null;
  for (const decision of Disposition.DECISIONS) {
    const input = inputFor(positive, decision, `synthetic-${decision.toLowerCase().replaceAll('_','-')}-001`);
    Disposition.validateInput(input);
    const receipt = Disposition.deriveReceipt(input);
    assert(receipt.classification === expected[decision][0], `${decision} classification mismatch`);
    assert(receipt.next_safe_action === expected[decision][1], `${decision} next action mismatch`);
    assert(receipt.human_disposition_recorded === true, `${decision} must record disposition`);
    assert(receipt.analysis_binding.receipt_hash === positive.analysisReceipt.content_hash, `${decision} exact analysis hash mismatch`);
    assert(receipt.claims.reviewer_identity_verified === false, `${decision} cannot verify reviewer identity`);
    assert(receipt.claims.reviewer_authority_verified === false, `${decision} cannot verify reviewer authority`);
    assert(receipt.claims.response_candidate_created === false, `${decision} cannot create response candidate`);
    assert(receipt.claims.publication_authorized === false, `${decision} cannot authorize publication`);
    assert(receipt.claims.external_effect_performed === false, `${decision} cannot perform effect`);
    if (decision === 'REJECT') assert(receipt.claims.global_prohibition_created === false, 'REJECT cannot create global prohibition');
    if (decision === 'CORRECT') assert(receipt.claims.source_rewritten === false, 'CORRECT cannot rewrite predecessor source');
    if (decision === 'ACCEPT_FOR_HUMAN_USE') { acceptedInput = input; acceptedReceipt = receipt; }
  }

  const illegalDecision = clone(waitingInput);
  illegalDecision.decision = {
    context: 'synthetic_conformance', value: 'ACCEPT_FOR_HUMAN_USE',
    reviewer_ref: 'urn:synthetic:marketcloser:analysis-reviewer:002', rationale: 'Invalid because analysis receipt is absent.'
  };
  illegalDecision.decided_at = '2026-08-29T02:09:10Z';
  Disposition.rehash(illegalDecision);
  let rejected = false;
  try { Disposition.validateInput(illegalDecision); } catch (_) { rejected = true; }
  assert(rejected, 'decision without completed analysis must fail closed');

  const sourceMismatch = clone(acceptedInput);
  sourceMismatch.analysis_source.expected_adapter_input_hash = `sha256:${'0'.repeat(64)}`;
  Disposition.rehash(sourceMismatch);
  rejected = false;
  try { Disposition.deriveReceipt(sourceMismatch); } catch (_) { rejected = true; }
  assert(rejected, 'adapter source substitution must fail closed');

  const receiptMismatch = clone(acceptedInput);
  receiptMismatch.analysis_receipt.candidate_binding.candidate_hash = `sha256:${'0'.repeat(64)}`;
  AdapterRehash(receiptMismatch.analysis_receipt);
  Disposition.rehash(receiptMismatch);
  rejected = false;
  try { Disposition.deriveReceipt(receiptMismatch); } catch (_) { rejected = true; }
  assert(rejected, 'analysis receipt substitution must fail closed');

  const overclaim = clone(acceptedReceipt);
  overclaim.claims.publication_authorized = true;
  Disposition.rehash(overclaim);
  rejected = false;
  try { Disposition.validateReceipt(overclaim); } catch (_) { rejected = true; }
  assert(rejected, 'publication overclaim must fail closed');

  fs.writeFileSync('/tmp/marketcloser-disposition-positive-input.json', `${JSON.stringify(acceptedInput, null, 2)}\n`);
  fs.writeFileSync('/tmp/marketcloser-disposition-positive-receipt.json', `${JSON.stringify(acceptedReceipt, null, 2)}\n`);
  console.log('MarketCloser Human Analysis Disposition Gate v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });

function AdapterRehash(receipt) {
  const Adapter = require(path.resolve(__dirname, '../../real-stress-test-adapter/v0.1/adapter.js'));
  Adapter.rehash(receipt);
}

module.exports = { inputFor };
