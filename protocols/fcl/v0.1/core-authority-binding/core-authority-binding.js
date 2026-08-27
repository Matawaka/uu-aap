'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  FCLAuthorityEvaluationError,
  validateAuthorityEvaluationReceipt
} = require('../authority-evaluation/authority-evaluation.js');

class FCLCoreAuthorityBindingError extends Error {
  constructor(message) { super(message); this.name = 'FCLCoreAuthorityBindingError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLCoreAuthorityBindingError(message); };
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
const FP = /^sha256:[0-9a-f]{64}$/;
const INPUT_KEYS = ['protocol','version','profile','binding_id','origin','fcl_authority_evaluation','core_intent_receipt','issued_at'];
const CORE_KEYS = ['protocol','version','receipt_type','subject','frontier','predecessor_receipt_hashes','assertions','non_effects','issuer','issued_at','payload','signature_profile','content_hash'];
const FCL_BINDING_KEYS = ['intent_ref','requested_control','run_id','run_epoch','chain_id','required_scope','required_target'];
const REQUIRED_INTENT_NON_EFFECTS = {
  action_performed: false,
  authority_expanded: false,
  responsibility_accepted: false,
  liability_established: false
};
const REQUIRED_AUTHORITY_NON_EFFECTS = {
  permissions_expanded: false,
  action_performed: false,
  responsibility_accepted: false,
  liability_established: false,
  authority_granted: false,
  authority_expanded: false,
  intent_created: false,
  action_permitted: false,
  execution_authorized: false,
  execution_admitted: false,
  interrupt_completed: false,
  continuation_receipt_created: false,
  successor_run_created: false,
  runtime_state_transitioned: false,
  legal_authority_established: false,
  universal_authority_established: false,
  legal_effect_established: false,
  truth_certified: false,
  causality_proven: false,
  private_reasoning_included: false
};

function stableCanonicalize(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonicalize).join(',')}]`;
  if (obj(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map(key => `${JSON.stringify(key)}:${stableCanonicalize(value[key])}`).join(',')}}`;
  }
  throw new FCLCoreAuthorityBindingError(`unsupported canonical JSON value type: ${typeof value}`);
}

function identityProjection(receipt) {
  const projection = {};
  for (const [key, value] of Object.entries(receipt)) {
    if (key === 'content_hash' || key === 'signature_profile') continue;
    projection[key] = value;
  }
  return projection;
}

