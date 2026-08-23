'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const CLASSES = new Set(['local_machine','organizational','economic','legal','physical','human','other']);
const STATUSES = new Set(['observed','not_observed','not_yet_observable','indeterminate']);
const METHODS = new Set(['system_record','direct_observation','document_review','multi_source','other','unknown']);
const FRONTIER_TYPES = new Set(['ResponsibilityEventAppendLedgerEntry','ResponsibilityEventSuccessorLedgerEntry']);
const SCALAR_KEYS = new Set(['score','probability','percentage','weight','likelihood','confidence_score','responsibility_score','causal_score','blame_score','rating']);
const FALSE_CLAIMS = [
  'new_external_consequence_observed','consequence_truth_certified','generalized_external_consequence_causality_established',
  'causal_proof_certified','responsibility_for_consequence_attributed','responsibility_for_outcome_adjudicated',
  'legal_liability_established','legal_effect_established','moral_blame_assigned','truth_certified',
  'global_replay_protection_established','distributed_consensus_established','poai_materialization_event_recorded','universal_canonicality_established'
];

function assert(v,m){if(!v)throw new Error(`ConsequenceObservationIngress: ${m}`);}
function clone(v){return JSON.parse(JSON.stringify(v));}
function canonicalEqual(a,b){try{return Binding.canonicalize(a,'$a')===Binding.canonicalize(b,'$b');}catch(_){return false;}}
function hasScalarKey(v){if(!v||typeof v!=='object')return false;if(Array.isArray(v))return v.some(hasScalarKey);return Object.entries(v).some(([k,c])=>SCALAR_KEYS.has(k)||hasScalarKey(c));}
function parseTime(v,label){const ms=Date.parse(v);assert(Number.isFinite(ms),`invalid ${label}`);return ms;}
function digest(value){return {canonicalization:'RFC8785-JCS',digest_algorithm:'SHA-256',digest_encoding:'hex',value};}
async function digestJson(value){return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value,'$')));}
async function binding(type,ref,artifact){return {artifact_type:type,artifact_ref:ref,digest:digest(await digestJson(artifact))};}
function sameBinding(a,b){return !!a&&!!b&&a.artifact_type===b.artifact_type&&a.artifact_ref===b.artifact_ref&&a.digest&&b.digest&&a.digest.value===b.digest.value;}
function assertFalseClaims(claims,label){for(const k of FALSE_CLAIMS)assert(claims&&claims[k]===false,`${label} prohibited claim ${k}`);}

function assertPolicy(policy){
  assert(policy&&policy.artifact_type==='ConsequenceObservationIngressPolicy'&&policy.artifact_version==='0.1','policy v0.1 required');
  assert(policy.policy_id==='urn:uu-aap:consequence-observation-ingress-policy:responsibility-event-frontier:1','policy ID substitution');
  assert(policy.policy_version===1,'policy version substitution');
  assert(policy.scope==='urn:uu-aap:consequence-observation-ingress-scope:responsibility-event-frontier-v0.1','policy scope substitution');
  assert(canonicalEqual(policy.allowed_consequence_classes,[...CLASSES]),'consequence class policy drift');
  assert(canonicalEqual(policy.allowed_claimed_statuses,[...STATUSES]),'status policy drift');
  assert(canonicalEqual(policy.allowed_observation_methods,[...METHODS]),'method policy drift');
  assert(canonicalEqual(policy.accepted_frontier_artifact_types,[...FRONTIER_TYPES]),'frontier type policy drift');
  const i=policy.invariants||{};
  assert(i.observed_claim_requires_evidence===true&&i.frontier_binding_required===true&&i.semantic_frontier_exact===true&&i.effect_frontier_exact===true&&i.claim_is_non_certifying===true&&i.scalar_scores_allowed===false,'policy invariants weakened');
  assert(policy.claims&&policy.claims.ingress_policy_defined===true,'policy claim missing');
  assertFalseClaims(policy.claims,'policy');
  assert(!hasScalarKey(policy),'scalar fields prohibited');
}

