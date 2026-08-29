'use strict';
const fs=require('node:fs');const path=require('node:path');
const c=JSON.parse(fs.readFileSync(path.join(__dirname,'checkpoint.json'),'utf8'));
const falseKeys=['release_authorized','tag_authorized','publication_authorized','runtime_activation_authorized','action_permit_created','canonicality_created','certification_created','legal_status_created'];
function validate(x){
 if(x.checkpoint_version!=='0.3') throw Error('version');
 if(!/^[0-9a-f]{40}$/.test(x.origin_frontier)) throw Error('frontier');
 if(x.predecessor_checkpoint!=='tooling/release-candidate-checkpoint/v0.2') throw Error('predecessor');
 const required=['stable-core-tooling','security-evidence-closure','perceived-causal-liveness','dlc-si','personal-evidence-fabric','circumstantial-provenance','backlog-roadmap-reconciliation','kontur-parallel-successor','public-review','pilot-002-external-input'];
 const ids=x.evidence.map(e=>e.id);if(new Set(ids).size!==ids.length)throw Error('duplicate evidence');for(const id of required)if(!ids.includes(id))throw Error(`missing ${id}`);
 if(x.engineering_convergence!=='PASS')throw Error('engineering');
 if(x.governance_state!=='REVIEW_PENDING')throw Error('governance must remain pending');
 if(x.external_evidence_state!=='WAITING_EXTERNAL')throw Error('external evidence');
 if(x.decision!=='RELEASE_CANDIDATE_REVIEW_PENDING')throw Error('decision');
 for(const k of falseKeys)if(x.non_effects?.[k]!==false)throw Error(`forbidden effect ${k}`);
 const review=x.evidence.find(e=>e.id==='public-review');const p2=x.evidence.find(e=>e.id==='pilot-002-external-input');if(review.state!=='WAITING_EXTERNAL'||p2.state!=='WAITING_EXTERNAL')throw Error('external gates cannot be promoted');
 if(x.evidence.find(e=>e.id==='security-evidence-closure').state!=='EVIDENCE_CLOSED')throw Error('security overclaim');
 if(x.evidence.find(e=>e.id==='kontur-parallel-successor').state!=='PARALLEL_NON_CORE')throw Error('KONTUR core promotion');
 return true;
}
function clone(x){return JSON.parse(JSON.stringify(x));}function mustFail(m,label){const x=clone(c);m(x);let f=false;try{validate(x)}catch{f=true}if(!f)throw Error(`unsafe mutation accepted: ${label}`)}
validate(c);mustFail(x=>x.decision='READY','premature ready');mustFail(x=>x.governance_state='PASS','governance overclaim');mustFail(x=>x.evidence.find(e=>e.id==='public-review').state='PASS','external review invented');mustFail(x=>x.evidence.find(e=>e.id==='security-evidence-closure').state='PASS','security certification invented');mustFail(x=>x.evidence.find(e=>e.id==='kontur-parallel-successor').state='CORE','pilot promoted to core');mustFail(x=>x.non_effects.release_authorized=true,'release authority');mustFail(x=>x.non_effects.runtime_activation_authorized=true,'runtime authority');console.log('RELEASE_CANDIDATE_CHECKPOINT_V0_3_PASS');
