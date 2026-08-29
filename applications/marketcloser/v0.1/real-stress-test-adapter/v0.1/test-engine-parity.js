'use strict';

const fs = require('fs');
const path = require('path');
const Local = require(path.resolve(__dirname, '../../../../../products/marketer-pessimist/v0.1/local-mvp/stress-test.js'));
const Engine = require('./engine.js');

const fixture = JSON.parse(fs.readFileSync(path.resolve(
  __dirname,
  '../../../../../products/marketer-pessimist/v0.1/local-mvp/examples/synthetic-onboarding.input.json'
), 'utf8'));

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const canonical = value => Array.isArray(value) ? value.map(canonical)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;

Local.validateInput(fixture);
assert(fixture.controls.synthetic_only === true, 'parity fixture must remain synthetic-only');
const legacy = Local.analyze(fixture);
const modern = Engine.analyzeBoundedCase({
  claim_package: fixture.claim_package,
  supporting_evidence: fixture.supporting_evidence,
  decision_constraints: fixture.decision_constraints
});
const projection = receipt => ({
  state: receipt.state,
  uncertainty_states: receipt.uncertainty_states,
  classification_summary: receipt.classification_summary,
  evidence_lineage: receipt.evidence_lineage,
  counterarguments: receipt.counterarguments,
  causal_alternatives: receipt.causal_alternatives,
  falsifiers: receipt.falsifiers,
  missing_evidence: receipt.missing_evidence,
  recommendation_candidate: receipt.recommendation_candidate,
  success_criteria: receipt.success_criteria
});
assert(
  JSON.stringify(canonical(projection(legacy))) === JSON.stringify(canonical(modern)),
  'real-capable engine diverges from Local MVP analytical semantics'
);
console.log('MarketCloser real stress-test engine parity with Local MVP: PASS');
