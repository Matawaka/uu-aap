#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildAuthorizePhase,
  buildReceiptUnchecked: buildAuthorizeReceiptUnchecked,
  hashObject,
  validateReceipt: validateAuthorizeBindingReceipt,
} = require('../execution-lifecycle-authorize-phase-binding/execution-lifecycle-authorize-phase-binding.js');
const {
  hashWithoutContentHash,
  stable,
  validateDecision,
} = require('../../../integration/execute-revalidation/v0.1/validate-parameterized-decision.js');

class FCLExecuteRevalidationSourceParameterizationError extends Error {
  constructor(message) { super(message); this.name = 'FCLExecuteRevalidationSourceParameterizationError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLExecuteRevalidationSourceParameterizationError(message); };
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
const SHA40 = /^[0-9a-f]{40}$/;
const HASH = /^sha256:[0-9a-f]{64}$/;

const INPUT_KEYS = [
  'protocol','version','profile','binding_id','decision_id','origin',
  'authorize_binding_input','authorize_phase','fcl_authorize_phase_receipt','evaluated_at'
];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','binding_id','decision_id','generic_revalidation_hash','decision_status',
  'authorize_phase_receipt_hash','generic_admission_hash','bundle_id','bundle_content_hash',
  'action_permit_hash','approval_hash','target_binding_hash','frontier',
  'authorization_must_occur_by','execute_revalidation_must_occur_by',
  'assertions','non_effects','next_safe_action','evaluated_at','content_hash'
];
const ASSERTION_KEYS = [
  'authorize_phase_exactly_bound','authorize_admission_exactly_bound','parameterized_validator_passed',
  'freshness_rechecked','action_permit_exactly_bound','approval_exactly_bound','target_exactly_bound',
  'frontier_exactly_bound','permit_unconsumed','ready_is_pre_execute_evidence_only'
];
const NON_EFFECT_KEYS = [
  'permit_consumed','invocation_envelope_created','actuator_invocation_emitted','action_receipt_created',
  'action_performed','outcome_observed','execute_phase_entered_as_effect','runtime_state_transitioned',
  'future_action_permission_created','authority_expanded'
];

const preparedContexts = new WeakSet();

function validateHeader(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1', 'input header mismatch');
  req(input.profile === 'execute-revalidation-source-parameterization-v0.1', 'input.profile mismatch');
  str(input.binding_id, 'input.binding_id');
  str(input.decision_id, 'input.decision_id');
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);
  instant(input.evaluated_at, 'input.evaluated_at');
  return true;
}

function deriveSourceFields(input) {
  const authorizeInput = input.authorize_binding_input;
  const sourceAdmission = authorizeInput.generic_assessment;
  const assessmentInput = authorizeInput.assessment_input;
  const bundle = assessmentInput.pre_action_bundle;
  const permit = bundle.core_receipts.action_permit;
  const approval = bundle.approval_binding;
  const authorizeReceipt = input.fcl_authorize_phase_receipt;

  req(sourceAdmission.decision.status === 'admissible', 'source admission must remain admissible');
  req(sourceAdmission.content_hash === input.authorize_phase.admission_assessment_ref.content_hash, 'authorize phase admission assessment hash mismatch');
  req(authorizeReceipt.generic_assessment_hash === sourceAdmission.content_hash, 'authorize receipt admission hash mismatch');
  req(authorizeReceipt.action_permit_hash === permit.content_hash, 'authorize receipt ActionPermit mismatch');
  req(authorizeReceipt.approval_hash === approval.content_hash, 'authorize receipt Approval mismatch');
  req(authorizeReceipt.target_binding_hash === bundle.target.binding_hash, 'authorize receipt target mismatch');
  req(authorizeReceipt.frontier === bundle.target.expected_predecessor_frontier, 'authorize receipt frontier mismatch');

  return { authorizeInput, sourceAdmission, assessmentInput, bundle, permit, approval, authorizeReceipt };
}

