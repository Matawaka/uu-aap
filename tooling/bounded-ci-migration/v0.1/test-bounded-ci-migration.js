#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');
const ConformanceParity = require('../../conformance-parity/v0.1/conformance-parity.js');
const T3d = require('./bounded-ci-migration.js');

const ROOT = process.cwd();
const SPEC_PATH = 'tooling/bounded-ci-migration/v0.1/marketcloser-marketer-pessimist.slice.json';
const BASELINE_PATH = 'tooling/conformance-parity/v0.1/marketcloser-publication.manual-baseline.json';

function expectThrow(fn, pattern) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  assert(error, 'expected function to throw');
  if (pattern) assert(pattern.test(error.message), `unexpected error: ${error.message}`);
}

function loadFixtureInputs() {
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, SPEC_PATH), 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8'));
  const lines = [
    'name: synthetic historical workflow',
    'jobs:',
    '  validate:',
    '    steps:',
    '      - name: Re-run Synthetic predecessors',
    '        run: |'
  ];
  for (const command of baseline.commands) lines.push(`          ${command.executable} ${command.args[0]}`);
  const workflowText = `${lines.join('\n')}\n`;
  const blob = ConformanceParity.gitBlobSha(workflowText);
  baseline.source.workflow_blob_sha = blob;
  spec.historical_workflow.blob_sha = blob;
  spec.expected_parent_plan_digest = null;
  const entries = DependencyImpact.loadManifests(spec.parent_manifest_paths, { repositoryRoot: ROOT });
  return { spec, baseline, workflowText, entries };
}

const inputs = loadFixtureInputs();
const context = T3d.buildMigrationContext(inputs);
assert.strictEqual(context.fullPlan.commands.length, 27);
assert.strictEqual(context.generatedSlicePlan.commands.length, 5);
assert.strictEqual(context.rollbackPlan.commands.length, 5);
assert.deepStrictEqual(context.generatedSlicePlan.dependency_components, inputs.spec.component_ids);
assert.deepStrictEqual(
  context.generatedSlicePlan.commands.map((c) => `${c.executable}\u0000${c.args.join('\u0000')}`),
  inputs.spec.rollback_commands.map((c) => `${c.executable}\u0000${c.args.join('\u0000')}`)
);
assert.deepStrictEqual(context.historical_baseline_range, { start_sequence: 23, end_sequence: 27 });

let call = 0;
const exactReport = T3d.verifyMigration({
  ...inputs,
  repositoryRoot: ROOT,
  snapshotter: () => 'same',
  executor: (command) => ({
    status: 0,
    signal: null,
    error: null,
    stdout: `stable:${command.executable}:${command.args.join(':')}`,
    stderr: ''
  })
});
assert.strictEqual(exactReport.classification, 'MIGRATION_ADMISSIBLE');
assert.strictEqual(exactReport.status_difference_count, 0);
assert.strictEqual(exactReport.output_difference_count, 0);
assert.strictEqual(exactReport.parent_command_count, 27);
assert.strictEqual(exactReport.slice_command_count, 5);
assert.strictEqual(exactReport.claims.bulk_ci_migration_authorized, false);
assert.strictEqual(exactReport.claims.authority_created, false);

call = 0;
const outputDiff = T3d.verifyMigration({
  ...inputs,
  repositoryRoot: ROOT,
  snapshotter: () => 'same',
  executor: (command) => {
    call += 1;
    return {
      status: 0,
      signal: null,
      error: null,
      stdout: `${call > 5 && command.sequence === 1 ? 'changed' : 'stable'}:${command.executable}:${command.args.join(':')}`,
      stderr: ''
    };
  }
});
assert.strictEqual(outputDiff.classification, 'ROLLBACK_REQUIRED');
assert.strictEqual(outputDiff.status_difference_count, 0);
assert.strictEqual(outputDiff.output_difference_count, 1);

let snapshotCall = 0;
const mutation = T3d.verifyMigration({
  ...inputs,
  repositoryRoot: ROOT,
  snapshotter: () => (++snapshotCall === 1 ? 'before' : 'after'),
  executor: () => ({ status: 0, signal: null, error: null, stdout: '', stderr: '' })
});
assert.strictEqual(mutation.classification, 'ROLLBACK_REQUIRED');

