#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  buildAssemblyReceipt,
  buildBundle,
  validateAssemblyReceipt,
  validateInput: validateAssemblyInput,
} = require('../pre-action-bundle-assembly/pre-action-bundle-assembly.js');
const {
  computeContentHash,
  stableCanonicalize,
  validateAssessment,
} = require('../../../integration/pre-action-authorize-admission/v0.1/validate-authorize-admission.js');

class FCLPreActionAuthorizeAdmissionAssessmentError extends Error {
  constructor(message) { super(message); this.name = 'FCLPreActionAuthorizeAdmissionAssessmentError'; }
}

const req = (condition, message) => { if (!condition) throw new FCLPreActionAuthorizeAdmissionAssessmentError(message); };
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const clone = value => JSON.parse(JSON.stringify(value));
const same = (a, b) => stableCanonicalize(a) === stableCanonicalize(b);
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
  'protocol','version','profile','assessment_id','origin','assembly_input',
  'pre_action_bundle','assembly_receipt','evaluated_at'
];
const RECEIPT_KEYS = [
  'protocol','version','receipt_type','assessment_id','adapter_id',
  'generic_assessment_hash','decision_status','assembly_id','assembly_receipt_hash',
  'bundle_id','bundle_content_hash','action_permit_hash','approval_hash',
  'target_binding_hash','frontier','authorization_must_occur_by','evaluated_at',
  'assertions','non_effects','next_safe_action','content_hash'
];
const ASSERTION_KEYS = [
  'assembly_exactly_bound','bundle_exactly_bound','generic_assessment_validated',
  'adapter_assessment_optional_evidence','permit_preexists_assessment',
  'assessment_does_not_authorize','decision_reflects_generic_assessment'
];
const NON_EFFECT_KEYS = [
  'authorize_admitted','permit_consumed','execution_admitted','execute_phase_entered',
  'action_performed','authority_created_or_expanded','approval_created','action_permit_created',
  'availability_lifetime_extended','future_action_permission_created','runtime_state_transitioned'
];

function hashObject(value) {
  const projected = clone(value);
  delete projected.content_hash;
  return `sha256:${crypto.createHash('sha256').update(Buffer.from(stableCanonicalize(projected), 'utf8')).digest('hex')}`;
}

function validateSources(input) {
  try { validateAssemblyInput(input.assembly_input); }
  catch (error) { throw new FCLPreActionAuthorizeAdmissionAssessmentError(`assembly input invalid: ${error.message}`); }
  const expectedBundle = buildBundle(input.assembly_input);
  req(same(input.pre_action_bundle, expectedBundle), 'pre_action_bundle is not exactly reproducible from assembly_input');
  try { validateAssemblyReceipt(input.assembly_receipt, input.assembly_input, input.pre_action_bundle); }
  catch (error) { throw new FCLPreActionAuthorizeAdmissionAssessmentError(`assembly receipt invalid: ${error.message}`); }
  const expectedReceipt = buildAssemblyReceipt(input.assembly_input, expectedBundle);
  req(same(input.assembly_receipt, expectedReceipt), 'assembly_receipt is not exactly reproducible from assembly_input');
  req(input.assembly_receipt.next_safe_action === 'EVALUATE_PRE_ACTION_AUTHORIZE_ADMISSION', 'assembly next_safe_action mismatch');
  return { bundle: expectedBundle, assemblyReceipt: expectedReceipt };
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'FCL' && input.version === '0.1', 'input header mismatch');
  req(input.profile === 'pre-action-authorize-admission-assessment-v0.1', 'input.profile mismatch');
  str(input.assessment_id, 'input.assessment_id');
  exact(input.origin, ['repository','revision','tree'], 'input.origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'input.origin.repository mismatch');
  str(input.origin.revision, 'input.origin.revision', SHA40);
  str(input.origin.tree, 'input.origin.tree', SHA40);
  const { bundle, assemblyReceipt } = validateSources(input);
  const evaluatedAt = instant(input.evaluated_at, 'input.evaluated_at');
  req(evaluatedAt >= instant(bundle.assembled_at, 'bundle.assembled_at'), 'assessment cannot precede bundle assembly');
  req(evaluatedAt >= instant(assemblyReceipt.assembled_at, 'assembly_receipt.assembled_at'), 'assessment cannot precede assembly receipt');
  req(evaluatedAt >= instant(bundle.core_receipts.action_permit.issued_at, 'ActionPermit.issued_at'), 'assessment cannot precede ActionPermit');
  return true;
}