function validateRuntimeBoundary(input, sources) {
  const { sourceAdmission, permit, approval } = sources;
  const evaluatedAt = instant(input.evaluated_at, 'input.evaluated_at');
  req(instant(input.authorize_phase.authorized_at, 'authorize_phase.authorized_at') <= evaluatedAt, 'execute revalidation cannot predate authorize phase binding');
  req(instant(permit.issued_at, 'ActionPermit.issued_at') <= evaluatedAt, 'ActionPermit must pre-exist execute revalidation');
  req(permit.payload.one_shot === true && permit.payload.consumed === false, 'ActionPermit must remain one-shot and unconsumed');
  req(sourceAdmission.freshness_binding.permit_one_shot === true && sourceAdmission.freshness_binding.permit_consumed === false, 'admission permit state mismatch');
  for (const [label, value] of [
    ['availability_valid_until', sourceAdmission.freshness_binding.availability_valid_until],
    ['approval_valid_until', approval.valid_until],
    ['permit_expires_at', permit.payload.expires_at],
    ['authorization_must_occur_by', sourceAdmission.freshness_binding.authorization_must_occur_by],
  ]) req(evaluatedAt <= instant(value, label), `stale execute revalidation: evaluated_at > ${label}`);
  return true;
}

function prepareValidatedSource(input) {
  validateHeader(input);

  let expectedPhase;
  try { expectedPhase = buildAuthorizePhase(input.authorize_binding_input); }
  catch (error) { throw new FCLExecuteRevalidationSourceParameterizationError(`authorize binding input invalid: ${error.message}`); }
  req(same(input.authorize_phase, expectedPhase), 'authorize phase is not exactly reproducible from authorize_binding_input');

  const expectedReceipt = buildAuthorizeReceiptUnchecked(input.authorize_binding_input, expectedPhase);
  try { validateAuthorizeBindingReceipt(input.fcl_authorize_phase_receipt); }
  catch (error) { throw new FCLExecuteRevalidationSourceParameterizationError(`authorize phase receipt invalid: ${error.message}`); }
  req(same(input.fcl_authorize_phase_receipt, expectedReceipt), 'authorize phase receipt is not exactly reproducible from authorize_binding_input');
  req(input.fcl_authorize_phase_receipt.next_safe_action === 'PARAMETERIZE_EXECUTE_REVALIDATION_FCL_SOURCE', 'authorize phase next_safe_action mismatch');
  req(input.authorize_phase.status === 'authorized', 'authorize phase must be authorized');
  req(input.authorize_phase.one_shot === true && input.authorize_phase.consumed === false, 'authorize phase permit must remain one-shot and unconsumed');

  const sources = deriveSourceFields(input);
  validateRuntimeBoundary(input, sources);

  const context = {
    authorize_binding_input_canonical: stable(input.authorize_binding_input),
    authorize_phase_canonical: stable(input.authorize_phase),
    fcl_authorize_phase_receipt_canonical: stable(input.fcl_authorize_phase_receipt),
    sources: deepFreeze(clone(sources)),
  };
  deepFreeze(context);
  preparedContexts.add(context);
  return context;
}

function requirePreparedSource(input, context) {
  validateHeader(input);
  req(obj(context) && preparedContexts.has(context), 'prepared source context must originate from prepareValidatedSource');
  req(stable(input.authorize_binding_input) === context.authorize_binding_input_canonical, 'prepared source authorize binding input mismatch');
  req(stable(input.authorize_phase) === context.authorize_phase_canonical, 'prepared source authorize phase mismatch');
  req(stable(input.fcl_authorize_phase_receipt) === context.fcl_authorize_phase_receipt_canonical, 'prepared source authorize receipt mismatch');
  validateRuntimeBoundary(input, context.sources);
  return context.sources;
}

function validateInput(input, preparedSource = null) {
  if (preparedSource === null) prepareValidatedSource(input);
  else requirePreparedSource(input, preparedSource);
  return true;
}

