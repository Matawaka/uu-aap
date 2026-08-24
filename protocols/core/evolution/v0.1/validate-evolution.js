'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const F=JSON.parse(fs.readFileSync(path.join(__dirname,'conformance.fixture.json'),'utf8'));
const CLASSES=new Set(['fully_compatible','adapter_compatible','semantically_compatible_syntax_breaking','breaking','historical_only']);
const MODES=new Set(['direct','explicit_adapter','reobserve_rebind','historical_only']);
const TRANSLATION_MODES=new Set(['semantic_preservation','reobserve_rebind','historical_only']);
const MAJOR_SCOPES=new Set(['failure_semantics','authority_responsibility_semantics','layer_topology']);
const NON=['intent_created','intent_inferred','authority_created','authority_expanded','responsibility_accepted','coordination_completed','action_permit_created','action_performed','frontier_refreshed','causality_proven','truth_certified','liability_established','universal_canonicality_established'];
const CONFORMANCE=['positive_fixture_required','negative_fixture_required','cross_version_compatibility_vectors_required','action_gate_bypass_vectors_required','historical_non_reinterpretation_vectors_required'];
const INDEPENDENCE=['external_contour_required','runtime_vendor_required','kontur_required'];
function bad(m){throw Error(m)}
function obj(v,n){if(!v||typeof v!=='object'||Array.isArray(v))bad(`${n} must be object`)}
function sortKeys(v){if(Array.isArray(v))return v.map(sortKeys);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=sortKeys(v[k]);return o}return v}
function hash(x){const y=JSON.parse(JSON.stringify(x));delete y.content_hash;return crypto.createHash('sha256').update(JSON.stringify(sortKeys(y))).digest('hex')}
function validateManifest(m){
  obj(m,'manifest');
  if(m.protocol!=='UU-AAP-STACK-EVOLUTION'||m.version!=='0.1'||m.artifact_type!=='SuccessorManifest')bad('invalid manifest envelope');
  obj(m.predecessor,'predecessor');obj(m.successor,'successor');obj(m.migration,'migration');obj(m.conformance,'conformance');obj(m.independence,'independence');
  if(m.predecessor.protocol!=='UU-AAP-CORE'||m.predecessor.version!=='0.1')bad('unexpected predecessor');
  if(m.predecessor.canonical_commit!=='36efd19e443d63a26668c1d48d9acd551d95df6e')bad('predecessor commit mismatch');
  if(m.predecessor.compatibility_surface!=='protocols/core/v0.1')bad('compatibility surface mismatch');
  if(!CLASSES.has(m.compatibility_class))bad('unknown compatibility class');
  if(!Array.isArray(m.change_scope)||!m.change_scope.length||new Set(m.change_scope).size!==m.change_scope.length)bad('change_scope invalid');
  if(!Array.isArray(m.preserved_invariants)||!m.preserved_invariants.includes('action_gate_required')||!m.preserved_invariants.includes('historical_receipt_meaning_preserved'))bad('required invariant not preserved');
  if(!MODES.has(m.migration.mode))bad('unknown migration mode');
  if(m.migration.refreshes_frontier!==false||m.migration.reinterprets_historical_receipts!==false||m.migration.requires_reobservation_for_freshness!==true)bad('unsafe migration semantics');
  if(m.compatibility_class==='fully_compatible'&&m.migration.mode!=='direct')bad('fully compatible requires direct mode');
  if((m.compatibility_class==='adapter_compatible'||m.compatibility_class==='semantically_compatible_syntax_breaking')&&m.migration.mode!=='explicit_adapter')bad('adapter class requires explicit adapter');
  if(m.compatibility_class==='historical_only'&&m.migration.mode!=='historical_only')bad('historical-only class mismatch');
  if(m.compatibility_class==='breaking'&&m.major_version_required!==true)bad('breaking change requires major version');
  if(m.change_scope.some(x=>MAJOR_SCOPES.has(x))&&m.major_version_required!==true)bad('major change scope requires major version');
  if(!Array.isArray(m.deprecations))bad('deprecations must be array');
  for(const x of m.deprecations){obj(x,'deprecation');if(x.historical_meaning_preserved!==true||!x.identifier||!x.successor_or_reason)bad('unsafe deprecation')}
  for(const n of CONFORMANCE)if(m.conformance[n]!==true)bad(`conformance obligation must be true: ${n}`);
  for(const n of INDEPENDENCE)if(m.independence[n]!==false)bad(`hidden dependency forbidden: ${n}`);
  if(hash(m)!==m.content_hash)bad('manifest content_hash mismatch');
  return true;
}
function validateReceipt(r,m){
  obj(r,'compatibility receipt');
  if(r.protocol!=='UU-AAP-COMPAT'||r.version!=='0.1'||r.receipt_type!=='CompatibilityReceipt')bad('invalid receipt envelope');
  if(r.manifest_hash!==m.content_hash)bad('manifest binding mismatch');
  obj(r.source,'source');obj(r.target,'target');obj(r.frontier,'frontier');obj(r.assertions,'assertions');obj(r.non_effects,'non_effects');
  if(r.source.protocol!==m.predecessor.protocol||r.source.version!==m.predecessor.version)bad('source version mismatch');
  if(r.target.protocol!==m.successor.protocol||r.target.version!==m.successor.version)bad('target version mismatch');
  if(r.compatibility_class!==m.compatibility_class)bad('compatibility class mismatch');
  if(!TRANSLATION_MODES.has(r.translation_mode))bad('unknown translation mode');
  if(m.migration.mode==='explicit_adapter'&&r.assertions.explicit_adapter!==true)bad('explicit adapter required');
  if(m.migration.mode==='direct'&&r.assertions.explicit_adapter===true)bad('direct mode must not pretend adapter');
  if(r.translation_mode==='semantic_preservation'&&r.frontier.reobserved!==false)bad('translation cannot claim reobservation');
  if(r.frontier.source_revision!==r.source.frontier)bad('source frontier mismatch');
  if(r.frontier.reobserved===false&&r.frontier.effective_revision!==r.frontier.source_revision)bad('translation refreshed frontier');
  if(r.assertions.historical_meaning_preserved!==true||r.assertions.target_semantics_not_stronger!==true||r.assertions.action_gate_still_required!==true||r.assertions.freshness_not_upgraded!==true)bad('semantic preservation assertion missing');
  for(const n of NON)if(r.non_effects[n]!==false)bad(`non_effect must be false: ${n}`);
  if(Object.keys(r.non_effects).some(n=>!NON.includes(n)))bad('unknown non_effect');
  if(hash(r)!==r.content_hash)bad('receipt content_hash mismatch');
  return true;
}
function mutate(x,fn){const y=JSON.parse(JSON.stringify(x));fn(y);y.content_hash=hash(y);return y}
function reject(n,fn){try{fn()}catch{return}bad(`negative accepted: ${n}`)}
validateManifest(F.manifest);validateReceipt(F.compatibility_receipt,F.manifest);
const M=F.manifest,R=F.compatibility_receipt;
reject('unknown compatibility class',()=>validateManifest(mutate(M,x=>x.compatibility_class='magic')));
reject('adapter without explicit mode',()=>validateManifest(mutate(M,x=>x.migration.mode='direct')));
reject('direct receipt under adapter manifest',()=>validateReceipt(mutate(R,x=>x.assertions.explicit_adapter=false),M));
reject('frontier refresh',()=>validateReceipt(mutate(R,x=>x.frontier.effective_revision='sha256:new-frontier'),M));
reject('intent creation',()=>validateReceipt(mutate(R,x=>x.non_effects.intent_created=true),M));
reject('authority creation',()=>validateReceipt(mutate(R,x=>x.non_effects.authority_created=true),M));
reject('action permit creation',()=>validateReceipt(mutate(R,x=>x.non_effects.action_permit_created=true),M));
reject('semantic strengthening',()=>validateReceipt(mutate(R,x=>x.assertions.target_semantics_not_stronger=false),M));
reject('historical rewrite',()=>validateReceipt(mutate(R,x=>x.assertions.historical_meaning_preserved=false),M));
reject('action gate removed',()=>validateReceipt(mutate(R,x=>x.assertions.action_gate_still_required=false),M));
reject('breaking without major',()=>validateManifest(mutate(M,x=>{x.compatibility_class='breaking';x.migration.mode='explicit_adapter';x.major_version_required=false})));
reject('unsafe deprecation',()=>validateManifest(mutate(M,x=>x.deprecations=[{identifier:'IntentReceipt',historical_meaning_preserved:false,successor_or_reason:'replacement'}])));
reject('wrong manifest binding',()=>validateReceipt(mutate(R,x=>x.manifest_hash='f'.repeat(64)),M));
reject('target mismatch',()=>validateReceipt(mutate(R,x=>x.target.version='9.9'),M));
reject('positive fixture not required',()=>validateManifest(mutate(M,x=>x.conformance.positive_fixture_required=false)));
reject('negative fixture not required',()=>validateManifest(mutate(M,x=>x.conformance.negative_fixture_required=false)));
reject('missing historical non-reinterpretation vectors',()=>validateManifest(mutate(M,x=>x.conformance.historical_non_reinterpretation_vectors_required=false)));
reject('external contour dependency',()=>validateManifest(mutate(M,x=>x.independence.external_contour_required=true)));
reject('vendor dependency',()=>validateManifest(mutate(M,x=>x.independence.runtime_vendor_required=true)));
reject('kontur dependency',()=>validateManifest(mutate(M,x=>x.independence.kontur_required=true)));
reject('unknown translation mode',()=>validateReceipt(mutate(R,x=>x.translation_mode='silent_upgrade'),M));
reject('missing non-effect',()=>validateReceipt(mutate(R,x=>delete x.non_effects.intent_created),M));
console.log('UU_AAP_STACK_EVOLUTION_COMPATIBILITY_V0_1_PASS');
module.exports={validateManifest,validateReceipt,hash};