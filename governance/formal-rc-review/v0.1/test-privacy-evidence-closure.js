'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const p=path.join(__dirname,'privacy-evidence-closure.json');
const base=JSON.parse(fs.readFileSync(p,'utf8'));
const derive=x=>{
 if(x.claims.payload_minimization_supported!==true)return false;
 if(x.claims.cross_context_correlation_default_denied!==true)return false;
 if(x.claims.behavioral_profile_required!==false||x.claims.psychological_profile_required!==false||x.claims.total_history_required!==false)return false;
 if(Object.values(x.non_effects).some(v=>v!==false))return false;
 return true;
};
assert.equal(derive(base),true);
for(const mutate of [
 x=>x.non_effects.cross_context_correlation_authorized=true,
 x=>x.non_effects.profile_construction_authorized=true,
 x=>x.claims.behavioral_profile_required=true,
 x=>x.claims.total_history_required=true,
 x=>x.non_effects.privacy_certification_created=true,
 x=>x.non_effects.legal_compliance_declared=true
]){const x=structuredClone(base);mutate(x);assert.equal(derive(x),false);}
console.log('privacy closure negative tests: ok');
