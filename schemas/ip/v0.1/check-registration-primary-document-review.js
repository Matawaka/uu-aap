'use strict';
// Read-only successor verification. No reconstruction of intermediate filing states.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const RECEIPT = 'schemas/ip/v0.1/examples/registration-primary-document-review.json';
const SCHEMA = 'schemas/ip/v0.1/registration-primary-document-review.schema.json';
const DOC = 'docs/legal/ROSPATENT-PRIMARY-DOCUMENT-REVIEW-2026691650.md';
const ORIGINAL = 'schemas/ip/v0.1/examples/registration-outcome.json';
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const load = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const canonical = v => Array.isArray(v) ? '[' + v.map(canonical).join(',') + ']'
  : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map(k =>
    JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}' : JSON.stringify(v);
const DOC_SHA256 = '3b5617e497c9ab53101a7d9ed2c5f19e761b8b6517f52217de4ab6a84e2eac40';
function checkContract(value, schema) {
  if (Object.hasOwn(schema, 'const')) return assert.deepEqual(value, schema.const);
  if (schema.type === 'string') {
    assert.equal(typeof value, 'string');
    return assert(new RegExp(schema.pattern).test(value));
  }
  assert.equal(schema.type, 'object');
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(Object.keys(value).sort(), schema.required.slice().sort());
  for (const [k, child] of Object.entries(schema.properties)) checkContract(value[k], child);
}
function validate(receipt = load(RECEIPT)) {
  checkContract(receipt, load(SCHEMA));
  const { receipt_digest, ...data } = receipt;
  assert.equal(receipt_digest, 'sha256:' + sha256(canonical(data)));
  const origin = load(ORIGINAL);
  const manifest = load('schemas/ip/v0.1/examples/uu-aap-core-deposit-freeze.json');
  assert.equal(origin.receipt_id, receipt.predecessor.receipt_id);
  assert.equal(origin.receipt_digest, receipt.predecessor.receipt_digest);
  assert.equal(origin.object_id, receipt.object_id);
  assert.equal(origin.registration.registration_number, receipt.registration.registration_number);
  assert.equal(manifest.object_id, receipt.object_id);
  assert.equal(manifest.title_ru, receipt.registration.program_title_ru);
  assert.equal(origin.deposit_binding.exact_deposit_match, 'NOT_VERIFIED');
  assert.equal(origin.author_publication.discrepancy_status, receipt.assessment.author_pseudonym_publication_discrepancy);
  assert.equal(receipt.registration.decision_date, null);
  assert.equal(receipt.assessment.independent_public_registry_retrieval, 'NOT_CONFIRMED');
  const doc = fs.readFileSync(path.join(ROOT, DOC), 'utf8');
  assert.equal(sha256(doc), DOC_SHA256, 'Legal supplement text differs: manually review before replacing pinned hash');
  assert(doc.includes(receipt.registration.application_received_date));
  assert(doc.includes(receipt.registration.registration_date));
  assert(doc.includes(receipt.document_sha256.certificate_pdf));
  assert(doc.includes(receipt.document_sha256.notice_and_conclusion_pdf));
  for (const f of ['README.md']) assert(fs.readFileSync(path.join(ROOT, f), 'utf8').includes(DOC));
  assert(!/[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}/.test(doc), 'Unexpected email address in public supplement');
  return true;
}
if (require.main === module) {
  validate();
  console.log('PASS applicant-supplied primary-document review: bounded fields, digests, provenance and privacy');
}
module.exports = { validate, canonical, checkContract, RECEIPT, SCHEMA, DOC };
