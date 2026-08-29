' strict';

function precedenceLease({lease_id,resolution,starts_at,expires_at,revocation_conditions=[],revisit_triggers=[]}){
  if(!lease_id||!resolution||resolution.mode!=='TEMPORARY_PRECEDENCE') throw Error('temporary precedence resolution required');
  const start=Date.parse(starts_at), end=Date.parse(expires_at);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start) throw Error('bounded lease interval required');
  const triggers=[...new Set([...(resolution.revisit_triggers||[]),...revisit_triggers,'LEASE_EXPIRY'])];
  return {type:'PrecedenceLease',lease_id,selected_claim_ref:resolution.selected_claim_ref,competing_claim_refs:[...(resolution.competing_claim_refs||[])],starts_at,expires_at,revocation_conditions:[...revocation_conditions],revisit_triggers:triggers,contested:true,normative_victory:false,active_authority_created:false};
}

function leaseStatus({lease,now,revoked=false,trigger=null}){
  if(!lease||lease.type!=='PrecedenceLease') throw Error('lease required');
  const t=Date.parse(now), end=Date.parse(lease.expires_at);
  if(!Number.isFinite(t)) throw Error('valid observation time required');
  if(revoked) return {status:'REVOKED',active:false,reopen_contention:true,reason:trigger||'REVOCATION'};
  if(t>=end) return {status:'EXPIRED',active:false,reopen_contention:true,reason:'LEASE_EXPIRY'};
  if(trigger && lease.revisit_triggers.includes(trigger)) return {status:'REVISIT_REQUIRED',active:false,reopen_contention:true,reason:trigger};
  return {status:'ACTIVE',active:true,reopen_contention:false,reason:null};
}

function authorizeUnderLease({lease,status,claim_ref}){
  if(!status||status.active!==true) return {authorized:false,reason:'LEASE_INACTIVE'};
  if(claim_ref!==lease.selected_claim_ref) return {authorized:false,reason:'CLAIM_NOT_SELECTED'};
  return {authorized:true,reason:'ACTIVE_PRECEDENCE_LEASE',normative_victory:false,contested:true};
}

function revisitReceipt({lease,status,observed_at}){
  if(!status||status.reopen_contention!==true) throw Error('revisit requires reopening condition');
  return {type:'RevisitReceipt',lease_id:lease.lease_id,observed_at,reason:status.reason,reopen_contention:true,preserved_claim_refs:[lease.selected_claim_ref,...lease.competing_claim_refs],normative_winner:null,external_effect_authority_created:false};
}

module.exports={precedenceLease,leaseStatus,authorizeUnderLease,revisitReceipt};
