'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'positive.fixture.json'), 'utf8'));
JSON.parse(fs.readFileSync(path.join(root, 'future-optionality-non-commitment.schema.json'), 'utf8'));

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function assert(v,m){ if(!v) throw new Error(m); }
function nonEmpty(v,m){ assert(typeof v === 'string' && v.length > 0,m); }
function validTime(v,m){ nonEmpty(v,m); assert(!Number.isNaN(Date.parse(v)),m); }
function exactKeys(o, keys, m){ assert(o && typeof o === 'object' && !Array.isArray(o),m); assert(JSON.stringify(Object.keys(o).sort()) === JSON.stringify([...keys].sort()),m); }

const TOP=['$schema','artifact_type','artifact_version','receipt_id','future_representation','provenance','horizon','evidence_refs','probability','lifecycle','claims'];
const CLAIMS=['intent_established','obligation_established','authorization_established','action_permit_established','required_successor_established','inevitability_established','fault_established','responsibility_established','liability_established','sanction_authorized','external_action_performed'];
const KINDS=new Set(['forecast','future_target','plan','successor_proposal','scenario']);
const STATES=new Set(['active','superseded','abandoned','realized','expired']);
const ORIGINS=new Set(['human','system','mixed','external','unknown']);

function validate(r){
  exactKeys(r,TOP,'receipt exact keys required');
  assert(r.$schema === './future-optionality-non-commitment.schema.json','schema binding mismatch');
  assert(r.artifact_type === 'FutureOptionalityNonCommitmentReceipt','artifact type mismatch');
  assert(r.artifact_version === '0.1','artifact version mismatch');
  nonEmpty(r.receipt_id,'receipt id required');

  exactKeys(r.future_representation,['representation_ref','representation_kind','target_ref','created_at'],'future representation exact keys required');
  nonEmpty(r.future_representation.representation_ref,'representation ref required');
  assert(KINDS.has(r.future_representation.representation_kind),'unsupported representation kind');
  nonEmpty(r.future_representation.target_ref,'target ref required');
  validTime(r.future_representation.created_at,'created_at invalid');

  exactKeys(r.provenance,['source_ref','origin_class'],'provenance exact keys required');
  nonEmpty(r.provenance.source_ref,'source ref required');
  assert(ORIGINS.has(r.provenance.origin_class),'unsupported origin class');

  exactKeys(r.horizon,['starts_at','ends_at','bounded'],'horizon exact keys required');
  validTime(r.horizon.starts_at,'starts_at invalid');
  validTime(r.horizon.ends_at,'ends_at invalid');
  assert(r.horizon.bounded === true,'future horizon must be bounded');
  const start=Date.parse(r.horizon.starts_at), end=Date.parse(r.horizon.ends_at), created=Date.parse(r.future_representation.created_at);
  assert(end > start,'horizon must end after start');
  assert(start >= created,'horizon cannot predate representation');

  assert(Array.isArray(r.evidence_refs) && r.evidence_refs.length > 0,'evidence refs required');
  assert(new Set(r.evidence_refs).size === r.evidence_refs.length,'duplicate evidence refs');
  r.evidence_refs.forEach((x,i)=>nonEmpty(x,`evidence ref ${i} required`));
  assert(r.probability === null || (typeof r.probability === 'number' && r.probability >= 0 && r.probability <= 1),'probability out of range');

  exactKeys(r.lifecycle,['state','changed_at','successor_representation_ref','predecessor_provenance_preserved'],'lifecycle exact keys required');
  assert(STATES.has(r.lifecycle.state),'unsupported lifecycle state');
  validTime(r.lifecycle.changed_at,'changed_at invalid');
  assert(Date.parse(r.lifecycle.changed_at) >= created,'lifecycle change cannot predate representation');
  assert(r.lifecycle.predecessor_provenance_preserved === true,'predecessor provenance must be preserved');
  if(r.lifecycle.state === 'superseded') nonEmpty(r.lifecycle.successor_representation_ref,'superseded state requires successor ref');
  else assert(r.lifecycle.successor_representation_ref === null,'only superseded state may bind successor ref');
  if(r.lifecycle.state === 'expired') assert(Date.parse(r.lifecycle.changed_at) >= end,'expired state cannot predate horizon end');

  exactKeys(r.claims,CLAIMS,'claims exact keys required');
  CLAIMS.forEach(k=>assert(r.claims[k] === false,`${k}: prohibited escalation`));
  return true;
}

validate(fixture);
function mustReject(name, mutate){ const r=clone(fixture); mutate(r); let rejected=false; try{validate(r);}catch(_){rejected=true;} assert(rejected,`${name}: mutation accepted`); }
const cases=[
  ['missing future representation',r=>{r.future_representation.representation_ref='';}],
  ['unsupported representation kind',r=>{r.future_representation.representation_kind='obligation';}],
  ['missing provenance',r=>{r.provenance.source_ref='';}],
  ['unbounded horizon',r=>{r.horizon.bounded=false;}],
  ['reversed horizon',r=>{r.horizon.ends_at=r.horizon.starts_at;}],
  ['horizon before creation',r=>{r.horizon.starts_at='2026-08-25T03:59:00Z';}],
  ['missing evidence',r=>{r.evidence_refs=[];}],
  ['duplicate evidence',r=>{r.evidence_refs.push(r.evidence_refs[0]);}],
  ['probability above one',r=>{r.probability=1.01;}],
  ['forecast to intent',r=>{r.claims.intent_established=true;}],
  ['forecast to obligation',r=>{r.claims.obligation_established=true;}],
  ['plan to authorization',r=>{r.claims.authorization_established=true;}],
  ['plan to ActionPermit',r=>{r.claims.action_permit_established=true;}],
  ['successor proposal to required state',r=>{r.claims.required_successor_established=true;}],
  ['probability to inevitability',r=>{r.probability=1;r.claims.inevitability_established=true;}],
  ['replanning to fault',r=>{r.lifecycle.state='abandoned';r.claims.fault_established=true;}],
  ['replanning to responsibility',r=>{r.lifecycle.state='abandoned';r.claims.responsibility_established=true;}],
  ['replanning to liability',r=>{r.lifecycle.state='abandoned';r.claims.liability_established=true;}],
  ['sanction escalation',r=>{r.claims.sanction_authorized=true;}],
  ['external action overclaim',r=>{r.claims.external_action_performed=true;}],
  ['abandonment erases provenance',r=>{r.lifecycle.state='abandoned';r.lifecycle.predecessor_provenance_preserved=false;}],
  ['supersession without successor ref',r=>{r.lifecycle.state='superseded';}],
  ['active with successor carry-forward',r=>{r.lifecycle.successor_representation_ref='urn:future:2';}],
  ['premature expiry',r=>{r.lifecycle.state='expired';}],
  ['unexpected field',r=>{r.required_future=true;}]
];
for(const [n,m] of cases) mustReject(n,m);
console.log(`UU_AAP_FUTURE_OPTIONALITY_NON_COMMITMENT_V0_1_PASS negative_vectors=${cases.length}`);
