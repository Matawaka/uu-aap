'use strict';
const crypto=require('crypto');
function canonical(v){if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=canonical(v[k]);return o;}return v;}
function digest(v){return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')}`;}
function mapCcrpConflict({ccrp_record,ccrp_ref,dlc_si_contention_ref}){
 if(!ccrp_record||typeof ccrp_record!=='object')throw Error('ccrp record required');
 if(!ccrp_ref||!dlc_si_contention_ref)throw Error('immutable refs required');
 const payload=JSON.parse(JSON.stringify(ccrp_record));
 return {type:'CCRPLosslessMappingReceipt',ccrp_ref,ccrp_digest:digest(payload),ccrp_record:payload,dlc_si_contention_ref,classification_additive:true,predecessor_rewritten:false,information_loss:false,authority_created:false};
}
function verifyMapping(receipt,source){if(!receipt||receipt.type!=='CCRPLosslessMappingReceipt')throw Error('mapping receipt required');if(receipt.predecessor_rewritten!==false||receipt.information_loss!==false)throw Error('lossless invariant violated');if(digest(source)!==receipt.ccrp_digest||digest(receipt.ccrp_record)!==receipt.ccrp_digest)throw Error('ccrp payload drift');return true;}
module.exports={mapCcrpConflict,verifyMapping,digest};
