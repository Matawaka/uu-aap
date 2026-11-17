'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { ROOT, RECEIPT, DOC, validate, checkPublicContract, checkLinks } = require('../check-registration-outcome.js');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const example = () => read(RECEIPT);
const contract = () => read('schemas/ip/v0.1/registration-outcome.schema.json');

test('reported outcome reconciles the original object and all frozen historical bytes', () => {
  assert.equal(validate(), true);
});
test('personal identity and attachment fields cannot enter any public receipt layer', () => {
  for (const place of [null, 'actor', 'registration', 'evidence', 'deposit_binding', 'author_publication']) {
    for (const key of ['legal_name', 'passport_number', 'address', 'signature', 'document_scan']) {
      const record = example();
      (place ? record[place] : record)[key] = 'synthetic-sensitive-value';
      assert.throws(() => checkPublicContract(record, contract()));
    }
  }
});
test('reported evidence cannot silently become verified deposited bytes or registry evidence', () => {
  for (const [key, value] of [['exact_deposit_match', 'VERIFIED'], ['submitted_materials_digest', 'sha256:' + '1'.repeat(64)]]) {
    const record = example(); record.deposit_binding[key] = value;
    assert.throws(() => validate(record));
  }
  const record = example();
  record.evidence.independent_registry_verification = 'VERIFIED';
  assert.throws(() => validate(record));
});
test('invented official dates and reconstructed filing readiness are rejected', () => {
  const record = example(); record.registration.registration_date = '2026-11-17';
  assert.throws(() => validate(record));
  const ready = example(); ready.filing_readiness = { status: 'COMPLETE' };
  assert.throws(() => validate(ready));
});
test('number, source hash, receipt digest, predecessor and non-effects are immutable', () => {
  const changes = [
    r => { r.registration.registration_number = '2026691651'; },
    r => { r.deposit_binding.source_sha256 = '0'.repeat(64); },
    r => { r.receipt_digest = 'sha256:' + '0'.repeat(64); },
    r => { r.predecessor.record_ref = 'missing.json'; },
    r => { r.non_effects.pop(); },
  ];
  for (const change of changes) { const record = example(); change(record); assert.throws(() => validate(record)); }
});
function withChangedJson(t, relative, change, action) {
  const target = path.join(ROOT, relative);
  const original = fs.readFileSync;
  const mock = t.mock.method(fs, 'readFileSync', function(file, ...args) {
    const value = original.call(this, file, ...args);
    if (path.resolve(String(file)) !== target) return value;
    const parsed = JSON.parse(String(value)); change(parsed);
    return JSON.stringify(parsed);
  });
  try { action(); } finally { mock.mock.restore(); }
}
test('cross-record object and pseudonym drift fail even with an unchanged valid receipt', t => {
  withChangedJson(t, example().predecessor.record_ref, r => { r.object.object_id = 'other-object'; },
    () => assert.throws(() => validate()));
  withChangedJson(t, example().author_publication.decision_ref, r => { r.author_visibility.public_pseudonym = 'OTHER'; },
    () => assert.throws(() => validate()));
});
test('historical Git bytes reject tampered support-file inventory sizes', t => {
  withChangedJson(t, example().deposit_binding.manifest_ref, r => { r.files[0].size_bytes++; },
    () => assert.throws(() => validate()));
});
test('broken paths, missing anchors, path escape and unexpected external hosts fail', () => {
  for (const target of ['missing-file.md', 'IP-RIGHTS-REGISTRATION-PROTOCOL-v0.1.md#missing',
    '../../../../outside.txt', 'https://example.invalid/private']) {
    assert.throws(() => checkLinks('[target](' + target + ')', DOC, ROOT));
  }
});
test('unreviewed public legal content fails the disclosure digest gate', t => {
  const original = fs.readFileSync;
  const target = path.join(ROOT, DOC);
  const mock = t.mock.method(fs, 'readFileSync', function(file, ...args) {
    const value = original.call(this, file, ...args);
    return path.resolve(String(file)) === target ? value + '\nsynthetic-private-contact\n' : value;
  });
  try { assert.throws(() => validate(), /Public legal text changed/); }
  finally { mock.mock.restore(); }
});
