'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { FCLRequestEvaluationError, validateEvaluationReceipt } = require('../request-evaluation/request-evaluation.js');
const AuthorityCore = require('../../../../proposals/poai/authority/tools/authority-core.js');

class FCLAuthorityEvaluationError extends Error {
  constructor(message) { super(message); this.name = 'FCLAuthorityEvaluationError'; }
}
const req = (condition, message) => { if (!condition) throw new FCLAuthorityEvaluationError(message); };
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const canon = value => Array.isArray(value) ? value.map(canon) : (obj(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canon(value[key])])) : value);
const hash = value => `sha256:${crypto.createHash('sha256').update(JSON.stringify(canon(value)), 'utf8').digest('hex')}`;
const fingerprint = value => { const copy = clone(value); copy.fingerprint_sha256 = ''; return hash(copy); };
const exact = (value, keys, label) => { req(obj(value), `${label} must be object`); req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} keys mismatch`); };
const allowedRequired = (value, allowed, required, label) => { req(obj(value), `${label} must be object`); for (const key of Object.keys(value)) req(allowed.includes(key), `${label} unsupported key ${key}`); for (const key of required) req(Object.prototype.hasOwnProperty.call(value, key), `${label} missing ${key}`); };
const str = (value, label, pattern = null) => { req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`); if (pattern) req(pattern.test(value), `${label} invalid format`); };
const integer = (value, label, min = 0) => req(Number.isInteger(value) && value >= min, `${label} must be integer >= ${min}`);
const instant = (value, label) => { str(value, label); const n = Date.parse(value); req(Number.isFinite(n), `${label} invalid date-time`); return n; };
const actorEq = (a, b) => Boolean(a && b && a.id === b.id && a.key_ref === b.key_ref);

const ID = /^[a-z][a-z0-9-]{2,95}$/;
const SHA = /^[0-9a-f]{40}$/;
const FP = /^sha256:[0-9a-f]{64}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const INTERRUPT_SCOPE = 'fcl.run.interrupt';
const SUCCESSOR_SCOPE = 'fcl.run.successor.create';
const CLASSIFICATIONS = [
  'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED', 'REQUEST_NOT_CURRENT', 'AUTHORITY_NOT_ESTABLISHED',
  'AUTHORITY_SCOPE_MISMATCH', 'AUTHORITY_TARGET_MISMATCH', 'AUTHORITY_SUBJECT_MISMATCH',
  'AUTHORITY_EVIDENCE_TOO_OLD', 'AUTHORITY_EVIDENCE_TIME_INVALID'
];
const CLAIM_KEYS = [
  'root_declared','root_evidence_observed','root_accepted_by_policy','issuer_entitlement_chain_valid',
  'materialization_authority_established','policy_control_authority_established','legal_identity_verified',
  'legal_authority_established','universal_authority_established','universal_canonicality_established',
  'truth_certified','causal_proof_certified','legal_responsibility_determined','moral_correctness_established',
  'legal_effect_established','poai_v_conformance_established'
];
const POAI_REQUIRED = ['artifact_type','artifact_version','verification_id','verified_at','policy','root','grant_path','subject','required_scope','target','status','checks','claims'];
const POAI_ALLOWED = [...POAI_REQUIRED, 'errors'];
const INPUT_KEYS = ['protocol','version','profile','authority_evaluation_id','origin','current_state_request_evaluation','effect_actor_subject','authority_verification_result','evaluated_at'];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','authority_evaluation_id','request_evaluation_id','request_evaluation_fingerprint',
  'request_id','requested_control','current_run_id','current_run_epoch','current_chain_id','intent_ref','effect_actor_subject',
  'required_scope','required_target','poai_verification_id','poai_authority_result_binding_sha256','poai_verified_at',
  'poai_verification_required_scope','poai_verification_target','classification','request_current','poai_authority_result_valid',
  'poai_status_established','issuer_entitlement_chain_valid','root_accepted_by_policy','scope_match','target_match','subject_match',
  'authority_evidence_fresh','preexisting_request_scoped_authority_observed','forwardable_to_core_authority_adapter',
  'authority_granted_by_evaluator','authority_expanded_by_evaluator','core_authority_receipt_created','request_effect_authorized',
  'action_permit_established','execution_admitted','interrupt_completed','continuation_receipt_created','successor_run_created',
  'runtime_state_transitioned','progress_created','liveness_proven','legal_identity_verified','legal_authority_established',
  'universal_authority_established','legal_effect_established','truth_certified','causal_proof_certified',
  'legal_responsibility_determined','liability_established','private_reasoning_included','next_safe_action','evaluated_at','fingerprint_sha256'
];

