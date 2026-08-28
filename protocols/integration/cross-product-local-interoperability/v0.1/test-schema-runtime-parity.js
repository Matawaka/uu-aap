'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Interop = require('./local-interoperability.js');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
}

function sorted(value) {
  return [...value].sort();
}

const scenarioSchema = load('scenario.schema.json');
const receiptSchema = load('receipt.schema.json');

assert.deepStrictEqual(sorted(scenarioSchema.required), sorted(Interop.SCENARIO_KEYS), 'scenario required keys drift');
assert.deepStrictEqual(
  sorted(scenarioSchema.properties.evaluation_frontier.$ref ? scenarioSchema.$defs.frontier.required : []),
  sorted(Interop.FRONTIER_KEYS),
  'scenario frontier keys drift'
);
assert.deepStrictEqual(sorted(scenarioSchema.$defs.lane.required), sorted(Interop.LANE_KEYS), 'scenario lane keys drift');
assert.deepStrictEqual(sorted(scenarioSchema.properties.controls.required), sorted(Interop.CONTROL_KEYS), 'scenario control keys drift');

assert.deepStrictEqual(sorted(receiptSchema.required), sorted(Interop.RECEIPT_KEYS), 'receipt required keys drift');
assert.deepStrictEqual(sorted(receiptSchema.$defs.lane.required), sorted(Interop.RECEIPT_LANE_KEYS), 'receipt lane keys drift');
assert.deepStrictEqual(
  sorted(receiptSchema.properties.shared_infrastructure.required),
  sorted(Interop.SHARED_INFRASTRUCTURE_KEYS),
  'shared infrastructure keys drift'
);
assert.deepStrictEqual(sorted(receiptSchema.properties.isolation.required), sorted(Interop.ISOLATION_KEYS), 'isolation keys drift');
assert.deepStrictEqual(sorted(receiptSchema.properties.claims.required), sorted(Interop.CLAIM_KEYS), 'receipt claim keys drift');

for (const key of Interop.TRUE_CLAIMS) {
  assert.strictEqual(receiptSchema.properties.claims.properties[key].const, true, `schema positive claim drift: ${key}`);
}
for (const key of Interop.FALSE_CLAIMS) {
  assert.strictEqual(receiptSchema.properties.claims.properties[key].const, false, `schema false claim drift: ${key}`);
}

assert.strictEqual(receiptSchema.properties.status.const, Interop.STATUS, 'receipt status drift');
assert.strictEqual(receiptSchema.properties.next_safe_action.const, Interop.NEXT_SAFE_ACTION, 'next safe action drift');
assert.strictEqual(receiptSchema.properties.shared_infrastructure.properties.transport_protocol.const, 'UU-AAP-AI-TRANSPORT-REFERENCE');
assert.strictEqual(receiptSchema.properties.shared_infrastructure.properties.transport_profile.const, 'local-evidence-packet-v0.1');

console.log('CROSS_PRODUCT_LOCAL_INTEROP_SCHEMA_RUNTIME_PARITY_V0_1_PASS');
