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
  const manifest = (report.manifests || {})[label];
  if (!manifest) throw new Error(`active manifest ${label} not found`);
  return manifest;
}

function findExternalReference(manifest, expectedLabel) {
  const assertions = Array.isArray(manifest.assertions) ? manifest.assertions : [];
  const matches = assertions.filter((entry) => entry && entry.label === expectedLabel);
  if (matches.length !== 1) throw new Error(`expected exactly one ${expectedLabel} assertion, found ${matches.length}`);
  return matches[0];
}

function validateSourceObservation(profile, bytes) {
  if (bytes.length !== profile.source_observation_bytes) throw new Error('source observation byte count mismatch');
  const fileSha = sha256Hex(bytes);
  if (fileSha !== profile.source_observation_sha256) throw new Error('source observation SHA-256 mismatch');
  const blobSha = gitBlobSha(bytes);
  if (blobSha !== profile.source_observation_git_blob) throw new Error('source observation Git blob mismatch');

  const receipt = JSON.parse(bytes.toString('utf8'));
  if (receipt.schema !== profile.source_observation_schema) throw new Error('source observation schema mismatch');
  if (receipt.verdict !== profile.source_observation_verdict) throw new Error('source observation verdict mismatch');
  if (receipt.tracking_issue !== profile.tracking_issue) throw new Error('source observation tracking issue mismatch');
  if (receipt.observed_repository !== profile.workbench_repository) throw new Error('source repository mismatch');
  if (receipt.public_main?.commit !== profile.workbench_main_commit) throw new Error('source main commit mismatch');
  if (receipt.public_main?.tree !== profile.workbench_main_tree) throw new Error('source main tree mismatch');
  if (JSON.stringify(receipt.public_main?.ordered_parents) !== JSON.stringify(profile.workbench_ordered_parents)) throw new Error('source parent order mismatch');
  if (receipt.accepted_tag?.ref !== profile.workbench_tag_ref) throw new Error('source tag ref mismatch');
  if (receipt.accepted_tag?.object_type !== 'tag') throw new Error('source tag object type mismatch');
  if (receipt.accepted_tag?.tag_object !== profile.workbench_tag_object) throw new Error('source tag object mismatch');
  if (receipt.accepted_tag?.peeled_commit !== profile.workbench_tag_target_commit) throw new Error('source tag target mismatch');
  if (receipt.accepted_tag?.signature_verification?.verified !== false) throw new Error('unsigned tag was promoted to verified');
  if (receipt.accepted_tag?.signature_verification?.reason !== profile.workbench_tag_signature_reason) throw new Error('tag signature reason mismatch');
  if (receipt.automatic_action !== false || receipt.external_mutation_performed !== false) throw new Error('source observation effect boundary violated');

  const claims = receipt.claims || {};
  for (const claim of profile.source_required_true_claims || []) {
    if (claims[claim] !== true) throw new Error(`required source observation claim not true: ${claim}`);
  }
  for (const claim of profile.source_required_false_claims || []) {
    if (claims[claim] !== false) throw new Error(`source observation claim must remain false: ${claim}`);
  }
  return { receipt, fileSha, blobSha };
}

function verifyBinding(report, profile, sourceBytes, resolvedBytes) {
  const source = validateSourceObservation(profile, sourceBytes);
  if (!Buffer.isBuffer(resolvedBytes)) resolvedBytes = Buffer.from(resolvedBytes);
  if (!resolvedBytes.equals(sourceBytes)) throw new Error('resolved immutable observation differs from source exact bytes');

  const c2pa = assertLiveC2paReport(report);
  const assertion = findExternalReference(activeManifest(report), profile.assertion_label);
  const data = assertion.data || {};
  const location = data.location || {};
  if (location.url !== profile.external_url) throw new Error('external-reference URL drift');
  if (location.alg !== profile.digest_alg) throw new Error('external-reference algorithm drift');
  if (location['dc:format'] !== profile.media_type) throw new Error('external-reference media type drift');
  if (location.size !== sourceBytes.length) throw new Error('external-reference size drift');
  if (Object.prototype.hasOwnProperty.call(data, 'label')) throw new Error('external JSON must not be reinterpreted as JUMBF assertion label');

  const expected = crypto.createHash('sha256').update(sourceBytes).digest();
  const bound = normalizeHash(location.hash);
  if (bound.length !== expected.length || !crypto.timingSafeEqual(bound, expected)) throw new Error('external-reference digest mismatch');

  return {
    schema: 'urn:uu-aap:c2pa-workbench-release-observation-binding-qualification:0.1',
    tracking_issue: profile.tracking_issue,
    repository_predecessor_main: profile.repository_predecessor_main,
    repository_predecessor_tree: profile.repository_predecessor_tree,
    source_observation: {
      checkpoint_commit: profile.source_checkpoint_commit,
      path: profile.source_observation_path,
      git_blob: source.blobSha,
      sha256: source.fileSha,
      bytes: sourceBytes.length,
      schema: source.receipt.schema,
      verdict: source.receipt.verdict,
      workbench_main_commit: source.receipt.public_main.commit,
      accepted_tag_object: source.receipt.accepted_tag.tag_object,
      accepted_tag_target: source.receipt.accepted_tag.peeled_commit,
      annotated_tag_signature_verified: source.receipt.accepted_tag.signature_verification.verified
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
      source_observation_embedded_as_custom_assertion: false
    },
    claims: {
      c2pa_external_reference_binding_established: true,
      source_observation_rewritten: false,
      historical_operator_publication_receipt_reconstructed: false,
      publication_authority_proven: false,
      truth_certified: false,
      git_tag_signature_verified: false,
      c2pa_inclusion_in_original_workbench_release_proven: false,
      model_invocation_authority_created: false,
      runtime_execution_authority_created: false,
      response_authority_created: false,
      action_permit_created: false,
      successor_permit_created: false
    },
    automatic_action: false,
    external_mutation_performed: false,
    verdict: profile.strong_verdict
  };
}

if (require.main === module) {
  const [reportPath, profilePath, sourcePath, resolvedPath] = process.argv.slice(2);
  if (![reportPath, profilePath, sourcePath, resolvedPath].every(Boolean)) {
    console.error('usage: node verify-binding.js <c2pa-report> <profile> <source-observation> <resolved-observation>');
    process.exit(2);
  }
  const result = verifyBinding(
    JSON.parse(fs.readFileSync(reportPath, 'utf8')),
    JSON.parse(fs.readFileSync(profilePath, 'utf8')),
    fs.readFileSync(sourcePath),
    fs.readFileSync(resolvedPath)
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

module.exports = { gitBlobSha, sha256Hex, validateSourceObservation, verifyBinding };
