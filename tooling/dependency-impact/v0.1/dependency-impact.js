#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ComponentManifest = require('../../component-manifest/v0.1/validate-component-manifest.js');

const VERSION = '0.1';
const GRAPH_NON_EFFECTS = Object.freeze([
  'dependency_graph_does_not_create_authority',
  'dependency_graph_does_not_accept_responsibility',
  'dependency_graph_does_not_prove_compatibility',
  'dependency_graph_does_not_prove_substitutability',
  'dependency_graph_does_not_execute_conformance_commands'
]);

class DependencyImpactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DependencyImpactError';
  }
}

function fail(message) {
  throw new DependencyImpactError(message);
}

function stableCompare(a, b) {
  return String(a).localeCompare(String(b), 'en');
}

function sortUnique(values) {
  return [...new Set(values)].sort(stableCompare);
}

function commandKey(command) {
  return `${command.executable}\u0000${command.args.join('\u0000')}`;
}

function edgeKey(edge) {
  return [edge.from, edge.to, edge.edge_kind, edge.required ? '1' : '0', edge.interface || ''].join('\u0000');
}

function loadManifest(filePath, options = {}) {
  const repositoryRoot = options.repositoryRoot || process.cwd();
  const absolute = path.resolve(repositoryRoot, filePath);
  const manifest = JSON.parse(fs.readFileSync(absolute, 'utf8'));
  ComponentManifest.validateManifest(manifest, { repositoryRoot });
  return { manifest, manifest_path: path.relative(repositoryRoot, absolute).split(path.sep).join('/') };
}

function loadManifests(filePaths, options = {}) {
  if (!Array.isArray(filePaths) || filePaths.length === 0) fail('at least one Component Manifest path is required');
  return filePaths.map((filePath) => loadManifest(filePath, options));
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) fail('at least one Component Manifest entry is required');
  const seen = new Set();
  return entries.map((entry, index) => {
    const wrapped = entry && entry.manifest ? entry : { manifest: entry, manifest_path: null };
    const manifest = wrapped.manifest;
    if (!manifest || !manifest.component || !manifest.component.id) fail(`entries[${index}] is not a Component Manifest`);
    const id = manifest.component.id;
    if (seen.has(id)) fail(`duplicate component id: ${id}`);
    seen.add(id);
    return { manifest, manifest_path: wrapped.manifest_path || null };
  }).sort((a, b) => stableCompare(a.manifest.component.id, b.manifest.component.id));
}

function findCycles(componentIds, edges) {
  const adjacency = new Map(componentIds.map((id) => [id, []]));
  for (const edge of edges) {
    if (edge.resolved) adjacency.get(edge.from).push(edge.to);
  }
  for (const values of adjacency.values()) values.sort(stableCompare);

  const state = new Map();
  const stack = [];
  const cycles = [];
  const cycleKeys = new Set();

  function visit(id) {
    state.set(id, 1);
    stack.push(id);
    for (const next of adjacency.get(id)) {
      const nextState = state.get(next) || 0;
      if (nextState === 0) visit(next);
      else if (nextState === 1) {
        const start = stack.lastIndexOf(next);
        const cycle = stack.slice(start).concat(next);
        const body = cycle.slice(0, -1);
        const rotations = body.map((_, i) => body.slice(i).concat(body.slice(0, i)));
        rotations.sort((a, b) => stableCompare(a.join('\u0000'), b.join('\u0000')));
        const normalized = rotations[0].concat(rotations[0][0]);
        const key = normalized.join('->');
        if (!cycleKeys.has(key)) {
          cycleKeys.add(key);
          cycles.push(normalized);
        }
      }
    }
    stack.pop();
    state.set(id, 2);
  }

  for (const id of componentIds) {
    if (!state.get(id)) visit(id);
  }
  return cycles.sort((a, b) => stableCompare(a.join('\u0000'), b.join('\u0000')));
}

function buildGraph(entries, options = {}) {
  const normalized = normalizeEntries(entries);
  const byId = new Map(normalized.map((entry) => [entry.manifest.component.id, entry]));
  const components = normalized.map((entry) => ({
    id: entry.manifest.component.id,
    version: entry.manifest.component.version,
    kind: entry.manifest.component.kind,
    status: entry.manifest.component.status,
    path: entry.manifest.component.path,
    manifest_path: entry.manifest_path,
    source_frontier: entry.manifest.source_frontier,
    conformance_commands: entry.manifest.conformance.commands
  }));

  const edges = [];
  for (const entry of normalized) {
    const from = entry.manifest.component.id;
    for (const dependency of entry.manifest.dependencies) {
      edges.push({
        from,
        to: dependency.component_id,
        edge_kind: dependency.edge_kind,
        required: dependency.required,
        interface: dependency.interface ?? null,
        resolved: byId.has(dependency.component_id)
      });
    }
  }
  edges.sort((a, b) => stableCompare(edgeKey(a), edgeKey(b)));

  const unresolvedRequired = edges
    .filter((edge) => edge.required && !edge.resolved)
    .map((edge) => ({ from: edge.from, to: edge.to, edge_kind: edge.edge_kind, interface: edge.interface }))
    .sort((a, b) => stableCompare(`${a.from}\u0000${a.to}\u0000${a.edge_kind}`, `${b.from}\u0000${b.to}\u0000${b.edge_kind}`));

  const componentIds = components.map((component) => component.id);
  const cycles = findCycles(componentIds, edges);
  if (cycles.length && !options.allowCycles) fail(`dependency cycle detected: ${cycles[0].join(' -> ')}`);

  return {
    artifact_type: 'UU-AAP-Dependency-Graph',
    version: VERSION,
    components,
    edges,
    unresolved_required_dependencies: unresolvedRequired,
    cycles,
    non_effects: [...GRAPH_NON_EFFECTS]
  };
}

