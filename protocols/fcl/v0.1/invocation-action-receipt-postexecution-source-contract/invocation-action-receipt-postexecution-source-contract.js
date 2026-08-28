#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  materializeWithPreparedSource: materializeEnvelopeWithPreparedSource,
  prepareValidatedSource: prepareEnvelopeSource,
} = require('../execution-invocation-envelope-source-parameterization/execution-invocation-envelope-source-parameterization.js');
const {
  hashWithoutContentHash,
  stable,
} = require('../../../integration/execution-invocation-envelope/v0.1/validate-parameterized-envelope.js');
const {
  validateBinding: validateParameterizedPostExecutionBinding,
} = require('../../../integration/invocation-action-receipt-binding/v0.1/validate-parameterized-binding.js');

class FCLInvocationActionReceiptPostExecutionSourceContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FCLInvocationActionReceiptPostExecutionSourceContractError';
  }
}

const req = (condition, message) => {
  if (!condition) throw new FCLInvocationActionReceiptPostExecutionSourceContractError(message);
};
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => stable(a) === stable(b);
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
  const parsed = Date.parse(value);
  req(Number.isFinite(parsed), `${label} invalid date-time`);
  return parsed;
};
const deepFreeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
};
const HASH = /^sha256:[0-9a-f]{64}$/;
const SHA40 = /^[0-9a-f]{40}$/;

const INPUT_KEYS = [
  'protocol',
  'version',
  'profile',
  'contract_id',
  'origin',
  'invocation_envelope_input',
  'execution_invocation_envelope',
  'fcl_invocation_envelope_receipt',
  'prepared_at',
];
const CONTRACT_KEYS = [
  'protocol',
  'version',
  'artifact_type',
  'contract_id',
  'status',
  'source_envelope',
  'source_action',
  'performed_resource_ref_requirement',
  'post_execution_validator',
  'required_execution_evidence',
  'required_action_receipt',
  'assertions',
  'non_effects',
  'prepared_at',
  'expires_at',
  'next_safe_action',
  'content_hash',
];
const ASSERTION_KEYS = [
  'envelope_exactly_bound',
  'invocation_identity_exactly_bound',
  'action_permit_exactly_bound',
  'target_exactly_bound',
  'frontier_exactly_bound',
  'resource_identity_not_inferred',
  'execution_evidence_required',
  'action_receipt_requires_execution_evidence',
  'parameterized_validator_ready',
  'contract_is_pre_execution_evidence_only',
];
const NON_EFFECT_KEYS = [
  'actuator_invocation_emitted',
  'envelope_consumed',
  'permit_consumed',
  'invocation_evidence_created',
  'invocation_action_receipt_binding_created',
  'core_action_receipt_created',
  'action_performed',
  'outcome_observed',
  'successor_state_established',
  'runtime_state_transitioned',
  'causality_proven',
  'truth_certified',
  'liability_established',
  'authority_expanded',
  'future_action_permission_created',
];

const preparedContexts = new WeakSet();

