'use strict';
const fs=require('node:fs');const path=require('node:path');
const x=JSON.parse(fs.readFileSync(path.join(__dirname,'accessibility-evidence.json'),'utf8'));
for(const k of ['human_readable_entrypoints_present','machine_readable_evidence_has_human_explanation','critical_governance_states_are_textual_not_color_only','public_review_surface_identifiable']) if(x.claims[k]!==true) throw Error(`${k} required`);
for(const k of ['external_accessibility_certification_present','wcag_conformance_claimed']) if(x.claims[k]!==false) throw Error(`${k} must remain false`);
for(const [k,v] of Object.entries(x.non_effects)) if(v!==false) throw Error(`non-effect escalated: ${k}`);
if(x.governance_state!=='PASS_BOUNDED_REPOSITORY_EVIDENCE') throw Error('state');
console.log('accessibility governance evidence: ok');
