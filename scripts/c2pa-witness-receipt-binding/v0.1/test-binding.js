'use strict';

const fs = require('fs');
const path = require('path');
const {
  gitBlobSha,
  sha256Hex,
  verifyBinding
} = require('./verify-binding');

const profilePath = path.join(__dirname, 'profile.json');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
const repoRoot = path.resolve(__dirname, '../../..');
const sourcePath = path.join(repoRoot, profile.source_receipt_path);
const sourceBytes = fs.readFileSync(sourcePath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function anchoredProfileForBytes(baseProfile, bytes) {
  const next = clone(baseProfile);
  next.source_receipt_bytes = bytes.length;
  next.source_receipt_sha256 = sha256Hex(bytes);
  next.source_receipt_git_blob = gitBlobSha(bytes);
  return next;
}

function makeReport(p, bytes) {
  const digest = Buffer.from(sha256Hex(bytes), 'hex');
  const label = 'urn:c2pa:synthetic-binding-manifest';
  return {
    active_manifest: label,
    manifests: {
      [label]: {
        assertions: [
          {
            label: p.assertion_label,
            data: {
              location: {
                url: p.external_url,
                alg: p.digest_alg,
                hash: [...digest],
                'dc:format': p.media_type,
                size: bytes.length
              },
              description: 'synthetic verifier fixture'
            }
          }
        ]
      }
    },
    validation_results: {
      activeManifest: {
        success: [
          { code: 'claimSignature.validated' },
          { code: 'claimSignature.insideValidity' }
        ],
        failure: [
          { code: 'signingCredential.untrusted' }
        ]
      }
    }
  };
}

let passed = 0;
let total = 0;
function expectReject(name, fn) {
  total += 1;
  try {
    fn();
  } catch (error) {
    passed += 1;
    return;
  }
  throw new Error(`hostile mutation unexpectedly accepted: ${name}`);
}

const baseReport = makeReport(profile, sourceBytes);
const accepted = verifyBinding(baseReport, profile, sourceBytes, sourceBytes);
if (accepted.verdict !== profile.strong_verdict) throw new Error('base strong verdict mismatch');
if (accepted.claims.c2pa_external_reference_binding_established !== true) throw new Error('base binding fact missing');
for (const [claim, value] of Object.entries(accepted.claims)) {
  if (claim === 'c2pa_external_reference_binding_established') continue;
  if (value !== false) throw new Error(`unsafe successor claim promoted: ${claim}`);
}

expectReject('source one-byte append', () => {
  const mutated = Buffer.concat([sourceBytes, Buffer.from(' ')]);
  verifyBinding(baseReport, profile, mutated, mutated);
});

expectReject('resolved immutable bytes drift', () => {
  verifyBinding(baseReport, profile, sourceBytes, Buffer.concat([sourceBytes, Buffer.from(' ')]));
});

expectReject('profile SHA-256 drift', () => {
  const p = clone(profile);
  p.source_receipt_sha256 = '0'.repeat(64);
  verifyBinding(baseReport, p, sourceBytes, sourceBytes);
});

expectReject('profile Git blob drift', () => {
  const p = clone(profile);
  p.source_receipt_git_blob = '0'.repeat(40);
  verifyBinding(baseReport, p, sourceBytes, sourceBytes);
});

expectReject('profile byte count drift', () => {
  const p = clone(profile);
  p.source_receipt_bytes += 1;
  verifyBinding(baseReport, p, sourceBytes, sourceBytes);
});

expectReject('source schema drift under re-anchored bytes', () => {
  const receipt = JSON.parse(sourceBytes.toString('utf8'));
  receipt.schema = 'urn:hostile:schema';
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const p = anchoredProfileForBytes(profile, bytes);
  const report = makeReport(p, bytes);
  verifyBinding(report, p, bytes, bytes);
});

expectReject('source fingerprint drift under re-anchored bytes', () => {
  const receipt = JSON.parse(sourceBytes.toString('utf8'));
  receipt.receipt_fingerprint_sha256 = 'f'.repeat(64);
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const p = anchoredProfileForBytes(profile, bytes);
  const report = makeReport(p, bytes);
  verifyBinding(report, p, bytes, bytes);
});

expectReject('source verdict drift under re-anchored bytes', () => {
  const receipt = JSON.parse(sourceBytes.toString('utf8'));
  receipt.verdict = 'HOSTILE_PROMOTED_VERDICT';
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const p = anchoredProfileForBytes(profile, bytes);
  const report = makeReport(p, bytes);
  verifyBinding(report, p, bytes, bytes);
});

expectReject('historical C2PA manifest inclusion backfill', () => {
  const receipt = JSON.parse(sourceBytes.toString('utf8'));
  receipt.claims.c2pa_manifest_inclusion_proven = true;
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const p = anchoredProfileForBytes(profile, bytes);
  const report = makeReport(p, bytes);
  verifyBinding(report, p, bytes, bytes);
});

expectReject('historical authority promotion', () => {
  const receipt = JSON.parse(sourceBytes.toString('utf8'));
  receipt.claims.authority_created = true;
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`);
  const p = anchoredProfileForBytes(profile, bytes);
  const report = makeReport(p, bytes);
  verifyBinding(report, p, bytes, bytes);
});

expectReject('external URL drift', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions[0].data.location.url = 'https://example.invalid/drift.json';
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('digest algorithm drift', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions[0].data.location.alg = 'sha512';
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('media type drift', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions[0].data.location['dc:format'] = 'text/plain';
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('bound size drift', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions[0].data.location.size += 1;
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('bound hash drift', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions[0].data.location.hash[0] ^= 1;
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('duplicate external-reference', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions.push(clone(report.manifests[report.active_manifest].assertions[0]));
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('missing external-reference', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions = [];
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('external JSON reinterpreted as JUMBF label', () => {
  const report = clone(baseReport);
  report.manifests[report.active_manifest].assertions[0].data.label = 'org.example.hostile';
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('invalid C2PA validation surface', () => {
  const report = clone(baseReport);
  report.validation_results.activeManifest.success = [{ code: 'claimSignature.insideValidity' }];
  verifyBinding(report, profile, sourceBytes, sourceBytes);
});

expectReject('custom assertion namespace substitution', () => {
  const p = clone(profile);
  p.assertion_label = 'org.example.uu-aap-witness-receipt';
  verifyBinding(baseReport, p, sourceBytes, sourceBytes);
});

if (passed !== total) throw new Error(`hostile suite mismatch: ${passed}/${total}`);
process.stdout.write(`C2PA_WITNESS_RECEIPT_BINDING_HOSTILE: ${passed}/${total} PASS\n`);
