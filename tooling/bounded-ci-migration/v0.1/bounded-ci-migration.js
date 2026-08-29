#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');
const ConformanceParity = require('../../conformance-parity/v0.1/conformance-parity.js');
const Runner = require('../../generated-conformance-runner/v0.1/generated-conformance-runner.js');
const ExecutionEvidenceParity = require('../../execution-evidence-parity/v0.1/execution-evidence-parity.js');

const VERSION = '0.1';
const ORIGIN_FRONTIER = 'cdab3d75c3fdc21ec3dc61000b7dc732d3ee11ae';
const MIGRATION_CLASSIFICATIONS = new Set(['MIGRATION_ADMISSIBLE', 'ROLLBACK_REQUIRED', 'INSUFFICIENT_EVIDENCE']);
const EXECUTION_CLASSIFICATIONS = new Set(['MIGRATED_SLICE_SUCCESS', 'ROLLBACK_REQUIRED']);
const NON_EFFECTS = Object.freeze([
  'one_migrated_block_does_not_authorize_global_ci_migration',
  'exact_execution_evidence_does_not_create_migration_authority',
  'migration_admission_does_not_prove_compatibility',
  'migration_admission_does_not_prove_substitutability',
  'migration_admission_does_not_create_runtime_authority',
  'rollback_evidence_remains_historical_evidence_not_live_execution_authority',
  'trigger_preservation_does_not_prove_conformance_equivalence'
]);

class BoundedCIMigrationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BoundedCIMigrationError';
  }
}

function fail(message) {
  throw new BoundedCIMigrationError(message);
}

function commandKey(command) {
  return ConformanceParity.commandKey(command);
}

function arraysEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeUniqueCommands(commands, location) {
  if (!Array.isArray(commands) || commands.length === 0) fail(`${location} must be a non-empty array`);
  const seen = new Set();
  return commands.map((command, index) => {
    const normalized = Runner.normalizeCommand(command, `${location}[${index}]`);
    const key = commandKey(normalized);
    if (seen.has(key)) fail(`${location} contains duplicate command: ${normalized.executable} ${normalized.args.join(' ')}`);
    seen.add(key);
    return normalized;
  });
}

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('migration spec must be an object');
  if (spec.artifact_type !== 'UU-AAP-Bounded-CI-Migration-Slice') fail('migration spec artifact_type mismatch');
  if (spec.version !== VERSION) fail(`migration spec version must be ${VERSION}`);
  if (spec.origin_frontier !== ORIGIN_FRONTIER) fail('migration spec origin frontier mismatch');
  if (!spec.historical_workflow || typeof spec.historical_workflow !== 'object') fail('historical_workflow required');
  if (!/^[0-9a-f]{40}$/.test(spec.historical_workflow.frontier || '')) fail('historical_workflow.frontier must be a Git commit SHA');
  if (!/^[0-9a-f]{40}$/.test(spec.historical_workflow.blob_sha || '')) fail('historical_workflow.blob_sha must be a Git blob SHA');
  if (typeof spec.historical_workflow.path !== 'string' || !spec.historical_workflow.path.length) fail('historical_workflow.path required');
  if (typeof spec.baseline_path !== 'string' || !spec.baseline_path.length) fail('baseline_path required');
  if (typeof spec.target_component_id !== 'string' || !spec.target_component_id.length) fail('target_component_id required');
  if (typeof spec.migrated_step_name !== 'string' || !spec.migrated_step_name.length) fail('migrated_step_name required');
  if (typeof spec.current_step_name !== 'string' || !spec.current_step_name.length) fail('current_step_name required');
  if (!Array.isArray(spec.parent_manifest_paths) || spec.parent_manifest_paths.length === 0) fail('parent_manifest_paths required');
  if (new Set(spec.parent_manifest_paths).size !== spec.parent_manifest_paths.length) fail('parent_manifest_paths contains duplicate path');
  if (!Array.isArray(spec.component_ids) || spec.component_ids.length === 0) fail('component_ids required');
  if (new Set(spec.component_ids).size !== spec.component_ids.length) fail('component_ids contains duplicate id');
  const rollbackCommands = normalizeUniqueCommands(spec.rollback_commands, 'rollback_commands');
  if (!Number.isInteger(spec.expected_parent_command_count) || spec.expected_parent_command_count <= 0) fail('expected_parent_command_count must be positive integer');
  if (!Number.isInteger(spec.expected_slice_command_count) || spec.expected_slice_command_count <= 0) fail('expected_slice_command_count must be positive integer');
  if (rollbackCommands.length !== spec.expected_slice_command_count) fail('rollback command count mismatch');
  if (spec.expected_parent_plan_digest !== null && !/^sha256:[0-9a-f]{64}$/.test(spec.expected_parent_plan_digest || '')) {
    fail('expected_parent_plan_digest must be null or sha256 digest');
  }
  if (!spec.claims || spec.claims.bulk_ci_migration_authorized !== false || spec.claims.authority_created !== false || spec.claims.compatibility_proven !== false || spec.claims.substitutability_proven !== false) {
    fail('migration spec claims boundary mismatch');
  }
  return { ...spec, rollback_commands: rollbackCommands };
}

