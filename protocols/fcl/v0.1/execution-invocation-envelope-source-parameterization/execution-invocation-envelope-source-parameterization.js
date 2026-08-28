#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  prepareValidatedSource: prepareRevalidationSource,
  revalidateWithPreparedSource,
} = require('../execute-revalidation-source-parameterization/execute-revalidation-source-parameterization.js');
const {
  hashWithoutContentHash,
  stable,
  validateEnvelope,
} = require('../../../integration/execution-invocation-envelope/v0.1/validate-parameterized-envelope.js');

class FCLExecutionInvocationEnvelopeSourceParameterizationError extends Error {
  constructor(message) { super(message); this.name = 'FCLExecutionInvocationEnvelopeSourceParameterizationError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLExecutionInvocationEnvelopeSourceParameterizationError(message); };
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
  const n = Date.parse(value);
  req(Number.isFinite(n), `${label} invalid date-time`);
  return n;
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
  'protocol','version','profile','binding_id','origin',
  'revalidation_input','generic_revalidation_decision','fcl_revalidation_receipt',
  'envelope_id','created_at','invocation_id','adapter_id'
];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','binding_id','envelope_id','envelope_content_hash',
  'invocation_id','adapter_id','generic_revalidation_decision_id','generic_revalidation_hash',
  'fcl_revalidation_receipt_hash','bundle_id','bundle_content_hash','action_permit_hash','approval_hash',
  'target_binding_hash','frontier','created_at','expires_at','assertions','non_effects','next_safe_action','content_hash'
];
const ASSERTION_KEYS = [
  'revalidation_exactly_bound','fcl_revalidation_receipt_exactly_bound','parameterized_validator_passed',
  'action_permit_exactly_bound','approval_exactly_bound','target_exactly_bound','frontier_exactly_bound',
  'transport_only_adapter','guards_fail_closed','envelope_one_shot_unconsumed','envelope_is_pre_invocation_evidence_only'
];
const NON_EFFECT_KEYS = [
  'actuator_invocation_emitted','envelope_consumed','permit_consumed','action_receipt_created','action_performed',
  'outcome_observed','runtime_state_transitioned','future_action_permission_created','authority_expanded'
];

const preparedContexts = new WeakSet();

function validateHeader(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1', 'input header mismatch');
  req(input.profile === 'execution-invocation-envelope-source-parameterization-v0.1', 'input.profile mismatch');
  str(input.binding_id, 'input.binding_id');
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);
  for (const key of ['envelope_id','invocation_id','adapter_id']) str(input[key], `input.${key}`);
  instant(input.created_at, 'input.created_at');
  return true;
}

function deriveSourceFields(input) {
  const sourceRevalidation = input.generic_revalidation_decision;
  const revalidationReceipt = input.fcl_revalidation_receipt;
  const bundle = input.revalidation_input.authorize_binding_input.assessment_input.pre_action_bundle;
  const permit = bundle.core_receipts.action_permit;
  const approval = bundle.approval_binding;

  req(sourceRevalidation.decision.status === 'ready', 'source revalidation must remain ready');
  req(revalidationReceipt.decision_status === 'ready', 'FCL revalidation receipt must remain ready');
  req(revalidationReceipt.generic_revalidation_hash === sourceRevalidation.content_hash, 'FCL revalidation receipt decision hash mismatch');
  req(revalidationReceipt.decision_id === sourceRevalidation.decision_id, 'FCL revalidation receipt decision id mismatch');
  req(revalidationReceipt.action_permit_hash === permit.content_hash, 'FCL revalidation receipt ActionPermit mismatch');
  req(revalidationReceipt.approval_hash === approval.content_hash, 'FCL revalidation receipt Approval mismatch');
  req(revalidationReceipt.target_binding_hash === bundle.target.binding_hash, 'FCL revalidation receipt target mismatch');
  req(revalidationReceipt.frontier === bundle.target.expected_predecessor_frontier, 'FCL revalidation receipt frontier mismatch');
  req(revalidationReceipt.next_safe_action === 'PARAMETERIZE_EXECUTION_INVOCATION_ENVELOPE_FCL_SOURCE', 'FCL revalidation receipt next_safe_action mismatch');
  req(permit.payload.one_shot === true && permit.payload.consumed === false, 'ActionPermit must remain one-shot and unconsumed');

  return { sourceRevalidation, revalidationReceipt, bundle, permit, approval };
}

function validateRuntimeBoundary(input, sources) {
  const createdAt = instant(input.created_at, 'input.created_at');
  const evaluatedAt = instant(sources.sourceRevalidation.evaluated_at, 'sourceRevalidation.evaluated_at');
  const horizon = instant(sources.sourceRevalidation.freshness_binding.execute_revalidation_must_occur_by, 'execute_revalidation_must_occur_by');
  req(evaluatedAt <= createdAt, 'invocation envelope cannot predate execute revalidation');
  req(createdAt <= horizon, 'invocation envelope created after revalidation horizon');
  return true;
}

