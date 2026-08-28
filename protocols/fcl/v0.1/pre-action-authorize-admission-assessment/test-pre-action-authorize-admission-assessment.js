'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildGenericAssessment,
  evaluate,
  hashObject,
  validateBindingReceipt,
  validateInput,
} = require('./pre-action-authorize-admission-assessment.js');
const {
  computeContentHash,
  validateAssessment,
} = require('../../../integration/pre-action-authorize-admission/v0.1/validate-authorize-admission.js');

const clone = value => JSON.parse(JSON.stringify(value));
const ROOT = __dirname;
const ORIGIN = {
  repository: 'Matawaka/uu-aap',
  revision: '1a944df46ae94ad967a3faf90a2fa8c54e8da929',
  tree: '09c2c02bc51e47761bfbd45c852ae40abdab0815',
};

function expectFailure(label, fn, pattern = null) {
  let failed = false;
  try { fn(); }
  catch (error) {
    failed = true;
    if (pattern) assert(pattern.test(error.message), `${label}: unexpected ${error.message}`);
  }
  assert(failed, `${label}: expected failure`);
}

function loadAssemblyArtifacts() {
  const cached = {
    input: process.env.FCL_ASSESSMENT_CACHED_ASSEMBLY_INPUT,
    bundle: process.env.FCL_ASSESSMENT_CACHED_BUNDLE,
    receipt: process.env.FCL_ASSESSMENT_CACHED_ASSEMBLY_RECEIPT,
  };
  if (cached.input && cached.bundle && cached.receipt && Object.values(cached).every(p => fs.existsSync(p))) {
    return {
      input: JSON.parse(fs.readFileSync(cached.input, 'utf8')),
      bundle: JSON.parse(fs.readFileSync(cached.bundle, 'utf8')),
      receipt: JSON.parse(fs.readFileSync(cached.receipt, 'utf8')),
    };
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fcl-assessment-assembly-'));
  const inputPath = path.join(dir, 'assembly-input.json');
  const bundlePath = path.join(dir, 'bundle.json');
  const receiptPath = path.join(dir, 'assembly-receipt.json');
  const script = path.resolve(ROOT, '..', 'pre-action-bundle-assembly', 'test-pre-action-bundle-assembly.js');
  const run = spawnSync(process.execPath, [script, inputPath, bundlePath, receiptPath], {
    stdio: 'ignore', timeout: 120000,
  });
  assert.strictEqual(run.status, 0, `assembly source failed: ${run.error ? run.error.message : 'non-zero status'}`);
  return {
    input: JSON.parse(fs.readFileSync(inputPath, 'utf8')),
    bundle: JSON.parse(fs.readFileSync(bundlePath, 'utf8')),
    receipt: JSON.parse(fs.readFileSync(receiptPath, 'utf8')),
  };
}

const assembly = loadAssemblyArtifacts();

function positiveInput(evaluatedAt = '2026-08-27T18:01:13Z') {
  return {
    protocol: 'FCL', version: '0.1', profile: 'pre-action-authorize-admission-assessment-v0.1',
    assessment_id: 'fcl-preaction-authorize-assessment-interrupt-v0-1',
    origin: clone(ORIGIN),
    assembly_input: clone(assembly.input),
    pre_action_bundle: clone(assembly.bundle),
    assembly_receipt: clone(assembly.receipt),
    evaluated_at: evaluatedAt,
  };
}

function testPositiveAdmissibleAssessment() {
  const input = positiveInput();
  assert.strictEqual(validateInput(input), true);
  const result = evaluate(input);
  assert.strictEqual(result.generic_assessment.decision.status, 'admissible');
  assert.strictEqual(validateAssessment(result.generic_assessment, input.pre_action_bundle), true);
  assert.strictEqual(validateBindingReceipt(result.fcl_assessment_receipt, input, result.generic_assessment), true);
  assert.strictEqual(result.fcl_assessment_receipt.next_safe_action, 'BIND_EXECUTION_LIFECYCLE_AUTHORIZE_PHASE');
  assert.strictEqual(result.fcl_assessment_receipt.non_effects.authorize_admitted, false);
}

function testDeterministicAdmissibleAssessment() {
  const input = positiveInput();
  assert.deepStrictEqual(evaluate(input), evaluate(clone(input)));
}

function testStaleAssessmentIsDenied() {
  const input = positiveInput('2026-08-27T18:02:01Z');
  const result = evaluate(input);
  assert.strictEqual(result.generic_assessment.decision.status, 'denied');
  assert.strictEqual(result.generic_assessment.assertions.freshness_valid_at_decision, false);
  assert.strictEqual(result.fcl_assessment_receipt.decision_status, 'denied');
  assert.strictEqual(result.fcl_assessment_receipt.next_safe_action, 'NONE');
  assert.strictEqual(validateAssessment(result.generic_assessment, input.pre_action_bundle), true);
}

function testGenericAssessmentHashExact() {
  const assessment = buildGenericAssessment(positiveInput());
  assert.strictEqual(assessment.content_hash, computeContentHash(assessment));
}

function testAssemblyReceiptSubstitutionRejected() {
  const input = positiveInput();
  input.assembly_receipt.bundle_content_hash = `sha256:${'1'.repeat(64)}`;
  expectFailure('assembly receipt substitution', () => validateInput(input), /assembly receipt invalid|not exactly reproducible|bundle_content_hash/);
}

function testBundleSubstitutionRejected() {
  const input = positiveInput();
  input.pre_action_bundle.content_hash = `sha256:${'2'.repeat(64)}`;
  expectFailure('bundle substitution', () => validateInput(input), /pre_action_bundle is not exactly reproducible/);
}

function testPermitSubstitutionRejected() {
  const input = positiveInput();
  input.pre_action_bundle.core_receipts.action_permit.content_hash = `sha256:${'3'.repeat(64)}`;
  expectFailure('permit substitution', () => validateInput(input), /pre_action_bundle is not exactly reproducible/);
}

function testApprovalSubstitutionRejected() {
  const input = positiveInput();
  input.pre_action_bundle.approval_binding.content_hash = `sha256:${'4'.repeat(64)}`;
  expectFailure('approval substitution', () => validateInput(input), /pre_action_bundle is not exactly reproducible/);
}

function testTargetSubstitutionRejected() {
  const input = positiveInput();
  input.pre_action_bundle.target.binding_hash = `sha256:${'5'.repeat(64)}`;
  expectFailure('target substitution', () => validateInput(input), /pre_action_bundle is not exactly reproducible/);
}

function testFrontierSubstitutionRejected() {
  const input = positiveInput();
  input.pre_action_bundle.target.expected_predecessor_frontier = 'fcl:other:epoch:1';
  expectFailure('frontier substitution', () => validateInput(input), /pre_action_bundle is not exactly reproducible/);
}

function testAssessmentCannotPredateAssembly() {
  const input = positiveInput('2026-08-27T18:01:11Z');
  expectFailure('assessment predates assembly', () => validateInput(input), /cannot precede bundle assembly|cannot precede assembly receipt/);
}

function testConsumedPermitCannotProduceAssessment() {
  const input = positiveInput();
  input.pre_action_bundle.core_receipts.action_permit.payload.consumed = true;
  expectFailure('consumed permit', () => validateInput(input), /pre_action_bundle is not exactly reproducible/);
}

function testNonOneShotPermitCannotProduceAssessment() {
  const input = positiveInput();
  input.pre_action_bundle.core_receipts.action_permit.payload.one_shot = false;
  expectFailure('non one-shot permit', () => validateInput(input), /pre_action_bundle is not exactly reproducible/);
}

function testBindingReceiptOverclaimRejected() {
  const input = positiveInput();
  const result = evaluate(input);
  result.fcl_assessment_receipt.non_effects.authorize_admitted = true;
  result.fcl_assessment_receipt.content_hash = hashObject(result.fcl_assessment_receipt);
  expectFailure('authorize overclaim', () => validateBindingReceipt(result.fcl_assessment_receipt), /authorize_admitted/);
}

function testDeniedReceiptCannotAdvance() {
  const input = positiveInput('2026-08-27T18:02:01Z');
  const result = evaluate(input);
  result.fcl_assessment_receipt.next_safe_action = 'BIND_EXECUTION_LIFECYCLE_AUTHORIZE_PHASE';
  result.fcl_assessment_receipt.content_hash = hashObject(result.fcl_assessment_receipt);
  expectFailure('denied successor escalation', () => validateBindingReceipt(result.fcl_assessment_receipt), /denied assessment must not claim/);
}

function testReadOnlyCliAndImportSafe() {
  const script = path.resolve(ROOT, 'pre-action-authorize-admission-assessment.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
  assert.strictEqual(imported.status, 0, imported.stderr);
  assert.strictEqual(imported.stdout, '');
  assert.strictEqual(imported.stderr, '');
  for (const command of ['authorize','execute','probe','consume','interrupt','send']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8', timeout: 5000 });
    assert.notStrictEqual(run.status, 0, `${command} must be rejected`);
    assert(/unsupported command/.test(run.stderr), `${command}: unexpected stderr ${run.stderr}`);
  }
}

const tests = [
  testPositiveAdmissibleAssessment,
  testDeterministicAdmissibleAssessment,
  testStaleAssessmentIsDenied,
  testGenericAssessmentHashExact,
  testAssemblyReceiptSubstitutionRejected,
  testBundleSubstitutionRejected,
  testPermitSubstitutionRejected,
  testApprovalSubstitutionRejected,
  testTargetSubstitutionRejected,
  testFrontierSubstitutionRejected,
  testAssessmentCannotPredateAssembly,
  testConsumedPermitCannotProduceAssessment,
  testNonOneShotPermitCannotProduceAssessment,
  testBindingReceiptOverclaimRejected,
  testDeniedReceiptCannotAdvance,
  testReadOnlyCliAndImportSafe,
];

for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }

const input = positiveInput();
const result = evaluate(input);
if (process.argv[2]) fs.writeFileSync(process.argv[2], `${JSON.stringify(input, null, 2)}\n`);
if (process.argv[3]) fs.writeFileSync(process.argv[3], `${JSON.stringify(result.generic_assessment, null, 2)}\n`);
if (process.argv[4]) fs.writeFileSync(process.argv[4], `${JSON.stringify(result.fcl_assessment_receipt, null, 2)}\n`);
process.stdout.write(`PASS FCL PreAction Authorize Admission Assessment v0.1 conformance (${tests.length} groups)\n`);
