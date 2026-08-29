#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');

const VERSION = '0.1';
const NON_EFFECTS = Object.freeze([
  'parity_discovery_does_not_execute_commands',
  'manual_workflow_does_not_define_universal_dependency_truth',
  'workflow_coverage_does_not_prove_complete_runtime_import_graph',
  'equal_command_sets_do_not_prove_compatibility',
  'parity_success_does_not_authorize_ci_narrowing'
]);

class ConformanceParityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConformanceParityError';
  }
}

function fail(message) {
  throw new ConformanceParityError(message);
}

function stableCompare(a, b) {
  return String(a).localeCompare(String(b), 'en');
}

function commandKey(command) {
  return `${command.executable}\u0000${command.args.join('\u0000')}`;
}

function normalizeCommand(command, location = 'command') {
  if (!command || typeof command !== 'object' || Array.isArray(command)) fail(`${location} must be an object`);
  if (!['node', 'python', 'python3'].includes(command.executable)) fail(`${location}.executable is not allowed`);
  if (!Array.isArray(command.args) || command.args.length === 0) fail(`${location}.args must be a non-empty array`);
  const args = command.args.map((arg, index) => {
    if (typeof arg !== 'string' || !arg.length) fail(`${location}.args[${index}] must be a non-empty string`);
    if (/[;&|`]/.test(arg)) fail(`${location}.args[${index}] contains shell composition`);
    return arg;
  });
  return { executable: command.executable, args };
}

function validateUniqueCommands(commands, location) {
  const seen = new Set();
  return commands.map((command, index) => {
    const normalized = normalizeCommand(command, `${location}[${index}]`);
    const key = commandKey(normalized);
    if (seen.has(key)) fail(`${location} contains duplicate command: ${normalized.executable} ${normalized.args.join(' ')}`);
    seen.add(key);
    return normalized;
  });
}

function gitBlobSha(content) {
  const body = Buffer.from(content, 'utf8');
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([header, body])).digest('hex');
}

function extractManualPredecessorCommands(workflowText) {
  if (typeof workflowText !== 'string') fail('workflow text must be a string');
  const lines = workflowText.split(/\r?\n/);
  const commands = [];
  let capture = false;
  let inRun = false;

  for (const line of lines) {
    const nameMatch = line.match(/^\s{6}- name:\s*(.+?)\s*$/);
    if (nameMatch) {
      const name = nameMatch[1];
      capture = /^Re-run .+ predecessors$/.test(name);
      inRun = false;
      continue;
    }
    if (capture && /^\s{8}run:\s*\|\s*$/.test(line)) {
      inRun = true;
      continue;
    }
    if (!capture || !inRun) continue;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(node|python|python3)\s+([^\s;&|`]+)\s*$/);
    if (!match) fail(`unsupported predecessor command syntax in workflow: ${trimmed}`);
    commands.push({ executable: match[1], args: [match[2]] });
  }

  return validateUniqueCommands(commands, 'extracted predecessor commands');
}

function validateBaseline(baseline) {
  if (!baseline || typeof baseline !== 'object' || Array.isArray(baseline)) fail('baseline must be an object');
  if (baseline.artifact_type !== 'UU-AAP-Manual-Conformance-Baseline') fail('baseline artifact_type mismatch');
  if (baseline.version !== VERSION) fail(`baseline version must be ${VERSION}`);
  if (!baseline.source || typeof baseline.source.workflow_path !== 'string' || !baseline.source.workflow_path.length) fail('baseline source workflow_path required');
  if (!/^[0-9a-f]{40}$/.test(baseline.source.workflow_blob_sha || '')) fail('baseline source workflow_blob_sha must be a Git blob SHA');
  if (typeof baseline.target_component_id !== 'string' || !baseline.target_component_id.length) fail('baseline target_component_id required');
  if (!Array.isArray(baseline.commands)) fail('baseline commands must be an array');
  const commands = validateUniqueCommands(baseline.commands, 'baseline.commands');
  if (baseline.command_count !== commands.length) fail(`baseline command_count mismatch: ${baseline.command_count} != ${commands.length}`);
  return { ...baseline, commands };
}

function bindBaselineToWorkflow(baseline, workflowText) {
  const validated = validateBaseline(baseline);
  const actualBlobSha = gitBlobSha(workflowText);
  if (actualBlobSha !== validated.source.workflow_blob_sha) {
    fail(`workflow blob drift: expected ${validated.source.workflow_blob_sha}, got ${actualBlobSha}`);
  }
  const extracted = extractManualPredecessorCommands(workflowText);
  const baselineKeys = validated.commands.map(commandKey);
  const extractedKeys = extracted.map(commandKey);
  if (JSON.stringify(baselineKeys) !== JSON.stringify(extractedKeys)) {
    fail('committed baseline does not exactly match historical predecessor command order/content');
  }
  return { baseline: validated, extracted, workflow_blob_sha: actualBlobSha };
}