function prepareValidatedSource(input) {
  validateHeader(input);
  let upstreamContext;
  let expected;
  try {
    upstreamContext = prepareRevalidationSource(input.revalidation_input);
    expected = revalidateWithPreparedSource(input.revalidation_input, upstreamContext);
  } catch (error) {
    throw new FCLExecutionInvocationEnvelopeSourceParameterizationError(`revalidation source invalid: ${error.message}`);
  }
  req(same(input.generic_revalidation_decision, expected.generic_revalidation_decision), 'generic revalidation decision is not exactly reproducible from revalidation_input');
  req(same(input.fcl_revalidation_receipt, expected.fcl_revalidation_receipt), 'FCL revalidation receipt is not exactly reproducible from revalidation_input');

  const sources = deriveSourceFields(input);
  validateRuntimeBoundary(input, sources);

  const context = {
    revalidation_input_canonical: stable(input.revalidation_input),
    generic_revalidation_decision_canonical: stable(input.generic_revalidation_decision),
    fcl_revalidation_receipt_canonical: stable(input.fcl_revalidation_receipt),
    sources: deepFreeze(clone(sources)),
  };
  deepFreeze(context);
  preparedContexts.add(context);
  return context;
}

function requirePreparedSource(input, context) {
  validateHeader(input);
  req(obj(context) && preparedContexts.has(context), 'prepared source context must originate from prepareValidatedSource');
  req(stable(input.revalidation_input) === context.revalidation_input_canonical, 'prepared source revalidation input mismatch');
  req(stable(input.generic_revalidation_decision) === context.generic_revalidation_decision_canonical, 'prepared source generic revalidation decision mismatch');
  req(stable(input.fcl_revalidation_receipt) === context.fcl_revalidation_receipt_canonical, 'prepared source FCL revalidation receipt mismatch');
  validateRuntimeBoundary(input, context.sources);
  return context.sources;
}

function validateInput(input, preparedSource = null) {
  if (preparedSource === null) prepareValidatedSource(input);
  else requirePreparedSource(input, preparedSource);
  return true;
}

function buildEnvelopeWithSources(input, sources) {
  const sourceRevalidation = sources.sourceRevalidation;
  const envelope = {
    protocol: 'UU-AAP-EXECUTION-INVOCATION-ENVELOPE',
    version: '0.1',
    artifact_type: 'ExecutionInvocationEnvelope',
    envelope_id: input.envelope_id,
    created_at: input.created_at,
    execute_revalidation_ref: {
      decision_id: sourceRevalidation.decision_id,
      content_hash: sourceRevalidation.content_hash,
      status: 'ready',
    },
    subject: clone(sourceRevalidation.subject),
    action_binding: clone(sourceRevalidation.action_binding),
    evidence_binding: {
      availability_binding_hash: sourceRevalidation.freshness_binding.availability_binding_hash,
      approval_hash: sourceRevalidation.freshness_binding.approval_hash,
      action_permit_hash: sourceRevalidation.freshness_binding.action_permit_hash,
    },
    invocation: {
      invocation_id: input.invocation_id,
      adapter_id: input.adapter_id,
      adapter_role: 'transport_only',
      one_shot: true,
      consumed: false,
      expected_target_guard_used: true,
      expected_predecessor_guard_used: true,
      expires_at: sourceRevalidation.freshness_binding.execute_revalidation_must_occur_by,
    },
    assertions: {
      revalidation_exactly_bound: true,
      action_exactly_bound: true,
      permit_exactly_bound: true,
      guards_fail_closed: true,
      one_shot_unconsumed: true,
      adapter_not_authority_source: true,
    },
    non_effects: {
      actuator_invocation_emitted: false,
      action_receipt_created: false,
      permit_consumed: false,
      action_performed: false,
      outcome_observed: false,
      authority_created_or_expanded: false,
      future_action_permission_created: false,
      general_authority_created: false,
      causality_proven: false,
      truth_certified: false,
      liability_established: false,
    },
    content_hash: '',
  };
  envelope.content_hash = hashWithoutContentHash(envelope);
  try { validateEnvelope(envelope, sourceRevalidation); }
  catch (error) { throw new FCLExecutionInvocationEnvelopeSourceParameterizationError(`parameterized Invocation Envelope validation failed: ${error.message}`); }
  return envelope;
}

function buildEnvelope(input, preparedSource = null) {
  const context = preparedSource === null ? prepareValidatedSource(input) : preparedSource;
  const sources = requirePreparedSource(input, context);
  return buildEnvelopeWithSources(input, sources);
}

