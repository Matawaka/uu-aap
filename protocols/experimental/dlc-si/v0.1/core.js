'use strict';

const MODES=new Set(['TEMPORARY_PRECEDENCE','DEFERRED','UNRESOLVED']);

function contention({claims,interface_descriptor,ccrp_ref=null}){
  if(!Array.isArray(claims)||claims.length<2) throw Error('at least two claims required');
  if(!interface_descriptor||!Number.isInteger(interface_descriptor.capacity)||interface_descriptor.capacity<1) throw Error('interface capacity required');
  const ids=claims.map(c=>c.claim_id);
  if(ids.some(x=>!x)||new Set(ids).size!==ids.length) throw Error('unique claim ids required');
  if(claims.some(c=>c.legitimate!==true||!c.legitimacy_ref)) throw Error('legitimacy proof required');
  return {type:'InterfaceContention',claim_refs:ids,legitimacy_refs:claims.map(c=>c.legitimacy_ref),interface_descriptor,ccrp_ref,interface_singular:interface_descriptor.capacity<claims.length,normative_winner:null,contested:true};
}

function boundedPolicy(input){
  if(!input||input.type!=='BOUNDED_PRECEDENCE_POLICY') throw Error('bounded precedence policy required');
  for(const k of ['policy_id','human_authority_ref','scope','max_lease_ms']) if(input[k]===undefined||input[k]===null) throw Error(`${k} required`);
  if(!Number.isInteger(input.max_lease_ms)||input.max_lease_ms<=0) throw Error('bounded max lease required');
  if(!Array.isArray(input.allowed_grounds)||input.allowed_grounds.length===0) throw Error('allowed grounds required');
  if(!Array.isArray(input.revisit_triggers)||input.revisit_triggers.length===0) throw Error('revisit triggers required');
  return {...input,self_authorizing:false,creates_normative_victory:false};
}

function resolve({contention:ct,mode,selected_claim_ref=null,ground=null,lease_ms=null,policy=null,human_resolution_ref=null}){
  if(!ct||ct.type!=='InterfaceContention'||ct.contested!==true) throw Error('contention required');
  if(!MODES.has(mode)) throw Error('unsupported first-slice mode');
  if(mode==='DEFERRED') return {mode,contested:true,normative_winner:null,selected_claim_ref:null,authority_created:false};
  if(mode==='UNRESOLVED') return {mode,contested:true,normative_winner:null,selected_claim_ref:null,human_resolution_required:true,authority_created:false};
  if(!selected_claim_ref||!ct.claim_refs.includes(selected_claim_ref)) throw Error('selected legitimate claim required');
  if(human_resolution_ref){
    return {mode,selected_claim_ref,contested:true,normative_winner:null,precedence_basis:'HUMAN_RESOLUTION',human_resolution_ref,authority_created:false};
  }
  const p=boundedPolicy(policy);
  if(!ground||!p.allowed_grounds.includes(ground)) throw Error('ground outside bounded policy');
  if(!Number.isInteger(lease_ms)||lease_ms<=0||lease_ms>p.max_lease_ms) throw Error('lease exceeds bounded policy');
  return {mode,selected_claim_ref,contested:true,normative_winner:null,precedence_basis:'PREAUTHORIZED_BOUNDED_POLICY',policy_ref:p.policy_id,human_authority_ref:p.human_authority_ref,ground,lease_ms,revisit_triggers:[...p.revisit_triggers],competing_claim_refs:ct.claim_refs.filter(x=>x!==selected_claim_ref),authority_created:false,creates_permanent_authority:false};
}

function contestedActionReceipt({resolution,action_ref=null}){
  if(!resolution||!MODES.has(resolution.mode)) throw Error('resolution required');
  return {type:'ContestedActionReceipt',mode:resolution.mode,action_ref,selected_claim_ref:resolution.selected_claim_ref??null,competing_claim_refs:resolution.competing_claim_refs??[],contested:true,normative_victory:false,selection_erases_legitimacy:false,external_effect_authority_created:false};
}

module.exports={contention,boundedPolicy,resolve,contestedActionReceipt};
