'use strict';

const crypto = require('node:crypto');
const cp = require('../../circumstantial-provenance/v0.1/validate-circumstantial-provenance.js');
const rerc = require('../../rerc/v0.1/rerc.js');

function fail(message) { throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
function sha256(value) { return crypto.createHash('sha256').update(canonical(value)).digest('hex'); }

const FALSE_CLAIMS = Object.freeze({
  independent_evidence_suppressed: false,
  contradiction_suppressed: false,
  protective_evidence_suppressed: false,
  lineage_gap_suppressed: false,
  provenance_deleted: false,
  copied_evidence_counted_independent: false,
  redundancy_group_proves_equivalence: false,
  authority_created: false,
  truth_certified: false,
  identity_proven: false,
  causality_proven: false,
  responsibility_assigned: false,
  liability_assigned: false,
  canonical_verdict_created: false,
  rsic_composition_required: false,
});

function evidenceById(assessment) {
  return new Map(assessment.evidence_items.map(item => [item.evidence_id, item]));
}

function validateAdapterEligibility(assessment) {
  cp.validate(assessment);
  const byId = evidenceById(assessment);
  for (const item of assessment.evidence_items) {
    if (item.origin_class !== 'derived_copy') continue;
    if (item.dependency_refs.length === 0) fail(`derived copy ${item.evidence_id} has no dependency`);
    for (const ref of item.dependency_refs) {
      const upstream = byId.get(ref);
      if (!upstream) fail(`derived copy ${item.evidence_id} dependency missing: ${ref}`);
      if (upstream.independence_group !== item.independence_group) {
        fail(`derived copy ${item.evidence_id} crosses independence groups`);
      }
    }
  }
  return true;
}

function relationClass(item) {
  if (item.relation === 'contradicts' || item.full_payload_required === true) return 'PROTECTIVE';
  if (item.origin_class === 'derived_copy') return 'REPRESENTATIONAL';
  return 'EVIDENTIARY';
}

function projectAssessment(assessment) {
  validateAdapterEligibility(assessment);
  const sourceDigest = sha256(assessment);
  const claimNodeId = `claim:${assessment.assessment_id}`;
  const nodes = [{
    node_id: claimNodeId,
    kind: 'circumstantial_claim_target',
    evidence_refs: [`assessment:${assessment.assessment_id}`, `claim:${assessment.claim_target}`, `sha256:${sourceDigest}`],
  }];

  for (const item of assessment.evidence_items) {
    nodes.push({
      node_id: `evidence:${item.evidence_id}`,
      kind: `circumstantial_${item.origin_class}`,
      evidence_refs: [`evidence:${item.evidence_id}`, item.commitment_ref],
    });
  }

  const edges = assessment.evidence_items.map(item => ({
    edge_id: `relation:${item.evidence_id}`,
    from: `evidence:${item.evidence_id}`,
    to: claimNodeId,
    relation_type: `CP_${item.relation.toUpperCase()}`,
    redundancy_class: relationClass(item),
    redundancy_group: `cp-independence:${item.independence_group}`,
    evidence_refs: [
      `evidence:${item.evidence_id}`,
      item.commitment_ref,
      ...item.dependency_refs.map(ref => `depends:${ref}`),
    ],
    ontological_status: 'OBSERVED_RELATION',
  }));

  for (const gap of assessment.lineage_gaps) {
    edges.push({
      edge_id: `lineage-gap:${gap.gap_id}`,
      from: `evidence:${gap.between_refs[0]}`,
      to: `evidence:${gap.between_refs[1]}`,
      relation_type: 'CP_EXPLICIT_UNRESOLVED_LINEAGE_GAP',
      redundancy_class: 'PROTECTIVE',
      redundancy_group: `cp-lineage-gap:${gap.gap_id}`,
      evidence_refs: [`gap:${gap.gap_id}`, ...gap.between_refs.map(ref => `evidence:${ref}`)],
      ontological_status: 'OBSERVED_RELATION',
    });
  }

  const graph = {
    artifact_type: 'RERCRelationGraph',
    version: '0.1',
    graph_kind: 'OBSERVED',
    graph_id: `circumstantial-provenance:${assessment.assessment_id}`,
    nodes,
    edges,
    source_graph_digest: null,
    claims: { authority_created: false, facts_created: false, evidence_deleted: false, relations_invalidated: false },
  };
  rerc.validateGraph(graph);
  return graph;
}

function deriveSuppressionCandidates(assessment, graph = projectAssessment(assessment)) {
  validateAdapterEligibility(assessment);
  rerc.validateGraph(graph);
  const byGroup = new Map();
  for (const edge of graph.edges) {
    if (!byGroup.has(edge.redundancy_group)) byGroup.set(edge.redundancy_group, []);
    byGroup.get(edge.redundancy_group).push(edge);
  }

  const candidates = [];
  for (const item of assessment.evidence_items) {
    const edgeId = `relation:${item.evidence_id}`;
    const edge = graph.edges.find(e => e.edge_id === edgeId);
    if (!edge) fail(`projected edge missing for ${item.evidence_id}`);
    if (item.origin_class !== 'derived_copy') continue;
    if (item.relation === 'contradicts' || item.full_payload_required === true) continue;
    if (edge.redundancy_class !== 'REPRESENTATIONAL') fail(`derived copy ${item.evidence_id} is not representational`);
    const peers = byGroup.get(edge.redundancy_group) || [];
    const retainedBasePeer = peers.some(peer => {
      if (peer.edge_id === edge.edge_id || !peer.edge_id.startsWith('relation:')) return false;
      const peerId = peer.edge_id.slice('relation:'.length);
      const peerItem = assessment.evidence_items.find(x => x.evidence_id === peerId);
      return peerItem && peerItem.origin_class !== 'derived_copy';
    });
    if (retainedBasePeer) candidates.push(edgeId);
  }
  return candidates;
}

function validateAdapterReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) fail('adapter receipt required');
  const expected = new Set([
    'artifact_type','version','request_id','assessment_id','source_assessment_digest','source_assessment_result',
    'projected_observed_graph_digest','operational_graph_digest','rerc_receipt_digest','suppression_candidate_edge_ids',
    'suppressed_relation_evidence_ids','retained_evidence_ids','protective_evidence_ids','lineage_gap_ids',
    'direct_rerc_reuse','source_assessment_unchanged','exact_projection_restore_verified','claims'
  ]);
  for (const key of Object.keys(receipt)) if (!expected.has(key)) fail(`adapter receipt unknown field ${key}`);
  if (receipt.artifact_type !== 'CircumstantialProvenanceRERCAdapterReceipt' || receipt.version !== '0.1') fail('adapter receipt identity');
  for (const key of ['request_id','assessment_id','source_assessment_result']) if (typeof receipt[key] !== 'string' || !receipt[key]) fail(`${key} required`);
  for (const key of ['source_assessment_digest','projected_observed_graph_digest','operational_graph_digest','rerc_receipt_digest']) {
    if (!/^[0-9a-f]{64}$/.test(receipt[key] || '')) fail(`${key} invalid`);
  }
  for (const key of ['suppression_candidate_edge_ids','suppressed_relation_evidence_ids','retained_evidence_ids','protective_evidence_ids','lineage_gap_ids']) {
    if (!Array.isArray(receipt[key]) || receipt[key].some(v => typeof v !== 'string' || !v) || new Set(receipt[key]).size !== receipt[key].length) fail(`${key} invalid`);
  }
  if (receipt.direct_rerc_reuse !== true || receipt.source_assessment_unchanged !== true || receipt.exact_projection_restore_verified !== true) fail('adapter proof flags invalid');
  if (!receipt.claims || typeof receipt.claims !== 'object' || Array.isArray(receipt.claims)) fail('claims required');
  if (JSON.stringify(Object.keys(receipt.claims).sort()) !== JSON.stringify(Object.keys(FALSE_CLAIMS).sort())) fail('claims shape invalid');
  for (const [key, value] of Object.entries(FALSE_CLAIMS)) if (receipt.claims[key] !== value) fail(`unsafe claim ${key}`);
  return true;
}