function buildReceiptUnchecked(input, envelope, preparedSource = null) {
  const sources = preparedSource === null ? deriveSourceFields(input) : requirePreparedSource(input, preparedSource);
  const receipt = {
    protocol: 'FCL',
    version: '0.1',
    receipt_type: 'FCLExecutionInvocationEnvelopeSourceBindingReceipt',
    binding_id: input.binding_id,
    envelope_id: envelope.envelope_id,
    envelope_content_hash: envelope.content_hash,
    invocation_id: envelope.invocation.invocation_id,
    adapter_id: envelope.invocation.adapter_id,
    generic_revalidation_decision_id: sources.sourceRevalidation.decision_id,
    generic_revalidation_hash: sources.sourceRevalidation.content_hash,
    fcl_revalidation_receipt_hash: sources.revalidationReceipt.content_hash,
    bundle_id: sources.bundle.bundle_id,
    bundle_content_hash: sources.bundle.content_hash,
    action_permit_hash: sources.permit.content_hash,
    approval_hash: sources.approval.content_hash,
    target_binding_hash: sources.bundle.target.binding_hash,
    frontier: sources.bundle.target.expected_predecessor_frontier,
    created_at: envelope.created_at,
    expires_at: envelope.invocation.expires_at,
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    next_safe_action: 'PARAMETERIZE_INVOCATION_ACTION_RECEIPT_FCL_SOURCE',
    content_hash: '',
  };
  receipt.content_hash = hashWithoutContentHash(receipt);
  return receipt;
}

function validateReceipt(receipt, input = null, envelope = null, preparedSource = null) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'FCL' && receipt.version === '0.1', 'receipt header mismatch');
  req(receipt.receipt_type === 'FCLExecutionInvocationEnvelopeSourceBindingReceipt', 'receipt_type mismatch');
  for (const key of ['binding_id','envelope_id','invocation_id','adapter_id','generic_revalidation_decision_id','bundle_id','frontier','created_at','expires_at','next_safe_action']) {
    str(receipt[key], `receipt.${key}`);
  }
  for (const key of ['envelope_content_hash','generic_revalidation_hash','fcl_revalidation_receipt_hash','bundle_content_hash','action_permit_hash','approval_hash','target_binding_hash','content_hash']) {
    str(receipt[key], `receipt.${key}`, HASH);
  }
  instant(receipt.created_at, 'receipt.created_at');
  instant(receipt.expires_at, 'receipt.expires_at');
  exact(receipt.assertions, ASSERTION_KEYS, 'receipt.assertions');
  for (const key of ASSERTION_KEYS) req(receipt.assertions[key] === true, `receipt.assertions.${key} must be true`);
  exact(receipt.non_effects, NON_EFFECT_KEYS, 'receipt.non_effects');
  for (const key of NON_EFFECT_KEYS) req(receipt.non_effects[key] === false, `receipt.non_effects.${key} must be false`);
  req(receipt.next_safe_action === 'PARAMETERIZE_INVOCATION_ACTION_RECEIPT_FCL_SOURCE', 'receipt.next_safe_action mismatch');
  req(receipt.content_hash === hashWithoutContentHash(receipt), 'receipt content hash mismatch');

  if (input !== null) {
    const context = preparedSource === null ? prepareValidatedSource(input) : preparedSource;
    const sources = requirePreparedSource(input, context);
    const expectedEnvelope = buildEnvelopeWithSources(input, sources);
    const expected = buildReceiptUnchecked(input, expectedEnvelope, context);
    req(same(receipt, expected), 'invocation envelope source binding receipt is not exactly reproducible from input');
    if (envelope !== null) req(same(envelope, expectedEnvelope), 'supplied invocation envelope mismatch');
  }
  return true;
}

function materializeWithPreparedSource(input, preparedSource) {
  const sources = requirePreparedSource(input, preparedSource);
  const execution_invocation_envelope = buildEnvelopeWithSources(input, sources);
  const fcl_invocation_envelope_receipt = buildReceiptUnchecked(input, execution_invocation_envelope, preparedSource);
  validateReceipt(fcl_invocation_envelope_receipt);
  return { execution_invocation_envelope, fcl_invocation_envelope_receipt };
}

function materialize(input) {
  const preparedSource = prepareValidatedSource(input);
  return materializeWithPreparedSource(input, preparedSource);
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLExecutionInvocationEnvelopeSourceParameterizationError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('FCL Execution Invocation Envelope Source Parameterization v0.1 artifact-only CLI\nUsage: execution-invocation-envelope-source-parameterization.js validate|materialize|validate-receipt <json|->\nNo invoke/execute/emit/consume/interrupt/send/actuate command exists.\n');
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','materialize','validate-receipt'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') { validateInput(value); process.stdout.write('VALID\n'); }
  else if (command === 'materialize') process.stdout.write(`${JSON.stringify(materialize(value), null, 2)}\n`);
  else { validateReceipt(value); process.stdout.write('VALID\n'); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLExecutionInvocationEnvelopeSourceParameterizationError) {
      process.stderr.write(`FCL Execution Invocation Envelope Source Parameterization error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  ASSERTION_KEYS,
  FCLExecutionInvocationEnvelopeSourceParameterizationError,
  NON_EFFECT_KEYS,
  buildEnvelope,
  buildReceiptUnchecked,
  materialize,
  materializeWithPreparedSource,
  prepareValidatedSource,
  validateInput,
  validateReceipt,
};
