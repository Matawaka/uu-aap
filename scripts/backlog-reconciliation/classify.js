'use strict';
const IMPLEMENTATION_STATES=new Set(['COMPLETED','PARTIAL','STILL_OPEN','INSUFFICIENT_EVIDENCE']);
const ROADMAP_STATES=new Set(['CURRENT','SUPERSEDED','STILL_OPEN','INSUFFICIENT_EVIDENCE']);
function classifyIssue(e){
 if(!e||!e.issue_ref)throw Error('issue_ref required');
 const merged=Array.isArray(e.merged_prs)&&e.merged_prs.length>0;
 const paths=Array.isArray(e.implementation_paths)&&e.implementation_paths.length>0;
 const acceptance=e.acceptance_complete===true;
 let implementation_state='INSUFFICIENT_EVIDENCE';
 if(acceptance&&merged&&paths) implementation_state='COMPLETED';
 else if(merged||paths||e.acceptance_complete===false) implementation_state='PARTIAL';
 else if(e.explicitly_still_open===true) implementation_state='STILL_OPEN';
 let roadmap_state='INSUFFICIENT_EVIDENCE';
 if(e.superseded_by) roadmap_state='SUPERSEDED';
 else if(e.roadmap_current===true) roadmap_state='CURRENT';
 else if(e.explicitly_still_open===true) roadmap_state='STILL_OPEN';
 const receipt={type:'BacklogReconciliationReceipt',issue_ref:e.issue_ref,implementation_state,roadmap_state,merged_prs:e.merged_prs||[],merge_shas:e.merge_shas||[],implementation_paths:e.implementation_paths||[],successor_usage_refs:e.successor_usage_refs||[],superseded_by:e.superseded_by||null,acceptance_complete:e.acceptance_complete??null,classification_mutates_issue:false,automatic_closure_authorized:false};
 if(!IMPLEMENTATION_STATES.has(receipt.implementation_state)||!ROADMAP_STATES.has(receipt.roadmap_state))throw Error('invalid state');return receipt;
}
module.exports={classifyIssue,IMPLEMENTATION_STATES,ROADMAP_STATES};
