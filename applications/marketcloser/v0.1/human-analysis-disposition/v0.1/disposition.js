'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Adapter = require(path.resolve(__dirname, '../../real-stress-test-adapter/v0.1/adapter.js'));

const PROTOCOL = 'MARKETCLOSER-HUMAN-ANALYSIS-DISPOSITION';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserHumanAnalysisDispositionInput';
const RECEIPT_TYPE = 'MarketCloserHumanAnalysisDispositionReceipt';
const ORIGIN_FRONTIER = '0dd0b5a041590e44ee12a9bbd923025b87497d25';
const ORIGIN_TREE = 'aca7503ad04c47cd7038ea3a22b02c4273073976';

const DECISIONS = Object.freeze(['REJECT','CORRECT','REQUEST_MORE_EVIDENCE','ACCEPT_FOR_HUMAN_USE']);
const DECISION_CONTEXTS = Object.freeze(['synthetic_conformance','human_supplied']);
const CLASSIFICATIONS = Object.freeze([
  'ANALYSIS_RESULT_REQUIRED',
  'HUMAN_DECISION_REQUIRED',
  'ANALYSIS_REJECTED_FOR_HUMAN_USE',
  'ANALYSIS_CORRECTION_REQUIRED',
  'MORE_EVIDENCE_REQUIRED',
  'ANALYSIS_ACCEPTED_FOR_HUMAN_USE'
]);

const INPUT_KEYS = Object.freeze([
  'protocol','version','artifact_type','disposition_id','origin','analysis_source',
  'analysis_receipt','decision','decided_at','controls','content_hash'
]);
const ORIGIN_KEYS = Object.freeze(['repository','revision','tree']);
const SOURCE_KEYS = Object.freeze(['mode','path','expected_adapter_input_hash']);
const DECISION_KEYS = Object.freeze(['context','value','reviewer_ref','rationale']);
const CONTROL_KEYS = Object.freeze([
  'local_only','read_only','human_disposition_recording_available','response_candidate_available',
  'publication_available','provider_invocation_available','network_access_available',
  'platform_mutation_available','campaign_send_available','pilot_permit_available',
  'action_permit_available','external_execution_available','external_effect_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol','version','receipt_type','receipt_id','source_input','analysis_binding',
  'human_decision','classification','human_disposition_recorded','claims','non_effects',
  'next_safe_action','decided_at','content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['disposition_id','disposition_hash']);
const ANALYSIS_BINDING_KEYS = Object.freeze([
  'adapter_id','adapter_hash','adapter_status','receipt_present','receipt_id','receipt_hash',
  'receipt_classification','logical_invocation_id','analysis_state','recommendation_candidate',
  'exact_receipt_revalidated'
]);
const HUMAN_DECISION_KEYS = Object.freeze(['present','context','value','reviewer_ref','rationale']);

const FALSE_CLAIMS = Object.freeze([
  'truth_certified','reviewer_identity_verified','reviewer_authority_verified','source_rewritten',
  'global_prohibition_created','response_candidate_created','publication_authorized',
  'campaign_send_authorized','provider_invoked','network_accessed','platform_mutated',
  'pilot_permit_created','action_permit_created','external_execution_admitted',
  'external_effect_performed','successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([
  'exact_adapter_source_revalidated','analysis_result_present','analysis_result_exactly_revalidated',
  'human_disposition_recorded','reviewer_reference_recorded','decision_rationale_recorded',
  ...FALSE_CLAIMS
]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Stress-Test Result != Human Disposition',
  'Human Disposition != Truth',
  'REJECT != Global Prohibition',
  'CORRECT != Source Rewrite',
  'Request More Evidence != Negative Evidence',
  'Accept For Human Use != Response Candidate',
  'Accept For Human Use != Publication Authority',
  'Human Decision Recorded != Reviewer Identity Verified',
  'Human Decision Recorded != Reviewer Authority Verified',
  'Disposition Receipt != ActionPermit',
  'Disposition Receipt != External Effect',
  'Successful Analysis != Successor Authority'
]);

class MarketCloserHumanAnalysisDispositionError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserHumanAnalysisDispositionError(message); };
const clone = value => JSON.parse(JSON.stringify(value));
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}
function computeContentHash(value) {
  const copy = clone(value); delete copy.content_hash;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(copy)), 'utf8').digest('hex')}`;
}
function rehash(value) { value.content_hash = computeContentHash(value); return value; }
function exact(value, keys, label) {
  req(value && typeof value === 'object' && !Array.isArray(value), `${label} must be object`);
  req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} key mismatch`);
}
function str(value, label, pattern = null) {
  req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
  if (pattern) req(pattern.test(value), `${label} invalid`);
}
function instant(value, label) {
  str(value, label); const n = Date.parse(value); req(Number.isFinite(n), `${label} invalid date-time`); return n;
}
function deepEqual(a, b) { return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b)); }

