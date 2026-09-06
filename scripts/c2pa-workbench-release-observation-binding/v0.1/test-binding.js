'use strict';

const fs = require('fs');
const path = require('path');
const { buildObservation } = require('./verify-live-workbench');
const { gitBlobSha, sha256Hex, verifyBinding } = require('./verify-binding');

const profile = JSON.parse(fs.readFileSync(path.join(__dirname, 'profile.json'), 'utf8'));
const repoRoot = path.resolve(__dirname, '../../..');
const sourceBytes = fs.readFileSync(path.join(repoRoot, profile.source_observation_path));

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function anchoredProfileForBytes(base, bytes) {
  const p = clone(base);
  p.source_observation_bytes = bytes.length;
  p.source_observation_sha256 = sha256Hex(bytes);
  p.source_observation_git_blob = gitBlobSha(bytes);
  return p;
}
function makeReport(p, bytes) {
  const label = 'urn:c2pa:synthetic-workbench-release-binding';
  return {
    active_manifest: label,
    manifests: { [label]: { assertions: [{ label: p.assertion_label, data: { location: {
      url: p.external_url, alg: p.digest_alg, hash: [...Buffer.from(sha256Hex(bytes), 'hex')],
      'dc:format': p.media_type, size: bytes.length
    } } }] } },
    validation_results: { activeManifest: { success: [
      { code: 'claimSignature.validated' }, { code: 'claimSignature.insideValidity' }
    ], failure: [{ code: 'signingCredential.untrusted' }] } }
  };
}
function livePayloads(p) {
  return {
    mainRef: { object: { sha: p.workbench_main_commit, type: 'commit' } },
    commit: { sha: p.workbench_main_commit, tree: { sha: p.workbench_main_tree }, parents: p.workbench_ordered_parents.map((sha) => ({ sha })) },
    tagRef: { ref: p.workbench_tag_ref, object: { sha: p.workbench_tag_object, type: 'tag' } },
    tagObject: { sha: p.workbench_tag_object, tag: p.workbench_tag_ref.replace('refs/tags/', ''), object: { sha: p.workbench_tag_target_commit, type: 'commit' }, verification: { verified: false, reason: 'unsigned' } }
  };
}

let passed = 0; let total = 0;
function reject(name, fn) {
  total += 1;
  try { fn(); } catch (_) { passed += 1; return; }
  throw new Error(`hostile mutation unexpectedly accepted: ${name}`);
}

const live = livePayloads(profile);
const rebuilt = Buffer.from(`${JSON.stringify(buildObservation(profile, live.mainRef, live.commit, live.tagRef, live.tagObject), null, 2)}\n`);
if (!rebuilt.equals(sourceBytes)) throw new Error('base live observation does not reproduce source bytes');
const baseReport = makeReport(profile, sourceBytes);
const accepted = verifyBinding(baseReport, profile, sourceBytes, sourceBytes);
if (accepted.verdict !== profile.strong_verdict) throw new Error('base verdict mismatch');
for (const [claim, value] of Object.entries(accepted.claims)) {
  if (claim === 'c2pa_external_reference_binding_established') { if (value !== true) throw new Error('binding fact missing'); }
  else if (value !== false) throw new Error(`unsafe successor claim promoted: ${claim}`);
}

reject('source one-byte append', () => verifyBinding(baseReport, profile, Buffer.concat([sourceBytes, Buffer.from(' ')]), sourceBytes));
reject('resolved immutable bytes drift', () => verifyBinding(baseReport, profile, sourceBytes, Buffer.concat([sourceBytes, Buffer.from(' ')])));
reject('profile source SHA drift', () => { const p=clone(profile); p.source_observation_sha256='0'.repeat(64); verifyBinding(baseReport,p,sourceBytes,sourceBytes); });
reject('profile source blob drift', () => { const p=clone(profile); p.source_observation_git_blob='0'.repeat(40); verifyBinding(baseReport,p,sourceBytes,sourceBytes); });
reject('profile source bytes drift', () => { const p=clone(profile); p.source_observation_bytes+=1; verifyBinding(baseReport,p,sourceBytes,sourceBytes); });

