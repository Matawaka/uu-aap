'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

function fail(message) { throw new Error(message); }
const repo = path.resolve(__dirname, '../../../..');
const bindings = require('./source-bindings.json');

if (bindings.artifact_type !== 'C2PASDKEventResponsiveDormancyAdapterSourceBindings' || bindings.version !== '0.1') fail('binding identity');
if (bindings.repository_predecessor_main !== '783a053ff41a94e369aad3155431ded78ed8e98e') fail('predecessor main');
if (bindings.tracking_issue !== 924) fail('tracking issue');

for (const [name, binding] of Object.entries(bindings.bindings)) {
  if (!binding.path || !/^[0-9a-f]{40}$/.test(binding.blob || '')) fail(`invalid binding ${name}`);
  const absolute = path.join(repo, binding.path);
  if (!fs.existsSync(absolute)) fail(`missing source ${name}`);
  const actual = cp.execFileSync('git', ['hash-object', binding.path], { cwd: repo, encoding: 'utf8' }).trim();
  if (actual !== binding.blob) fail(`blob drift ${name}: ${actual} != ${binding.blob}`);
}

const qualification = JSON.parse(fs.readFileSync(path.join(repo, bindings.bindings.recoverable_state_qualification.path), 'utf8'));
const q1 = qualification.cases.find(c => c.id === 'Q1_C2PA_SDK_SUCCESSOR');
if (!q1) fail('Q1 missing');
if (q1.consumer_family !== 'C2PA_SDK_PRESERVATION' || q1.erd_fit !== 'ADAPTER_FIT' || q1.rerc_fit !== 'NOT_NEEDED' || q1.composition_fit !== 'NOT_NEEDED' || q1.recommended_dependency !== 'ERD_ONLY') fail('Q1 semantics drift');

const receipt = JSON.parse(fs.readFileSync(path.join(repo, bindings.bindings.swift_targeted_receipt.path), 'utf8'));
if (receipt.receipt_fingerprint_sha256 !== bindings.bindings.swift_targeted_receipt.receipt_fingerprint_sha256) fail('Swift receipt fingerprint drift');
if (receipt.upstream.main_sha !== bindings.expected_frontier.swift_main) fail('Swift main drift');
if (receipt.upstream.public_binary_release !== bindings.expected_frontier.swift_public_binary) fail('Swift binary drift');
if (receipt.external_swiftpm_consumer.classification !== bindings.expected_frontier.swift_consumer_classification) fail('Swift classification drift');
if (receipt.android.main_sha !== bindings.expected_frontier.android_main || receipt.android.classification !== bindings.expected_frontier.android_classification) fail('Android frontier drift');
if (receipt.current_cross_sdk_compatibility_established !== false || receipt.cross_sdk_p0_3_complete !== false) fail('compatibility overclaim');

if (Object.values(bindings.non_effects).some(v => v !== false)) fail('binding non-effect escalation');

const adapterText = fs.readFileSync(path.join(__dirname, 'adapter.js'), 'utf8');
if (!adapterText.includes("require('../../event-responsive-dormancy/v0.1/event-responsive-dormancy.js')")) fail('direct ERD import missing');
if (adapterText.includes("require('../../rerc/")) fail('unexpected RERC dependency');
if (adapterText.includes('recoverable-state/v0.1')) fail('unexpected RSIC dependency');
if (!adapterText.includes('checks: null')) fail('attention-only checks binding missing');

console.log(JSON.stringify({
  validation: 'PASS',
  source_binding_count: Object.keys(bindings.bindings).length,
  qualified_case: q1.id,
  dependency: q1.recommended_dependency,
  accepted_swift_state: receipt.external_swiftpm_consumer.classification,
  current_cross_sdk_compatibility_established: false,
}, null, 2));
