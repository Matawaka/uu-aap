#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  evaluate: evaluateAssessment,
  hashObject,
  validateBindingReceipt: validateAssessmentReceipt,
  validateInput: validateAssessmentInput,
} = require('../pre-action-authorize-admission-assessment/pre-action-authorize-admission-assessment.js');
const {
  validateAuthorizePhase,
} = require('../../../integration/execution-lifecycle/v0.1/validate-authorize-phase.js');

class FCLExecutionLifecycleAuthorizePhaseBindingError extends Error {
  constructor(message) { super(message); this.name = 'FCLExecutionLifecycleAuthorizePhaseBindingError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLExecutionLifecycleAuthorizePhaseBindingError(message); };
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
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
const HASH = /^sha256:[0-9a-f]{64}$/;
const SHA40 = /^[0-9a-f]{40}$/;

const INPUT_KEYS = [
  'protocol','version','profile','binding_id','origin',
  'assessment_input','generic_assessment','fcl_assessment_receipt','authorized_at'
];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','binding_id',
  'source_assessment_id','generic_assessment_hash','fcl_assessment_receipt_hash',
  'assembly_receipt_hash','bundle_id','bundle_content_hash',
  'action_permit_hash','approval_hash','target_binding_hash','frontier',
  'authorization_must_occur_by','authorize_phase','assertions','non_effects',
  'next_safe_action','authorized_at','content_hash'
];
const ASSERTION_KEYS = [
  'assessment_admissible','assessment_exactly_bound','authorize_phase_generic_validation_passed',
  'action_permit_exactly_bound','approval_exactly_bound','target_exactly_bound',
  'frontier_exactly_bound','permit_preexists_admission','partial_lifecycle_only',
  'no_future_phase_synthesized'
];
const NON_EFFECT_KEYS = [
  'permit_consumed','execute_revalidation_ready','execute_phase_entered','execution_admitted',
  'actuator_invocation_emitted','action_performed','outcome_observed',
  'runtime_state_transitioned','future_action_permission_created','authority_expanded',
  'successor_state_created','completed_lifecycle_created'
];

function validateSources(input) {
  try { validateAssessmentInput(input.assessment_input); }
  catch (error) { throw new FCLExecutionLifecycleAuthorizePhaseBindingError(`assessment input invalid: ${error.message}`); }

  const expected = evaluateAssessment(input.assessment_input);
  req(same(input.generic_assessment, expected.generic_assessment), 'generic assessment is not exactly reproducible from assessment_input');
  try {
    validateAssessmentReceipt(input.fcl_assessment_receipt, input.assessment_input, input.generic_assessment);
  } catch (error) {
    throw new FCLExecutionLifecycleAuthorizePhaseBindingError(`FCL assessment receipt invalid: ${error.message}`);
  }
  req(same(input.fcl_assessment_receipt, expected.fcl_assessment_receipt), 'FCL assessment receipt is not exactly reproducible from assessment_input');
  req(input.generic_assessment.decision.status === 'admissible', 'authorize phase requires admissible assessment');
  req(input.fcl_assessment_receipt.decision_status === 'admissible', 'FCL assessment receipt must be admissible');
  req(input.fcl_assessment_receipt.next_safe_action === 'BIND_EXECUTION_LIFECYCLE_AUTHORIZE_PHASE', 'assessment next_safe_action mismatch');
  return expected;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1', 'input header mismatch');
  req(input.profile === 'execution-lifecycle-authorize-phase-binding-v0.1', 'input.profile mismatch');
  str(input.binding_id, 'input.binding_id');
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);

  validateSources(input);
  const bundle = input.assessment_input.pre_action_bundle;
  const permit = bundle.core_receipts.action_permit;
  const approval = bundle.approval_binding;
  const assessment = input.generic_assessment;
  const receipt = input.fcl_assessment_receipt;
  const authorizedAt = instant(input.authorized_at, 'input.authorized_at');
  const assessedAt = instant(assessment.evaluated_at, 'generic_assessment.evaluated_at');
  const permitAt = instant(permit.issued_at, 'ActionPermit.issued_at');
  const horizon = instant(bundle.lifecycle_handoff.authorization_must_occur_by, 'authorization_must_occur_by');

