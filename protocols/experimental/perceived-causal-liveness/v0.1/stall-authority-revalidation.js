'use strict';

function revalidateAuthority({state, meaningful_progress, prior_authority_valid, target_unchanged, frontier_unchanged, permit_unexpired, permit_unconsumed}) {
  if(state !== 'RUNNING') return {authority_restored:false, reason:'RUN_NOT_RUNNING'};
  if(meaningful_progress !== true) return {authority_restored:false, reason:'NO_MEANINGFUL_PROGRESS'};
  const checks = {prior_authority_valid, target_unchanged, frontier_unchanged, permit_unexpired, permit_unconsumed};
  const failed = Object.entries(checks).filter(([,v])=>v!==true).map(([k])=>k);
  if(failed.length) return {authority_restored:false, reason:'REVALIDATION_FAILED', failed_checks:failed};
  return {authority_restored:true, reason:'FRESH_REVALIDATION_PASSED'};
}

module.exports={revalidateAuthority};
