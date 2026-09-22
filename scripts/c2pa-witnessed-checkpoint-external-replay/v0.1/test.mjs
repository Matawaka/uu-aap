import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, copyFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {parseJSON, verifyEvidence, sha256, parseVkey, quorumAnalysis, projectReports, checkSdkReport} from './verify.mjs';
const here=dirname(fileURLToPath(import.meta.url));
const original=readFileSync(join(here,'bundle.json'));
const inputs=parseJSON(readFileSync(join(here,'inputs.json')));
const clone=o=>structuredClone(o), enc=o=>Buffer.from(JSON.stringify(o));
function frame() {return {i:clone(inputs),b:parseJSON(original),v:clone(inputs.successor_observation)};}
function resignEnvelope(f) {
  const raw=enc(f.b),loc=f.v.external_reference.location;
  loc.hash=Buffer.from(sha256(raw),'hex').toString('base64');loc.size=raw.length;return raw;
}
function noteEdit(f, fn) {
  const lines=f.b.checkpoint.signed_note.trimEnd().split('\n');fn(lines);
  const note=lines.join('\n')+'\n';f.b.checkpoint.signed_note=note;
  f.b.checkpoint.sha256=sha256(note);f.b.checkpoint.signed_body_sha256=sha256(lines.slice(0,3).join('\n')+'\n');
}
function corruptLine(lines,n,offset=-1) {
  const parts=lines[n].split(' '),b=Buffer.from(parts[2],'base64');
  b[offset<0?b.length+offset:offset]^=1;parts[2]=b.toString('base64');lines[n]=parts.join(' ');
}
function rejects(name, fn, code, wrap=true) {
  test(name,()=>{const f=frame();fn(f);const raw=wrap?resignEnvelope(f):original;
    assert.throws(()=>verifyEvidence(f.i,raw,f.v),new RegExp(code));});
}
test('original frozen vector: independent Node crypto and fingerprint',()=>{
  const r=verifyEvidence(inputs,original);
  assert.equal(r.semantic_fingerprint_sha256,inputs.expected.semantic_fingerprint_sha256);
  assert.equal(r.verified_witnesses.length,2);
  assert.equal(r.historical_c2pa_asset_revalidated,false);
  assert.equal(r.external_reviewer_execution,false);
  assert.equal(r.historical_receipt_used_as_oracle,false);
});
test('standalone directory, no predecessor source, no historical receipt, no npm',()=>{
  const dir=mkdtempSync(join(tmpdir(),'c2pa-replay-'));
  try {
    for(const f of ['verify.mjs','inputs.json','pins.json','bundle.json']) copyFileSync(join(here,f),join(dir,f));
    const r=spawnSync(process.execPath,[join(dir,'verify.mjs')],{encoding:'utf8',timeout:10000,cwd:dir});
    assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).inclusion_verified,true);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
rejects('activeManifest hash substitution',f=>f.b.subject.active_manifest.hash_hex='00'.repeat(32),'PREDECESSOR_MISMATCH');
rejects('claimSignature substitution',f=>f.b.subject.claim_signature.hash_hex='00'.repeat(32),'PREDECESSOR_MISMATCH');
rejects('predecessor inconsistent encodings',f=>f.i.predecessor.active_manifest.hash_hex='00'.repeat(32),'SUBJECT_HASH_ENCODINGS');
rejects('parent relation',f=>f.i.predecessor.relationship='componentOf','PARENT_RELATIONSHIP');
rejects('profile version',f=>f.b.profile_version='0.2','BUNDLE_VERSION');
rejects('subject scope',f=>f.b.subject_scope='SUCCESSOR','SUBJECT_SCOPE');
rejects('hash algorithm drift',f=>f.b.subject.hash_algorithm='sha512','COMMITMENT_DOMAIN');
rejects('commitment domain',f=>f.b.subject.commitment_domain='hostile','COMMITMENT_DOMAIN');
rejects('commitment digest',f=>f.b.subject.commitment_preimage_sha256='00'.repeat(32),'COMMITMENT_MISMATCH');
rejects('policy digest in subject',f=>f.b.subject.witness_policy_sha256='00'.repeat(32),'SUBJECT_POLICY');
rejects('extra bundle fields',f=>f.b.authority=true,'BUNDLE_FIELDS');
rejects('wrong leaf index',f=>f.b.log.leaf_index=0,'INCLUSION_SHAPE');
rejects('boolean leaf index',f=>f.b.log.leaf_index=true,'INCLUSION_SHAPE');
rejects('wrong tree size',f=>f.b.log.tree_size=3,'INCLUSION_SHAPE');
rejects('proof alteration',f=>f.b.log.inclusion_proof_b64[0]=Buffer.alloc(32).toString('base64'),'INCLUSION_PROOF');
rejects('extra proof element',f=>f.b.log.inclusion_proof_b64.push(f.b.log.inclusion_proof_b64[0]),'INCLUSION_SHAPE');
rejects('log origin alteration',f=>f.b.log.origin='other/log','LOG_ORIGIN');
rejects('checkpoint root alteration with recomputed hashes',f=>noteEdit(f,l=>l[2]=Buffer.alloc(32).toString('base64')),'CHECKPOINT_ROOT_OR_ORIGIN');
rejects('log signature corruption with recomputed hashes',f=>noteEdit(f,l=>corruptLine(l,4)),'LOG_SIGNATURE_INVALID');
rejects('witness signature corruption with recomputed hashes',f=>noteEdit(f,l=>corruptLine(l,5)),'WITNESS_SIGNATURE_INVALID');
rejects('log vkey substitution',f=>f.b.checkpoint.log_vkey=f.i.verification_configuration.policy.witnesses[0].vkey,'LOG_KEY_SUBSTITUTION');
rejects('unknown witness not counted',f=>noteEdit(f,l=>l[6]=l[6].replace('witness-b','witness-x')),'UNKNOWN_WITNESS');
rejects('duplicate name cannot inflate quorum',f=>noteEdit(f,l=>l[6]=l[5]),'DUPLICATE_WITNESS');
rejects('missing cosignature',f=>noteEdit(f,l=>l.pop()),'QUORUM_UNSATISFIED');
rejects('missing log signature',f=>noteEdit(f,l=>l.splice(4,1)),'LOG_SIGNATURE_MISSING');
rejects('witness signed timestamp differs from observation',f=>f.b.witness_observation.cosigned_witnesses[0].timestamp++,'WITNESS_OBSERVATION_MISMATCH');
rejects('observation name differs from signature',f=>f.b.witness_observation.cosigned_witnesses[1].name='other','WITNESS_OBSERVATION_MISMATCH');
rejects('signed timestamp exceeds 63-bit limit',f=>noteEdit(f,l=>{const p=l[5].split(' '),b=Buffer.from(p[2],'base64');b[4]|=128;p[2]=b.toString('base64');l[5]=p.join(' ');}),'TIMESTAMP_RANGE');
rejects('policy version substitution',f=>f.b.witness_policy.policy.version='0.2','POLICY_SUBSTITUTION');
rejects('policy origin substitution',f=>f.b.witness_policy.policy.origin='other/log','POLICY_SUBSTITUTION');
rejects('policy key substitution',f=>f.b.witness_policy.policy.witnesses[0].vkey=f.b.witness_policy.policy.witnesses[1].vkey,'POLICY_SUBSTITUTION');
rejects('policy digest substitution',f=>f.b.witness_policy.policy_sha256='00'.repeat(32),'POLICY_DIGEST');
rejects('threshold substitution',f=>f.b.witness_policy.policy.threshold=1,'POLICY_SUBSTITUTION');
rejects('quorum analysis promotion',f=>f.b.witness_policy.analysis.witness_independence_proven=true,'POLICY_ANALYSIS');
for(const k of inputs.expected.all_false_claims)
  rejects('forbidden claim '+k,f=>f.b.semantic_boundaries[k]=true,'SEMANTIC_PROMOTION');
rejects('false must not be numeric zero',f=>f.b.semantic_boundaries.authority_created=0,'SEMANTIC_PROMOTION');
rejects('external URL substitution',f=>f.v.external_reference.location.url='https://example.invalid/other','EXTERNAL_URL',false);
rejects('external hash substitution',f=>f.v.external_reference.location.hash=Buffer.alloc(32).toString('base64'),'EXTERNAL_HASH',false);
rejects('external size substitution',f=>f.v.external_reference.location.size++,'EXTERNAL_SIZE',false);
rejects('external type substitution',f=>f.v.external_reference.location['dc:format']='text/plain','EXTERNAL_ALGORITHM_OR_TYPE',false);
rejects('external alg substitution',f=>f.v.external_reference.location.alg='sha512','EXTERNAL_ALGORITHM_OR_TYPE',false);
rejects('custom label reinterpretation',f=>f.v.external_reference.label='custom.assertion','EXTERNAL_REFERENCE_FIELDS',false);
rejects('parent mismatch in active assertion',f=>f.v.parent_assertion.activeManifest.hash=Buffer.alloc(32).toString('base64'),'ACTIVE_PARENT_ASSERTION',false);
rejects('parent mismatch in normal report',f=>f.v.parent_ingredients[0].active_manifest='other','ACTIVE_PARENT_LINK',false);
rejects('two parents',f=>f.v.parent_ingredients.push(f.v.parent_ingredients[0]),'PARENT_COUNT',false);
rejects('same successor used as subject',f=>f.v.active_manifest=f.i.predecessor.active_manifest.url.split('/c2pa/')[1],'SAME_CLAIM_SELF_REFERENCE',false);
rejects('hard binding in update',f=>f.v.assertion_labels.push('c2pa.hash.data'),'UPDATE_ASSERTION_SURFACE',false);
rejects('external ref absent from gathered assertions',f=>f.v.claim.gathered_assertions=f.v.claim.gathered_assertions.filter(x=>!x.url.endsWith('/c2pa.external-reference')),'CLAIM_ASSERTION_LINK',false);
test('C2SP key ID declaration checked, not silently recomputed',()=>{
  const key=inputs.verification_configuration.log_vkey.replace('+e01168e2+','+00000000+');
  assert.throws(()=>parseVkey(key,1),/VKEY_ID/);
});
test('intersection of two majorities may contain only Byzantine witness',()=>{
  const qa=new Set(['A','B']), qb=new Set(['B','C']), honest=new Set(['A','C']);
  const common=[...qa].filter(x=>qb.has(x));assert.deepEqual(common,['B']);
  assert.equal(common.some(x=>honest.has(x)),false);
  assert.deepEqual(quorumAnalysis(3,2,1),{minimum_intersection:1,disjoint_possible:false,honest_intersection_guaranteed:false});
  assert.equal(quorumAnalysis(3,1,0).disjoint_possible,true);
  assert.equal(quorumAnalysis(3,3,1).honest_intersection_guaranteed,true);
});
for(const [name,raw,code] of [
  ['duplicate literal key','{"a":1,"a":2}','JSON_DUPLICATE_KEY'],
  ['duplicate escaped key','{"a":1,"\\u0061":2}','JSON_DUPLICATE_KEY'],
  ['trailing input','{}{}','JSON_TRAILING'],
  ['unsafe integer','9007199254740993','JSON_NUMBER'],
  ['negative zero','-0','JSON_NUMBER'],
  ['fractional number','1.1','JSON_TRAILING'],
  ['surrogate','"\\ud800"','JSON_SURROGATE'],
  ['depth limit','['.repeat(34)+'0'+']'.repeat(34),'JSON_DEPTH_LIMIT'],
  ['byte limit',' '.repeat(262145),'JSON_BYTE_LIMIT']
])test('parser '+name,()=>assert.throws(()=>parseJSON(Buffer.from(raw)),new RegExp(code)));
test('invalid UTF-8',()=>assert.throws(()=>parseJSON(Buffer.from([34,255,34]))));
test('__proto__ parsed as inert own property',()=>{
  const p=parseJSON(Buffer.from('{"__proto__":{"polluted":true}}'));
  assert.equal(Object.getPrototypeOf(p),null);assert.equal({}.polluted,undefined);
});
test('report extraction never searches inactive ancestor for missing active assertion',()=>{
  const label=inputs.successor_observation.active_manifest;
  const normal={active_manifest:label,manifests:{[label]:{ingredients:[],assertions:[]}}};
  const detailed={active_manifest:label,manifests:{[label]:{assertion_store:{}},ancestor:{assertion_store:{'c2pa.ingredient.v3':{}}}}};
  assert.throws(()=>projectReports(normal,detailed),/REPORT_ASSERTION_MISSING/);
});
test('live SDK gate rejects ingredient validation failure despite active success',()=>{
  const r={active_manifest:'x',validation_state:'Valid',manifests:{},validation_results:{activeManifest:{success:['claimSignature.validated','claimSignature.insideValidity'].map(code=>({code,url:'self#jumbf=/c2pa/x/c2pa.signature'})),failure:[]},ingredientDeltas:[{validationDeltas:{failure:[{code:'ingredient.hash.mismatch'}]}}]}};
  assert.throws(()=>checkSdkReport(r),/SDK_REPORT_FAILURE/);
});
test('semantic equivalence does not imply frozen-byte identity',()=>{
  const f=frame(),raw=resignEnvelope(f);const r=verifyEvidence(f.i,raw,f.v);
  assert.equal(r.semantic_fingerprint_sha256,inputs.expected.semantic_fingerprint_sha256);
  assert.notEqual(sha256(raw),inputs.expected.bundle_sha256);
});
