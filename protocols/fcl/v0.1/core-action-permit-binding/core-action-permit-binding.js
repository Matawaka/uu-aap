'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  FCLCoreCoordinationBindingError,
  validateBoundCoordinationReceipt
} = require('../core-coordination-binding/core-coordination-binding.js');
const { coreContentHash } = require('../core-authority-binding/core-authority-binding.js');

class FCLCoreActionPermitBindingError extends Error {
  constructor(message) { super(message); this.name = 'FCLCoreActionPermitBindingError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLCoreActionPermitBindingError(message); };
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
const instant = (value, label) => {
  str(value, label);
  const n = Date.parse(value);
  req(Number.isFinite(n), `${label} invalid date-time`);
  return n;
};

const SHA40 = /^[0-9a-f]{40}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;
const ID = /^[a-z][a-z0-9-]{2,95}$/;
const INPUT_KEYS = ['protocol','version','profile','permit_id','origin','core_coordination_binding_input','core_coordination_receipt','issued_at','expires_at'];
const CORE_KEYS = ['protocol','version','receipt_type','subject','frontier','predecessor_receipt_hashes','assertions','non_effects','issuer','issued_at','payload','signature_profile','content_hash'];
const REQUIRED_NON_EFFECTS = {
  action_performed:false,
  outcome_observed:false,
  authority_expanded:false,
  liability_established:false,
  execution_admitted:false,
  permit_consumed:false,
  availability_extended:false,
  future_action_permission_created:false,
  general_authority_created:false,
  interrupt_completed:false,
  continuation_receipt_created:false,
  successor_run_created:false,
  runtime_state_transitioned:false,
  legal_authority_established:false,
  universal_authority_established:false,
  legal_effect_established:false,
  truth_certified:false,
  causality_proven:false,
  private_reasoning_included:false
};

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (obj(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new FCLCoreActionPermitBindingError(`unsupported canonical JSON value type: ${typeof value}`);
}
function hashObject(value) {
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(canonical(value), 'utf8')).digest('hex')}`;
}
function targetBindingFor(input) {
  const c = input.core_coordination_binding_input;
  const fcl = c.fcl_authority_evaluation;
  return {
    resource: fcl.required_target,
    operation: fcl.required_scope,
    expected_predecessor_frontier: c.core_state_receipt.frontier.revision,
    authority_scope: fcl.required_scope
  };
}
function targetBindingHash(input) { return hashObject(targetBindingFor(input)); }

function validateCoreEnvelope(receipt, label) {
  exact(receipt, CORE_KEYS, label);
  req(receipt.protocol === 'UU-AAP Core', `${label}.protocol mismatch`);
  req(receipt.version === '0.1', `${label}.version mismatch`);
  str(receipt.receipt_type, `${label}.receipt_type`);
  exact(receipt.subject, ['id','scope'], `${label}.subject`);
  str(receipt.subject.id, `${label}.subject.id`); str(receipt.subject.scope, `${label}.subject.scope`);
  exact(receipt.frontier, ['revision','observed_at'], `${label}.frontier`);
  str(receipt.frontier.revision, `${label}.frontier.revision`); instant(receipt.frontier.observed_at, `${label}.frontier.observed_at`);
  req(Array.isArray(receipt.predecessor_receipt_hashes), `${label}.predecessor_receipt_hashes must be array`);
  req(new Set(receipt.predecessor_receipt_hashes).size === receipt.predecessor_receipt_hashes.length, `${label}.predecessor_receipt_hashes duplicate`);
  receipt.predecessor_receipt_hashes.forEach((value, i) => str(value, `${label}.predecessor_receipt_hashes[${i}]`, HASH));
  req(obj(receipt.assertions) && Object.keys(receipt.assertions).length > 0, `${label}.assertions must be non-empty object`);
  req(obj(receipt.non_effects) && Object.keys(receipt.non_effects).length > 0, `${label}.non_effects must be non-empty object`);
  exact(receipt.issuer, ['id','assurance'], `${label}.issuer`);
  str(receipt.issuer.id, `${label}.issuer.id`); str(receipt.issuer.assurance, `${label}.issuer.assurance`);
  instant(receipt.issued_at, `${label}.issued_at`);
  req(obj(receipt.payload), `${label}.payload must be object`);
  req(obj(receipt.signature_profile), `${label}.signature_profile must be object`); str(receipt.signature_profile.mode, `${label}.signature_profile.mode`);
  str(receipt.content_hash, `${label}.content_hash`, HASH);
  req(receipt.content_hash === coreContentHash(receipt), `${label}.content hash mismatch`);
  return true;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1' && input.profile === 'core-action-permit-binding-v0.1', 'input header mismatch');
  str(input.permit_id, 'input.permit_id', ID);
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);
  try { validateBoundCoordinationReceipt(input.core_coordination_receipt, input.core_coordination_binding_input); }
  catch (error) {
    if (error instanceof FCLCoreCoordinationBindingError) throw new FCLCoreActionPermitBindingError(`coordination predecessor invalid: ${error.message}`);
    throw error;
  }
  const c = input.core_coordination_binding_input;
  const coordination = input.core_coordination_receipt;
  const availability = c.core_availability_claim;
  const issueAt = instant(input.issued_at, 'input.issued_at');
  const expiresAt = instant(input.expires_at, 'input.expires_at');
  const coordinationAt = instant(coordination.issued_at, 'core_coordination_receipt.issued_at');
  const validUntil = instant(availability.payload.valid_until, 'core_availability_claim.payload.valid_until');
  req(issueAt >= coordinationAt, 'ActionPermit issued before CoordinationReceipt');
  req(expiresAt > issueAt, 'ActionPermit expires_at must be after issued_at');
  req(issueAt <= validUntil, 'ActionPermit issued after availability expiry');
  req(expiresAt <= validUntil, 'ActionPermit expiry exceeds availability valid_until');
  req(coordination.payload.availability_valid_until === availability.payload.valid_until, 'coordination availability horizon mismatch');
  req(coordination.payload.availability_horizon_extended === false, 'coordination must not extend availability horizon');
  req(coordination.payload.action_gate_evaluated === false, 'coordination must precede Action Gate evaluation');
  return true;
}

function buildCoreActionPermit(input) {
  validateInput(input);
  const c = input.core_coordination_binding_input;
  const coordination = input.core_coordination_receipt;
  const state = c.core_state_receipt;
  const intent = c.core_intent_receipt;
  const authority = c.core_authority_receipt;
  const availability = c.core_availability_claim;
  const fcl = c.fcl_authority_evaluation;
  const target = targetBindingFor(input);
  const bindingHash = targetBindingHash(input);
  const receipt = {
    protocol:'UU-AAP Core',
    version:'0.1',
    receipt_type:'ActionPermit',
    subject:clone(state.subject),
    frontier:{ revision:state.frontier.revision, observed_at:input.issued_at },
    predecessor_receipt_hashes:[state.content_hash,intent.content_hash,authority.content_hash,coordination.content_hash],
    assertions:{
      action_permitted:true,
      action_scope:fcl.required_scope,
      target_binding_hash:bindingHash,
      one_shot:true,
      execute_revalidation_required:true
    },
    non_effects:clone(REQUIRED_NON_EFFECTS),
    issuer:{ id:'urn:uu-aap:fcl:core-action-permit-binding:v0.1', assurance:'fail_closed_bounded_action_gate' },
    issued_at:input.issued_at,
    payload:{
      profile:'fcl-core-action-permit-binding-v0.1',
      permit_id:input.permit_id,
      origin:clone(input.origin),
      gate:'fail_closed',
      expires_at:input.expires_at,
      one_shot:true,
      consumed:false,
      target_binding_hash:bindingHash,
      target:clone(target),
      requested_control:fcl.requested_control,
      fcl_execution_context:{ run_id:fcl.current_run_id, run_epoch:fcl.current_run_epoch, chain_id:fcl.current_chain_id, intent_ref:fcl.intent_ref },
      authority_scope:fcl.required_scope,
      availability_valid_until:availability.payload.valid_until,
      core_state_receipt_ref:state.content_hash,
      core_intent_receipt_ref:intent.content_hash,
      core_authority_receipt_ref:authority.content_hash,
      core_coordination_receipt_ref:coordination.content_hash,
      core_availability_claim_ref:availability.content_hash,
      coordination_binding_revalidated:true,
      execute_revalidation_required:true,
      pre_action_bundle_created:false,
      lifecycle_authorize_admitted:false,
      lifecycle_execute_ready:false
    },
    signature_profile:{ mode:'none', reason:'deterministic_action_gate_adapter_only' },
    content_hash:''
  };
  receipt.content_hash = coreContentHash(receipt);
  return receipt;
}

function validateBoundActionPermit(receipt, input) {
  validateInput(input);
  validateCoreEnvelope(receipt, 'core_action_permit');
  req(receipt.receipt_type === 'ActionPermit', 'core_action_permit must be ActionPermit');
  const c=input.core_coordination_binding_input, coordination=input.core_coordination_receipt;
  const state=c.core_state_receipt,intent=c.core_intent_receipt,authority=c.core_authority_receipt,availability=c.core_availability_claim,fcl=c.fcl_authority_evaluation;
  req(JSON.stringify(receipt.subject) === JSON.stringify(state.subject), 'ActionPermit subject substitution');
  req(receipt.frontier.revision === state.frontier.revision, 'ActionPermit frontier revision substitution');
  req(receipt.frontier.observed_at === input.issued_at, 'ActionPermit frontier.observed_at mismatch');
  const expectedPred=[state.content_hash,intent.content_hash,authority.content_hash,coordination.content_hash];
  req(JSON.stringify(receipt.predecessor_receipt_hashes) === JSON.stringify(expectedPred), 'ActionPermit predecessor substitution');
  const bindingHash=targetBindingHash(input);
  req(receipt.assertions.action_permitted === true, 'ActionPermit must assert action_permitted=true');
  req(receipt.assertions.action_scope === fcl.required_scope, 'ActionPermit action_scope mismatch');
  req(receipt.assertions.target_binding_hash === bindingHash, 'ActionPermit target_binding_hash mismatch');
  req(receipt.assertions.one_shot === true, 'ActionPermit assertion one_shot must be true');
  req(receipt.assertions.execute_revalidation_required === true, 'ActionPermit must require execute revalidation');
  for (const [key,value] of Object.entries(REQUIRED_NON_EFFECTS)) req(receipt.non_effects[key] === value, `core_action_permit.non_effects.${key} must be false`);
  req(receipt.issuer.id === 'urn:uu-aap:fcl:core-action-permit-binding:v0.1', 'ActionPermit issuer.id mismatch');
  req(receipt.issuer.assurance === 'fail_closed_bounded_action_gate', 'ActionPermit issuer.assurance mismatch');
  req(receipt.issued_at === input.issued_at, 'ActionPermit issued_at mismatch');
  const p=receipt.payload;
  req(p.profile === 'fcl-core-action-permit-binding-v0.1', 'ActionPermit payload.profile mismatch');
  req(p.permit_id === input.permit_id, 'ActionPermit permit_id mismatch');
  req(p.gate === 'fail_closed', 'ActionPermit gate must be fail_closed');
  req(p.expires_at === input.expires_at, 'ActionPermit expires_at mismatch');
  req(p.one_shot === true, 'ActionPermit one_shot must be true');
  req(p.consumed === false, 'ActionPermit must be unconsumed at creation');
  req(p.target_binding_hash === bindingHash, 'ActionPermit payload target_binding_hash mismatch');
  req(JSON.stringify(p.target) === JSON.stringify(targetBindingFor(input)), 'ActionPermit target substitution');
  req(p.requested_control === fcl.requested_control, 'ActionPermit requested_control mismatch');
  req(p.fcl_execution_context.run_id === fcl.current_run_id, 'ActionPermit run_id mismatch');
  req(p.fcl_execution_context.run_epoch === fcl.current_run_epoch, 'ActionPermit run_epoch mismatch');
  req(p.fcl_execution_context.chain_id === fcl.current_chain_id, 'ActionPermit chain_id mismatch');
  req(p.fcl_execution_context.intent_ref === fcl.intent_ref, 'ActionPermit intent_ref mismatch');
  req(p.authority_scope === fcl.required_scope, 'ActionPermit authority_scope mismatch');
  req(p.availability_valid_until === availability.payload.valid_until, 'ActionPermit availability horizon mismatch');
  req(p.core_state_receipt_ref === state.content_hash, 'ActionPermit StateReceipt ref mismatch');
  req(p.core_intent_receipt_ref === intent.content_hash, 'ActionPermit IntentReceipt ref mismatch');
  req(p.core_authority_receipt_ref === authority.content_hash, 'ActionPermit AuthorityReceipt ref mismatch');
  req(p.core_coordination_receipt_ref === coordination.content_hash, 'ActionPermit CoordinationReceipt ref mismatch');
  req(p.core_availability_claim_ref === availability.content_hash, 'ActionPermit AvailabilityClaim ref mismatch');
  req(p.coordination_binding_revalidated === true, 'ActionPermit must revalidate coordination binding');
  req(p.execute_revalidation_required === true, 'ActionPermit payload must require execute revalidation');
  req(p.pre_action_bundle_created === false, 'ActionPermit must not claim PreActionEvidenceBundle creation');
  req(p.lifecycle_authorize_admitted === false, 'ActionPermit must not claim authorize admission');
  req(p.lifecycle_execute_ready === false, 'ActionPermit must not claim execute readiness');
  return true;
}

function read(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text=inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8');
  try { return JSON.parse(text); } catch (error) { throw new FCLCoreActionPermitBindingError(`invalid JSON: ${error.message}`); }
}
function print(value) { process.stdout.write(`${JSON.stringify(value,null,2)}\n`); }
function main(args) {
  const [command,inputPath,...extra]=args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length===0, 'help accepts no extra arguments');
    process.stdout.write('FCL Core ActionPermit Binding v0.1 no-effect CLI\nUsage: core-action-permit-binding.js validate|materialize <input.json|->\nMaterialize emits a JSON Core ActionPermit only; it does not consume or execute it.\nNo execute/interrupt/resume/send/switch/activate/create-successor/consume command exists.\n');
    return 0;
  }
  req(extra.length===0,'unexpected extra arguments');
  req(['validate','materialize'].includes(command),`unsupported command: ${command}`);
  req(inputPath!==undefined,`${command} requires input path`);
  const input=read(inputPath);
  if(command==='validate') {
    validateInput(input);
    print({protocol:'FCL',version:'0.1',profile:'core-action-permit-binding-v0.1',status:'VALID',action_permit_materialized:false,permit_consumed:false,execution_admitted:false});
    return 0;
  }
  const receipt=buildCoreActionPermit(input);
  validateBoundActionPermit(receipt,input);
  print(receipt);
  return 0;
}
if(require.main===module) {
  try { process.exitCode=main(process.argv.slice(2)); }
  catch(error) {
    if(error instanceof FCLCoreActionPermitBindingError) { process.stderr.write(`FCL Core ActionPermit Binding validation error: ${error.message}\n`); process.exitCode=1; }
    else throw error;
  }
}

module.exports={
  FCLCoreActionPermitBindingError,
  REQUIRED_NON_EFFECTS,
  buildCoreActionPermit,
  canonical,
  hashObject,
  targetBindingFor,
  targetBindingHash,
  validateBoundActionPermit,
  validateInput
};
