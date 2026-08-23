'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const SUPPORT = new Set(['supported', 'contradicted', 'mixed', 'insufficient', 'not_tested']);
const KINDS = new Set([
  'originating_execution_contributed',
  'alternative_local_cause_contributed',
  'insufficient_evidence_for_broader_causality'
]);
const SCALAR_KEYS = new Set(['score','probability','percentage','weight','likelihood','confidence_score','causal_score','responsibility_score','rating']);
const FALSE_CLAIMS = [
  'generalized_external_consequence_causality_established','causal_proof_certified','exclusive_cause_established',
  'necessary_cause_established','sufficient_cause_established','counterfactual_causality_established',
  'responsibility_for_outcome_adjudicated','legal_responsibility_determined','legal_effect_established',
  'moral_blame_assigned','moral_correctness_established','truth_certified',
  'remote_branch_or_ref_canonicality_established','poai_materialization_event_recorded',
  'poai_successor_record_identity_inferred','universal_canonicality_established','poai_v_conformance_established'
];

function assert(v, m) { if (!v) throw new Error(m); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function uniq(v) { return [...new Set((Array.isArray(v) ? v : []).filter(x => typeof x === 'string' && x))].sort(); }
function sameArray(a,b) { return a.length === b.length && a.every((x,i) => x === b[i]); }
function baseRevision(v) { return v.base_revision || (v.predecessor && v.predecessor.revision) || null; }
function semantics(v) { return [v.action, v.target, v.operation_ref, baseRevision(v), v.responsible_party_id, v.executor_implementation_id]; }
function sameSemantic(a,b) { const x=semantics(a), y=semantics(b); return x.every((v,i)=>v===y[i]); }
function hasScalarKey(v) {
  if (!v || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some(hasScalarKey);
  return Object.entries(v).some(([k,x]) => SCALAR_KEYS.has(k) || hasScalarKey(x));
}
async function digestJson(v) { return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(v, '$'))); }
function digest(v) { return { canonicalization:'RFC8785-JCS', digest_algorithm:'SHA-256', digest_encoding:'hex', value:v }; }
async function binding(type, ref, artifact) { return { artifact_type:type, artifact_ref:ref, digest:digest(await digestJson(artifact)) }; }
function assertFalseClaims(claims, keys, label) { for (const k of keys) assert(claims && claims[k] === false, `${label}: prohibited claim ${k}`); }
function inferSupportState(h) {
  const s=uniq(h.supporting_evidence_ids), c=uniq(h.contradicting_evidence_ids), x=uniq(h.context_evidence_ids), a=uniq(h.alternative_evidence_ids), g=uniq(h.unresolved_gaps);
  if (h.support_status === 'not_tested') return s.length+c.length+x.length+a.length === 0 ? 'not_tested' : 'invalid';
  if (s.length && c.length) return 'mixed';
  if (s.length) return 'supported';
  if (c.length) return 'contradicted';
  if (x.length || a.length || g.length) return 'insufficient';
  return 'invalid';
}
function artifactTime(v) {
  for (const k of ['recorded_at','observed_at','traced_at','completed_at']) if (typeof v[k] === 'string') return v[k];
  throw new Error('CausalAttributionAssessment: evidence source has no timestamp');
}
async function evidence(id, proposition, artifact, ref) {
  return { evidence_id:id, proposition, observed_at:artifactTime(artifact), source_binding:await binding(artifact.artifact_type, ref, artifact), truth_certified:false };
}