function loadInputs(specPath, baselinePath, historicalWorkflowPath, repositoryRoot) {
  const root = path.resolve(repositoryRoot || process.cwd());
  const spec = validateSpec(JSON.parse(fs.readFileSync(path.resolve(root, specPath), 'utf8')));
  const actualBaselinePath = baselinePath || spec.baseline_path;
  if (path.normalize(actualBaselinePath) !== path.normalize(spec.baseline_path)) fail('baseline path does not match migration spec');
  const baseline = JSON.parse(fs.readFileSync(path.resolve(root, actualBaselinePath), 'utf8'));
  const workflowText = fs.readFileSync(path.resolve(root, historicalWorkflowPath), 'utf8');
  const entries = DependencyImpact.loadManifests(spec.parent_manifest_paths, { repositoryRoot: root });
  return { spec, baseline, workflowText, entries, repositoryRoot: root };
}

function findContiguousCommandRange(fullCommands, sliceCommands) {
  const fullKeys = fullCommands.map(commandKey);
  const sliceKeys = sliceCommands.map(commandKey);
  for (let start = 0; start <= fullKeys.length - sliceKeys.length; start += 1) {
    if (arraysEqual(fullKeys.slice(start, start + sliceKeys.length), sliceKeys)) return { start, end: start + sliceKeys.length - 1 };
  }
  return null;
}

function buildMigrationContext({ spec: rawSpec, baseline, workflowText, entries }) {
  const spec = validateSpec(rawSpec);
  const binding = ConformanceParity.bindBaselineToWorkflow(baseline, workflowText);
  if (binding.workflow_blob_sha !== spec.historical_workflow.blob_sha) fail('historical workflow blob does not match migration spec');
  if (binding.baseline.source.workflow_path !== spec.historical_workflow.path) fail('historical workflow path does not match migration spec');
  if (binding.baseline.target_component_id !== spec.target_component_id) fail('target component does not match migration spec');

  const fullPlan = Runner.buildExecutionPlan({ baseline: binding.baseline, workflowText, entries });
  Runner.validateExecutionPlan(fullPlan);
  if (fullPlan.commands.length !== spec.expected_parent_command_count) fail(`parent command count mismatch: ${fullPlan.commands.length}`);
  if (spec.expected_parent_plan_digest && fullPlan.plan_digest !== spec.expected_parent_plan_digest) {
    fail(`parent plan digest drift: expected ${spec.expected_parent_plan_digest}, got ${fullPlan.plan_digest}`);
  }

  const selectedIds = new Set(spec.component_ids);
  const parentComponentOrder = fullPlan.dependency_components.filter((id) => selectedIds.has(id));
  if (!arraysEqual(parentComponentOrder, spec.component_ids)) {
    fail(`migration component order mismatch: expected ${spec.component_ids.join(', ')}, got ${parentComponentOrder.join(', ')}`);
  }
  const unknownComponents = spec.component_ids.filter((id) => !fullPlan.dependency_components.includes(id));
  if (unknownComponents.length) fail(`migration component missing from parent plan: ${unknownComponents[0]}`);

  const parentSliceCommands = fullPlan.commands
    .filter((command) => selectedIds.has(command.component_id))
    .map((command, index) => ({ ...command, sequence: index + 1, args: [...command.args] }));
  if (parentSliceCommands.length !== spec.expected_slice_command_count) fail(`slice command count mismatch: ${parentSliceCommands.length}`);

  const rollbackKeys = spec.rollback_commands.map(commandKey);
  const generatedKeys = parentSliceCommands.map(commandKey);
  if (!arraysEqual(rollbackKeys, generatedKeys)) fail('generated slice commands differ from frozen rollback commands');
  const baselineRange = findContiguousCommandRange(binding.baseline.commands, spec.rollback_commands);
  if (!baselineRange) fail('rollback commands are not an exact contiguous slice of the frozen historical baseline');

  const generatedSlicePlan = JSON.parse(JSON.stringify(fullPlan));
  generatedSlicePlan.dependency_components = [...spec.component_ids];
  generatedSlicePlan.commands = parentSliceCommands;
  generatedSlicePlan.plan_digest = ExecutionEvidenceParity.planDigest(generatedSlicePlan);
  Runner.validateExecutionPlan(generatedSlicePlan);

  const ownerByCommand = new Map(parentSliceCommands.map((command) => [commandKey(command), command.component_id]));
  const rollbackPlan = JSON.parse(JSON.stringify(generatedSlicePlan));
  rollbackPlan.commands = spec.rollback_commands.map((command, index) => ({
    sequence: index + 1,
    component_id: ownerByCommand.get(commandKey(command)),
    executable: command.executable,
    args: [...command.args]
  }));
  if (rollbackPlan.commands.some((command) => !command.component_id)) fail('rollback command owner missing from generated parent plan');
  rollbackPlan.plan_digest = ExecutionEvidenceParity.planDigest(rollbackPlan);
  Runner.validateExecutionPlan(rollbackPlan);

  return {
    spec,
    binding,
    fullPlan,
    generatedSlicePlan,
    rollbackPlan,
    historical_baseline_range: { start_sequence: baselineRange.start + 1, end_sequence: baselineRange.end + 1 }
  };
}

