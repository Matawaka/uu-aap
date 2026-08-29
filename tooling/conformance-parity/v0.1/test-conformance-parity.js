#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Parity = require('./conformance-parity.js');
const DependencyImpact = require('../../dependency-impact/v0.1/dependency-impact.js');

const ROOT = path.resolve(__dirname, '../../..');
const BASELINE_PATH = 'tooling/conformance-parity/v0.1/marketcloser-publication.manual-baseline.json';
const WORKFLOW_PATH = process.env.UU_AAP_HISTORICAL_WORKFLOW || '.github/workflows/marketcloser-publication-observation-v0.1-validation.yml';
const MANIFEST_PATHS = [
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

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadInputs() {
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, BASELINE_PATH), 'utf8'));
  const workflowText = fs.readFileSync(path.resolve(ROOT, WORKFLOW_PATH), 'utf8');
  const entries = DependencyImpact.loadManifests(MANIFEST_PATHS, { repositoryRoot: ROOT });
  return { baseline, workflowText, entries };
}

function component(entries, id) {
  const found = entries.find((entry) => entry.manifest.component.id === id);
  assert(found, `missing test component ${id}`);
  return found.manifest;
}

(function main() {
  const { baseline, workflowText, entries } = loadInputs();

  const extracted = Parity.extractManualPredecessorCommands(workflowText);
  assert.strictEqual(extracted.length, 27);
  assert.strictEqual(Parity.gitBlobSha(workflowText), baseline.source.workflow_blob_sha);
  assert.deepStrictEqual(extracted, baseline.commands);

  const report = Parity.assessParity({ baseline, workflowText, entries });
  assert.strictEqual(report.parity, true);
  assert.strictEqual(report.manual_command_count, 27);
  assert.strictEqual(report.graph_command_count, 27);
  assert.strictEqual(report.dependency_components.length, 14);
  assert.deepStrictEqual(report.missing_from_graph, []);
  assert.deepStrictEqual(report.extra_in_graph, []);
  assert.strictEqual(report.commands_executed, false);
  assert.strictEqual(report.production_workflow_modified, false);
  assert.strictEqual(report.ci_narrowing_authorized, false);
  assert.strictEqual(report.compatibility_proven, false);
  assert.strictEqual(report.authority_created, false);

  const missingEntries = deepClone(entries);
  component(missingEntries, 'MarketCloser-Copy-Export-Receipt').conformance.commands.pop();
  const missingReport = Parity.assessParity({ baseline, workflowText, entries: missingEntries });
  assert.strictEqual(missingReport.parity, false);
  assert.strictEqual(missingReport.missing_from_graph.length, 1);
  assert.strictEqual(missingReport.extra_in_graph.length, 0);

  const extraEntries = deepClone(entries);
  component(extraEntries, 'MarketCloser-Copy-Export-Receipt').conformance.commands.push({
    executable: 'node',
    args: ['applications/marketcloser/v0.1/copy-export-receipt/v0.1/test-copy-export.js', '--unexpected']
  });
  const extraReport = Parity.assessParity({ baseline, workflowText, entries: extraEntries });
  assert.strictEqual(extraReport.parity, false);
  assert.strictEqual(extraReport.missing_from_graph.length, 0);
  assert.strictEqual(extraReport.extra_in_graph.length, 1);

  const duplicateEntries = deepClone(entries);
  component(duplicateEntries, 'MarketCloser-Human-Response-Approval').conformance.commands.push({
    executable: 'node',
    args: ['applications/marketcloser/v0.1/copy-export-receipt/v0.1/test-copy-export.js']
  });
  assert.throws(
    () => Parity.assessParity({ baseline, workflowText, entries: duplicateEntries }),
    /duplicate command/
  );

  const unresolvedEntries = deepClone(entries);
  component(unresolvedEntries, 'MarketCloser-Publication-Observation').dependencies.push({
    component_id: 'Missing-Parity-Dependency',
    edge_kind: 'CONFORMANCE',
    required: true
  });
  assert.throws(
    () => Parity.assessParity({ baseline, workflowText, entries: unresolvedEntries }),
    /unresolved required dependency/
  );

  const cycleEntries = deepClone(entries);
  component(cycleEntries, 'Marketer-Pessimist-Product-Contract').dependencies.push({
    component_id: 'MarketCloser-Publication-Observation',
    edge_kind: 'CONFORMANCE',
    required: true
  });
  assert.throws(
    () => Parity.assessParity({ baseline, workflowText, entries: cycleEntries }),
    /dependency cycle detected/
  );

  assert.throws(
    () => Parity.assessParity({
      baseline,
      workflowText,
      entries,
      targetComponentId: 'Missing-Target'
    }),
    /unknown target component/
  );

  const driftedWorkflow = `${workflowText}\n# synthetic drift`;
  assert.throws(
    () => Parity.assessParity({ baseline, workflowText: driftedWorkflow, entries }),
    /workflow blob drift/
  );

  const shortenedBaseline = deepClone(baseline);
  shortenedBaseline.commands.pop();
  shortenedBaseline.command_count -= 1;
  assert.throws(
    () => Parity.assessParity({ baseline: shortenedBaseline, workflowText, entries }),
    /baseline does not exactly match/
  );

  console.log('Graph-vs-manual conformance parity v0.1: PASS');
})();
