#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');
const Runner = require('../../generated-conformance-runner/v0.1/generated-conformance-runner.js');
const Parity = require('./execution-evidence-parity.js');

const ROOT = process.cwd();
const BASELINE_PATH = 'tooling/conformance-parity/v0.1/marketcloser-publication.manual-baseline.json';
const WORKFLOW_PATH = process.env.UU_AAP_HISTORICAL_WORKFLOW || process.env.FROZEN_HISTORICAL_WORKFLOW || process.env.FROZEN_WORKFLOW || '.github/workflows/marketcloser-publication-observation-v0.1-validation.yml';
const MANIFESTS = [
  'tooling/component-manifest/v0.1/examples/marketer-pessimist-product-contract.component.json',
  'tooling/component-manifest/v0.1/examples/marketer-pessimist-local-mvp.component.json',
  'tooling/component-manifest/v0.1/examples/marketer-pessimist-real-review-intake.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-application-boundary.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-deployment-observation.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-minimized-real-review-bridge.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-real-review-run-authority-gate.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-real-review-run-permit.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-real-review-local-run-revalidation.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-real-stress-test-adapter.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-human-analysis-disposition.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-response-candidate.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-human-response-approval.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-copy-export-receipt.component.json',
  'tooling/component-manifest/v0.1/examples/marketcloser-publication-observation.component.json'
];

function inputs() {
  return {
    baseline: JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8')),
    workflowText: fs.readFileSync(path.resolve(ROOT, WORKFLOW_PATH), 'utf8'),
    entries: DependencyImpact.loadManifests(MANIFESTS, { repositoryRoot: ROOT })
  };
}

function expectThrow(fn, pattern) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  assert(caught, 'expected function to throw');
  if (pattern) assert(pattern.test(caught.message), `unexpected error: ${caught.message}`);
}

function fakeReceipt(plan, overrides = {}) {
  const commandOverrides = overrides.commandOverrides || new Map();
  const commands = plan.commands.map((command) => {
    const key = Parity.commandKey(command);
    const override = commandOverrides.get(key) || {};
    const stdout = override.stdout === undefined ? `stable:${key}` : override.stdout;
    const stderr = override.stderr === undefined ? '' : override.stderr;
    const exitCode = override.exit_code === undefined ? 0 : override.exit_code;
    const signal = override.signal === undefined ? null : override.signal;
    const errorCode = override.error_code === undefined ? null : override.error_code;
    const success = override.success === undefined ? exitCode === 0 && signal === null && errorCode === null : override.success;
    return {
      sequence: command.sequence,
      component_id: command.component_id,
      executable: command.executable,
      args: [...command.args],
      exit_code: exitCode,
      signal,
      success,
      stdout_sha256: Runner.sha256Text(stdout),
      stderr_sha256: Runner.sha256Text(stderr),
      stdout_bytes: Buffer.byteLength(stdout),
      stderr_bytes: Buffer.byteLength(stderr),
      error_code: errorCode
    };
  });
  const succeeded = commands.filter((command) => command.success).length;
  const failed = commands.length - succeeded;
  const repositoryChanged = Boolean(overrides.repositoryChanged);
  return {
    artifact_type: 'UU-AAP-Generated-Conformance-Execution-Receipt',
    version: '0.1',
    runner_origin_frontier: Runner.RUNNER_ORIGIN_FRONTIER,
    target_component_id: plan.target_component_id,
    mode: 'PREDECESSOR_ONLY',
    source_workflow: plan.source_workflow,
    plan_digest: plan.plan_digest,
    planned_command_count: commands.length,
    attempted_command_count: commands.length,
    succeeded_command_count: succeeded,
    failed_command_count: failed,
    stopped_early: false,
    repository_changed_after_run: repositoryChanged,
    result: repositoryChanged ? 'REPOSITORY_MUTATED' : (failed ? 'FAILED' : 'SUCCESS'),
    commands,
    claims: {},
    non_effects: []
  };
}