function ensureComponent(graph, componentId) {
  if (!graph.components.some((component) => component.id === componentId)) fail(`unknown component id: ${componentId}`);
}

function ensureComplete(graph) {
  if (graph.unresolved_required_dependencies.length) {
    const first = graph.unresolved_required_dependencies[0];
    fail(`unresolved required dependency: ${first.from} -> ${first.to} (${first.edge_kind})`);
  }
}

function directDependencies(graph, componentId) {
  ensureComponent(graph, componentId);
  return graph.edges
    .filter((edge) => edge.from === componentId && edge.resolved)
    .map((edge) => ({ component_id: edge.to, edge_kind: edge.edge_kind, required: edge.required, interface: edge.interface }));
}

function reverseDependencies(graph, componentId) {
  ensureComponent(graph, componentId);
  return graph.edges
    .filter((edge) => edge.to === componentId && edge.resolved)
    .map((edge) => ({ component_id: edge.from, edge_kind: edge.edge_kind, required: edge.required, interface: edge.interface }))
    .sort((a, b) => stableCompare(`${a.component_id}\u0000${a.edge_kind}`, `${b.component_id}\u0000${b.edge_kind}`));
}

function transitiveDependents(graph, componentId) {
  ensureComponent(graph, componentId);
  const reverse = new Map(graph.components.map((component) => [component.id, []]));
  for (const edge of graph.edges) {
    if (edge.resolved) reverse.get(edge.to).push(edge.from);
  }
  for (const values of reverse.values()) values.sort(stableCompare);

  const visited = new Set();
  const queue = [...reverse.get(componentId)];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of reverse.get(current)) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  visited.delete(componentId);
  return [...visited].sort(stableCompare);
}

function whyDependent(graph, sourceComponentId, targetComponentId) {
  ensureComponent(graph, sourceComponentId);
  ensureComponent(graph, targetComponentId);
  if (sourceComponentId === targetComponentId) return { components: [sourceComponentId], edges: [] };

  const outgoing = new Map(graph.components.map((component) => [component.id, []]));
  for (const edge of graph.edges) {
    if (edge.resolved) outgoing.get(edge.from).push(edge);
  }
  for (const values of outgoing.values()) values.sort((a, b) => stableCompare(edgeKey(a), edgeKey(b)));

  const queue = [{ id: sourceComponentId, components: [sourceComponentId], edges: [] }];
  const visited = new Set([sourceComponentId]);
  while (queue.length) {
    const current = queue.shift();
    for (const edge of outgoing.get(current.id)) {
      const next = edge.to;
      const nextState = {
        id: next,
        components: current.components.concat(next),
        edges: current.edges.concat({
          from: edge.from,
          to: edge.to,
          edge_kind: edge.edge_kind,
          required: edge.required,
          interface: edge.interface
        })
      };
      if (next === targetComponentId) {
        return { components: nextState.components, edges: nextState.edges };
      }
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(nextState);
      }
    }
  }
  return null;
}

function owningComponentsForPath(graph, changedPath) {
  if (typeof changedPath !== 'string' || changedPath.length === 0) fail('changed path must be a non-empty string');
  const normalized = changedPath.replace(/\\/g, '/').replace(/^\.\/+/, '');
  const owners = [];
  for (const component of graph.components) {
    const componentPrefix = component.path.endsWith('/') ? component.path : `${component.path}/`;
    if (normalized === component.path || normalized.startsWith(componentPrefix) || normalized === component.manifest_path) {
      owners.push(component.id);
    }
  }
  return sortUnique(owners);
}

function conformanceCommandsForComponents(graph, componentIds) {
  const wanted = new Set(componentIds);
  const commands = [];
  for (const component of graph.components) {
    if (!wanted.has(component.id)) continue;
    for (const command of component.conformance_commands) {
      commands.push({ component_id: component.id, executable: command.executable, args: [...command.args] });
    }
  }
  commands.sort((a, b) => stableCompare(
    `${a.component_id}\u0000${commandKey(a)}`,
    `${b.component_id}\u0000${commandKey(b)}`
  ));
  return commands;
}

