'use strict';

const ERD = require('../../../integration/event-responsive-dormancy/v0.1/event-responsive-dormancy.js');
const RERC = require('../../../integration/rerc/v0.1/rerc.js');

const ERD_FRONTIER='0039375897f2de683afac62e902335f53a1a7d98';
const ERD_MODULE_BLOB='2cadbd2f405391f4f97e100d77245757ce6b5a58';
const RERC_FRONTIER='ef4c8c6030ef517f2997fb76cff4f584fb25c691';
const RERC_MODULE_BLOB='d2aae21a2e2375477c6349eae5f236ea60cd7151';
const READY='READY_FOR_SEPARATE_ACTION_ADMISSION';

function fail(m){ throw new Error(m); }
function obj(x){ return !!x && typeof x==='object' && !Array.isArray(x); }
function str(x,l){ if(typeof x!=='string'||!x) fail(`${l} required`); }
function exactKeys(x,allowed,label){ for(const k of Object.keys(x)) if(!allowed.has(k)) fail(`${label}: unknown field ${k}`); }
function falseClaimKeys(){ return ['component_semantics_collapsed','shared_world_identity_proven','source_state_destroyed','evidence_deleted','authority_created','action_permit_created','runtime_activated','external_effect_performed','performance_gain_proven','resource_savings_proven']; }
function validateWakeReceipt(r){
  if(!obj(r)) fail('ERD wake receipt required');
  exactKeys(r,new Set(['artifact_type','version','capability_id','dormant_capability_digest','wake_signal_digest','signal_id','signal_matches_contract','wake_attention_created','state','checks','preserved','claims','next_admissible_interface','automatic_transition']),'ERD wake receipt');
  if(r.artifact_type!=='EventResponsiveDormancyWakeReceipt'||r.version!=='0.1') fail('ERD wake receipt identity invalid');
  if(!obj(r.claims)||Object.values(r.claims).some(v=>v!==false)) fail('ERD wake receipt authority/non-effect boundary violated');
  if(r.automatic_transition!==false) fail('ERD automatic transition forbidden');
  if(r.state===READY && r.next_admissible_interface!=='PreActionEvidenceBundle') fail('ERD ready state next interface invalid');
  if(r.state!==READY && r.next_admissible_interface!==null) fail('ERD non-ready state cannot expose next interface');
}

function validateManifest(m){
  if(!obj(m)) fail('candidate manifest required');
  exactKeys(m,new Set(['artifact_type','version','status','origin_frontier','tracking_issue','shared_principle','components','capabilities','non_claims']),'candidate manifest');
  if(m.artifact_type!=='RecoverableStateInfrastructureCandidateManifest'||m.version!=='0.1'||m.status!=='EXPERIMENTAL_REUSABLE_INFRASTRUCTURE_CANDIDATE'||m.origin_frontier!==RERC_FRONTIER||m.tracking_issue!==881) fail('candidate manifest identity invalid');
  if(m.shared_principle!=='Reduced Active Burden != Loss of Recoverable State != Authority Creation') fail('candidate shared principle drift');
  if(!Array.isArray(m.components)||m.components.length!==2||m.components[0].id!=='EventResponsiveDormancy'||m.components[1].id!=='RERC') fail('candidate component set/order invalid');
  const expected=[
    {id:'EventResponsiveDormancy',merge_frontier:ERD_FRONTIER,module_path:'protocols/integration/event-responsive-dormancy/v0.1/event-responsive-dormancy.js',module_blob:ERD_MODULE_BLOB,implementation_receipt_path:'protocols/integration/event-responsive-dormancy/v0.1/implementation-receipt.json',implementation_receipt_blob:'e127d784a74f0713fe0b157845ec5a2754647034'},
    {id:'RERC',merge_frontier:RERC_FRONTIER,module_path:'protocols/integration/rerc/v0.1/rerc.js',module_blob:RERC_MODULE_BLOB,implementation_receipt_path:'protocols/integration/rerc/v0.1/implementation-receipt.json',implementation_receipt_blob:'83609468622f4a79783b9b29e73a661497bad849'}
  ];
  for(let i=0;i<2;i++){
    const c=m.components[i],e=expected[i];
    exactKeys(c,new Set(['id','version','merge_frontier','module_path','module_blob','implementation_receipt_path','implementation_receipt_blob','independently_reusable']),'candidate component');
    if(c.version!=='0.1'||c.independently_reusable!==true) fail('candidate component reuse boundary invalid');
    for(const k of Object.keys(e)) if(c[k]!==e[k]) fail(`candidate component substitution ${e.id}:${k}`);
  }
  if(!obj(m.capabilities)||m.capabilities.event_responsive_dormancy_control!==true||m.capabilities.reversible_operational_representation_control!==true||m.capabilities.composed_reference_harness!==true||m.capabilities.automatic_runtime_coupling!==false) fail('candidate capabilities invalid');
  if(!obj(m.non_claims)||Object.values(m.non_claims).some(v=>v!==false)) fail('candidate non-claim escalation');
  return true;
}

