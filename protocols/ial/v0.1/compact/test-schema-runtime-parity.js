'use strict';

const fs = require('fs');
const path = require('path');
const {
  IALCompactError,
  rehash,
  validateEnvelope
} = require('./ial-compact.js');

const examplePath = path.join(__dirname, 'examples', 'marketer-pessimist-e0.envelope.json');
const base = JSON.parse(fs.readFileSync(examplePath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectReject(name, mutate) {
  const candidate = clone(base);
  mutate(candidate);
  rehash(candidate);
  let rejected = false;
  try {
    validateEnvelope(candidate);
  } catch (error) {
    rejected = error instanceof IALCompactError;
  }
  assert(rejected, `invalid vector unexpectedly passed runtime validation: ${name}`);
}

validateEnvelope(base);

const rejectedVectors = [
  ['date-only observed_at', value => { value.frontier.observed_at = '2026-08-27'; }],
  ['observed_at without timezone', value => { value.frontier.observed_at = '2026-08-27T02:01:50'; }],
  ['invalid calendar date', value => { value.frontier.observed_at = '2026-02-30T02:01:50Z'; }],
  ['zero year', value => { value.frontier.observed_at = '0000-01-01T00:00:00Z'; }],
  ['leap second outside the selected schema profile', value => { value.frontier.observed_at = '2026-12-31T23:59:60Z'; }],
  ['product version longer than schema maximum', value => { value.consumer.product_version = '9'.repeat(65); }],
  ['product version outside path profile', value => { value.consumer.product_version = 'release-0.1'; }],
  ['declared product version differs from contract path', value => { value.consumer.product_version = '9.9'; }],
  ['contract path version differs from declared product version', value => {
    value.consumer.product_contract_path = 'products/marketer-pessimist/v9.9/product-contract.json';
  }]
];

for (const [name, mutate] of rejectedVectors) expectReject(name, mutate);

for (const observedAt of ['2026-08-27t02:01:50z', '2026-08-27T02:01:50+23:59']) {
  const candidate = clone(base);
  candidate.frontier.observed_at = observedAt;
  rehash(candidate);
  validateEnvelope(candidate);
}

console.log(JSON.stringify({
  suite: 'IAL Compact schema/runtime and product-binding parity',
  invalid_vectors_rejected: rejectedVectors.length,
  schema_valid_edge_vectors_accepted: 2,
  product_path_version_binding_enforced: true,
  result: 'PASS'
}, null, 2));
