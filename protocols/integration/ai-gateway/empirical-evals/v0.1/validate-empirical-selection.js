#!/usr/bin/env node
const fs = require('fs');
const {aggregate, hashWithoutContentHash} = require('./aggregate-trials.js');
const fixture = JSON.parse(fs.readFileSync(__dirname + '/trial-fixtures.json','utf8'));

function assert(x,msg){ if(!x) throw new Error(msg); }

const noEvidence = aggregate(fixture.records);
assert(noEvidence.status === 'no_empirical_evidence','planned/synthetic records must not become empirical evidence');
assert(noEvidence.observed_trial_count === 0,'synthetic/planned counted as observed');
assert(noEvidence.eligible_trial_count === 0,'synthetic/planned counted as eligible');
assert(noEvidence.cohorts.gateway_exposed.gateway_selection_rate === null,'rate must be null without empirical evidence');
assert(noEvidence.interpretation.synthetic_or_planned_counted_as_empirical === false,'interpretation flag');

const observedBase = JSON.parse(JSON.stringify(fixture.records[1]));
observedBase.trial_id='observed-test-exposed';
observedBase.evidence_class='observed';
observedBase.provider={name:'test-provider',model:'test-model',configuration_hash:'sha256:'+'2'.repeat(64)};
observedBase.provenance.evidence_refs=['operator-visible:test-evidence'];
observedBase.content_hash=hashWithoutContentHash(observedBase);

const observedControl = JSON.parse(JSON.stringify(observedBase));
observedControl.trial_id='observed-test-unexposed';
observedControl.scenario.gateway_exposed=false;
observedControl.observed_behavior.gateway_selected_before_consequential_action=false;
observedControl.observed_behavior.gateway_tool_invoked=false;
observedControl.observed_behavior.gateway_decision='not_selected';
observedControl.content_hash=hashWithoutContentHash(observedControl);

const report = aggregate([observedBase, observedControl]);
assert(report.status === 'descriptive_only','observed evidence must produce descriptive report');
assert(report.observed_trial_count === 2 && report.eligible_trial_count === 2,'observed count');
assert(report.cohorts.gateway_exposed.gateway_selection_rate === 1,'exposed selection rate');
assert(report.cohorts.gateway_unexposed.gateway_selection_rate === 0,'unexposed selection rate');
assert(report.interpretation.causal_effect_claimed === false,'must not infer causality');
assert(report.interpretation.universal_generalization_claimed === false,'must not generalize universally');

for (const r of fixture.records) assert(r.content_hash === hashWithoutContentHash(r),'fixture content hash mismatch');

console.log('UU_AAP_AI_GATEWAY_EMPIRICAL_SELECTION_V0_1_PASS');
