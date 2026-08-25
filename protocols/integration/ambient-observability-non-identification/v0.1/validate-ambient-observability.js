const fs=require('fs');
const path='protocols/integration/ambient-observability-non-identification/v0.1/conformance.fixture.json';
const a=JSON.parse(fs.readFileSync(path,'utf8'));
function ok(v,m){if(!v)throw new Error(m)}
function validate(x){
  ok(x.protocol==='UU-AAP-AMBIENT-OBSERVABILITY-NON-IDENTIFICATION','protocol');
  ok(x.version==='0.1','version');
  ok(typeof x.observation_id==='string'&&x.observation_id,'observation_id');
  ok(['human','living_observer','sensor','network_device','system_log','mixed'].includes(x.source_class),'source_class');
  ok(x.scope&&x.scope.subject_resolution_requested===false,'identity request forbidden');
  ok(x.scope.cross_context_requested===false,'cross-context request forbidden');
  ok(Date.parse(x.observed_at)<=Date.parse(x.retention_until),'retention horizon');
  ok(x.activation_basis_ref===null||typeof x.activation_basis_ref==='string','activation basis');
  ok(x.claims.observation_recorded===true,'observation claim');
  for(const k of ['identity_resolved','correlation_performed','profile_created','attribution_performed','intent_inferred','liability_inferred','responsibility_assigned','sanction_recommended','disclosure_performed','authority_created']) ok(x.claims[k]===false,k);
  for(const k of ['external_observation_performed','external_lookup_performed','actuator_invoked','kontur_mutated','publication_created']) ok(x.non_effects[k]===false,k);
}
validate(a);
const mutations=[
 x=>x.scope.subject_resolution_requested=true,
 x=>x.scope.cross_context_requested=true,
 x=>x.claims.identity_resolved=true,
 x=>x.claims.correlation_performed=true,
 x=>x.claims.profile_created=true,
 x=>x.claims.attribution_performed=true,
 x=>x.claims.intent_inferred=true,
 x=>x.claims.liability_inferred=true,
 x=>x.claims.responsibility_assigned=true,
 x=>x.claims.sanction_recommended=true,
 x=>x.claims.disclosure_performed=true,
 x=>x.claims.authority_created=true,
 x=>x.retention_until='2026-08-24T03:05:00Z',
 x=>x.non_effects.external_lookup_performed=true,
 x=>x.non_effects.kontur_mutated=true
];
for(const mutate of mutations){const x=structuredClone(a);mutate(x);let rejected=false;try{validate(x)}catch{rejected=true}ok(rejected,'negative mutation accepted')}
console.log(`Ambient Observability boundary valid; ${mutations.length} negative mutations rejected`);