function coreContentHash(receipt) {
  const bytes = Buffer.from(stableCanonicalize(identityProjection(receipt)), 'utf8');
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

function validateCoreEnvelopeShape(receipt, label) {
  exact(receipt, CORE_KEYS, label);
  req(receipt.protocol === 'UU-AAP Core', `${label}.protocol mismatch`);
  req(receipt.version === '0.1', `${label}.version mismatch`);
  exact(receipt.subject, ['id','scope'], `${label}.subject`);
  str(receipt.subject.id, `${label}.subject.id`);
  str(receipt.subject.scope, `${label}.subject.scope`);
  exact(receipt.frontier, ['revision','observed_at'], `${label}.frontier`);
  str(receipt.frontier.revision, `${label}.frontier.revision`);
  instant(receipt.frontier.observed_at, `${label}.frontier.observed_at`);
  req(Array.isArray(receipt.predecessor_receipt_hashes), `${label}.predecessor_receipt_hashes must be array`);
  req(new Set(receipt.predecessor_receipt_hashes).size === receipt.predecessor_receipt_hashes.length, `${label}.predecessor_receipt_hashes duplicate`);
  receipt.predecessor_receipt_hashes.forEach((hash, i) => str(hash, `${label}.predecessor_receipt_hashes[${i}]`, FP));
  req(obj(receipt.assertions) && Object.keys(receipt.assertions).length > 0, `${label}.assertions must be non-empty object`);
  req(obj(receipt.non_effects) && Object.keys(receipt.non_effects).length > 0, `${label}.non_effects must be non-empty object`);
  exact(receipt.issuer, ['id','assurance'], `${label}.issuer`);
  str(receipt.issuer.id, `${label}.issuer.id`);
  str(receipt.issuer.assurance, `${label}.issuer.assurance`);
  instant(receipt.issued_at, `${label}.issued_at`);
  req(obj(receipt.payload), `${label}.payload must be object`);
  req(obj(receipt.signature_profile), `${label}.signature_profile must be object`);
  str(receipt.signature_profile.mode, `${label}.signature_profile.mode`);
  str(receipt.content_hash, `${label}.content_hash`, FP);
  req(receipt.content_hash === coreContentHash(receipt), `${label}.content hash mismatch`);
}

function validateCoreIntentReceipt(receipt) {
  validateCoreEnvelopeShape(receipt, 'core_intent_receipt');
  req(receipt.receipt_type === 'IntentReceipt', 'core_intent_receipt must be IntentReceipt');
  req(receipt.assertions.intent_declared === true, 'core_intent_receipt must assert intent_declared=true');
  for (const [key, value] of Object.entries(REQUIRED_INTENT_NON_EFFECTS)) {
    req(receipt.non_effects[key] === value, `core_intent_receipt.non_effects.${key} must be false`);
  }
  req(obj(receipt.payload.fcl_binding), 'core_intent_receipt.payload.fcl_binding required');
  exact(receipt.payload.fcl_binding, FCL_BINDING_KEYS, 'core_intent_receipt.payload.fcl_binding');
  const binding = receipt.payload.fcl_binding;
  str(binding.intent_ref, 'core_intent_receipt.payload.fcl_binding.intent_ref');
  req(['REQUEST_INTERRUPT','REQUEST_SUCCESSOR'].includes(binding.requested_control), 'core_intent_receipt.payload.fcl_binding.requested_control invalid');
  str(binding.run_id, 'core_intent_receipt.payload.fcl_binding.run_id');
  integer(binding.run_epoch, 'core_intent_receipt.payload.fcl_binding.run_epoch');
  str(binding.chain_id, 'core_intent_receipt.payload.fcl_binding.chain_id');
  req(['fcl.run.interrupt','fcl.run.successor.create'].includes(binding.required_scope), 'core_intent_receipt.payload.fcl_binding.required_scope invalid');
  str(binding.required_target, 'core_intent_receipt.payload.fcl_binding.required_target');
  return true;
}

function validatePositiveAuthorityEvaluation(receipt) {
  try { validateAuthorityEvaluationReceipt(receipt); }
  catch (error) {
    if (error instanceof FCLAuthorityEvaluationError) throw new FCLCoreAuthorityBindingError(`fcl_authority_evaluation invalid: ${error.message}`);
    throw error;
  }
  req(receipt.classification === 'PREEXISTING_SCOPED_AUTHORITY_ESTABLISHED', 'fcl authority evaluation is not positive');
  req(receipt.preexisting_request_scoped_authority_observed === true, 'fcl authority evaluation did not observe scoped authority');
  req(receipt.forwardable_to_core_authority_adapter === true, 'fcl authority evaluation is not forwardable to Core');
  req(receipt.next_safe_action === 'BIND_CORE_AUTHORITY_RECEIPT', 'fcl authority evaluation next_safe_action mismatch');
  return true;
}

function expectedFCLBinding(authority) {
  return {
    intent_ref: authority.intent_ref,
    requested_control: authority.requested_control,
    run_id: authority.current_run_id,
    run_epoch: authority.current_run_epoch,
    chain_id: authority.current_chain_id,
    required_scope: authority.required_scope,
    required_target: authority.required_target
  };
}

function validateIntentBinding(intent, authority) {
  const actual = intent.payload.fcl_binding;
  const expected = expectedFCLBinding(authority);
  for (const key of FCL_BINDING_KEYS) req(actual[key] === expected[key], `core intent FCL binding mismatch: ${key}`);
  return true;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1' && input.profile === 'core-authority-binding-v0.1', 'input header mismatch');
  str(input.binding_id, 'input.binding_id', /^[a-z][a-z0-9-]{2,95}$/);
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);
  validatePositiveAuthorityEvaluation(input.fcl_authority_evaluation);
  validateCoreIntentReceipt(input.core_intent_receipt);
  validateIntentBinding(input.core_intent_receipt, input.fcl_authority_evaluation);
  const authorityAt = instant(input.fcl_authority_evaluation.evaluated_at, 'input.fcl_authority_evaluation.evaluated_at');
  const intentAt = instant(input.core_intent_receipt.issued_at, 'input.core_intent_receipt.issued_at');
  const bindAt = instant(input.issued_at, 'input.issued_at');
  req(intentAt <= authorityAt, 'Core IntentReceipt must pre-exist FCL authority evaluation');
  req(bindAt >= authorityAt, 'binding issued_at cannot precede FCL authority evaluation');
  req(bindAt >= intentAt, 'binding issued_at cannot precede Core IntentReceipt');
  return true;
}

