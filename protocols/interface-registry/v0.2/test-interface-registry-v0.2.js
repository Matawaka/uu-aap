'use strict';
const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict');
const V=require('./validate-interface-registry-v0.2.js');
const root=path.resolve(__dirname,'../../..');
const base=JSON.parse(fs.readFileSync(path.join(root,'protocols/interface-registry/v0.1/interface-registry.json'),'utf8'));
const delta=JSON.parse(fs.readFileSync(path.join(__dirname,'interface-registry-delta.json'),'utf8'));
V.validateDelta(delta,base,{checkPaths:true});
function reject(name,mutate,pattern){const x=structuredClone(delta);mutate(x);let err=null;try{V.validateDelta(x,base,{checkPaths:false});}catch(e){err=e;}assert.ok(err,`${name}: expected rejection`);if(pattern)assert.match(err.message,pattern);}
reject('base blob drift',x=>x.base_registry.blob='0'.repeat(40),/base registry binding/);
reject('duplicate addition',x=>x.additions[1].id=x.additions[0].id,/duplicate effective interface id/);
reject('candidate dependency loss',x=>x.additions[2].dependencies=['EventResponsiveDormancy'],/typed interface contract drift/);
reject('unresolved dependency',x=>x.additions[2].dependencies=['EventResponsiveDormancy','Missing'],/typed interface contract drift|unresolved dependency/);
reject('ERD auto transition',x=>x.additions[0].next_interfaces_are_automatic=true,/typed interface contract drift/);
reject('candidate stable promotion',x=>x.additions[2].status='stable',/typed interface contract drift/);
reject('candidate path substitution',x=>x.additions[2].path='protocols/core/v0.1',/typed interface contract drift/);
reject('performance nonclaim removed',x=>x.non_claims=x.non_claims.filter(v=>v!=='performance_gain_proven'),/missing non-claim/);
reject('exploratory promotion nonclaim removed',x=>x.non_claims=x.non_claims.filter(v=>v!=='exploratory_lane_promoted'),/missing non-claim/);
reject('extra interface',x=>x.additions.push(structuredClone(x.additions[0])),/exactly three additions/);
console.log('REUSABLE_INTERFACE_REGISTRY_V0_2_HOSTILE_PASS');
