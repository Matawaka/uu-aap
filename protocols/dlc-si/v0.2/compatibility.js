'use strict';
const { buildReceipt: buildV01Receipt } = require('../v0.1/dlc-si.js');
const { assessDecomposition, chooseMode } = require('../../experimental/dlc-si/v0.1/decomposition.js');
const { postExecutionReceipt } = require('../../experimental/dlc-si/v0.1/post-execution.js');
const { relation, safeWorkGate } = require('../../experimental/dlc-si/v0.1/incomparability.js');

function successorEnvelope({v01_contention,decomposition=null,post_execution=null,relation_input=null,safe_work=null}){
  const predecessor=buildV01Receipt(v01_contention);
  const envelope={
    protocol:'DLC-SI',version:'0.2',profile:'continuity-preserving-successor-v0.2',
    predecessor:{version:'0.1',contention_id:predecessor.contention_id,fingerprint_sha256:predecessor.fingerprint_sha256},
    predecessor_receipt:predecessor,
    decomposition:null,post_execution:null,claim_relation:null,safe_work_gate:null,
    predecessor_fingerprint_preserved:true,
    v01_semantics_rewritten:false,
    external_effect_authority_created:false
  };
  if(decomposition){const a=assessDecomposition(decomposition);envelope.decomposition={assessment:a,choice:chooseMode(a)};}
  if(post_execution) envelope.post_execution=postExecutionReceipt(post_execution);
  if(relation_input) envelope.claim_relation=relation(relation_input);
  if(safe_work) envelope.safe_work_gate=safeWorkGate(safe_work);
  if(envelope.predecessor_receipt.fingerprint_sha256!==predecessor.fingerprint_sha256) throw Error('v0.1 fingerprint drift');
  return envelope;
}
module.exports={successorEnvelope};
