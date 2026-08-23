'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const { digestJson } = require('./build-responsibility-event-chain.js');
const GenesisLedger = require('./responsibility-event-append-ledger.js');
const Observation = require('./observe-responsibility-event-append-ledger.js');
const SuccessorAppend = require('./append-responsibility-event-successor.js');

const SCALARS = new Set(['score','probability','percentage','weight','likelihood','confidence_score','causal_score','responsibility_score','blame_score','rating']);
const FALSE_CLAIMS = [
  'new_external_consequence_observed','causal_proof_certified','responsibility_for_outcome_adjudicated',
  'legal_liability_established','legal_effect_established','moral_blame_assigned','moral_correctness_established',
  'truth_certified','global_replay_protection_established','distributed_consensus_established',
  'poai_materialization_event_recorded','universal_canonicality_established'
];
const assert=(v,m)=>{if(!v)throw new Error(m);};
const clone=(v)=>JSON.parse(JSON.stringify(v));
const digest=(value)=>({canonicalization:'RFC8785-JCS',digest_algorithm:'SHA-256',digest_encoding:'hex',value});
function hasScalar(v){if(!v||typeof v!=='object')return false;if(Array.isArray(v))return v.some(hasScalar);return Object.entries(v).some(([k,c])=>SCALARS.has(k)||hasScalar(c));}
function parseTime(v,label){const ms=Date.parse(v);assert(Number.isFinite(ms),`ResponsibilityEventSuccessorLedger: invalid ${label}`);return ms;}
function sameBinding(a,b){return !!a&&!!b&&a.artifact_type===b.artifact_type&&a.artifact_ref===b.artifact_ref&&a.digest&&b.digest&&a.digest.value===b.digest.value;}
function sameHead(a,b){return !!a&&!!b&&a.sequence===b.sequence&&a.event_id===b.event_id&&a.event_digest&&b.event_digest&&a.event_digest.value===b.event_digest.value;}
function canonicalEqual(a,b){try{return Binding.canonicalize(a,'$a')===Binding.canonicalize(b,'$b');}catch(_){return false;}}
async function genericBinding(type,ref,artifact){return{artifact_type:type,artifact_ref:ref,digest:digest(await digestJson(artifact))};}
async function successorAppendBinding(receipt){return genericBinding('ResponsibilityEventSuccessorAppendReceipt',receipt.successor_append_receipt_id,receipt);}
async function entryBinding(entry){return Observation.entryBinding(entry);}
function entryBody(entry){const body=clone(entry);delete body.entry_digest;return body;}
async function expectedEntryDigest(entry){return digest(await digestJson(entryBody(entry)));}
function entryFilename(entry){return`${String(entry.sequence).padStart(12,'0')}-${entry.entry_digest.value}.json`;}
function assertFalseClaims(claims,label){for(const key of FALSE_CLAIMS)assert(claims&&claims[key]===false,`${label}: prohibited claim ${key}`);}
function receiptFromEntry(entry){
  if(entry.artifact_type==='ResponsibilityEventAppendLedgerEntry')return entry.validation_bundle.append_receipt;
  if(entry.artifact_type==='ResponsibilityEventSuccessorLedgerEntry')return entry.validation_bundle.successor_append_receipt;
  throw new Error('ResponsibilityEventSuccessorLedger: unsupported entry type');
}
function appendIdFromEntry(entry){const r=receiptFromEntry(entry);return r.append_receipt_id||r.successor_append_receipt_id;}
function eventFromEntry(entry){return SuccessorAppend.eventFromEntry(entry);}

