'use strict';

const fs = require('fs');
const path = require('path');
const Permit = require('./permit.js');
const Binding = require('./permit-binding.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const reject = (fn, label) => {
  let rejected = false;
  try { fn(); } catch (_) { rejected = true; }
  assert(rejected, `${label} must reject`);
};

const waitInput = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'examples/synthetic-permit-wait.input.json'), 'utf8'));
const waitDecision = Permit.deriveDecisionReceipt(waitInput);
assert(Binding.assertDecisionBinding(waitInput, waitDecision) === true, 'waiting decision binding failed');
const tamperedWaitDecision = clone(waitDecision);
tamperedWaitDecision.execution_frontier.revision = '4444444444444444444444444444444444444444';
Permit.rehash(tamperedWaitDecision);
reject(() => Binding.assertDecisionBinding(waitInput, tamperedWaitDecision), 'tampered waiting decision');

const positiveGatePath = '/tmp/marketcloser-positive-permit-gate.input.json';
assert(fs.existsSync(positiveGatePath), 'positive gate fixture missing; run test-permit.js first');
const positiveGateInput = JSON.parse(fs.readFileSync(positiveGatePath, 'utf8'));
const positiveInput = clone(waitInput);
positiveInput.materialization_id = 'urn:uu-aap:marketcloser:real-review-run-permit-materialization:synthetic-positive-001';
positiveInput.authority_gate_source = {
  mode: 'local_private',
  path: positiveGatePath,
  expected_gate_input_hash: positiveGateInput.content_hash
};
positiveInput.execution_frontier = {
  repository: 'Matawaka/uu-aap',
  revision: '1111111111111111111111111111111111111111',
  tree: '2222222222222222222222222222222222222222',
  observed_at: '2026-08-28T23:30:30Z'
};
positiveInput.requested_run.run_id = 'urn:uu-aap:marketcloser:real-review-run:synthetic-positive-001';
positiveInput.materialized_at = '2026-08-28T23:31:00Z';
Permit.rehash(positiveInput);

const decision = Permit.deriveDecisionReceipt(positiveInput);
const permit = Permit.materializePermit(positiveInput);
assert(Binding.assertDecisionBinding(positiveInput, decision) === true, 'positive decision binding failed');
assert(Binding.assertPermitBinding(positiveInput, permit) === true, 'positive permit binding failed');

const tamperedPermit = clone(permit);
tamperedPermit.bridge_binding.marketer_candidate_hash = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
Permit.rehash(tamperedPermit);
reject(() => Binding.assertPermitBinding(positiveInput, tamperedPermit), 'candidate-substituted permit');

console.log('MarketCloser run permit exact source binding: PASS');
