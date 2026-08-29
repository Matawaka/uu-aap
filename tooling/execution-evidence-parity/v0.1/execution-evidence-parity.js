#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');
const ConformanceParity = require('../../conformance-parity/v0.1/conformance-parity.js');
const Runner = require('../../generated-conformance-runner/v0.1/generated-conformance-runner.js');

const VERSION = '0.1';
const ORIGIN_FRONTIER = '8197e803a242fe6d7729963ae7ac9a9fb389b3cc';
const CLASSIFICATIONS = new Set([
  'EXACT_EXECUTION_EVIDENCE_PARITY',
  'ORDER_INSENSITIVE_SUCCESS_OUTPUT_DIFFERS',
  'ORDER_SENSITIVE_EXECUTION',
  'REPOSITORY_MUTATION_DETECTED',
  'INSUFFICIENT_EVIDENCE'
]);
const NON_EFFECTS = Object.freeze([
  'execution_evidence_parity_does_not_establish_semantic_truth',
  'output_digest_equality_does_not_prove_behavioral_equivalence_beyond_this_frontier',
  'order_insensitivity_here_does_not_prove_universal_order_independence',
  'execution_parity_does_not_prove_compatibility',
  'execution_parity_does_not_prove_substitutability',
  'execution_parity_does_not_create_authority',
  'execution_parity_does_not_authorize_ci_migration'
]);

class ExecutionEvidenceParityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExecutionEvidenceParityError';
  }
}

function fail(message) {
  throw new ExecutionEvidenceParityError(message);
}

function commandKey(command) {
  return `${command.executable}\u0000${command.args.join('\u0000')}`;
}

function planDigest(plan) {
  const identity = {
    version: plan.version,
    runner_origin_frontier: plan.runner_origin_frontier,
    target_component_id: plan.target_component_id,
    mode: plan.mode,
    source_workflow: plan.source_workflow,
    dependency_components: plan.dependency_components,
    commands: plan.commands.map(({ sequence, component_id, executable, args }) => ({ sequence, component_id, executable, args }))
  };
  return Runner.sha256Text(JSON.stringify(Runner.canonicalize(identity)));
}

function buildHistoricalManualOrderPlan({ baseline, workflowText, entries, targetComponentId = null }) {
  const binding = ConformanceParity.bindBaselineToWorkflow(baseline, workflowText);
  const generatedPlan = Runner.buildExecutionPlan({ baseline, workflowText, entries, targetComponentId });
  const ownerByCommand = new Map();
  for (const command of generatedPlan.commands) {
    const key = commandKey(command);
    if (ownerByCommand.has(key)) fail(`generated plan has duplicate command identity: ${key}`);
    ownerByCommand.set(key, command.component_id);
  }

  const manualCommands = binding.baseline.commands.map((raw, index) => {
    const normalized = Runner.normalizeCommand(raw, `baseline.commands[${index}]`);
    const owner = ownerByCommand.get(commandKey(normalized));
    if (!owner) fail(`manual command missing from generated parity plan: ${normalized.executable} ${normalized.args.join(' ')}`);
    if (owner === generatedPlan.target_component_id) fail('target component command entered predecessor-only manual plan');
    return {
      sequence: index + 1,
      component_id: owner,
      executable: normalized.executable,
      args: [...normalized.args]
    };
  });

  if (manualCommands.length !== generatedPlan.commands.length) fail('manual/generated command count mismatch');
  const manualSet = new Set(manualCommands.map(commandKey));
  const generatedSet = new Set(generatedPlan.commands.map(commandKey));
  if (manualSet.size !== generatedSet.size || [...manualSet].some((key) => !generatedSet.has(key))) {
    fail('manual/generated command-set mismatch');
  }

  const manualPlan = JSON.parse(JSON.stringify(generatedPlan));
  manualPlan.commands = manualCommands;
  manualPlan.plan_digest = planDigest(manualPlan);
  Runner.validateExecutionPlan(manualPlan);

  return { manualPlan, generatedPlan };
}

function validateReceipt(receipt, label) {
  if (!receipt || receipt.artifact_type !== 'UU-AAP-Generated-Conformance-Execution-Receipt') fail(`${label} is not a Generated Conformance execution receipt`);
  if (receipt.mode !== 'PREDECESSOR_ONLY') fail(`${label} is not predecessor-only evidence`);
  if (!Array.isArray(receipt.commands)) fail(`${label}.commands must be an array`);
  if (receipt.planned_command_count !== receipt.commands.length || receipt.attempted_command_count !== receipt.commands.length) {
    fail(`${label} has incomplete command evidence`);
  }
  if (receipt.stopped_early) fail(`${label} stopped early and cannot support full execution parity`);
  const seen = new Set();
  for (const command of receipt.commands) {
    if (command.component_id === receipt.target_component_id) fail(`${label} includes target-component command evidence`);
    const key = commandKey(command);
    if (seen.has(key)) fail(`${label} contains duplicate command result: ${key}`);
    seen.add(key);
  }
  return seen;
}