function actor(value, label) { exact(value, ['id','key_ref'], label); str(value.id, `${label}.id`); str(value.key_ref, `${label}.key_ref`); }
function digest(value, label) {
  exact(value, ['canonicalization','digest_algorithm','digest_encoding','value'], label);
  req(value.canonicalization === 'RFC8785-JCS', `${label}.canonicalization mismatch`);
  req(value.digest_algorithm === 'SHA-256', `${label}.digest_algorithm mismatch`);
  req(value.digest_encoding === 'hex', `${label}.digest_encoding mismatch`);
  str(value.value, `${label}.value`, HEX64);
}
function requiredScopeForControl(control) {
  if (control === 'REQUEST_INTERRUPT') return INTERRUPT_SCOPE;
  if (control === 'REQUEST_SUCCESSOR') return SUCCESSOR_SCOPE;
  throw new FCLAuthorityEvaluationError(`unsupported requested_control: ${control}`);
}
function requiredTargetForEvaluation(evaluation) {
  return `urn:uu-aap:fcl:run:${evaluation.current_run_id}:epoch:${evaluation.current_run_epoch}`;
}
function validatePoAIAuthorityResult(result) {
  allowedRequired(result, POAI_ALLOWED, POAI_REQUIRED, 'authority_verification_result');
  req(result.artifact_type === 'PoAIAuthorityVerificationResult', 'authority result artifact_type mismatch');
  req(result.artifact_version === '0.1-experimental', 'authority result artifact_version mismatch');
  str(result.verification_id, 'authority result verification_id', /^urn:poai:authority-verification:/);
  instant(result.verified_at, 'authority result verified_at');
  exact(result.policy, ['policy_id','policy_version','digest'], 'authority result policy');
  str(result.policy.policy_id, 'authority result policy.policy_id'); integer(result.policy.policy_version, 'authority result policy.policy_version', 1); digest(result.policy.digest, 'authority result policy.digest');
  exact(result.root, ['root_id','root_version','digest'], 'authority result root');
  str(result.root.root_id, 'authority result root.root_id'); integer(result.root.root_version, 'authority result root.root_version', 1); digest(result.root.digest, 'authority result root.digest');
  req(Array.isArray(result.grant_path) && result.grant_path.length > 0, 'authority result grant_path must be non-empty'); result.grant_path.forEach((v,i)=>str(v,`authority result grant_path[${i}]`));
  actor(result.subject, 'authority result subject'); str(result.required_scope, 'authority result required_scope'); str(result.target, 'authority result target');
  req(['established','not_established'].includes(result.status), 'authority result status invalid');
  req(obj(result.checks) && Object.keys(result.checks).length > 0, 'authority result checks must be non-empty'); for (const [k,v] of Object.entries(result.checks)) { str(k, 'authority result check key'); req(typeof v === 'boolean', `authority result checks.${k} must be boolean`); }
  exact(result.claims, CLAIM_KEYS, 'authority result claims');
  for (const key of ['root_declared','root_evidence_observed','root_accepted_by_policy','issuer_entitlement_chain_valid','materialization_authority_established','policy_control_authority_established']) req(typeof result.claims[key] === 'boolean', `authority result claims.${key} must be boolean`);
  for (const key of ['legal_identity_verified','legal_authority_established','universal_authority_established','universal_canonicality_established','truth_certified','causal_proof_certified','legal_responsibility_determined','moral_correctness_established','legal_effect_established','poai_v_conformance_established']) req(result.claims[key] === false, `authority result claims.${key} must remain false`);
  if (Object.prototype.hasOwnProperty.call(result,'errors')) { req(Array.isArray(result.errors), 'authority result errors must be array'); result.errors.forEach((v,i)=>str(v,`authority result errors[${i}]`)); }
  const coreErrors = AuthorityCore.validateVerificationResult(result); req(coreErrors.length === 0, `PoAI authority verification assurance boundary failed: ${coreErrors.join(', ')}`);
  req(result.claims.issuer_entitlement_chain_valid === (result.status === 'established'), 'authority result status must match issuer_entitlement_chain_valid');
  if (result.status === 'established' && Object.prototype.hasOwnProperty.call(result,'errors')) req(result.errors.length === 0, 'established authority result must not contain errors');
  if ([INTERRUPT_SCOPE,SUCCESSOR_SCOPE].includes(result.required_scope)) {
    req(result.claims.materialization_authority_established === false, 'FCL scope cannot claim materialization_authority_established');
    req(result.claims.policy_control_authority_established === false, 'FCL scope cannot claim policy_control_authority_established');
  }
  return true;
}
function validateCurrentStateEvaluation(receipt) {
  try { validateEvaluationReceipt(receipt); }
  catch (error) { if (error instanceof FCLRequestEvaluationError) throw new FCLAuthorityEvaluationError(`current_state_request_evaluation invalid: ${error.message}`); throw error; }
  return true;
}
function validateInput(input) {
  exact(input, INPUT_KEYS, 'input'); req(input.protocol === 'FCL' && input.version === '0.1' && input.profile === 'authority-evaluation-v0.1', 'input header mismatch');
  str(input.authority_evaluation_id, 'input.authority_evaluation_id', ID);
  exact(input.origin, ['repository','revision','tree'], 'input.origin'); req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch'); str(input.origin.revision, 'input.origin.revision', SHA); str(input.origin.tree, 'input.origin.tree', SHA);
  validateCurrentStateEvaluation(input.current_state_request_evaluation); actor(input.effect_actor_subject, 'input.effect_actor_subject'); validatePoAIAuthorityResult(input.authority_verification_result);
  req(instant(input.evaluated_at,'input.evaluated_at') >= instant(input.current_state_request_evaluation.evaluated_at,'current state evaluation evaluated_at'), 'authority evaluated_at cannot precede current-state request evaluation');
  return true;
}
function classify(input) {
  validateInput(input); const e=input.current_state_request_evaluation,r=input.authority_verification_result;
  const current=e.classification==='CURRENT_EQUIVALENT_STATE'&&e.current_state_revalidated===true&&e.forwardable_to_authority_gate===true&&e.authority_evaluation_required===true&&e.next_safe_action==='EVALUATE_AUTHORITY_FOR_REQUEST';
  if(!current)return 'REQUEST_NOT_CURRENT';
  if(r.required_scope!==requiredScopeForControl(e.requested_control))return 'AUTHORITY_SCOPE_MISMATCH';
  if(r.target!==requiredTargetForEvaluation(e))return 'AUTHORITY_TARGET_MISMATCH';
  if(!actorEq(r.subject,input.effect_actor_subject))return 'AUTHORITY_SUBJECT_MISMATCH';
  const rv=instant(r.verified_at,'authority result verified_at'),ce=instant(e.evaluated_at,'current state evaluation evaluated_at'),ae=instant(input.evaluated_at,'input.evaluated_at');
  if(rv<ce)return 'AUTHORITY_EVIDENCE_TOO_OLD'; if(rv>ae)return 'AUTHORITY_EVIDENCE_TIME_INVALID';
  if(r.status!=='established'||r.claims.issuer_entitlement_chain_valid!==true||r.claims.root_accepted_by_policy!==true)return 'AUTHORITY_NOT_ESTABLISHED';
  return 'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED';
}
function buildAuthorityEvaluationReceipt(input) {
  validateInput(input); const e=input.current_state_request_evaluation,r=input.authority_verification_result;
  const requiredScope=requiredScopeForControl(e.requested_control),requiredTarget=requiredTargetForEvaluation(e),classification=classify(input);
  const requestCurrent=e.classification==='CURRENT_EQUIVALENT_STATE'&&e.forwardable_to_authority_gate===true&&e.authority_evaluation_required===true;
  const scopeMatch=r.required_scope===requiredScope,targetMatch=r.target===requiredTarget,subjectMatch=actorEq(r.subject,input.effect_actor_subject);
  const authorityEvidenceFresh=instant(r.verified_at,'authority result verified_at')>=instant(e.evaluated_at,'request evaluation evaluated_at')&&instant(r.verified_at,'authority result verified_at')<=instant(input.evaluated_at,'authority evaluated_at');
  const positive=classification==='PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED'; let next='OBTAIN_MATCHING_AUTHORITY_EVIDENCE';
  if(positive)next='BIND_CORE_AUTHORITY_RECEIPT'; else if(classification==='REQUEST_NOT_CURRENT')next='DO_NOT_FORWARD_STALE_REQUEST'; else if(['AUTHORITY_EVIDENCE_TOO_OLD','AUTHORITY_EVIDENCE_TIME_INVALID'].includes(classification))next='REVERIFY_AUTHORITY';
  const out={protocol:'FCL',version:'0.1',receipt_type:'FCLAuthorityEvaluationReceipt',authority_evaluation_id:input.authority_evaluation_id,request_evaluation_id:e.evaluation_id,request_evaluation_fingerprint:e.fingerprint_sha256,request_id:e.request_id,requested_control:e.requested_control,current_run_id:e.current_run_id,current_run_epoch:e.current_run_epoch,current_chain_id:e.current_chain_id,intent_ref:e.current_intent_ref,effect_actor_subject:clone(input.effect_actor_subject),required_scope:requiredScope,required_target:requiredTarget,poai_verification_id:r.verification_id,poai_authority_result_binding_sha256:hash(r),poai_verified_at:r.verified_at,poai_verification_required_scope:r.required_scope,poai_verification_target:r.target,classification,request_current:requestCurrent,poai_authority_result_valid:true,poai_status_established:r.status==='established',issuer_entitlement_chain_valid:r.claims.issuer_entitlement_chain_valid,root_accepted_by_policy:r.claims.root_accepted_by_policy,scope_match:scopeMatch,target_match:targetMatch,subject_match:subjectMatch,authority_evidence_fresh:authorityEvidenceFresh,preexisting_request_scoped_authority_observed:positive,forwardable_to_core_authority_adapter:positive,authority_granted_by_evaluator:false,authority_expanded_by_evaluator:false,core_authority_receipt_created:false,request_effect_authorized:false,action_permit_established:false,execution_admitted:false,interrupt_completed:false,continuation_receipt_created:false,successor_run_created:false,runtime_state_transitioned:false,progress_created:false,liveness_proven:false,legal_identity_verified:false,legal_authority_established:false,universal_authority_established:false,legal_effect_established:false,truth_certified:false,causal_proof_certified:false,legal_responsibility_determined:false,liability_established:false,private_reasoning_included:false,next_safe_action:next,evaluated_at:input.evaluated_at,fingerprint_sha256:''}; out.fingerprint_sha256=fingerprint(out); return out;
}
function validateAuthorityEvaluationReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt'); req(receipt.protocol==='FCL'&&receipt.version==='0.1'&&receipt.receipt_type==='FCLAuthorityEvaluationReceipt','receipt header mismatch');
  str(receipt.authority_evaluation_id,'receipt.authority_evaluation_id',ID);str(receipt.request_evaluation_id,'receipt.request_evaluation_id',ID);str(receipt.request_evaluation_fingerprint,'receipt.request_evaluation_fingerprint',FP);str(receipt.request_id,'receipt.request_id',ID);
  req(['REQUEST_INTERRUPT','REQUEST_SUCCESSOR'].includes(receipt.requested_control),'receipt requested_control invalid');str(receipt.current_run_id,'receipt.current_run_id',ID);integer(receipt.current_run_epoch,'receipt.current_run_epoch');str(receipt.current_chain_id,'receipt.current_chain_id',ID);str(receipt.intent_ref,'receipt.intent_ref');actor(receipt.effect_actor_subject,'receipt.effect_actor_subject');
  req([INTERRUPT_SCOPE,SUCCESSOR_SCOPE].includes(receipt.required_scope),'receipt required_scope invalid');str(receipt.required_target,'receipt.required_target');str(receipt.poai_verification_id,'receipt.poai_verification_id',/^urn:poai:authority-verification:/);str(receipt.poai_authority_result_binding_sha256,'receipt.poai_authority_result_binding_sha256',FP);instant(receipt.poai_verified_at,'receipt.poai_verified_at');str(receipt.poai_verification_required_scope,'receipt.poai_verification_required_scope');str(receipt.poai_verification_target,'receipt.poai_verification_target');req(CLASSIFICATIONS.includes(receipt.classification),'receipt classification invalid');
  for(const key of ['request_current','poai_authority_result_valid','poai_status_established','issuer_entitlement_chain_valid','root_accepted_by_policy','scope_match','target_match','subject_match','authority_evidence_fresh','preexisting_request_scoped_authority_observed','forwardable_to_core_authority_adapter'])req(typeof receipt[key]==='boolean',`receipt.${key} must be boolean`);
  req(receipt.poai_authority_result_valid===true,'receipt must bind valid PoAI authority result'); const positive=receipt.classification==='PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED'; req(receipt.preexisting_request_scoped_authority_observed===positive,'receipt scoped authority observation inconsistent'); req(receipt.forwardable_to_core_authority_adapter===positive,'receipt forwarding inconsistent');
  if(positive){for(const key of ['request_current','poai_status_established','issuer_entitlement_chain_valid','root_accepted_by_policy','scope_match','target_match','subject_match','authority_evidence_fresh'])req(receipt[key]===true,`positive receipt requires ${key}=true`);req(receipt.next_safe_action==='BIND_CORE_AUTHORITY_RECEIPT','positive next_safe_action mismatch');}
  else if(receipt.classification==='REQUEST_NOT_CURRENT')req(receipt.next_safe_action==='DO_NOT_FORWARD_STALE_REQUEST','stale next_safe_action mismatch');
  else if(['AUTHORITY_EVIDENCE_TOO_OLD','AUTHORITY_EVIDENCE_TIME_INVALID'].includes(receipt.classification))req(receipt.next_safe_action==='REVERIFY_AUTHORITY','temporal next_safe_action mismatch');
  else req(receipt.next_safe_action==='OBTAIN_MATCHING_AUTHORITY_EVIDENCE','authority mismatch next_safe_action mismatch');
  for(const key of ['authority_granted_by_evaluator','authority_expanded_by_evaluator','core_authority_receipt_created','request_effect_authorized','action_permit_established','execution_admitted','interrupt_completed','continuation_receipt_created','successor_run_created','runtime_state_transitioned','progress_created','liveness_proven','legal_identity_verified','legal_authority_established','universal_authority_established','legal_effect_established','truth_certified','causal_proof_certified','legal_responsibility_determined','liability_established','private_reasoning_included'])req(receipt[key]===false,`receipt.${key} must remain false`);
  req(['BIND_CORE_AUTHORITY_RECEIPT','DO_NOT_FORWARD_STALE_REQUEST','OBTAIN_MATCHING_AUTHORITY_EVIDENCE','REVERIFY_AUTHORITY'].includes(receipt.next_safe_action),'receipt next_safe_action invalid');instant(receipt.evaluated_at,'receipt.evaluated_at');str(receipt.fingerprint_sha256,'receipt.fingerprint_sha256',FP);req(receipt.fingerprint_sha256===fingerprint(receipt),'receipt fingerprint mismatch');return true;
}
function read(inputPath){req(typeof inputPath==='string'&&inputPath.length>0,'input path required');const text=inputPath==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(path.resolve(inputPath),'utf8');try{return JSON.parse(text);}catch(error){throw new FCLAuthorityEvaluationError(`invalid JSON: ${error.message}`);}}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
function main(args){const[command,inputPath,...extra]=args;if(!command||['help','--help','-h'].includes(command)){req(!inputPath&&extra.length===0,'help accepts no extra arguments');process.stdout.write('FCL Authority Evaluation v0.1 read-only CLI\nUsage: authority-evaluation.js validate|evaluate <input.json|->\nNo grant/permit/interrupt/execute/resume/send/switch/activate/create-successor command exists.\n');return 0;}req(extra.length===0,'unexpected extra arguments');req(['validate','evaluate'].includes(command),`unsupported command: ${command}`);req(inputPath!==undefined,`${command} requires input path`);const input=read(inputPath);if(command==='validate'){validateInput(input);print({protocol:'FCL',version:'0.1',profile:'authority-evaluation-v0.1',status:'VALID',authority_evaluation_id:input.authority_evaluation_id,authority_granted_by_evaluator:false,core_authority_receipt_created:false,action_permit_established:false,execution_admitted:false});return 0;}const receipt=buildAuthorityEvaluationReceipt(input);validateAuthorityEvaluationReceipt(receipt);print(receipt);return 0;}
if(require.main===module){try{process.exitCode=main(process.argv.slice(2));}catch(error){if(error instanceof FCLAuthorityEvaluationError){process.stderr.write(`FCL Authority Evaluation validation error: ${error.message}\n`);process.exitCode=1;}else throw error;}}
module.exports={FCLAuthorityEvaluationError,INTERRUPT_SCOPE,SUCCESSOR_SCOPE,buildAuthorityEvaluationReceipt,canonicalFingerprint:fingerprint,canonicalHash:hash,classify,requiredScopeForControl,requiredTargetForEvaluation,validateAuthorityEvaluationReceipt,validateInput,validatePoAIAuthorityResult};