function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveAnalysisPath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository analysis path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'analysis path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported analysis source mode');
  return path.resolve(source.path);
}
function loadAdapterInput(source) {
  const resolved = resolveAnalysisPath(source);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  Adapter.validateInput(input);
  req(input.content_hash === source.expected_adapter_input_hash, 'adapter input hash mismatch');
  return input;
}

function validateDecision(decision) {
  exact(decision, DECISION_KEYS, 'decision');
  req(DECISION_CONTEXTS.includes(decision.context), 'decision context unsupported');
  req(DECISIONS.includes(decision.value), 'decision value unsupported');
  str(decision.reviewer_ref, 'decision.reviewer_ref');
  str(decision.rationale, 'decision.rationale');
  if (decision.context === 'synthetic_conformance') {
    req(decision.reviewer_ref.startsWith('urn:synthetic:'), 'synthetic decision requires synthetic reviewer reference');
  }
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.disposition_id, 'disposition_id', /^urn:uu-aap:marketcloser:human-analysis-disposition:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.origin, ORIGIN_KEYS, 'origin');
  req(input.origin.repository === 'Matawaka/uu-aap' && input.origin.revision === ORIGIN_FRONTIER && input.origin.tree === ORIGIN_TREE,
    'origin frontier mismatch');
  exact(input.analysis_source, SOURCE_KEYS, 'analysis_source');
  req(['repository_synthetic','local_private'].includes(input.analysis_source.mode), 'analysis source mode unsupported');
  str(input.analysis_source.path, 'analysis_source.path');
  str(input.analysis_source.expected_adapter_input_hash, 'expected adapter input hash', /^sha256:[0-9a-f]{64}$/);

  req(input.analysis_receipt === null || (input.analysis_receipt && typeof input.analysis_receipt === 'object' && !Array.isArray(input.analysis_receipt)),
    'analysis_receipt must be object or null');
  if (input.analysis_receipt !== null) Adapter.validateReceipt(input.analysis_receipt);

  req(input.decision === null || (input.decision && typeof input.decision === 'object' && !Array.isArray(input.decision)), 'decision must be object or null');
  if (input.decision !== null) validateDecision(input.decision);
  req(input.analysis_receipt !== null || input.decision === null, 'decision cannot exist without completed analysis receipt');
  if (input.decision === null) req(input.decided_at === null, 'decided_at must be null without decision');
  else instant(input.decided_at, 'decided_at');

  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true && input.controls.human_disposition_recording_available === true,
    'disposition runtime must remain local/read-only with explicit recording capability');
  for (const key of CONTROL_KEYS.filter(key => !['local_only','read_only','human_disposition_recording_available'].includes(key))) {
    req(input.controls[key] === false, `external capability must remain false: ${key}`);
  }
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function classificationForDecision(value) {
  return {
    REJECT: 'ANALYSIS_REJECTED_FOR_HUMAN_USE',
    CORRECT: 'ANALYSIS_CORRECTION_REQUIRED',
    REQUEST_MORE_EVIDENCE: 'MORE_EVIDENCE_REQUIRED',
    ACCEPT_FOR_HUMAN_USE: 'ANALYSIS_ACCEPTED_FOR_HUMAN_USE'
  }[value];
}
function nextAction(classification) {
  return {
    ANALYSIS_RESULT_REQUIRED: 'OBTAIN_COMPLETED_STRESS_TEST_RECEIPT',
    HUMAN_DECISION_REQUIRED: 'RECORD_EXPLICIT_HUMAN_ANALYSIS_DISPOSITION',
    ANALYSIS_REJECTED_FOR_HUMAN_USE: 'STOP_AFTER_ANALYSIS_REJECTION',
    ANALYSIS_CORRECTION_REQUIRED: 'ANALYSIS_CORRECTION_SUCCESSOR_REQUIRED',
    MORE_EVIDENCE_REQUIRED: 'EVIDENCE_SUCCESSOR_REQUIRED',
    ANALYSIS_ACCEPTED_FOR_HUMAN_USE: 'RESPONSE_CANDIDATE_CONSTRUCTION_REQUIRED'
  }[classification];
}

