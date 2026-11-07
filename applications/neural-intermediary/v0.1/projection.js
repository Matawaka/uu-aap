// SPDX-License-Identifier: Apache-2.0
'use strict';
// Reuse accepted RERC unchanged. Reduces duplicate same-sensor/value relations,
// never independent support, contradictions, unknown values, or stale evidence.
const crypto = require('node:crypto');
const fs = require('node:fs');
const RERC = require('../../../protocols/integration/rerc/v0.1/rerc.js');

const hash = b => crypto.createHash('sha256').update(b).digest('hex');
function graphFor(policy, rows) {
  if (!Array.isArray(rows) || rows.length > 256) throw new Error('row_limit');
  const values = new Set(rows.map(r => r.value).filter(v => v !== 'unknown'));
  const nodes = [{node_id:'claim', kind:'CLAIM',evidence_refs:['policy-sha256:' + hash(Buffer.from(JSON.stringify(policy)))]}];
  const edges = [];
  const first = new Set();
  const candidates = [];
  for (const [index, row] of rows.entries()) {
    if (['tenant','compartment','purpose','subject','claim'].some(k => row[k] !== policy[k])) throw new Error('flow_boundary');
    const nodeId = 'observation-' + index;
    // Source payload stays in the raw input/bundle. Every row remains a node.
    nodes.push({node_id:nodeId, kind:'EVIDENCE',evidence_refs:['row-sha256:' + hash(Buffer.from(JSON.stringify(row)))]});
    const group = JSON.stringify([row.sensor_id, row.value]);
    const delta = Date.parse(policy.evaluation_time) - Date.parse(row.observed_at);
    const protectedRelation = values.size > 1 || row.value === 'unknown' || !Number.isFinite(delta) || delta < 0 || delta > policy.max_age_seconds * 1000;
    const redundant = first.has(group);
    const edge = {edge_id:'edge-' + index, from:nodeId, to:'claim', relation_type:'REPORTED_VALUE',
                  redundancy_class:protectedRelation ? 'PROTECTIVE' : redundant ? 'REPRESENTATIONAL' : 'EVIDENTIARY',
                  redundancy_group:'group-' + hash(Buffer.from(group)),
                  evidence_refs:['input-row:' + index], ontological_status:'OBSERVED_RELATION'};
    edges.push(edge);
    if (redundant && !protectedRelation) candidates.push(edge.edge_id);
    first.add(group);
  }
  return {graph:{artifact_type:'RERCRelationGraph',version:'0.1',graph_kind:'OBSERVED',graph_id:'intermediary-evidence',
                 nodes,edges,source_graph_digest:null,
                 claims:{authority_created:false,facts_created:false,evidence_deleted:false,relations_invalidated:false}}, candidates};
}

function project(policy, rows) {
  const {graph, candidates} = graphFor(policy, rows);
  const reduced = RERC.compressGraph({observed_graph:graph,suppress_edge_ids:candidates,request_id:'offline-projection'});
  const restored = RERC.restoreGraph(reduced.operational_graph,reduced.receipt);
  if (RERC.digest(restored) !== RERC.digest(graph)) throw new Error('restore_mismatch');
  return {schema:'matawaka.intermediary.projection/v0.1',...reduced,
          source_relation_count:graph.edges.length,active_relation_count:reduced.operational_graph.edges.length,
          full_payload_retained_separately:true,source_graph_restored:true,
          semantic_equivalence_proven:false,storage_savings_claimed:false};
}

if (require.main === module) {
  try {
    if (process.argv.length !== 3) throw new Error('one_explicit_input_required');
    const fd = fs.openSync(process.argv[2], 'r');
    let bytes;
    try { const size = fs.fstatSync(fd).size; if (size > 262144) throw new Error('input_limit'); bytes = fs.readFileSync(fd); }
    finally { fs.closeSync(fd); }
    if (bytes.length > 262144) throw new Error('input_limit');
    const input = JSON.parse(bytes);
    process.stdout.write(JSON.stringify(project(input.policy,input.observations),null,2) + '\n');
  } catch (_) { process.stderr.write('PROJECTION_REFUSED\n'); process.exitCode = 2; }
}
module.exports = {project,graphFor};