async function validateSuccessorLedgerEntry({entry,storagePolicy,successorPolicy,previousEntry,acceptedAppendIds=new Set(),acceptedEventIds=new Set(),acceptedEventDigests=new Set()}){
  GenesisLedger.assertLedgerPolicy(storagePolicy);Observation.assertSuccessorPolicy(successorPolicy);
  assert(entry&&entry.artifact_type==='ResponsibilityEventSuccessorLedgerEntry'&&entry.artifact_version==='0.1','ResponsibilityEventSuccessorLedger: invalid successor entry');
  assert(previousEntry,'ResponsibilityEventSuccessorLedger: successor entry requires predecessor ledger entry');
  assert(!hasScalar(entry),'ResponsibilityEventSuccessorLedger: scalar fields prohibited');
  assert(entry.ledger_id===storagePolicy.ledger_id,'ResponsibilityEventSuccessorLedger: ledger ID substitution');
  assert(Number.isInteger(entry.sequence)&&entry.sequence===previousEntry.sequence+1&&entry.sequence>=1,'ResponsibilityEventSuccessorLedger: ledger sequence gap or duplicate');
  parseTime(entry.committed_at,'committed_at');assert(parseTime(entry.committed_at,'committed_at')>=parseTime(previousEntry.committed_at,'previous committed_at'),'ResponsibilityEventSuccessorLedger: commit time regression');
  assertFalseClaims(entry.claims,'ResponsibilityEventSuccessorLedgerEntry');
  assert(entry.claims.local_durable_commit_established===true&&entry.claims.authoritative_successor_head_derivable===true&&
    entry.claims.embedded_historical_evidence_bound===true&&entry.claims.ledger_local_durable_replay_protection_established===true&&
    entry.claims.accepted_append_identity_set_recoverable===true&&entry.claims.generic_successor_append_persisted===true,
    'ResponsibilityEventSuccessorLedger: positive entry claims incomplete');
  const expectedPrevious=await entryBinding(previousEntry);assert(sameBinding(entry.previous_entry_binding,expectedPrevious),'ResponsibilityEventSuccessorLedger: previous entry binding substitution');
  const storageBinding=await GenesisLedger.policyBinding(storagePolicy);const successorBinding=await Observation.successorPolicyBinding(successorPolicy);
  assert(sameBinding(entry.storage_policy_binding,storageBinding),'ResponsibilityEventSuccessorLedger: storage policy binding substitution');
  assert(sameBinding(entry.successor_policy_binding,successorBinding),'ResponsibilityEventSuccessorLedger: successor policy binding substitution');
  const bundle=entry.validation_bundle;assert(bundle&&bundle.base_chain&&bundle.successor_source&&bundle.successor_append_receipt,'ResponsibilityEventSuccessorLedger: validation bundle incomplete');
  const priorBase=SuccessorAppend.baseChainFromEntry(previousEntry);assert(canonicalEqual(bundle.base_chain,priorBase),'ResponsibilityEventSuccessorLedger: base chain substitution across history');
  const expectedBaseBinding=await GenesisLedger.chainBinding(priorBase);assert(sameBinding(entry.base_chain_binding,expectedBaseBinding),'ResponsibilityEventSuccessorLedger: base chain binding substitution');
  await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:bundle.successor_append_receipt,predecessorEntry:previousEntry,source:bundle.successor_source,storagePolicy,successorPolicy});
  const expectedReceiptBinding=await successorAppendBinding(bundle.successor_append_receipt);assert(sameBinding(entry.successor_append_receipt_binding,expectedReceiptBinding),'ResponsibilityEventSuccessorLedger: successor append receipt binding substitution');
  assert(sameHead(entry.predecessor_event_head,previousEntry.resulting_event_head),'ResponsibilityEventSuccessorLedger: stale-head/forked append rejected');
  assert(sameHead(entry.predecessor_event_head,bundle.successor_append_receipt.predecessor_event_head),'ResponsibilityEventSuccessorLedger: receipt predecessor head mismatch');
  assert(sameHead(entry.resulting_event_head,bundle.successor_append_receipt.extended_head),'ResponsibilityEventSuccessorLedger: resulting event head substitution');
  assert(entry.resulting_event_head.sequence===entry.predecessor_event_head.sequence+1,'ResponsibilityEventSuccessorLedger: successor event sequence gap');
  assert(parseTime(entry.committed_at,'committed_at')>parseTime(bundle.successor_append_receipt.appended_at,'successor append appended_at'),'ResponsibilityEventSuccessorLedger: commit must occur after successor append receipt');
  const appendId=bundle.successor_append_receipt.successor_append_receipt_id;const event=bundle.successor_append_receipt.appended_event;
  assert(!acceptedAppendIds.has(appendId),'ResponsibilityEventSuccessorLedger: duplicate successor append receipt replay detected');
  assert(!acceptedEventIds.has(event.event_id),'ResponsibilityEventSuccessorLedger: duplicate successor event ID replay detected');
  assert(!acceptedEventDigests.has(event.event_digest.value),'ResponsibilityEventSuccessorLedger: duplicate successor event digest replay detected');
  const expectedDigest=await expectedEntryDigest(entry);assert(entry.entry_digest&&entry.entry_digest.value===expectedDigest.value,'ResponsibilityEventSuccessorLedger: successor ledger entry digest mismatch');
  return true;
}

