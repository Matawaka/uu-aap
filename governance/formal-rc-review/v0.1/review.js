'use strict';
const STATES=new Set(['PASS','PRESENT_UNVERIFIED','GAP','INSUFFICIENT_EVIDENCE']);
const IDS=['security','privacy','accessibility','contestability','ru_en_semantic_parity','ru_en_navigation_parity','release_governance_separation'];
function derive(input){
 if(input?.schema_version!=='0.1')throw Error('schema_version');
 if(!input.review_id||!input.origin_frontier)throw Error('review identity/frontier required');
 if(!Array.isArray(input.dimensions)||input.dimensions.length!==IDS.length)throw Error('exact dimensions required');
 const by=new Map(input.dimensions.map(d=>[d.id,d]));
 for(const id of IDS){const d=by.get(id);if(!d||!STATES.has(d.state)||!Array.isArray(d.evidence_refs)||d.evidence_refs.length===0||!d.limitation)throw Error(`invalid dimension ${id}`);}
 const states=IDS.map(id=>by.get(id).state);
 let aggregate='INTERNAL_GOVERNANCE_REVIEW_PENDING';
 if(states.includes('GAP'))aggregate='INTERNAL_GOVERNANCE_GAPS_FOUND';
 else if(states.includes('INSUFFICIENT_EVIDENCE'))aggregate='INTERNAL_GOVERNANCE_INSUFFICIENT_EVIDENCE';
 else if(states.includes('PRESENT_UNVERIFIED'))aggregate='INTERNAL_GOVERNANCE_REVIEW_PENDING';
 else aggregate='INTERNAL_GOVERNANCE_PASS_EXTERNAL_GATES_STILL_OPEN';
 if(input.external_gates?.public_review!=='WAITING_EXTERNAL'||input.external_gates?.pilot_002!=='WAITING_EXTERNAL')throw Error('external gates cannot be fabricated closed');
 const falseKeys=['release_authorized','publication_authorized','certification_created','legal_status_created','runtime_activation_authorized','action_permit_created','external_review_fabricated'];
 for(const k of falseKeys)if(input.non_effects?.[k]!==false)throw Error(`forbidden governance escalation ${k}`);
 return {type:'FormalRCGovernanceReviewReceipt',review_id:input.review_id,origin_frontier:input.origin_frontier,dimension_states:Object.fromEntries(IDS.map(id=>[id,by.get(id).state])),aggregate,external_gates:{...input.external_gates},release_authority_created:false,external_validation_claimed:false};
}
module.exports={derive,IDS};