const loaded = inputs();
const { manualPlan, generatedPlan } = Parity.buildHistoricalManualOrderPlan(loaded);
assert.strictEqual(manualPlan.commands.length, 27);
assert.strictEqual(generatedPlan.commands.length, 27);
assert.strictEqual(new Set(manualPlan.commands.map(Parity.commandKey)).size, 27);
assert.deepStrictEqual(
  new Set(manualPlan.commands.map(Parity.commandKey)),
  new Set(generatedPlan.commands.map(Parity.commandKey))
);
assert.notDeepStrictEqual(
  manualPlan.commands.map(Parity.commandKey),
  generatedPlan.commands.map(Parity.commandKey),
  'historical and dependency-first orders unexpectedly identical; T3c would not exercise order variation'
);
assert(!manualPlan.commands.some((command) => command.component_id === manualPlan.target_component_id));
assert(!generatedPlan.commands.some((command) => command.component_id === generatedPlan.target_component_id));

const exact = Parity.compareExecutionReceipts(fakeReceipt(manualPlan), fakeReceipt(generatedPlan));
assert.strictEqual(exact.classification, 'EXACT_EXECUTION_EVIDENCE_PARITY');
assert.strictEqual(exact.status_difference_count, 0);
assert.strictEqual(exact.output_difference_count, 0);

const changedKey = Parity.commandKey(generatedPlan.commands[4]);
const outputOverrides = new Map([[changedKey, { stdout: 'different-output' }]]);
const outputDiff = Parity.compareExecutionReceipts(
  fakeReceipt(manualPlan),
  fakeReceipt(generatedPlan, { commandOverrides: outputOverrides })
);
assert.strictEqual(outputDiff.classification, 'ORDER_INSENSITIVE_SUCCESS_OUTPUT_DIFFERS');
assert.strictEqual(outputDiff.status_difference_count, 0);
assert.strictEqual(outputDiff.output_difference_count, 1);

const statusOverrides = new Map([[changedKey, { exit_code: 7, success: false, stderr: 'failed' }]]);
const statusDiff = Parity.compareExecutionReceipts(
  fakeReceipt(manualPlan),
  fakeReceipt(generatedPlan, { commandOverrides: statusOverrides })
);
assert.strictEqual(statusDiff.classification, 'ORDER_SENSITIVE_EXECUTION');
assert.strictEqual(statusDiff.status_difference_count, 1);

const mutation = Parity.compareExecutionReceipts(
  fakeReceipt(manualPlan, { repositoryChanged: true }),
  fakeReceipt(generatedPlan)
);
assert.strictEqual(mutation.classification, 'REPOSITORY_MUTATION_DETECTED');

const identicalFailure = new Map([[changedKey, { exit_code: 5, success: false, stderr: 'same-failure' }]]);
const insufficient = Parity.compareExecutionReceipts(
  fakeReceipt(manualPlan, { commandOverrides: identicalFailure }),
  fakeReceipt(generatedPlan, { commandOverrides: identicalFailure })
);
assert.strictEqual(insufficient.classification, 'INSUFFICIENT_EVIDENCE');

const missing = fakeReceipt(generatedPlan);
missing.commands.pop();
missing.attempted_command_count -= 1;
expectThrow(() => Parity.compareExecutionReceipts(fakeReceipt(manualPlan), missing), /incomplete command evidence/);

const extra = fakeReceipt(generatedPlan);
extra.commands.push({ ...extra.commands[0], sequence: 28, args: ['injected.js'] });
extra.planned_command_count += 1;
extra.attempted_command_count += 1;
expectThrow(() => Parity.compareExecutionReceipts(fakeReceipt(manualPlan), extra), /command counts differ|extra command result/);

const duplicate = fakeReceipt(generatedPlan);
duplicate.commands[1] = { ...duplicate.commands[0], sequence: 2 };
expectThrow(() => Parity.compareExecutionReceipts(fakeReceipt(manualPlan), duplicate), /duplicate command result/);

const target = fakeReceipt(generatedPlan);
target.commands[0].component_id = target.target_component_id;
expectThrow(() => Parity.compareExecutionReceipts(fakeReceipt(manualPlan), target), /target-component command evidence/);

const tampered = JSON.parse(JSON.stringify(loaded.baseline));
tampered.commands.reverse();
expectThrow(() => Parity.buildHistoricalManualOrderPlan({ ...loaded, baseline: tampered }), /committed baseline does not exactly match historical predecessor command order\/content/);

console.log('Execution Evidence Parity v0.1 tests: PASS');
