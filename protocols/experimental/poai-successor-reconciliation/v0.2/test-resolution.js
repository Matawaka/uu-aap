'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=require('../v0.1/legacy-successor-map.json');
const resolution=require('./resolution.json');

assert.equal(resolution.type,'LegacyPoAISuccessorResolution');
assert.equal(resolution.version,'0.2');
assert.equal(resolution.source_map.version,'0.1');
assert.equal(resolution.source_map.blob_sha,'7a8f27f6d5edd4a5d1bd14c52de586e0e0161947');
assert.equal(resolution.resolution_frontier,'9c382c3da350d1a27c766116490c9acde6f2a12f');

const needs=source.entries.filter(e=>e.relation==='NEEDS_SUCCESSOR').map(e=>e.family).sort();
const resolved=resolution.resolved_entries.map(e=>e.family).sort();
assert.deepEqual(resolved,needs,'resolution must cover exactly the v0.1 NEEDS_SUCCESSOR families');
assert.equal(new Set(resolved).size,resolved.length,'duplicate resolved family');
assert.deepEqual(resolution.unresolved_successor_families,[]);

for(const e of resolution.resolved_entries){
  assert.equal(e.prior_relation,'NEEDS_SUCCESSOR',`${e.family}: prior relation`);
  assert.ok(['SUPERSEDED_BY','REUSED'].includes(e.resolved_relation),`${e.family}: resolved relation`);
  assert.ok(Array.isArray(e.current_refs)&&e.current_refs.length>0,`${e.family}: current refs required`);
  assert.ok(Array.isArray(e.evidence_refs)&&e.evidence_refs.length>0,`${e.family}: evidence refs required`);
  assert.equal(typeof e.note,'string');
  for(const ref of e.current_refs){
    const absolute=path.resolve(process.cwd(),ref);
    assert.equal(fs.existsSync(absolute),true,`${e.family}: missing current ref ${ref}`);
  }
}

for(const [k,v] of Object.entries(resolution.non_effects)) assert.equal(v,false,`${k} must remain false`);

assert.equal(source.entries.find(e=>e.family==='PERSISTENT_KEY_CONTINUITY').relation,'NEEDS_SUCCESSOR','v0.1 source map must remain unchanged');
assert.equal(source.entries.find(e=>e.family==='MATERIALIZATION_AND_POLICY_RELATIVE_CANONICALITY').relation,'NEEDS_SUCCESSOR','v0.1 source map must remain unchanged');

console.log('Legacy PoAI successor resolution v0.2: ok');
