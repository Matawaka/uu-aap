'use strict';
const fs=require('node:fs'); const path=require('node:path'); const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'../../..');
const DELTA_PATH=path.join(__dirname,'interface-registry-delta.json');
const BASE_PATH='protocols/interface-registry/v0.1/interface-registry.json';
const BASE_BLOB='2aff5e5785eb97796031b19ffe9fe026a3543bf6';
const EXPECTED={
  EventResponsiveDormancy:{
    version:'0.1',status:'experimental',path:'protocols/integration/event-responsive-dormancy/v0.1',
    inputs:['EventResponsiveDormantCapability','EventResponsiveWakeSignal','current evidence/authority/intent checks'],
    outputs:['EventResponsiveDormancyWakeReceipt'],dependencies:[],
    non_effects:['trigger != authorization','wake != old authority restoration','ready != ActionPermit'],
    next_interfaces:['PreActionEvidenceBundle'],provider_neutral:true,external_effect_emission:false,next_interfaces_are_automatic:false
  },
  RERC:{
    version:'0.1',status:'experimental',path:'protocols/integration/rerc/v0.1',
    inputs:['RERCRelationGraph OBSERVED','explicit suppression edge ids'],
    outputs:['RERCRelationGraph OPERATIONAL','RERCSuppressionCompressionReceipt'],dependencies:[],
    non_effects:['suppression != ontological deletion','compression != evidence destruction','simplification != authority'],
    next_interfaces:[],provider_neutral:true,external_effect_emission:false,next_interfaces_are_automatic:false
  },
  RecoverableStateInfrastructureCandidate:{
    version:'0.1',status:'experimental',path:'protocols/reusable-infrastructure/recoverable-state/v0.1',
    inputs:['EventResponsiveDormancy input bundle','RERC compression input bundle','work_context_ref'],
    outputs:['EventResponsiveDormancyWakeReceipt','RERCRelationGraph OPERATIONAL','RERCSuppressionCompressionReceipt','RecoverableStateInfrastructureCompositionReceipt'],
    dependencies:['EventResponsiveDormancy','RERC'],
    non_effects:['formal candidate != Stable Core','composition != shared world identity proof','possible next interface != automatic transition','candidate != performance proof'],
    next_interfaces:['PreActionEvidenceBundle'],provider_neutral:true,external_effect_emission:false,next_interfaces_are_automatic:false
  }
};
const REQUIRED_NON_CLAIMS=['published_release_status','stable_core_membership','automatic_transition_authorized','external_effect_performed','authority_created','performance_gain_proven','resource_savings_proven','exploratory_lane_promoted'];
function fail(m){throw new Error(m);} function read(p){return JSON.parse(fs.readFileSync(p,'utf8'));}
function run(cmd,args){const r=cp.spawnSync(cmd,args,{cwd:ROOT,encoding:'utf8'});if(r.error)throw r.error;if(r.status!==0)fail(`${cmd} ${args.join(' ')} failed\n${r.stdout}\n${r.stderr}`);return (r.stdout||'').trim();}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function validateDelta(delta,base,{checkPaths=true}={}){
  if(delta.artifact_type!=='ReusableProtocolInterfaceRegistryDelta'||delta.version!=='0.2'||delta.release_registry_equivalent!==false) fail('delta identity invalid');
  if(!delta.base_registry||delta.base_registry.path!==BASE_PATH||delta.base_registry.blob!==BASE_BLOB||delta.base_registry.version!=='0.1') fail('base registry binding invalid');
  if(!Array.isArray(delta.additions)||delta.additions.length!==3) fail('exactly three additions required');
  const baseIds=new Set(base.entries.map(e=>e.id)); const addedIds=new Set();
  for(const e of delta.additions){
    if(!e||typeof e!=='object'||Array.isArray(e)) fail('registry addition must be object');
    if(addedIds.has(e.id)||baseIds.has(e.id)) fail(`duplicate effective interface id ${e.id}`); addedIds.add(e.id);
    const expected=EXPECTED[e.id]; if(!expected) fail(`unexpected registry addition ${e.id}`);
    for(const [k,v] of Object.entries(expected)) if(!same(e[k],v)) fail(`typed interface contract drift ${e.id}:${k}`);
    if(checkPaths&&!fs.existsSync(path.join(ROOT,e.path))) fail(`registered path missing ${e.id}`);
  }
  const effectiveIds=new Set([...baseIds,...addedIds]);
  for(const e of delta.additions) for(const d of e.dependencies) if(!effectiveIds.has(d)) fail(`unresolved dependency ${e.id}->${d}`);
  if(delta.effective_entry_count!==base.entries.length+delta.additions.length) fail('effective entry count drift');
  if(!Array.isArray(delta.non_claims)||new Set(delta.non_claims).size!==delta.non_claims.length) fail('non_claims invalid');
  for(const n of REQUIRED_NON_CLAIMS) if(!delta.non_claims.includes(n)) fail(`missing non-claim ${n}`);
  if(delta.non_claims.length!==REQUIRED_NON_CLAIMS.length) fail('unexpected non-claim surface');
  return {artifact_type:'ReusableProtocolInterfaceRegistryEffectiveView',version:'0.2',base_version:'0.1',release_registry_equivalent:false,entries:[...base.entries,...delta.additions],non_claims:[...new Set([...base.non_claims,...delta.non_claims])]};
}
function validateRepository(outputPath){
  run('node',['protocols/interface-registry/v0.1/validate-interface-registry.js']);
  const actual=run('git',['rev-parse',`HEAD:${BASE_PATH}`]); if(actual!==BASE_BLOB) fail('v0.1 registry blob drift');
  const base=read(path.join(ROOT,BASE_PATH)); const delta=read(DELTA_PATH); const effective=validateDelta(delta,base,{checkPaths:true});
  if(outputPath) fs.writeFileSync(outputPath,JSON.stringify(effective,null,2)+'\n');
  console.log(JSON.stringify({version:'0.2',base_entries:base.entries.length,additions:delta.additions.length,effective_entries:effective.entries.length,experimental_candidate:true,release_registry_equivalent:false},null,2));
  return effective;
}
if(require.main===module) validateRepository(process.argv[2]);
module.exports={validateDelta,validateRepository,EXPECTED,REQUIRED_NON_CLAIMS};
