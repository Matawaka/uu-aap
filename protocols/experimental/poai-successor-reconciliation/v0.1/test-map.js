'use strict';
const assert=require('node:assert/strict');
const m=require('./legacy-successor-map.json');
const allowed=new Set(['PRESERVED','REUSED','SUPERSEDED_BY','NEEDS_SUCCESSOR','OUT_OF_SCOPE']);
assert.equal(m.type,'LegacyPoAISuccessorMap');
assert.equal(m.entries.length,13);
for(const e of m.entries){
  assert.equal(allowed.has(e.relation),true,`${e.family}: invalid relation`);
  assert.equal(Array.isArray(e.legacy_issues)&&e.legacy_issues.length>0,true,`${e.family}: legacy issues required`);
  assert.equal(typeof e.legacy_invariant,'string');
  assert.equal(Array.isArray(e.current_refs),true);
  assert.equal(typeof e.note,'string');
}
const byFamily=new Map(m.entries.map(e=>[e.family,e]));
for(const f of ['PERSISTENT_KEY_CONTINUITY','IDENTITY_EVIDENCE','SCOPED_AUTHORITY_EVIDENCE','MATERIALIZATION_AND_POLICY_RELATIVE_CANONICALITY']) assert.equal(byFamily.get(f).relation,'NEEDS_SUCCESSOR');
assert.equal(byFamily.get('OBSERVED_OUTCOME').relation,'REUSED');
assert.equal(byFamily.get('DETERMINISTIC_BINDING_AND_SIGNATURE').relation,'SUPERSEDED_BY');
for(const [k,v] of Object.entries(m.non_effects)) assert.equal(v,false,`${k} must remain false`);
console.log('Legacy PoAI successor map v0.1: ok');