  req(permitAt <= assessedAt, 'ActionPermit must pre-exist admission assessment');
  req(assessedAt <= authorizedAt, 'authorized_at cannot precede admission assessment');
  req(authorizedAt <= horizon, 'authorize phase binding after authorization horizon');
  req(authorizedAt <= instant(permit.payload.expires_at, 'ActionPermit.expires_at'), 'authorize phase binding after ActionPermit expiry');
  req(authorizedAt <= instant(approval.valid_until, 'Approval.valid_until'), 'authorize phase binding after Approval expiry');
  req(authorizedAt <= instant(bundle.availability_binding.valid_until, 'Availability.valid_until'), 'authorize phase binding after Availability expiry');
  req(permit.payload.one_shot === true && permit.payload.consumed === false, 'ActionPermit must remain one-shot and unconsumed');
  req(receipt.action_permit_hash === permit.content_hash, 'assessment receipt ActionPermit mismatch');
  req(receipt.approval_hash === approval.content_hash, 'assessment receipt Approval mismatch');
  req(receipt.target_binding_hash === bundle.target.binding_hash, 'assessment receipt target mismatch');
  req(receipt.frontier === bundle.target.expected_predecessor_frontier, 'assessment receipt frontier mismatch');
  return true;
}

function buildAuthorizePhase(input) {
  validateInput(input);
  const bundle = input.assessment_input.pre_action_bundle;
  const permit = bundle.core_receipts.action_permit;
  const assessment = input.generic_assessment;
  const phase = {
    status: 'authorized',
    frontier: bundle.target.expected_predecessor_frontier,
    action_permit_issued_at: permit.issued_at,
    admission_assessed_at: assessment.evaluated_at,
    authorized_at: input.authorized_at,
    expires_at: permit.payload.expires_at,
    action_permit_ref: { receipt_type: 'ActionPermit', content_hash: permit.content_hash, frontier: bundle.target.expected_predecessor_frontier },
    approval_ref: { receipt_type: 'ActionSpecificApprovalBinding', content_hash: bundle.approval_binding.content_hash, frontier: bundle.target.expected_predecessor_frontier },
    admission_assessment_ref: { receipt_type: 'PreActionAuthorizeAdmissionAssessment', content_hash: assessment.content_hash, frontier: bundle.target.expected_predecessor_frontier },
    target_binding_hash: bundle.target.binding_hash,
    one_shot: true,
    consumed: false,
    assertions: { action_specific: true, exact_target_bound: true, permit_preexists_admission: true },
    non_effects: { action_performed: false, authority_expanded: false, future_action_authorized: false, action_permit_created_by_adapter: false },
  };
  try {
    validateAuthorizePhase(phase, {
      predecessor_frontier: bundle.target.expected_predecessor_frontier,
      target_binding_hash: bundle.target.binding_hash,
      requires_approval: true,
    });
  } catch (error) {
    throw new FCLExecutionLifecycleAuthorizePhaseBindingError(`generic authorize phase validation failed: ${error.message}`);
  }
  return phase;
}

function buildReceiptUnchecked(input, phase) {
  const bundle = input.assessment_input.pre_action_bundle;
  const assessment = input.generic_assessment;
  const assessmentReceipt = input.fcl_assessment_receipt;
  const receipt = {
    protocol: 'FCL', version: '0.1', receipt_type: 'FCLExecutionLifecycleAuthorizePhaseBindingReceipt',
    binding_id: input.binding_id,
    source_assessment_id: assessment.assessment_id,
    generic_assessment_hash: assessment.content_hash,
    fcl_assessment_receipt_hash: assessmentReceipt.content_hash,
    assembly_receipt_hash: assessmentReceipt.assembly_receipt_hash,
    bundle_id: bundle.bundle_id,
    bundle_content_hash: bundle.content_hash,
    action_permit_hash: bundle.core_receipts.action_permit.content_hash,
    approval_hash: bundle.approval_binding.content_hash,
    target_binding_hash: bundle.target.binding_hash,
    frontier: bundle.target.expected_predecessor_frontier,
    authorization_must_occur_by: bundle.lifecycle_handoff.authorization_must_occur_by,
    authorize_phase: clone(phase),
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    next_safe_action: 'PARAMETERIZE_EXECUTE_REVALIDATION_FCL_SOURCE',
    authorized_at: input.authorized_at,
    content_hash: '',
  };
  receipt.content_hash = hashObject(receipt);
  return receipt;
}