function validateCompositionReceipt(r){
  if(!obj(r)) fail('composition receipt required');
  exactKeys(r,new Set(['artifact_type','version','candidate_status','work_context_ref','component_bindings','erd_state','rerc_exact_restore_verified','composition_state','possible_next_interfaces','automatic_transition','claims']),'composition receipt');
  if(r.artifact_type!=='RecoverableStateInfrastructureCompositionReceipt'||r.version!=='0.1'||r.candidate_status!=='EXPERIMENTAL_REUSABLE_INFRASTRUCTURE_CANDIDATE') fail('composition receipt identity invalid');
  str(r.work_context_ref,'work_context_ref');
  if(!obj(r.component_bindings)||!obj(r.component_bindings.event_responsive_dormancy)||!obj(r.component_bindings.rerc)) fail('component bindings required');
  const e=r.component_bindings.event_responsive_dormancy, q=r.component_bindings.rerc;
  if(e.merge_frontier!==ERD_FRONTIER||e.module_blob!==ERD_MODULE_BLOB) fail('ERD component substitution');
  if(q.merge_frontier!==RERC_FRONTIER||q.module_blob!==RERC_MODULE_BLOB) fail('RERC component substitution');
  for(const x of [e.wake_receipt_digest,q.source_graph_digest,q.operational_graph_digest,q.suppression_receipt_digest]) if(!/^[0-9a-f]{64}$/.test(x||'')) fail('component digest invalid');
  if(r.rerc_exact_restore_verified!==true) fail('RERC exact restore required');
  if(r.automatic_transition!==false) fail('automatic transition forbidden');
  if(!Array.isArray(r.possible_next_interfaces)||new Set(r.possible_next_interfaces).size!==r.possible_next_interfaces.length||r.possible_next_interfaces.some(x=>x!=='PreActionEvidenceBundle')) fail('possible next interfaces invalid');
  const ready=r.erd_state===READY;
  if(ready && (r.composition_state!=='COMPOSED_READY_FOR_SEPARATE_ACTION_ADMISSION'||r.possible_next_interfaces.length!==1)) fail('ready composition state mismatch');
  if(!ready && (r.composition_state!=='COMPOSED_NO_ACTION_ADMISSION'||r.possible_next_interfaces.length!==0)) fail('non-ready composition state mismatch');
  if(!obj(r.claims)) fail('composition claims required');
  exactKeys(r.claims,new Set(falseClaimKeys()),'composition claims');
  for(const k of falseClaimKeys()) if(r.claims[k]!==false) fail(`unsafe composition claim ${k}`);
  return true;
}
function composeOutputs({work_context_ref,wake_receipt,operational_graph,suppression_receipt}){
  str(work_context_ref,'work_context_ref');
  validateWakeReceipt(wake_receipt);
  RERC.validateGraph(operational_graph);
  RERC.validateReceipt(suppression_receipt);
  const restored_graph=RERC.restoreGraph(operational_graph,suppression_receipt);
  if(RERC.digest(restored_graph)!==suppression_receipt.source_graph_digest) fail('composed RERC exact restore failed');
  const ready=wake_receipt.state===READY;
  const composition_receipt={
    artifact_type:'RecoverableStateInfrastructureCompositionReceipt',version:'0.1',
    candidate_status:'EXPERIMENTAL_REUSABLE_INFRASTRUCTURE_CANDIDATE',work_context_ref,
    component_bindings:{
      event_responsive_dormancy:{merge_frontier:ERD_FRONTIER,module_blob:ERD_MODULE_BLOB,wake_receipt_digest:RERC.digest(wake_receipt)},
      rerc:{merge_frontier:RERC_FRONTIER,module_blob:RERC_MODULE_BLOB,source_graph_digest:suppression_receipt.source_graph_digest,operational_graph_digest:suppression_receipt.operational_graph_digest,suppression_receipt_digest:RERC.digest(suppression_receipt)}
    },
    erd_state:wake_receipt.state,rerc_exact_restore_verified:true,
    composition_state:ready?'COMPOSED_READY_FOR_SEPARATE_ACTION_ADMISSION':'COMPOSED_NO_ACTION_ADMISSION',
    possible_next_interfaces:ready?['PreActionEvidenceBundle']:[],automatic_transition:false,
    claims:{component_semantics_collapsed:false,shared_world_identity_proven:false,source_state_destroyed:false,evidence_deleted:false,authority_created:false,action_permit_created:false,runtime_activated:false,external_effect_performed:false,performance_gain_proven:false,resource_savings_proven:false}
  };
  validateCompositionReceipt(composition_receipt);
  return {composition_receipt,restored_graph};
}
function runCandidate({work_context_ref,dormancy_input,rerc_input}){
  validateManifest(require('./candidate-manifest.json'));
  const wake_receipt=ERD.evaluateWake(dormancy_input);
  const {operational_graph,receipt:suppression_receipt}=RERC.compressGraph(rerc_input);
  const {composition_receipt,restored_graph}=composeOutputs({work_context_ref,wake_receipt,operational_graph,suppression_receipt});
  return {wake_receipt,operational_graph,suppression_receipt,restored_graph,composition_receipt};
}
module.exports={runCandidate,composeOutputs,validateCompositionReceipt,validateWakeReceipt,validateManifest};