async function buildCausalAttributionAssessment({ responsibilityTrace, outcomeObservation, commitReceipt, hypotheses, assessedAt, evidenceCutoff }) {
  assert(responsibilityTrace && responsibilityTrace.artifact_type === 'ResponsibilityTrace', 'CausalAttributionAssessment: ResponsibilityTrace required');
  assert(outcomeObservation && outcomeObservation.artifact_type === 'OutcomeObservationReceipt', 'CausalAttributionAssessment: OutcomeObservationReceipt required');
  assert(commitReceipt && commitReceipt.artifact_type === 'CommitReceipt', 'CausalAttributionAssessment: CommitReceipt required');
  assert(responsibilityTrace.claims.responsibility_chain_traceable === true, 'CausalAttributionAssessment: responsibility chain must already be traceable');
  assert(responsibilityTrace.responsibility_attribution.status === 'traceable_not_adjudicated', 'CausalAttributionAssessment: responsibility predecessor must remain unadjudicated');
  assert(outcomeObservation.claims.exact_transition_effect_observed === true, 'CausalAttributionAssessment: exact transition effect must already be observed');
  assert(commitReceipt.claims.commit_performed === true, 'CausalAttributionAssessment: performed CommitReceipt required');
  assertFalseClaims(responsibilityTrace.claims, ['external_consequence_causality_established','causal_proof_certified','responsibility_for_outcome_adjudicated','legal_responsibility_determined','legal_effect_established','moral_blame_assigned','moral_correctness_established','truth_certified','remote_branch_or_ref_canonicality_established','poai_materialization_event_recorded','poai_successor_record_identity_inferred','universal_canonicality_established','poai_v_conformance_established'], 'ResponsibilityTrace');

  const outcomeDigest = await digestJson(outcomeObservation);
  assert(responsibilityTrace.outcome_observation_binding.artifact_ref === outcomeObservation.outcome_observation_id && responsibilityTrace.outcome_observation_binding.digest.value === outcomeDigest, 'CausalAttributionAssessment: ResponsibilityTrace/OutcomeObservation binding substitution');
  assert(sameSemantic(responsibilityTrace.semantic_binding, outcomeObservation.semantic_binding), 'CausalAttributionAssessment: predecessor semantic binding drift');
  assert(sameSemantic(responsibilityTrace.semantic_binding, commitReceipt), 'CausalAttributionAssessment: CommitReceipt semantic binding drift');

  const effect = outcomeObservation.observed_state;
  assert(commitReceipt.successor.revision === effect.revision && commitReceipt.successor.commit_sha === effect.commit_sha && commitReceipt.successor.tree_sha === effect.tree_sha, 'CausalAttributionAssessment: CommitReceipt/effect frontier substitution');
  assert(sameArray(uniq(commitReceipt.effect.changed_paths), uniq(effect.changed_paths)), 'CausalAttributionAssessment: CommitReceipt/effect path substitution');

  const assessedMs=Date.parse(assessedAt), cutoffMs=Date.parse(evidenceCutoff);
  assert(Number.isFinite(assessedMs) && Number.isFinite(cutoffMs) && cutoffMs <= assessedMs, 'CausalAttributionAssessment: evidence cutoff must not be later than assessed_at');
  assert(assessedMs > Date.parse(responsibilityTrace.traced_at), 'CausalAttributionAssessment: assessment must occur after ResponsibilityTrace');

  const catalog = [
    await evidence('ev:commit-performed','approved_execution_created_successor_transition',commitReceipt,commitReceipt.receipt_id),
    await evidence('ev:exact-effect-observed','exact_local_transition_effect_observed',outcomeObservation,outcomeObservation.outcome_observation_id),
    await evidence('ev:responsibility-trace','accepted_responsibility_chain_is_traceable_not_adjudicated',responsibilityTrace,responsibilityTrace.trace_id),
    await evidence('ev:alternatives-unassessed','alternative_causes_remain_unassessed_beyond_transition',responsibilityTrace,responsibilityTrace.trace_id),
    await evidence('ev:external-consequence-unobserved','no_external_consequence_is_established_by_predecessor_observation',outcomeObservation,outcomeObservation.outcome_observation_id)
  ];
  for (const e of catalog) assert(Date.parse(e.observed_at) <= cutoffMs, `CausalAttributionAssessment: evidence ${e.evidence_id} is later than evidence cutoff`);
  const evidenceIds = new Set(catalog.map(e=>e.evidence_id));

  assert(Array.isArray(hypotheses) && hypotheses.length >= 3, 'CausalAttributionAssessment: at least three competing hypotheses required');
  const hs = hypotheses.map(h => ({
    hypothesis_id:h.hypothesis_id, kind:h.kind, statement:h.statement, support_status:h.support_status,
    supporting_evidence_ids:uniq(h.supporting_evidence_ids), contradicting_evidence_ids:uniq(h.contradicting_evidence_ids),
    context_evidence_ids:uniq(h.context_evidence_ids), alternative_evidence_ids:uniq(h.alternative_evidence_ids),
    unresolved_gaps:uniq(h.unresolved_gaps), establishes_causal_proof:false
  }));
  assert(new Set(hs.map(h=>h.hypothesis_id)).size === hs.length, 'CausalAttributionAssessment: duplicate hypothesis IDs');
  const kinds=new Set(hs.map(h=>h.kind)); for (const k of KINDS) assert(kinds.has(k), `CausalAttributionAssessment: missing required hypothesis ${k}`);
  for (const h of hs) {
    assert(typeof h.hypothesis_id === 'string' && h.hypothesis_id.startsWith('urn:uu-aap:causal-hypothesis:'), 'CausalAttributionAssessment: invalid hypothesis ID');
    assert(KINDS.has(h.kind) && SUPPORT.has(h.support_status) && typeof h.statement === 'string' && h.statement.length > 0, 'CausalAttributionAssessment: invalid hypothesis');
    for (const id of [...h.supporting_evidence_ids,...h.contradicting_evidence_ids,...h.context_evidence_ids,...h.alternative_evidence_ids]) assert(evidenceIds.has(id), `CausalAttributionAssessment: unknown evidence ${id}`);
    const inferred=inferSupportState(h); assert(inferred===h.support_status, `CausalAttributionAssessment: support-state substitution for ${h.hypothesis_id}; expected ${inferred}`);
  }
  const origin=hs.find(h=>h.kind==='originating_execution_contributed'), broader=hs.find(h=>h.kind==='insufficient_evidence_for_broader_causality');
  assert(origin.support_status==='supported', 'CausalAttributionAssessment: originating execution must be supported within bounded transition mechanism');
  assert(broader.support_status==='supported', 'CausalAttributionAssessment: broader-causality insufficiency must remain supported');

  const traceDigest=await digestJson(responsibilityTrace), commitDigest=await digestJson(commitReceipt), hsDigest=await digestJson(hs);
  const idHash=await Binding.sha256Hex(Binding.utf8Bytes(`${traceDigest}|${outcomeDigest}|${commitDigest}|${hsDigest}|${evidenceCutoff}|${assessedAt}`));
  const assessment = {
    $schema:'./causal-attribution.schema.json', artifact_type:'CausalAttributionAssessment', artifact_version:'0.1',
    assessment_id:`urn:uu-aap:causal-attribution-assessment:${idHash.slice(0,24)}`, assessed_at:assessedAt,
    predecessor_bindings:{
      responsibility_trace:await binding('ResponsibilityTrace',responsibilityTrace.trace_id,responsibilityTrace),
      outcome_observation:await binding('OutcomeObservationReceipt',outcomeObservation.outcome_observation_id,outcomeObservation),
      commit_receipt:await binding('CommitReceipt',commitReceipt.receipt_id,commitReceipt)
    },
    semantic_binding:clone(responsibilityTrace.semantic_binding),
    effect_under_assessment:{ scope:'exact_local_git_transition_effect', relation:'exact_state_transition_effect', revision:effect.revision, commit_sha:effect.commit_sha, tree_sha:effect.tree_sha, changed_paths:uniq(effect.changed_paths), effect_objects:clone(effect.effect_objects) },
    evidence_horizon:{ evidence_cutoff:evidenceCutoff, later_evidence_admitted:false },
    evidence_catalog:catalog,
    hypotheses:hs,
    assessment_result:{ status:'bounded_association_supported_with_unresolved_alternatives', causal_scope:'bounded_transition_mechanism_only', alternatives_considered:true, winner_selected:false, uncertainty_status:'material_uncertainty_preserved', causal_proof_established:false },
    verification:{ responsibility_trace_exact:true, outcome_observation_exact:true, commit_receipt_exact:true, semantic_binding_exact:true, effect_frontier_exact:true, evidence_horizon_enforced:true, competing_hypotheses_present:true, alternatives_explicitly_considered:true, support_states_evidence_consistent:true, scalar_scoring_absent:true, predecessor_assurance_not_upgraded:true },
    claims:{
      predecessor_responsibility_trace_verified:true, causal_hypotheses_evaluated:true, evidence_horizon_fixed:true, evidence_classified:true,
      alternatives_explicitly_considered:true, bounded_transition_mechanism_association_supported:true, uncertainty_explicitly_preserved:true,
      generalized_external_consequence_causality_established:false, causal_proof_certified:false, exclusive_cause_established:false,
      necessary_cause_established:false, sufficient_cause_established:false, counterfactual_causality_established:false,
      responsibility_for_outcome_adjudicated:false, legal_responsibility_determined:false, legal_effect_established:false,
      moral_blame_assigned:false, moral_correctness_established:false, truth_certified:false,
      remote_branch_or_ref_canonicality_established:false, poai_materialization_event_recorded:false,
      poai_successor_record_identity_inferred:false, universal_canonicality_established:false, poai_v_conformance_established:false
    }
  };
  await validateCausalAttributionAssessment({ assessment, responsibilityTrace, outcomeObservation, commitReceipt });
  return assessment;
}

