const fs=require('fs');
const p='protocols/integration/event-hash-minimalism/v0.1/fixture.json';
const x=JSON.parse(fs.readFileSync(p,'utf8'));
function ok(v,m){if(!v)throw new Error(m)}
function validate(a){
  ok(a.protocol==='UU-AAP-EVENT-HASH-MINIMALISM','protocol');
  ok(a.version==='0.1','version');
  ok(typeof a.event_id==='string'&&a.event_id.length>0,'event_id');
  ok(typeof a.canonicalization_profile==='string'&&a.canonicalization_profile.length>0,'canonicalization_profile');
  ok(['sha256','sha512','blake3'].includes(a.hash_algorithm),'hash_algorithm');
  ok(typeof a.event_hash==='string'&&/^[A-Fa-f0-9]{64,128}$/.test(a.event_hash),'event_hash');
  ok(['absent','local','distributed','selective','temporary'].includes(a.payload_retention),'payload_retention');
  if(a.payload_retention==='absent') ok(a.payload_ref===null,'absent payload must not have payload_ref');
  ok(Array.isArray(a.evidence_refs),'evidence_refs');
  const pl=a.provenance_links||{};
  for(const k of ['witness_receipts','circumstantial_provenance_refs','merkle_inclusion_proofs','successor_state_links']) ok(Array.isArray(pl[k]),`provenance_links.${k}`);
  const c=a.claims||{};
  for(const k of ['full_action_trace_stored','payload_required_for_commitment','hash_is_payload','semantic_content_proven','intent_proven','authorship_proven','identity_proven','attribution_proven','authority_proven','responsibility_proven','causality_proven','liability_proven','truth_proven','execution_proven','complete_history_proven','inspection_right_created']) ok(c[k]===false,`forbidden claim: ${k}`);
  const n=a.non_effects||{};
  for(const k of ['telemetry_collected','external_lookup_performed','payload_acquired','actuator_invoked','kontur_mutated','authority_expanded','publication_created']) ok(n[k]===false,`forbidden effect: ${k}`);
}
validate(x);
const mutations=[
  a=>a.claims.full_action_trace_stored=true,
  a=>a.claims.payload_required_for_commitment=true,
  a=>a.claims.hash_is_payload=true,
  a=>a.claims.semantic_content_proven=true,
  a=>a.claims.intent_proven=true,
  a=>a.claims.authorship_proven=true,
  a=>a.claims.identity_proven=true,
  a=>a.claims.attribution_proven=true,
  a=>a.claims.authority_proven=true,
  a=>a.claims.responsibility_proven=true,
  a=>a.claims.causality_proven=true,
  a=>a.claims.liability_proven=true,
  a=>a.claims.truth_proven=true,
  a=>a.claims.execution_proven=true,
  a=>a.claims.complete_history_proven=true,
  a=>a.claims.inspection_right_created=true,
  a=>a.non_effects.telemetry_collected=true,
  a=>a.non_effects.external_lookup_performed=true,
  a=>a.non_effects.actuator_invoked=true,
  a=>{a.payload_retention='absent';a.payload_ref='urn:payload:secret';}
];
for(const mutate of mutations){
  const a=structuredClone(x); mutate(a); let rejected=false;
  try{validate(a)}catch{rejected=true}
  ok(rejected,'negative mutation accepted');
}
console.log(`Event-Hash Minimalism valid; ${mutations.length} negative mutations rejected`);