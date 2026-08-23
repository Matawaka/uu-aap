'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const GenesisLedger = require('./responsibility-event-append-ledger.js');
const Observation = require('./observe-responsibility-event-append-ledger.js');
const SuccessorAppend = require('./append-responsibility-event-successor.js');
const SuccessorLedger = require('./responsibility-event-successor-ledger.js');

const repoRoot = path.resolve(__dirname, '../../..');
const assert = (v,m) => { if (!v) throw new Error(m); };
const clone = (v) => JSON.parse(JSON.stringify(v));
const readJson = (f) => JSON.parse(fs.readFileSync(f,'utf8'));
const writeJson = (f,v) => fs.writeFileSync(f,`${JSON.stringify(v,null,2)}\n`);
function runAppend() {
  const run = cp.spawnSync('node',['protocols/integration/v0.1/test-responsibility-event-append.js','/tmp/successor-genesis-append.json','/tmp/successor-genesis-reobservation.json'],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if (run.error) throw run.error;
  assert(run.status===0,`successor prerequisite failed\n${run.stdout||''}\n${run.stderr||''}`);
}
async function reject(name,fn,pattern){let error=null;try{await fn();}catch(e){error=e;}assert(error,`${name}: expected failure`);if(pattern)assert(pattern.test(error.message),`${name}: unexpected error: ${error.message}`);return{name,error:error.message};}
function copyLedger(source){const target=fs.mkdtempSync(path.join(os.tmpdir(),'uu-aap-successor-ledger-copy-'));fs.cpSync(source,target,{recursive:true});return target;}
function committedFiles(root){return fs.readdirSync(path.join(root,'entries')).sort().map((n)=>path.join(root,'entries',n));}
function runRecovery(root,storagePath,successorPath,output){const run=cp.spawnSync('node',['protocols/integration/v0.1/recover-responsibility-event-successor-ledger.js',root,storagePath,successorPath,output],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']});if(run.error)throw run.error;assert(run.status===0,`separate recovery failed\n${run.stdout||''}\n${run.stderr||''}`);return readJson(output);}

async function main(){
  runAppend();
  const storagePolicyPath=path.join(repoRoot,'protocols/integration/v0.1/policies/reference.responsibility-event-append-ledger-policy.json');
  const successorPolicyPath=path.join(repoRoot,'protocols/integration/v0.1/policies/reference.responsibility-event-successor-policy.json');
  const storagePolicy=readJson(storagePolicyPath),successorPolicy=readJson(successorPolicyPath);
  const baseChain=readJson('/tmp/append-base-chain.json');
  const genesisBundle={base_chain:baseChain,origin_sources:{
    outcome_observation:readJson('/tmp/causal-outcome-observation.json'),responsibility_trace:readJson('/tmp/causal-responsibility-trace.json'),
    causal_assessment:readJson('/tmp/counterfactual-causal-attribution.json'),counterfactual_assessment:readJson('/tmp/qualification-counterfactual.json'),
    causal_qualification:readJson('/tmp/responsibility-attribution-qualification.json'),responsibility_attribution:readJson('/tmp/event-chain-attribution.json')},
    reobservation:readJson('/tmp/successor-genesis-reobservation.json'),append_receipt:readJson('/tmp/successor-genesis-append.json')};
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'uu-aap-successor-ledger-'));
  const genesisEntry=await GenesisLedger.buildLedgerEntry({ledgerPolicy:storagePolicy,validationBundle:genesisBundle,committedAt:'2026-08-23T08:43:02Z'});
  await GenesisLedger.commitLedgerEntry(root,genesisEntry,storagePolicy);
  let recovered=await SuccessorLedger.recoverSuccessorLedger(root,storagePolicy,successorPolicy);
  assert(recovered.entries.length===1&&recovered.authoritative_successor_head.sequence===6,'genesis head 6 not recovered by successor ledger');

  const obs1=(await Observation.observeResponsibilityEventAppendLedger({rootDir:root,storagePolicy,successorPolicy,observedAt:'2026-08-23T08:43:03Z'})).receipt;
  const receipt7=await SuccessorAppend.buildResponsibilityEventSuccessorAppendReceipt({predecessorEntry:genesisEntry,source:obs1,storagePolicy,successorPolicy,appendedAt:'2026-08-23T08:43:04Z'});
  const bundle7={base_chain:baseChain,successor_source:obs1,successor_append_receipt:receipt7};
  const entry1=await SuccessorLedger.buildSuccessorLedgerEntry({storagePolicy,successorPolicy,previousEntry:genesisEntry,validationBundle:bundle7,committedAt:'2026-08-23T08:43:05Z'});
  recovered=await SuccessorLedger.commitSuccessorLedgerEntry(root,entry1,storagePolicy,successorPolicy);
  assert(recovered.entries.length===2&&recovered.authoritative_successor_head.sequence===7,'event 7 durable head not established');
  const restart7=runRecovery(root,storagePolicyPath,successorPolicyPath,'/tmp/responsibility-event-successor-recovery-7.json');
  assert(restart7.entries.length===2&&restart7.authoritative_successor_head.sequence===7,'restart did not recover event 7');

  const obs2=(await Observation.observeResponsibilityEventAppendLedger({rootDir:root,storagePolicy,successorPolicy,observedAt:'2026-08-23T08:43:06Z'})).receipt;
  const receipt8=await SuccessorAppend.buildResponsibilityEventSuccessorAppendReceipt({predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy,appendedAt:'2026-08-23T08:43:07Z'});
  const bundle8={base_chain:baseChain,successor_source:obs2,successor_append_receipt:receipt8};
  const entry2=await SuccessorLedger.buildSuccessorLedgerEntry({storagePolicy,successorPolicy,previousEntry:entry1,validationBundle:bundle8,committedAt:'2026-08-23T08:43:08Z'});
  recovered=await SuccessorLedger.commitSuccessorLedgerEntry(root,entry2,storagePolicy,successorPolicy);
  const restart8=runRecovery(root,storagePolicyPath,successorPolicyPath,'/tmp/responsibility-event-successor-recovery-8.json');
  assert(restart8.entries.length===3&&restart8.authoritative_successor_head.sequence===8,'restart did not recover event 8');
  assert(receipt7.appended_event.event_id!==receipt8.appended_event.event_id,'successor events must be distinct');
  assert(receipt8.appended_event.predecessor_event_digest.value===receipt7.appended_event.event_digest.value,'event 8 must link exactly to event 7');
  assert(receipt7.claims.new_external_consequence_observed===false&&receipt8.claims.new_external_consequence_observed===false,'maintenance successors cannot claim external consequence');
  assert(recovered.claims.ledger_local_durable_replay_protection_established===true&&recovered.claims.global_replay_protection_established===false,'replay assurance boundary drift');

  writeJson('/tmp/responsibility-event-successor-source-7.json',obs1);writeJson('/tmp/responsibility-event-successor-append-7.json',receipt7);writeJson('/tmp/responsibility-event-successor-ledger-entry-1.json',entry1);
  writeJson('/tmp/responsibility-event-successor-source-8.json',obs2);writeJson('/tmp/responsibility-event-successor-append-8.json',receipt8);writeJson('/tmp/responsibility-event-successor-ledger-entry-2.json',entry2);

  const obsFork=(await Observation.buildReceipt({recovered:restart7,storagePolicy,successorPolicy,observedAt:'2026-08-23T08:43:06.500Z'}));
  const receiptFork=await SuccessorAppend.buildResponsibilityEventSuccessorAppendReceipt({predecessorEntry:entry1,source:obsFork,storagePolicy,successorPolicy,appendedAt:'2026-08-23T08:43:06.700Z'});
  const entryFork=await SuccessorLedger.buildSuccessorLedgerEntry({storagePolicy,successorPolicy,previousEntry:entry1,validationBundle:{base_chain:baseChain,successor_source:obsFork,successor_append_receipt:receiptFork},committedAt:'2026-08-23T08:43:09Z'});

  const vectors=[];
  vectors.push(await reject('untyped_source_artifact',async()=>SuccessorAppend.buildResponsibilityEventSuccessorAppendReceipt({predecessorEntry:entry2,source:{artifact_type:'Other'},storagePolicy,successorPolicy,appendedAt:'2026-08-23T08:43:10Z'}),/typed ledger reobservation source required/));
  vectors.push(await reject('unsupported_source_adapter_policy',async()=>{const p=clone(successorPolicy);p.allowed_source_adapters=['other'];await SuccessorAppend.buildResponsibilityEventSuccessorAppendReceipt({predecessorEntry:entry2,source:obs2,storagePolicy,successorPolicy:p,appendedAt:'2026-08-23T08:43:10Z'});},/source adapter policy drift|unsupported/));
  vectors.push(await reject('source_head_binding_substitution',async()=>{const x=clone(obs2);x.head_entry_binding.digest.value='0'.repeat(64);await Observation.validateReceipt({receipt:x,predecessorEntry:entry1,storagePolicy,successorPolicy});},/head entry binding substitution/));
  vectors.push(await reject('source_stale_observation_time',async()=>{const x=clone(obs2);x.observed_at=entry1.committed_at;await Observation.validateReceipt({receipt:x,predecessorEntry:entry1,storagePolicy,successorPolicy});},/stale observation time/));
  vectors.push(await reject('source_storage_policy_binding_substitution',async()=>{const x=clone(obs2);x.storage_policy_binding.digest.value='0'.repeat(64);await Observation.validateReceipt({receipt:x,predecessorEntry:entry1,storagePolicy,successorPolicy});},/storage policy binding substitution/));
  vectors.push(await reject('successor_source_binding_substitution',async()=>{const x=clone(receipt8);x.source_binding.digest.value='0'.repeat(64);await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/source binding substitution/));
  vectors.push(await reject('successor_predecessor_head_substitution',async()=>{const x=clone(receipt8);x.predecessor_event_head.event_digest.value='0'.repeat(64);await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/predecessor head substitution/));
  vectors.push(await reject('successor_sequence_skip',async()=>{const x=clone(receipt8);x.appended_event.sequence+=1;await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/successor sequence substitution/));
  vectors.push(await reject('successor_predecessor_digest_substitution',async()=>{const x=clone(receipt8);x.appended_event.predecessor_event_digest.value='0'.repeat(64);await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/predecessor event digest substitution/));
  vectors.push(await reject('successor_semantic_drift',async()=>{const x=clone(receipt8);x.appended_event.semantic_binding.action='other.action';await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/semantic frontier drift/));
  vectors.push(await reject('successor_effect_drift',async()=>{const x=clone(receipt8);x.appended_event.effect_frontier.tree_sha='0'.repeat(40);await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/effect frontier drift/));
  vectors.push(await reject('successor_event_id_substitution',async()=>{const x=clone(receipt8);x.appended_event.event_id='urn:uu-aap:responsibility-event:other';await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/event digest substitution|extended head substitution|receipt ID substitution/));
  vectors.push(await reject('successor_event_digest_substitution',async()=>{const x=clone(receipt8);x.appended_event.event_digest.value='0'.repeat(64);await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/event digest substitution/));
  vectors.push(await reject('successor_receipt_id_substitution',async()=>{const x=clone(receipt8);x.successor_append_receipt_id='urn:uu-aap:responsibility-event-successor-append-receipt:other';await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/receipt ID substitution/));
  vectors.push(await reject('assurance_downgrade',async()=>{const x=clone(receipt8);x.appended_event.assurance_snapshot.chain_integrity_reobserved=false;await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/assurance monotonicity violation/));
  vectors.push(await reject('assurance_causal_upgrade',async()=>{const x=clone(receipt8);x.appended_event.assurance_snapshot.causal_proof_certified=true;await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/assurance monotonicity violation/));
  vectors.push(await reject('successor_external_consequence_overclaim',async()=>{const x=clone(receipt8);x.claims.new_external_consequence_observed=true;await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/prohibited claim new_external_consequence_observed/));
  vectors.push(await reject('successor_legal_overclaim',async()=>{const x=clone(receipt8);x.claims.legal_liability_established=true;await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/prohibited claim legal_liability_established/));
  vectors.push(await reject('successor_global_replay_overclaim',async()=>{const x=clone(receipt8);x.claims.global_replay_protection_established=true;await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/prohibited claim global_replay_protection_established/));
  vectors.push(await reject('successor_scalar_injection',async()=>{const x=clone(receipt8);x.responsibility_score=.8;await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:x,predecessorEntry:entry1,source:obs2,storagePolicy,successorPolicy});},/scalar fields prohibited/));
  vectors.push(await reject('entry_previous_binding_substitution',async()=>{const x=clone(entry2);x.previous_entry_binding.digest.value='0'.repeat(64);await SuccessorLedger.validateSuccessorLedgerEntry({entry:x,storagePolicy,successorPolicy,previousEntry:entry1});},/previous entry binding substitution/));
  vectors.push(await reject('entry_sequence_skip',async()=>{const x=clone(entry2);x.sequence+=1;await SuccessorLedger.validateSuccessorLedgerEntry({entry:x,storagePolicy,successorPolicy,previousEntry:entry1});},/ledger sequence gap or duplicate/));
  vectors.push(await reject('entry_receipt_binding_substitution',async()=>{const x=clone(entry2);x.successor_append_receipt_binding.digest.value='0'.repeat(64);await SuccessorLedger.validateSuccessorLedgerEntry({entry:x,storagePolicy,successorPolicy,previousEntry:entry1});},/successor append receipt binding substitution/));
  vectors.push(await reject('entry_truth_overclaim',async()=>{const x=clone(entry2);x.claims.truth_certified=true;await SuccessorLedger.validateSuccessorLedgerEntry({entry:x,storagePolicy,successorPolicy,previousEntry:entry1});},/prohibited claim truth_certified/));
  vectors.push(await reject('duplicate_successor_receipt_replay',async()=>SuccessorLedger.validateSuccessorLedgerEntry({entry:entry2,storagePolicy,successorPolicy,previousEntry:entry1,acceptedAppendIds:new Set([receipt8.successor_append_receipt_id])}),/duplicate successor append receipt replay detected/));
  vectors.push(await reject('duplicate_successor_event_replay',async()=>SuccessorLedger.validateSuccessorLedgerEntry({entry:entry2,storagePolicy,successorPolicy,previousEntry:entry1,acceptedEventIds:new Set([receipt8.appended_event.event_id])}),/duplicate successor event ID replay detected/));
  vectors.push(await reject('stale_head_fork_commit',async()=>SuccessorLedger.commitSuccessorLedgerEntry(root,entryFork,storagePolicy,successorPolicy),/ledger sequence gap or duplicate|previous entry binding substitution|stale-head/));
  vectors.push(await reject('successor_policy_substitution',async()=>{const p=clone(successorPolicy);p.policy_version=2;await SuccessorLedger.recoverSuccessorLedger(root,storagePolicy,p);},/successor policy substitution/));
  vectors.push(await reject('storage_policy_substitution',async()=>{const p=clone(storagePolicy);p.policy_version=2;await SuccessorLedger.recoverSuccessorLedger(root,p,successorPolicy);},/policy version substitution/));
  const corrupt=copyLedger(root);const files=committedFiles(corrupt);const changed=readJson(files[1]);changed.validation_bundle.successor_append_receipt.extension_digest.value='0'.repeat(64);writeJson(files[1],changed);
  vectors.push(await reject('corrupted_historical_successor_entry',async()=>SuccessorLedger.recoverSuccessorLedger(corrupt,storagePolicy,successorPolicy),/extension digest substitution|successor ledger entry digest mismatch/));
  writeJson(path.join(root,'HEAD.json'),{sequence:999,event_id:'forged'});writeJson(path.join(root,'tmp','forged.tmp'),{forged:true});const ignored=await SuccessorLedger.recoverSuccessorLedger(root,storagePolicy,successorPolicy);assert(ignored.authoritative_successor_head.sequence===8,'forged mutable HEAD/tmp became authoritative');
  fs.writeFileSync(path.join(root,'.writer.lock'),'held\n');vectors.push(await reject('writer_lock_collision',async()=>SuccessorLedger.commitSuccessorLedgerEntry(root,entryFork,storagePolicy,successorPolicy),/writer lock already held/));fs.unlinkSync(path.join(root,'.writer.lock'));

  console.log(JSON.stringify({suite:'UU-AAP ResponsibilityEventSuccessorAppend v0.1',ledger_id:storagePolicy.ledger_id,
    entry_count:recovered.entries.length,first_generic_successor_sequence:receipt7.extended_head.sequence,second_generic_successor_sequence:receipt8.extended_head.sequence,
    authoritative_successor_head_sequence:recovered.authoritative_successor_head.sequence,event_7_id:receipt7.appended_event.event_id,event_8_id:receipt8.appended_event.event_id,
    predecessor_link_7_to_8:receipt8.appended_event.predecessor_event_digest.value===receipt7.appended_event.event_digest.value,
    restart_recovery_to_8_verified:true,ledger_local_durable_replay_protection_established:recovered.claims.ledger_local_durable_replay_protection_established,
    global_replay_protection_established:recovered.claims.global_replay_protection_established,distributed_consensus_established:recovered.claims.distributed_consensus_established,
    new_external_consequence_observed:false,negative_vectors:vectors.length},null,2));
}

main().catch((error)=>{console.error(error&&error.stack?error.stack:error);process.exit(1);});
