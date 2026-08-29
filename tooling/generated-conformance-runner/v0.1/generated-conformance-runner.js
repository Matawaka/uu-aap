#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');
const ConformanceParity = require('../../conformance-parity/v0.1/conformance-parity.js');

const VERSION = '0.1';
const RUNNER_ORIGIN_FRONTIER = '729a9e581c6e5b6dbae95ac3407227e1469cdb68';
const ALLOWED_EXECUTABLES = new Set(['node', 'python', 'python3']);
const DEFAULT_TIMEOUT_MS = 120000;
const PLAN_NON_EFFECTS = Object.freeze([
  'execution_plan_does_not_create_authority',
  'execution_plan_does_not_prove_compatibility',
  'execution_plan_does_not_prove_substitutability',
  'execution_plan_does_not_authorize_ci_narrowing',
  'execution_plan_does_not_include_target_component_commands'
]);
const RECEIPT_NON_EFFECTS = Object.freeze([
  'command_success_does_not_establish_semantic_truth',
  'all_tests_pass_does_not_prove_compatibility',
  'generated_runner_does_not_authorize_ci_narrowing',
  'generated_runner_does_not_create_product_authority',
  'conformance_execution_does_not_authorize_external_effects',
  'generated_runner_is_not_product_runtime'
]);

class GeneratedConformanceRunnerError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GeneratedConformanceRunnerError';
  }
}

function fail(message) {
  throw new GeneratedConformanceRunnerError(message);
}