async function buildSuccessorLedgerEntry({storagePolicy,successorPolicy,previousEntry,validationBundle,committedAt}){
  GenesisLedger.assertLedgerPolicy(storagePolicy);Observation.assertSuccessorPolicy(successorPolicy);assert(previousEntry,'ResponsibilityEventSuccessorLedger: previous entry required');parseTime(committedAt,'committed_at');
  await SuccessorAppend.validateResponsibilityEventSuccessorAppendReceipt({receipt:validationBundle.successor_append_receipt,predecessorEntry:previousEntry,source:validationBundle.successor_source,storagePolicy,successorPolicy});
  const sequence=previousEntry.sequence+1;const previousBinding=await entryBinding(previousEntry);const storageBinding=await GenesisLedger.policyBinding(storagePolicy);
  const successorBinding=await Observation.successorPolicyBinding(successorPolicy);const baseBinding=await GenesisLedger.chainBinding(validationBundle.base_chain);
  const receiptBinding=await successorAppendBinding(validationBundle.successor_append_receipt);
  const seed=`${storagePolicy.ledger_id}|${sequence}|${previousBinding.digest.value}|${receiptBinding.digest.value}|${committedAt}`;
  const idHash=await Binding.sha256Hex(Binding.utf8Bytes(seed));
  const entry={
    $schema:'./responsibility-event-successor-ledger-entry.schema.json',artifact_type:'ResponsibilityEventSuccessorLedgerEntry',artifact_version:'0.1',
    entry_id:`urn:uu-aap:responsibility-event-successor-ledger-entry:${idHash.slice(0,24)}`,ledger_id:storagePolicy.ledger_id,sequence,committed_at:committedAt,
    previous_entry_binding:previousBinding,storage_policy_binding:storageBinding,successor_policy_binding:successorBinding,base_chain_binding:baseBinding,
    validation_bundle:clone(validationBundle),successor_append_receipt_binding:receiptBinding,
    predecessor_event_head:clone(previousEntry.resulting_event_head),resulting_event_head:clone(validationBundle.successor_append_receipt.extended_head),
    claims:{local_durable_commit_established:true,authoritative_successor_head_derivable:true,embedded_historical_evidence_bound:true,
      ledger_local_durable_replay_protection_established:true,accepted_append_identity_set_recoverable:true,generic_successor_append_persisted:true,
      new_external_consequence_observed:false,causal_proof_certified:false,responsibility_for_outcome_adjudicated:false,legal_liability_established:false,
      legal_effect_established:false,moral_blame_assigned:false,moral_correctness_established:false,truth_certified:false,
      global_replay_protection_established:false,distributed_consensus_established:false,poai_materialization_event_recorded:false,universal_canonicality_established:false}
  };
  entry.entry_digest=await expectedEntryDigest(entry);await validateSuccessorLedgerEntry({entry,storagePolicy,successorPolicy,previousEntry});return entry;
}

async function ensureDirectories(rootDir){await fsp.mkdir(rootDir,{recursive:true});await fsp.mkdir(path.join(rootDir,'entries'),{recursive:true});await fsp.mkdir(path.join(rootDir,'tmp'),{recursive:true});}
async function fsyncDirectory(dir){const h=await fsp.open(dir,'r');try{await h.sync();}finally{await h.close();}}
async function recoverSuccessorLedger(rootDir,storagePolicy,successorPolicy){
  GenesisLedger.assertLedgerPolicy(storagePolicy);Observation.assertSuccessorPolicy(successorPolicy);await ensureDirectories(rootDir);
  const entriesDir=path.join(rootDir,'entries');const names=(await fsp.readdir(entriesDir)).sort();for(const name of names)assert(/^\d{12}-[0-9a-f]{64}\.json$/.test(name),`ResponsibilityEventSuccessorLedger: invalid committed entry filename ${name}`);
  const entries=[];const acceptedAppendIds=new Set(),acceptedEventIds=new Set(),acceptedEventDigests=new Set();let previousEntry=null;
  for(const name of names){let entry;try{entry=JSON.parse(await fsp.readFile(path.join(entriesDir,name),'utf8'));}catch(error){throw new Error(`ResponsibilityEventSuccessorLedger: malformed committed entry ${name}: ${error.message}`);}
    assert(name===entryFilename(entry),`ResponsibilityEventSuccessorLedger: committed filename/digest mismatch ${name}`);
    if(entries.length===0){assert(entry.artifact_type==='ResponsibilityEventAppendLedgerEntry','ResponsibilityEventSuccessorLedger: first entry must be immutable genesis entry');
      await GenesisLedger.validateLedgerEntry({entry,ledgerPolicy:storagePolicy,previousEntry:null,acceptedAppendIds,acceptedEventIds,acceptedEventDigests});assert(entry.sequence===0,'ResponsibilityEventSuccessorLedger: genesis sequence must remain 0');
    }else{assert(entry.artifact_type==='ResponsibilityEventSuccessorLedgerEntry','ResponsibilityEventSuccessorLedger: entries after genesis must be typed successor entries');
      await validateSuccessorLedgerEntry({entry,storagePolicy,successorPolicy,previousEntry,acceptedAppendIds,acceptedEventIds,acceptedEventDigests});}
    assert(entry.sequence===entries.length,'ResponsibilityEventSuccessorLedger: non-contiguous recovered sequence');entries.push(entry);
    acceptedAppendIds.add(appendIdFromEntry(entry));const event=eventFromEntry(entry);acceptedEventIds.add(event.event_id);acceptedEventDigests.add(event.event_digest.value);previousEntry=entry;
  }
  const head=entries.length?entries[entries.length-1]:null;return{ledger_id:storagePolicy.ledger_id,entries,head_entry:head,
    authoritative_successor_head:head?clone(head.resulting_event_head):null,accepted_append_receipt_ids:[...acceptedAppendIds].sort(),accepted_event_ids:[...acceptedEventIds].sort(),accepted_event_digests:[...acceptedEventDigests].sort(),
    claims:{authoritative_successor_head_recovered:!!head,ledger_local_durable_replay_protection_established:true,accepted_append_identity_set_recovered:true,
      generic_successor_history_recovered:entries.length>1,global_replay_protection_established:false,distributed_consensus_established:false}};
}
async function withWriterLock(rootDir,fn){await ensureDirectories(rootDir);const lockPath=path.join(rootDir,'.writer.lock');let h;try{h=await fsp.open(lockPath,'wx',0o600);}catch(error){if(error&&error.code==='EEXIST')throw new Error('ResponsibilityEventSuccessorLedger: writer lock already held; fail closed');throw error;}
  try{await h.writeFile(`${JSON.stringify({pid:process.pid,acquired_at:new Date().toISOString()})}\n`,'utf8');await h.sync();return await fn();}finally{try{await h.close();}catch(_){}try{await fsp.unlink(lockPath);}catch(_){}try{await fsyncDirectory(rootDir);}catch(_){}}}