function buildDecisionWithSource(input, sources) {
  const { sourceAdmission } = sources;
  const decision = {
    protocol: 'UU-AAP-EXECUTE-REVALIDATION',
    version: '0.1',
    artifact_type: 'ExecuteRevalidationDecision',
    decision_id: input.decision_id,
    evaluated_at: input.evaluated_at,
    authorize_admission_ref: {
      assessment_id: sourceAdmission.assessment_id,
      content_hash: sourceAdmission.content_hash,
      status: 'admissible',
    },
    subject: clone(sourceAdmission.subject),
    action_binding: clone(sourceAdmission.action_binding),
    freshness_binding: {
      availability_binding_hash: sourceAdmission.freshness_binding.availability_binding_hash,
      availability_valid_until: sourceAdmission.freshness_binding.availability_valid_until,
      approval_hash: sourceAdmission.freshness_binding.approval_hash,
      approval_valid_until: sourceAdmission.freshness_binding.approval_valid_until,
      action_permit_hash: sourceAdmission.freshness_binding.action_permit_hash,
      permit_expires_at: sourceAdmission.freshness_binding.permit_expires_at,
      authorization_must_occur_by: sourceAdmission.freshness_binding.authorization_must_occur_by,
      execute_revalidation_must_occur_by: sourceAdmission.freshness_binding.authorization_must_occur_by,
      permit_one_shot: true,
      permit_consumed: false,
    },
    lifecycle_binding: {
      protocol: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE',
      version: '0.1',
      source_phase: 'authorize',
      target_phase: 'execute',
      gate_role: 'pre_execute_evidence',
    },
    decision: {
      status: 'ready',
      reasons: [
        'authorize_admission_exact',
        'authorize_phase_exact',
        'freshness_rechecked_at_execute_boundary',
        'target_and_frontier_exact',
        'approval_exact',
        'permit_exact_and_unconsumed',
      ],
    },
    assertions: {
      authorize_admission_exactly_bound: true,
      freshness_rechecked_at_execute_boundary: true,
      target_exactly_bound: true,
      frontier_exactly_bound: true,
      approval_exactly_bound: true,
      permit_exactly_bound: true,
      permit_preexists_revalidation: true,
      permit_unconsumed: true,
      execute_phase_only: true,
    },
    non_effects: {
      intent_created: false,
      authority_created_or_expanded: false,
      approval_created: false,
      core_action_permit_created: false,
      permit_consumed: false,
      actuator_invocation_emitted: false,
      action_performed: false,
      outcome_observed: false,
      availability_lifetime_extended: false,
      future_action_permission_created: false,
      general_authority_created: false,
      causality_proven: false,
      truth_certified: false,
      liability_established: false,
    },
    content_hash: '',
  };
  decision.content_hash = hashWithoutContentHash(decision);
  try { validateDecision(decision, sourceAdmission); }
  catch (error) { throw new FCLExecuteRevalidationSourceParameterizationError(`parameterized Execute Revalidation validation failed: ${error.message}`); }
  return decision;
}

function buildDecision(input, preparedSource = null) {
  const context = preparedSource === null ? prepareValidatedSource(input) : preparedSource;
  const sources = requirePreparedSource(input, context);
  return buildDecisionWithSource(input, sources);
}

function buildReceiptUnchecked(input, decision, preparedSource = null) {
  const sources = preparedSource === null ? deriveSourceFields(input) : requirePreparedSource(input, preparedSource);
  const { sourceAdmission, bundle, permit, approval, authorizeReceipt } = sources;
  const receipt = {
    protocol: 'FCL', version: '0.1', receipt_type: 'FCLExecuteRevalidationSourceBindingReceipt',
    binding_id: input.binding_id,
    decision_id: decision.decision_id,
    generic_revalidation_hash: decision.content_hash,
    decision_status: decision.decision.status,
    authorize_phase_receipt_hash: authorizeReceipt.content_hash,
    generic_admission_hash: sourceAdmission.content_hash,
    bundle_id: bundle.bundle_id,
    bundle_content_hash: bundle.content_hash,
    action_permit_hash: permit.content_hash,
    approval_hash: approval.content_hash,
    target_binding_hash: bundle.target.binding_hash,
    frontier: bundle.target.expected_predecessor_frontier,
    authorization_must_occur_by: sourceAdmission.freshness_binding.authorization_must_occur_by,
    execute_revalidation_must_occur_by: decision.freshness_binding.execute_revalidation_must_occur_by,
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    next_safe_action: 'PARAMETERIZE_EXECUTION_INVOCATION_ENVELOPE_FCL_SOURCE',
    evaluated_at: input.evaluated_at,
    content_hash: '',
  };
  receipt.content_hash = hashObject(receipt);
  return receipt;
}

