'use strict';

const fs=require('fs');
const path=require('path');
const cp=require('child_process');
const Ingress=require('./consequence-observation-ingress.js');

const repoRoot=path.resolve(__dirname,'../../..');
const assert=(v,m)=>{if(!v)throw new Error(m);};
const clone=(v)=>JSON.parse(JSON.stringify(v));
const readJson=(f)=>JSON.parse(fs.readFileSync(f,'utf8'));
const writeJson=(f,v)=>fs.writeFileSync(f,`${JSON.stringify(v,null,2)}\n`);
async function reject(name,fn,pattern){let e=null;try{await fn();}catch(x){e=x;}assert(e,`${name}: expected failure`);if(pattern)assert(pattern.test(e.message),`${name}: unexpected error ${e.message}`);return{name,error:e.message};}
function runSuccessor(){const r=cp.spawnSync('node',['protocols/integration/v0.1/test-responsibility-event-successor-append.js'],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']});if(r.error)throw r.error;assert(r.status===0,`successor prerequisite failed\n${r.stdout||''}\n${r.stderr||''}`);}

async function main(){
  runSuccessor();
  const policy=readJson(path.join(repoRoot,'protocols/integration/v0.1/policies/reference.consequence-observation-ingress-policy.json'));
  const frontier=readJson('/tmp/responsibility-event-successor-ledger-entry-2.json');

  const notYet=await Ingress.buildClaim({frontierEntry:frontier,environment:'live',claimantDeclaration:'undisclosed',consequenceClass:'organizational',consequenceSubjectRef:'urn:uu-aap:consequence-subject:future-downstream-state',claimedStatus:'not_yet_observable',claimedAt:'2026-08-23T08:43:10Z',observationTime:null,evidenceCutoff:'2026-08-23T08:43:09Z',observationMethod:'unknown',evidenceRefs:[]});
  await Ingress.validateClaim({claim:notYet,frontierEntry:frontier,policy});
  const receiptNotYet=await Ingress.buildIngressReceipt({policy,claim:notYet,frontierEntry:frontier,receivedAt:'2026-08-23T08:43:11Z'});

  const indeterminate=await Ingress.buildClaim({frontierEntry:frontier,environment:'live',claimantDeclaration:'self_declared',claimantId:'urn:uu-aap:claimant:integration-test-observer',consequenceClass:'other',consequenceSubjectRef:'urn:uu-aap:consequence-subject:indeterminate-downstream-state',claimedStatus:'indeterminate',claimedAt:'2026-08-23T08:43:12Z',observationTime:null,evidenceCutoff:'2026-08-23T08:43:11Z',observationMethod:'document_review',evidenceRefs:['urn:uu-aap:evidence:document-review-reference']});
  await Ingress.validateClaim({claim:indeterminate,frontierEntry:frontier,policy});
  const receiptIndeterminate=await Ingress.buildIngressReceipt({policy,claim:indeterminate,frontierEntry:frontier,receivedAt:'2026-08-23T08:43:13Z'});

  const observedFixture=await Ingress.buildClaim({frontierEntry:frontier,environment:'test_fixture',claimantDeclaration:'self_declared',claimantId:'urn:uu-aap:test-claimant:fixture',consequenceClass:'local_machine',consequenceSubjectRef:'urn:uu-aap:test-consequence:fixture-only',claimedStatus:'observed',claimedAt:'2026-08-23T08:43:14Z',observationTime:'2026-08-23T08:43:13Z',evidenceCutoff:'2026-08-23T08:43:13Z',observationMethod:'system_record',evidenceRefs:['urn:uu-aap:test-evidence:fixture-only']});
  await Ingress.validateClaim({claim:observedFixture,frontierEntry:frontier,policy});
  const receiptObservedFixture=await Ingress.buildIngressReceipt({policy,claim:observedFixture,frontierEntry:frontier,receivedAt:'2026-08-23T08:43:15Z'});

  for(const r of [receiptNotYet,receiptIndeterminate,receiptObservedFixture]){
    assert(r.claims.ingress_accepted===true,'ingress must accept structurally valid claim');
    assert(r.claims.new_external_consequence_observed===false,'ingress must remain non-certifying');
    assert(r.claims.causal_proof_certified===false&&r.claims.responsibility_for_consequence_attributed===false,'ingress cannot establish causality/responsibility');
  }
  assert(receiptObservedFixture.source_declaration.environment==='test_fixture','observed structural exercise must remain fixture-marked');
  writeJson('/tmp/consequence-observation-claim-not-yet.json',notYet);
  writeJson('/tmp/consequence-observation-ingress-not-yet.json',receiptNotYet);
  writeJson('/tmp/consequence-observation-claim-observed-fixture.json',observedFixture);
  writeJson('/tmp/consequence-observation-ingress-observed-fixture.json',receiptObservedFixture);

  const vectors=[];
  vectors.push(await reject('observed_without_evidence',async()=>{const x=clone(observedFixture);x.evidence_refs=[];await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/observed claim requires evidence refs/));
  vectors.push(await reject('observed_without_observation_time',async()=>{const x=clone(observedFixture);x.observation_time=null;await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/observed claim requires observation_time/));
  vectors.push(await reject('future_observation_time',async()=>{const x=clone(observedFixture);x.observation_time='2026-08-23T08:43:20Z';await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/observation time after claimed_at/));
  vectors.push(await reject('evidence_cutoff_after_claim',async()=>{const x=clone(notYet);x.evidence_cutoff='2026-08-23T08:43:20Z';await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/evidence cutoff after claimed_at/));
  vectors.push(await reject('duplicate_evidence_refs',async()=>{const x=clone(observedFixture);x.evidence_refs=['urn:e:1','urn:e:1'];await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/duplicate evidence refs/));
  vectors.push(await reject('unsupported_consequence_class',async()=>{const x=clone(notYet);x.consequence_class='political';await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/unsupported consequence class/));
  vectors.push(await reject('unsupported_status',async()=>{const x=clone(notYet);x.claimed_status='proven';await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/unsupported claimed status/));
  vectors.push(await reject('unsupported_method',async()=>{const x=clone(notYet);x.observation_method='oracle';await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/unsupported observation method/));
  vectors.push(await reject('claim_frontier_sequence_substitution',async()=>{const x=clone(notYet);x.responsibility_event_head.sequence-=1;await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/frontier substitution/));
  vectors.push(await reject('claim_frontier_digest_substitution',async()=>{const x=clone(notYet);x.responsibility_event_head.event_digest.value='0'.repeat(64);await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/frontier substitution/));
  vectors.push(await reject('claim_semantic_frontier_drift',async()=>{const x=clone(notYet);x.responsibility_event_head.semantic_binding={forged:true};await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/frontier substitution/));
  vectors.push(await reject('claim_effect_frontier_drift',async()=>{const x=clone(notYet);x.responsibility_event_head.effect_frontier={forged:true};await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/frontier substitution/));
  vectors.push(await reject('claim_id_substitution',async()=>{const x=clone(notYet);x.claim_id='urn:uu-aap:consequence-observation-claim:'+'0'.repeat(24);await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/claim ID substitution/));
  vectors.push(await reject('claimant_substitution',async()=>{const x=clone(indeterminate);x.claimant.claimant_id='urn:uu-aap:claimant:other';await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/claim ID substitution/));
  vectors.push(await reject('claim_truth_overclaim',async()=>{const x=clone(notYet);x.claims.truth_certified=true;await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/prohibited claim truth_certified/));
  vectors.push(await reject('claim_scalar_injection',async()=>{const x=clone(notYet);x.confidence_score=.9;await Ingress.validateClaim({claim:x,frontierEntry:frontier,policy});},/scalar fields prohibited/));
  vectors.push(await reject('policy_id_substitution',async()=>{const p=clone(policy);p.policy_id='urn:other';Ingress.assertPolicy(p);},/policy ID substitution/));
  vectors.push(await reject('policy_scalar_injection',async()=>{const p=clone(policy);p.responsibility_score=1;Ingress.assertPolicy(p);},/scalar fields prohibited/));
  vectors.push(await reject('receipt_policy_binding_substitution',async()=>{const x=clone(receiptNotYet);x.policy_binding.digest.value='0'.repeat(64);await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/policy binding substitution/));
  vectors.push(await reject('receipt_claim_binding_substitution',async()=>{const x=clone(receiptNotYet);x.claim_binding.digest.value='0'.repeat(64);await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/claim binding substitution/));
  vectors.push(await reject('receipt_frontier_binding_substitution',async()=>{const x=clone(receiptNotYet);x.frontier_binding.digest.value='0'.repeat(64);await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/frontier binding substitution/));
  vectors.push(await reject('receipt_source_declaration_substitution',async()=>{const x=clone(receiptNotYet);x.source_declaration.claimed_status='observed';await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/source declaration substitution/));
  vectors.push(await reject('receipt_before_claim',async()=>{const x=clone(receiptNotYet);x.received_at='2026-08-23T08:43:00Z';await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/receipt before claim/));
  vectors.push(await reject('receipt_id_substitution',async()=>{const x=clone(receiptNotYet);x.receipt_id='urn:uu-aap:consequence-observation-ingress-receipt:'+'0'.repeat(24);await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/receipt ID substitution/));
  vectors.push(await reject('receipt_external_consequence_overclaim',async()=>{const x=clone(receiptNotYet);x.claims.new_external_consequence_observed=true;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/prohibited claim new_external_consequence_observed/));
  vectors.push(await reject('receipt_causal_overclaim',async()=>{const x=clone(receiptNotYet);x.claims.causal_proof_certified=true;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/prohibited claim causal_proof_certified/));
  vectors.push(await reject('receipt_responsibility_overclaim',async()=>{const x=clone(receiptNotYet);x.claims.responsibility_for_consequence_attributed=true;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/prohibited claim responsibility_for_consequence_attributed/));
  vectors.push(await reject('receipt_legal_overclaim',async()=>{const x=clone(receiptNotYet);x.claims.legal_liability_established=true;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/prohibited claim legal_liability_established/));
  vectors.push(await reject('receipt_moral_overclaim',async()=>{const x=clone(receiptNotYet);x.claims.moral_blame_assigned=true;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/prohibited claim moral_blame_assigned/));
  vectors.push(await reject('receipt_truth_overclaim',async()=>{const x=clone(receiptNotYet);x.claims.truth_certified=true;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/prohibited claim truth_certified/));
  vectors.push(await reject('receipt_global_replay_overclaim',async()=>{const x=clone(receiptNotYet);x.claims.global_replay_protection_established=true;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/prohibited claim global_replay_protection_established/));
  vectors.push(await reject('receipt_scalar_injection',async()=>{const x=clone(receiptNotYet);x.probability=.5;await Ingress.validateIngressReceipt({receipt:x,policy,claim:notYet,frontierEntry:frontier});},/scalar fields prohibited/));

  console.log(JSON.stringify({suite:'UU-AAP ConsequenceObservationIngress v0.1',frontier_sequence:frontier.resulting_event_head.sequence,accepted_claims:3,observed_fixture_only:true,live_external_consequence_observed:false,all_receipts_non_certifying:true,negative_vectors:vectors.length},null,2));
}
main().catch((e)=>{console.error(e&&e.stack?e.stack:e);process.exit(1);});