function summarizeReceipt(receipt) {
  return {
    plan_digest: receipt.plan_digest,
    attempted: receipt.attempted_command_count,
    succeeded: receipt.succeeded_command_count,
    failed: receipt.failed_command_count,
    stopped_early: receipt.stopped_early,
    repository_changed_after_run: receipt.repository_changed_after_run,
    result: receipt.result
  };
}

function verifyMigration({ spec, baseline, workflowText, entries, repositoryRoot = process.cwd(), timeoutMs, executor, snapshotter, environment }) {
  const context = buildMigrationContext({ spec, baseline, workflowText, entries });
  const sharedEnvironment = environment || Runner.safeChildEnvironment();
  const common = { repositoryRoot, timeoutMs, executor, snapshotter, environment: sharedEnvironment };
  const rollbackReceipt = Runner.executePlan(context.rollbackPlan, common);
  const generatedReceipt = Runner.executePlan(context.generatedSlicePlan, common);
  const comparison = ExecutionEvidenceParity.compareExecutionReceipts(rollbackReceipt, generatedReceipt);
  let classification = 'INSUFFICIENT_EVIDENCE';
  if (comparison.classification === 'EXACT_EXECUTION_EVIDENCE_PARITY') classification = 'MIGRATION_ADMISSIBLE';
  else if (comparison.classification !== 'INSUFFICIENT_EVIDENCE') classification = 'ROLLBACK_REQUIRED';
  if (!MIGRATION_CLASSIFICATIONS.has(classification)) fail(`unknown migration classification: ${classification}`);

  return {
    artifact_type: 'UU-AAP-Bounded-CI-Migration-Assessment',
    version: VERSION,
    origin_frontier: ORIGIN_FRONTIER,
    historical_workflow: { ...context.spec.historical_workflow },
    target_component_id: context.spec.target_component_id,
    migrated_step_name: context.spec.migrated_step_name,
    current_step_name: context.spec.current_step_name,
    component_ids: [...context.spec.component_ids],
    parent_plan_digest: context.fullPlan.plan_digest,
    generated_slice_plan_digest: context.generatedSlicePlan.plan_digest,
    rollback_plan_digest: context.rollbackPlan.plan_digest,
    parent_command_count: context.fullPlan.commands.length,
    slice_command_count: context.generatedSlicePlan.commands.length,
    historical_baseline_range: context.historical_baseline_range,
    rollback_execution: summarizeReceipt(rollbackReceipt),
    generated_execution: summarizeReceipt(generatedReceipt),
    classification,
    status_difference_count: comparison.status_difference_count,
    output_difference_count: comparison.output_difference_count,
    command_comparisons: comparison.comparisons,
    claims: {
      migration_admissible: classification === 'MIGRATION_ADMISSIBLE',
      exact_slice_execution_evidence_parity: comparison.classification === 'EXACT_EXECUTION_EVIDENCE_PARITY',
      one_block_only: true,
      bulk_ci_migration_authorized: false,
      authority_created: false,
      compatibility_proven: false,
      substitutability_proven: false,
      external_effect_authorized: false
    },
    non_effects: [...NON_EFFECTS]
  };
}