async function commitSuccessorLedgerEntry(rootDir,entry,storagePolicy,successorPolicy){return withWriterLock(rootDir,async()=>{const recovered=await recoverSuccessorLedger(rootDir,storagePolicy,successorPolicy);const previousEntry=recovered.head_entry;
  await validateSuccessorLedgerEntry({entry,storagePolicy,successorPolicy,previousEntry,acceptedAppendIds:new Set(recovered.accepted_append_receipt_ids),acceptedEventIds:new Set(recovered.accepted_event_ids),acceptedEventDigests:new Set(recovered.accepted_event_digests)});
  const entriesDir=path.join(rootDir,'entries'),tmpDir=path.join(rootDir,'tmp'),name=entryFilename(entry),prefix=`${String(entry.sequence).padStart(12,'0')}-`;const existing=await fsp.readdir(entriesDir);assert(!existing.some((x)=>x.startsWith(prefix)),'ResponsibilityEventSuccessorLedger: duplicate committed ledger sequence');
  const finalPath=path.join(entriesDir,name),tempPath=path.join(tmpDir,`${name}.${process.pid}.${Date.now()}.tmp`);let h=null;try{h=await fsp.open(tempPath,'wx',0o600);await h.writeFile(`${JSON.stringify(entry,null,2)}\n`,'utf8');await h.sync();await h.close();h=null;await fsp.rename(tempPath,finalPath);await fsyncDirectory(entriesDir);}catch(error){if(h){try{await h.close();}catch(_){}}try{await fsp.unlink(tempPath);}catch(_){}throw error;}
  const after=await recoverSuccessorLedger(rootDir,storagePolicy,successorPolicy);assert(after.head_entry&&after.head_entry.entry_digest.value===entry.entry_digest.value,'ResponsibilityEventSuccessorLedger: durable recovered head mismatch');return after;});}
async function buildAndCommitSuccessorLedgerEntry(rootDir,args){const recovered=await recoverSuccessorLedger(rootDir,args.storagePolicy,args.successorPolicy);assert(recovered.head_entry,'ResponsibilityEventSuccessorLedger: genesis entry required before successors');const entry=await buildSuccessorLedgerEntry({...args,previousEntry:recovered.head_entry});return commitSuccessorLedgerEntry(rootDir,entry,args.storagePolicy,args.successorPolicy);}

module.exports={successorAppendBinding,entryBinding,entryFilename,expectedEntryDigest,validateSuccessorLedgerEntry,buildSuccessorLedgerEntry,recoverSuccessorLedger,commitSuccessorLedgerEntry,buildAndCommitSuccessorLedgerEntry};