function mutateSource(name, mutate) {
  reject(name, () => {
    const obj = JSON.parse(sourceBytes.toString('utf8')); mutate(obj);
    const bytes = Buffer.from(`${JSON.stringify(obj, null, 2)}\n`);
    const p = anchoredProfileForBytes(profile, bytes);
    verifyBinding(makeReport(p, bytes), p, bytes, bytes);
  });
}
mutateSource('main commit substitution', (r) => { r.public_main.commit='0'.repeat(40); });
mutateSource('parent reorder', (r) => { r.public_main.ordered_parents.reverse(); });
mutateSource('tag object substitution', (r) => { r.accepted_tag.tag_object='0'.repeat(40); });
mutateSource('tag peel mismatch', (r) => { r.accepted_tag.peeled_commit='1'.repeat(40); });
mutateSource('tag object type substitution', (r) => { r.accepted_tag.object_type='commit'; });
mutateSource('unsigned tag promoted to verified', (r) => { r.accepted_tag.signature_verification.verified=true; r.claims.annotated_tag_signature_verified=true; });
mutateSource('publication authority promotion', (r) => { r.claims.publication_authority_proven=true; });
mutateSource('truth promotion', (r) => { r.claims.truth_certified=true; });
mutateSource('historical receipt reconstruction claim', (r) => { r.claims.historical_operator_publication_receipt_reconstructed=true; });
mutateSource('retroactive original release C2PA inclusion', (r) => { r.claims.c2pa_inclusion_in_original_release_proven=true; });

reject('live main drift', () => { const x=livePayloads(profile); x.mainRef.object.sha='2'.repeat(40); buildObservation(profile,x.mainRef,x.commit,x.tagRef,x.tagObject); });
reject('live parent reorder', () => { const x=livePayloads(profile); x.commit.parents.reverse(); buildObservation(profile,x.mainRef,x.commit,x.tagRef,x.tagObject); });
reject('live tag promoted signed', () => { const x=livePayloads(profile); x.tagObject.verification={verified:true,reason:'valid'}; buildObservation(profile,x.mainRef,x.commit,x.tagRef,x.tagObject); });

function mutateReport(name, mutate) { reject(name, () => { const r=clone(baseReport); mutate(r.manifests[r.active_manifest].assertions); verifyBinding(r,profile,sourceBytes,sourceBytes); }); }
mutateReport('external URL drift', (a) => { a[0].data.location.url='https://example.invalid/drift'; });
mutateReport('digest algorithm drift', (a) => { a[0].data.location.alg='sha512'; });
mutateReport('media type drift', (a) => { a[0].data.location['dc:format']='text/plain'; });
mutateReport('size drift', (a) => { a[0].data.location.size+=1; });
mutateReport('hash drift', (a) => { a[0].data.location.hash[0]^=1; });
mutateReport('duplicate external-reference', (a) => { a.push(clone(a[0])); });
mutateReport('missing external-reference', (a) => { a.splice(0,a.length); });
mutateReport('external JSON reinterpreted as JUMBF label', (a) => { a[0].data.label='org.example.hostile'; });
reject('invalid C2PA surface', () => { const r=clone(baseReport); r.validation_results.activeManifest.success=[{code:'claimSignature.insideValidity'}]; verifyBinding(r,profile,sourceBytes,sourceBytes); });
reject('custom assertion namespace substitution', () => { const p=clone(profile); p.assertion_label='org.example.workbench-release'; verifyBinding(baseReport,p,sourceBytes,sourceBytes); });

if (passed !== total) throw new Error(`hostile suite mismatch ${passed}/${total}`);
process.stdout.write(`C2PA_WORKBENCH_RELEASE_OBSERVATION_HOSTILE: ${passed}/${total} PASS\n`);
