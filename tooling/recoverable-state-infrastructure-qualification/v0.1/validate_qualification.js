'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const HERE=__dirname;
const ROOT=path.resolve(HERE,'../../..');
const QUAL_PATH=path.join(HERE,'qualification.json');
const ORIGIN='e87ee38b5a92fc849195d4602c34cd93adc18804';
const COMPONENTS={
  event_responsive_dormancy:{merge_frontier:'0039375897f2de683afac62e902335f53a1a7d98',module_path:'protocols/integration/event-responsive-dormancy/v0.1/event-responsive-dormancy.js',module_blob:'2cadbd2f405391f4f97e100d77245757ce6b5a58',implementation_receipt_path:'protocols/integration/event-responsive-dormancy/v0.1/implementation-receipt.json',implementation_receipt_blob:'e127d784a74f0713fe0b157845ec5a2754647034'},
  rerc:{merge_frontier:'ef4c8c6030ef517f2997fb76cff4f584fb25c691',module_path:'protocols/integration/rerc/v0.1/rerc.js',module_blob:'d2aae21a2e2375477c6349eae5f236ea60cd7151',implementation_receipt_path:'protocols/integration/rerc/v0.1/implementation-receipt.json',implementation_receipt_blob:'83609468622f4a79783b9b29e73a661497bad849'},
  recoverable_state_infrastructure_candidate:{merge_frontier:'e87ee38b5a92fc849195d4602c34cd93adc18804',implementation_receipt_path:'protocols/reusable-infrastructure/recoverable-state/v0.1/implementation-receipt.json',implementation_receipt_blob:'5d7be899687900fe6757063bed7cb67cb5c71fa9'}
};
const CASES=[
{id:'Q1_C2PA_SDK_SUCCESSOR',role:'POSITIVE_INDEPENDENT_DEMAND',consumer_family:'C2PA_SDK_PRESERVATION',source:{path:'scripts/c2pa-sdk-successor-reaudit/README.md',blob:'bb2681c1882e6788432da58a2d3d7cceebe3129c',merged_pr:791},evidence_summary:'Upstream frontier changes request a separately reviewed executable successor audit; Swift change rules rerun a dormant external SwiftPM round-trip harness without inferring PASS or rewriting history.',erd_fit:'ADAPTER_FIT',rerc_fit:'NOT_NEEDED',composition_fit:'NOT_NEEDED',recommended_dependency:'ERD_ONLY'},
{id:'Q2_CIRCUMSTANTIAL_PROVENANCE',role:'POSITIVE_INDEPENDENT_DEMAND',consumer_family:'CIRCUMSTANTIAL_PROVENANCE',source:{path:'protocols/integration/circumstantial-provenance/v0.1/README.md',blob:'6937c35599d79a7562a055d834fb27f27f2f8ab7',merged_pr:721},evidence_summary:'Categorical independence groups distinguish derived copies from independent support while contradictions and lineage gaps remain visible; a bounded RERC adapter could reduce only declared derived/representational copies while preserving exact source evidence.',erd_fit:'NOT_NEEDED',rerc_fit:'ADAPTER_FIT',composition_fit:'NOT_NEEDED',recommended_dependency:'RERC_ONLY'},
{id:'Q3_P1_11_INTEGRITY_REDUNDANCY',role:'NEGATIVE_CONTROL',consumer_family:'VERIFIER_DISPOSITION_INTEGRITY',source:{path:'scripts/verifier-disposition-integrity/source-bindings.json',blob:'8c8e2059eafda6767a983c3bd11c5824e74529ce',merged_pr:821},evidence_summary:'Redundant receipt representations are jointly bound by canonical rematerialization to close an integrity gap; qualification maps this redundancy to protective/non-suppressible use.',erd_fit:'NOT_NEEDED',rerc_fit:'NOT_APPLICABLE_PROTECTIVE',composition_fit:'NOT_NEEDED',recommended_dependency:'NONE'},
{id:'Q4_P1_9_PLURAL_CANDIDATES',role:'NEGATIVE_CONTROL',consumer_family:'VERIFIER_CANDIDATE_FEDERATION',source:{path:'scripts/verifier-candidate-federation/app.js',blob:'b4ea0cfc6e78c88457101130e806349492e6ce8a',merged_pr:817},evidence_summary:'Same-dimension plurality is preserved without acceptance, ranking, merging, scoring or consensus; competing candidates are not equivalent redundancy.',erd_fit:'NOT_NEEDED',rerc_fit:'NOT_APPLICABLE_NON_EQUIVALENT',composition_fit:'NOT_NEEDED',recommended_dependency:'NONE'},
{id:'Q5_PUBLIC_REVIEW_EVENT_SUFFICIENCY',role:'NEGATIVE_CONTROL',consumer_family:'PUBLIC_REVIEW_REPOSITORY_DISCOVERY',source:{path:'tooling/public-review-repository-discovery/v0.2/README.md',blob:'f2f37a0336369ee18e3ac0a59e4101663a5dae09',merged_pr:864},evidence_summary:'Accepted-main push plus optional manual dispatch already provides a bounded event-triggered read-only observation surface with deliberately no cron/schedule.',erd_fit:'EXISTING_MECHANISM_SUFFICIENT',rerc_fit:'NOT_NEEDED',composition_fit:'NOT_NEEDED',recommended_dependency:'EXISTING_MECHANISM_ONLY'}
];
function fail(m){throw new Error(m);}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function gitBlob(p){const r=cp.spawnSync('git',['rev-parse',`HEAD:${p}`],{cwd:ROOT,encoding:'utf8'});if(r.error)throw r.error;if(r.status!==0)fail(`cannot bind ${p}: ${r.stderr}`);return r.stdout.trim();}
function validateQualification(q,{checkGit=true}={}){
  if(!q||typeof q!=='object'||Array.isArray(q))fail('qualification object required');
  if(q.artifact_type!=='RecoverableStateInfrastructureQualification'||q.version!=='0.1'||q.origin_frontier!==ORIGIN||q.tracking_issue!==883)fail('qualification identity invalid');
  if(q.scope!=='independent reuse demand audit over accepted ERD, RERC and RSIC')fail('scope drift');
  if(!same(q.component_bindings,COMPONENTS))fail('accepted component binding drift');
  if(!Array.isArray(q.cases)||q.cases.length!==CASES.length)fail('exact qualification case set required');
  for(let i=0;i<CASES.length;i++){
    const a=q.cases[i],e=CASES[i];
    for(const [k,v] of Object.entries(e))if(!same(a[k],v))fail(`case drift ${e.id}:${k}`);
    if(a.independent_from_component_origin!==true)fail(`case not independent ${a.id}`);
    if(a.adapter_exists!==false||a.adapter_required!==false||a.consumer_mutation_authorized!==false)fail(`case effect escalation ${a.id}`);
    const allowed=new Set(['id','role','consumer_family','independent_from_component_origin','source','evidence_summary','erd_fit','rerc_fit','composition_fit','recommended_dependency','adapter_exists','adapter_required','consumer_mutation_authorized']);
    for(const k of Object.keys(a))if(!allowed.has(k))fail(`unknown case field ${a.id}:${k}`);
  }
  const positive=q.cases.filter(x=>x.role==='POSITIVE_INDEPENDENT_DEMAND');
  const erdDemand=positive.some(x=>x.erd_fit==='ADAPTER_FIT');
  const rercDemand=positive.some(x=>x.rerc_fit==='ADAPTER_FIT');
  const compositionDemand=positive.some(x=>x.composition_fit==='ADAPTER_FIT'||x.recommended_dependency==='ERD_RERC_COMPOSITION');
  if(!erdDemand||!rercDemand||compositionDemand)fail('derived demand result invalid');
  if(!q.composition_evidence||q.composition_evidence.independent_demand_established!==false||!Array.isArray(q.composition_evidence.qualifying_independent_consumers)||q.composition_evidence.qualifying_independent_consumers.length!==0)fail('composition evidence must remain not established');
  if(typeof q.composition_evidence.qualification_rule!=='string'||!q.composition_evidence.qualification_rule.includes('requirements must not be manufactured for fit'))fail('composition anti-manufacture rule missing');
  const exactOverall={result:'COMPONENT_REUSE_QUALIFIED_COMPOSITION_DEMAND_NOT_ESTABLISHED',erd_independent_demand_established:true,rerc_independent_demand_established:true,composition_independent_demand_established:false,rsic_candidate_invalidated:false,rsic_promotion_authorized:false,stable_core_admission:false,interface_registry_successor_required:false,adapter_implementation_authorized:false,published_release:false,performance_gain_proven:false,resource_savings_proven:false,exploratory_lane_promoted:false};
  if(!same(q.overall||{},exactOverall))fail('overall qualification drift');
  if(checkGit){
    for(const c of Object.values(COMPONENTS)){
      if(c.module_path&&gitBlob(c.module_path)!==c.module_blob)fail(`component module blob drift ${c.module_path}`);
      if(gitBlob(c.implementation_receipt_path)!==c.implementation_receipt_blob)fail(`component receipt blob drift ${c.implementation_receipt_path}`);
    }
    for(const c of CASES)if(gitBlob(c.source.path)!==c.source.blob)fail(`consumer source blob drift ${c.id}`);
  }
  return true;
}
if(require.main===module){const q=JSON.parse(fs.readFileSync(QUAL_PATH,'utf8'));validateQualification(q,{checkGit:true});console.log('RSIC_QUALIFICATION_V0_1_PASS: component demand qualified; composition demand not established; negative controls preserved.');}
module.exports={validateQualification,COMPONENTS,CASES};
