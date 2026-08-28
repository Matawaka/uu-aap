'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { bind, buildAuthorizePhase, hashObject, validateInput, validateReceipt } = require('./execution-lifecycle-authorize-phase-binding.js');
const { evaluate: evaluateAssessment } = require('../pre-action-authorize-admission-assessment/pre-action-authorize-admission-assessment.js');
const { validateAuthorizePhase } = require('../../../integration/execution-lifecycle/v0.1/validate-authorize-phase.js');

const ROOT = __dirname;
const clone = value => JSON.parse(JSON.stringify(value));
const ORIGIN = { repository: 'Matawaka/uu-aap', revision: 'ee4970e207954bc0ef7f2273b1a3ec975d76eed8', tree: '7cb42957a8bdd549115afb022bb57cb46dc30361' };

function expectFailure(label, fn, pattern = null) {
  let failed = false;
  try { fn(); }
  catch (error) {
    failed = true;
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function loadAssessmentArtifacts() {
  const cached = {
    input: process.env.FCL_AUTHORIZE_CACHED_ASSESSMENT_INPUT,
    generic: process.env.FCL_AUTHORIZE_CACHED_GENERIC_ASSESSMENT,
    receipt: process.env.FCL_AUTHORIZE_CACHED_ASSESSMENT_RECEIPT,
  };
  if (cached.input && cached.generic && cached.receipt && Object.values(cached).every(p => fs.existsSync(p))) {
    return {
      input: JSON.parse(fs.readFileSync(cached.input, 'utf8')),
      generic: JSON.parse(fs.readFileSync(cached.generic, 'utf8')),
      receipt: JSON.parse(fs.readFileSync(cached.receipt, 'utf8')),
    };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-authorize-assessment-'));
  const inputPath = path.join(dir, 'assessment-input.json');
  const genericPath = path.join(dir, 'generic-assessment.json');
  const receiptPath = path.join(dir, 'fcl-assessment-receipt.json');
  const script = path.resolve(ROOT, '..', 'pre-action-authorize-admission-assessment', 'test-pre-action-authorize-admission-assessment.js');
  const run = spawnSync(process.execPath, [script, inputPath, genericPath, receiptPath], { stdio: 'ignore', timeout: 180000 });
  assert.strictEqual(run.status, 0, `assessment source failed: ${run.error ? run.error.message : 'non-zero status'}`);
  return {
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
    generic: JSON.parse(fs.readFileSync(genericPath, 'utf8')),
    receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
  };
}

const assessment = loadAssessmentArtifacts();

function positiveInput(authorizedAt = '2026-08-27T18:01:14Z') {
  return {
    protocol: 'FCL', version: '0.1', profile: 'execution-lifecycle-authorize-phase-binding-v0.1',
    binding_id: 'fcl-execution-authorize-interrupt-v0-1', origin: clone(ORIGIN),
    assessment_input: clone(assessment.input), generic_assessment: clone(assessment.generic),
    fcl_assessment_receipt: clone(assessment.receipt), authorized_at: authorizedAt,
  };
}

function testPositiveBinding() {
  const input = positiveInput();
  assert.strictEqual(validateInput(input), true);
  const result = bind(input);
  assert.strictEqual(result.authorize_phase.status, 'authorized');
  assert.strictEqual(result.authorize_phase.one_shot, true);
  assert.strictEqual(result.authorize_phase.consumed, false);
  assert.strictEqual(result.fcl_authorize_phase_receipt.next_safe_action, 'PARAMETERIZE_EXECUTE_REVALIDATION_FCL_SOURCE');
  assert.strictEqual(validateReceipt(result.fcl_authorize_phase_receipt, input, result.authorize_phase), true);
}
function testDeterministicBinding() { const input = positiveInput(); assert.deepStrictEqual(bind(input), bind(clone(input))); }
function testGenericAuthorizeHelperAcceptsFCLPhase() {
  const input = positiveInput(); const phase = buildAuthorizePhase(input); const bundle = input.assessment_input.pre_action_bundle;
  assert.strictEqual(validateAuthorizePhase(phase, { predecessor_frontier: bundle.target.expected_predecessor_frontier, target_binding_hash: bundle.target.binding_hash, requires_approval: true }), true);
}
function testDeniedAssessmentCannotBind() {
  const staleAssessmentInput = clone(assessment.input); staleAssessmentInput.evaluated_at = '2026-08-27T18:02:01Z';
  const stale = evaluateAssessment(staleAssessmentInput); assert.strictEqual(stale.generic_assessment.decision.status, 'denied');
  const input = positiveInput(); input.assessment_input = staleAssessmentInput; input.generic_assessment = stale.generic_assessment; input.fcl_assessment_receipt = stale.fcl_assessment_receipt; input.authorized_at = '2026-08-27T18:02:02Z';
  expectFailure('denied assessment', () => validateInput(input), /requires admissible assessment|must be admissible|next_safe_action/);
}
function testAuthorizeCannotPredateAssessment() { expectFailure('authorize predates assessment', () => validateInput(positiveInput('2026-08-27T18:01:12Z')), /cannot precede admission assessment/); }
function testAuthorizeAfterHorizonRejected() { expectFailure('authorize after horizon', () => validateInput(positiveInput('2026-08-27T18:02:01Z')), /after authorization horizon|after ActionPermit expiry|after Approval expiry|after Availability expiry/); }
function testGenericAssessmentSubstitutionRejected() { const input = positiveInput(); input.generic_assessment.content_hash = `sha256:${'1'.repeat(64)}`; expectFailure('generic assessment substitution', () => validateInput(input), /not exactly reproducible/); }
function testFCLAssessmentReceiptSubstitutionRejected() { const input = positiveInput(); input.fcl_assessment_receipt.target_binding_hash = `sha256:${'2'.repeat(64)}`; input.fcl_assessment_receipt.content_hash = hashObject(input.fcl_assessment_receipt); expectFailure('FCL assessment receipt substitution', () => validateInput(input), /assessment receipt invalid|not exactly reproducible/); }
function testBundlePermitSubstitutionRejected() { const input = positiveInput(); input.assessment_input.pre_action_bundle.core_receipts.action_permit.content_hash = `sha256:${'3'.repeat(64)}`; expectFailure('permit substitution', () => validateInput(input), /assessment input invalid|not exactly reproducible/); }
function testBundleTargetSubstitutionRejected() { const input = positiveInput(); input.assessment_input.pre_action_bundle.target.binding_hash = `sha256:${'4'.repeat(64)}`; expectFailure('target substitution', () => validateInput(input), /assessment input invalid|not exactly reproducible/); }
function testAuthorizePhaseConsumedRejected() { const input = positiveInput(); const result = bind(input); result.fcl_authorize_phase_receipt.authorize_phase.consumed = true; result.fcl_authorize_phase_receipt.content_hash = hashObject(result.fcl_authorize_phase_receipt); expectFailure('consumed phase', () => validateReceipt(result.fcl_authorize_phase_receipt), /one-shot and unconsumed/); }
function testAuthorizePhaseMissingApprovalRejected() { const input = positiveInput(); const phase = buildAuthorizePhase(input); delete phase.approval_ref; const bundle = input.assessment_input.pre_action_bundle; expectFailure('missing approval', () => validateAuthorizePhase(phase, { predecessor_frontier: bundle.target.expected_predecessor_frontier, target_binding_hash: bundle.target.binding_hash, requires_approval: true }), /approval required/); }
function testReceiptOverclaimRejected() { const input = positiveInput(); const result = bind(input); result.fcl_authorize_phase_receipt.non_effects.execute_phase_entered = true; result.fcl_authorize_phase_receipt.content_hash = hashObject(result.fcl_authorize_phase_receipt); expectFailure('execute overclaim', () => validateReceipt(result.fcl_authorize_phase_receipt), /execute_phase_entered/); }
function testFuturePhaseSynthesisRejected() { const input = positiveInput(); const result = bind(input); result.fcl_authorize_phase_receipt.execute = { status: 'executed' }; result.fcl_authorize_phase_receipt.content_hash = hashObject(result.fcl_authorize_phase_receipt); expectFailure('future phase synthesis', () => validateReceipt(result.fcl_authorize_phase_receipt), /keys mismatch|must not synthesize/); }
function testReadOnlyCliAndImportSafe() {
  const script = path.resolve(ROOT, 'execution-lifecycle-authorize-phase-binding.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
  assert.strictEqual(imported.status, 0, imported.stderr); assert.strictEqual(imported.stdout, ''); assert.strictEqual(imported.stderr, '');
  for (const command of ['execute','probe','consume','interrupt','send','actuate']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8', timeout: 5000 });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`); assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}

const tests = [testPositiveBinding,testDeterministicBinding,testGenericAuthorizeHelperAcceptsFCLPhase,testDeniedAssessmentCannotBind,testAuthorizeCannotPredateAssessment,testAuthorizeAfterHorizonRejected,testGenericAssessmentSubstitutionRejected,testFCLAssessmentReceiptSubstitutionRejected,testBundlePermitSubstitutionRejected,testBundleTargetSubstitutionRejected,testAuthorizePhaseConsumedRejected,testAuthorizePhaseMissingApprovalRejected,testReceiptOverclaimRejected,testFuturePhaseSynthesisRejected,testReadOnlyCliAndImportSafe];
for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }
const input = positiveInput(); const result = bind(input);
if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(input, null, 2)}\n`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], `${JSON.stringify(result.authorize_phase, null, 2)}\n`);
if (process.argv[4]) fs.writeFileSync(process.argv[4], `${JSON.stringify(result.fcl_authorize_phase_receipt, null, 2)}\n`);
process.stdout.write(`PASS FCL Execution Lifecycle Authorize Phase Binding v0.1 conformance (${tests.length} groups)\n`);
