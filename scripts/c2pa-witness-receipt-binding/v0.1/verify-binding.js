'use strict';

const crypto = require('crypto');
const fs = require('fs');
const { assertLiveC2paReport } = require('../../c2pa-semantic-boundary/check-live-report');

function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function gitBlobSha(bytes) {
  const prefix = Buffer.from(`blob ${bytes.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(prefix).update(bytes).digest('hex');
}

function normalizeHash(value) {
  if (Array.isArray(value)) return Buffer.from(value);
  if (typeof value === 'string') {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length > 0) return decoded;
  }
  throw new Error('unsupported external-reference hash representation');
}

function activeManifest(report) {
  const label = report.active_manifest || report.activeManifest;
  if (!label) throw new Error('missing active manifest label');
  const manifests = report.manifests || {};
  const manifest = manifests[label];
  if (!manifest) throw new Error(`active manifest ${label} not found in report.manifests`);
  return manifest;
}

function findExternalReference(manifest, expectedLabel) {
  const assertions = Array.isArray(manifest.assertions) ? manifest.assertions : [];
  const matches = assertions.filter((entry) => entry && entry.label === expectedLabel);
  if (matches.length !== 1) {
    throw new Error(`expected exactly one ${expectedLabel} assertion, found ${matches.length}`);
  }
  return matches[0];
}

function validateSourceReceipt(profile, bytes) {
  if (bytes.length !== profile.source_receipt_bytes) {
    throw new Error(`source receipt byte count mismatch: expected=${profile.source_receipt_bytes} actual=${bytes.length}`);
  }
  const fileSha = sha256Hex(bytes);
  if (fileSha !== profile.source_receipt_sha256) {
    throw new Error(`source receipt SHA-256 mismatch: expected=${profile.source_receipt_sha256} actual=${fileSha}`);
  }
  const blobSha = gitBlobSha(bytes);
  if (blobSha !== profile.source_receipt_git_blob) {
    throw new Error(`source receipt Git blob mismatch: expected=${profile.source_receipt_git_blob} actual=${blobSha}`);
  }

  const receipt = JSON.parse(bytes.toString('utf8'));
  if (receipt.schema !== profile.source_receipt_schema) {
    throw new Error(`source receipt schema mismatch: ${receipt.schema}`);
  }
  if (receipt.receipt_fingerprint_sha256 !== profile.source_receipt_fingerprint_sha256) {
    throw new Error('source receipt fingerprint mismatch');
  }
  if (receipt.verdict !== profile.source_receipt_verdict) {
    throw new Error(`source receipt verdict mismatch: ${receipt.verdict}`);
  }
  if (receipt.automatic_action !== false) throw new Error('source receipt automatic_action must remain false');
  if (receipt.external_mutation_performed !== false) throw new Error('source receipt external_mutation_performed must remain false');

  const claims = receipt.claims || {};
  for (const claim of profile.source_receipt_required_false_claims || []) {
    if (claims[claim] !== false) throw new Error(`historical source receipt claim must remain false: ${claim}`);
  }

  return { receipt, fileSha, blobSha };
}

function verifyBinding(report, profile, sourceBytes, resolvedBytes) {
  const source = validateSourceReceipt(profile, sourceBytes);
  if (!Buffer.isBuffer(resolvedBytes)) resolvedBytes = Buffer.from(resolvedBytes);
  if (!resolvedBytes.equals(sourceBytes)) {
    throw new Error('resolved immutable external receipt bytes differ from accepted source receipt bytes');
  }

  const c2pa = assertLiveC2paReport(report);
  const manifest = activeManifest(report);
  const assertion = findExternalReference(manifest, profile.assertion_label);
  const data = assertion.data || {};
  const location = data.location || {};

  if (location.url !== profile.external_url) throw new Error(`unexpected external-reference URL: ${location.url}`);
  if (location.alg !== profile.digest_alg) throw new Error(`unexpected digest algorithm: ${location.alg}`);
  if (location['dc:format'] !== profile.media_type) throw new Error(`unexpected media type: ${location['dc:format']}`);
  if (location.size !== sourceBytes.length) {
    throw new Error(`external-reference size mismatch: bound=${location.size} actual=${sourceBytes.length}`);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'label')) {
    throw new Error('external receipt must remain arbitrary external JSON and must not be reinterpreted as a JUMBF assertion label');
  }

  const expectedDigest = crypto.createHash('sha256').update(sourceBytes).digest();
  const boundDigest = normalizeHash(location.hash);
  if (boundDigest.length !== expectedDigest.length || !crypto.timingSafeEqual(boundDigest, expectedDigest)) {
    throw new Error(`external-reference digest mismatch: bound=${boundDigest.toString('hex')} actual=${expectedDigest.toString('hex')}`);
  }

  if (!['valid', 'trusted'].includes(String(c2pa.validation_state).toLowerCase())) {
    throw new Error(`unexpected accepted C2PA validation state: ${c2pa.validation_state}`);
  }

  return {
    schema: 'urn:uu-aap:c2pa-witness-receipt-binding-qualification:0.1',
    tracking_issue: profile.tracking_issue,
    repository_predecessor_main: profile.repository_predecessor_main,
    repository_predecessor_tree: profile.repository_predecessor_tree,
    source_receipt: {
      path: profile.source_receipt_path,
      git_blob: source.blobSha,
      sha256: source.fileSha,
      bytes: sourceBytes.length,
      schema: source.receipt.schema,
      receipt_fingerprint_sha256: source.receipt.receipt_fingerprint_sha256,
      verdict: source.receipt.verdict,
      historical_c2pa_manifest_inclusion_proven: source.receipt.claims.c2pa_manifest_inclusion_proven
    },
    c2pa_binding: {
      assertion_label: profile.assertion_label,
      digest_alg: profile.digest_alg,
      media_type: profile.media_type,
      external_url: profile.external_url,
      external_reference_hash_match: true,
      immutable_external_resolution_exact_bytes_match: true,
      live_c2pa_validation_accepted: true,
      custom_assertion_namespace_registered: false,
      source_receipt_embedded_as_custom_assertion: false
    },
    claims: {
      c2pa_external_reference_binding_established: true,
      historical_source_receipt_rewritten: false,
      truth_certified: false,
      authority_created: false,
      legal_operator_identity_proven: false,
      cryptographic_operator_identity_binding_proven: false,
      operator_control_proven: false,
      witness_independence_proven: false,
      complete_history_proven: false,
      all_manifests_submitted_proven: false,
      c2pa_ecosystem_completeness_proven: false,
      signer_interpreted_as_witness_operator: false,
      signer_interpreted_as_uu_aap_authority: false
    },
    automatic_action: false,
    external_mutation_performed: false,
    verdict: profile.strong_verdict
  };
}

if (require.main === module) {
  const [reportPath, profilePath, sourceReceiptPath, resolvedReceiptPath] = process.argv.slice(2);
  if (!reportPath || !profilePath || !sourceReceiptPath || !resolvedReceiptPath) {
    console.error('usage: node verify-binding.js <c2patool-report.json> <profile.json> <accepted-source-receipt.json> <resolved-immutable-receipt.json>');
    process.exit(2);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const sourceBytes = fs.readFileSync(sourceReceiptPath);
  const resolvedBytes = fs.readFileSync(resolvedReceiptPath);
  process.stdout.write(`${JSON.stringify(verifyBinding(report, profile, sourceBytes, resolvedBytes), null, 2)}\n`);
}

module.exports = {
  activeManifest,
  findExternalReference,
  gitBlobSha,
  normalizeHash,
  sha256Hex,
  validateSourceReceipt,
  verifyBinding
};
