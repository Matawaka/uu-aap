'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { runScenario, hash, ROOT, alwaysFalse } = require('./lifecycle-trial.js');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const arms = ['fresh_boundary', 'cached_boundary'];

function run() {
  const pins = read(path.join(__dirname, 'source-pins.json'));
  for (const [filename, expected] of Object.entries(pins.source_sha256)) {
    assert.equal(sha256(path.join(ROOT, filename)), expected, `predecessor source drift: ${filename}`);
  }
  const scenarios = read(path.join(__dirname, 'scenarios.json'));
  const results = [];
  const differences = [];
  for (const scenario of scenarios) {
    const pair = [];
    for (const arm of arms) {
      const result = runScenario(scenario, arm);
      assert.equal(result.receipts.length, scenario.expected[arm].length, `${scenario.id}: receipt count`);
      for (const [index, expected] of scenario.expected[arm].entries()) {
        for (const [field, value] of Object.entries(expected)) {
          assert.deepEqual(result.receipts[index][field], value, `${scenario.id}/${arm}/${index}/${field}`);
        }
        for (const [claim, value] of Object.entries(alwaysFalse)) {
          assert.equal(result.receipts[index][claim], value, `${scenario.id}: prohibited ${claim}`);
        }
      }
      results.push(result);
      pair.push(result.receipts.map(x => ({ response_status: x.response_status,
        contract_status: x.contract_status, contract_reason: x.contract_reason })));
    }
    if (JSON.stringify(pair[0]) !== JSON.stringify(pair[1])) differences.push(scenario.id);
    assert.equal(JSON.stringify(pair[0]) !== JSON.stringify(pair[1]), scenario.expected_differential,
      `${scenario.id}: predeclared differential expectation`);
  }
  return {
    experiment: 'personal-anchor-synthetic-lifecycle-v0.1',
    origin_frontier: pins.origin_frontier,
    source_sha256: pins.source_sha256,
    experiment_sha256: Object.fromEntries(['lifecycle-trial.js', 'scenarios.json',
      'run-lifecycle-trials.js'].map(name => [name, sha256(path.join(__dirname, name))])),
    scope: 'OFFLINE_SYNTHETIC_LIFECYCLE',
    real_person_count: 0, biometric_recording_count: 0,
    end_to_end_pcc_and_biometrics: 'NOT_EXECUTED',
    scenario_count: scenarios.length, arm_count: results.length,
    differential_scenarios: differences,
    ...alwaysFalse,
    results,
  };
}

function main(args) {
  assert(args.every(x => ['--check-reference', '--write-reference'].includes(x)), 'unsupported argument');
  assert(!(args.includes('--check-reference') && args.includes('--write-reference')), 'choose one reference operation');
  const report = run();
  const serialized = JSON.stringify(report, null, 2) + '\n';
  const reference = path.join(__dirname, 'reference-results.json');
  if (args.includes('--write-reference')) fs.writeFileSync(reference, serialized);
  if (args.includes('--check-reference')) assert.equal(fs.readFileSync(reference, 'utf8'), serialized,
    'reference drift: retain evidence and investigate; do not silently refresh');
  console.log(`Synthetic lifecycle: ${report.scenario_count} scenarios / ${report.arm_count} arms conform; ` +
    `${report.differential_scenarios.length} predeclared cached-boundary divergences`);
  console.log(`End-to-end PCC/biometrics: ${report.end_to_end_pcc_and_biometrics}; report ${hash(report)}`);
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { run, main };