function impactFromComponents(graph, changedComponentIds) {
  ensureComplete(graph);
  if (!Array.isArray(changedComponentIds) || changedComponentIds.length === 0) fail('at least one changed component id is required');
  const direct = sortUnique(changedComponentIds);
  direct.forEach((id) => ensureComponent(graph, id));
  const affected = new Set(direct);
  for (const id of direct) {
    for (const dependent of transitiveDependents(graph, id)) affected.add(dependent);
  }
  const affectedComponents = [...affected].sort(stableCompare);
  return {
    artifact_type: 'UU-AAP-Impact-Result',
    version: VERSION,
    change: { kind: 'COMPONENT', values: direct },
    directly_changed_components: direct,
    affected_components: affectedComponents,
    conformance_commands: conformanceCommandsForComponents(graph, affectedComponents),
    unresolved_required_dependencies: [],
    non_effects: [
      'affected_does_not_mean_incompatible',
      'impact_does_not_authorize_change',
      'conformance_discovery_does_not_execute_commands',
      'impact_does_not_prove_substitutability',
      'dependency_reachability_does_not_transfer_authority'
    ]
  };
}

function impactFromPaths(graph, changedPaths) {
  ensureComplete(graph);
  if (!Array.isArray(changedPaths) || changedPaths.length === 0) fail('at least one changed path is required');
  const normalizedPaths = sortUnique(changedPaths.map((value) => value.replace(/\\/g, '/').replace(/^\.\/+/, '')));
  const direct = sortUnique(normalizedPaths.flatMap((changedPath) => owningComponentsForPath(graph, changedPath)));
  if (direct.length === 0) fail(`no component owns changed path(s): ${normalizedPaths.join(', ')}`);
  const result = impactFromComponents(graph, direct);
  result.change = { kind: 'PATH', values: normalizedPaths };
  return result;
}

function graphSummary(graph) {
  return {
    artifact_type: graph.artifact_type,
    version: graph.version,
    component_ids: graph.components.map((component) => component.id),
    edges: graph.edges,
    unresolved_required_dependencies: graph.unresolved_required_dependencies,
    cycles: graph.cycles,
    non_effects: graph.non_effects
  };
}

function parseCli(argv) {
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') return { command: 'help' };
  const command = argv[0];
  if (command === 'graph' || command === 'cycles') return { command, manifestPaths: argv.slice(1) };
  if (['reverse-deps', 'transitive-dependents', 'impact-component'].includes(command)) {
    return { command, componentId: argv[1], manifestPaths: argv.slice(2) };
  }
  if (command === 'impact-path') return { command, changedPath: argv[1], manifestPaths: argv.slice(2) };
  if (command === 'why-dependent') {
    return { command, source: argv[1], target: argv[2], manifestPaths: argv.slice(3) };
  }
  fail(`unknown command: ${command}`);
}

function usage() {
  return [
    'Usage:',
    '  dependency-impact.js graph <manifest...>',
    '  dependency-impact.js reverse-deps <component> <manifest...>',
    '  dependency-impact.js transitive-dependents <component> <manifest...>',
    '  dependency-impact.js impact-component <component> <manifest...>',
    '  dependency-impact.js impact-path <changed-path> <manifest...>',
    '  dependency-impact.js why-dependent <source> <target> <manifest...>',
    '  dependency-impact.js cycles <manifest...>'
  ].join('\n');
}

function runCli(argv = process.argv.slice(2), options = {}) {
  try {
    const parsed = parseCli(argv);
    if (parsed.command === 'help') {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    if (!parsed.manifestPaths || parsed.manifestPaths.length === 0) fail('at least one manifest path is required');
    const entries = loadManifests(parsed.manifestPaths, options);
    const graph = buildGraph(entries, { allowCycles: parsed.command === 'cycles' });

    let output;
    if (parsed.command === 'graph') output = graphSummary(graph);
    else if (parsed.command === 'cycles') output = { cycles: graph.cycles };
    else if (parsed.command === 'reverse-deps') output = reverseDependencies(graph, parsed.componentId);
    else if (parsed.command === 'transitive-dependents') output = transitiveDependents(graph, parsed.componentId);
    else if (parsed.command === 'impact-component') output = impactFromComponents(graph, [parsed.componentId]);
    else if (parsed.command === 'impact-path') output = impactFromPaths(graph, [parsed.changedPath]);
    else if (parsed.command === 'why-dependent') output = whyDependent(graph, parsed.source, parsed.target);
    else fail(`unsupported command: ${parsed.command}`);

    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error.name || 'Error'}: ${error.message}\n`);
    return 1;
  }
}

module.exports = {
  VERSION,
  GRAPH_NON_EFFECTS,
  DependencyImpactError,
  loadManifest,
  loadManifests,
  buildGraph,
  graphSummary,
  directDependencies,
  reverseDependencies,
  transitiveDependents,
  whyDependent,
  owningComponentsForPath,
  conformanceCommandsForComponents,
  impactFromComponents,
  impactFromPaths,
  findCycles,
  runCli
};

if (require.main === module) process.exitCode = runCli();