function restoreAndVerify(assessment, operationalGraph, rercReceipt) {
  validateAdapterEligibility(assessment);
  const expected = projectAssessment(assessment);
  const restored = rerc.restoreGraph(operationalGraph, rercReceipt);
  if (rerc.digest(restored) !== rerc.digest(expected)) fail('restored projection does not match exact assessment projection');
  return restored;
}

function compressAssessment({ assessment, request_id }) {
  if (typeof request_id !== 'string' || !request_id) fail('request_id required');
  validateAdapterEligibility(assessment);
  const before = sha256(assessment);
  const observedGraph = projectAssessment(assessment);
  const candidates = deriveSuppressionCandidates(assessment, observedGraph);
  const { operational_graph, receipt: rercReceipt } = rerc.compressGraph({
    observed_graph: observedGraph,
    suppress_edge_ids: candidates,
    request_id,
  });
  rerc.validateReceipt(rercReceipt);
  const restored = restoreAndVerify(assessment, operational_graph, rercReceipt);
  const after = sha256(assessment);
  if (before !== after) fail('source assessment mutated');

  const suppressedEvidenceIds = rercReceipt.suppressed_edge_ids
    .filter(id => id.startsWith('relation:'))
    .map(id => id.slice('relation:'.length));
  const suppressedSet = new Set(suppressedEvidenceIds);
  const protectiveEvidenceIds = assessment.evidence_items
    .filter(item => relationClass(item) === 'PROTECTIVE')
    .map(item => item.evidence_id);
  const retainedEvidenceIds = assessment.evidence_items
    .map(item => item.evidence_id)
    .filter(id => !suppressedSet.has(id));

  const adapterReceipt = {
    artifact_type: 'CircumstantialProvenanceRERCAdapterReceipt',
    version: '0.1',
    request_id,
    assessment_id: assessment.assessment_id,
    source_assessment_digest: before,
    source_assessment_result: assessment.result,
    projected_observed_graph_digest: rerc.digest(observedGraph),
    operational_graph_digest: rerc.digest(operational_graph),
    rerc_receipt_digest: rerc.digest(rercReceipt),
    suppression_candidate_edge_ids: [...candidates],
    suppressed_relation_evidence_ids: suppressedEvidenceIds,
    retained_evidence_ids: retainedEvidenceIds,
    protective_evidence_ids: protectiveEvidenceIds,
    lineage_gap_ids: assessment.lineage_gaps.map(g => g.gap_id),
    direct_rerc_reuse: true,
    source_assessment_unchanged: true,
    exact_projection_restore_verified: rerc.digest(restored) === rerc.digest(observedGraph),
    claims: { ...FALSE_CLAIMS },
  };
  validateAdapterReceipt(adapterReceipt);
  return { observed_graph: observedGraph, operational_graph, rerc_receipt: rercReceipt, adapter_receipt: adapterReceipt };
}

module.exports = {
  projectAssessment,
  deriveSuppressionCandidates,
  compressAssessment,
  restoreAndVerify,
  validateAdapterEligibility,
  validateAdapterReceipt,
  sha256,
};
