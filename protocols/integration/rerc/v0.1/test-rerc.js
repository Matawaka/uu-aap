'use strict';
const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict');
const {compressGraph,restoreGraph,validateGraph,validateReceipt,digest}=require('./rerc.js');
const out=process.argv[2]||'/tmp/rerc-v0.1'; fs.mkdirSync(out,{recursive:true});
const graph={
 artifact_type:'RERCRelationGraph',version:'0.1',graph_kind:'OBSERVED',graph_id:'graph:demo',
 nodes:[
  {node_id:'a',kind:'claim',evidence_refs:['ev:a']},{node_id:'b',kind:'claim',evidence_refs:['ev:b']},
  {node_id:'c',kind:'claim',evidence_refs:['ev:c']}
 ],
 edges:[
  {edge_id:'r1',from:'a',to:'b',relation_type:'supports',redundancy_class:'REPRESENTATIONAL',redundancy_group:'g1',evidence_refs:['ev:r1'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'r2',from:'a',to:'b',relation_type:'supports',redundancy_class:'REPRESENTATIONAL',redundancy_group:'g1',evidence_refs:['ev:r2'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'c1',from:'b',to:'c',relation_type:'causal_candidate',redundancy_class:'CAUSAL',redundancy_group:'g2',evidence_refs:['ev:c1'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'c2',from:'b',to:'c',relation_type:'causal_candidate',redundancy_class:'CAUSAL',redundancy_group:'g2',evidence_refs:['ev:c2'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'e1',from:'a',to:'c',relation_type:'evidence_link',redundancy_class:'EVIDENTIARY',redundancy_group:'g3',evidence_refs:['ev:e1'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'e2',from:'a',to:'c',relation_type:'evidence_link',redundancy_class:'EVIDENTIARY',redundancy_group:'g3',evidence_refs:['ev:e2'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'q1',from:'c',to:'a',relation_type:'coordination_link',redundancy_class:'COORDINATION',redundancy_group:'g4',evidence_refs:['ev:q1'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'q2',from:'c',to:'a',relation_type:'coordination_link',redundancy_class:'COORDINATION',redundancy_group:'g4',evidence_refs:['ev:q2'],ontological_status:'OBSERVED_RELATION'},
  {edge_id:'p1',from:'b',to:'a',relation_type:'safety_crosscheck',redundancy_class:'PROTECTIVE',redundancy_group:'protect',evidence_refs:['ev:p1'],ontological_status:'OBSERVED_RELATION'}
 ],
 source_graph_digest:null,claims:{authority_created:false,facts_created:false,evidence_deleted:false,relations_invalidated:false}
};
function write(n,v){fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n');}
function reject(n,fn,pat){let e=null;try{fn();}catch(x){e=x;}assert.ok(e,`${n}: expected reject`);if(pat)assert.match(e.message,pat);}
validateGraph(graph);
const {operational_graph,receipt}=compressGraph({observed_graph:graph,suppress_edge_ids:['r2','c2','e2','q2'],request_id:'req:1'});
validateReceipt(receipt);
assert.equal(receipt.source_graph_id,'graph:demo');
assert.equal(operational_graph.edges.length,5);
assert.ok(operational_graph.edges.some(e=>e.edge_id==='p1'));
assert.deepEqual(new Set(receipt.classes_touched),new Set(['REPRESENTATIONAL','CAUSAL','EVIDENTIARY','COORDINATION']));
assert.ok(receipt.suppressed_edges.every(e=>e.evidence_refs.length===1));
assert.ok(Object.values(receipt.claims).every(v=>v===false));
const restored=restoreGraph(operational_graph,receipt);
assert.equal(digest(restored),digest(graph));
assert.deepEqual(restored,graph);
write('observed-graph.json',graph);write('operational-graph.json',operational_graph);write('suppression-receipt.json',receipt);write('restored-graph.json',restored);

reject('protective',()=>compressGraph({observed_graph:graph,suppress_edge_ids:['p1'],request_id:'bad'}),/protective/);
reject('last group',()=>compressGraph({observed_graph:graph,suppress_edge_ids:['r1','r2'],request_id:'bad'}),/last relation/);
reject('unknown',()=>compressGraph({observed_graph:graph,suppress_edge_ids:['missing'],request_id:'bad'}),/unknown suppress/);
reject('duplicate suppression',()=>compressGraph({observed_graph:graph,suppress_edge_ids:['r2','r2'],request_id:'bad'}),/suppress_edge_ids invalid/);
reject('duplicate edge',()=>validateGraph({...graph,edges:[...graph.edges,graph.edges[0]]}),/duplicate edge/);
reject('endpoint drift',()=>validateGraph({...graph,edges:graph.edges.map((e,i)=>i?e:{...e,to:'missing'})}),/endpoint/);
reject('scalar score',()=>validateGraph({...graph,redundancy_score:0.1}),/unknown field/);
reject('authority overclaim',()=>validateGraph({...graph,claims:{...graph.claims,authority_created:true}}),/unsafe graph claim/);
const opBad=structuredClone(operational_graph);opBad.edges[0].evidence_refs=['changed'];
reject('operational tamper',()=>restoreGraph(opBad,receipt),/operational graph digest mismatch/);
const recBad=structuredClone(receipt);recBad.suppressed_edges[0].evidence_refs=['lost'];
reject('receipt evidence loss',()=>restoreGraph(operational_graph,recBad),/restored source graph digest mismatch/);
const recId=structuredClone(receipt);recId.source_graph_id='graph:other';
reject('source graph identity tamper',()=>restoreGraph(operational_graph,recId),/restored source graph digest mismatch/);
const recClaim=structuredClone(receipt);recClaim.claims.inference_promoted_to_fact=true;
reject('fact overclaim',()=>validateReceipt(recClaim),/unsafe receipt claim/);
console.log('RERC_V0_1_PASS');
