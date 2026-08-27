'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { FCLControlRequestError, validateRequestReceipt } = require('../control-request/control-request.js');
const { FCLRuntimeUIError, validateViewModel } = require('../runtime-ui/runtime-ui.js');

class FCLRequestEvaluationError extends Error {
  constructor(message) { super(message); this.name = 'FCLRequestEvaluationError'; }
}
function requireCondition(condition, message) { if (!condition) throw new FCLRequestEvaluationError(message); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
}
function canonicalFingerprint(value) {
  const projected = clone(value); projected.fingerprint_sha256 = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}
function assertExactKeys(value, expectedKeys, label) {
  requireCondition(isObject(value), `${label} must be an object`);
  requireCondition(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expectedKeys].sort()), `${label} keys mismatch`);
}
function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}
function assertNonNegativeInteger(value, label) { requireCondition(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`); }
function parseInstant(value, label) {
  assertString(value, label); const instant = Date.parse(value);
  requireCondition(Number.isFinite(instant), `${label} must be a valid date-time`); return instant;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{2,95}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const INPUT_KEYS = ['protocol','version','profile','evaluation_id','origin','request_receipt','current_view','evaluated_at'];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','evaluation_id','request_id','request_receipt_fingerprint',
  'original_source_view_fingerprint','current_view_fingerprint','exact_source_view_match','requested_control',
  'request_run_id','request_run_epoch','request_chain_id','intent_ref','current_run_id','current_run_epoch',
  'current_chain_id','current_intent_ref','current_display_state','current_offered_control','current_continuity_mode',
  'current_evidence_at_or_after_request','execution_context_match','display_state_match','control_match',
  'semantic_anchor_match','classification','current_state_revalidated','forwardable_to_authority_gate',
  'authority_evaluation_required','absence_of_intervening_progress_proven','request_effect_authorized',
  'interrupt_completed','continuation_receipt_created','successor_run_created','runtime_state_transitioned',
  'progress_created','liveness_proven','action_permit_established','execution_admitted','authority_established',
  'hidden_reasoning_included','next_safe_action','request_requested_at','current_view_rendered_at','evaluated_at','fingerprint_sha256'
];
const CLASSIFICATIONS = ['CURRENT_EQUIVALENT_STATE','STALE_EXECUTION_CONTEXT','STALE_DISPLAY_STATE','STALE_CONTROL_WITHDRAWN','INSUFFICIENT_CURRENT_EVIDENCE'];

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === 'FCL', 'input.protocol must be FCL');
  requireCondition(input.version === '0.1', 'input.version must be 0.1');
  requireCondition(input.profile === 'current-state-request-evaluation-v0.1', 'input.profile mismatch');
  assertString(input.evaluation_id, 'input.evaluation_id', ID_PATTERN);
  assertExactKeys(input.origin, ['repository','revision','tree'], 'input.origin');
  requireCondition(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  assertString(input.origin.revision, 'input.origin.revision', SHA_PATTERN);
  assertString(input.origin.tree, 'input.origin.tree', SHA_PATTERN);
  requireCondition(isObject(input.request_receipt), 'input.request_receipt must be an object');
  try { validateRequestReceipt(input.request_receipt); }
  catch (error) {
    if (error instanceof FCLControlRequestError) throw new FCLRequestEvaluationError(`request_receipt invalid: ${error.message}`);
    throw error;
  }
  requireCondition(isObject(input.current_view), 'input.current_view must be an object');
  try { validateViewModel(input.current_view); }
  catch (error) {
    if (error instanceof FCLRuntimeUIError) throw new FCLRequestEvaluationError(`current_view invalid: ${error.message}`);
    throw error;
  }
  const requestedAt = parseInstant(input.request_receipt.requested_at, 'request_receipt.requested_at');
  const currentRenderedAt = parseInstant(input.current_view.rendered_at, 'current_view.rendered_at');
  const evaluatedAt = parseInstant(input.evaluated_at, 'input.evaluated_at');
  requireCondition(evaluatedAt >= requestedAt, 'evaluated_at cannot precede request');
  requireCondition(evaluatedAt >= currentRenderedAt, 'evaluated_at cannot precede current view evidence');
  return true;
}
function expectedDisplayState(requestedControl) { return requestedControl === 'REQUEST_INTERRUPT' ? 'STALL_SUSPECTED' : 'CONTINUATION_AVAILABLE'; }
function classify(input) {
  validateInput(input); const request = input.request_receipt; const view = input.current_view;
  const currentEnough = parseInstant(view.rendered_at, 'current_view.rendered_at') >= parseInstant(request.requested_at, 'request_receipt.requested_at');
  const executionContextMatch = view.displayed_run_id === request.source_run_id && view.displayed_run_epoch === request.source_run_epoch && view.displayed_chain_id === request.source_chain_id && view.intent_ref === request.intent_ref && view.continuity_mode === 'SAME_RUN' && view.predecessor_run_id === null && view.predecessor_run_epoch === null && view.successor_run_id === null && view.successor_run_epoch === null;
  const displayStateMatch = view.display_state === expectedDisplayState(request.requested_control);
  const controlMatch = view.offered_control === request.requested_control && view.control_semantics === 'REQUEST_ONLY';
  const semanticAnchorMatch = executionContextMatch && displayStateMatch && controlMatch;
  let classification;
  if (!currentEnough) classification = 'INSUFFICIENT_CURRENT_EVIDENCE';
  else if (!executionContextMatch) classification = 'STALE_EXECUTION_CONTEXT';
  else if (!displayStateMatch) classification = 'STALE_DISPLAY_STATE';
  else if (!controlMatch) classification = 'STALE_CONTROL_WITHDRAWN';
  else classification = 'CURRENT_EQUIVALENT_STATE';
  return { currentEnough, executionContextMatch, displayStateMatch, controlMatch, semanticAnchorMatch, classification };
}
function buildEvaluationReceipt(input) {
  const assessment = classify(input); const request = input.request_receipt; const view = input.current_view;
  const current = assessment.classification === 'CURRENT_EQUIVALENT_STATE';
  const insufficient = assessment.classification === 'INSUFFICIENT_CURRENT_EVIDENCE';
  const nextSafeAction = current ? 'EVALUATE_AUTHORITY_FOR_REQUEST' : insufficient ? 'OBTAIN_CURRENT_STATE_EVIDENCE' : 'DO_NOT_FORWARD_STALE_REQUEST';
  const receipt = {
    protocol:'FCL',version:'0.1',receipt_type:'CurrentStateRequestEvaluationReceipt',evaluation_id:input.evaluation_id,
    request_id:request.request_id,request_receipt_fingerprint:request.fingerprint_sha256,
    original_source_view_fingerprint:request.source_view_fingerprint,current_view_fingerprint:view.fingerprint_sha256,
    exact_source_view_match:request.source_view_fingerprint===view.fingerprint_sha256,requested_control:request.requested_control,
    request_run_id:request.source_run_id,request_run_epoch:request.source_run_epoch,request_chain_id:request.source_chain_id,intent_ref:request.intent_ref,
    current_run_id:view.displayed_run_id,current_run_epoch:view.displayed_run_epoch,current_chain_id:view.displayed_chain_id,current_intent_ref:view.intent_ref,
    current_display_state:view.display_state,current_offered_control:view.offered_control,current_continuity_mode:view.continuity_mode,
    current_evidence_at_or_after_request:assessment.currentEnough,execution_context_match:assessment.executionContextMatch,
    display_state_match:assessment.displayStateMatch,control_match:assessment.controlMatch,semantic_anchor_match:assessment.semanticAnchorMatch,
    classification:assessment.classification,current_state_revalidated:!insufficient,forwardable_to_authority_gate:current,
    authority_evaluation_required:current,absence_of_intervening_progress_proven:false,request_effect_authorized:false,
    interrupt_completed:false,continuation_receipt_created:false,successor_run_created:false,runtime_state_transitioned:false,
    progress_created:false,liveness_proven:false,action_permit_established:false,execution_admitted:false,authority_established:false,
    hidden_reasoning_included:false,next_safe_action:nextSafeAction,request_requested_at:request.requested_at,
    current_view_rendered_at:view.rendered_at,evaluated_at:input.evaluated_at,fingerprint_sha256:''
  };
  receipt.fingerprint_sha256 = canonicalFingerprint(receipt); return receipt;
}
function validateEvaluationReceipt(receipt) {
  assertExactKeys(receipt, RECEIPT_KEYS, 'receipt');
  requireCondition(receipt.protocol==='FCL'&&receipt.version==='0.1'&&receipt.receipt_type==='CurrentStateRequestEvaluationReceipt','receipt header mismatch');
  assertString(receipt.evaluation_id,'receipt.evaluation_id',ID_PATTERN); assertString(receipt.request_id,'receipt.request_id',ID_PATTERN);
  assertString(receipt.request_receipt_fingerprint,'receipt.request_receipt_fingerprint',SHA256_PATTERN);
  assertString(receipt.original_source_view_fingerprint,'receipt.original_source_view_fingerprint',SHA256_PATTERN);
  assertString(receipt.current_view_fingerprint,'receipt.current_view_fingerprint',SHA256_PATTERN);
  requireCondition(typeof receipt.exact_source_view_match==='boolean','receipt.exact_source_view_match must be boolean');
  requireCondition(['REQUEST_INTERRUPT','REQUEST_SUCCESSOR'].includes(receipt.requested_control),'receipt.requested_control invalid');
  assertString(receipt.request_run_id,'receipt.request_run_id',ID_PATTERN); assertNonNegativeInteger(receipt.request_run_epoch,'receipt.request_run_epoch');
  assertString(receipt.request_chain_id,'receipt.request_chain_id',ID_PATTERN); assertString(receipt.intent_ref,'receipt.intent_ref');
  assertString(receipt.current_run_id,'receipt.current_run_id',ID_PATTERN); assertNonNegativeInteger(receipt.current_run_epoch,'receipt.current_run_epoch');
  assertString(receipt.current_chain_id,'receipt.current_chain_id',ID_PATTERN); assertString(receipt.current_intent_ref,'receipt.current_intent_ref');
  requireCondition(['ACTIVE','WAITING','STALL_SUSPECTED','CONTINUATION_AVAILABLE','CONTINUED_ON_SUCCESSOR'].includes(receipt.current_display_state),'receipt.current_display_state invalid');
  requireCondition(['NONE','REQUEST_INTERRUPT','REQUEST_SUCCESSOR'].includes(receipt.current_offered_control),'receipt.current_offered_control invalid');
  requireCondition(['SAME_RUN','SUCCESSOR_OF_CLOSED_RUN'].includes(receipt.current_continuity_mode),'receipt.current_continuity_mode invalid');
  ['current_evidence_at_or_after_request','execution_context_match','display_state_match','control_match','semantic_anchor_match','current_state_revalidated','forwardable_to_authority_gate','authority_evaluation_required'].forEach(key=>requireCondition(typeof receipt[key]==='boolean',`receipt.${key} must be boolean`));
  requireCondition(CLASSIFICATIONS.includes(receipt.classification),'receipt.classification invalid');
  requireCondition(receipt.semantic_anchor_match===(receipt.execution_context_match&&receipt.display_state_match&&receipt.control_match),'receipt.semantic_anchor_match inconsistent');
  const current=receipt.classification==='CURRENT_EQUIVALENT_STATE'; const insufficient=receipt.classification==='INSUFFICIENT_CURRENT_EVIDENCE';
  requireCondition(receipt.current_state_revalidated===!insufficient,'receipt.current_state_revalidated inconsistent');
  requireCondition(receipt.forwardable_to_authority_gate===current,'only current request may be forwardable');
  requireCondition(receipt.authority_evaluation_required===current,'authority evaluation flag inconsistent');
  if(current){requireCondition(receipt.current_evidence_at_or_after_request===true,'current classification requires current evidence');requireCondition(receipt.semantic_anchor_match===true,'current classification requires semantic anchor match');requireCondition(receipt.next_safe_action==='EVALUATE_AUTHORITY_FOR_REQUEST','current classification next action mismatch');}
  else if(insufficient){requireCondition(receipt.current_evidence_at_or_after_request===false,'insufficient classification requires older evidence');requireCondition(receipt.next_safe_action==='OBTAIN_CURRENT_STATE_EVIDENCE','insufficient classification next action mismatch');}
  else{requireCondition(receipt.current_evidence_at_or_after_request===true,'stale classification requires current evidence');requireCondition(receipt.forwardable_to_authority_gate===false,'stale request cannot be forwardable');requireCondition(receipt.next_safe_action==='DO_NOT_FORWARD_STALE_REQUEST','stale classification next action mismatch');}
  requireCondition(receipt.absence_of_intervening_progress_proven===false,'semantic equivalence cannot prove absence of intervening progress');
  ['request_effect_authorized','interrupt_completed','continuation_receipt_created','successor_run_created','runtime_state_transitioned','progress_created','liveness_proven','action_permit_established','execution_admitted','authority_established','hidden_reasoning_included'].forEach(key=>requireCondition(receipt[key]===false,`receipt.${key} must remain false`));
  requireCondition(['EVALUATE_AUTHORITY_FOR_REQUEST','OBTAIN_CURRENT_STATE_EVIDENCE','DO_NOT_FORWARD_STALE_REQUEST'].includes(receipt.next_safe_action),'receipt.next_safe_action invalid');
  parseInstant(receipt.request_requested_at,'receipt.request_requested_at'); parseInstant(receipt.current_view_rendered_at,'receipt.current_view_rendered_at');
  const evaluatedAt=parseInstant(receipt.evaluated_at,'receipt.evaluated_at');
  requireCondition(evaluatedAt>=parseInstant(receipt.request_requested_at,'receipt.request_requested_at'),'receipt.evaluated_at precedes request');
  requireCondition(evaluatedAt>=parseInstant(receipt.current_view_rendered_at,'receipt.current_view_rendered_at'),'receipt.evaluated_at precedes current view');
  assertString(receipt.fingerprint_sha256,'receipt.fingerprint_sha256',SHA256_PATTERN);
  requireCondition(receipt.fingerprint_sha256===canonicalFingerprint(receipt),'receipt fingerprint mismatch'); return true;
}
function parseInputText(text){requireCondition(typeof text==='string'&&text.trim().length>0,'input must contain JSON');try{return JSON.parse(text);}catch(error){throw new FCLRequestEvaluationError(`invalid JSON: ${error.message}`);}}
function readInput(inputPath){requireCondition(typeof inputPath==='string'&&inputPath.length>0,'input path required');return parseInputText(inputPath==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(path.resolve(inputPath),'utf8'));}
function printJson(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
function main(args){const [command,inputPath,...extra]=args;if(!command||['help','--help','-h'].includes(command)){requireCondition(!inputPath&&extra.length===0,'help accepts no extra arguments');process.stdout.write('FCL Current-State Request Evaluation Gate v0.1 read-only CLI\nUsage: request-evaluation.js validate|evaluate <input.json|->\nNo interrupt/resume/execute/send/switch/activate/create-successor/grant/permit command exists.\n');return 0;}requireCondition(extra.length===0,'unexpected extra arguments');requireCondition(['validate','evaluate'].includes(command),`unsupported command: ${command}`);requireCondition(inputPath!==undefined,`${command} requires an input path`);const input=readInput(inputPath);if(command==='validate'){validateInput(input);printJson({protocol:'FCL',version:'0.1',profile:'current-state-request-evaluation-v0.1',status:'VALID',evaluation_id:input.evaluation_id,action_permit_established:false,execution_admitted:false,authority_established:false});return 0;}const receipt=buildEvaluationReceipt(input);validateEvaluationReceipt(receipt);printJson(receipt);return 0;}
if(require.main===module){try{process.exitCode=main(process.argv.slice(2));}catch(error){if(error instanceof FCLRequestEvaluationError){process.stderr.write(`FCL Current-State Request Evaluation validation error: ${error.message}\n`);process.exitCode=1;}else throw error;}}
module.exports={FCLRequestEvaluationError,buildEvaluationReceipt,canonicalFingerprint,classify,validateEvaluationReceipt,validateInput};