function frontierHead(frontierEntry){
  assert(frontierEntry&&FRONTIER_TYPES.has(frontierEntry.artifact_type),'unsupported frontier artifact type');
  assert(frontierEntry.entry_id&&frontierEntry.resulting_event_head,'frontier entry incomplete');
  return frontierEntry.resulting_event_head;
}
function frontierEvent(frontierEntry){
  frontierHead(frontierEntry);
  let event=null;
  if(frontierEntry.artifact_type==='ResponsibilityEventSuccessorLedgerEntry'){
    event=frontierEntry.validation_bundle&&frontierEntry.validation_bundle.successor_append_receipt&&frontierEntry.validation_bundle.successor_append_receipt.appended_event;
  }else if(frontierEntry.artifact_type==='ResponsibilityEventAppendLedgerEntry'){
    event=frontierEntry.validation_bundle&&frontierEntry.validation_bundle.append_receipt&&frontierEntry.validation_bundle.append_receipt.appended_event;
  }
  assert(event&&event.semantic_binding&&event.effect_frontier,'frontier embedded event context missing');
  assert(event.event_id===frontierEntry.resulting_event_head.event_id&&event.event_digest&&event.event_digest.value===frontierEntry.resulting_event_head.event_digest.value,'frontier embedded event/head mismatch');
  return event;
}
function frontierContext(frontierEntry){
  const event=frontierEvent(frontierEntry);
  return {semantic_frontier:event.semantic_binding,effect_frontier:event.effect_frontier};
}

async function validateClaim({claim,frontierEntry,policy}){
  assertPolicy(policy);
  assert(claim&&claim.artifact_type==='ConsequenceObservationClaim'&&claim.artifact_version==='0.1','claim v0.1 required');
  assert(!hasScalarKey(claim),'scalar fields prohibited');
  assert(claim.environment==='live'||claim.environment==='test_fixture','invalid environment');
  assert(claim.claimant&&['self_declared','undisclosed'].includes(claim.claimant.declaration),'invalid claimant declaration');
  if(claim.claimant.declaration==='self_declared')assert(typeof claim.claimant.claimant_id==='string'&&claim.claimant.claimant_id.length>0,'self-declared claimant ID required');
  if(claim.claimant.declaration==='undisclosed')assert(claim.claimant.claimant_id===null,'undisclosed claimant must use null ID');
  assert(CLASSES.has(claim.consequence_class),'unsupported consequence class');
  assert(STATUSES.has(claim.claimed_status),'unsupported claimed status');
  assert(METHODS.has(claim.observation_method),'unsupported observation method');
  assert(typeof claim.consequence_subject_ref==='string'&&claim.consequence_subject_ref.length>0,'consequence subject ref required');
  const claimedAt=parseTime(claim.claimed_at,'claimed_at');
  const cutoff=parseTime(claim.evidence_cutoff,'evidence_cutoff');
  assert(cutoff<=claimedAt,'evidence cutoff after claimed_at');
  if(claim.observation_time!==null){const observed=parseTime(claim.observation_time,'observation_time');assert(observed<=claimedAt,'observation time after claimed_at');}
  assert(Array.isArray(claim.evidence_refs)&&new Set(claim.evidence_refs).size===claim.evidence_refs.length,'duplicate evidence refs');
  if(claim.claimed_status==='observed'){assert(typeof claim.observation_time==='string','observed claim requires observation_time');assert(claim.evidence_refs.length>0,'observed claim requires evidence refs');}
  assert(canonicalEqual(claim.responsibility_event_head,frontierHead(frontierEntry)),'responsibility event frontier substitution');
  const context=frontierContext(frontierEntry);
  assert(canonicalEqual(claim.semantic_frontier,context.semantic_frontier),'semantic frontier substitution');
  assert(canonicalEqual(claim.effect_frontier,context.effect_frontier),'effect frontier substitution');
  assertFalseClaims({...claim.claims,new_external_consequence_observed:false,global_replay_protection_established:false,distributed_consensus_established:false,poai_materialization_event_recorded:false,universal_canonicality_established:false},'claim');
  const expectedIdHash=await Binding.sha256Hex(Binding.utf8Bytes(`${claim.environment}|${claim.claimant.declaration}|${claim.claimant.claimant_id||''}|${claim.consequence_class}|${claim.consequence_subject_ref}|${claim.claimed_status}|${claim.claimed_at}|${claim.responsibility_event_head.event_digest.value}`));
  assert(claim.claim_id===`urn:uu-aap:consequence-observation-claim:${expectedIdHash.slice(0,24)}`,'claim ID substitution');
  return true;
}

