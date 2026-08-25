const fs=require('fs');
const p='protocols/integration/latent-evidentiary-knowledge/v0.1/fixture.json';
const a=JSON.parse(fs.readFileSync(p,'utf8'));
function ok(x,m){if(!x)throw new Error(m)}
const order=['purpose','authority','identity_need','minimal_challenge','proof_sufficiency','scope','disclosure'];
function validate(x){
  ok(x.protocol==='UU-AAP-LATENT-EVIDENTIARY-KNOWLEDGE','protocol');
  ok(x.version==='0.1','version');
  ok(Array.isArray(x.stages)&&x.stages.join(',')===order.join(','),'stage order');
  const b=x.bindings||{};ok(typeof b.purpose_id==='string'&&b.purpose_id,'purpose');
  ok(/^[a-f0-9]{64}$/.test(b.authority_evidence_hash||''),'authority hash');
  ok(typeof b.identity_need_id==='string'&&b.identity_need_id,'identity need');
  ok(typeof b.challenge_id==='string'&&b.challenge_id,'challenge');
  ok(/^[a-f0-9]{64}$/.test(b.proof_set_hash||''),'proof hash');
  ok(typeof b.scope_id==='string'&&b.scope_id,'scope');
  ok(b.disclosure&&b.disclosure.authorized===false,'disclosure authorization must remain false in base profile');
  ok(b.disclosure.performed===false,'disclosure performed');
  ok(Array.isArray(b.disclosure.fields)&&b.disclosure.fields.length===0,'disclosure fields');
  for(const [k,v] of Object.entries(x.assertions||{}))ok(v===true,'assertion '+k);
  ok(Object.keys(x.assertions||{}).length===5,'assertion count');
  for(const [k,v] of Object.entries(x.non_effects||{}))ok(v===false,'non-effect '+k);
  ok(Object.keys(x.non_effects||{}).length===9,'non-effect count');
}
validate(a);
const mutations=[
 x=>x.stages.splice(1,1),
 x=>[x.stages[2],x.stages[3]]=[x.stages[3],x.stages[2]],
 x=>x.assertions.challenge_is_minimal=false,
 x=>x.assertions.proof_is_sufficient_for_identity_need=false,
 x=>x.assertions.scope_within_purpose=false,
 x=>x.assertions.scope_within_authority=false,
 x=>x.assertions.scope_within_identity_need=false,
 x=>x.bindings.disclosure.authorized=true,
 x=>x.bindings.disclosure.performed=true,
 x=>x.bindings.disclosure.fields=['identity.full'],
 x=>x.non_effects.active_personalized_knowledge=true,
 x=>x.non_effects.identification_performed=true,
 x=>x.non_effects.cross_context_correlation=true,
 x=>x.non_effects.profiling=true,
 x=>x.non_effects.attribution=true,
 x=>x.non_effects.intent_inferred=true,
 x=>x.non_effects.liability_inferred=true,
 x=>x.non_effects.responsibility_assigned=true,
 x=>x.non_effects.external_effect=true
];
for(const m of mutations){const x=structuredClone(a);m(x);let rejected=false;try{validate(x)}catch{rejected=true}ok(rejected,'negative mutation accepted')}
console.log(`Latent Evidentiary Knowledge gate valid; ${mutations.length} negative mutations rejected; no identification, correlation, attribution, disclosure or external effect performed.`);