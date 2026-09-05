'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const adapter = require('./adapter.js');
const cp = require('../../circumstantial-provenance/v0.1/validate-circumstantial-provenance.js');
const rerc = require('../../rerc/v0.1/rerc.js');

const fixturePath = path.join(__dirname, '../../circumstantial-provenance/v0.1/fixture.json');
const load = () => JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
function mustFail(fn, pattern, label) {
  let failed = false;
  try { fn(); } catch (err) {
    failed = true;
    if (pattern) assert.match(String(err.message || err), pattern, label);
  }
  if (!failed) throw new Error(`expected failure: ${label}`);
}
function walkKeys(value, out = []) {
  if (Array.isArray(value)) value.forEach(v => walkKeys(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) { out.push(k); walkKeys(v, out); }
  }
  return out;
}

const base = load();
cp.validate(base);

// 1. Accepted source fixture projects to four evidence relations plus one protective gap.
{
  const graph = adapter.projectAssessment(base);
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 5);
  rerc.validateGraph(graph);
}

// 2. Only the declared derived-copy relation is an adapter suppression candidate.
{
  const candidates = adapter.deriveSuppressionCandidates(base);
  assert.deepEqual(candidates, ['relation:ev-copy']);
}

// 3. Canonical compression directly reuses RERC and suppresses only ev-copy relation.
const canonical = adapter.compressAssessment({ assessment: base, request_id: 'cp-rerc-test-001' });
{
  assert.deepEqual(canonical.rerc_receipt.suppressed_edge_ids, ['relation:ev-copy']);
  assert.deepEqual(canonical.adapter_receipt.suppressed_relation_evidence_ids, ['ev-copy']);
  assert.equal(canonical.adapter_receipt.direct_rerc_reuse, true);
  rerc.validateReceipt(canonical.rerc_receipt);
  adapter.validateAdapterReceipt(canonical.adapter_receipt);
}

// 4. Independent support remains operationally visible.
for (const id of ['ev-direct', 'ev-witness']) {
  assert(canonical.operational_graph.edges.some(e => e.edge_id === `relation:${id}`), `${id} support missing`);
  assert(canonical.adapter_receipt.retained_evidence_ids.includes(id));
}

// 5. Contradiction is protective and retained.
{
  const edge = canonical.observed_graph.edges.find(e => e.edge_id === 'relation:ev-contradiction');
  assert.equal(edge.redundancy_class, 'PROTECTIVE');
  assert(canonical.operational_graph.edges.some(e => e.edge_id === edge.edge_id));
  assert(canonical.adapter_receipt.protective_evidence_ids.includes('ev-contradiction'));
}

// 6. Explicit lineage gap becomes a protective edge and is retained.
{
  const edge = canonical.observed_graph.edges.find(e => e.edge_id === 'lineage-gap:gap-1');
  assert(edge);
  assert.equal(edge.redundancy_class, 'PROTECTIVE');
  assert(canonical.operational_graph.edges.some(e => e.edge_id === edge.edge_id));
  assert.deepEqual(canonical.adapter_receipt.lineage_gap_ids, ['gap-1']);
}

// 7. full_payload_required makes even a derived copy protective/non-suppressible.
{
  const x = load();
  x.evidence_items.find(e => e.evidence_id === 'ev-copy').full_payload_required = true;
  cp.validate(x);
  assert.deepEqual(adapter.deriveSuppressionCandidates(x), []);
  const out = adapter.compressAssessment({ assessment: x, request_id: 'full-payload' });
  assert.deepEqual(out.rerc_receipt.suppressed_edge_ids, []);
  assert(out.adapter_receipt.protective_evidence_ids.includes('ev-copy'));
}

// 8. A contradictory derived copy is protective/non-suppressible.
{
  const x = load();
  x.evidence_items.find(e => e.evidence_id === 'ev-copy').relation = 'contradicts';
  x.result = cp.deriveResult(x);
  cp.validate(x);
  assert.deepEqual(adapter.deriveSuppressionCandidates(x), []);
  const edge = adapter.projectAssessment(x).edges.find(e => e.edge_id === 'relation:ev-copy');
  assert.equal(edge.redundancy_class, 'PROTECTIVE');
}

// 9. Adapter rejects a cross-independence-group dependency even if the base validator's first dependency is valid.
{
  const x = load();
  x.evidence_items.find(e => e.evidence_id === 'ev-copy').dependency_refs = ['ev-direct', 'ev-witness'];
  cp.validate(x);
  mustFail(() => adapter.projectAssessment(x), /crosses independence groups/, 'cross-group derived dependency');
}

// 10. Derived copy without dependency remains rejected by accepted Circumstantial Provenance validation.
{
  const x = load();
  x.evidence_items.find(e => e.evidence_id === 'ev-copy').dependency_refs = [];
  mustFail(() => adapter.projectAssessment(x), /derived copy dependency required|no dependency/, 'dependency-free copy');
}