function buildCoreAuthorityReceipt(input) {
  validateInput(input);
  const authority = input.fcl_authority_evaluation;
  const intent = input.core_intent_receipt;
  const receipt = {
    protocol: 'UU-AAP Core',
    version: '0.1',
    receipt_type: 'AuthorityReceipt',
    subject: clone(intent.subject),
    frontier: clone(intent.frontier),
    predecessor_receipt_hashes: [intent.content_hash],
    assertions: {
      authority_bound: true,
      authority_scope: authority.required_scope,
      authority_target: authority.required_target,
      authority_evidence_class: 'preexisting_request_scoped'
    },
    non_effects: clone(REQUIRED_AUTHORITY_NON_EFFECTS),
    issuer: {
      id: 'urn:uu-aap:fcl:core-authority-binding:v0.1',
      assurance: 'deterministic_adapter_from_validated_preexisting_evidence'
    },
    issued_at: input.issued_at,
    payload: {
      profile: 'fcl-core-authority-binding-v0.1',
      origin: clone(input.origin),
      basis: 'fcl_preexisting_scoped_authority',
      requested_control: authority.requested_control,
      effect_actor_subject: clone(authority.effect_actor_subject),
      authority_scope: authority.required_scope,
      authority_target: authority.required_target,
      fcl_execution_context: {
        run_id: authority.current_run_id,
        run_epoch: authority.current_run_epoch,
        chain_id: authority.current_chain_id,
        intent_ref: authority.intent_ref
      },
      fcl_authority_evaluation_ref: authority.authority_evaluation_id,
      fcl_authority_evaluation_fingerprint: authority.fingerprint_sha256,
      poai_authority_verification_ref: authority.poai_verification_id,
      poai_authority_result_binding_sha256: authority.poai_authority_result_binding_sha256,
      core_intent_receipt_ref: intent.content_hash,
      core_intent_envelope_validated: true,
      core_intent_chain_revalidated: false
    },
    signature_profile: {
      mode: 'none',
      reason: 'deterministic_binding_adapter_only'
    },
    content_hash: ''
  };
  receipt.content_hash = coreContentHash(receipt);
  return receipt;
}