async function validateCausalAttributionAssessment({ assessment, responsibilityTrace, outcomeObservation, commitReceipt }) {
  assert(assessment && assessment.artifact_type==='CausalAttributionAssessment' && assessment.artifact_version==='0.1', 'CausalAttributionAssessment: invalid assessment artifact');
  assert(!hasScalarKey(assessment), 'CausalAttributionAssessment: scalar probability/score fields are prohibited in v0.1');
  assertFalseClaims(assessment.claims,FALSE_CLAIMS,'CausalAttributionAssessment');
  assert(assessment.assessment_result.causal_proof_established===false && assessment.assessment_result.winner_selected===false, 'CausalAttributionAssessment: result must remain non-certifying and non-exclusive');
  const cutoffMs=Date.parse(assessment.evidence_horizon.evidence_cutoff), assessedMs=Date.parse(assessment.assessed_at);
  assert(Number.isFinite(cutoffMs)&&Number.isFinite(assessedMs)&&cutoffMs<=assessedMs, 'CausalAttributionAssessment: evidence cutoff must not be later than assessed_at');
  assert(assessment.evidence_horizon.later_evidence_admitted===false, 'CausalAttributionAssessment: later evidence must not be silently admitted');

  const expected={
    responsibility_trace:await binding('ResponsibilityTrace',responsibilityTrace.trace_id,responsibilityTrace),
    outcome_observation:await binding('OutcomeObservationReceipt',outcomeObservation.outcome_observation_id,outcomeObservation),
    commit_receipt:await binding('CommitReceipt',commitReceipt.receipt_id,commitReceipt)
  };
  for (const [k,v] of Object.entries(expected)) {
    const a=assessment.predecessor_bindings[k];
    assert(a.artifact_ref===v.artifact_ref,`CausalAttributionAssessment: predecessor ${k} ref substitution`);
    assert(a.digest.value===v.digest.value,`CausalAttributionAssessment: predecessor ${k} digest substitution`);
  }
  assert(sameSemantic(assessment.semantic_binding,responsibilityTrace.semantic_binding)&&sameSemantic(assessment.semantic_binding,outcomeObservation.semantic_binding)&&sameSemantic(assessment.semantic_binding,commitReceipt),'CausalAttributionAssessment: semantic binding drift');
  const e=assessment.effect_under_assessment,o=outcomeObservation.observed_state;
  assert(e.scope==='exact_local_git_transition_effect'&&e.relation==='exact_state_transition_effect','CausalAttributionAssessment: effect scope/relation substitution');
  assert(e.revision===o.revision&&e.commit_sha===o.commit_sha&&e.tree_sha===o.tree_sha,'CausalAttributionAssessment: effect frontier substitution');
  assert(sameArray(uniq(e.changed_paths),uniq(o.changed_paths)),'CausalAttributionAssessment: effect path substitution');
  assert(await digestJson(e.effect_objects)===await digestJson(o.effect_objects),'CausalAttributionAssessment: effect object substitution');

  const map=new Map(assessment.evidence_catalog.map(x=>[x.evidence_id,x]));
  assert(map.size===assessment.evidence_catalog.length,'CausalAttributionAssessment: duplicate evidence IDs');
  for (const x of assessment.evidence_catalog) {
    assert(Date.parse(x.observed_at)<=cutoffMs,`CausalAttributionAssessment: evidence ${x.evidence_id} is later than evidence cutoff`);
    assert(x.truth_certified===false,'CausalAttributionAssessment: evidence item must not certify truth');
  }
  const ids=assessment.hypotheses.map(h=>h.hypothesis_id); assert(new Set(ids).size===ids.length,'CausalAttributionAssessment: duplicate hypothesis IDs');
  const kinds=new Set(assessment.hypotheses.map(h=>h.kind)); for(const k of KINDS) assert(kinds.has(k),`CausalAttributionAssessment: missing required hypothesis ${k}`);
  for (const h of assessment.hypotheses) {
    for (const id of [...h.supporting_evidence_ids,...h.contradicting_evidence_ids,...h.context_evidence_ids,...h.alternative_evidence_ids]) assert(map.has(id),`CausalAttributionAssessment: unknown evidence ${id}`);
    const inferred=inferSupportState(h); assert(inferred===h.support_status,`CausalAttributionAssessment: support-state substitution for ${h.hypothesis_id}; expected ${inferred}`);
    assert(h.establishes_causal_proof===false,'CausalAttributionAssessment: hypothesis cannot certify causal proof');
  }
  assert(assessment.assessment_result.alternatives_considered===true&&assessment.hypotheses.some(h=>h.kind==='alternative_local_cause_contributed'),'CausalAttributionAssessment: alternatives_considered without explicit alternative hypothesis');
  assert(assessment.assessment_result.status==='bounded_association_supported_with_unresolved_alternatives'&&assessment.assessment_result.causal_scope==='bounded_transition_mechanism_only'&&assessment.assessment_result.uncertainty_status==='material_uncertainty_preserved','CausalAttributionAssessment: causal/uncertainty boundary substitution');
  return true;
}

module.exports={ digestJson, buildCausalAttributionAssessment, validateCausalAttributionAssessment, inferSupportState };