function decisionFor(bundle, evaluatedAt) {
  const t = instant(evaluatedAt, 'evaluated_at');
  const horizon = instant(bundle.lifecycle_handoff.authorization_must_occur_by, 'authorization_must_occur_by');
  const availability = instant(bundle.availability_binding.valid_until, 'availability_valid_until');
  const approval = instant(bundle.approval_binding.valid_until, 'approval_valid_until');
  const permit = instant(bundle.core_receipts.action_permit.payload.expires_at, 'permit_expires_at');
  const fresh = t <= horizon && t <= availability && t <= approval && t <= permit;
  const oneShot = bundle.core_receipts.action_permit.payload.one_shot === true;
  const unconsumed = bundle.core_receipts.action_permit.payload.consumed === false;
  return { admissible: fresh && oneShot && unconsumed, fresh, oneShot, unconsumed };
}

function buildGenericAssessment(input) {
  validateInput(input);
  const bundle = input.pre_action_bundle;
  const d = decisionFor(bundle, input.evaluated_at);
  const admissibleReasons = [
    'bundle_exact','bundle_authorize_handoff_complete','freshness_valid_at_decision',
    'target_and_frontier_exact','approval_exact','permit_exact_and_unconsumed'
  ];
  const deniedReasons = [
    d.fresh ? 'permit_not_admissible' : 'freshness_not_valid_at_decision',
    'admission_assessment_is_optional_evidence','no_authorize_phase_successor'
  ];
  const assessment = {
    protocol: 'UU-AAP-PRE-ACTION-AUTHORIZE-ADMISSION',
    version: '0.1',
    artifact_type: 'PreActionAuthorizeAdmissionAssessment',
    assessment_id: input.assessment_id,
    adapter_id: 'urn:uu-aap:adapter:fcl-pre-action-authorize-admission:v0.1',
    evaluated_at: input.evaluated_at,
    pre_action_bundle_ref: { bundle_id: bundle.bundle_id, content_hash: bundle.content_hash },
    subject: clone(bundle.subject),
    action_binding: {
      capability_id: bundle.selection_binding.selected_capability_id,
      operation: bundle.selection_binding.operation,
      authority_scope: bundle.target.authority_scope,
      target_binding_hash: bundle.target.binding_hash,
      predecessor_frontier: bundle.target.expected_predecessor_frontier,
    },
    freshness_binding: {
      availability_binding_hash: bundle.availability_binding.content_hash,
      availability_valid_until: bundle.availability_binding.valid_until,
      approval_hash: bundle.approval_binding.content_hash,
      approval_valid_until: bundle.approval_binding.valid_until,
      action_permit_hash: bundle.core_receipts.action_permit.content_hash,
      permit_expires_at: bundle.core_receipts.action_permit.payload.expires_at,
      authorization_must_occur_by: bundle.lifecycle_handoff.authorization_must_occur_by,
      permit_one_shot: bundle.core_receipts.action_permit.payload.one_shot,
      permit_consumed: bundle.core_receipts.action_permit.payload.consumed,
    },
    lifecycle_binding: {
      protocol: 'UU-AAP-BOUNDED-EXECUTION-LIFECYCLE', version: '0.1',
      phase: 'authorize', admission_assessment_role: 'optional_evidence',
    },
    decision: { status: d.admissible ? 'admissible' : 'denied', reasons: d.admissible ? admissibleReasons : deniedReasons },
    assertions: {
      bundle_exactly_bound: true,
      authorize_handoff_rechecked: true,
      freshness_valid_at_decision: d.fresh,
      target_exactly_bound: true,
      approval_exactly_bound: true,
      permit_exactly_bound: true,
      permit_preexists_admission: true,
      permit_unconsumed: d.unconsumed,
      admission_is_optional_evidence: true,
    },
    non_effects: {
      intent_created: false,
      authority_created_or_expanded: false,
      approval_created: false,
      core_action_permit_created: false,
      permit_consumed: false,
      action_performed: false,
      execute_phase_entered: false,
      availability_lifetime_extended: false,
      future_action_permission_created: false,
      general_authority_created: false,
      causality_proven: false,
      truth_certified: false,
      liability_established: false,
    },
    content_hash: '',
  };
  assessment.content_hash = computeContentHash(assessment);
  try { validateAssessment(assessment, bundle); }
  catch (error) { throw new FCLPreActionAuthorizeAdmissionAssessmentError(`generic admission assessment validation failed: ${error.message}`); }
  return assessment;
}

