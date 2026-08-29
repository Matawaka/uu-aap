'use strict';
const fs=require('node:fs');const path=require('node:path');
const x=JSON.parse(fs.readFileSync(path.join(__dirname,'ru-en-parity-corpus.json'),'utf8'));
if(x.normative_language!=='EN')throw Error('English normative source must remain explicit');
if(x.repository_wide_parity_claimed!==false)throw Error('repository-wide parity overclaim');
if(!Array.isArray(x.pairs)||x.pairs.length<4)throw Error('bounded paired corpus required');
const ids=new Set();
for(const p of x.pairs){if(ids.has(p.pair_id))throw Error('duplicate pair');ids.add(p.pair_id);if(!p.en||!p.ru)throw Error('paired paths required');if(!p.ru_role.startsWith('EXPLANATORY_'))throw Error('RU role must remain explanatory');if(!Array.isArray(p.semantic_checks)||p.semantic_checks.length===0)throw Error('semantic checks required');if(!Array.isArray(p.navigation_checks))throw Error('navigation checks required');}
if(x.semantic_result!=='PASS_BOUNDED_PAIRED_CORPUS'||x.navigation_result!=='PASS_BOUNDED_PAIRED_CORPUS')throw Error('bounded parity result required');
for(const [k,v] of Object.entries(x.non_effects))if(v!==false)throw Error(`non-effect escalated: ${k}`);
if(!x.limitations.some(v=>v.includes('Repository-wide')))throw Error('repository-wide limitation required');
console.log('RU/EN bounded parity evidence: ok');