function runMigratedSlice({ spec, baseline, workflowText, entries, repositoryRoot = process.cwd(), timeoutMs, executor, snapshotter, environment }) {
  const context = buildMigrationContext({ spec, baseline, workflowText, entries });
  const receipt = Runner.executePlan(context.generatedSlicePlan, {
    repositoryRoot,
    timeoutMs,
    executor,
    snapshotter,
    environment: environment || Runner.safeChildEnvironment()
  });
  const success = receipt.result === 'SUCCESS'
    && receipt.attempted_command_count === context.spec.expected_slice_command_count
    && receipt.succeeded_command_count === context.spec.expected_slice_command_count
    && receipt.failed_command_count === 0
    && receipt.repository_changed_after_run === false;
  const classification = success ? 'MIGRATED_SLICE_SUCCESS' : 'ROLLBACK_REQUIRED';
  if (!EXECUTION_CLASSIFICATIONS.has(classification)) fail(`unknown migrated execution classification: ${classification}`);
  return {
    artifact_type: 'UU-AAP-Bounded-CI-Migration-Execution-Receipt',
    version: VERSION,
    origin_frontier: ORIGIN_FRONTIER,
    historical_workflow: { ...context.spec.historical_workflow },
    target_component_id: context.spec.target_component_id,
    migrated_step_name: context.spec.migrated_step_name,
    current_step_name: context.spec.current_step_name,
    component_ids: [...context.spec.component_ids],
    parent_plan_digest: context.fullPlan.plan_digest,
    slice_plan_digest: context.generatedSlicePlan.plan_digest,
    classification,
    execution: summarizeReceipt(receipt),
    commands: receipt.commands,
    claims: {
      migrated_slice_succeeded: success,
      one_block_only: true,
      bulk_ci_migration_authorized: false,
      authority_created: false,
      compatibility_proven: false,
      substitutability_proven: false,
      external_effect_authorized: false
    },
    non_effects: [...NON_EFFECTS]
  };
}

function extractTriggerSection(workflowText) {
  const match = workflowText.match(/^on:\n([\s\S]*?)^permissions:\s*$/m);
  if (!match) fail('workflow trigger section not found');
  return `on:\n${match[1]}permissions:`;
}

function extractStepBlocks(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  const blocks = new Map();
  let currentName = null;
  let current = [];
  function flush() {
    if (currentName !== null) blocks.set(currentName, current.join('\n'));
  }
  for (const line of lines) {
    const match = line.match(/^\s{6}- name:\s*(.+?)\s*$/);
    if (match) {
      flush();
      currentName = match[1];
      current = [line];
    } else if (currentName !== null) {
      current.push(line);
    }
  }
  flush();
  return blocks;
}