// 11. Source assessment is not mutated.
{
  const x = load();
  const before = JSON.stringify(x);
  adapter.compressAssessment({ assessment: x, request_id: 'immutable-source' });
  assert.equal(JSON.stringify(x), before);
}

// 12. RERC exact restoration equals a fresh projection from the unchanged assessment.
{
  const restored = adapter.restoreAndVerify(base, canonical.operational_graph, canonical.rerc_receipt);
  const fresh = adapter.projectAssessment(base);
  assert.equal(rerc.digest(restored), rerc.digest(fresh));
  assert.equal(rerc.digest(restored), canonical.adapter_receipt.projected_observed_graph_digest);
}

// 13. Adapter result never changes the source Circumstantial Provenance assessment result.
assert.equal(canonical.adapter_receipt.source_assessment_result, 'partially_supported');
assert.equal(base.result, 'partially_supported');

// 14. Adapter policy does not expose independent support as a suppression candidate.
{
  const candidates = new Set(canonical.adapter_receipt.suppression_candidate_edge_ids);
  assert.equal(candidates.has('relation:ev-direct'), false);
  assert.equal(candidates.has('relation:ev-witness'), false);
  assert.equal(candidates.has('relation:ev-contradiction'), false);
  assert.equal(candidates.has('lineage-gap:gap-1'), false);
}

// 15. RERC itself refuses direct suppression of the protective contradiction.
mustFail(
  () => rerc.compressGraph({ observed_graph: canonical.observed_graph, suppress_edge_ids: ['relation:ev-contradiction'], request_id: 'hostile-contradiction' }),
  /protective redundancy cannot be suppressed/,
  'protective contradiction suppression'
);

// 16. RERC itself refuses direct suppression of the protective lineage gap.
mustFail(
  () => rerc.compressGraph({ observed_graph: canonical.observed_graph, suppress_edge_ids: ['lineage-gap:gap-1'], request_id: 'hostile-gap' }),
  /protective redundancy cannot be suppressed/,
  'protective gap suppression'
);

// 17. A same-group all-derived cycle does not become suppressible merely because it is grouped together.
{
  const x = load();
  const direct = x.evidence_items.find(e => e.evidence_id === 'ev-direct');
  direct.origin_class = 'derived_copy';
  direct.dependency_refs = ['ev-copy'];
  x.result = cp.deriveResult(x);
  cp.validate(x);
  assert.deepEqual(adapter.deriveSuppressionCandidates(x), []);
}

// 18. Deterministic projection/compression for the same request.
{
  const a = adapter.compressAssessment({ assessment: load(), request_id: 'deterministic' });
  const b = adapter.compressAssessment({ assessment: load(), request_id: 'deterministic' });
  assert.equal(rerc.digest(a.observed_graph), rerc.digest(b.observed_graph));
  assert.equal(rerc.digest(a.operational_graph), rerc.digest(b.operational_graph));
  assert.deepEqual(a.adapter_receipt, b.adapter_receipt);
}

// 19. No aggregate score / confidence / ranking surface is introduced.
{
  const forbidden = new Set(['score','trust_score','independence_score','redundancy_score','confidence','probability','rating','rank','percentage']);
  const keys = walkKeys(canonical);
  assert.equal(keys.some(k => forbidden.has(k)), false);
}

// 20. All semantic escalation/non-effect claims remain false.
for (const [key, value] of Object.entries(canonical.adapter_receipt.claims)) {
  assert.equal(value, false, `claim ${key} escalated`);
}

// 21. Receipt validation rejects any attempt to claim equivalence or authority.
{
  const x = clone(canonical.adapter_receipt);
  x.claims.redundancy_group_proves_equivalence = true;
  mustFail(() => adapter.validateAdapterReceipt(x), /unsafe claim/, 'equivalence promotion');
}
{
  const x = clone(canonical.adapter_receipt);
  x.claims.authority_created = true;
  mustFail(() => adapter.validateAdapterReceipt(x), /unsafe claim/, 'authority promotion');
}

// 22. Receipt validation rejects scalar score injection.
{
  const x = clone(canonical.adapter_receipt);
  x.trust_score = 0.9;
  mustFail(() => adapter.validateAdapterReceipt(x), /unknown field/, 'score injection');
}

// 23. Source commitment changes alter the projected graph/source binding rather than being silently normalized.
{
  const x = load();
  x.evidence_items.find(e => e.evidence_id === 'ev-copy').commitment_ref = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  cp.validate(x);
  assert.notEqual(rerc.digest(adapter.projectAssessment(x)), rerc.digest(adapter.projectAssessment(base)));
}

console.log('CIRCUMSTANTIAL_PROVENANCE_RERC_ADAPTER_V0_1: 23/23 PASS');
