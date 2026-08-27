'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  FCLControlRequestError,
  canonicalFingerprint: requestFingerprint,
  validateRequestReceipt
} = require('../control-request/control-request.js');
const {
  FCLCoreActionPermitBindingError,
  hashObject,
  validateBoundActionPermit
} = require('../core-action-permit-binding/core-action-permit-binding.js');

class FCLActionSpecificApprovalError extends Error {
  constructor(message) { super(message); this.name = 'FCLActionSpecificApprovalError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLActionSpecificApprovalError(message); };
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const exact = (value, keys, label) => {
  req(obj(value), `${label} must be object`);
  req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} keys mismatch`);
};
const str = (value, label, pattern = null) => {
  req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
  if (pattern) req(pattern.test(value), `${label} invalid format`);
};
const integer = (value, label) => req(Number.isInteger(value) && value >= 0, `${label} must be integer >= 0`);
const instant = (value, label) => {
  str(value, label);
  const n = Date.parse(value);
  req(Number.isFinite(n), `${label} invalid date-time`);
  return n;
};

const SHA40 = /^[0-9a-f]{40}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z][a-z0-9-]{2,95}$/;
const HUMAN_EVENT_KINDS = ['POINTER_ACTIVATION','KEYBOARD_ACTIVATION','VOICE_ACTIVATION','ACCESSIBILITY_ACTIVATION'];
const INPUT_KEYS = [
  'protocol','version','profile','approval_id','origin','user_control_request_receipt',
  'core_action_permit_binding_input','core_action_permit','approval_event','issued_at','valid_until'
];
const APPROVAL_EVENT_KEYS = [
  'event_id','event_kind','target_action_permit_hash','target_coordination_receipt_hash',
  'target_binding_hash','occurred_at','human_initiated','passive_observation'
];
const APPROVAL_BINDING_KEYS = [
  'approval_id','kind','scope_bound','subject_id','operation','action_scope','authority_scope',
  'target_binding_hash','issued_at','valid_until','one_shot','content_hash'
];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','approval_id','request_id','requested_control','request_fingerprint',
  'core_action_permit_hash','core_coordination_receipt_hash','target_binding_hash','source_run_id','source_run_epoch',
  'source_chain_id','intent_ref','approval_event_id','approval_event_kind','approval_event_occurred_at',
  'approval_binding','explicit_approval_recorded','permit_preexisted_approval','permit_unconsumed_at_approval',
  'approval_required_before_authorize','request_reinterpreted_as_approval','authority_created','authority_expanded',
  'coordination_created','action_permit_created','action_permit_consumed','execution_authorized','execution_admitted',
  'pre_action_bundle_created','lifecycle_authorize_admitted','lifecycle_execute_ready','interrupt_completed',
  'continuation_receipt_created','successor_run_created','runtime_state_transitioned','approval_reusable',
  'approval_generalized','future_action_permission_created','general_authority_created','legal_authority_established',
  'universal_authority_established','legal_effect_established','truth_certified','causality_proven',
  'liability_established','private_reasoning_included','next_safe_action','issued_at','fingerprint_sha256'
];
const FIXED_FALSE_KEYS = [
  'request_reinterpreted_as_approval','authority_created','authority_expanded','coordination_created',
  'action_permit_created','action_permit_consumed','execution_authorized','execution_admitted',
  'pre_action_bundle_created','lifecycle_authorize_admitted','lifecycle_execute_ready','interrupt_completed',
  'continuation_receipt_created','successor_run_created','runtime_state_transitioned','approval_reusable',
  'approval_generalized','future_action_permission_created','general_authority_created','legal_authority_established',
  'universal_authority_established','legal_effect_established','truth_certified','causality_proven',
  'liability_established','private_reasoning_included'
];

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (obj(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new FCLActionSpecificApprovalError(`unsupported canonical JSON value type: ${typeof value}`);
}
function sha256Object(value, excluded = new Set(['content_hash'])) {
  const projection = {};
  for (const [key,item] of Object.entries(value)) if (!excluded.has(key)) projection[key]=item;
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(projection),'utf8')).digest('hex')}`;
}
function receiptFingerprint(receipt) {
  const projected=clone(receipt);
  projected.fingerprint_sha256='';
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(projected),'utf8')).digest('hex')}`;
}

function validatePermitAndRequest(input) {
  try { validateRequestReceipt(input.user_control_request_receipt); }
  catch(error) {
    if (error instanceof FCLControlRequestError) throw new FCLActionSpecificApprovalError(`request receipt invalid: ${error.message}`);
    throw error;
  }
  try { validateBoundActionPermit(input.core_action_permit, input.core_action_permit_binding_input); }
  catch(error) {
    if (error instanceof FCLCoreActionPermitBindingError) throw new FCLActionSpecificApprovalError(`ActionPermit invalid: ${error.message}`);
    throw error;
  }

  const request=input.user_control_request_receipt;
  const permit=input.core_action_permit;
  const permitInput=input.core_action_permit_binding_input;
  const fcl=permitInput.core_coordination_binding_input.fcl_authority_evaluation;

  req(request.request_id === fcl.request_id, 'request_id mismatch between request and permit context');
  req(request.requested_control === fcl.requested_control, 'requested_control mismatch between request and permit context');
  req(request.source_run_id === fcl.current_run_id, 'run_id mismatch between request and permit context');
  req(request.source_run_epoch === fcl.current_run_epoch, 'run_epoch mismatch between request and permit context');
  req(request.source_chain_id === fcl.current_chain_id, 'chain_id mismatch between request and permit context');
  req(request.intent_ref === fcl.intent_ref, 'intent_ref mismatch between request and permit context');
  req(permit.payload.requested_control === request.requested_control, 'ActionPermit requested_control mismatch');
  req(permit.payload.fcl_execution_context.run_id === request.source_run_id, 'ActionPermit run_id mismatch');
  req(permit.payload.fcl_execution_context.run_epoch === request.source_run_epoch, 'ActionPermit run_epoch mismatch');
  req(permit.payload.fcl_execution_context.chain_id === request.source_chain_id, 'ActionPermit chain_id mismatch');
  req(permit.payload.fcl_execution_context.intent_ref === request.intent_ref, 'ActionPermit intent_ref mismatch');
  req(permit.payload.one_shot === true, 'ActionPermit must remain one_shot');
  req(permit.payload.consumed === false, 'ActionPermit must remain unconsumed before approval');
  req(permit.payload.execute_revalidation_required === true, 'ActionPermit must require execute revalidation');
  return {request,permit,permitInput,fcl};
}

function buildApprovalBinding(input) {
  const {permit}=validatePermitAndRequest(input);
  const target=permit.payload.target;
  const binding={
    approval_id:input.approval_id,
    kind:'action_specific',
    scope_bound:true,
    subject_id:permit.subject.id,
    operation:target.operation,
    action_scope:`${target.operation}:${target.resource}`,
    authority_scope:target.authority_scope,
    target_binding_hash:permit.payload.target_binding_hash,
    issued_at:input.issued_at,
    valid_until:input.valid_until,
    one_shot:true,
    content_hash:''
  };
  binding.content_hash=sha256Object(binding);
  return binding;
}

function validateApprovalBinding(binding,input) {
  const {permit}=validatePermitAndRequest(input);
  exact(binding,APPROVAL_BINDING_KEYS,'approval_binding');
  str(binding.approval_id,'approval_binding.approval_id',ID);
  req(binding.approval_id===input.approval_id,'approval_binding.approval_id mismatch');
  req(binding.kind==='action_specific','approval_binding.kind must be action_specific');
  req(binding.scope_bound===true,'approval_binding.scope_bound must be true');
  req(binding.subject_id===permit.subject.id,'approval_binding.subject_id mismatch');
  req(binding.operation===permit.payload.target.operation,'approval_binding.operation mismatch');
  req(binding.action_scope===`${permit.payload.target.operation}:${permit.payload.target.resource}`,'approval_binding.action_scope mismatch');
  req(binding.authority_scope===permit.payload.target.authority_scope,'approval_binding.authority_scope mismatch');
  req(binding.target_binding_hash===permit.payload.target_binding_hash,'approval_binding.target_binding_hash mismatch');
  req(binding.issued_at===input.issued_at,'approval_binding.issued_at mismatch');
  req(binding.valid_until===input.valid_until,'approval_binding.valid_until mismatch');
  req(binding.one_shot===true,'approval_binding.one_shot must be true');
  str(binding.content_hash,'approval_binding.content_hash',HASH);
  req(binding.content_hash===sha256Object(binding),'approval_binding content hash mismatch');
  return true;
}

function validateInput(input) {
  exact(input,INPUT_KEYS,'input');
  req(input.protocol==='FCL' && input.version==='0.1' && input.profile==='action-specific-approval-v0.1','input header mismatch');
  str(input.approval_id,'input.approval_id',ID);
  exact(input.origin,['repository','revision','tree'],'input.origin');
  req(input.origin.repository==='Matawaka/uu-aap','input.origin.repository mismatch');
  str(input.origin.revision,'input.origin.revision',SHA40);
  str(input.origin.tree,'input.origin.tree',SHA40);

  const {request,permit,permitInput}=validatePermitAndRequest(input);
  const coordination=permitInput.core_coordination_receipt;

  exact(input.approval_event,APPROVAL_EVENT_KEYS,'input.approval_event');
  str(input.approval_event.event_id,'input.approval_event.event_id',ID);
  req(HUMAN_EVENT_KINDS.includes(input.approval_event.event_kind),'approval event is not explicit human activation');
  str(input.approval_event.target_action_permit_hash,'input.approval_event.target_action_permit_hash',HASH);
  str(input.approval_event.target_coordination_receipt_hash,'input.approval_event.target_coordination_receipt_hash',HASH);
  str(input.approval_event.target_binding_hash,'input.approval_event.target_binding_hash',HASH);
  req(input.approval_event.human_initiated===true,'approval event must be human_initiated');
  req(input.approval_event.passive_observation===false,'passive observation cannot create approval');
  req(input.approval_event.event_id!==request.human_event_id,'original request event cannot be reused as approval event');
  req(input.approval_event.target_action_permit_hash===permit.content_hash,'approval event ActionPermit hash mismatch');
  req(input.approval_event.target_coordination_receipt_hash===coordination.content_hash,'approval event CoordinationReceipt hash mismatch');
  req(input.approval_event.target_binding_hash===permit.payload.target_binding_hash,'approval event target binding hash mismatch');

  const requestedAt=instant(request.requested_at,'request.requested_at');
  const coordinationAt=instant(coordination.issued_at,'coordination.issued_at');
  const permitAt=instant(permit.issued_at,'ActionPermit.issued_at');
  const eventAt=instant(input.approval_event.occurred_at,'approval_event.occurred_at');
  const issuedAt=instant(input.issued_at,'input.issued_at');
  const validUntil=instant(input.valid_until,'input.valid_until');
  const permitExpiry=instant(permit.payload.expires_at,'ActionPermit.payload.expires_at');
  const availabilityExpiry=instant(permit.payload.availability_valid_until,'ActionPermit.payload.availability_valid_until');

  req(requestedAt<=coordinationAt,'CoordinationReceipt cannot precede user request');
  req(coordinationAt<=permitAt,'ActionPermit cannot precede CoordinationReceipt');
  req(permitAt<=eventAt,'approval event cannot precede ActionPermit materialization');
  req(eventAt<=issuedAt,'approval receipt issued_at cannot precede approval event');
  req(issuedAt<validUntil,'approval valid_until must be after issued_at');
  req(validUntil<=permitExpiry,'approval validity exceeds ActionPermit expiry');
  req(validUntil<=availabilityExpiry,'approval validity exceeds availability horizon');
  req(issuedAt<permitExpiry,'approval issued after ActionPermit expiry');
  req(issuedAt<availabilityExpiry,'approval issued after availability expiry');
  return true;
}

function buildApprovalReceipt(input) {
  validateInput(input);
  const {request,permit,permitInput}=validatePermitAndRequest(input);
  const coordination=permitInput.core_coordination_receipt;
  const binding=buildApprovalBinding(input);
  const receipt={
    protocol:'FCL',
    version:'0.1',
    receipt_type:'FCLActionSpecificApprovalReceipt',
    approval_id:input.approval_id,
    request_id:request.request_id,
    requested_control:request.requested_control,
    request_fingerprint:request.fingerprint_sha256,
    core_action_permit_hash:permit.content_hash,
    core_coordination_receipt_hash:coordination.content_hash,
    target_binding_hash:permit.payload.target_binding_hash,
    source_run_id:request.source_run_id,
    source_run_epoch:request.source_run_epoch,
    source_chain_id:request.source_chain_id,
    intent_ref:request.intent_ref,
    approval_event_id:input.approval_event.event_id,
    approval_event_kind:input.approval_event.event_kind,
    approval_event_occurred_at:input.approval_event.occurred_at,
    approval_binding:binding,
    explicit_approval_recorded:true,
    permit_preexisted_approval:true,
    permit_unconsumed_at_approval:true,
    approval_required_before_authorize:true,
    request_reinterpreted_as_approval:false,
    authority_created:false,
    authority_expanded:false,
    coordination_created:false,
    action_permit_created:false,
    action_permit_consumed:false,
    execution_authorized:false,
    execution_admitted:false,
    pre_action_bundle_created:false,
    lifecycle_authorize_admitted:false,
    lifecycle_execute_ready:false,
    interrupt_completed:false,
    continuation_receipt_created:false,
    successor_run_created:false,
    runtime_state_transitioned:false,
    approval_reusable:false,
    approval_generalized:false,
    future_action_permission_created:false,
    general_authority_created:false,
    legal_authority_established:false,
    universal_authority_established:false,
    legal_effect_established:false,
    truth_certified:false,
    causality_proven:false,
    liability_established:false,
    private_reasoning_included:false,
    next_safe_action:'ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE',
    issued_at:input.issued_at,
    fingerprint_sha256:''
  };
  receipt.fingerprint_sha256=receiptFingerprint(receipt);
  return receipt;
}

function validateApprovalReceipt(receipt,input) {
  validateInput(input);
  exact(receipt,RECEIPT_KEYS,'receipt');
  req(receipt.protocol==='FCL' && receipt.version==='0.1' && receipt.receipt_type==='FCLActionSpecificApprovalReceipt','receipt header mismatch');
  const {request,permit,permitInput}=validatePermitAndRequest(input);
  const coordination=permitInput.core_coordination_receipt;
  req(receipt.approval_id===input.approval_id,'receipt approval_id mismatch');
  req(receipt.request_id===request.request_id,'receipt request_id mismatch');
  req(receipt.requested_control===request.requested_control,'receipt requested_control mismatch');
  req(receipt.request_fingerprint===request.fingerprint_sha256,'receipt request fingerprint mismatch');
  req(receipt.core_action_permit_hash===permit.content_hash,'receipt ActionPermit hash mismatch');
  req(receipt.core_coordination_receipt_hash===coordination.content_hash,'receipt CoordinationReceipt hash mismatch');
  req(receipt.target_binding_hash===permit.payload.target_binding_hash,'receipt target binding hash mismatch');
  req(receipt.source_run_id===request.source_run_id,'receipt run_id mismatch');
  req(receipt.source_run_epoch===request.source_run_epoch,'receipt run_epoch mismatch');
  req(receipt.source_chain_id===request.source_chain_id,'receipt chain_id mismatch');
  req(receipt.intent_ref===request.intent_ref,'receipt intent_ref mismatch');
  req(receipt.approval_event_id===input.approval_event.event_id,'receipt approval_event_id mismatch');
  req(receipt.approval_event_kind===input.approval_event.event_kind,'receipt approval_event_kind mismatch');
  req(receipt.approval_event_occurred_at===input.approval_event.occurred_at,'receipt approval_event_occurred_at mismatch');
  validateApprovalBinding(receipt.approval_binding,input);
  req(receipt.explicit_approval_recorded===true,'receipt must record explicit approval');
  req(receipt.permit_preexisted_approval===true,'receipt must state permit preexisted approval');
  req(receipt.permit_unconsumed_at_approval===true,'receipt must state permit unconsumed at approval');
  req(receipt.approval_required_before_authorize===true,'receipt must preserve approval-before-authorize boundary');
  FIXED_FALSE_KEYS.forEach(key=>req(receipt[key]===false,`receipt.${key} must remain false`));
  req(receipt.next_safe_action==='ASSEMBLE_PRE_ACTION_EVIDENCE_BUNDLE','receipt next_safe_action mismatch');
  req(receipt.issued_at===input.issued_at,'receipt issued_at mismatch');
  str(receipt.fingerprint_sha256,'receipt.fingerprint_sha256',HASH);
  req(receipt.fingerprint_sha256===receiptFingerprint(receipt),'receipt fingerprint mismatch');
  return true;
}

function read(inputPath) {
  req(typeof inputPath==='string' && inputPath.length>0,'input path required');
  const text=inputPath==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(path.resolve(inputPath),'utf8');
  try{return JSON.parse(text);}catch(error){throw new FCLActionSpecificApprovalError(`invalid JSON: ${error.message}`);}
}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
function main(args){
  const [command,inputPath,...extra]=args;
  if(!command || ['help','--help','-h'].includes(command)){
    req(!inputPath && extra.length===0,'help accepts no extra arguments');
    process.stdout.write('FCL Action-Specific Approval v0.1 no-effect CLI\nUsage: action-specific-approval.js validate|receipt <input.json|->\nApproval records a distinct human approval event for one existing ActionPermit.\nNo permit/consume/execute/interrupt/resume/send/switch/activate/create-successor/grant command exists.\n');
    return 0;
  }
  req(extra.length===0,'unexpected extra arguments');
  req(['validate','receipt'].includes(command),`unsupported command: ${command}`);
  req(inputPath!==undefined,`${command} requires input path`);
  const input=read(inputPath);
  if(command==='validate'){
    validateInput(input);
    print({protocol:'FCL',version:'0.1',profile:'action-specific-approval-v0.1',status:'VALID',approval_recorded:false,permit_consumed:false,authorize_admitted:false,execution_admitted:false});
    return 0;
  }
  const receipt=buildApprovalReceipt(input);
  validateApprovalReceipt(receipt,input);
  print(receipt);
  return 0;
}
if(require.main===module){
  try{process.exitCode=main(process.argv.slice(2));}
  catch(error){
    if(error instanceof FCLActionSpecificApprovalError){process.stderr.write(`FCL Action-Specific Approval validation error: ${error.message}\n`);process.exitCode=1;}
    else throw error;
  }
}

module.exports={
  FCLActionSpecificApprovalError,
  APPROVAL_BINDING_KEYS,
  buildApprovalBinding,
  buildApprovalReceipt,
  receiptFingerprint,
  sha256Object,
  validateApprovalBinding,
  validateApprovalReceipt,
  validateInput
};
