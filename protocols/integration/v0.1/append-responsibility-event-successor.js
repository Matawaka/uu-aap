'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const { digestJson } = require('./build-responsibility-event-chain.js');
const GenesisLedger = require('./responsibility-event-append-ledger.js');
const Observation = require('./observe-responsibility-event-append-ledger.js');

const SOURCE_ADAPTER = 'responsibility_event_append_ledger_reobservation_v0.1';
const EVENT_KIND = 'responsibility_event_append_ledger_reobserved';
const SCALARS = new Set(['score','probability','percentage','weight','likelihood','confidence_score','causal_score','responsibility_score','blame_score','rating']);
const FALSE_CLAIMS = [
  'new_external_consequence_observed','generalized_external_consequence_causality_established','causal_proof_certified',
  'responsibility_for_outcome_adjudicated','legal_liability_established','legal_effect_established',
  'moral_blame_assigned','moral_correctness_established','truth_certified','global_replay_protection_established',
  'distributed_consensus_established','poai_materialization_event_recorded','universal_canonicality_established'
];
const assert = (v,m) => { if (!v) throw new Error(m); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const digest = (value) => ({canonicalization:'RFC8785-JCS',digest_algorithm:'SHA-256',digest_encoding:'hex',value});
function hasScalar(v) { if (!v || typeof v !== 'object') return false; if (Array.isArray(v)) return v.some(hasScalar); return Object.entries(v).some(([k,c]) => SCALARS.has(k) || hasScalar(c)); }
function parseTime(v,label) { const ms=Date.parse(v); assert(Number.isFinite(ms),`ResponsibilityEventSuccessorAppendReceipt: invalid ${label}`); return ms; }
function sameHead(a,b) { return !!a&&!!b&&a.sequence===b.sequence&&a.event_id===b.event_id&&a.event_digest&&b.event_digest&&a.event_digest.value===b.event_digest.value; }
function sameBinding(a,b) { return !!a&&!!b&&a.artifact_type===b.artifact_type&&a.artifact_ref===b.artifact_ref&&a.digest&&b.digest&&a.digest.value===b.digest.value; }
function canonicalEqual(a,b) { try { return Binding.canonicalize(a,'$a')===Binding.canonicalize(b,'$b'); } catch (_) { return false; } }
async function genericBinding(type,ref,artifact) { return {artifact_type:type,artifact_ref:ref,digest:digest(await digestJson(artifact))}; }
function eventFromEntry(entry) {
  if (entry.artifact_type === 'ResponsibilityEventAppendLedgerEntry') return entry.validation_bundle.append_receipt.appended_event;
  if (entry.artifact_type === 'ResponsibilityEventSuccessorLedgerEntry') return entry.validation_bundle.successor_append_receipt.appended_event;
  throw new Error('ResponsibilityEventSuccessorAppendReceipt: unsupported predecessor entry type');
}
function baseChainFromEntry(entry) {
  return entry.validation_bundle.base_chain;
}
async function predecessorEntryBinding(entry) { return Observation.entryBinding(entry); }
async function sourceBinding(source) { return genericBinding(source.artifact_type,source.reobservation_id,source); }
async function successorPolicyBinding(policy) { return Observation.successorPolicyBinding(policy); }
async function storagePolicyBinding(policy) { return GenesisLedger.policyBinding(policy); }
async function baseChainBinding(chain) { return GenesisLedger.chainBinding(chain); }
function inheritedAssurance(predecessorEvent) {
  const a = clone(predecessorEvent.assurance_snapshot);
  a.durable_ledger_head_reobserved = true;
  return a;
}
async function eventDigest(event) { const material=clone(event); delete material.event_digest; return digestJson(material); }
function extensionMaterial(receipt) {
  return {
    successor_policy_binding:clone(receipt.successor_policy_binding),storage_policy_binding:clone(receipt.storage_policy_binding),
    base_chain_binding:clone(receipt.base_chain_binding),predecessor_entry_binding:clone(receipt.predecessor_entry_binding),
    predecessor_event_head:clone(receipt.predecessor_event_head),source_adapter:receipt.source_adapter,source_binding:clone(receipt.source_binding),
    appended_event:{sequence:receipt.appended_event.sequence,event_id:receipt.appended_event.event_id,event_digest:clone(receipt.appended_event.event_digest)},
    extended_head:clone(receipt.extended_head),appended_at:receipt.appended_at
  };
}
function assertClaims(claims,label) {
  for (const key of FALSE_CLAIMS) assert(claims && claims[key] === false, `${label}: prohibited claim ${key}`);
}
function assertSourceAdapter(source,policy) {
  assert(source && source.artifact_type === 'ResponsibilityEventAppendLedgerReobservationReceipt' && source.artifact_version === '0.1',
    'ResponsibilityEventSuccessorAppendReceipt: typed ledger reobservation source required');
  assert(Array.isArray(policy.allowed_source_adapters) && policy.allowed_source_adapters.includes(SOURCE_ADAPTER),
    'ResponsibilityEventSuccessorAppendReceipt: source adapter unsupported by policy');
  return {adapter:SOURCE_ADAPTER,eventKind:EVENT_KIND,stageTime:source.observed_at};
}

async function buildResponsibilityEventSuccessorAppendReceipt({predecessorEntry,source,storagePolicy,successorPolicy,appendedAt}) {
  GenesisLedger.assertLedgerPolicy(storagePolicy); Observation.assertSuccessorPolicy(successorPolicy);
  const adapted = assertSourceAdapter(source,successorPolicy);
  await Observation.validateReceipt({receipt:source,predecessorEntry,storagePolicy,successorPolicy});
  parseTime(appendedAt,'appended_at');
  assert(parseTime(appendedAt,'appended_at') > parseTime(source.observed_at,'source observed_at'),
    'ResponsibilityEventSuccessorAppendReceipt: append must occur after source observation');
  const predecessorEvent = eventFromEntry(predecessorEntry);
  const predecessorHead = predecessorEntry.resulting_event_head;
  assert(predecessorEvent.sequence === predecessorHead.sequence && predecessorEvent.event_digest.value === predecessorHead.event_digest.value,
    'ResponsibilityEventSuccessorAppendReceipt: predecessor event/head inconsistency');
  assert(predecessorHead.sequence >= 6,'ResponsibilityEventSuccessorAppendReceipt: predecessor must be durable successor head >= 6');
  const baseChain = baseChainFromEntry(predecessorEntry);
  const spb = await successorPolicyBinding(successorPolicy), stb = await storagePolicyBinding(storagePolicy), bcb = await baseChainBinding(baseChain);
  const peb = await predecessorEntryBinding(predecessorEntry), sb = await sourceBinding(source);
  const sequence = predecessorHead.sequence + successorPolicy.sequence_increment;
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(`${predecessorHead.event_digest.value}|${sb.digest.value}|${sequence}|${adapted.stageTime}`));
  const event = {
    sequence,event_id:`urn:uu-aap:responsibility-event:${idHash.slice(0,24)}`,event_kind:adapted.eventKind,stage_time:adapted.stageTime,
    source_adapter:adapted.adapter,source_binding:sb,semantic_binding:clone(predecessorEvent.semantic_binding),
    effect_frontier:clone(predecessorEvent.effect_frontier),predecessor_event_digest:clone(predecessorHead.event_digest),
    assurance_snapshot:inheritedAssurance(predecessorEvent)
  };
  event.event_digest = digest(await eventDigest(event));
  const receipt = {
    $schema:'./responsibility-event-successor-append-receipt.schema.json',artifact_type:'ResponsibilityEventSuccessorAppendReceipt',artifact_version:'0.1',
    successor_append_receipt_id:'',appended_at:appendedAt,successor_policy_binding:spb,storage_policy_binding:stb,base_chain_binding:bcb,
    predecessor_entry_binding:peb,predecessor_event_head:clone(predecessorHead),source_adapter:adapted.adapter,source_binding:sb,
    appended_event:event,extended_head:{sequence,event_id:event.event_id,event_digest:clone(event.event_digest)},extension_digest:digest('0'.repeat(64)),
    verification:{successor_policy_exact:true,storage_policy_exact:true,base_chain_exact:true,predecessor_entry_exact:true,predecessor_head_exact:true,
      typed_source_exact:true,semantic_frontier_exact:true,effect_frontier_exact:true,successor_sequence_exact:true,predecessor_event_digest_exact:true,
      source_stage_time_exact:true,assurance_monotonic:true,appended_event_digest_exact:true,extended_head_exact:true,extension_digest_exact:true,
      local_stage_order_preserved:true,scalar_scoring_absent:true},
    claims:{generic_successor_append_established:true,typed_source_adapter_applied:true,predecessor_link_preserved:true,semantic_frontier_preserved:true,
      effect_frontier_preserved:true,new_external_consequence_observed:false,generalized_external_consequence_causality_established:false,
      causal_proof_certified:false,responsibility_for_outcome_adjudicated:false,legal_liability_established:false,legal_effect_established:false,
      moral_blame_assigned:false,moral_correctness_established:false,truth_certified:false,global_replay_protection_established:false,
      distributed_consensus_established:false,poai_materialization_event_recorded:false,universal_canonicality_established:false}
  };
  const ext = await digestJson(extensionMaterial(receipt)); receipt.extension_digest = digest(ext);
  const receiptHash = await Binding.sha256Hex(Binding.utf8Bytes(`${spb.digest.value}|${peb.digest.value}|${sb.digest.value}|${ext}`));
  receipt.successor_append_receipt_id = `urn:uu-aap:responsibility-event-successor-append-receipt:${receiptHash.slice(0,24)}`;
  await validateResponsibilityEventSuccessorAppendReceipt({receipt,predecessorEntry,source,storagePolicy,successorPolicy});
  return receipt;
}