function buildBindingReceiptUnchecked(input, assessment) {
  const bundle = input.pre_action_bundle;
  const assembly = input.assembly_receipt;
  const receipt = {
    protocol: 'FCL', version: '0.1', receipt_type: 'FCLPreActionAuthorizeAdmissionAssessmentReceipt',
    assessment_id: assessment.assessment_id,
    adapter_id: assessment.adapter_id,
    generic_assessment_hash: assessment.content_hash,
    decision_status: assessment.decision.status,
    assembly_id: assembly.assembly_id,
    assembly_receipt_hash: assembly.content_hash,
    bundle_id: bundle.bundle_id,
    bundle_content_hash: bundle.content_hash,
    action_permit_hash: bundle.core_receipts.action_permit.content_hash,
    approval_hash: bundle.approval_binding.content_hash,
    target_binding_hash: bundle.target.binding_hash,
    frontier: bundle.target.expected_predecessor_frontier,
    authorization_must_occur_by: bundle.lifecycle_handoff.authorization_must_occur_by,
    evaluated_at: input.evaluated_at,
    assertions: Object.fromEntries(ASSERTION_KEYS.map(key => [key, true])),
    non_effects: Object.fromEntries(NON_EFFECT_KEYS.map(key => [key, false])),
    next_safe_action: assessment.decision.status === 'admissible' ? 'BIND_EXECUTION_LIFECYCLE_AUTHORIZE_PHASE' : 'NONE',
    content_hash: '',
  };
  receipt.content_hash = hashObject(receipt);
  return receipt;
}

function validateBindingReceipt(receipt, input = null, assessment = null) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'FCL' && receipt.version === '0.1', 'receipt header mismatch');
  req(receipt.receipt_type === 'FCLPreActionAuthorizeAdmissionAssessmentReceipt', 'receipt_type mismatch');
  for (const key of ['assessment_id','adapter_id','decision_status','assembly_id','bundle_id','frontier','authorization_must_occur_by','evaluated_at','next_safe_action']) str(receipt[key], `receipt.${key}`);
  for (const key of ['generic_assessment_hash','assembly_receipt_hash','bundle_content_hash','action_permit_hash','approval_hash','target_binding_hash','content_hash']) str(receipt[key], `receipt.${key}`, HASH);
  req(['admissible','denied'].includes(receipt.decision_status), 'receipt.decision_status mismatch');
  instant(receipt.authorization_must_occur_by, 'receipt.authorization_must_occur_by');
  instant(receipt.evaluated_at, 'receipt.evaluated_at');
  exact(receipt.assertions, ASSERTION_KEYS, 'receipt.assertions');
  for (const key of ASSERTION_KEYS) req(receipt.assertions[key] === true, `receipt.assertions.${key} must be true`);
  exact(receipt.non_effects, NON_EFFECT_KEYS, 'receipt.non_effects');
  for (const key of NON_EFFECT_KEYS) req(receipt.non_effects[key] === false, `receipt.non_effects.${key} must be false`);
  if (receipt.decision_status === 'admissible') req(receipt.next_safe_action === 'BIND_EXECUTION_LIFECYCLE_AUTHORIZE_PHASE', 'admissible next_safe_action mismatch');
  else req(receipt.next_safe_action === 'NONE', 'denied assessment must not claim authorize-phase successor');
  req(receipt.content_hash === hashObject(receipt), 'receipt content hash mismatch');
  if (input !== null) {
    validateInput(input);
    const expectedAssessment = buildGenericAssessment(input);
    const expected = buildBindingReceiptUnchecked(input, expectedAssessment);
    req(same(receipt, expected), 'binding receipt is not exactly reproducible from input');
    if (assessment !== null) req(same(assessment, expectedAssessment), 'generic assessment mismatch');
  }
  return true;
}

function evaluate(input) {
  const generic_assessment = buildGenericAssessment(input);
  const fcl_assessment_receipt = buildBindingReceiptUnchecked(input, generic_assessment);
  validateBindingReceipt(fcl_assessment_receipt, input, generic_assessment);
  return { generic_assessment, fcl_assessment_receipt };
}

function readJson(inputPath) {
  req(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); }
  catch (error) { throw new FCLPreActionAuthorizeAdmissionAssessmentError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write(
      'FCL PreAction Authorize Admission Assessment v0.1 read-only CLI\n' +
      'Usage: pre-action-authorize-admission-assessment.js validate|evaluate|validate-receipt <json|->\n' +
      'No authorize/execute/probe/consume/interrupt/send command exists.\n'
    );
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate','evaluate','validate-receipt'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate') { validateInput(value); process.stdout.write('VALID\n'); }
  else if (command === 'evaluate') process.stdout.write(`${JSON.stringify(evaluate(value), null, 2)}\n`);
  else { validateBindingReceipt(value); process.stdout.write('VALID\n'); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof FCLPreActionAuthorizeAdmissionAssessmentError) {
      process.stderr.write(`FCL PreAction Authorize Admission Assessment error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = {
  ASSERTION_KEYS,
  FCLPreActionAuthorizeAdmissionAssessmentError,
  NON_EFFECT_KEYS,
  buildGenericAssessment,
  buildBindingReceiptUnchecked,
  decisionFor,
  evaluate,
  hashObject,
  validateBindingReceipt,
  validateInput,
};
