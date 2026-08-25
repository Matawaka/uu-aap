'use strict';

const fs = require('fs');
const path = require('path');

const base = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(base, 'fixture.json'), 'utf8'));
const schema = JSON.parse(fs.readFileSync(path.join(base, 'latent-evidentiary-knowledge.schema.json'), 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function subset(xs, ys) {
  return xs.every(x => ys.includes(x));
}

function sameSet(a, b) {
  return a.length === b.length && subset(a, b) && subset(b, a);
}

function validate(r) {
  assert(schema.additionalProperties === false, 'schema must be closed');
  assert(r.profile === 'uu-aap.latent-evidentiary-knowledge.v0.1', 'profile');
  const required = ['request_id','purpose','authority','identity_need','minimal_challenge','proof_sufficiency','scope','correlation','disclosure','decision','non_effects'];
  for (const k of required) assert(Object.prototype.hasOwnProperty.call(r, k), `missing ${k}`);

  assert(r.purpose.satisfied === true && r.purpose.id && r.purpose.declared, 'purpose');
  assert(r.authority.satisfied === true && r.authority.evidence_ref && r.authority.scope.length > 0, 'authority');
  assert(r.identity_need.necessary === true && r.identity_need.satisfied === true && r.identity_need.reason, 'identity need');
  assert(r.minimal_challenge.satisfied === true, 'challenge unsatisfied');
  assert(r.minimal_challenge.requested_attributes.length > 0, 'empty challenge');
  assert(sameSet(r.minimal_challenge.requested_attributes, r.minimal_challenge.minimum_attributes), 'challenge not minimal');
  assert(r.proof_sufficiency.satisfied === true && r.proof_sufficiency.result === 'sufficient', 'proof insufficient');
  assert(r.proof_sufficiency.evidence_refs.length > 0, 'proof evidence absent');
  assert(r.scope.satisfied === true && r.scope.fields.length > 0 && r.scope.audience.length > 0 && r.scope.contexts.length > 0, 'scope');

  if (r.correlation.requested) {
    assert(r.correlation.authorized === true, 'correlation unauthorized');
    assert(r.correlation.contexts.length > 0 && subset(r.correlation.contexts, r.scope.contexts), 'correlation scope');
  } else {
    assert(r.correlation.contexts.length === 0, 'latent correlation contexts must be empty');
  }

  assert(subset(r.disclosure.fields, r.scope.fields), 'disclosure fields exceed scope');
  assert(subset(r.disclosure.audience, r.scope.audience), 'disclosure audience exceeds scope');
  assert(r.disclosure.performed === false, 'validator profile must not disclose');
  assert(r.decision === 'activation-permitted', 'positive chain must be activation-permitted');

  const ne = r.non_effects;
  for (const k of ['identity_lookup_performed','profile_constructed','external_disclosure_performed','responsibility_attributed','authority_expanded','actuator_invoked','kontur_mutated']) {
    assert(ne[k] === false, `forbidden effect: ${k}`);
  }
  return true;
}

validate(fixture);

const mutations = [
  r => { delete r.purpose; },
  r => { r.purpose.satisfied = false; },
  r => { delete r.authority.evidence_ref; },
  r => { r.authority.satisfied = false; },
  r => { r.identity_need.necessary = false; },
  r => { r.identity_need.reason = ''; },
  r => { r.minimal_challenge.requested_attributes.push('date-of-birth'); },
  r => { r.minimal_challenge.satisfied = false; },
  r => { r.proof_sufficiency.result = 'insufficient'; },
  r => { r.proof_sufficiency.evidence_refs = []; },
  r => { r.scope.fields = []; },
  r => { r.correlation.requested = true; r.correlation.authorized = false; r.correlation.contexts = ['access-check']; },
  r => { r.correlation.requested = true; r.correlation.authorized = true; r.correlation.contexts = ['other-context']; },
  r => { r.disclosure.fields.push('full_profile'); },
  r => { r.disclosure.audience.push('unbounded-third-party'); },
  r => { r.disclosure.performed = true; },
  r => { r.non_effects.profile_constructed = true; },
  r => { r.non_effects.responsibility_attributed = true; },
  r => { r.non_effects.authority_expanded = true; },
  r => { r.non_effects.kontur_mutated = true; }
];

for (let i = 0; i < mutations.length; i++) {
  const candidate = structuredClone(fixture);
  mutations[i](candidate);
  let rejected = false;
  try { validate(candidate); } catch (_) { rejected = true; }
  assert(rejected, `negative mutation ${i + 1} was accepted`);
}

console.log(`Latent Evidentiary Knowledge v0.1: PASS (${mutations.length} negative mutations rejected)`);