async function validateResponsibilityEventSuccessorAppendReceipt({receipt,predecessorEntry,source,storagePolicy,successorPolicy}) {
  GenesisLedger.assertLedgerPolicy(storagePolicy); Observation.assertSuccessorPolicy(successorPolicy);
  assert(receipt && receipt.artifact_type === 'ResponsibilityEventSuccessorAppendReceipt' && receipt.artifact_version === '0.1',
    'ResponsibilityEventSuccessorAppendReceipt: invalid receipt');
  assert(!hasScalar(receipt),'ResponsibilityEventSuccessorAppendReceipt: scalar fields prohibited'); assertClaims(receipt.claims,'ResponsibilityEventSuccessorAppendReceipt');
  assert(receipt.claims.generic_successor_append_established === true && receipt.claims.typed_source_adapter_applied === true,
    'ResponsibilityEventSuccessorAppendReceipt: positive successor claims missing');
  const adapted = assertSourceAdapter(source,successorPolicy);
  await Observation.validateReceipt({receipt:source,predecessorEntry,storagePolicy,successorPolicy});
  assert(receipt.source_adapter === adapted.adapter,'ResponsibilityEventSuccessorAppendReceipt: source adapter substitution');
  assert(parseTime(receipt.appended_at,'appended_at') > parseTime(source.observed_at,'source observed_at'),
    'ResponsibilityEventSuccessorAppendReceipt: append temporal inversion');
  const predecessorEvent=eventFromEntry(predecessorEntry), predecessorHead=predecessorEntry.resulting_event_head, baseChain=baseChainFromEntry(predecessorEntry);
  const spb=await successorPolicyBinding(successorPolicy), stb=await storagePolicyBinding(storagePolicy), bcb=await baseChainBinding(baseChain), peb=await predecessorEntryBinding(predecessorEntry), sb=await sourceBinding(source);
  assert(sameBinding(receipt.successor_policy_binding,spb),'ResponsibilityEventSuccessorAppendReceipt: successor policy binding substitution');
  assert(sameBinding(receipt.storage_policy_binding,stb),'ResponsibilityEventSuccessorAppendReceipt: storage policy binding substitution');
  assert(sameBinding(receipt.base_chain_binding,bcb),'ResponsibilityEventSuccessorAppendReceipt: base chain binding substitution');
  assert(sameBinding(receipt.predecessor_entry_binding,peb),'ResponsibilityEventSuccessorAppendReceipt: predecessor entry binding substitution');
  assert(sameHead(receipt.predecessor_event_head,predecessorHead),'ResponsibilityEventSuccessorAppendReceipt: predecessor head substitution');
  assert(sameBinding(receipt.source_binding,sb),'ResponsibilityEventSuccessorAppendReceipt: source binding substitution');
  const expectedSequence=predecessorHead.sequence+1;
  assert(receipt.appended_event.sequence===expectedSequence && receipt.extended_head.sequence===expectedSequence,
    'ResponsibilityEventSuccessorAppendReceipt: successor sequence substitution');
  assert(receipt.appended_event.event_kind===adapted.eventKind && receipt.appended_event.source_adapter===adapted.adapter,
    'ResponsibilityEventSuccessorAppendReceipt: event kind/source adapter substitution');
  assert(receipt.appended_event.stage_time===source.observed_at,'ResponsibilityEventSuccessorAppendReceipt: source stage time substitution');
  assert(receipt.appended_event.predecessor_event_digest.value===predecessorHead.event_digest.value,
    'ResponsibilityEventSuccessorAppendReceipt: predecessor event digest substitution');
  assert(canonicalEqual(receipt.appended_event.semantic_binding,predecessorEvent.semantic_binding),
    'ResponsibilityEventSuccessorAppendReceipt: semantic frontier drift');
  assert(canonicalEqual(receipt.appended_event.effect_frontier,predecessorEvent.effect_frontier),
    'ResponsibilityEventSuccessorAppendReceipt: effect frontier drift');
  assert(canonicalEqual(receipt.appended_event.assurance_snapshot,inheritedAssurance(predecessorEvent)),
    'ResponsibilityEventSuccessorAppendReceipt: assurance monotonicity violation');
  assert(receipt.appended_event.source_binding.digest.value===sb.digest.value,'ResponsibilityEventSuccessorAppendReceipt: event source binding substitution');
  assert(receipt.appended_event.event_digest.value===await eventDigest(receipt.appended_event),'ResponsibilityEventSuccessorAppendReceipt: event digest substitution');
  assert(receipt.extended_head.event_id===receipt.appended_event.event_id && receipt.extended_head.event_digest.value===receipt.appended_event.event_digest.value,
    'ResponsibilityEventSuccessorAppendReceipt: extended head substitution');
  const ext=await digestJson(extensionMaterial(receipt)); assert(receipt.extension_digest.value===ext,'ResponsibilityEventSuccessorAppendReceipt: extension digest substitution');
  const receiptHash=await Binding.sha256Hex(Binding.utf8Bytes(`${spb.digest.value}|${peb.digest.value}|${sb.digest.value}|${ext}`));
  assert(receipt.successor_append_receipt_id===`urn:uu-aap:responsibility-event-successor-append-receipt:${receiptHash.slice(0,24)}`,
    'ResponsibilityEventSuccessorAppendReceipt: receipt ID substitution');
  assert(Object.values(receipt.verification).every((v)=>v===true),'ResponsibilityEventSuccessorAppendReceipt: verification boundary weakened');
  return true;
}

module.exports={SOURCE_ADAPTER,EVENT_KIND,eventFromEntry,baseChainFromEntry,buildResponsibilityEventSuccessorAppendReceipt,validateResponsibilityEventSuccessorAppendReceipt};