async function buildClaim({frontierEntry,environment='live',claimantDeclaration='undisclosed',claimantId=null,consequenceClass,consequenceSubjectRef,claimedStatus,claimedAt,observationTime=null,evidenceCutoff,observationMethod='unknown',evidenceRefs=[]}){
  const head=clone(frontierHead(frontierEntry));
  const context=frontierContext(frontierEntry);
  const seed=`${environment}|${claimantDeclaration}|${claimantId||''}|${consequenceClass}|${consequenceSubjectRef}|${claimedStatus}|${claimedAt}|${head.event_digest.value}`;
  const idHash=await Binding.sha256Hex(Binding.utf8Bytes(seed));
  return {
    $schema:'./consequence-observation-claim.schema.json',artifact_type:'ConsequenceObservationClaim',artifact_version:'0.1',
    claim_id:`urn:uu-aap:consequence-observation-claim:${idHash.slice(0,24)}`,environment,
    claimant:{declaration:claimantDeclaration,claimant_id:claimantDeclaration==='undisclosed'?null:claimantId},
    consequence_class:consequenceClass,consequence_subject_ref:consequenceSubjectRef,claimed_status:claimedStatus,claimed_at:claimedAt,
    observation_time:observationTime,evidence_cutoff:evidenceCutoff,observation_method:observationMethod,evidence_refs:[...evidenceRefs],
    responsibility_event_head:head,semantic_frontier:clone(context.semantic_frontier),effect_frontier:clone(context.effect_frontier),
    claims:{consequence_truth_certified:false,generalized_external_consequence_causality_established:false,causal_proof_certified:false,responsibility_for_consequence_attributed:false,responsibility_for_outcome_adjudicated:false,legal_liability_established:false,legal_effect_established:false,moral_blame_assigned:false,truth_certified:false}
  };
}

async function expectedBindings({policy,claim,frontierEntry}){
  return {
    policyBinding:await binding('ConsequenceObservationIngressPolicy',policy.policy_id,policy),
    claimBinding:await binding('ConsequenceObservationClaim',claim.claim_id,claim),
    frontierBinding:await binding(frontierEntry.artifact_type,frontierEntry.entry_id,frontierEntry)
  };
}

