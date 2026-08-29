'use strict';

function assertPositiveInt(name,value){if(!Number.isInteger(value)||value<1)throw Error(`${name} must be positive integer`);}
function createLivenessPolicyReceipt({policy_id,profile,issued_at,issuer_ref,suspect_after_ms,close_after_ms,max_suspect_after_ms,max_close_after_ms}){
  if(!policy_id||!profile||!issued_at||!issuer_ref) throw Error('policy provenance required');
  assertPositiveInt('suspect_after_ms',suspect_after_ms);assertPositiveInt('close_after_ms',close_after_ms);
  assertPositiveInt('max_suspect_after_ms',max_suspect_after_ms);assertPositiveInt('max_close_after_ms',max_close_after_ms);
  if(close_after_ms<=suspect_after_ms) throw Error('close_after_ms must exceed suspect_after_ms');
  if(max_close_after_ms<=max_suspect_after_ms) throw Error('max_close_after_ms must exceed max_suspect_after_ms');
  if(suspect_after_ms>max_suspect_after_ms||close_after_ms>max_close_after_ms) throw Error('policy exceeds bounded maxima');
  return {type:'LivenessPolicyReceipt',policy_id,profile,issued_at,issuer_ref,suspect_after_ms,close_after_ms,max_suspect_after_ms,max_close_after_ms,unbounded_lease_allowed:false,creates_external_effect_authority:false};
}
function applyPolicyToRun({run,policy}){
  if(!run||!policy) throw Error('run and policy required');
  if(policy.type!=='LivenessPolicyReceipt') throw Error('invalid policy receipt');
  return {...run,liveness_policy_ref:policy.policy_id,suspect_after_ms:policy.suspect_after_ms,close_after_ms:policy.close_after_ms,policy_profile:policy.profile};
}
module.exports={createLivenessPolicyReceipt,applyPolicyToRun};
