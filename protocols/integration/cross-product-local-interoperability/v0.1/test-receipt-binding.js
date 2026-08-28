'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Interop = require('./local-interoperability.js');
const Binding = require('./receipt-binding.js');

const outputDir = process.argv[2] || '/tmp/cross-product-local-interop';
const scenarioPath = path.join(outputDir, 'scenario.json');
assert.strictEqual(fs.existsSync(scenarioPath), true, 'scenario.json required; run test-local-interoperability.js first');

const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));
const receipt = Interop.buildReceipt(scenario);
assert.strictEqual(Binding.validateReceiptAgainstScenario(receipt, scenario), true);

function reject(name, mutation, pattern) {
  const changed = JSON.parse(JSON.stringify(receipt));
  mutation(changed);
  Interop.rehash(changed);
  let error = null;
  try {
    Binding.validateReceiptAgainstScenario(changed, scenario);
  } catch (value) {
    error = value;
  }
  assert(error, `${name}: expected rejection`);
  assert.match(error.message, pattern, `${name}: unexpected rejection`);
}

reject('scenario_hash_substitution', changed => {
  changed.scenario_hash = `sha256:${'0'.repeat(64)}`;
}, /receipt\/source scenario binding mismatch/);

reject('evaluation_frontier_substitution', changed => {
  changed.evaluation_frontier.revision = 'f'.repeat(40);
}, /receipt\/source scenario binding mismatch/);

reject('lane_packet_hash_substitution', changed => {
  changed.lanes[0].transport_packet_hash = `sha256:${'1'.repeat(64)}`;
}, /receipt\/source scenario binding mismatch/);

reject('lane_gateway_result_substitution', changed => {
  changed.lanes.find(lane => lane.product_id === 'honest-hiring').gateway_result = 'inspected';
}, /receipt Gateway result mismatch|receipt\/source scenario binding mismatch/);

console.log('CROSS_PRODUCT_LOCAL_INTEROP_RECEIPT_SOURCE_BINDING_V0_1_PASS');