function ensureCompleteGraph(graph) {
  if (graph.cycles && graph.cycles.length) fail(`dependency cycle detected: ${graph.cycles[0].join(' -> ')}`);
  if (graph.unresolved_required_dependencies && graph.unresolved_required_dependencies.length) {
    const first = graph.unresolved_required_dependencies[0];
    fail(`unresolved required dependency: ${first.from} -> ${first.to} (${first.edge_kind})`);
  }
}

function transitiveDependencies(graph, targetComponentId) {
  if (!graph.components.some((component) => component.id === targetComponentId)) fail(`unknown target component: ${targetComponentId}`);
  ensureCompleteGraph(graph);

  const outgoing = new Map(graph.components.map((component) => [component.id, []]));
  for (const edge of graph.edges) {
    if (edge.resolved) outgoing.get(edge.from).push(edge.to);
  }
  for (const values of outgoing.values()) values.sort(stableCompare);

  const visited = new Set();
  const queue = [...outgoing.get(targetComponentId)];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of outgoing.get(current)) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  visited.delete(targetComponentId);
  return [...visited].sort(stableCompare);
}

function derivePredecessorCommands(graph, targetComponentId) {
  const dependencyComponents = transitiveDependencies(graph, targetComponentId);
  const commands = DependencyImpact.conformanceCommandsForComponents(graph, dependencyComponents);
  const normalized = validateUniqueCommands(
    commands.map(({ executable, args }) => ({ executable, args })),
    'graph-derived commands'
  ).sort((a, b) => stableCompare(commandKey(a), commandKey(b)));
  return { dependency_components: dependencyComponents, commands: normalized };
}

function diffCommandSets(manualCommands, graphCommands) {
  const manual = new Map(manualCommands.map((command) => [commandKey(command), command]));
  const graph = new Map(graphCommands.map((command) => [commandKey(command), command]));
  const missing = [...manual.entries()].filter(([key]) => !graph.has(key)).map(([, value]) => value);
  const extra = [...graph.entries()].filter(([key]) => !manual.has(key)).map(([, value]) => value);
  missing.sort((a, b) => stableCompare(commandKey(a), commandKey(b)));
  extra.sort((a, b) => stableCompare(commandKey(a), commandKey(b)));
  return { missing_from_graph: missing, extra_in_graph: extra };
}

function assessParity({ baseline, workflowText, entries, targetComponentId = null }) {
  const binding = bindBaselineToWorkflow(baseline, workflowText);
  const graph = DependencyImpact.buildGraph(entries);
  ensureCompleteGraph(graph);
  const target = targetComponentId || binding.baseline.target_component_id;
  const derived = derivePredecessorCommands(graph, target);
  const manualSorted = [...binding.baseline.commands].sort((a, b) => stableCompare(commandKey(a), commandKey(b)));
  const diff = diffCommandSets(manualSorted, derived.commands);
  const parity = diff.missing_from_graph.length === 0 && diff.extra_in_graph.length === 0;

  return {
    artifact_type: 'UU-AAP-Conformance-Parity-Report',
    version: VERSION,
    source_workflow: binding.baseline.source.workflow_path,
    source_workflow_blob_sha: binding.workflow_blob_sha,
    target_component_id: target,
    dependency_components: derived.dependency_components,
    manual_command_count: manualSorted.length,
    graph_command_count: derived.commands.length,
    parity,
    missing_from_graph: diff.missing_from_graph,
    extra_in_graph: diff.extra_in_graph,
    commands_executed: false,
    production_workflow_modified: false,
    ci_narrowing_authorized: false,
    compatibility_proven: false,
    authority_created: false,
    non_effects: [...NON_EFFECTS]
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function usage() {
  return 'Usage: node tooling/conformance-parity/v0.1/conformance-parity.js assess <baseline.json> <workflow.yml> <manifest...>';
}

function runCli(argv = process.argv.slice(2), options = {}) {
  try {
    if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    if (argv[0] !== 'assess' || argv.length < 4) fail(usage());
    const repositoryRoot = options.repositoryRoot || process.cwd();
    const baseline = readJson(path.resolve(repositoryRoot, argv[1]));
    const workflowText = fs.readFileSync(path.resolve(repositoryRoot, argv[2]), 'utf8');
    const entries = DependencyImpact.loadManifests(argv.slice(3), { repositoryRoot });
    const report = assessParity({ baseline, workflowText, entries });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.parity ? 0 : 2;
  } catch (error) {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  VERSION,
  NON_EFFECTS,
  ConformanceParityError,
  commandKey,
  gitBlobSha,
  extractManualPredecessorCommands,
  validateBaseline,
  bindBaselineToWorkflow,
  transitiveDependencies,
  derivePredecessorCommands,
  diffCommandSets,
  assessParity,
  runCli
};

if (require.main === module) process.exitCode = runCli();
