'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const { digestJson } = require('./build-responsibility-event-chain.js');
const GenesisLedger = require('./responsibility-event-append-ledger.js');

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
function hasScalar(v) {
  if (!v || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.some(hasScalar);
  return Object.entries(v).some(([k,c]) => SCALARS.has(k) || hasScalar(c));
}
function parseTime(v,label) {
  const ms = Date.parse(v); assert(Number.isFinite(ms), `ResponsibilityEventAppendLedgerReobservationReceipt: invalid ${label}`); return ms;
}
function sameHead(a,b) {
  return !!a && !!b && a.sequence === b.sequence && a.event_id === b.event_id &&
    a.event_digest && b.event_digest && a.event_digest.value === b.event_digest.value;
}
function sameBinding(a,b) {
  return !!a && !!b && a.artifact_type === b.artifact_type && a.artifact_ref === b.artifact_ref &&
    a.digest && b.digest && a.digest.value === b.digest.value;
}
async function genericBinding(type, ref, artifact) {
  return {artifact_type:type,artifact_ref:ref,digest:digest(await digestJson(artifact))};
}
function assertSuccessorPolicy(policy) {
  assert(policy && policy.artifact_type === 'ResponsibilityEventSuccessorPolicy' && policy.artifact_version === '0.1',
    'ResponsibilityEventAppendLedgerReobservationReceipt: successor policy v0.1 required');
  assert(policy.policy_id === 'urn:uu-aap:responsibility-event-successor-policy:local-ledger:1' && policy.policy_version === 1,
    'ResponsibilityEventAppendLedgerReobservationReceipt: successor policy substitution');
  assert(policy.storage_policy_ref && policy.storage_policy_ref.policy_id === 'urn:uu-aap:responsibility-event-append-ledger-policy:local-filesystem:1' &&
    policy.storage_policy_ref.policy_version === 1 && policy.storage_policy_ref.exact_binding_required === true,
    'ResponsibilityEventAppendLedgerReobservationReceipt: storage policy reference drift');
  assert(Array.isArray(policy.allowed_source_adapters) && policy.allowed_source_adapters.length === 1 &&
    policy.allowed_source_adapters[0] === 'responsibility_event_append_ledger_reobservation_v0.1',
    'ResponsibilityEventAppendLedgerReobservationReceipt: source adapter policy drift');
  for (const key of FALSE_CLAIMS) assert(policy.claims && policy.claims[key] === false,
    `ResponsibilityEventAppendLedgerReobservationReceipt: prohibited policy claim ${key}`);
}
async function successorPolicyBinding(policy) {
  return genericBinding('ResponsibilityEventSuccessorPolicy', policy.policy_id, policy);
}
async function entryBinding(entry) {
  const type = entry.artifact_type;
  assert(type === 'ResponsibilityEventAppendLedgerEntry' || type === 'ResponsibilityEventSuccessorLedgerEntry',
    'ResponsibilityEventAppendLedgerReobservationReceipt: unsupported head entry type');
  return genericBinding(type, entry.entry_id, entry);
}
function historyMaterial(recovered) {
  return recovered.entries.map((entry) => ({
    sequence: entry.sequence,
    artifact_type: entry.artifact_type,
    entry_id: entry.entry_id,
    entry_digest: clone(entry.entry_digest),
    resulting_event_head: clone(entry.resulting_event_head)
  }));
}
async function historyDigest(recovered) { return digest(await digestJson(historyMaterial(recovered))); }

async function buildReceipt({recovered, storagePolicy, successorPolicy, observedAt}) {
  GenesisLedger.assertLedgerPolicy(storagePolicy);
  assertSuccessorPolicy(successorPolicy);
  assert(recovered && recovered.head_entry && recovered.authoritative_successor_head,
    'ResponsibilityEventAppendLedgerReobservationReceipt: non-empty recovered ledger required');
  parseTime(observedAt,'observed_at');
  assert(parseTime(observedAt,'observed_at') > parseTime(recovered.head_entry.committed_at,'head committed_at'),
    'ResponsibilityEventAppendLedgerReobservationReceipt: observation must occur after current head commit');
  const storageBinding = await GenesisLedger.policyBinding(storagePolicy);
  const successorBinding = await successorPolicyBinding(successorPolicy);
  const headBinding = await entryBinding(recovered.head_entry);
  const hDigest = await historyDigest(recovered);
  const idHash = await Binding.sha256Hex(Binding.utf8Bytes(`${storagePolicy.ledger_id}|${hDigest.value}|${headBinding.digest.value}|${observedAt}`));
  const receipt = {
    $schema:'./responsibility-event-append-ledger-reobservation.schema.json',
    artifact_type:'ResponsibilityEventAppendLedgerReobservationReceipt',artifact_version:'0.1',
    reobservation_id:`urn:uu-aap:responsibility-event-append-ledger-reobservation:${idHash.slice(0,24)}`,
    observed_at:observedAt,ledger_id:storagePolicy.ledger_id,
    storage_policy_binding:storageBinding,successor_policy_binding:successorBinding,
    entry_count:recovered.entries.length,head_entry_binding:headBinding,
    authoritative_successor_head:clone(recovered.authoritative_successor_head),history_digest:hDigest,
    accepted_append_receipt_ids:clone(recovered.accepted_append_receipt_ids),
    accepted_event_ids:clone(recovered.accepted_event_ids),accepted_event_digests:clone(recovered.accepted_event_digests),
    verification:{committed_entries_replayed:true,entry_chain_exact:true,head_exact:true,accepted_identity_sets_exact:true,
      storage_policy_exact:true,successor_policy_exact:true,mutable_head_ignored:true,temporary_files_ignored:true,scalar_scoring_absent:true},
    claims:{ledger_history_reobserved:true,authoritative_successor_head_reobserved:true,
      ledger_local_durable_replay_protection_reobserved:true,new_external_consequence_observed:false,
      generalized_external_consequence_causality_established:false,causal_proof_certified:false,
      responsibility_for_outcome_adjudicated:false,legal_liability_established:false,legal_effect_established:false,
      moral_blame_assigned:false,moral_correctness_established:false,truth_certified:false,
      global_replay_protection_established:false,distributed_consensus_established:false,
      poai_materialization_event_recorded:false,universal_canonicality_established:false}
  };
  await validateReceipt({receipt, predecessorEntry:recovered.head_entry, storagePolicy, successorPolicy});
  return receipt;
}

async function validateReceipt({receipt, predecessorEntry, storagePolicy, successorPolicy}) {
  GenesisLedger.assertLedgerPolicy(storagePolicy); assertSuccessorPolicy(successorPolicy);
  assert(receipt && receipt.artifact_type === 'ResponsibilityEventAppendLedgerReobservationReceipt' && receipt.artifact_version === '0.1',
    'ResponsibilityEventAppendLedgerReobservationReceipt: invalid receipt');
  assert(!hasScalar(receipt),'ResponsibilityEventAppendLedgerReobservationReceipt: scalar fields prohibited');
  for (const key of FALSE_CLAIMS) assert(receipt.claims && receipt.claims[key] === false,
    `ResponsibilityEventAppendLedgerReobservationReceipt: prohibited claim ${key}`);
  assert(receipt.claims.ledger_history_reobserved === true && receipt.claims.authoritative_successor_head_reobserved === true &&
    receipt.claims.ledger_local_durable_replay_protection_reobserved === true,
    'ResponsibilityEventAppendLedgerReobservationReceipt: positive claims missing');
  parseTime(receipt.observed_at,'observed_at');
  assert(predecessorEntry && predecessorEntry.resulting_event_head,
    'ResponsibilityEventAppendLedgerReobservationReceipt: predecessor ledger entry required');
  assert(parseTime(receipt.observed_at,'observed_at') > parseTime(predecessorEntry.committed_at,'predecessor committed_at'),
    'ResponsibilityEventAppendLedgerReobservationReceipt: stale observation time');
  const storageBinding = await GenesisLedger.policyBinding(storagePolicy);
  const successorBinding = await successorPolicyBinding(successorPolicy);
  const headBinding = await entryBinding(predecessorEntry);
  assert(sameBinding(receipt.storage_policy_binding,storageBinding),'ResponsibilityEventAppendLedgerReobservationReceipt: storage policy binding substitution');
  assert(sameBinding(receipt.successor_policy_binding,successorBinding),'ResponsibilityEventAppendLedgerReobservationReceipt: successor policy binding substitution');
  assert(sameBinding(receipt.head_entry_binding,headBinding),'ResponsibilityEventAppendLedgerReobservationReceipt: head entry binding substitution');
  assert(receipt.ledger_id === storagePolicy.ledger_id,'ResponsibilityEventAppendLedgerReobservationReceipt: ledger ID substitution');
  assert(receipt.entry_count === predecessorEntry.sequence + 1,'ResponsibilityEventAppendLedgerReobservationReceipt: entry count/head sequence mismatch');
  assert(sameHead(receipt.authoritative_successor_head,predecessorEntry.resulting_event_head),
    'ResponsibilityEventAppendLedgerReobservationReceipt: authoritative head substitution');
  assert(Array.isArray(receipt.accepted_event_ids) && receipt.accepted_event_ids.includes(predecessorEntry.resulting_event_head.event_id),
    'ResponsibilityEventAppendLedgerReobservationReceipt: current event ID missing from accepted set');
  assert(Array.isArray(receipt.accepted_event_digests) && receipt.accepted_event_digests.includes(predecessorEntry.resulting_event_head.event_digest.value),
    'ResponsibilityEventAppendLedgerReobservationReceipt: current event digest missing from accepted set');
  assert(receipt.verification && Object.values(receipt.verification).every((v) => v === true),
    'ResponsibilityEventAppendLedgerReobservationReceipt: verification boundary weakened');
  return true;
}

async function observeResponsibilityEventAppendLedger({rootDir, storagePolicy, successorPolicy, observedAt}) {
  const SuccessorLedger = require('./responsibility-event-successor-ledger.js');
  const recovered = await SuccessorLedger.recoverSuccessorLedger(rootDir, storagePolicy, successorPolicy);
  const receipt = await buildReceipt({recovered,storagePolicy,successorPolicy,observedAt});
  return {receipt,recovered};
}

module.exports = {assertSuccessorPolicy,successorPolicyBinding,entryBinding,historyDigest,buildReceipt,validateReceipt,observeResponsibilityEventAppendLedger};
