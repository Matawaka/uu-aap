'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Evidence = require('./evidence-availability-manifest.js');

const SHA = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const NOW = '2026-08-24T04:00:00Z';

function clone(value) { return JSON.parse(JSON.stringify(value)); }

async function mustReject(label, fn) {
  let rejected = false;
  try { await fn(); } catch (_) { rejected = true; }
  assert.strictEqual(rejected, true, `${label}: expected fail-closed rejection`);
}

function sourceContext() {
  return {
    project_id: 'Matawaka/uu-aap',
    git_revision: `git:${SHA}`,
    tree_sha: TREE,
    scope: 'synthetic evidence set for v0.1 tests'
  };
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uu-aap-evidence-v01-'));
  try {
    fs.mkdirSync(path.join(root, 'nested'));
    fs.writeFileSync(path.join(root, 'alpha.txt'), 'alpha\n', 'utf8');
    fs.writeFileSync(path.join(root, 'nested', 'beta.json'), '{"beta":2}\n', 'utf8');

    const specs = [
      { relative_path: 'nested/beta.json', role: 'secondary-evidence' },
      { relative_path: 'alpha.txt', role: 'primary-evidence' }
    ];

    const manifest = await Evidence.buildManifest({
      rootDir: root,
      sourceContext: sourceContext(),
      fileSpecs: specs,
      recordedAt: NOW
    });

    assert.strictEqual(manifest.artifact_type, 'EvidenceAvailabilityManifest');
    assert.strictEqual(manifest.coverage_mode, 'explicit_file_set');
    assert.deepStrictEqual(manifest.files.map(x => x.relative_path), ['alpha.txt', 'nested/beta.json']);
    assert.strictEqual(manifest.claims.explicit_files_hashed, true);
    assert.strictEqual(manifest.claims.manifest_self_verification_supported, true);
    for (const key of Evidence.FALSE_CLAIMS) assert.strictEqual(manifest.claims[key], false, key);

    const manifest2 = await Evidence.buildManifest({
      rootDir: root,
      sourceContext: sourceContext(),
      fileSpecs: specs,
      recordedAt: NOW
    });
    assert.deepStrictEqual(manifest2, manifest, 'fixed files + context + time must be deterministic');

    const receipt = await Evidence.verifyManifest({ rootDir: root, manifest });
    assert.strictEqual(receipt.files_verified, 2);
    assert.strictEqual(receipt.set_digest_verified, true);
    assert.strictEqual(receipt.exact_file_bytes_verified, true);
    assert.strictEqual(receipt.claims.evidence_truth_certified, false);
    assert.strictEqual(receipt.claims.kontur_activated, false);

    await mustReject('path traversal spec', async () => Evidence.buildManifest({
      rootDir: root,
      sourceContext: sourceContext(),
      fileSpecs: [{ relative_path: '../outside.txt', role: 'bad' }],
      recordedAt: NOW
    }));

    await mustReject('backslash path spec', async () => Evidence.buildManifest({
      rootDir: root,
      sourceContext: sourceContext(),
      fileSpecs: [{ relative_path: 'nested\\beta.json', role: 'bad' }],
      recordedAt: NOW
    }));

    await mustReject('duplicate path spec', async () => Evidence.buildManifest({
      rootDir: root,
      sourceContext: sourceContext(),
      fileSpecs: [
        { relative_path: 'alpha.txt', role: 'one' },
        { relative_path: 'alpha.txt', role: 'two' }
      ],
      recordedAt: NOW
    }));

    const linkPath = path.join(root, 'linked.txt');
    fs.symlinkSync(path.join(root, 'alpha.txt'), linkPath);
    await mustReject('symlink file', async () => Evidence.buildManifest({
      rootDir: root,
      sourceContext: sourceContext(),
      fileSpecs: [{ relative_path: 'linked.txt', role: 'bad' }],
      recordedAt: NOW
    }));

    const changed = clone(manifest);
    fs.writeFileSync(path.join(root, 'alpha.txt'), 'changed\n', 'utf8');
    await mustReject('changed file bytes', async () => Evidence.verifyManifest({ rootDir: root, manifest: changed }));
    fs.writeFileSync(path.join(root, 'alpha.txt'), 'alpha\n', 'utf8');

    const digestTamper = clone(manifest);
    digestTamper.set_digest.value = 'f'.repeat(64);
    await mustReject('set digest tamper', async () => Evidence.verifyManifest({ rootDir: root, manifest: digestTamper }));

    const entryDigestTamper = clone(manifest);
    entryDigestTamper.files[0].sha256 = 'e'.repeat(64);
    await mustReject('file digest tamper', async () => Evidence.verifyManifest({ rootDir: root, manifest: entryDigestTamper }));

    const orderTamper = clone(manifest);
    orderTamper.files.reverse();
    await mustReject('manifest file ordering tamper', async () => Evidence.verifyManifest({ rootDir: root, manifest: orderTamper }));

    const unsafeClaim = clone(manifest);
    unsafeClaim.claims.evidence_truth_certified = true;
    await mustReject('truth overclaim', async () => Evidence.verifyManifest({ rootDir: root, manifest: unsafeClaim }));

    const konturOverclaim = clone(manifest);
    konturOverclaim.claims.kontur_readiness_established = true;
    await mustReject('KONTUR readiness overclaim', async () => Evidence.verifyManifest({ rootDir: root, manifest: konturOverclaim }));

    const unexpectedTop = clone(manifest);
    unexpectedTop.authority = 'invented';
    await mustReject('unexpected manifest field', async () => Evidence.verifyManifest({ rootDir: root, manifest: unexpectedTop }));

    const incompleteContext = clone(manifest);
    delete incompleteContext.source_context.tree_sha;
    await mustReject('incomplete source context', async () => Evidence.verifyManifest({ rootDir: root, manifest: incompleteContext }));

    const badId = clone(manifest);
    badId.manifest_id = `urn:uu-aap:evidence:availability-manifest:${'0'.repeat(24)}`;
    await mustReject('manifest id substitution', async () => Evidence.verifyManifest({ rootDir: root, manifest: badId }));

    console.log('Evidence Availability Manifest v0.1: PASS');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
