'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { buildCausalAttributionAssessment, validateCausalAttributionAssessment } = require('./assess-causality.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(v,m){ if(!v) throw new Error(m); }
function clone(v){ return JSON.parse(JSON.stringify(v)); }
function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }

function runResponsibilityTrace(tracePath,outcomePath,completionPath){
  const run=cp.spawnSync('node',[
    'protocols/integration/v0.1/test-outcome-responsibility.js',tracePath,outcomePath,completionPath
  ],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(run.error) throw run.error;
  assert(run.status===0,`responsibility trace prerequisite failed\n${run.stdout||''}\n${run.stderr||''}`);
}
async function reject(name,fn,pattern){
  let error=null; try{ await fn(); }catch(e){ error=e; }
  assert(error,`${name}: expected failure`);
  if(pattern) assert(pattern.test(error.message),`${name}: unexpected error: ${error.message}`);
  return {name,error:error.message};
}

const hypotheses = [
  {
    hypothesis_id:'urn:uu-aap:causal-hypothesis:originating-execution-contributed',
    kind:'originating_execution_contributed',
    statement:'The approved execution lineage contributed to the exact observed local Git transition effect.',
    support_status:'supported',
    supporting_evidence_ids:['ev:commit-performed','ev:exact-effect-observed'],
    contradicting_evidence_ids:[],
    context_evidence_ids:['ev:responsibility-trace'],
    alternative_evidence_ids:['ev:alternatives-unassessed'],
    unresolved_gaps:['no_counterfactual_test_of_transition_mechanism']
  },
  {
    hypothesis_id:'urn:uu-aap:causal-hypothesis:alternative-local-cause-contributed',
    kind:'alternative_local_cause_contributed',
    statement:'Another local mechanism could have contributed to or reproduced the observed effect.',
    support_status:'insufficient',
    supporting_evidence_ids:[],
    contradicting_evidence_ids:[],
    context_evidence_ids:['ev:alternatives-unassessed'],
    alternative_evidence_ids:[],
    unresolved_gaps:['no_independent_evidence_of_an_alternative_local_mechanism']
  },
  {
    hypothesis_id:'urn:uu-aap:causal-hypothesis:insufficient-broader-causality',
    kind:'insufficient_evidence_for_broader_causality',
    statement:'Available evidence is insufficient to infer consequences beyond the exact local transition.',
    support_status:'supported',
    supporting_evidence_ids:['ev:external-consequence-unobserved','ev:alternatives-unassessed'],
    contradicting_evidence_ids:[],
    context_evidence_ids:[],
    alternative_evidence_ids:[],
    unresolved_gaps:['no_external_consequence_model','no_counterfactual_or_intervention_evidence']
  }
];

async function main(){
  const assessmentPath=process.argv[2]||'/tmp/causal-attribution-assessment.json';
  const tracePath='/tmp/causal-responsibility-trace.json';
  const outcomePath='/tmp/causal-outcome-observation.json';
  const completionPath='/tmp/causal-provenance-completion.json';
  runResponsibilityTrace(tracePath,outcomePath,completionPath);

  const responsibilityTrace=readJson(tracePath);
  const outcomeObservation=readJson(outcomePath);
  const commitReceipt=readJson('/tmp/origin-commit.json');
  const args={
    responsibilityTrace,outcomeObservation,commitReceipt,hypotheses:clone(hypotheses),
    assessedAt:'2026-08-23T08:20:03Z', evidenceCutoff:'2026-08-23T08:20:02Z'
  };
  const assessment=await buildCausalAttributionAssessment(args);

  assert(assessment.assessment_result.status==='bounded_association_supported_with_unresolved_alternatives','assessment status mismatch');
  assert(assessment.assessment_result.causal_scope==='bounded_transition_mechanism_only','causal scope mismatch');
  assert(assessment.assessment_result.alternatives_considered===true,'alternatives must be considered');
  assert(assessment.assessment_result.winner_selected===false,'winner must not be selected');
  assert(assessment.assessment_result.uncertainty_status==='material_uncertainty_preserved','uncertainty must be preserved');
  assert(assessment.claims.bounded_transition_mechanism_association_supported===true,'bounded association must be supported');
  assert(assessment.claims.causal_proof_certified===false,'causal proof must remain false');
  assert(assessment.hypotheses.find(h=>h.kind==='originating_execution_contributed').support_status==='supported','origin hypothesis state mismatch');
  assert(assessment.hypotheses.find(h=>h.kind==='alternative_local_cause_contributed').support_status==='insufficient','alternative hypothesis state mismatch');
  assert(assessment.hypotheses.find(h=>h.kind==='insufficient_evidence_for_broader_causality').support_status==='supported','broader uncertainty state mismatch');

  const vectors=[];
  vectors.push(await reject('assessment_not_after_trace',async()=>{
    await buildCausalAttributionAssessment({...args,assessedAt:responsibilityTrace.traced_at,evidenceCutoff:responsibilityTrace.traced_at});
  },/after ResponsibilityTrace/));
  vectors.push(await reject('cutoff_after_assessment',async()=>{
    await buildCausalAttributionAssessment({...args,evidenceCutoff:'2026-08-23T08:20:04Z'});
  },/cutoff must not be later/));
  vectors.push(await reject('evidence_after_cutoff',async()=>{
    await buildCausalAttributionAssessment({...args,evidenceCutoff:'2026-08-23T08:20:00Z'});
  },/later than evidence cutoff/));
  vectors.push(await reject('duplicate_hypothesis_id',async()=>{
    const hs=clone(hypotheses); hs[1].hypothesis_id=hs[0].hypothesis_id;
    await buildCausalAttributionAssessment({...args,hypotheses:hs});
  },/duplicate hypothesis IDs/));
  vectors.push(await reject('support_state_substitution',async()=>{
    const hs=clone(hypotheses); hs[0].support_status='insufficient';
    await buildCausalAttributionAssessment({...args,hypotheses:hs});
  },/support-state substitution/));
  vectors.push(await reject('unknown_evidence',async()=>{
    const hs=clone(hypotheses); hs[0].supporting_evidence_ids.push('ev:unknown');
    await buildCausalAttributionAssessment({...args,hypotheses:hs});
  },/unknown evidence/));
  vectors.push(await reject('missing_alternative_hypothesis',async()=>{
    const hs=clone(hypotheses).filter(h=>h.kind!=='alternative_local_cause_contributed');
    hs.push({...clone(hypotheses[2]),hypothesis_id:'urn:uu-aap:causal-hypothesis:duplicate-kind'});
    await buildCausalAttributionAssessment({...args,hypotheses:hs});
  },/missing required hypothesis alternative_local_cause_contributed/));

  const validate=(a)=>validateCausalAttributionAssessment({assessment:a,responsibilityTrace,outcomeObservation,commitReceipt});
  vectors.push(await reject('trace_digest_substitution',async()=>{
    const a=clone(assessment); a.predecessor_bindings.responsibility_trace.digest.value='0'.repeat(64); await validate(a);
  },/responsibility_trace digest substitution/));
  vectors.push(await reject('outcome_ref_substitution',async()=>{
    const a=clone(assessment); a.predecessor_bindings.outcome_observation.artifact_ref='urn:uu-aap:outcome-observation:other'; await validate(a);
  },/outcome_observation ref substitution/));
  vectors.push(await reject('semantic_binding_drift',async()=>{
    const a=clone(assessment); a.semantic_binding.action='other.action'; await validate(a);
  },/semantic binding drift/));
  vectors.push(await reject('effect_revision_substitution',async()=>{
    const a=clone(assessment); a.effect_under_assessment.revision=`git:${'0'.repeat(40)}`; await validate(a);
  },/effect frontier substitution/));
  vectors.push(await reject('effect_path_substitution',async()=>{
    const a=clone(assessment); a.effect_under_assessment.changed_paths=['other/path']; await validate(a);
  },/effect path substitution/));
  vectors.push(await reject('duplicate_evidence_id',async()=>{
    const a=clone(assessment); a.evidence_catalog[1].evidence_id=a.evidence_catalog[0].evidence_id; await validate(a);
  },/duplicate evidence IDs/));
  vectors.push(await reject('evidence_timestamp_after_cutoff',async()=>{
    const a=clone(assessment); a.evidence_catalog[0].observed_at='2026-08-23T08:20:03Z'; await validate(a);
  },/later than evidence cutoff/));
  vectors.push(await reject('alternatives_flag_removed',async()=>{
    const a=clone(assessment); a.assessment_result.alternatives_considered=false; await validate(a);
  },/alternatives_considered/));
  vectors.push(await reject('scalar_probability_injection',async()=>{
    const a=clone(assessment); a.hypotheses[0].probability=0.9; await validate(a);
  },/scalar probability\/score fields/));
  vectors.push(await reject('causal_proof_overclaim',async()=>{
    const a=clone(assessment); a.claims.causal_proof_certified=true; await validate(a);
  },/prohibited claim causal_proof_certified/));
  vectors.push(await reject('exclusive_cause_overclaim',async()=>{
    const a=clone(assessment); a.claims.exclusive_cause_established=true; await validate(a);
  },/prohibited claim exclusive_cause_established/));
  vectors.push(await reject('responsibility_adjudication_overclaim',async()=>{
    const a=clone(assessment); a.claims.responsibility_for_outcome_adjudicated=true; await validate(a);
  },/prohibited claim responsibility_for_outcome_adjudicated/));
  vectors.push(await reject('legal_overclaim',async()=>{
    const a=clone(assessment); a.claims.legal_responsibility_determined=true; await validate(a);
  },/prohibited claim legal_responsibility_determined/));
  vectors.push(await reject('truth_overclaim',async()=>{
    const a=clone(assessment); a.claims.truth_certified=true; await validate(a);
  },/prohibited claim truth_certified/));

  fs.writeFileSync(assessmentPath,JSON.stringify(assessment,null,2)+'\n');
  console.log(JSON.stringify({
    suite:'UU-AAP CausalAttributionAssessment v0.1',
    assessment_id:assessment.assessment_id,
    assessment_status:assessment.assessment_result.status,
    causal_scope:assessment.assessment_result.causal_scope,
    hypotheses:assessment.hypotheses.map(h=>({kind:h.kind,support_status:h.support_status})),
    causal_proof_certified:assessment.claims.causal_proof_certified,
    responsibility_for_outcome_adjudicated:assessment.claims.responsibility_for_outcome_adjudicated,
    negative_vectors:vectors.length
  },null,2));
}

main().catch(e=>{ console.error(e&&e.stack?e.stack:e); process.exit(1); });
