/** #1009 standalone verifier. Only Node built-ins; no signing, fetch, or predecessor imports. */
import {createHash, createPublicKey, verify as verifySignature} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const sha256 = b => createHash('sha256').update(b).digest('hex');
const digest = b => Buffer.from(sha256(b), 'hex');
const bytes = s => Buffer.from(s, 'utf8');
export function requireThat(ok, code) { if (!ok) throw new Error(code); }
const own = (o,k) => Object.hasOwn(o,k);
const eq = (a,b) => canonical(a) === canonical(b);
const MAX_BYTES = 262144;
const NONCLAIMS = [
  'all_manifests_submitted_proven','authority_created','automatic_remediation_triggered',
  'c2pa_profile_adopted_by_specification','c2pa_specification_conformance_proven',
  'canonical_branch_selected','global_non_equivocation_proven','malicious_behavior_proven',
  'no_time_trust_assumptions_proven','policy_trust_proven','producer_non_equivocation_proven',
  'same_claim_self_anchor_proven','selective_submission_absent_proven',
  'submission_completeness_proven','successor_manifest_transparency_inclusion_proven',
  'trusted_universal_time_proven','truth_certified','witness_independence_proven'
];

// Small bounded parser: duplicate decoded keys, invalid UTF-8 and ambiguous numbers fail closed.
export function parseJSON(raw) {
  requireThat(Buffer.byteLength(raw) <= MAX_BYTES, 'JSON_BYTE_LIMIT');
  const s = new TextDecoder('utf-8',{fatal:true}).decode(raw);
  let at=0;
  const ws=()=>{while(/[ \t\r\n]/.test(s[at] ?? '\0')) at++;};
  function str() {
    const begin=at++;
    while(at<s.length) {
      const c=s[at++];
      if(c==='\\') {at++;continue;}
      if(c==='"') {
        const x=JSON.parse(s.slice(begin,at));
        requireThat(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(x),'JSON_SURROGATE');
        return x;
      }
    }
    throw new Error('JSON_STRING');
  }
  function value(depth=0) {
    requireThat(depth<=32,'JSON_DEPTH_LIMIT');ws();const c=s[at];
    if(c==='"')return str();
    if(c==='{' || c==='[') {
      const obj=c==='{'?Object.create(null):[];at++;ws();const end=c==='{'?'}':']';
      if(s[at]===end){at++;return obj;}
      for(let n=0;n<8192;n++) {
        ws();if(c==='{') {
          requireThat(s[at]==='"','JSON_KEY');const key=str();ws();
          requireThat(s[at++]===':','JSON_COLON');requireThat(!own(obj,key),'JSON_DUPLICATE_KEY');
          obj[key]=value(depth+1);
        } else obj.push(value(depth+1));
        ws();const delim=s[at++];if(delim===end)return obj;
        requireThat(delim===',','JSON_DELIMITER');
      }
      throw new Error('JSON_COLLECTION_LIMIT');
    }
    for(const [literal,v] of [['true',true],['false',false],['null',null]]) {
      if(s.startsWith(literal,at)){at+=literal.length;return v;}
    }
    const m=/^-?(?:0|[1-9][0-9]*)/.exec(s.slice(at));
    requireThat(m!==null,'JSON_TOKEN');at+=m[0].length;const n=Number(m[0]);
    requireThat(Number.isSafeInteger(n)&&!Object.is(n,-0),'JSON_NUMBER');return n;
  }
  const out=value();ws();requireThat(at===s.length,'JSON_TRAILING');return out;
}
export function canonical(v) {
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
function shape(o, keys, code) {
  requireThat(o!==null&&typeof o==='object'&&!Array.isArray(o),code);
  requireThat(eq(Object.keys(o).sort(),[...keys].sort()),code);
}
export function b64(s, length) {
  requireThat(typeof s==='string'&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s),'BASE64_CANONICAL');
  const b=Buffer.from(s,'base64');requireThat(b.toString('base64')===s,'BASE64_CANONICAL');
  if(length!==undefined)requireThat(b.length===length,'BINARY_LENGTH');return b;
}
function hashedURI(o) {
  shape(o,['url','alg','hash_b64','hash_hex'],'SUBJECT_URI_SHAPE');
  requireThat(o.alg==='sha256'&&typeof o.url==='string','SUBJECT_URI_ALGORITHM');
  const h=b64(o.hash_b64,32);requireThat(h.toString('hex')===o.hash_hex,'SUBJECT_HASH_ENCODINGS');
  return {url:o.url,alg:o.alg,hash:h.toString('base64')};
}
export function parseVkey(text, type) {
  requireThat(typeof text==='string','VKEY');
  const m=/^([^+\s]+)\+([0-9a-f]{8})\+(.+)$/u.exec(text);requireThat(m!==null,'VKEY');
  const material=b64(m[3],33);requireThat(material[0]===type,'VKEY_TYPE');
  const id=digest(Buffer.concat([bytes(m[1]+'\n'),material])).subarray(0,4);
  requireThat(id.toString('hex')===m[2],'VKEY_ID');
  const key=createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),material.subarray(1)]),format:'der',type:'spki'});
  return {name:m[1],id,key,raw:material.subarray(1).toString('hex')};
}
function checkSig(key, msg, sig, code) {
  requireThat(sig.length===64&&verifySignature(null,msg,key,sig),code);
}
export function quorumAnalysis(n,q,f=0) {
  requireThat([n,q,f].every(Number.isSafeInteger)&&n>=1&&n<=16&&q>=1&&q<=n&&f>=0&&f<=n,'QUORUM_INPUT');
  const min=Math.max(0,2*q-n);
  return {minimum_intersection:min,disjoint_possible:min===0,honest_intersection_guaranteed:min>f};
}
export function verifyEvidence(inputs, raw, view=inputs.successor_observation) {
  requireThat(inputs.schema==='urn:uu-aap:c2pa-external-replay-inputs:0.1','INPUT_SCHEMA');
  const cfg=inputs.verification_configuration, p=inputs.predecessor, b=parseJSON(raw);
  shape(b,['checkpoint','log','profile_version','schema','semantic_boundaries','subject','subject_scope','witness_observation','witness_policy'],'BUNDLE_FIELDS');
  requireThat(b.schema==='urn:uu-aap:c2pa-witnessed-checkpoint-evidence-bundle:0.1'&&b.profile_version==='0.1','BUNDLE_VERSION');
  requireThat(b.subject_scope===cfg.subject_scope&&b.subject_scope==='PREDECESSOR_C2PA_MANIFEST_REFERENCED_BY_SUCCESSOR_UPDATE','SUBJECT_SCOPE');
  shape(p,['relationship','active_manifest','claim_signature'],'PARENT_SHAPE');
  requireThat(p.relationship==='parentOf','PARENT_RELATIONSHIP');
  const am=hashedURI(p.active_manifest), cs=hashedURI(p.claim_signature);
  const prefix='self#jumbf=/c2pa/';
  requireThat(am.url.startsWith(prefix)&&cs.url===am.url+'/c2pa.signature','PARENT_URI_SCOPE');
  const parentLabel=am.url.slice(prefix.length);
  requireThat(parentLabel.length>0&&!/[/?#%]/.test(parentLabel),'PARENT_URI_LABEL');
  const policy=b.witness_policy;
  shape(policy,['policy','policy_sha256','analysis'],'POLICY_FIELDS');
  requireThat(eq(policy.policy,cfg.policy),'POLICY_SUBSTITUTION');
  const pol=policy.policy;
  shape(pol,['algorithm','origin','schema','threshold','trust_semantics','version','witnesses'],'POLICY_SHAPE');
  requireThat(pol.version==='0.1'&&pol.schema==='urn:uu-aap:experimental-witness-policy:0.1'&&pol.algorithm==='ed25519-cosignature-v1','POLICY_VERSION');
  requireThat(pol.origin===cfg.log_origin&&pol.threshold===2&&pol.witnesses.length===3,'POLICY_SCOPE');
  const policyHash=sha256(canonical(pol));
  requireThat(policyHash===policy.policy_sha256&&policyHash===cfg.policy_sha256,'POLICY_DIGEST');
  shape(b.subject,['active_manifest','claim_signature','commitment_domain','commitment_preimage_sha256','hash_algorithm','leaf_commitment_b64','witness_policy_sha256'],'SUBJECT_FIELDS');
  const s=b.subject;
  requireThat(eq(s.active_manifest,p.active_manifest)&&eq(s.claim_signature,p.claim_signature),'PREDECESSOR_MISMATCH');
  requireThat(s.witness_policy_sha256===policyHash,'SUBJECT_POLICY');
  requireThat(s.hash_algorithm==='sha256'&&s.commitment_domain===cfg.commitment_domain&&s.commitment_domain==='urn:uu-aap:c2pa-witnessed-checkpoint-subject:v0.1','COMMITMENT_DOMAIN');
  const core={active_manifest:p.active_manifest,claim_signature:p.claim_signature,hash_algorithm:'sha256',witness_policy_sha256:policyHash};
  // The profile's canonicalization is a closed ASCII/integer JSON subset, NOT a JCS claim.
  requireThat(/^[\x20-\x7e]*$/.test(canonical(core)),'PREIMAGE_ASCII');
  const preimage=Buffer.concat([bytes(s.commitment_domain+'\0'),bytes(canonical(core))]);
  const commitment=digest(preimage);
  requireThat(s.commitment_preimage_sha256===commitment.toString('hex')&&b64(s.leaf_commitment_b64,32).equals(commitment),'COMMITMENT_MISMATCH');
  shape(b.log,['inclusion_proof_b64','leaf_hash_b64','leaf_index','origin','root_b64','tree_size'],'LOG_FIELDS');
  const log=b.log;
  requireThat(log.origin===cfg.log_origin,'LOG_ORIGIN');
  requireThat(log.tree_size===2&&log.leaf_index===1&&Array.isArray(log.inclusion_proof_b64)&&log.inclusion_proof_b64.length===1,'INCLUSION_SHAPE');
  const leaf=digest(Buffer.concat([Buffer.from([0]),commitment]));
  requireThat(leaf.equals(b64(log.leaf_hash_b64,32)),'LEAF_HASH');
  const root=digest(Buffer.concat([Buffer.from([1]),b64(log.inclusion_proof_b64[0],32),leaf]));
  requireThat(root.equals(b64(log.root_b64,32)),'INCLUSION_PROOF');
  const cp=b.checkpoint;
  shape(cp,['log_vkey','sha256','signed_body_sha256','signed_note'],'CHECKPOINT_FIELDS');
  requireThat(cp.log_vkey===cfg.log_vkey,'LOG_KEY_SUBSTITUTION');
  const logKey=parseVkey(cfg.log_vkey,1);
  requireThat(logKey.name===cfg.log_origin,'LOG_KEY_ORIGIN');
  requireThat(typeof cp.signed_note==='string'&&Buffer.byteLength(cp.signed_note)<=65536&&!/[\x00-\x09\x0b-\x1f\x7f]/.test(cp.signed_note),'NOTE_FORMAT');
  const split=cp.signed_note.lastIndexOf('\n\n');requireThat(split>=0&&cp.signed_note.endsWith('\n'),'NOTE_SEPARATOR');
  const body=bytes(cp.signed_note.slice(0,split+1));
  requireThat(body.equals(bytes(cfg.log_origin+'\n2\n'+root.toString('base64')+'\n')),'CHECKPOINT_ROOT_OR_ORIGIN');
  requireThat(sha256(cp.signed_note)===cp.sha256&&sha256(body)===cp.signed_body_sha256,'CHECKPOINT_DIGEST');
  const lines=cp.signed_note.slice(split+2,-1).split('\n');requireThat(lines.length>=1&&lines.length<=16,'NOTE_SIGNATURE_LIMIT');
  const witnesses=new Map(), seenKeys=new Set();
  for(const entry of pol.witnesses) {
    shape(entry,['name','vkey'],'WITNESS_FIELDS');const k=parseVkey(entry.vkey,4);
    requireThat(entry.name===k.name&&!witnesses.has(k.name)&&!seenKeys.has(k.raw),'WITNESS_IDENTITY_DUPLICATE');
    witnesses.set(k.name,k);seenKeys.add(k.raw);
  }
  let logs=0;const verified=new Map();
  for(const line of lines) {
    const m=/^— ([^+\s]+) ([A-Za-z0-9+/=]+)$/u.exec(line);requireThat(m!==null,'NOTE_SIGNATURE_FORMAT');
    const payload=b64(m[2]);
    if(m[1]===logKey.name) {
      requireThat(++logs===1&&payload.length===68&&payload.subarray(0,4).equals(logKey.id),'LOG_SIGNATURE_FORMAT');
      checkSig(logKey.key,body,payload.subarray(4),'LOG_SIGNATURE_INVALID');continue;
    }
    // This closed vector profile rejects extras; general C2SP clients instead ignore unknown keys.
    const k=witnesses.get(m[1]);requireThat(k!==undefined,'UNKNOWN_WITNESS');
    requireThat(payload.length===76&&payload.subarray(0,4).equals(k.id),'WITNESS_SIGNATURE_FORMAT');
    const timestamp=payload.readBigUInt64BE(4);
    requireThat(timestamp<=(1n<<63n)-1n&&timestamp<=BigInt(Number.MAX_SAFE_INTEGER),'TIMESTAMP_RANGE');
    const msg=Buffer.concat([bytes('cosignature/v1\ntime '+timestamp.toString()+'\n'),body]);
    checkSig(k.key,msg,payload.subarray(12),'WITNESS_SIGNATURE_INVALID');
    requireThat(!verified.has(k.name),'DUPLICATE_WITNESS');verified.set(k.name,Number(timestamp));
  }
  requireThat(logs===1,'LOG_SIGNATURE_MISSING');requireThat(verified.size>=pol.threshold,'QUORUM_UNSATISFIED');
  const q=quorumAnalysis(3,2);
  requireThat(eq(policy.analysis,{disjoint_quorum_possible:q.disjoint_possible,honest_witness_assumption_required:true,minimum_pairwise_quorum_intersection:q.minimum_intersection,threshold:2,witness_count:3,witness_independence_proven:false}),'POLICY_ANALYSIS');
  shape(b.witness_observation,['cosigned_witnesses','quorum_satisfied','timestamps_are_observation_claims_only','verified_witness_count'],'OBSERVATION_FIELDS');
  const observation=[...verified].sort(([a],[b])=>a.localeCompare(b)).map(([name,timestamp])=>({name,timestamp}));
  requireThat(eq(b.witness_observation.cosigned_witnesses,observation)&&b.witness_observation.verified_witness_count===verified.size&&b.witness_observation.quorum_satisfied===true&&b.witness_observation.timestamps_are_observation_claims_only===true,'WITNESS_OBSERVATION_MISMATCH');
  shape(b.semantic_boundaries,NONCLAIMS,'NONCLAIM_FIELDS');
  requireThat(NONCLAIMS.every(k=>b.semantic_boundaries[k]===false),'SEMANTIC_PROMOTION');
  requireThat(eq(inputs.expected.all_false_claims,NONCLAIMS)&&inputs.expected.external_reviewer_execution===false,'EXPECTED_SCOPE');

  // Only the named ACTIVE manifest is selected. No recursive search through ancestor assertions.
  requireThat(view.active_manifest!==parentLabel,'SAME_CLAIM_SELF_REFERENCE');
  requireThat(view.parent_ingredients.length===1,'PARENT_COUNT');
  const ingredient=view.parent_ingredients[0];
  requireThat(ingredient.label==='c2pa.ingredient.v3'&&ingredient.relationship==='parentOf'&&ingredient.active_manifest===parentLabel,'ACTIVE_PARENT_LINK');
  requireThat(eq(view.parent_assertion,{relationship:'parentOf',activeManifest:am,claimSignature:cs}),'ACTIVE_PARENT_ASSERTION');
  requireThat(view.claim.claim_version===2&&view.claim.alg==='sha256'&&view.claim.signature===prefix+view.active_manifest+'/c2pa.signature','SUCCESSOR_CLAIM');
  requireThat(Array.isArray(view.claim.created_assertions)&&view.claim.created_assertions.length===0,'UPDATE_CREATED_ASSERTIONS');
  requireThat(view.assertion_labels.length===new Set(view.assertion_labels).size&&!view.assertion_labels.some(x=>x.startsWith('c2pa.hash.')),'UPDATE_ASSERTION_SURFACE');
  const gathered=view.claim.gathered_assertions;
  requireThat(Array.isArray(gathered),'GATHERED_ASSERTIONS');
  for(const label of ['c2pa.ingredient.v3','c2pa.external-reference']) {
    requireThat(view.assertion_labels.includes(label)&&gathered.filter(x=>x.url==='self#jumbf=c2pa.assertions/'+label).length===1,'CLAIM_ASSERTION_LINK');
  }
  shape(view.external_reference,['description','location'],'EXTERNAL_REFERENCE_FIELDS');
  const loc=view.external_reference.location;
  shape(loc,['alg','dc:format','hash','size','url'],'EXTERNAL_LOCATION_FIELDS');
  requireThat(loc.url===cfg.external_url&&loc.url==='http://127.0.0.1:8765/witnessed-checkpoint-bundle.json','EXTERNAL_URL');
  requireThat(loc.alg==='sha256'&&loc['dc:format']==='application/json','EXTERNAL_ALGORITHM_OR_TYPE');
  requireThat(loc.size===raw.length,'EXTERNAL_SIZE');
  requireThat(b64(loc.hash,32).equals(digest(raw)),'EXTERNAL_HASH');
  const stable={subject:s,log,checkpoint_body_sha256:sha256(body),policy_sha256:policyHash,verified_witnesses:[...verified.keys()].sort(),quorum_threshold:pol.threshold};
  return {
    schema:'urn:uu-aap:c2pa-external-replay-observation:0.1',
    classification:'OFFLINE_CRYPTO_AND_REPORTED_C2PA_BINDING_REPLAY_PASS',
    bundle_sha256:sha256(raw),bundle_bytes:raw.length,
    semantic_fingerprint_sha256:sha256(canonical(stable)),
    commitment_preimage_hex:preimage.toString('hex'),
    inclusion_verified:true,log_signature_verified:true,verified_witnesses:observation,
    policy_digest:policyHash,quorum_satisfied:true,
    quorum_intersection:q.minimum_intersection,
    honest_intersection_with_one_fault_guaranteed:quorumAnalysis(3,2,1).honest_intersection_guaranteed,
    predecessor_binding_in_report_verified:true,self_reference_rejected:true,
    historical_c2pa_asset_revalidated:false,
    witness_state_transition_replayed:false,
    real_world_time_bound_proven:false,
    external_reviewer_execution:false,
    predecessor_verifier_imported:false,
    historical_receipt_used_as_oracle:false,
    claims:Object.fromEntries(NONCLAIMS.map(k=>[k,false]))
  };
}
export function projectReports(report, detailed) {
  requireThat(report.active_manifest===detailed.active_manifest,'REPORT_ACTIVE_MISMATCH');
  const label=report.active_manifest, normal=report.manifests?.[label], full=detailed.manifests?.[label];
  requireThat(normal&&full,'REPORT_ACTIVE_MISSING');
  const store=full.assertion_store, ingredient=store?.['c2pa.ingredient.v3'];
  requireThat(ingredient&&store['c2pa.external-reference'],'REPORT_ASSERTION_MISSING');
  const assertions=normal.assertions.filter(a=>a.label==='c2pa.external-reference');
  requireThat(assertions.length===1&&eq(assertions[0].data,store['c2pa.external-reference']),'REPORT_EXTERNAL_MISMATCH');
  return {active_manifest:label,parent_ingredients:normal.ingredients.map(i=>({label:i.label,relationship:i.relationship,active_manifest:i.active_manifest})),claim:full.claim,parent_assertion:{relationship:ingredient.relationship,activeManifest:ingredient.activeManifest,claimSignature:ingredient.claimSignature},assertion_labels:Object.keys(store),external_reference:store['c2pa.external-reference']};
}
export function checkSdkReport(r) {
  requireThat(['Valid','Trusted'].includes(r.validation_state),'SDK_REPORT_STATE');
  const label=r.active_manifest;
  const successes=r.validation_results?.activeManifest?.success;
  requireThat(Array.isArray(successes),'SDK_REPORT_NO_SUCCESSES');
  for(const code of ['claimSignature.validated','claimSignature.insideValidity'])
    requireThat(successes.some(s=>s.code===code&&s.url==='self#jumbf=/c2pa/'+label+'/c2pa.signature'),'SDK_REPORT_SIGNATURE');
  function scan(v) {
    if(!v||typeof v!=='object')return;
    if(own(v,'failure'))requireThat(Array.isArray(v.failure)&&v.failure.every(x=>x.code==='signingCredential.untrusted'),'SDK_REPORT_FAILURE');
    for(const x of Object.values(v))scan(x);
  }
  scan(r.validation_results);scan(r.manifests);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const here=dirname(fileURLToPath(import.meta.url)), args=process.argv.slice(2);
    requireThat(args.length===0||(args.length===2&&args[0]==='--reports'),'CLI_ARGUMENTS');
    const inputRaw=readFileSync(join(here,'inputs.json')), inputs=parseJSON(inputRaw);
    const bundle=readFileSync(join(here,'bundle.json'));
    let view=inputs.successor_observation;
    if(args.length) {
      const normal=parseJSON(readFileSync(join(args[1],'successor-report.json')));
      const detailed=parseJSON(readFileSync(join(args[1],'successor-detailed.json')));
      checkSdkReport(normal);checkSdkReport(detailed);view=projectReports(normal,detailed);
    }
    const result=verifyEvidence(inputs,bundle,view);
    requireThat(result.bundle_sha256===inputs.expected.bundle_sha256&&result.bundle_bytes===inputs.expected.bundle_bytes&&result.semantic_fingerprint_sha256===inputs.expected.semantic_fingerprint_sha256,'FROZEN_EXPECTATION_MISMATCH');
    const pins=parseJSON(readFileSync(join(here,'pins.json')));
    for(const [name,data] of [['inputs.json',inputRaw],['bundle.json',bundle]])
      requireThat(pins[name].sha256===sha256(data)&&pins[name].bytes===data.length,'PACKAGE_INPUT_PIN');
    if(args.length) result.classification='CRYPTO_AND_FRESH_SDK_REPORT_BINDING_REPLAY_PASS';
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  } catch(e) {
    process.stderr.write('C2PA_EXTERNAL_REPLAY_REJECT: '+e.message+'\n');process.exitCode=1;
  }
}