function indexReceipt(receipt, label) {
  validateReceipt(receipt, label);
  return new Map(receipt.commands.map((command) => [commandKey(command), command]));
}

function compareExecutionReceipts(historicalReceipt, generatedReceipt) {
  const historical = indexReceipt(historicalReceipt, 'historical receipt');
  const generated = indexReceipt(generatedReceipt, 'generated receipt');
  if (historicalReceipt.target_component_id !== generatedReceipt.target_component_id) fail('target component differs across execution receipts');
  if (historical.size !== generated.size) fail('execution receipt command counts differ');
  for (const key of historical.keys()) if (!generated.has(key)) fail(`generated receipt missing command result: ${key}`);
  for (const key of generated.keys()) if (!historical.has(key)) fail(`generated receipt contains extra command result: ${key}`);

  const comparisons = [];
  let statusDifferenceCount = 0;
  let outputDifferenceCount = 0;

  for (const historicalCommand of historicalReceipt.commands) {
    const key = commandKey(historicalCommand);
    const generatedCommand = generated.get(key);
    const statusEqual = historicalCommand.exit_code === generatedCommand.exit_code
      && historicalCommand.signal === generatedCommand.signal
      && historicalCommand.success === generatedCommand.success
      && historicalCommand.error_code === generatedCommand.error_code;
    const outputEqual = historicalCommand.stdout_sha256 === generatedCommand.stdout_sha256
      && historicalCommand.stdout_bytes === generatedCommand.stdout_bytes
      && historicalCommand.stderr_sha256 === generatedCommand.stderr_sha256
      && historicalCommand.stderr_bytes === generatedCommand.stderr_bytes;
    if (!statusEqual) statusDifferenceCount += 1;
    if (!outputEqual) outputDifferenceCount += 1;
    comparisons.push({
      executable: historicalCommand.executable,
      args: [...historicalCommand.args],
      component_id: historicalCommand.component_id,
      historical_sequence: historicalCommand.sequence,
      generated_sequence: generatedCommand.sequence,
      status_equal: statusEqual,
      output_evidence_equal: outputEqual,
      historical: {
        exit_code: historicalCommand.exit_code,
        signal: historicalCommand.signal,
        success: historicalCommand.success,
        error_code: historicalCommand.error_code,
        stdout_sha256: historicalCommand.stdout_sha256,
        stdout_bytes: historicalCommand.stdout_bytes,
        stderr_sha256: historicalCommand.stderr_sha256,
        stderr_bytes: historicalCommand.stderr_bytes
      },
      generated: {
        exit_code: generatedCommand.exit_code,
        signal: generatedCommand.signal,
        success: generatedCommand.success,
        error_code: generatedCommand.error_code,
        stdout_sha256: generatedCommand.stdout_sha256,
        stdout_bytes: generatedCommand.stdout_bytes,
        stderr_sha256: generatedCommand.stderr_sha256,
        stderr_bytes: generatedCommand.stderr_bytes
      }
    });
  }

  const repositoryMutation = historicalReceipt.repository_changed_after_run || generatedReceipt.repository_changed_after_run;
  const historicalAllSuccess = historicalReceipt.result === 'SUCCESS' && historicalReceipt.commands.every((command) => command.success);
  const generatedAllSuccess = generatedReceipt.result === 'SUCCESS' && generatedReceipt.commands.every((command) => command.success);

  let classification = 'INSUFFICIENT_EVIDENCE';
  if (repositoryMutation) classification = 'REPOSITORY_MUTATION_DETECTED';
  else if (statusDifferenceCount > 0) classification = 'ORDER_SENSITIVE_EXECUTION';
  else if (historicalAllSuccess && generatedAllSuccess && outputDifferenceCount > 0) classification = 'ORDER_INSENSITIVE_SUCCESS_OUTPUT_DIFFERS';
  else if (historicalAllSuccess && generatedAllSuccess && outputDifferenceCount === 0) classification = 'EXACT_EXECUTION_EVIDENCE_PARITY';

  if (!CLASSIFICATIONS.has(classification)) fail(`unknown classification: ${classification}`);

  return {
    classification,
    command_count: historical.size,
    status_difference_count: statusDifferenceCount,
    output_difference_count: outputDifferenceCount,
    historical_all_succeeded: historicalAllSuccess,
    generated_all_succeeded: generatedAllSuccess,
    repository_mutation_detected: Boolean(repositoryMutation),
    comparisons
  };
}