async function validateIngressReceipt({receipt,policy,claim,frontierEntry}){
  await validateClaim({claim,frontierEntry,policy});
  assert(receipt&&receipt.artifact_type==='ConsequenceObservationIngressReceipt'&&receipt.artifact_version==='0.1','receipt v0.1 required');
  assert(!hasScalarKey(receipt),'scalar fields prohibited');
  const received=parseTime(receipt.received_at,'received_at');
  assert(received>=parseTime(claim.claimed_at,'claimed_at'),'receipt before claim');
  assert(received>=parseTime(claim.evidence_cutoff,'evidence_cutoff'),'receipt before evidence cutoff');
  if(claim.observation_time!==null)assert(received>=parseTime(claim.observation_time,'observation_time'),'receipt before observation');
  assert(receipt.decision==='accepted_non_certifying_claim','receipt decision substitution');
  const b=await expectedBindings({policy,claim,frontierEntry});
  assert(sameBinding(receipt.policy_binding,b.policyBinding),'policy binding substitution');
  assert(sameBinding(receipt.claim_binding,b.claimBinding),'claim binding substitution');
  assert(sameBinding(receipt.frontier_binding,b.frontierBinding),'frontier binding substitution');
  assert(canonicalEqual(receipt.responsibility_event_head,frontierHead(frontierEntry)),'receipt frontier substitution');
  const context=frontierContext(frontierEntry);
  assert(canonicalEqual(receipt.semantic_frontier,context.semantic_frontier),'receipt semantic frontier substitution');
  assert(canonicalEqual(receipt.effect_frontier,context.effect_frontier),'receipt effect frontier substitution');
  assert(canonicalEqual(receipt.source_declaration,{environment:claim.environment,claimant_declaration:claim.claimant.declaration,claimant_id:claim.claimant.claimant_id,claimed_status:claim.claimed_status}),'source declaration substitution');
  assert(receipt.verification&&Object.values(receipt.verification).every(v=>v===true),'verification boundary weakened');
  for(const k of ['consequence_observation_claim_well_formed','claim_provenance_bound','observation_horizon_bound','responsibility_event_frontier_bound','ingress_accepted'])assert(receipt.claims&&receipt.claims[k]===true,`positive claim ${k} missing`);
  assertFalseClaims(receipt.claims,'receipt');
  const idSeed=`${b.policyBinding.digest.value}|${b.claimBinding.digest.value}|${b.frontierBinding.digest.value}|${receipt.received_at}`;
  const idHash=await Binding.sha256Hex(Binding.utf8Bytes(idSeed));
  assert(receipt.receipt_id===`urn:uu-aap:consequence-observation-ingress-receipt:${idHash.slice(0,24)}`,'receipt ID substitution');
  return true;
}

async function buildIngressReceipt({policy,claim,frontierEntry,receivedAt}){
  await validateClaim({claim,frontierEntry,policy});
  const b=await expectedBindings({policy,claim,frontierEntry});
  const context=frontierContext(frontierEntry);
  const idSeed=`${b.policyBinding.digest.value}|${b.claimBinding.digest.value}|${b.frontierBinding.digest.value}|${receivedAt}`;
  const idHash=await Binding.sha256Hex(Binding.utf8Bytes(idSeed));
  const receipt={
    $schema:'./consequence-observation-ingress-receipt.schema.json',artifact_type:'ConsequenceObservationIngressReceipt',artifact_version:'0.1',
    receipt_id:`urn:uu-aap:consequence-observation-ingress-receipt:${idHash.slice(0,24)}`,received_at:receivedAt,decision:'accepted_non_certifying_claim',
    policy_binding:b.policyBinding,claim_binding:b.claimBinding,frontier_binding:b.frontierBinding,responsibility_event_head:clone(frontierHead(frontierEntry)),
    semantic_frontier:clone(context.semantic_frontier),effect_frontier:clone(context.effect_frontier),
    source_declaration:{environment:claim.environment,claimant_declaration:claim.claimant.declaration,claimant_id:claim.claimant.claimant_id,claimed_status:claim.claimed_status},
    verification:{policy_exact:true,claim_exact:true,frontier_exact:true,semantic_frontier_exact:true,effect_frontier_exact:true,chronology_valid:true,evidence_requirements_valid:true,non_certifying_boundary_preserved:true},
    claims:{consequence_observation_claim_well_formed:true,claim_provenance_bound:true,observation_horizon_bound:true,responsibility_event_frontier_bound:true,ingress_accepted:true,new_external_consequence_observed:false,consequence_truth_certified:false,generalized_external_consequence_causality_established:false,causal_proof_certified:false,responsibility_for_consequence_attributed:false,responsibility_for_outcome_adjudicated:false,legal_liability_established:false,legal_effect_established:false,moral_blame_assigned:false,truth_certified:false,global_replay_protection_established:false,distributed_consensus_established:false,poai_materialization_event_recorded:false,universal_canonicality_established:false}
  };
  await validateIngressReceipt({receipt,policy,claim,frontierEntry});
  return receipt;
}

module.exports={assertPolicy,frontierHead,frontierContext,validateClaim,buildClaim,validateIngressReceipt,buildIngressReceipt,digestJson,binding};
