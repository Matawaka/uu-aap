'use strict';
const STATES=new Set(['COMPLETED','PARTIAL','STILL_OPEN','SUPERSEDED','INSUFFICIENT_EVIDENCE']);
function classifyIssue(e){
 if(!e||!e.issue_ref)throw Error('issue_ref required');
 const merged=Array.isArray(e.merged_prs)&&e.merged_prs.length>0;
 const paths=Array.isArray(e.implementation_paths)&&e.implementation_paths.length>0;
 const acceptance=e.acceptance_complete===true;
 const superseded=!!e.superseded_by;
 let state='INSUFFICIENT_EVIDENCE';
 if(superseded) state='SUPERSEDED';
 else if(acceptance&&merged&&paths) state='COMPLETED';
 else if(merged||paths||e.acceptance_complete===false) state='PARTIAL';
 else if(e.explicitly_still_open===true) state='STILL_OPEN';
 const receipt={type:'BacklogReconciliationReceipt',issue_ref:e.issue_ref,state,merged_prs:e.merged_prs||[],merge_shas:e.merge_shas||[],implementation_paths:e.implementation_paths||[],successor_usage_refs:e.successor_usage_refs||[],superseded_by:e.superseded_by||null,acceptance_complete:e.acceptance_complete??null,classification_mutates_issue:false,automatic_closure_authorized:false};
 if(!STATES.has(receipt.state))throw Error('invalid state');return receipt;
}
module.exports={classifyIssue,STATES};