const migrated = T3d.runMigratedSlice({
  ...inputs,
  repositoryRoot: ROOT,
  snapshotter: () => 'same',
  executor: () => ({ status: 0, signal: null, error: null, stdout: 'ok', stderr: '' })
});
assert.strictEqual(migrated.classification, 'MIGRATED_SLICE_SUCCESS');
assert.strictEqual(migrated.execution.attempted, 5);
assert.strictEqual(migrated.execution.succeeded, 5);
assert.strictEqual(migrated.execution.repository_changed_after_run, false);

const badComponents = JSON.parse(JSON.stringify(inputs.spec));
badComponents.component_ids[2] = 'Unknown-Component';
expectThrow(() => T3d.buildMigrationContext({ ...inputs, spec: badComponents }), /component order mismatch|component missing/);

const badRollback = JSON.parse(JSON.stringify(inputs.spec));
badRollback.rollback_commands[0].args = ['products/marketer-pessimist/v0.1/not-the-contract.py'];
expectThrow(() => T3d.buildMigrationContext({ ...inputs, spec: badRollback }), /generated slice commands differ/);

const badDigest = JSON.parse(JSON.stringify(inputs.spec));
badDigest.expected_parent_plan_digest = `sha256:${'0'.repeat(64)}`;
expectThrow(() => T3d.buildMigrationContext({ ...inputs, spec: badDigest }), /parent plan digest drift/);

const historicalWorkflow = `name: x\non:\n  pull_request:\n    paths:\n      - 'x'\npermissions:\n  contents: read\njobs:\n  validate:\n    steps:\n      - name: Re-run Marketer Pessimist predecessors\n        run: |\n          python products/marketer-pessimist/v0.1/validate_contract.py\n          node products/marketer-pessimist/v0.1/local-mvp/test-stress-test.js\n          node products/marketer-pessimist/v0.1/local-mvp/test-receipt-binding.js\n          node products/marketer-pessimist/v0.1/real-review-intake/v0.1/test-intake.js\n          node products/marketer-pessimist/v0.1/real-review-intake/v0.1/test-candidate-binding.js\n      - name: Other step\n        run: echo stable\n`;
const workflowSpec = JSON.parse(JSON.stringify(inputs.spec));
workflowSpec.historical_workflow.blob_sha = ConformanceParity.gitBlobSha(historicalWorkflow);
const currentWorkflow = `name: x\non:\n  pull_request:\n    paths:\n      - 'x'\npermissions:\n  contents: read\njobs:\n  validate:\n    steps:\n      - name: Run Marketer Pessimist predecessors via bounded generated slice\n        env:\n          FRONTIER: ${workflowSpec.historical_workflow.frontier}\n          BLOB: ${workflowSpec.historical_workflow.blob_sha}\n        run: |\n          node tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js run slice baseline frozen\n      - name: Other step\n        run: echo stable\n`;
const workflowCheck = T3d.verifyProductionWorkflowMigration({
  spec: workflowSpec,
  historicalWorkflowText: historicalWorkflow,
  currentWorkflowText: currentWorkflow
});
assert.strictEqual(workflowCheck.triggers_unchanged, true);
assert.strictEqual(workflowCheck.non_target_steps_unchanged, true);

const changedOther = currentWorkflow.replace('run: echo stable', 'run: echo changed');
expectThrow(() => T3d.verifyProductionWorkflowMigration({ spec: workflowSpec, historicalWorkflowText: historicalWorkflow, currentWorkflowText: changedOther }), /non-target workflow step changed/);

const changedTrigger = currentWorkflow.replace("- 'x'", "- 'y'");
expectThrow(() => T3d.verifyProductionWorkflowMigration({ spec: workflowSpec, historicalWorkflowText: historicalWorkflow, currentWorkflowText: changedTrigger }), /triggers changed/);

console.log('Bounded CI Migration Gate v0.1 tests: PASS');
