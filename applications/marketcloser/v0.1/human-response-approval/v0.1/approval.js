'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Response = require(path.resolve(__dirname, '../../response-candidate/v0.1/response-candidate.js'));

const PROTOCOL = 'MARKETCLOSER-HUMAN-RESPONSE-APPROVAL';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserHumanResponseApprovalInput';
const RECEIPT_TYPE = 'MarketCloserHumanResponseApprovalReceipt';
const ORIGIN_FRONTIER = '92533e6f84f036c1e45daa8ae18fe22957707f10';
const ORIGIN_TREE = 'b1c11f4756055eb69e4c212726f39facddd8f41e';

const DECISIONS = Object.freeze(['REJECT_RESPONSE','REQUEST_RESPONSE_CHANGES','APPROVE_FOR_COPY_EXPORT']);
const DECISION_CONTEXTS = Object.freeze(['synthetic_conformance','human_supplied']);
const CLASSIFICATIONS = Object.freeze([
  'RESPONSE_CANDIDATE_REQUIRED',
  'HUMAN_RESPONSE_DECISION_REQUIRED',
  'RESPONSE_REJECTED',
  'RESPONSE_CHANGES_REQUIRED',
  'APPROVED_FOR_COPY_EXPORT'
]);

const INPUT_KEYS = Object.freeze([
  'protocol','version','artifact_type','approval_id','origin','response_source',
  'response_candidate_receipt','decision','decided_at','controls','content_hash'
]);
const ORIGIN_KEYS = Object.freeze(['repository','revision','tree']);
const SOURCE_KEYS = Object.freeze(['mode','path','expected_response_input_hash']);
const DECISION_KEYS = Object.freeze(['context','value','reviewer_ref','rationale']);
const CONTROL_KEYS = Object.freeze([
  'local_only','read_only','human_response_approval_recording_available','copy_export_authorization_available',
  'copy_export_execution_available','publication_available','provider_invocation_available','network_access_available',
  'platform_mutation_available','campaign_send_available','pilot_permit_available','action_permit_available',
  'external_execution_available','external_effect_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol','version','receipt_type','receipt_id','source_input','response_binding','human_decision',
  'classification','approved_for_copy_export','copy_export_authorized','claims','non_effects',
  'next_safe_action','decided_at','content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['approval_id','approval_hash']);
const RESPONSE_BINDING_KEYS = Object.freeze([
  'request_id','request_hash','receipt_present','receipt_id','receipt_hash','classification',
  'candidate_id','draft_hash','exact_receipt_revalidated','candidate_ready'
]);
const HUMAN_DECISION_KEYS = Object.freeze(['present','context','value','reviewer_ref','rationale']);

const FALSE_CLAIMS = Object.freeze([
  'reviewer_identity_verified','reviewer_authority_verified','draft_modified','copy_export_performed',
  'publication_authorized','provider_invoked','network_accessed','platform_mutated','campaign_sent',
  'pilot_permit_created','action_permit_created','external_execution_admitted','external_effect_performed',
  'successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([
  'exact_response_source_revalidated','response_candidate_present','response_candidate_exactly_revalidated',
  'human_response_decision_recorded','reviewer_reference_recorded','decision_rationale_recorded',
  'approval_bound_to_exact_draft','copy_export_authorized',...FALSE_CLAIMS
]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Response Candidate != Approved Response',
  'Human Approval != Publication',
  'Approval For Copy Export != Copy Performed',
  'Approval For Copy Export != Publication Authority',
  'Approved Exact Draft != Authority To Edit Draft',
  'Draft Change != Existing Approval Continuity',
  'Human Decision Recorded != Reviewer Identity Verified',
  'Human Decision Recorded != Reviewer Authority Verified',
  'Approval Receipt != ActionPermit',
  'Approval Receipt != External Effect',
  'Copy Export != Platform Publication'
]);

class MarketCloserHumanResponseApprovalError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserHumanResponseApprovalError(message); };
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
function textHash(value) { return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`; }
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
function resolveResponsePath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository response path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'response path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported response source mode');
  return path.resolve(source.path);
}
function loadResponseInput(source) {
  const resolved = resolveResponsePath(source);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  Response.validateInput(input);
  req(input.content_hash === source.expected_response_input_hash, 'response input hash mismatch');
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
  return decision;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.approval_id, 'approval_id', /^urn:uu-aap:marketcloser:human-response-approval:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.origin, ORIGIN_KEYS, 'origin');
  req(input.origin.repository === 'Matawaka/uu-aap' && input.origin.revision === ORIGIN_FRONTIER && input.origin.tree === ORIGIN_TREE,
    'origin frontier mismatch');
  exact(input.response_source, SOURCE_KEYS, 'response_source');
  req(['repository_synthetic','local_private'].includes(input.response_source.mode), 'response source mode unsupported');
  str(input.response_source.path, 'response_source.path');
  str(input.response_source.expected_response_input_hash, 'expected response input hash', /^sha256:[0-9a-f]{64}$/);
  req(input.response_candidate_receipt === null || (input.response_candidate_receipt && typeof input.response_candidate_receipt === 'object' && !Array.isArray(input.response_candidate_receipt)),
    'response_candidate_receipt must be object or null');
  if (input.response_candidate_receipt !== null) Response.validateReceipt(input.response_candidate_receipt);
  req(input.decision === null || (input.decision && typeof input.decision === 'object' && !Array.isArray(input.decision)), 'decision must be object or null');
  if (input.decision !== null) validateDecision(input.decision);
  req(input.response_candidate_receipt !== null || input.decision === null, 'decision cannot exist without response candidate receipt');
  if (input.decision === null) req(input.decided_at === null, 'decided_at must be null without decision');
  else instant(input.decided_at, 'decided_at');

  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true &&
    input.controls.human_response_approval_recording_available === true && input.controls.copy_export_authorization_available === true,
    'approval runtime must remain local/read-only with explicit copy-export authorization recording');
  for (const key of CONTROL_KEYS.filter(key => !['local_only','read_only','human_response_approval_recording_available','copy_export_authorization_available'].includes(key))) {
    req(input.controls[key] === false, `external capability must remain false: ${key}`);
  }
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function classificationForDecision(value) {
  return {
    REJECT_RESPONSE: 'RESPONSE_REJECTED',
    REQUEST_RESPONSE_CHANGES: 'RESPONSE_CHANGES_REQUIRED',
    APPROVE_FOR_COPY_EXPORT: 'APPROVED_FOR_COPY_EXPORT'
  }[value];
}
function nextAction(classification) {
  return {
    RESPONSE_CANDIDATE_REQUIRED: 'OBTAIN_RESPONSE_CANDIDATE_RECEIPT',
    HUMAN_RESPONSE_DECISION_REQUIRED: 'RECORD_EXPLICIT_HUMAN_RESPONSE_DECISION',
    RESPONSE_REJECTED: 'STOP_AFTER_RESPONSE_REJECTION',
    RESPONSE_CHANGES_REQUIRED: 'RESPONSE_CANDIDATE_REVISION_REQUIRED',
    APPROVED_FOR_COPY_EXPORT: 'COPY_EXPORT_RECEIPT_REQUIRED'
  }[classification];
}

function deriveReceipt(input) {
  validateInput(input);
  const responseInput = loadResponseInput(input.response_source);
  const expectedResponseReceipt = Response.deriveReceipt(responseInput);

  let candidatePresent = false;
  let exactReceipt = false;
  let candidateReady = false;
  if (input.response_candidate_receipt !== null) {
    Response.validateReceipt(input.response_candidate_receipt);
    req(deepEqual(expectedResponseReceipt, input.response_candidate_receipt), 'response candidate receipt does not match exact response source');
    candidatePresent = true;
    exactReceipt = true;
    candidateReady = input.response_candidate_receipt.classification === 'RESPONSE_CANDIDATE_READY';
  }

  const decisionPresent = input.decision !== null;
  if (decisionPresent) req(candidateReady, 'human response decision requires RESPONSE_CANDIDATE_READY');
  const classification = !candidatePresent
    ? 'RESPONSE_CANDIDATE_REQUIRED'
    : !decisionPresent
      ? 'HUMAN_RESPONSE_DECISION_REQUIRED'
      : classificationForDecision(input.decision.value);
  const approved = classification === 'APPROVED_FOR_COPY_EXPORT';

  const candidate = candidateReady ? input.response_candidate_receipt.response_candidate : null;
  const claims = {
    exact_response_source_revalidated: true,
    response_candidate_present: candidatePresent,
    response_candidate_exactly_revalidated: exactReceipt,
    human_response_decision_recorded: decisionPresent,
    reviewer_reference_recorded: decisionPresent,
    decision_rationale_recorded: decisionPresent,
    approval_bound_to_exact_draft: approved,
    copy_export_authorized: approved
  };
  FALSE_CLAIMS.forEach(key => { claims[key] = false; });

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:human-response-approval-receipt:${input.content_hash.slice(-24)}`,
    source_input: { approval_id: input.approval_id, approval_hash: input.content_hash },
    response_binding: {
      request_id: responseInput.request_id,
      request_hash: responseInput.content_hash,
      receipt_present: candidatePresent,
      receipt_id: candidatePresent ? input.response_candidate_receipt.receipt_id : null,
      receipt_hash: candidatePresent ? input.response_candidate_receipt.content_hash : null,
      classification: candidatePresent ? input.response_candidate_receipt.classification : null,
      candidate_id: candidate ? candidate.candidate_id : null,
      draft_hash: candidate ? textHash(candidate.draft_text) : null,
      exact_receipt_revalidated: exactReceipt,
      candidate_ready: candidateReady
    },
    human_decision: {
      present: decisionPresent,
      context: decisionPresent ? input.decision.context : null,
      value: decisionPresent ? input.decision.value : null,
      reviewer_ref: decisionPresent ? input.decision.reviewer_ref : null,
      rationale: decisionPresent ? input.decision.rationale : null
    },
    classification,
    approved_for_copy_export: approved,
    copy_export_authorized: approved,
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
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:human-response-approval-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.response_binding, RESPONSE_BINDING_KEYS, 'response_binding');
  exact(receipt.human_decision, HUMAN_DECISION_KEYS, 'human_decision');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification unsupported');

  const candidatePresent = receipt.response_binding.receipt_present === true;
  const decisionPresent = receipt.human_decision.present === true;
  if (candidatePresent) {
    str(receipt.response_binding.receipt_id, 'response receipt id');
    str(receipt.response_binding.receipt_hash, 'response receipt hash', /^sha256:[0-9a-f]{64}$/);
    req(receipt.response_binding.exact_receipt_revalidated === true, 'present response receipt must be exactly revalidated');
    req(typeof receipt.response_binding.candidate_ready === 'boolean', 'candidate_ready must be boolean');
    if (receipt.response_binding.candidate_ready) {
      str(receipt.response_binding.candidate_id, 'candidate_id');
      str(receipt.response_binding.draft_hash, 'draft_hash', /^sha256:[0-9a-f]{64}$/);
      req(receipt.response_binding.classification === 'RESPONSE_CANDIDATE_READY', 'ready candidate classification mismatch');
    }
  } else {
    for (const key of ['receipt_id','receipt_hash','classification','candidate_id','draft_hash']) {
      req(receipt.response_binding[key] === null, `missing response candidate must keep ${key} null`);
    }
    req(receipt.response_binding.exact_receipt_revalidated === false && receipt.response_binding.candidate_ready === false,
      'missing response candidate cannot be ready/revalidated');
  }

  if (decisionPresent) {
    req(candidatePresent && receipt.response_binding.candidate_ready === true, 'decision requires ready response candidate');
    req(DECISION_CONTEXTS.includes(receipt.human_decision.context), 'receipt decision context unsupported');
    req(DECISIONS.includes(receipt.human_decision.value), 'receipt decision unsupported');
    str(receipt.human_decision.reviewer_ref, 'receipt reviewer_ref');
    str(receipt.human_decision.rationale, 'receipt rationale');
    instant(receipt.decided_at, 'receipt decided_at');
    req(receipt.classification === classificationForDecision(receipt.human_decision.value), 'decision/classification mismatch');
  } else {
    for (const key of ['context','value','reviewer_ref','rationale']) req(receipt.human_decision[key] === null, `absent decision must keep ${key} null`);
    req(receipt.decided_at === null, 'absent decision must keep decided_at null');
    req(receipt.classification === (candidatePresent ? 'HUMAN_RESPONSE_DECISION_REQUIRED' : 'RESPONSE_CANDIDATE_REQUIRED'), 'waiting classification mismatch');
  }

  const approved = receipt.classification === 'APPROVED_FOR_COPY_EXPORT';
  req(receipt.approved_for_copy_export === approved, 'approved_for_copy_export mismatch');
  req(receipt.copy_export_authorized === approved, 'copy_export_authorized mismatch');
  exact(receipt.claims, CLAIM_KEYS, 'claims');
  req(receipt.claims.exact_response_source_revalidated === true, 'exact source revalidation claim required');
  req(receipt.claims.response_candidate_present === candidatePresent, 'response_candidate_present claim mismatch');
  req(receipt.claims.response_candidate_exactly_revalidated === candidatePresent, 'response exact revalidation claim mismatch');
  req(receipt.claims.human_response_decision_recorded === decisionPresent, 'decision recorded claim mismatch');
  req(receipt.claims.reviewer_reference_recorded === decisionPresent, 'reviewer reference claim mismatch');
  req(receipt.claims.decision_rationale_recorded === decisionPresent, 'decision rationale claim mismatch');
  req(receipt.claims.approval_bound_to_exact_draft === approved, 'approval exact-draft binding claim mismatch');
  req(receipt.claims.copy_export_authorized === approved, 'copy-export authorization claim mismatch');
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
    receipt_type: 'MarketCloserHumanResponseApprovalInputValidationReceipt',
    approval_id: input.approval_id,
    approval_hash: input.content_hash,
    valid: true,
    response_approved_for_copy_export: false,
    copy_export_performed: false,
    publication_authorized: false,
    external_effect_available: false
  };
}
function parseText(text) {
  req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserHumanResponseApprovalError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8');
  return parseText(text);
}
function usage() {
  return [
    'MarketCloser Human Response Approval v0.1','',
    'Usage:',
    '  node applications/marketcloser/v0.1/human-response-approval/v0.1/approval.js validate <file|->',
    '  node applications/marketcloser/v0.1/human-response-approval/v0.1/approval.js receipt <file|->',
    '  node applications/marketcloser/v0.1/human-response-approval/v0.1/approval.js help','',
    'The gate records a human decision over one exact response candidate. Approval authorizes only a later local copy/export step; it never publishes or performs the copy/export.'
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
  catch (error) { process.stderr.write(`${JSON.stringify({ error:'MARKETCLOSER_HUMAN_RESPONSE_APPROVAL_REJECTED', message:error.message || String(error) })}\n`); process.exitCode = 1; }
}
if (require.main === module) main();

module.exports = {
  MarketCloserHumanResponseApprovalError,
  PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,ORIGIN_TREE,DECISIONS,DECISION_CONTEXTS,CLASSIFICATIONS,
  INPUT_KEYS,CONTROL_KEYS,RECEIPT_KEYS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,
  canonicalize,computeContentHash,rehash,textHash,validateInput,loadResponseInput,classificationForDecision,nextAction,
  deriveReceipt,validateReceipt,validationReceipt,parseText,readInput,usage,runCli
};
