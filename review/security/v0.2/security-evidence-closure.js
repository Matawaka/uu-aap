'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');

function git(args){return cp.execFileSync('git',args,{encoding:'utf8'}).trim();}
function files(){return git(['ls-files']).split('\n').filter(Boolean);}
function read(p){return fs.readFileSync(p,'utf8');}
function trackedText(paths){return paths.filter(p=>{try{return fs.statSync(p).isFile() && fs.statSync(p).size<2_000_000;}catch{return false;}});}

function assess(){
  const revision=git(['rev-parse','HEAD']);
  const all=files();
  const text=trackedText(all);
  const workflow=all.filter(p=>p.startsWith('.github/workflows/') && /\.ya?ml$/.test(p));
  const deploy=all.filter(p=>/(dockerfile|compose\.ya?ml|helm|k8s|kubernetes|terraform|deploy|pages|cloudflare|vercel|netlify)/i.test(p));
  const actionRefs=[];
  for(const p of workflow){for(const m of read(p).matchAll(/uses:\s*([^\s#]+)/g)) actionRefs.push({path:p,ref:m[1]});}
  const mutableActions=actionRefs.filter(x=>x.ref.includes('@')&&!/@[0-9a-f]{40}$/i.test(x.ref));
  const secretPatterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/ghp_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{30,}/,/AKIA[0-9A-Z]{16}/];
  const secretHits=[];
  for(const p of text){const s=read(p);if(secretPatterns.some(r=>r.test(s))) secretHits.push(p);}
  const adversarial=all.filter(p=>/(adversarial|negative|mutation|attack|fail-closed)/i.test(p));
  const dependencyPath='review/security/dependency-vulnerability/v0.2/README.md';
  const dependencyPresent=all.includes(dependencyPath);

  const dimensions={
    dependency_vulnerability_assessment:{status:dependencyPresent?'INSUFFICIENT_EVIDENCE':'INSUFFICIENT_EVIDENCE',evidence:[dependencyPath],reason:'assessment_v0.2_present_runtime_applicability_not_universally_proven'},
    secret_exposure_assessment:{status:secretHits.length?'FAIL':'INSUFFICIENT_EVIDENCE',evidence:{tracked_files_scanned:text.length,pattern_hits:secretHits},reason:secretHits.length?'credential_like_material_detected':'tracked_current_tree_scan_cannot_prove_history_external_secrets_or_prior_exposure_absent'},
    deployment_surface_assessment:{status:'INSUFFICIENT_EVIDENCE',evidence:{repository_candidates:deploy},reason:'repository_surface_cannot_establish_complete_external_deployment_inventory'},
    workflow_supply_chain_assessment:{status:mutableActions.length?'FAIL':'INSUFFICIENT_EVIDENCE',evidence:{action_reference_count:actionRefs.length,mutable_action_refs:mutableActions},reason:mutableActions.length?'mutable_github_action_references_observed':'absence_of_mutable_refs_would_not_prove_complete_supply_chain'},
    adversarial_surface_assessment:{status:'INSUFFICIENT_EVIDENCE',evidence:{adversarial_candidate_paths:adversarial.slice(0,200),candidate_count:adversarial.length},reason:'repository_adversarial_coverage_is_observed_but_not_universal_surface_proof'}
  };
  const vals=Object.values(dimensions).map(x=>x.status);
  const outcome=vals.includes('FAIL')?'FAIL':vals.every(x=>x==='PASS')?'PASS':'INSUFFICIENT_EVIDENCE';
  return {artifact_type:'UU-AAP-Security-Evidence-Closure',version:'0.2',reviewed_revision:revision,dimensions,outcome,closure_complete:true,security_certified:false,release_authorized:false,remediation_authorized:false,non_effects:['no secret rotation','no dependency remediation','no deployment mutation','no workflow permission mutation','no release or runtime activation']};
}
if(require.main===module) process.stdout.write(JSON.stringify(assess(),null,2)+'\n');
module.exports={assess};