function validateReceipt(receipt, input = null, decision = null, preparedSource = null) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'FCL' && receipt.version === '0.1', 'receipt header mismatch');
  req(receipt.receipt_type === 'FCLExecuteRevalidationSourceBindingReceipt', 'receipt_type mismatch');
  for (const key of ['binding_id','decision_id','decision_status','bundle_id','frontier','authorization_must_occur_by','execute_revalidation_must_occur_by','next_safe_action','evaluated_at']) str(receipt[key], `receipt.${key}`);
  for (const key of ['generic_revalidation_hash','authorize_phase_receipt_hash','generic_admission_hash','bundle_content_hash','action_permit_hash','approval_hash','target_binding_hash','content_hash']) str(receipt[key], `receipt.${key}`, HASH);
  req(receipt.decision_status === 'ready', 'receipt decision_status must be ready');
  instant(receipt.authorization_must_occur_by, 'receipt.authorization_must_occur_by');
  instant(receipt.execute_revalidation_must_occur_by, 'receipt.execute_revalidation_must_occur_by');
  instant(receipt.evaluated_at, 'receipt.evaluated_at');
  req(receipt.execute_revalidation_must_occur_by === receipt.authorization_must_occur_by, 'receipt execute horizon mismatch');
  exact(receipt.assertions, ASSERTION_KEYS, 'receipt.assertions');
  for (const key of ASSERTION_KEYS) req(receipt.assertions[key] === true, `receipt.assertions.${key} must be true`);
  exact(receipt.non_effects, NON_EFFECT_KEYS, 'receipt.non_effects');
  for (const key of NON_EFFECT_KEYS) req(receipt.non_effects[key] === false, `receipt.non_effects.${key} must be false`);
  req(receipt.next_safe_action === 'PARAMETERIZE_EXECUTION_INVOCATION_ENVELOPE_FCL_SOURCE', 'receipt.next_safe_action mismatch');
  req(receipt.content_hash === hashObject(receipt), 'receipt content hash mismatch');

  if (input !== null) {
    const context = preparedSource === null ? prepareValidatedSource(input) : preparedSource;
    const sources = requirePreparedSource(input, context);
    const expectedDecision = buildDecisionWithSource(input, sources);
    const expected = buildReceiptUnchecked(input, expectedDecision, context);
    req(same(receipt, expected), 'revalidation source binding receipt is not exactly reproducible from input');
    if (decision !== null) req(same(decision, expectedDecision), 'supplied revalidation decision mismatch');
  }
  return true;
}

function revalidateWithPreparedSource(input, preparedSource) {
  const sources = requirePreparedSource(input, preparedSource);
  const generic_revalidation_decision = buildDecisionWithSource(input, sources);
  const fcl_revalidation_receipt = buildReceiptUnchecked(input, generic_revalidation_decision, preparedSource);
  validateReceipt(fcl_revalidation_receipt);
  return { generic_revalidation_decision, fcl_revalidation_receipt };
}

function revalidate(input) {
  const preparedSource = prepareValidatedSource(input);
  return revalidateWithPreparedSource(input, preparedSource);
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLExecuteRevalidationSourceParameterizationError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('FCL Execute Revalidation Source Parameterization v0.1 artifact-only CLI\nUsage: execute-revalidation-source-parameterization.js validate|revalidate|validate-receipt <json|->\nNo invoke/execute/probe/consume/interrupt/send/actuate command exists.\n');
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','revalidate','validate-receipt'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') { validateInput(value); process.stdout.write('VALID\n'); }
  else if (command === 'revalidate') process.stdout.write(`${JSON.stringify(revalidate(value), null, 2)}\n`);
  else { validateReceipt(value); process.stdout.write('VALID\n'); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLExecuteRevalidationSourceParameterizationError) {
      process.stderr.write(`FCL Execute Revalidation Source Parameterization error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  ASSERTION_KEYS,
  FCLExecuteRevalidationSourceParameterizationError,
  NON_EFFECT_KEYS,
  buildDecision,
  buildReceiptUnchecked,
  prepareValidatedSource,
  revalidate,
  revalidateWithPreparedSource,
  validateInput,
  validateReceipt,
};
