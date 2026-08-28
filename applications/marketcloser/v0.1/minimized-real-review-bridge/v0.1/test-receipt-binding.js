'use strict';

const fs = require('fs');
const path = require('path');
const Bridge = require('./bridge.js');
const Binding = require('./receipt-binding.js');

const fixture = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, 'examples/synthetic-minimized-review.input.json'), 'utf8'));
const receipt = Bridge.deriveReceipt(fixture);
Binding.validateReceiptAgainstInput(receipt, fixture);

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function mustFail(mutator, label) {
  const changed = clone(fixture);
  mutator(changed);
  Bridge.rehash(changed);
  let failed = false;
  try { Binding.validateReceiptAgainstInput(receipt, changed); } catch (_) { failed = true; }
  if (!failed) throw new Error(`source substitution accepted: ${label}`);
}

mustFail(x => {
  x.minimized_case.claim_package.claim_text = 'Substituted minimized claim.';
}, 'minimized claim substitution');
mustFail(x => {
  x.pressure_context.reserve_weeks = 99;
}, 'pressure-context substitution');
mustFail(x => {
  x.deployment_observation.observed_application.reported_version = 'substituted-version';
  const Deployment = require(path.resolve(__dirname, '../../deployment-observation/v0.1/deployment-observation.js'));
  Deployment.rehash(x.deployment_observation);
}, 'deployment observation substitution');

console.log('MarketCloser minimized bridge exact receipt binding: PASS');