function validateBoundAuthorityReceipt(receipt, input) {
  validateInput(input);
  validateCoreEnvelopeShape(receipt, 'core_authority_receipt');
  req(receipt.receipt_type === 'AuthorityReceipt', 'core_authority_receipt must be AuthorityReceipt');
  const authority = input.fcl_authority_evaluation;
  const intent = input.core_intent_receipt;
  req(JSON.stringify(receipt.subject) === JSON.stringify(intent.subject), 'core_authority_receipt subject substitution');
  req(JSON.stringify(receipt.frontier) === JSON.stringify(intent.frontier), 'core_authority_receipt frontier substitution');
  req(receipt.predecessor_receipt_hashes.length === 1 && receipt.predecessor_receipt_hashes[0] === intent.content_hash, 'core_authority_receipt predecessor substitution');
  req(receipt.assertions.authority_bound === true, 'core_authority_receipt must assert authority_bound=true');
  req(receipt.assertions.authority_scope === authority.required_scope, 'core_authority_receipt authority_scope mismatch');
  req(receipt.assertions.authority_target === authority.required_target, 'core_authority_receipt authority_target mismatch');
  req(receipt.assertions.authority_evidence_class === 'preexisting_request_scoped', 'core_authority_receipt evidence class mismatch');
  for (const [key, value] of Object.entries(REQUIRED_AUTHORITY_NON_EFFECTS)) req(receipt.non_effects[key] === value, `core_authority_receipt.non_effects.${key} must be false`);
  req(receipt.issuer.id === 'urn:uu-aap:fcl:core-authority-binding:v0.1', 'core_authority_receipt issuer.id mismatch');
  req(receipt.issuer.assurance === 'deterministic_adapter_from_validated_preexisting_evidence', 'core_authority_receipt issuer.assurance mismatch');
  req(receipt.issued_at === input.issued_at, 'core_authority_receipt issued_at mismatch');
  const payload = receipt.payload;
  req(payload.profile === 'fcl-core-authority-binding-v0.1', 'core_authority_receipt payload.profile mismatch');
  req(payload.basis === 'fcl_preexisting_scoped_authority', 'core_authority_receipt payload.basis mismatch');
  req(payload.requested_control === authority.requested_control, 'core_authority_receipt requested_control mismatch');
  req(JSON.stringify(payload.effect_actor_subject) === JSON.stringify(authority.effect_actor_subject), 'core_authority_receipt effect_actor_subject mismatch');
  req(payload.authority_scope === authority.required_scope, 'core_authority_receipt payload authority_scope mismatch');
  req(payload.authority_target === authority.required_target, 'core_authority_receipt payload authority_target mismatch');
  req(payload.fcl_execution_context.run_id === authority.current_run_id, 'core_authority_receipt run_id mismatch');
  req(payload.fcl_execution_context.run_epoch === authority.current_run_epoch, 'core_authority_receipt run_epoch mismatch');
  req(payload.fcl_execution_context.chain_id === authority.current_chain_id, 'core_authority_receipt chain_id mismatch');
  req(payload.fcl_execution_context.intent_ref === authority.intent_ref, 'core_authority_receipt intent_ref mismatch');
  req(payload.fcl_authority_evaluation_ref === authority.authority_evaluation_id, 'core_authority_receipt FCL authority ref mismatch');
  req(payload.fcl_authority_evaluation_fingerprint === authority.fingerprint_sha256, 'core_authority_receipt FCL fingerprint mismatch');
  req(payload.poai_authority_verification_ref === authority.poai_verification_id, 'core_authority_receipt PoAI verification ref mismatch');
  req(payload.poai_authority_result_binding_sha256 === authority.poai_authority_result_binding_sha256, 'core_authority_receipt PoAI binding mismatch');
  req(payload.core_intent_receipt_ref === intent.content_hash, 'core_authority_receipt Core intent ref mismatch');
  req(payload.core_intent_envelope_validated === true, 'core_authority_receipt must state envelope validated');
  req(payload.core_intent_chain_revalidated === false, 'core_authority_receipt must not overclaim full Core chain validation');
  return true;
}

function read(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLCoreAuthorityBindingError(`invalid JSON: ${error.message}`); }
}
function print(value) { process.stdout.write(`${JSON.stringify(value, null, 2)}\n`); }
function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('FCL -> Core AuthorityReceipt Binding v0.1 read-only adapter CLI\nUsage: core-authority-binding.js validate|bind <input.json|->\nNo grant/permit/interrupt/execute/resume/send/switch/activate/create-successor command exists.\n');
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','bind'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const input = read(inputPath);
  if (command === 'validate') {
    validateInput(input);
    print({ protocol: 'FCL', version: '0.1', profile: 'core-authority-binding-v0.1', status: 'VALID', core_authority_receipt_created: false, action_permit_established: false, execution_admitted: false });
    return 0;
  }
  const receipt = buildCoreAuthorityReceipt(input);
  validateBoundAuthorityReceipt(receipt, input);
  print(receipt);
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLCoreAuthorityBindingError) {
      process.stderr.write(`FCL Core Authority Binding validation error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  FCLCoreAuthorityBindingError,
  REQUIRED_AUTHORITY_NON_EFFECTS,
  buildCoreAuthorityReceipt,
  coreContentHash,
  expectedFCLBinding,
  stableCanonicalize,
  validateBoundAuthorityReceipt,
  validateCoreIntentReceipt,
  validateInput
};
