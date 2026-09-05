'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const validator = require('./validate-interface-registry-v0.3.js');
const v02 = require('../v0.2/validate-interface-registry-v0.2.js');

const ROOT = path.resolve(__dirname, '../../..');
const delta = JSON.parse(fs.readFileSync(path.join(__dirname, 'interface-registry-delta.json'), 'utf8'));
const effectiveV02 = v02.validateRepository();

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function reject(mutator, pattern) {
  const candidate = clone(delta);
  mutator(candidate);
  assert.throws(() => validator.validateDelta(candidate, effectiveV02, { checkPaths: false, checkEvidence: false }), pattern);
}

const effective = validator.validateDelta(delta, effectiveV02, { checkPaths: true, checkEvidence: true });
assert.equal(effective.version, '0.3');
assert.equal(effective.entries.length, 18);
assert.equal(effective.entries.filter(item => item.id === 'ObservationSet').length, 1);
assert.equal(effective.entries.some(item => item.id === 'ObservationSetTransition'), false);
assert.equal(effective.entries.some(item => item.id === 'LocalObservationSetChain'), false);
assert.equal(effective.entries.some(item => item.id === 'ObservationSetCalculusCandidate'), false);

reject(d => { d.additions[0].id = 'ObservationSetTransition'; }, /typed interface contract drift|forbidden interface/);
reject(d => { d.additions[0].id = 'LocalObservationSetChain'; }, /typed interface contract drift|forbidden interface/);
reject(d => { d.additions[0].id = 'ObservationSetCalculusCandidate'; }, /typed interface contract drift|forbidden interface/);
reject(d => { d.additions.push(clone(d.additions[0])); }, /exactly one/);
reject(d => { d.additions[0].status = 'stable'; }, /typed interface contract drift/);
reject(d => { d.additions[0].status = 'core'; }, /typed interface contract drift/);
reject(d => { d.additions[0].provider_neutral = false; }, /typed interface contract drift/);
reject(d => { d.additions[0].external_effect_emission = true; }, /typed interface contract drift/);
reject(d => { d.additions[0].next_interfaces_are_automatic = true; }, /typed interface contract drift/);
reject(d => { d.additions[0].next_interfaces = ['ObservationSetTransition']; }, /typed interface contract drift/);
reject(d => { d.additions[0].dependencies = ['ObservationSetTransition']; }, /typed interface contract drift/);
reject(d => { d.additions[0].path = 'protocols/integration/observation-set-calculus-candidate/v0.1/transition'; }, /typed interface contract drift/);
reject(d => { d.admission_scope.admitted_api = 'evaluate_transition'; }, /set-only admission scope drift/);
reject(d => { d.admission_scope.deferred_apis = ['evaluate_chain']; }, /set-only admission scope drift/);
reject(d => { d.admission_scope.monolithic_candidate_admitted = true; }, /set-only admission scope drift/);
reject(d => { d.admission_scope.stable_core_admitted = true; }, /set-only admission scope drift/);
reject(d => { d.admission_scope.independent_consumer_families = ['C2PA_AUTHORITY_OBSERVABILITY']; }, /set-only admission scope drift/);
reject(d => { d.base_registry.blob = '0000000000000000000000000000000000000000'; }, /predecessor binding invalid/);
reject(d => { d.effective_entry_count = 19; }, /effective entry count drift/);
reject(d => { d.non_claims = d.non_claims.filter(item => item !== 'transition_interface_admitted'); }, /non_claims invalid|missing non-claim/);
reject(d => { d.non_claims.push('release_authorized'); }, /non_claims invalid/);
reject(d => { d.release_registry_equivalent = true; }, /delta identity invalid/);

console.log('Reusable Protocol Interface Registry v0.3 tests: SUCCESS (22 hostile/positive boundaries)');
