'use strict';

const fs = require('fs');
const path = require('path');
const {
  FCLAuthorityEvaluationError,
  validateAuthorityEvaluationReceipt
} = require('../authority-evaluation/authority-evaluation.js');
const {
  FCLCoreAuthorityBindingError,
  coreContentHash,
  expectedFCLBinding,
  validateBoundAuthorityReceipt,
  validateCoreIntentReceipt
} = require('../core-authority-binding/core-authority-binding.js');

class FCLCoreCoordinationBindingError extends Error {
  constructor(message) { super(message); this.name = 'FCLCoreCoordinationBindingError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLCoreCoordinationBindingError(message); };
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
const CORE_KEYS = ['protocol','version','receipt_type','subject','frontier','predecessor_receipt_hashes','assertions','non_effects','issuer','issued_at','payload','signature_profile','content_hash'];
const INPUT_KEYS = ['protocol','version','profile','coordination_id','origin','fcl_authority_evaluation','core_state_receipt','core_availability_claim','core_intent_receipt','core_authority_receipt','issued_at'];
const INTENT_BINDING_KEYS = ['intent_ref','requested_control','run_id','run_epoch','chain_id','required_scope','required_target'];
const AVAILABILITY_BINDING_KEYS = ['run_id','run_epoch','chain_id','operation_scope','target'];
const STATE_NON_EFFECTS = { intent_established:false, authority_established:false, action_performed:false, liability_established:false, truth_certified:false };
const AVAILABILITY_NON_EFFECTS = { intent_established:false, action_performed:false, liability_established:false, truth_certified:false };
const COORDINATION_NON_EFFECTS = {
  execution_authorized:false,
  action_performed:false,
  authority_expanded:false,
  liability_established:false,
  action_permitted:false,
  action_permit_created:false,
  availability_created:false,
  availability_extended:false,
  intent_created:false,
  authority_created:false,
  authority_granted:false,
  execution_admitted:false,
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

function sameSubject(a, b) { return a.subject.id === b.subject.id && a.subject.scope === b.subject.scope; }
function sameFrontier(a, b) { return a.frontier.revision === b.frontier.revision; }

function validateCoreEnvelope(receipt, label) {
  exact(receipt, CORE_KEYS, label);
  req(receipt.protocol === 'UU-AAP Core', `${label}.protocol mismatch`);
  req(receipt.version === '0.1', `${label}.version mismatch`);
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

function requireNonEffects(receipt, required, label) {
  for (const [key, expected] of Object.entries(required)) req(receipt.non_effects[key] === expected, `${label}.non_effects.${key} must be false`);
}

function validatePositiveFCLAuthority(receipt) {
  try { validateAuthorityEvaluationReceipt(receipt); }
  catch (error) {
    if (error instanceof FCLAuthorityEvaluationError) throw new FCLCoreCoordinationBindingError(`fcl_authority_evaluation invalid: ${error.message}`);
    throw error;
  }
  req(receipt.classification === 'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED', 'fcl authority evaluation is not positive');
  req(receipt.preexisting_request_scoped_authority_observed === true, 'fcl authority did not observe pre-existing scoped authority');
  req(receipt.forwardable_to_core_authority_adapter === true, 'fcl authority evaluation is not forwardable');
  req(receipt.next_safe_action === 'BIND_CORE_AUTHORITY_RECEIPT', 'fcl authority next_safe_action mismatch');
  return true;
}

function validateStateReceipt(state) {
  validateCoreEnvelope(state, 'core_state_receipt');
  req(state.receipt_type === 'StateReceipt', 'core_state_receipt must be StateReceipt');
  req(state.predecessor_receipt_hashes.length === 0, 'Core StateReceipt must not have predecessors');
  req(state.assertions.state_anchored === true, 'Core StateReceipt must assert state_anchored=true');
  requireNonEffects(state, STATE_NON_EFFECTS, 'core_state_receipt');
  return true;
}

function expectedAvailabilityBinding(authority) {
  return {
    run_id: authority.current_run_id,
    run_epoch: authority.current_run_epoch,
    chain_id: authority.current_chain_id,
    operation_scope: authority.required_scope,
    target: authority.required_target
  };
}

function validateAvailabilityClaim(availability, state, authority, coordinationIssuedAt) {
  validateCoreEnvelope(availability, 'core_availability_claim');
  req(availability.receipt_type === 'AvailabilityClaim', 'core_availability_claim must be AvailabilityClaim');
  req(availability.predecessor_receipt_hashes.length === 1 && availability.predecessor_receipt_hashes[0] === state.content_hash, 'Core AvailabilityClaim must point exactly to StateReceipt');
  req(sameSubject(availability, state), 'Core AvailabilityClaim subject mismatch with StateReceipt');
  req(sameFrontier(availability, state), 'Core AvailabilityClaim frontier mismatch with StateReceipt');
  req(availability.assertions.availability_qualified === true, 'Core AvailabilityClaim must assert availability_qualified=true');
  req(availability.assertions.capability === authority.required_scope, 'Core AvailabilityClaim capability must equal exact FCL required_scope');
  requireNonEffects(availability, AVAILABILITY_NON_EFFECTS, 'core_availability_claim');
  req(availability.payload.status === 'available', 'Core AvailabilityClaim payload.status must be available');
  const observedAt = instant(availability.frontier.observed_at, 'core_availability_claim.frontier.observed_at');
  const claimIssuedAt = instant(availability.issued_at, 'core_availability_claim.issued_at');
  req(claimIssuedAt >= instant(state.issued_at, 'core_state_receipt.issued_at'), 'Core AvailabilityClaim issued before StateReceipt');
  req(claimIssuedAt >= observedAt, 'Core AvailabilityClaim issued before availability observation');
  req(Object.prototype.hasOwnProperty.call(availability.payload, 'valid_until'), 'core_availability_claim.payload.valid_until required');
  const validUntil = instant(availability.payload.valid_until, 'core_availability_claim.payload.valid_until');
  req(validUntil > observedAt, 'Core AvailabilityClaim freshness window must end after observation');
  req(claimIssuedAt <= validUntil, 'Core AvailabilityClaim issued after availability expired');
  req(coordinationIssuedAt <= validUntil, 'Core AvailabilityClaim stale at coordination time');
  req(obj(availability.payload.fcl_binding), 'core_availability_claim.payload.fcl_binding required');
  exact(availability.payload.fcl_binding, AVAILABILITY_BINDING_KEYS, 'core_availability_claim.payload.fcl_binding');
  const expected = expectedAvailabilityBinding(authority);
  for (const key of AVAILABILITY_BINDING_KEYS) req(availability.payload.fcl_binding[key] === expected[key], `Core AvailabilityClaim FCL binding mismatch: ${key}`);
  return true;
}

function validateIntentReceipt(intent, state, authority) {
  try { validateCoreIntentReceipt(intent); }
  catch (error) {
    if (error instanceof FCLCoreAuthorityBindingError) throw new FCLCoreCoordinationBindingError(`core_intent_receipt invalid: ${error.message}`);
    throw error;
  }
  req(intent.predecessor_receipt_hashes.length === 1 && intent.predecessor_receipt_hashes[0] === state.content_hash, 'Core IntentReceipt must point exactly to StateReceipt');
  req(sameSubject(intent, state), 'Core IntentReceipt subject mismatch with StateReceipt');
  req(sameFrontier(intent, state), 'Core IntentReceipt frontier mismatch with StateReceipt');
  const expected = expectedFCLBinding(authority);
  for (const key of INTENT_BINDING_KEYS) req(intent.payload.fcl_binding[key] === expected[key], `Core IntentReceipt FCL binding mismatch: ${key}`);
  req(instant(intent.issued_at, 'core_intent_receipt.issued_at') >= instant(state.issued_at, 'core_state_receipt.issued_at'), 'Core IntentReceipt issued before StateReceipt');
  return true;
}

function validateAuthorityReceipt(authorityReceipt, intent, fclAuthority, coordinationId) {
  req(obj(authorityReceipt.payload) && obj(authorityReceipt.payload.origin), 'Core AuthorityReceipt payload.origin required');
  const input = {
    protocol:'FCL', version:'0.1', profile:'core-authority-binding-v0.1',
    binding_id:`recheck-${coordinationId}`,
    origin:clone(authorityReceipt.payload.origin),
    fcl_authority_evaluation:clone(fclAuthority),
    core_intent_receipt:clone(intent),
    issued_at:authorityReceipt.issued_at
  };
  try { validateBoundAuthorityReceipt(authorityReceipt, input); }
  catch (error) {
    if (error instanceof FCLCoreAuthorityBindingError) throw new FCLCoreCoordinationBindingError(`core_authority_receipt invalid: ${error.message}`);
    throw error;
  }
  req(sameSubject(authorityReceipt, intent), 'Core AuthorityReceipt subject mismatch with IntentReceipt');
  req(sameFrontier(authorityReceipt, intent), 'Core AuthorityReceipt frontier mismatch with IntentReceipt');
  req(authorityReceipt.predecessor_receipt_hashes.length === 1 && authorityReceipt.predecessor_receipt_hashes[0] === intent.content_hash, 'Core AuthorityReceipt must point exactly to IntentReceipt');
  req(instant(authorityReceipt.issued_at, 'core_authority_receipt.issued_at') >= instant(intent.issued_at, 'core_intent_receipt.issued_at'), 'Core AuthorityReceipt issued before IntentReceipt');
  return true;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1' && input.profile === 'core-coordination-binding-v0.1', 'input header mismatch');
  str(input.coordination_id, 'input.coordination_id', ID);
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40); str(input.origin.tree, 'input.origin.tree', SHA40);
  validatePositiveFCLAuthority(input.fcl_authority_evaluation);
  validateStateReceipt(input.core_state_receipt);
  const issuedAt = instant(input.issued_at, 'input.issued_at');
  validateAvailabilityClaim(input.core_availability_claim, input.core_state_receipt, input.fcl_authority_evaluation, issuedAt);
  validateIntentReceipt(input.core_intent_receipt, input.core_state_receipt, input.fcl_authority_evaluation);
  validateAuthorityReceipt(input.core_authority_receipt, input.core_intent_receipt, input.fcl_authority_evaluation, input.coordination_id);
  for (const receipt of [input.core_availability_claim, input.core_intent_receipt, input.core_authority_receipt]) {
    req(sameSubject(receipt, input.core_state_receipt), `${receipt.receipt_type} subject mismatch with Core StateReceipt`);
    req(sameFrontier(receipt, input.core_state_receipt), `${receipt.receipt_type} frontier mismatch with Core StateReceipt`);
  }
  for (const [label, receipt] of [['StateReceipt',input.core_state_receipt],['AvailabilityClaim',input.core_availability_claim],['IntentReceipt',input.core_intent_receipt],['AuthorityReceipt',input.core_authority_receipt]]) {
    req(issuedAt >= instant(receipt.issued_at, `${label}.issued_at`), `CoordinationReceipt issued before ${label}`);
  }
  return true;
}

function buildCoreCoordinationReceipt(input) {
  validateInput(input);
  const state = input.core_state_receipt;
  const availability = input.core_availability_claim;
  const intent = input.core_intent_receipt;
  const authority = input.core_authority_receipt;
  const fcl = input.fcl_authority_evaluation;
  const receipt = {
    protocol:'UU-AAP Core',
    version:'0.1',
    receipt_type:'CoordinationReceipt',
    subject:clone(state.subject),
    frontier:{ revision:state.frontier.revision, observed_at:input.issued_at },
    predecessor_receipt_hashes:[availability.content_hash,intent.content_hash,authority.content_hash],
    assertions:{
      coordination_established:true,
      shared_frontier:state.frontier.revision,
      coordination_scope:fcl.required_scope,
      coordination_target:fcl.required_target,
      availability_fresh_at_coordination:true
    },
    non_effects:clone(COORDINATION_NON_EFFECTS),
    issuer:{ id:'urn:uu-aap:fcl:core-coordination-binding:v0.1', assurance:'deterministic_prerequisite_chain_binding' },
    issued_at:input.issued_at,
    payload:{
      profile:'fcl-core-coordination-binding-v0.1',
      origin:clone(input.origin),
      basis:'closed_core_prerequisite_chain_before_action_gate',
      requested_control:fcl.requested_control,
      authority_scope:fcl.required_scope,
      authority_target:fcl.required_target,
      effect_actor_subject:clone(fcl.effect_actor_subject),
      fcl_execution_context:{ run_id:fcl.current_run_id, run_epoch:fcl.current_run_epoch, chain_id:fcl.current_chain_id, intent_ref:fcl.intent_ref },
      fcl_authority_evaluation_ref:fcl.authority_evaluation_id,
      fcl_authority_evaluation_fingerprint:fcl.fingerprint_sha256,
      core_state_receipt_ref:state.content_hash,
      core_availability_claim_ref:availability.content_hash,
      core_intent_receipt_ref:intent.content_hash,
      core_authority_receipt_ref:authority.content_hash,
      availability_valid_until:availability.payload.valid_until,
      core_state_envelope_validated:true,
      core_availability_envelope_validated:true,
      core_availability_chain_revalidated:true,
      core_authority_binding_revalidated:true,
      core_prerequisite_chain_validated:true,
      availability_horizon_extended:false,
      action_gate_evaluated:false
    },
    signature_profile:{ mode:'none', reason:'deterministic_coordination_adapter_only' },
    content_hash:''
  };
  receipt.content_hash = coreContentHash(receipt);
  return receipt;
}

function validateBoundCoordinationReceipt(receipt, input) {
  validateInput(input);
  validateCoreEnvelope(receipt, 'core_coordination_receipt');
  req(receipt.receipt_type === 'CoordinationReceipt', 'core_coordination_receipt must be CoordinationReceipt');
  const state=input.core_state_receipt, availability=input.core_availability_claim, intent=input.core_intent_receipt, authority=input.core_authority_receipt, fcl=input.fcl_authority_evaluation;
  req(sameSubject(receipt,state), 'CoordinationReceipt subject substitution');
  req(sameFrontier(receipt,state), 'CoordinationReceipt frontier substitution');
  req(receipt.frontier.observed_at===input.issued_at, 'CoordinationReceipt observed_at must equal coordination issued_at');
  const expectedPred=[availability.content_hash,intent.content_hash,authority.content_hash];
  req(JSON.stringify(receipt.predecessor_receipt_hashes)===JSON.stringify(expectedPred), 'CoordinationReceipt predecessor substitution');
  req(receipt.assertions.coordination_established===true, 'CoordinationReceipt must assert coordination_established=true');
  req(receipt.assertions.shared_frontier===state.frontier.revision, 'CoordinationReceipt shared_frontier mismatch');
  req(receipt.assertions.coordination_scope===fcl.required_scope, 'CoordinationReceipt coordination_scope mismatch');
  req(receipt.assertions.coordination_target===fcl.required_target, 'CoordinationReceipt coordination_target mismatch');
  req(receipt.assertions.availability_fresh_at_coordination===true, 'CoordinationReceipt must assert availability_fresh_at_coordination=true');
  requireNonEffects(receipt, COORDINATION_NON_EFFECTS, 'core_coordination_receipt');
  req(receipt.issuer.id==='urn:uu-aap:fcl:core-coordination-binding:v0.1', 'CoordinationReceipt issuer.id mismatch');
  req(receipt.issuer.assurance==='deterministic_prerequisite_chain_binding', 'CoordinationReceipt issuer.assurance mismatch');
  req(receipt.issued_at===input.issued_at, 'CoordinationReceipt issued_at mismatch');
  const payload=receipt.payload;
  req(payload.profile==='fcl-core-coordination-binding-v0.1', 'CoordinationReceipt payload.profile mismatch');
  req(payload.basis==='closed_core_prerequisite_chain_before_action_gate', 'CoordinationReceipt payload.basis mismatch');
  req(payload.requested_control===fcl.requested_control, 'CoordinationReceipt requested_control mismatch');
  req(payload.authority_scope===fcl.required_scope, 'CoordinationReceipt authority_scope mismatch');
  req(payload.authority_target===fcl.required_target, 'CoordinationReceipt authority_target mismatch');
  req(JSON.stringify(payload.effect_actor_subject)===JSON.stringify(fcl.effect_actor_subject), 'CoordinationReceipt effect_actor_subject mismatch');
  req(payload.fcl_execution_context.run_id===fcl.current_run_id, 'CoordinationReceipt run_id mismatch');
  req(payload.fcl_execution_context.run_epoch===fcl.current_run_epoch, 'CoordinationReceipt run_epoch mismatch');
  req(payload.fcl_execution_context.chain_id===fcl.current_chain_id, 'CoordinationReceipt chain_id mismatch');
  req(payload.fcl_execution_context.intent_ref===fcl.intent_ref, 'CoordinationReceipt intent_ref mismatch');
  req(payload.fcl_authority_evaluation_ref===fcl.authority_evaluation_id, 'CoordinationReceipt FCL authority ref mismatch');
  req(payload.fcl_authority_evaluation_fingerprint===fcl.fingerprint_sha256, 'CoordinationReceipt FCL fingerprint mismatch');
  req(payload.core_state_receipt_ref===state.content_hash, 'CoordinationReceipt StateReceipt ref mismatch');
  req(payload.core_availability_claim_ref===availability.content_hash, 'CoordinationReceipt AvailabilityClaim ref mismatch');
  req(payload.core_intent_receipt_ref===intent.content_hash, 'CoordinationReceipt IntentReceipt ref mismatch');
  req(payload.core_authority_receipt_ref===authority.content_hash, 'CoordinationReceipt AuthorityReceipt ref mismatch');
  req(payload.availability_valid_until===availability.payload.valid_until, 'CoordinationReceipt availability_valid_until mismatch');
  req(payload.core_state_envelope_validated===true, 'CoordinationReceipt must state StateReceipt envelope validated');
  req(payload.core_availability_envelope_validated===true, 'CoordinationReceipt must state AvailabilityClaim envelope validated');
  req(payload.core_availability_chain_revalidated===true, 'CoordinationReceipt must state AvailabilityClaim predecessor chain revalidated');
  req(payload.core_authority_binding_revalidated===true, 'CoordinationReceipt must state AuthorityReceipt binding revalidated');
  req(payload.core_prerequisite_chain_validated===true, 'CoordinationReceipt must assert prerequisite chain validated');
  req(payload.availability_horizon_extended===false, 'CoordinationReceipt must not extend availability horizon');
  req(payload.action_gate_evaluated===false, 'CoordinationReceipt must not claim Action Gate evaluation');
  return true;
}

function read(inputPath) {
  req(typeof inputPath==='string'&&inputPath.length>0,'input path required');
  const text=inputPath==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(path.resolve(inputPath),'utf8');
  try{return JSON.parse(text);}catch(error){throw new FCLCoreCoordinationBindingError(`invalid JSON: ${error.message}`);}
}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
function main(args){
  const [command,inputPath,...extra]=args;
  if(!command||['help','--help','-h'].includes(command)){
    req(!inputPath&&extra.length===0,'help accepts no extra arguments');
    process.stdout.write('FCL Core CoordinationReceipt Binding v0.1 read-only CLI\nUsage: core-coordination-binding.js validate|bind <input.json|->\nNo permit/execute/interrupt/resume/send/switch/activate/create-successor/grant command exists.\n');
    return 0;
  }
  req(extra.length===0,'unexpected extra arguments');
  req(['validate','bind'].includes(command),`unsupported command: ${command}`);
  req(inputPath!==undefined,`${command} requires input path`);
  const input=read(inputPath);
  if(command==='validate'){
    validateInput(input);
    print({protocol:'FCL',version:'0.1',profile:'core-coordination-binding-v0.1',status:'VALID',coordination_receipt_created:false,action_permit_established:false,execution_admitted:false});
    return 0;
  }
  const receipt=buildCoreCoordinationReceipt(input);
  validateBoundCoordinationReceipt(receipt,input);
  print(receipt);
  return 0;
}
if(require.main===module){
  try{process.exitCode=main(process.argv.slice(2));}
  catch(error){
    if(error instanceof FCLCoreCoordinationBindingError){process.stderr.write(`FCL Core Coordination Binding validation error: ${error.message}\n`);process.exitCode=1;}
    else throw error;
  }
}

module.exports={
  FCLCoreCoordinationBindingError,
  AVAILABILITY_BINDING_KEYS,
  COORDINATION_NON_EFFECTS,
  buildCoreCoordinationReceipt,
  expectedAvailabilityBinding,
  validateBoundCoordinationReceipt,
  validateCoreEnvelope,
  validateInput
};