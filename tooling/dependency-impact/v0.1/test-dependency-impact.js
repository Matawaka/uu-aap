#!/usr/bin/env node
'use strict';

const assert = require('assert');
const Impact = require('./dependency-impact.js');

const MANIFESTS = [
  'tooling/component-manifest/v0.1/examples/uu-aap-core.component.json',
  'tooling/component-manifest/v0.1/examples/ial-compact.component.json',
  'tooling/component-manifest/v0.1/examples/ai-gateway.component.json',
  'tooling/component-manifest/v0.1/examples/ai-transport-reference.component.json'
];

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectImpactError(fn, fragment) {
  assert.throws(fn, (error) =>
    error &&
    error.name === 'DependencyImpactError' &&
    (!fragment || error.message.includes(fragment))
  );
}

function main() {
  const entries = Impact.loadManifests(MANIFESTS);
  const graph = Impact.buildGraph(entries);

  assert.deepStrictEqual(
    graph.components.map((component) => component.id),
    ['AI-Gateway', 'AI-Transport-Reference', 'IAL-Compact', 'UU-AAP-Core']
  );
  assert.strictEqual(graph.unresolved_required_dependencies.length, 0);
  assert.deepStrictEqual(graph.cycles, []);

  const ialReverse = Impact.reverseDependencies(graph, 'IAL-Compact');
  assert.deepStrictEqual(ialReverse.map((item) => item.component_id), ['AI-Transport-Reference']);
  assert.strictEqual(ialReverse[0].edge_kind, 'RUNTIME_IMPORT');

  const coreDependents = Impact.transitiveDependents(graph, 'UU-AAP-Core');
  assert.deepStrictEqual(coreDependents, ['AI-Gateway', 'AI-Transport-Reference']);

  const pathImpact = Impact.impactFromPaths(graph, [
    'protocols/ial/v0.1/compact/ial-compact.js'
  ]);
  assert.deepStrictEqual(pathImpact.directly_changed_components, ['IAL-Compact']);
  assert.deepStrictEqual(pathImpact.affected_components, ['AI-Transport-Reference', 'IAL-Compact']);
  assert(pathImpact.conformance_commands.some((command) =>
    command.component_id === 'AI-Transport-Reference' &&
    command.args.includes('protocols/integration/ai-transport-reference/v0.1/test-reference-transport.js')
  ));

  const gatewayPath = Impact.whyDependent(graph, 'AI-Transport-Reference', 'AI-Gateway');
  assert.deepStrictEqual(gatewayPath.components, ['AI-Transport-Reference', 'AI-Gateway']);
  assert.strictEqual(gatewayPath.edges[0].edge_kind, 'RUNTIME_IMPORT');

  const corePath = Impact.whyDependent(graph, 'AI-Gateway', 'UU-AAP-Core');
  assert.deepStrictEqual(corePath.components, ['AI-Gateway', 'UU-AAP-Core']);
  assert.strictEqual(corePath.edges[0].edge_kind, 'EVIDENCE');

  const coreImpact = Impact.impactFromComponents(graph, ['UU-AAP-Core']);
  assert.deepStrictEqual(coreImpact.affected_components, ['AI-Gateway', 'AI-Transport-Reference', 'UU-AAP-Core']);

  const reversedGraph = Impact.buildGraph([...entries].reverse());
  assert.deepStrictEqual(Impact.graphSummary(graph), Impact.graphSummary(reversedGraph));
  assert.deepStrictEqual(
    Impact.impactFromComponents(graph, ['UU-AAP-Core']),
    Impact.impactFromComponents(reversedGraph, ['UU-AAP-Core'])
  );

  expectImpactError(() => Impact.buildGraph(entries.concat([entries[0]])), 'duplicate component id');

  const unresolved = entries.map((entry) => ({ manifest: deepClone(entry.manifest), manifest_path: entry.manifest_path }));
  const gateway = unresolved.find((entry) => entry.manifest.component.id === 'AI-Gateway').manifest;
  gateway.dependencies[0].component_id = 'Missing-Core';
  const incompleteGraph = Impact.buildGraph(unresolved);
  assert.strictEqual(incompleteGraph.unresolved_required_dependencies.length, 1);
  expectImpactError(() => Impact.impactFromComponents(incompleteGraph, ['AI-Gateway']), 'unresolved required dependency');

  const cycleEntries = entries.map((entry) => ({ manifest: deepClone(entry.manifest), manifest_path: entry.manifest_path }));
  const ial = cycleEntries.find((entry) => entry.manifest.component.id === 'IAL-Compact').manifest;
  ial.dependencies.push({
    component_id: 'AI-Transport-Reference',
    edge_kind: 'TEST_ONLY',
    required: true,
    interface: null,
    notes: 'synthetic negative cycle'
  });
  expectImpactError(() => Impact.buildGraph(cycleEntries), 'dependency cycle detected');
  const cycleGraph = Impact.buildGraph(cycleEntries, { allowCycles: true });
  assert(cycleGraph.cycles.length >= 1);

  expectImpactError(() => Impact.impactFromComponents(graph, ['Unknown-Component']), 'unknown component id');
  expectImpactError(() => Impact.impactFromPaths(graph, ['unowned/path.txt']), 'no component owns changed path');

  const graphJson = JSON.stringify(Impact.graphSummary(graph));
  const impactJson = JSON.stringify(pathImpact);
  for (const prohibited of ['authority_created":true', 'responsibility_accepted":true', 'substitutable":true']) {
    assert(!graphJson.includes(prohibited));
    assert(!impactJson.includes(prohibited));
  }

  console.log('Dependency / Impact Graph v0.1 conformance: PASS');
}

main();