function extractSimpleRunCommandsFromBlock(block) {
  const commands = [];
  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(node|python|python3)\s+([^\s;&|`]+)\s*$/);
    if (match) commands.push({ executable: match[1], args: [match[2]] });
  }
  return commands;
}

function verifyProductionWorkflowMigration({ spec: rawSpec, historicalWorkflowText, currentWorkflowText }) {
  const spec = validateSpec(rawSpec);
  if (ConformanceParity.gitBlobSha(historicalWorkflowText) !== spec.historical_workflow.blob_sha) fail('historical production workflow blob mismatch');
  const historicalTriggers = extractTriggerSection(historicalWorkflowText);
  const currentTriggers = extractTriggerSection(currentWorkflowText);
  if (historicalTriggers !== currentTriggers) fail('production workflow triggers changed during bounded migration');

  const historicalSteps = extractStepBlocks(historicalWorkflowText);
  const currentSteps = extractStepBlocks(currentWorkflowText);
  const oldBlock = historicalSteps.get(spec.migrated_step_name);
  if (!oldBlock) fail('historical migrated step not found');
  if (currentSteps.has(spec.migrated_step_name)) fail('historical manual migrated step still exists in current workflow');
  const currentBlock = currentSteps.get(spec.current_step_name);
  if (!currentBlock) fail('current generated migration step not found');
  const oldCommands = normalizeUniqueCommands(extractSimpleRunCommandsFromBlock(oldBlock), 'historical migrated step commands');
  if (!arraysEqual(oldCommands.map(commandKey), spec.rollback_commands.map(commandKey))) fail('historical migrated step commands differ from rollback spec');
  if (!currentBlock.includes('tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js run')) fail('current migrated step does not invoke bounded CI migration runtime');
  if (!currentBlock.includes(spec.historical_workflow.frontier) || !currentBlock.includes(spec.historical_workflow.blob_sha)) fail('current migrated step does not bind frozen rollback frontier/blob');

  for (const [name, block] of historicalSteps.entries()) {
    if (name === spec.migrated_step_name) continue;
    if (!currentSteps.has(name)) fail(`non-target workflow step missing after migration: ${name}`);
    if (currentSteps.get(name) !== block) fail(`non-target workflow step changed during migration: ${name}`);
  }
  const allowedCurrentNames = new Set([...historicalSteps.keys()].filter((name) => name !== spec.migrated_step_name));
  allowedCurrentNames.add(spec.current_step_name);
  for (const name of currentSteps.keys()) if (!allowedCurrentNames.has(name)) fail(`unexpected workflow step added during migration: ${name}`);

  return {
    artifact_type: 'UU-AAP-Bounded-CI-Workflow-Migration-Check',
    version: VERSION,
    origin_frontier: ORIGIN_FRONTIER,
    workflow_path: spec.historical_workflow.path,
    historical_blob_sha: spec.historical_workflow.blob_sha,
    migrated_step_name: spec.migrated_step_name,
    current_step_name: spec.current_step_name,
    triggers_unchanged: true,
    non_target_steps_unchanged: true,
    rollback_commands_bound: true,
    generated_runner_invocation_present: true,
    claims: {
      one_block_only: true,
      bulk_ci_migration_authorized: false,
      authority_created: false
    },
    non_effects: [...NON_EFFECTS]
  };
}

function usage() {
  return [
    'Usage:',
    '  node tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js verify <slice.json> <baseline.json> <frozen-workflow.yml>',
    '  node tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js run <slice.json> <baseline.json> <frozen-workflow.yml>',
    '  node tooling/bounded-ci-migration/v0.1/bounded-ci-migration.js verify-workflow <slice.json> <frozen-workflow.yml> <current-workflow.yml>'
  ].join('\n');
}

function runCli(argv = process.argv.slice(2), options = {}) {
  try {
    if (argv.length === 0 || ['help', '--help', '-h'].includes(argv[0])) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());
    if (argv[0] === 'verify-workflow') {
      if (argv.length !== 4) fail(usage());
      const spec = validateSpec(JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, argv[1]), 'utf8')));
      const historicalWorkflowText = fs.readFileSync(path.resolve(repositoryRoot, argv[2]), 'utf8');
      const currentWorkflowText = fs.readFileSync(path.resolve(repositoryRoot, argv[3]), 'utf8');
      process.stdout.write(`${JSON.stringify(verifyProductionWorkflowMigration({ spec, historicalWorkflowText, currentWorkflowText }), null, 2)}\n`);
      return 0;
    }
    if (!['verify', 'run'].includes(argv[0]) || argv.length !== 4) fail(usage());
    const inputs = loadInputs(argv[1], argv[2], argv[3], repositoryRoot);
    if (argv[0] === 'verify') {
      const report = verifyMigration({ ...inputs, timeoutMs: options.timeoutMs });
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
      return report.classification === 'MIGRATION_ADMISSIBLE' ? 0 : 3;
    }
    const receipt = runMigratedSlice({ ...inputs, timeoutMs: options.timeoutMs });
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    return receipt.classification === 'MIGRATED_SLICE_SUCCESS' ? 0 : 3;
  } catch (error) {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  VERSION,
  ORIGIN_FRONTIER,
  MIGRATION_CLASSIFICATIONS,
  EXECUTION_CLASSIFICATIONS,
  NON_EFFECTS,
  BoundedCIMigrationError,
  validateSpec,
  loadInputs,
  findContiguousCommandRange,
  buildMigrationContext,
  verifyMigration,
  runMigratedSlice,
  verifyProductionWorkflowMigration,
  runCli
};

if (require.main === module) process.exitCode = runCli();
