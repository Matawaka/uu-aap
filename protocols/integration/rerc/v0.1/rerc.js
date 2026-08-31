'use strict';

const crypto = require('node:crypto');
const CLASSES = new Set(['REPRESENTATIONAL','CAUSAL','EVIDENTIARY','COORDINATION','PROTECTIVE']);

function fail(m){ throw new Error(m); }
function obj(x){ return !!x && typeof x === 'object' && !Array.isArray(x); }
function exactKeys(x, allowed, label){ for(const k of Object.keys(x)) if(!allowed.has(k)) fail(`${label}: unknown field ${k}`); }
function str(x,label){ if(typeof x!=='string'||!x) fail(`${label} required`); }
function uniqueStrings(x,label,min=0){ if(!Array.isArray(x)||x.length<min||x.some(v=>typeof v!=='string'||!v)||new Set(x).size!==x.length) fail(`${label} invalid`); }
function canonical(v){
  if(Array.isArray(v)) return '['+v.map(canonical).join(',')+']';
  if(v&&typeof v==='object') return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function digest(v){ return crypto.createHash('sha256').update(canonical(v)).digest('hex'); }
function falseClaims(){ return {authority_created:false,facts_created:false,evidence_deleted:false,relations_invalidated:false}; }

function validateEdge(e){
  if(!obj(e)) fail('edge object required');
  exactKeys(e,new Set(['edge_id','from','to','relation_type','redundancy_class','redundancy_group','evidence_refs','ontological_status']),'edge');
  for(const k of ['edge_id','from','to','relation_type','redundancy_group']) str(e[k],`edge.${k}`);
  if(!CLASSES.has(e.redundancy_class)) fail('edge redundancy_class invalid');
  uniqueStrings(e.evidence_refs,'edge evidence_refs',1);
  if(e.ontological_status!=='OBSERVED_RELATION') fail('edge ontological status invalid');
}
function validateGraph(g){
  if(!obj(g)) fail('graph required');
  exactKeys(g,new Set(['artifact_type','version','graph_kind','graph_id','nodes','edges','source_graph_digest','claims']),'graph');
  if(g.artifact_type!=='RERCRelationGraph'||g.version!=='0.1'||!['OBSERVED','OPERATIONAL'].includes(g.graph_kind)) fail('graph identity invalid');
  str(g.graph_id,'graph_id');
  if(!Array.isArray(g.nodes)||g.nodes.length<1) fail('nodes required');
  const nodeIds=new Set();
  for(const n of g.nodes){
    if(!obj(n)) fail('node object required');
    exactKeys(n,new Set(['node_id','kind','evidence_refs']),'node');
    str(n.node_id,'node_id'); str(n.kind,'node.kind'); uniqueStrings(n.evidence_refs,'node evidence_refs',1);
    if(nodeIds.has(n.node_id)) fail('duplicate node id'); nodeIds.add(n.node_id);
  }
  if(!Array.isArray(g.edges)) fail('edges required');
  const edgeIds=new Set();
  for(const e of g.edges){
    validateEdge(e);
    if(edgeIds.has(e.edge_id)) fail('duplicate edge id'); edgeIds.add(e.edge_id);
    if(!nodeIds.has(e.from)||!nodeIds.has(e.to)) fail('edge endpoint not found');
  }
  if(g.graph_kind==='OBSERVED' && g.source_graph_digest!==null) fail('observed source_graph_digest must be null');
  if(g.graph_kind==='OPERATIONAL' && !/^[0-9a-f]{64}$/.test(g.source_graph_digest||'')) fail('operational source_graph_digest required');
  if(!obj(g.claims)) fail('graph claims required');
  exactKeys(g.claims,new Set(['authority_created','facts_created','evidence_deleted','relations_invalidated']),'graph claims');
  for(const [k,v] of Object.entries(falseClaims())) if(g.claims[k]!==v) fail(`unsafe graph claim ${k}`);
  return true;
}
function compressGraph({observed_graph,suppress_edge_ids,request_id}){
  validateGraph(observed_graph);
  if(observed_graph.graph_kind!=='OBSERVED') fail('compression requires observed graph');
  uniqueStrings(suppress_edge_ids,'suppress_edge_ids');
  str(request_id,'request_id');
  const byId=new Map(observed_graph.edges.map(e=>[e.edge_id,e]));
  for(const id of suppress_edge_ids) if(!byId.has(id)) fail(`unknown suppress edge ${id}`);
  const suppressSet=new Set(suppress_edge_ids);
  for(const id of suppress_edge_ids){
    const edge=byId.get(id);
    if(edge.redundancy_class==='PROTECTIVE') fail('protective redundancy cannot be suppressed');
    const groupPeers=observed_graph.edges.filter(e=>e.redundancy_group===edge.redundancy_group);
    if(!groupPeers.some(e=>!suppressSet.has(e.edge_id))) fail(`suppression removes last relation in redundancy group ${edge.redundancy_group}`);
  }
  const sourceDigest=digest(observed_graph);
  const operational={
    artifact_type:'RERCRelationGraph',version:'0.1',graph_kind:'OPERATIONAL',
    graph_id:observed_graph.graph_id+':operational:'+request_id,
    nodes:structuredClone(observed_graph.nodes),
    edges:structuredClone(observed_graph.edges.filter(e=>!suppressSet.has(e.edge_id))),
    source_graph_digest:sourceDigest,claims:falseClaims()
  };
  validateGraph(operational);
  const suppressed=structuredClone(observed_graph.edges.filter(e=>suppressSet.has(e.edge_id)));
  const receipt={
    artifact_type:'RERCSuppressionCompressionReceipt',version:'0.1',request_id,
    source_graph_id:observed_graph.graph_id,
    source_graph_digest:sourceDigest,operational_graph_digest:digest(operational),
    source_edge_order:observed_graph.edges.map(e=>e.edge_id),
    suppressed_edge_ids:suppressed.map(e=>e.edge_id),suppressed_edges:suppressed,
    retained_edge_ids:operational.edges.map(e=>e.edge_id),
    classes_touched:[...new Set(suppressed.map(e=>e.redundancy_class))],
    reversible:true,exact_restore_verified:false,
    claims:{
      suppression_is_ontological_deletion:false,evidence_destroyed:false,relation_invalidated:false,
      authority_created:false,inference_promoted_to_fact:false,protective_redundancy_suppressed:false,
      permanent_discard_authorized:false,redundancy_group_is_equivalence_proof:false
    }
  };
  const restored=restoreGraph(operational,receipt,{allowUnverified:true});
  if(digest(restored)!==sourceDigest) fail('exact restoration check failed');
  receipt.exact_restore_verified=true;
  return {operational_graph:operational,receipt};
}
function validateReceipt(r){
  if(!obj(r)) fail('receipt required');
  exactKeys(r,new Set(['artifact_type','version','request_id','source_graph_id','source_graph_digest','operational_graph_digest','source_edge_order',
    'suppressed_edge_ids','suppressed_edges','retained_edge_ids','classes_touched','reversible','exact_restore_verified','claims']),'receipt');
  if(r.artifact_type!=='RERCSuppressionCompressionReceipt'||r.version!=='0.1') fail('receipt identity invalid');
  str(r.request_id,'request_id');
  str(r.source_graph_id,'source_graph_id');
  for(const k of ['source_graph_digest','operational_graph_digest']) if(!/^[0-9a-f]{64}$/.test(r[k]||'')) fail(`${k} invalid`);
  uniqueStrings(r.source_edge_order,'source_edge_order');
  uniqueStrings(r.suppressed_edge_ids,'suppressed_edge_ids');
  uniqueStrings(r.retained_edge_ids,'retained_edge_ids');
  if(!Array.isArray(r.suppressed_edges)) fail('suppressed_edges required');
  for(const e of r.suppressed_edges) validateEdge(e);
  if(JSON.stringify(r.suppressed_edge_ids)!==JSON.stringify(r.suppressed_edges.map(e=>e.edge_id))) fail('suppressed edge binding mismatch');
  if(!Array.isArray(r.classes_touched)||new Set(r.classes_touched).size!==r.classes_touched.length||r.classes_touched.some(c=>!CLASSES.has(c)||c==='PROTECTIVE')) fail('classes_touched invalid');
  if(r.reversible!==true) fail('receipt must remain reversible');
  if(r.exact_restore_verified!==true) fail('receipt exact restore not verified');
  if(!obj(r.claims)) fail('receipt claims required');
  const allowed=new Set(['suppression_is_ontological_deletion','evidence_destroyed','relation_invalidated','authority_created',
    'inference_promoted_to_fact','protective_redundancy_suppressed','permanent_discard_authorized','redundancy_group_is_equivalence_proof']);
  exactKeys(r.claims,allowed,'receipt claims');
  for(const k of allowed) if(r.claims[k]!==false) fail(`unsafe receipt claim ${k}`);
}
function restoreGraph(operational,receipt,opts={}){
  validateGraph(operational);
  if(operational.graph_kind!=='OPERATIONAL') fail('restore requires operational graph');
  if(!opts.allowUnverified) validateReceipt(receipt);
  if(digest(operational)!==receipt.operational_graph_digest) fail('operational graph digest mismatch');
  if(operational.source_graph_digest!==receipt.source_graph_digest) fail('source graph binding mismatch');
  if(JSON.stringify(operational.edges.map(e=>e.edge_id))!==JSON.stringify(receipt.retained_edge_ids)) fail('retained edge binding mismatch');
  const all=new Map();
  for(const e of operational.edges) all.set(e.edge_id,structuredClone(e));
  for(const e of receipt.suppressed_edges){
    if(all.has(e.edge_id)) fail('suppressed edge overlaps retained edge');
    all.set(e.edge_id,structuredClone(e));
  }
  if(receipt.source_edge_order.length!==all.size) fail('source edge order cardinality mismatch');
  const edges=receipt.source_edge_order.map(id=>{ if(!all.has(id)) fail(`source edge missing ${id}`); return all.get(id); });
  const restored={
    artifact_type:'RERCRelationGraph',version:'0.1',graph_kind:'OBSERVED',
    graph_id:receipt.source_graph_id,
    nodes:structuredClone(operational.nodes),edges,source_graph_digest:null,claims:falseClaims()
  };
  validateGraph(restored);
  if(digest(restored)!==receipt.source_graph_digest) fail('restored source graph digest mismatch');
  return restored;
}
module.exports={compressGraph,restoreGraph,validateGraph,validateReceipt,digest};
