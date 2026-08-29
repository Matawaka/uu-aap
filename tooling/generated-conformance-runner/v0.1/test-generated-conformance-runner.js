#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');
const Runner = require('./generated-conformance-runner.js');

const ROOT = process.cwd();
const BASELINE_PATH = 'tooling/conformance-parity/v0.1/marketcloser-publication.manual-baseline.json';
const WORKFLOW_PATH = '.github/workflows/marketcloser-publication-observation-v0.1-validation.yml';
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

function loadInputs() {
  return {
    baseline: JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8')),
    workflowText: fs.readFileSync(path.join(ROOT, WORKFLOW_PATH), 'utf8'),
    entries: DependencyImpact.loadManifests(MANIFESTS, { repositoryRoot: ROOT })
  };
}

function expectThrow(fn, pattern) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  assert(error, 'expected function to throw');
  if (pattern) assert(pattern.test(error.message), `unexpected error: ${error.message}`);
}

const inputs = loadInputs();
const plan = Runner.buildExecutionPlan(inputs);
const validation = Runner.validateExecutionPlan(plan);

assert.strictEqual(validation.valid, true);
assert.strictEqual(plan.target_component_id, 'MarketCloser-Publication-Observation');
assert.strictEqual(plan.mode, 'PREDECESSOR_ONLY');
assert.strictEqual(plan.parity.verified, true);
assert.strictEqual(plan.parity.manual_command_count, 27);
assert.strictEqual(plan.parity.graph_command_count, 27);
assert.strictEqual(plan.commands.length, 27);
assert.strictEqual(plan.dependency_components.length, 14);
assert.strictEqual(plan.claims.commands_executed, false);
assert.strictEqual(plan.claims.target_component_commands_included, false);
assert(!plan.commands.some((command) => command.component_id === plan.target_component_id));
assert.strictEqual(new Set(plan.commands.map((command) => `${command.executable}\u0000${command.args.join('\u0000')}`)).size, 27);

// The dependency-first plan must place reusable Marketer predecessors before the intake and bridge.
const order = new Map(plan.dependency_components.map((id, index) => [id, index]));
assert(order.get('Marketer-Pessimist-Product-Contract') < order.get('Marketer-Pessimist-Real-Review-Intake'));
assert(order.get('Marketer-Pessimist-Local-MVP') < order.get('Marketer-Pessimist-Real-Review-Intake'));
assert(order.get('Marketer-Pessimist-Real-Review-Intake') < order.get('MarketCloser-Minimized-Real-Review-Bridge'));
assert(order.get('MarketCloser-Copy-Export-Receipt') > order.get('MarketCloser-Human-Response-Approval'));

// Baseline deletion and injection both fail the parity admission gate.
const missingBaseline = JSON.parse(JSON.stringify(inputs.baseline));
missingBaseline.commands.pop();
missingBaseline.command_count = missingBaseline.commands.length;
expectThrow(() => Runner.buildExecutionPlan({ ...inputs, baseline: missingBaseline }), /parity gate failed/);

const extraBaseline = JSON.parse(JSON.stringify(inputs.baseline));
extraBaseline.commands.push({ executable: 'node', args: ['tooling/generated-conformance-runner/v0.1/not-in-graph.js'] });
extraBaseline.command_count = extraBaseline.commands.length;
expectThrow(() => Runner.buildExecutionPlan({ ...inputs, baseline: extraBaseline }), /parity gate failed/);

// Execution-plan validation rejects executable expansion, shell composition, duplicates and target commands.
const badExecutable = JSON.parse(JSON.stringify(plan));
badExecutable.commands[0].executable = 'bash';
expectThrow(() => Runner.validateExecutionPlan(badExecutable), /executable is not allowed/);

const shellArg = JSON.parse(JSON.stringify(plan));
shellArg.commands[0].args = ['safe.js;echo-unsafe'];
expectThrow(() => Runner.validateExecutionPlan(shellArg), /shell composition/);

const duplicate = JSON.parse(JSON.stringify(plan));
duplicate.commands[1].executable = duplicate.commands[0].executable;
duplicate.commands[1].args = [...duplicate.commands[0].args];
expectThrow(() => Runner.validateExecutionPlan(duplicate), /duplicate command/);

const targetIncluded = JSON.parse(JSON.stringify(plan));
targetIncluded.commands[0].component_id = targetIncluded.target_component_id;
expectThrow(() => Runner.validateExecutionPlan(targetIncluded), /target component command included/);

// Mock execution proves stop-on-first-failure without starting real child processes.
const failedReceipt = Runner.executePlan(plan, {
  repositoryRoot: ROOT,
  snapshotter: () => 'same-snapshot',
  executor: (command) => ({
    status: command.sequence === 3 ? 7 : 0,
    signal: null,
    error: null,
    stdout: `sequence=${command.sequence}`,
    stderr: command.sequence === 3 ? 'synthetic failure' : ''
  })
});
assert.strictEqual(failedReceipt.result, 'FAILED');
assert.strictEqual(failedReceipt.attempted_command_count, 3);
assert.strictEqual(failedReceipt.succeeded_command_count, 2);
assert.strictEqual(failedReceipt.failed_command_count, 1);
assert.strictEqual(failedReceipt.stopped_early, true);
assert.strictEqual(failedReceipt.repository_changed_after_run, false);

// Repository mutation dominates an otherwise successful execution result.
let snapshotCall = 0;
const mutatedReceipt = Runner.executePlan(plan, {
  repositoryRoot: ROOT,
  snapshotter: () => (++snapshotCall === 1 ? 'before' : 'after'),
  executor: () => ({ status: 0, signal: null, error: null, stdout: '', stderr: '' })
});
assert.strictEqual(mutatedReceipt.result, 'REPOSITORY_MUTATED');
assert.strictEqual(mutatedReceipt.attempted_command_count, 27);
assert.strictEqual(mutatedReceipt.succeeded_command_count, 27);
assert.strictEqual(mutatedReceipt.repository_changed_after_run, true);
assert.strictEqual(mutatedReceipt.claims.all_commands_succeeded, false);

// Bounded child environment preserves runtime essentials but strips common credential surfaces.
const env = Runner.safeChildEnvironment({
  PATH: '/usr/bin', HOME: '/tmp/home', LANG: 'C.UTF-8',
  GITHUB_TOKEN: 'secret', OPENAI_API_KEY: 'secret', PASSWORD: 'secret', CI: 'true'
});
assert.strictEqual(env.PATH, '/usr/bin');
assert.strictEqual(env.CI, 'true');
assert.strictEqual(env.GITHUB_TOKEN, undefined);
assert.strictEqual(env.OPENAI_API_KEY, undefined);
assert.strictEqual(env.PASSWORD, undefined);
assert.strictEqual(env.UU_AAP_GENERATED_CONFORMANCE_RUNNER, '1');

console.log('Generated Conformance Runner v0.1 tests: PASS');