function assessExecutionEvidenceParity({ baseline, workflowText, entries, repositoryRoot = process.cwd(), timeoutMs, executor, snapshotter, environment }) {
  const { manualPlan, generatedPlan } = buildHistoricalManualOrderPlan({ baseline, workflowText, entries });
  const sharedEnvironment = environment || Runner.safeChildEnvironment();
  const common = { repositoryRoot, timeoutMs, executor, snapshotter, environment: sharedEnvironment };
  const historicalReceipt = Runner.executePlan(manualPlan, common);
  const generatedReceipt = Runner.executePlan(generatedPlan, common);
  const comparison = compareExecutionReceipts(historicalReceipt, generatedReceipt);

  return {
    artifact_type: 'UU-AAP-Execution-Evidence-Parity-Report',
    version: VERSION,
    origin_frontier: ORIGIN_FRONTIER,
    target_component_id: generatedPlan.target_component_id,
    source_workflow: generatedPlan.source_workflow,
    command_set_count: generatedPlan.commands.length,
    historical_execution: {
      order_profile: 'HISTORICAL_MANUAL_ORDER',
      plan_digest: manualPlan.plan_digest,
      attempted: historicalReceipt.attempted_command_count,
      succeeded: historicalReceipt.succeeded_command_count,
      failed: historicalReceipt.failed_command_count,
      repository_changed_after_run: historicalReceipt.repository_changed_after_run,
      result: historicalReceipt.result
    },
    generated_execution: {
      order_profile: 'GENERATED_DEPENDENCY_FIRST_ORDER',
      plan_digest: generatedPlan.plan_digest,
      attempted: generatedReceipt.attempted_command_count,
      succeeded: generatedReceipt.succeeded_command_count,
      failed: generatedReceipt.failed_command_count,
      repository_changed_after_run: generatedReceipt.repository_changed_after_run,
      result: generatedReceipt.result
    },
    classification: comparison.classification,
    status_difference_count: comparison.status_difference_count,
    output_difference_count: comparison.output_difference_count,
    command_comparisons: comparison.comparisons,
    claims: {
      complete_command_evidence_compared: true,
      success_outcome_order_insensitive_this_frontier: comparison.status_difference_count === 0 && comparison.historical_all_succeeded && comparison.generated_all_succeeded,
      exact_output_evidence_parity: comparison.classification === 'EXACT_EXECUTION_EVIDENCE_PARITY',
      semantic_truth_established: false,
      compatibility_proven: false,
      substitutability_proven: false,
      authority_created: false,
      ci_migration_authorized: false,
      universal_order_independence_proven: false
    },
    non_effects: [...NON_EFFECTS]
  };
}

function usage() {
  return 'Usage: node tooling/execution-evidence-parity/v0.1/execution-evidence-parity.js assess <baseline.json> <workflow.yml> <manifest...>';
}

function runCli(argv = process.argv.slice(2), options = {}) {
  try {
    if (argv.length === 0 || ['help', '--help', '-h'].includes(argv[0])) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    if (argv[0] !== 'assess' || argv.length < 4) fail(usage());
    const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());
    const baseline = JSON.parse(fs.readFileSync(path.resolve(repositoryRoot, argv[1]), 'utf8'));
    const workflowText = fs.readFileSync(path.resolve(repositoryRoot, argv[2]), 'utf8');
    const entries = DependencyImpact.loadManifests(argv.slice(3), { repositoryRoot });
    const report = assessExecutionEvidenceParity({ baseline, workflowText, entries, repositoryRoot, timeoutMs: options.timeoutMs });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.classification === 'REPOSITORY_MUTATION_DETECTED' || report.classification === 'ORDER_SENSITIVE_EXECUTION' || report.classification === 'INSUFFICIENT_EVIDENCE') return 3;
    return 0;
  } catch (error) {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  VERSION,
  ORIGIN_FRONTIER,
  CLASSIFICATIONS,
  NON_EFFECTS,
  ExecutionEvidenceParityError,
  commandKey,
  planDigest,
  buildHistoricalManualOrderPlan,
  compareExecutionReceipts,
  assessExecutionEvidenceParity,
  runCli
};

if (require.main === module) process.exitCode = runCli();