function validateReceipt(receipt, input = null, phase = null) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'FCL' && receipt.version === '0.1', 'receipt header mismatch');
  req(receipt.receipt_type === 'FCLExecutionLifecycleAuthorizePhaseBindingReceipt', 'receipt_type mismatch');
  for (const key of ['binding_id','source_assessment_id','bundle_id','frontier','authorization_must_occur_by','next_safe_action','authorized_at']) str(receipt[key], `receipt.${key}`);
  for (const key of ['generic_assessment_hash','fcl_assessment_receipt_hash','assembly_receipt_hash','bundle_content_hash','action_permit_hash','approval_hash','target_binding_hash','content_hash']) str(receipt[key], `receipt.${key}`, HASH);
  instant(receipt.authorization_must_occur_by, 'receipt.authorization_must_occur_by');
  instant(receipt.authorized_at, 'receipt.authorized_at');
  exact(receipt.assertions, ASSERTION_KEYS, 'receipt.assertions');
  for (const key of ASSERTION_KEYS) req(receipt.assertions[key] === true, `receipt.assertions.${key} must be true`);
  exact(receipt.non_effects, NON_EFFECT_KEYS, 'receipt.non_effects');
  for (const key of NON_EFFECT_KEYS) req(receipt.non_effects[key] === false, `receipt.non_effects.${key} must be false`);
  req(receipt.next_safe_action === 'PARAMETERIZE_EXECUTE_REVALIDATION_FCL_SOURCE', 'receipt.next_safe_action mismatch');
  req(!Object.prototype.hasOwnProperty.call(receipt, 'execute'), 'receipt must not synthesize execute phase');
  req(!Object.prototype.hasOwnProperty.call(receipt, 'observe'), 'receipt must not synthesize observe phase');
  req(!Object.prototype.hasOwnProperty.call(receipt, 'close'), 'receipt must not synthesize close phase');
  try {
    validateAuthorizePhase(receipt.authorize_phase, { predecessor_frontier: receipt.frontier, target_binding_hash: receipt.target_binding_hash, requires_approval: true });
  } catch (error) {
    throw new FCLExecutionLifecycleAuthorizePhaseBindingError(`receipt authorize phase invalid: ${error.message}`);
  }
  req(receipt.content_hash === hashObject(receipt), 'receipt content hash mismatch');

  if (input !== null) {
    validateInput(input);
    const expectedPhase = buildAuthorizePhase(input);
    const expected = buildReceiptUnchecked(input, expectedPhase);
    req(same(receipt, expected), 'authorize binding receipt is not exactly reproducible from input');
    if (phase !== null) req(same(phase, expectedPhase), 'authorize phase mismatch');
  }
  return true;
}

function bind(input) {
  const authorize_phase = buildAuthorizePhase(input);
  const fcl_authorize_phase_receipt = buildReceiptUnchecked(input, authorize_phase);
  validateReceipt(fcl_authorize_phase_receipt, input, authorize_phase);
  return { authorize_phase, fcl_authorize_phase_receipt };
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLExecutionLifecycleAuthorizePhaseBindingError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('FCL Execution Lifecycle Authorize Phase Binding v0.1 artifact-only CLI\nUsage: execution-lifecycle-authorize-phase-binding.js validate|bind|validate-receipt <json|->\nNo execute/probe/consume/interrupt/send/actuate command exists.\n');
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','bind','validate-receipt'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') { validateInput(value); process.stdout.write('VALID\n'); }
  else if (command === 'bind') process.stdout.write(`${JSON.stringify(bind(value), null, 2)}\n`);
  else { validateReceipt(value); process.stdout.write('VALID\n'); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLExecutionLifecycleAuthorizePhaseBindingError) {
      process.stderr.write(`FCL Execution Lifecycle Authorize Phase Binding error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = { ASSERTION_KEYS, FCLExecutionLifecycleAuthorizePhaseBindingError, NON_EFFECT_KEYS, bind, buildAuthorizePhase, buildReceiptUnchecked, hashObject, validateInput, validateReceipt };