function deriveReceipt(input) {
  validateInput(input);
  const adapterInput = loadAdapterInput(input.analysis_source);
  const inspection = Adapter.inspect(adapterInput);

  let expectedReceipt = null;
  let exactReceipt = false;
  if (input.analysis_receipt !== null) {
    expectedReceipt = Adapter.stressTest(adapterInput);
    Adapter.validateReceipt(expectedReceipt);
    req(deepEqual(expectedReceipt, input.analysis_receipt), 'analysis receipt does not match exact adapter source');
    exactReceipt = true;
  }

  const classification = input.analysis_receipt === null
    ? 'ANALYSIS_RESULT_REQUIRED'
    : input.decision === null
      ? 'HUMAN_DECISION_REQUIRED'
      : classificationForDecision(input.decision.value);
  const decisionPresent = input.decision !== null;
  const analysisPresent = input.analysis_receipt !== null;

  const claims = {
    exact_adapter_source_revalidated: true,
    analysis_result_present: analysisPresent,
    analysis_result_exactly_revalidated: exactReceipt,
    human_disposition_recorded: decisionPresent,
    reviewer_reference_recorded: decisionPresent,
    decision_rationale_recorded: decisionPresent
  };
  FALSE_CLAIMS.forEach(key => { claims[key] = false; });

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:human-analysis-disposition-receipt:${input.content_hash.slice(-24)}`,
    source_input: { disposition_id: input.disposition_id, disposition_hash: input.content_hash },
    analysis_binding: {
      adapter_id: adapterInput.adapter_id,
      adapter_hash: adapterInput.content_hash,
      adapter_status: inspection.adapter_status,
      receipt_present: analysisPresent,
      receipt_id: analysisPresent ? input.analysis_receipt.receipt_id : null,
      receipt_hash: analysisPresent ? input.analysis_receipt.content_hash : null,
      receipt_classification: analysisPresent ? input.analysis_receipt.classification : null,
      logical_invocation_id: analysisPresent ? input.analysis_receipt.permit_binding.logical_invocation_id : null,
      analysis_state: analysisPresent ? input.analysis_receipt.analysis.state : null,
      recommendation_candidate: analysisPresent ? input.analysis_receipt.analysis.recommendation_candidate.candidate : null,
      exact_receipt_revalidated: exactReceipt
    },
    human_decision: {
      present: decisionPresent,
      context: decisionPresent ? input.decision.context : null,
      value: decisionPresent ? input.decision.value : null,
      reviewer_ref: decisionPresent ? input.decision.reviewer_ref : null,
      rationale: decisionPresent ? input.decision.rationale : null
    },
    classification,
    human_disposition_recorded: decisionPresent,
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: nextAction(classification),
    decided_at: decisionPresent ? input.decided_at : null,
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === RECEIPT_TYPE, 'receipt header mismatch');
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:human-analysis-disposition-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.analysis_binding, ANALYSIS_BINDING_KEYS, 'analysis_binding');
  exact(receipt.human_decision, HUMAN_DECISION_KEYS, 'human_decision');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification unsupported');

  const analysisPresent = receipt.analysis_binding.receipt_present === true;
  const decisionPresent = receipt.human_decision.present === true;
  req(receipt.human_disposition_recorded === decisionPresent, 'human_disposition_recorded mismatch');
  if (analysisPresent) {
    str(receipt.analysis_binding.receipt_id, 'analysis receipt id');
    str(receipt.analysis_binding.receipt_hash, 'analysis receipt hash', /^sha256:[0-9a-f]{64}$/);
    req(receipt.analysis_binding.exact_receipt_revalidated === true, 'present analysis receipt must be exactly revalidated');
  } else {
    for (const key of ['receipt_id','receipt_hash','receipt_classification','logical_invocation_id','analysis_state','recommendation_candidate']) {
      req(receipt.analysis_binding[key] === null, `missing analysis must keep ${key} null`);
    }
    req(receipt.analysis_binding.exact_receipt_revalidated === false, 'missing analysis cannot be revalidated');
  }
  if (decisionPresent) {
    req(analysisPresent, 'decision requires analysis result');
    req(DECISION_CONTEXTS.includes(receipt.human_decision.context), 'receipt decision context unsupported');
    req(DECISIONS.includes(receipt.human_decision.value), 'receipt decision unsupported');
    str(receipt.human_decision.reviewer_ref, 'receipt reviewer_ref');
    str(receipt.human_decision.rationale, 'receipt rationale');
    instant(receipt.decided_at, 'receipt decided_at');
    req(receipt.classification === classificationForDecision(receipt.human_decision.value), 'decision/classification mismatch');
  } else {
    for (const key of ['context','value','reviewer_ref','rationale']) req(receipt.human_decision[key] === null, `absent decision must keep ${key} null`);
    req(receipt.decided_at === null, 'absent decision must keep decided_at null');
    req(receipt.classification === (analysisPresent ? 'HUMAN_DECISION_REQUIRED' : 'ANALYSIS_RESULT_REQUIRED'), 'waiting classification mismatch');
  }

  exact(receipt.claims, CLAIM_KEYS, 'claims');
  req(receipt.claims.exact_adapter_source_revalidated === true, 'exact source revalidation claim required');
  req(receipt.claims.analysis_result_present === analysisPresent, 'analysis_result_present claim mismatch');
  req(receipt.claims.analysis_result_exactly_revalidated === analysisPresent, 'analysis exact revalidation claim mismatch');
  req(receipt.claims.human_disposition_recorded === decisionPresent, 'disposition claim mismatch');
  req(receipt.claims.reviewer_reference_recorded === decisionPresent, 'reviewer reference claim mismatch');
  req(receipt.claims.decision_rationale_recorded === decisionPresent, 'rationale claim mismatch');
  FALSE_CLAIMS.forEach(key => req(receipt.claims[key] === false, `prohibited claim ${key}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'non_effect set mismatch');
  req(receipt.next_safe_action === nextAction(receipt.classification), 'next_safe_action mismatch');
  req(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserHumanAnalysisDispositionInputValidationReceipt',
    disposition_id: input.disposition_id,
    disposition_hash: input.content_hash,
    valid: true,
    human_disposition_recorded: false,
    response_candidate_created: false,
    external_effect_available: false
  };
}
function parseText(text) {
  req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserHumanAnalysisDispositionError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8');
  return parseText(text);
}
function usage() {
  return [
    'MarketCloser Human Analysis Disposition Gate v0.1','',
    'Usage:',
    '  node applications/marketcloser/v0.1/human-analysis-disposition/v0.1/disposition.js validate <file|->',
    '  node applications/marketcloser/v0.1/human-analysis-disposition/v0.1/disposition.js receipt <file|->',
    '  node applications/marketcloser/v0.1/human-analysis-disposition/v0.1/disposition.js help','',
    'The gate records an explicit human disposition over one exact stress-test result. It never creates a response, publication authority or external effect.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help','--help','-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  req(['validate','receipt'].includes(command), `unsupported command: ${command}`);
  req(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : deriveReceipt(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try { const result = runCli(process.argv.slice(2)); process.stdout.write(result.text); process.exitCode = result.exitCode; }
  catch (error) { process.stderr.write(`${JSON.stringify({ error:'MARKETCLOSER_HUMAN_ANALYSIS_DISPOSITION_REJECTED', message:error.message || String(error) })}\n`); process.exitCode = 1; }
}
if (require.main === module) main();

module.exports = {
  MarketCloserHumanAnalysisDispositionError,
  PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,ORIGIN_TREE,DECISIONS,DECISION_CONTEXTS,CLASSIFICATIONS,
  INPUT_KEYS,CONTROL_KEYS,RECEIPT_KEYS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,
  canonicalize,computeContentHash,rehash,validateInput,loadAdapterInput,classificationForDecision,nextAction,
  deriveReceipt,validateReceipt,validationReceipt,parseText,readInput,usage,runCli
};