function stableCompare(a, b) {
  return String(a).localeCompare(String(b), 'en');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort(stableCompare)) out[key] = canonicalize(value[key]);
    return out;
  }
  return value;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function sha256Buffer(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function commandKey(command) {
  return `${command.executable}\u0000${command.args.join('\u0000')}`;
}

function normalizeCommand(command, location = 'command') {
  if (!isPlainObject(command)) fail(`${location} must be an object`);
  if (!ALLOWED_EXECUTABLES.has(command.executable)) fail(`${location}.executable is not allowed: ${command.executable}`);
  if (!Array.isArray(command.args) || command.args.length === 0) fail(`${location}.args must be a non-empty array`);
  const args = command.args.map((arg, index) => {
    if (typeof arg !== 'string' || arg.length === 0) fail(`${location}.args[${index}] must be a non-empty string`);
    if (/[;&|`]/.test(arg)) fail(`${location}.args[${index}] contains shell composition`);
    return arg;
  });
  return { executable: command.executable, args };
}

function ensureUniqueCommands(commands, location = 'commands') {
  const seen = new Set();
  return commands.map((command, index) => {
    const normalized = normalizeCommand(command, `${location}[${index}]`);
    const key = commandKey(normalized);
    if (seen.has(key)) fail(`${location} contains duplicate command: ${normalized.executable} ${normalized.args.join(' ')}`);
    seen.add(key);
    return normalized;
  });
}

function dependencyFirstComponentOrder(graph, targetComponentId) {
  if (!graph.components.some((component) => component.id === targetComponentId)) fail(`unknown target component: ${targetComponentId}`);
  if (graph.unresolved_required_dependencies.length) {
    const edge = graph.unresolved_required_dependencies[0];
    fail(`unresolved required dependency: ${edge.from} -> ${edge.to} (${edge.edge_kind})`);
  }
  if (graph.cycles.length) fail(`dependency cycle detected: ${graph.cycles[0].join(' -> ')}`);

  const allowed = new Set(ConformanceParity.transitiveDependencies(graph, targetComponentId));
  const outgoing = new Map(graph.components.map((component) => [component.id, []]));
  for (const edge of graph.edges) {
    if (edge.resolved && allowed.has(edge.from) && allowed.has(edge.to)) outgoing.get(edge.from).push(edge.to);
  }
  for (const values of outgoing.values()) values.sort(stableCompare);

  const temporary = new Set();
  const permanent = new Set();
  const order = [];
  function visit(id) {
    if (permanent.has(id)) return;
    if (temporary.has(id)) fail(`dependency cycle detected while ordering: ${id}`);
    temporary.add(id);
    for (const dependency of outgoing.get(id) || []) visit(dependency);
    temporary.delete(id);
    permanent.add(id);
    order.push(id);
  }
  for (const id of [...allowed].sort(stableCompare)) visit(id);
  return order;
}

function buildExecutionPlan({ baseline, workflowText, entries, targetComponentId = null }) {
  const parity = ConformanceParity.assessParity({ baseline, workflowText, entries, targetComponentId });
  if (parity.parity !== true) {
    fail(`parity gate failed: missing=${parity.missing_from_graph.length} extra=${parity.extra_in_graph.length}`);
  }
  if (parity.commands_executed !== false) fail('parity evidence unexpectedly claims command execution');

  const graph = DependencyImpact.buildGraph(entries);
  const target = targetComponentId || parity.target_component_id;
  const componentOrder = dependencyFirstComponentOrder(graph, target);
  const byId = new Map(graph.components.map((component) => [component.id, component]));
  const commands = [];
  const seen = new Set();

  for (const componentId of componentOrder) {
    if (componentId === target) fail('target component entered predecessor-only component order');
    const component = byId.get(componentId);
    for (const raw of component.conformance_commands) {
      const normalized = normalizeCommand(raw, `${componentId}.conformance`);
      const key = commandKey(normalized);
      if (seen.has(key)) fail(`duplicate graph command while planning: ${normalized.executable} ${normalized.args.join(' ')}`);
      seen.add(key);
      commands.push({
        sequence: commands.length + 1,
        component_id: componentId,
        executable: normalized.executable,
        args: normalized.args
      });
    }
  }

  const baselineCommands = ensureUniqueCommands(baseline.commands, 'baseline.commands');
  const baselineSet = new Set(baselineCommands.map(commandKey));
  const planSet = new Set(commands.map(commandKey));
  if (baselineSet.size !== planSet.size || [...baselineSet].some((key) => !planSet.has(key))) {
    fail('execution plan command set diverges from parity-proven manual baseline');
  }

  const identity = {
    version: VERSION,
    runner_origin_frontier: RUNNER_ORIGIN_FRONTIER,
    target_component_id: target,
    mode: 'PREDECESSOR_ONLY',
    source_workflow: {
      path: parity.source_workflow,
      blob_sha: parity.source_workflow_blob_sha
    },
    dependency_components: componentOrder,
    commands: commands.map(({ sequence, component_id, executable, args }) => ({ sequence, component_id, executable, args }))
  };
  const planDigest = sha256Text(JSON.stringify(canonicalize(identity)));

  return {
    artifact_type: 'UU-AAP-Generated-Conformance-Execution-Plan',
    version: VERSION,
    runner_origin_frontier: RUNNER_ORIGIN_FRONTIER,
    target_component_id: target,
    mode: 'PREDECESSOR_ONLY',
    source_workflow: identity.source_workflow,
    parity: {
      verified: true,
      manual_command_count: parity.manual_command_count,
      graph_command_count: parity.graph_command_count
    },
    dependency_components: componentOrder,
    commands,
    plan_digest: planDigest,
    claims: {
      parity_verified: true,
      commands_executed: false,
      target_component_commands_included: false,
      authority_created: false,
      compatibility_proven: false,
      ci_narrowing_authorized: false
    },
    non_effects: [...PLAN_NON_EFFECTS]
  };
}

function validateExecutionPlan(plan) {
  if (!isPlainObject(plan) || plan.artifact_type !== 'UU-AAP-Generated-Conformance-Execution-Plan') fail('invalid execution plan artifact_type');
  if (plan.version !== VERSION) fail(`execution plan version must be ${VERSION}`);
  if (plan.runner_origin_frontier !== RUNNER_ORIGIN_FRONTIER) fail('execution plan origin frontier mismatch');
  if (plan.mode !== 'PREDECESSOR_ONLY') fail('only PREDECESSOR_ONLY mode is supported in v0.1');
  if (!plan.parity || plan.parity.verified !== true) fail('execution plan requires exact parity evidence');
  if (!plan.claims || plan.claims.commands_executed !== false || plan.claims.target_component_commands_included !== false) fail('execution plan claims boundary mismatch');
  if (!Array.isArray(plan.commands) || plan.commands.length === 0) fail('execution plan requires commands');

  const normalized = ensureUniqueCommands(plan.commands, 'plan.commands');
  plan.commands.forEach((command, index) => {
    if (command.sequence !== index + 1) fail(`plan.commands[${index}].sequence mismatch`);
    if (typeof command.component_id !== 'string' || !command.component_id.length) fail(`plan.commands[${index}].component_id required`);
    if (command.component_id === plan.target_component_id) fail('target component command included in predecessor-only plan');
  });

  const identity = {
    version: plan.version,
    runner_origin_frontier: plan.runner_origin_frontier,
    target_component_id: plan.target_component_id,
    mode: plan.mode,
    source_workflow: plan.source_workflow,
    dependency_components: plan.dependency_components,
    commands: plan.commands.map(({ sequence, component_id, executable, args }) => ({ sequence, component_id, executable, args }))
  };
  const expected = sha256Text(JSON.stringify(canonicalize(identity)));
  if (plan.plan_digest !== expected) fail(`execution plan digest mismatch: expected ${expected}`);
  return { valid: true, command_count: normalized.length, plan_digest: expected };
}

function safeChildEnvironment(base = process.env) {
  const exact = new Set([
    'PATH', 'HOME', 'USER', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
    'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ',
    'CI', 'GITHUB_ACTIONS', 'RUNNER_TEMP', 'SYSTEMROOT', 'COMSPEC', 'PATHEXT'
  ]);
  const env = {};
  for (const [key, value] of Object.entries(base)) {
    if (value === undefined) continue;
    if (exact.has(key) || key.startsWith('LC_')) env[key] = value;
  }
  env.PYTHONUTF8 = '1';
  env.PYTHONDONTWRITEBYTECODE = '1';
  env.UU_AAP_GENERATED_CONFORMANCE_RUNNER = '1';
  return env;
}

function snapshotRepository(repositoryRoot) {
  const root = path.resolve(repositoryRoot);
  const records = [];
  function walk(current, relative) {
    const entries = fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => stableCompare(a.name, b.name));
    for (const entry of entries) {
      if (relative === '' && entry.name === '.git') continue;
      const absolute = path.join(current, entry.name);
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(absolute, rel);
      else if (entry.isSymbolicLink()) records.push(`L\u0000${rel}\u0000${fs.readlinkSync(absolute)}`);
      else if (entry.isFile()) records.push(`F\u0000${rel}\u0000${sha256Buffer(fs.readFileSync(absolute))}`);
    }
  }
  walk(root, '');
  return sha256Text(records.join('\n'));
}

function defaultExecutor(command, options) {
  const result = childProcess.spawnSync(command.executable, command.args, {
    cwd: options.repositoryRoot,
    env: options.environment,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: options.timeoutMs,
    maxBuffer: 32 * 1024 * 1024
  });
  return {
    status: result.status,
    signal: result.signal || null,
    error: result.error || null,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function executePlan(plan, options = {}) {
  validateExecutionPlan(plan);
  const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());
  const timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const executor = options.executor || defaultExecutor;
  const snapshotter = options.snapshotter || snapshotRepository;
  const environment = options.environment || safeChildEnvironment();
  const before = snapshotter(repositoryRoot);
  const results = [];
  let stoppedEarly = false;

  for (const command of plan.commands) {
    const executed = executor(command, { repositoryRoot, timeoutMs, environment });
    const stdout = String(executed.stdout || '');
    const stderr = String(executed.stderr || '');
    const success = !executed.error && executed.status === 0;
    results.push({
      sequence: command.sequence,
      component_id: command.component_id,
      executable: command.executable,
      args: [...command.args],
      exit_code: Number.isInteger(executed.status) ? executed.status : null,
      signal: executed.signal || null,
      success,
      stdout_sha256: sha256Text(stdout),
      stderr_sha256: sha256Text(stderr),
      stdout_bytes: Buffer.byteLength(stdout, 'utf8'),
      stderr_bytes: Buffer.byteLength(stderr, 'utf8'),
      error_code: executed.error && executed.error.code ? String(executed.error.code) : null
    });
    if (!success) {
      stoppedEarly = results.length < plan.commands.length;
      break;
    }
  }

  const after = snapshotter(repositoryRoot);
  const repositoryChanged = before !== after;
  const succeeded = results.filter((result) => result.success).length;
  const failed = results.length - succeeded;
  let result = 'SUCCESS';
  if (failed > 0) result = 'FAILED';
  if (repositoryChanged) result = 'REPOSITORY_MUTATED';

  return {
    artifact_type: 'UU-AAP-Generated-Conformance-Execution-Receipt',
    version: VERSION,
    runner_origin_frontier: RUNNER_ORIGIN_FRONTIER,
    target_component_id: plan.target_component_id,
    mode: plan.mode,
    source_workflow: plan.source_workflow,
    plan_digest: plan.plan_digest,
    planned_command_count: plan.commands.length,
    attempted_command_count: results.length,
    succeeded_command_count: succeeded,
    failed_command_count: failed,
    stopped_early: stoppedEarly,
    repository_changed_after_run: repositoryChanged,
    result,
    commands: results,
    claims: {
      all_commands_succeeded: result === 'SUCCESS',
      compatibility_proven: false,
      semantic_truth_established: false,
      authority_created: false,
      external_effect_authorized: false,
      ci_narrowing_authorized: false,
      product_runtime_activated: false
    },
    non_effects: [...RECEIPT_NON_EFFECTS]
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function usage() {
  return [
    'Usage:',
    '  node tooling/generated-conformance-runner/v0.1/generated-conformance-runner.js plan <baseline.json> <workflow.yml> <manifest...>',
    '  node tooling/generated-conformance-runner/v0.1/generated-conformance-runner.js run <baseline.json> <workflow.yml> <manifest...>'
  ].join('\n');
}

function loadPlanInputs(argv, repositoryRoot) {
  if (argv.length < 4) fail(usage());
  const baseline = readJson(path.resolve(repositoryRoot, argv[1]));
  const workflowText = fs.readFileSync(path.resolve(repositoryRoot, argv[2]), 'utf8');
  const entries = DependencyImpact.loadManifests(argv.slice(3), { repositoryRoot });
  return { baseline, workflowText, entries };
}

function runCli(argv = process.argv.slice(2), options = {}) {
  try {
    if (argv.length === 0 || ['help', '--help', '-h'].includes(argv[0])) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    if (!['plan', 'run'].includes(argv[0])) fail(`unknown command: ${argv[0]}`);
    const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());
    const inputs = loadPlanInputs(argv, repositoryRoot);
    const plan = buildExecutionPlan(inputs);
    if (argv[0] === 'plan') {
      process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
      return 0;
    }
    const receipt = executePlan(plan, { repositoryRoot, timeoutMs: options.timeoutMs });
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    return receipt.result === 'SUCCESS' ? 0 : 3;
  } catch (error) {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  VERSION,
  RUNNER_ORIGIN_FRONTIER,
  ALLOWED_EXECUTABLES,
  PLAN_NON_EFFECTS,
  RECEIPT_NON_EFFECTS,
  GeneratedConformanceRunnerError,
  canonicalize,
  sha256Text,
  normalizeCommand,
  dependencyFirstComponentOrder,
  buildExecutionPlan,
  validateExecutionPlan,
  safeChildEnvironment,
  snapshotRepository,
  executePlan,
  runCli
};

if (require.main === module) process.exitCode = runCli();
