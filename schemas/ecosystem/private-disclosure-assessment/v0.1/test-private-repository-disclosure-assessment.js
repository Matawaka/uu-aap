'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');
const { assess, hashWithoutContentHash, validateInput, validateReceipt } = require('./private-repository-disclosure-assessment.js');

function baseInput() {
  return {
    protocol: 'UU-AAP-PRIVATE-PORTFOLIO-DISCLOSURE-ASSESSMENT',
    version: '0.1',
    artifact_type: 'PrivateRepositoryDisclosureAssessmentInput',
    candidate_id: 'urn:uu-aap:private-repository-candidate:example-001',
    evaluated_at: '2026-08-28T07:00:00Z',
    repository_evidence: {
      owner: 'example-owner',
      name: 'example-private-repository',
      url: 'https://example.invalid/example-owner/example-private-repository',
      visibility: 'private',
      default_branch: 'main',
      frontier: { commit_sha: '1'.repeat(40), tree_sha: '2'.repeat(40) }
    },
    gates: {
      connector_frontier_verified: 'pass', secret_scan_clear: 'pass', private_data_scan_clear: 'pass', ip_disclosure_clear: 'pass',
      third_party_license_clear: 'pass', security_abuse_review_clear: 'pass', role_classified: 'pass', monetization_impact_assessed: 'pass',
      canonical_provenance_bound: 'pass', human_disclosure_approval: 'approved'
    },
    role_classification: 'protocol',
    priorities: { strategic: 'P0', development_wip: 'P1', monetization_validation: 'P1' },
    monetization: {
      direct_product_revenue_fit: 'low', managed_service_integration_fit: 'high', enterprise_conformance_support_fit: 'high',
      audience_adoption_leverage: 'high', source_secrecy_value: 'low', open_network_effect_value: 'high'
    },
    disclosure_request: { partial: false, full: true }
  };
}

function expectFailure(fn, label) { let failed = false; try { fn(); } catch (_) { failed = true; } assert(failed, `${label}: expected failure`); }
const tests = [];

tests.push(function fullCandidateRequiresAllGates() {
  const r = assess(baseInput());
  assert.strictEqual(r.recommended_disposition, 'FULL_PUBLIC_DISCLOSURE_CANDIDATE');
  assert.strictEqual(r.next_safe_action, 'HUMAN_REVIEW_DISCLOSURE_CANDIDATE');
  assert.deepStrictEqual(r.blockers, []);
});

tests.push(function partialCandidateWorksOnlyAfterAllGates() {
  const i = baseInput(); i.disclosure_request = { partial: true, full: false };
  assert.strictEqual(assess(i).recommended_disposition, 'PARTIAL_DISCLOSURE_CANDIDATE');
});

tests.push(function everyTechnicalGateFailsClosed() {
  const keys = Object.keys(baseInput().gates).filter(k => k !== 'human_disclosure_approval');
  for (const key of keys) for (const state of ['fail','unknown']) {
    const i = baseInput(); i.gates[key] = state; const r = assess(i);
    assert.strictEqual(r.recommended_disposition, 'KEEP_PRIVATE', `${key}:${state}`);
    assert(r.blockers.includes(`${key}:${state}`));
  }
});

tests.push(function humanApprovalFailsClosed() {
  for (const state of ['not_approved','unknown']) { const i = baseInput(); i.gates.human_disclosure_approval = state; assert.strictEqual(assess(i).recommended_disposition, 'KEEP_PRIVATE'); }
});

tests.push(function noDisclosureRequestFailsClosed() {
  const i = baseInput(); i.disclosure_request = { partial: false, full: false }; const r = assess(i);
  assert.strictEqual(r.recommended_disposition, 'KEEP_PRIVATE'); assert(r.blockers.includes('disclosure_request:none'));
});

tests.push(function monetizationCannotAuthorizeDisclosure() {
  const i = baseInput(); i.gates.human_disclosure_approval = 'not_approved'; for (const key of Object.keys(i.monetization)) i.monetization[key] = 'high';
  assert.strictEqual(assess(i).recommended_disposition, 'KEEP_PRIVATE');
});

tests.push(function sanitizedReceiptContainsNoRepositoryIdentity() {
  const i = baseInput(); const r = assess(i); const text = JSON.stringify(r);
  assert(!text.includes(i.repository_evidence.name)); assert(!text.includes(i.repository_evidence.owner)); assert(!text.includes(i.repository_evidence.url));
  assert.strictEqual(r.sanitization.repository_identity_included, false);
});

tests.push(function deterministicReceiptIdentity() {
  const a = assess(baseInput()), b = assess(baseInput()); assert.deepStrictEqual(a, b); assert.strictEqual(a.content_hash, hashWithoutContentHash(a));
});

tests.push(function receiptOverclaimRejected() {
  const r = assess(baseInput()); r.non_effects.visibility_change_performed = true; r.content_hash = hashWithoutContentHash(r);
  expectFailure(() => validateReceipt(r), 'visibility overclaim');
});

tests.push(function inputRejectsDoubleDisclosureRequest() {
  const i = baseInput(); i.disclosure_request = { partial: true, full: true }; expectFailure(() => validateInput(i), 'double disclosure request');
});

tests.push(function inputRejectsPublicRepository() {
  const i = baseInput(); i.repository_evidence.visibility = 'public'; expectFailure(() => validateInput(i), 'public repository');
});

tests.push(function cliIsReadOnlyAndImportSafe() {
  const script = path.resolve(__dirname, 'private-repository-disclosure-assessment.js');
  const imported = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(script)})`], { encoding: 'utf8' });
  assert.strictEqual(imported.status, 0, imported.stderr); assert.strictEqual(imported.stdout, '');
  for (const command of ['publish','make-public','deploy','push','merge','execute','send','actuate']) {
    const run = spawnSync(process.execPath, [script, command, '-'], { input: '{}', encoding: 'utf8' });
    assert.notStrictEqual(run.status, 0, command); assert(/unsupported command/.test(run.stderr), run.stderr);
  }
});

for (const test of tests) { test(); process.stdout.write(`PASS ${test.name}\n`); }
process.stdout.write(`PASS Private Portfolio Disclosure Assessment Gate v0.1 (${tests.length} groups)\n`);