function validateHeader(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1', 'input header mismatch');
  req(input.profile === 'invocation-action-receipt-postexecution-source-contract-v0.1', 'input.profile mismatch');
  str(input.contract_id, 'input.contract_id');
  exact(input.origin, ['repository', 'revision', 'tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);
  instant(input.prepared_at, 'input.prepared_at');
  req(typeof validateParameterizedPostExecutionBinding === 'function', 'parameterized post-execution validator unavailable');
  return true;
}

function deriveSourceFields(input) {
  const envelope = input.execution_invocation_envelope;
  const envelopeReceipt = input.fcl_invocation_envelope_receipt;
  const bundle = input.invocation_envelope_input.revalidation_input.authorize_binding_input.assessment_input.pre_action_bundle;
  const permit = bundle.core_receipts.action_permit;

  req(envelopeReceipt.next_safe_action === 'PARAMETERIZE_INVOCATION_ACTION_RECEIPT_FCL_SOURCE', 'invocation envelope receipt next_safe_action mismatch');
  req(envelopeReceipt.envelope_id === envelope.envelope_id, 'envelope receipt id mismatch');
  req(envelopeReceipt.envelope_content_hash === envelope.content_hash, 'envelope receipt hash mismatch');
  req(envelopeReceipt.invocation_id === envelope.invocation.invocation_id, 'envelope receipt invocation id mismatch');
  req(envelopeReceipt.adapter_id === envelope.invocation.adapter_id, 'envelope receipt adapter id mismatch');
  req(envelopeReceipt.action_permit_hash === permit.content_hash, 'envelope receipt ActionPermit mismatch');
  req(envelopeReceipt.target_binding_hash === envelope.action_binding.target_binding_hash, 'envelope receipt target mismatch');
  req(envelopeReceipt.frontier === envelope.action_binding.predecessor_frontier, 'envelope receipt frontier mismatch');

  req(envelope.invocation.one_shot === true, 'source envelope must remain one-shot');
  req(envelope.invocation.consumed === false, 'source envelope must remain unconsumed');
  req(envelope.non_effects.actuator_invocation_emitted === false, 'source envelope must not claim invocation emission');
  req(envelope.non_effects.permit_consumed === false, 'source envelope must not claim permit consumption');
  req(envelope.non_effects.action_receipt_created === false, 'source envelope must not claim ActionReceipt creation');
  req(envelope.non_effects.action_performed === false, 'source envelope must not claim action performed');
  req(!Object.prototype.hasOwnProperty.call(envelope.action_binding, 'performed_resource_ref'), 'performed resource identity must not be inferred into source envelope');

  return { envelope, envelopeReceipt, bundle, permit };
}

function validateRuntimeBoundary(input, sources) {
  const preparedAt = instant(input.prepared_at, 'input.prepared_at');
  const createdAt = instant(sources.envelope.created_at, 'source envelope created_at');
  const expiresAt = instant(sources.envelope.invocation.expires_at, 'source envelope expires_at');
  req(createdAt <= preparedAt, 'post-execution source contract cannot predate invocation envelope');
  req(preparedAt <= expiresAt, 'post-execution source contract prepared after invocation envelope expiry');
  return true;
}

function prepareValidatedSource(input) {
  validateHeader(input);

  let upstreamContext;
  let expected;
  try {
    upstreamContext = prepareEnvelopeSource(input.invocation_envelope_input);
    expected = materializeEnvelopeWithPreparedSource(input.invocation_envelope_input, upstreamContext);
  } catch (error) {
    throw new FCLInvocationActionReceiptPostExecutionSourceContractError(`invocation envelope source invalid: ${error.message}`);
  }

  req(same(input.execution_invocation_envelope, expected.execution_invocation_envelope), 'execution invocation envelope is not exactly reproducible from invocation_envelope_input');
  req(same(input.fcl_invocation_envelope_receipt, expected.fcl_invocation_envelope_receipt), 'FCL invocation envelope receipt is not exactly reproducible from invocation_envelope_input');

  const sources = deriveSourceFields(input);
  validateRuntimeBoundary(input, sources);

  const context = {
    invocation_envelope_input_canonical: stable(input.invocation_envelope_input),
    execution_invocation_envelope_canonical: stable(input.execution_invocation_envelope),
    fcl_invocation_envelope_receipt_canonical: stable(input.fcl_invocation_envelope_receipt),
    sources: deepFreeze(clone(sources)),
  };
  deepFreeze(context);
  preparedContexts.add(context);
  return context;
}

function requirePreparedSource(input, context) {
  validateHeader(input);
  req(obj(context) && preparedContexts.has(context), 'prepared source context must originate from prepareValidatedSource');
  req(stable(input.invocation_envelope_input) === context.invocation_envelope_input_canonical, 'prepared source invocation envelope input mismatch');
  req(stable(input.execution_invocation_envelope) === context.execution_invocation_envelope_canonical, 'prepared source invocation envelope mismatch');
  req(stable(input.fcl_invocation_envelope_receipt) === context.fcl_invocation_envelope_receipt_canonical, 'prepared source FCL invocation envelope receipt mismatch');
  validateRuntimeBoundary(input, context.sources);
  return context.sources;
}

function validateInput(input, preparedSource = null) {
  if (preparedSource === null) prepareValidatedSource(input);
  else requirePreparedSource(input, preparedSource);
  return true;
}

function buildContractWithSources(input, sources) {
  const envelope = sources.envelope;
  const contract = {
    protocol: 'FCL',
    version: '0.1',
    artifact_type: 'FCLInvocationActionReceiptPostExecutionSourceContract',
    contract_id: input.contract_id,
    status: 'awaiting_execution_evidence',
    source_envelope: {
      envelope_id: envelope.envelope_id,
      content_hash: envelope.content_hash,
      invocation_id: envelope.invocation.invocation_id,
      adapter_id: envelope.invocation.adapter_id,
      created_at: envelope.created_at,
      expires_at: envelope.invocation.expires_at,
    },
    source_action: {
      subject_id: envelope.subject.id,
      subject_scope: envelope.subject.scope,
      operation: envelope.action_binding.operation,
      authority_scope: envelope.action_binding.authority_scope,
      action_permit_hash: envelope.evidence_binding.action_permit_hash,
      target_binding_hash: envelope.action_binding.target_binding_hash,
      predecessor_frontier: envelope.action_binding.predecessor_frontier,
    },
    performed_resource_ref_requirement: {
      status: 'required_from_execution_evidence',
      value: null,
      inference_from_target_binding_hash: false,
    },
    post_execution_validator: {
      protocol: 'UU-AAP-INVOCATION-ACTION-RECEIPT-BINDING',
      version: '0.1',
      artifact_type: 'InvocationActionReceiptBinding',
      source_mode: 'explicit_envelope_and_resource_ref',
    },
    required_execution_evidence: {
      evidence_type: 'ActuatorInvocationEvidence',
      emission_status: 'emitted',
      expected_target_guard_passed: true,
      expected_predecessor_guard_passed: true,
      one_shot_envelope_consumed: true,
      action_permit_consumed: true,
      performed_resource_ref_required: true,
    },
    required_action_receipt: {
      protocol: 'UU-AAP Core',
      version: '0.1',
      receipt_type: 'ActionReceipt',
      subject_id: envelope.subject.id,
      subject_scope: envelope.subject.scope,
      predecessor_action_permit_hash: envelope.evidence_binding.action_permit_hash,
      predecessor_frontier: envelope.action_binding.predecessor_frontier,
      action_performed: true,
      performed_scope_rule: '<operation>:<performed_resource_ref>',
      effect_ref_rule: 'invocation_evidence.content_hash',
    },
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    prepared_at: input.prepared_at,
    expires_at: envelope.invocation.expires_at,
    next_safe_action: 'BIND_FCL_RUNTIME_EXECUTION_EVIDENCE_SOURCE',
    content_hash: '',
  };
  contract.content_hash = hashWithoutContentHash(contract);
  return contract;
}

function buildContract(input, preparedSource = null) {
  const context = preparedSource === null ? prepareValidatedSource(input) : preparedSource;
  const sources = requirePreparedSource(input, context);
  return buildContractWithSources(input, sources);
}

function validateContract(contract, input = null, preparedSource = null) {
  exact(contract, CONTRACT_KEYS, 'contract');
  req(contract.protocol === 'FCL' && contract.version === '0.1', 'contract header mismatch');
  req(contract.artifact_type === 'FCLInvocationActionReceiptPostExecutionSourceContract', 'contract artifact_type mismatch');
  str(contract.contract_id, 'contract.contract_id');
  req(contract.status === 'awaiting_execution_evidence', 'contract status mismatch');

  exact(contract.source_envelope, ['envelope_id', 'content_hash', 'invocation_id', 'adapter_id', 'created_at', 'expires_at'], 'contract.source_envelope');
  for (const key of ['envelope_id', 'invocation_id', 'adapter_id', 'created_at', 'expires_at']) str(contract.source_envelope[key], `contract.source_envelope.${key}`);
  str(contract.source_envelope.content_hash, 'contract.source_envelope.content_hash', HASH);
  instant(contract.source_envelope.created_at, 'contract.source_envelope.created_at');
  instant(contract.source_envelope.expires_at, 'contract.source_envelope.expires_at');

  exact(contract.source_action, ['subject_id', 'subject_scope', 'operation', 'authority_scope', 'action_permit_hash', 'target_binding_hash', 'predecessor_frontier'], 'contract.source_action');
  for (const key of ['subject_id', 'subject_scope', 'operation', 'authority_scope', 'predecessor_frontier']) str(contract.source_action[key], `contract.source_action.${key}`);
  str(contract.source_action.action_permit_hash, 'contract.source_action.action_permit_hash', HASH);
  str(contract.source_action.target_binding_hash, 'contract.source_action.target_binding_hash', HASH);

  exact(contract.performed_resource_ref_requirement, ['status', 'value', 'inference_from_target_binding_hash'], 'contract.performed_resource_ref_requirement');
  req(contract.performed_resource_ref_requirement.status === 'required_from_execution_evidence', 'performed resource status mismatch');
  req(contract.performed_resource_ref_requirement.value === null, 'performed resource value must remain null before execution evidence');
  req(contract.performed_resource_ref_requirement.inference_from_target_binding_hash === false, 'performed resource must not be inferred from target binding hash');

  exact(contract.post_execution_validator, ['protocol', 'version', 'artifact_type', 'source_mode'], 'contract.post_execution_validator');
  req(contract.post_execution_validator.protocol === 'UU-AAP-INVOCATION-ACTION-RECEIPT-BINDING', 'post-execution validator protocol mismatch');
  req(contract.post_execution_validator.version === '0.1', 'post-execution validator version mismatch');
  req(contract.post_execution_validator.artifact_type === 'InvocationActionReceiptBinding', 'post-execution validator artifact type mismatch');
  req(contract.post_execution_validator.source_mode === 'explicit_envelope_and_resource_ref', 'post-execution validator source mode mismatch');

  exact(contract.required_execution_evidence, ['evidence_type', 'emission_status', 'expected_target_guard_passed', 'expected_predecessor_guard_passed', 'one_shot_envelope_consumed', 'action_permit_consumed', 'performed_resource_ref_required'], 'contract.required_execution_evidence');
  req(contract.required_execution_evidence.evidence_type === 'ActuatorInvocationEvidence', 'required evidence type mismatch');
  req(contract.required_execution_evidence.emission_status === 'emitted', 'required emission status mismatch');
  for (const key of ['expected_target_guard_passed', 'expected_predecessor_guard_passed', 'one_shot_envelope_consumed', 'action_permit_consumed', 'performed_resource_ref_required']) {
    req(contract.required_execution_evidence[key] === true, `contract.required_execution_evidence.${key} must be true`);
  }

  exact(contract.required_action_receipt, ['protocol', 'version', 'receipt_type', 'subject_id', 'subject_scope', 'predecessor_action_permit_hash', 'predecessor_frontier', 'action_performed', 'performed_scope_rule', 'effect_ref_rule'], 'contract.required_action_receipt');
  req(contract.required_action_receipt.protocol === 'UU-AAP Core' && contract.required_action_receipt.version === '0.1', 'required ActionReceipt header mismatch');
  req(contract.required_action_receipt.receipt_type === 'ActionReceipt', 'required ActionReceipt type mismatch');
  str(contract.required_action_receipt.subject_id, 'contract.required_action_receipt.subject_id');
  str(contract.required_action_receipt.subject_scope, 'contract.required_action_receipt.subject_scope');
  str(contract.required_action_receipt.predecessor_action_permit_hash, 'contract.required_action_receipt.predecessor_action_permit_hash', HASH);
  str(contract.required_action_receipt.predecessor_frontier, 'contract.required_action_receipt.predecessor_frontier');
  req(contract.required_action_receipt.action_performed === true, 'future ActionReceipt must prove action_performed');
  req(contract.required_action_receipt.performed_scope_rule === '<operation>:<performed_resource_ref>', 'performed scope rule mismatch');
  req(contract.required_action_receipt.effect_ref_rule === 'invocation_evidence.content_hash', 'effect ref rule mismatch');

  exact(contract.assertions, ASSERTION_KEYS, 'contract.assertions');
  for (const key of ASSERTION_KEYS) req(contract.assertions[key] === true, `contract.assertions.${key} must be true`);
  exact(contract.non_effects, NON_EFFECT_KEYS, 'contract.non_effects');
  for (const key of NON_EFFECT_KEYS) req(contract.non_effects[key] === false, `contract.non_effects.${key} must be false`);

  instant(contract.prepared_at, 'contract.prepared_at');
  instant(contract.expires_at, 'contract.expires_at');
  req(contract.next_safe_action === 'BIND_FCL_RUNTIME_EXECUTION_EVIDENCE_SOURCE', 'contract next_safe_action mismatch');
  req(contract.content_hash === hashWithoutContentHash(contract), 'contract content hash mismatch');

  req(!Object.prototype.hasOwnProperty.call(contract, 'invocation_evidence'), 'contract must not synthesize invocation evidence');
  req(!Object.prototype.hasOwnProperty.call(contract, 'core_action_receipt'), 'contract must not synthesize Core ActionReceipt');
  req(!Object.prototype.hasOwnProperty.call(contract, 'outcome_receipt'), 'contract must not synthesize outcome receipt');
  req(!Object.prototype.hasOwnProperty.call(contract, 'successor_state_receipt'), 'contract must not synthesize successor state receipt');

  if (input !== null) {
    const context = preparedSource === null ? prepareValidatedSource(input) : preparedSource;
    const sources = requirePreparedSource(input, context);
    const expected = buildContractWithSources(input, sources);
    req(same(contract, expected), 'post-execution source contract is not exactly reproducible from input');
  }
  return true;
}

function prepareWithPreparedSource(input, preparedSource) {
  const sources = requirePreparedSource(input, preparedSource);
  const post_execution_source_contract = buildContractWithSources(input, sources);
  validateContract(post_execution_source_contract);
  return { post_execution_source_contract };
}

function prepare(input) {
  const preparedSource = prepareValidatedSource(input);
  return prepareWithPreparedSource(input, preparedSource);
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLInvocationActionReceiptPostExecutionSourceContractError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help', '--help', '-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('FCL Invocation→ActionReceipt Post-Execution Source Contract v0.1 artifact-only CLI\nUsage: invocation-action-receipt-postexecution-source-contract.js validate|prepare|validate-contract <json|->\nNo invoke/execute/emit/consume/interrupt/send/actuate command exists.\n');
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate', 'prepare', 'validate-contract'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') {
    validateInput(value);
    process.stdout.write('VALID\n');
  } else if (command === 'prepare') {
    process.stdout.write(`${JSON.stringify(prepare(value), null, 2)}\n`);
  } else {
    validateContract(value);
    process.stdout.write('VALID\n');
  }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLInvocationActionReceiptPostExecutionSourceContractError) {
      process.stderr.write(`FCL Invocation→ActionReceipt Post-Execution Source Contract error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  ASSERTION_KEYS,
  FCLInvocationActionReceiptPostExecutionSourceContractError,
  NON_EFFECT_KEYS,
  buildContract,
  prepare,
  prepareValidatedSource,
  prepareWithPreparedSource,
  validateContract,
  validateInput,
};
