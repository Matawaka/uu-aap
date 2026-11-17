'use strict';
// Read-only checks for one bounded historical receipt; no Core validator changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '../../..');
const RECEIPT = 'schemas/ip/v0.1/examples/registration-outcome.json';
const DOC = 'docs/legal/ROSPATENT-REGISTRATION-2026691650.md';
const PUBLIC_DOC_SHA256 = 'c753d0ca03de3305652ae80ca9fbf4c97872a1b42aebf72cdb94a414a1886251';
const load = (root, p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k =>
    JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);

// The committed schema deliberately uses only const and closed object shapes.
// Full Draft 2020-12 validation also runs independently with jsonschema in CI.
function checkPublicContract(value, schema) {
  if (Object.hasOwn(schema, 'const')) return assert.deepEqual(value, schema.const);
  if (schema.type === 'null') return assert.equal(value, null);
  assert.equal(schema.type, 'object');
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(value).sort(), [...schema.required].sort());
  for (const [key, child] of Object.entries(schema.properties)) checkPublicContract(value[key], child);
}
function checkLinks(text, file, root) {
  for (const match of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = match[1];
    if (/^https:\/\//.test(target)) {
      const url = new URL(target);
      assert.equal(url.username + url.password, '');
      assert(['github.com', 'www1.fips.ru'].includes(url.hostname), 'Unexpected external host');
      if (url.hostname === 'www1.fips.ru') {
        assert.equal(url.pathname, '/registers-doc-view/fips_servlet');
        assert.equal(url.searchParams.get('DB'), 'EVM');
        assert.equal(url.searchParams.get('DocNumber'), '2026691650');
        assert.equal(url.searchParams.get('TypeFile'), 'html');
      }
      continue;
    }
    assert(!/^[a-z]+:|\\/.test(target), 'Unexpected link scheme');
    const [relative, anchor] = target.split('#');
    const resolved = path.resolve(path.dirname(path.join(root, file)), relative);
    const rel = path.relative(root, resolved);
    assert(!rel.startsWith('..') && !path.isAbsolute(rel), 'Link escapes repository');
    assert(fs.statSync(resolved).isFile(), 'Missing local link target');
    if (anchor) {
      const headings = fs.readFileSync(resolved, 'utf8').split(/\r?\n/).filter(l => /^#+ /.test(l));
      const slugs = headings.map(l => l.replace(/^#+ /, '').toLowerCase()
        .replace(/[^\p{L}\p{N}_ -]/gu, '').replace(/ /g, '-'));
      assert(slugs.includes(anchor), 'Missing local heading');
    }
  }
}
function validate(record = load(ROOT, RECEIPT), root = ROOT) {
  const schema = load(root, 'schemas/ip/v0.1/registration-outcome.schema.json');
  checkPublicContract(record, schema);
  const digestInput = { ...record };
  delete digestInput.receipt_digest;
  assert.equal(record.receipt_digest, 'sha256:' + sha256(canonical(digestInput)));
  const predecessor = load(root, record.predecessor.record_ref);
  const manifest = load(root, record.deposit_binding.manifest_ref);
  const decision = load(root, record.author_publication.decision_ref);
  assert.equal(predecessor.record_id, record.predecessor.record_id);
  assert.equal(predecessor.state, record.predecessor.recorded_state);
  assert.equal(predecessor.object.object_id, record.object_id);
  assert.equal(manifest.object_id, record.object_id);
  assert.equal(decision.object_id, record.object_id);
  assert.equal(predecessor.evidence_anchor.commit_sha, manifest.freeze_frontier);
  assert.equal(manifest.freeze_frontier, record.deposit_binding.freeze_frontier);
  assert.equal(manifest.package_digest, record.deposit_binding.package_digest);
  assert.equal(predecessor.evidence_anchor.package_digest, manifest.package_digest);
  assert.equal(manifest.title_en, record.registration.object_title_en);
  assert.equal(manifest.program_size_bytes, record.deposit_binding.source_size_bytes);
  assert.equal(manifest.patent_screen.separate_patent_track_issue, 492);
  assert.equal(predecessor.patentability.status, 'SEPARATE_PATENT_TRACK');
  assert.equal(decision.author_visibility.selected, record.author_publication.intended_mode);
  assert.equal(decision.author_visibility.public_pseudonym, record.author_publication.intended_pseudonym);
  const files = [...manifest.files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assert.deepEqual(files.map(x => x.path).sort(), [...predecessor.evidence_anchor.paths].sort());
  assert.equal(files.length, 3);
  const source = files.find(f => f.role === 'PROGRAM_SOURCE');
  assert.equal(source.path, record.deposit_binding.source_path);
  assert.equal(source.sha256, record.deposit_binding.source_sha256);
  let inventory = 'UU-AAP-DEPOSIT-INVENTORY-v0.1\n';
  for (const entry of files) {
    const bytes = execFileSync('git', ['cat-file', 'blob', manifest.freeze_frontier + ':' + entry.path],
      { cwd: root, maxBuffer: 1024 * 1024 });
    assert.equal(bytes.length, entry.size_bytes);
    assert.equal(sha256(bytes), entry.sha256);
    const blob = Buffer.concat([Buffer.from('blob ' + bytes.length + '\0'), bytes]);
    assert.equal(crypto.createHash('sha1').update(blob).digest('hex'), entry.git_blob_sha1);
    inventory += entry.path + '\0' + entry.role + '\0' + entry.size_bytes + '\0' + entry.sha256 + '\n';
  }
  assert.equal('sha256:' + sha256(inventory), manifest.package_digest);
  const text = fs.readFileSync(path.join(root, DOC), 'utf8').replace(/\r\n/g, '\n');
  assert.equal(sha256(text), PUBLIC_DOC_SHA256, 'Public legal text changed: review disclosure and update digest');
  checkLinks(text, DOC, root);
  for (const file of ['README.md', 'NOTICE.md']) {
    const body = fs.readFileSync(path.join(root, file), 'utf8');
    assert(body.includes('2026691650'));
    assert(body.includes(DOC) && body.includes(RECEIPT));
  }
  return true;
}
if (require.main === module) {
  validate();
  console.log('PASS registration outcome: public contract, digest, lineage, historical Git bytes and links');
  console.log('External registry availability and exact deposited-byte identity remain unverified.');
}
module.exports = { ROOT, RECEIPT, DOC, validate, checkPublicContract, checkLinks };
