'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Runtime = require('./real-review-intake.js');
const LocalMVP = require('../../local-mvp/stress-test.js');

const fixturePath = path.join(__dirname, 'examples', 'synthetic-positioning.intake.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rehash(value) {
  Runtime.rehash(value);
  return value;
}

function expectReject(mutator, label) {
  const value = clone(fixture);
  mutator(value);
  rehash(value);
  assert.throws(() => Runtime.validateInput(value), Runtime.MarketerPessimistRealReviewIntakeError, label);
}

Runtime.validateInput(fixture);
assert.strictEqual(fixture.content_hash, Runtime.computeContentHash(fixture));
assert.strictEqual(fixture.content_hash, 'sha256:7f3f54f356cd7914b7f572985d28c3447e7f707b67ececd401a2181227913928');

const candidate = Runtime.deriveCandidate(fixture);
assert.strictEqual(candidate.state, 'SYNTHETIC_CONFORMANCE_CANDIDATE_READY');
assert.strictEqual(candidate.source_binding.mode, 'synthetic_conformance');
assert.strictEqual(candidate.claims.intake_validated, true);
assert.strictEqual(candidate.claims.stress_test_receipt_created, false);
assert.strictEqual(candidate.claims.pilot_admitted, false);
assert.strictEqual(candidate.claims.pilot_permit_created, false);
assert.strictEqual(candidate.claims.action_permit_created, false);
assert.strictEqual(candidate.claims.execution_admitted, false);
assert.strictEqual(candidate.claims.external_effect_performed, false);
assert.strictEqual(candidate.next_safe_action, Runtime.NEXT_SAFE_ACTION);

// Synthetic conformance may be projected into the predecessor synthetic-only MVP
// without changing the business claim/evidence/decision-context semantics.
const legacyInput = {
  protocol: LocalMVP.PROTOCOL,
  version: LocalMVP.VERSION,
  artifact_type: LocalMVP.INPUT_TYPE,
  input_id: 'urn:uu-aap:marketer-pessimist:stress-test-input:intake-compatibility-001',
  contract_binding: clone(fixture.contract_binding),
  evaluation_frontier: clone(fixture.evaluation_frontier),
  claim_package: clone(fixture.claim_package),
  supporting_evidence: clone(fixture.supporting_evidence),
  decision_constraints: clone(fixture.decision_constraints),
  controls: {
    synthetic_only: true,
    local_only: true,
    read_only: true,
    network_access_required: false,
    filesystem_write_required: false,
    provider_invocation_available: false,
    publication_available: false,
    campaign_send_available: false,
    advertising_account_access_available: false,
    spend_available: false,
    audience_upload_available: false,
    personal_targeting_available: false,
    cross_context_correlation_available: false,
    identity_resolution_available: false,
    protected_attribute_inference_available: false,
    psychological_vulnerability_inference_available: false,
    external_system_mutation_available: false,
    human_disposition_available: false,
    action_permit_available: false,
    execution_available: false,
    external_effect_available: false,
    automatic_retry: false
  },
  content_hash: ''
};
LocalMVP.rehash(legacyInput);
LocalMVP.validateInput(legacyInput);
const legacyReceipt = LocalMVP.analyze(legacyInput);
assert.strictEqual(legacyReceipt.state, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(legacyReceipt.recommendation_candidate.candidate, 'REQUEST_MORE_EVIDENCE_CANDIDATE');
assert.strictEqual(legacyReceipt.claims.external_effect_performed, false);

// Exercise the future real_non_personal path using an in-memory test mutation only.
const realMode = clone(fixture);
realMode.intake_id = 'urn:uu-aap:marketer-pessimist:real-review-intake:test-real-mode-001';
realMode.source_context.mode = 'real_non_personal';
realMode.source_context.source_reference = 'urn:test:non-personal-business-source:positioning:001';
realMode.source_context.classification_basis = 'Test-only mutation exercising the explicit real_non_personal validation path; no real-world data is committed.';
rehash(realMode);
Runtime.validateInput(realMode);
const realCandidate = Runtime.deriveCandidate(realMode);
assert.strictEqual(realCandidate.state, 'REAL_REVIEW_CANDIDATE_READY');
assert.strictEqual(realCandidate.claims.non_personal_status_inferred, false);
assert.strictEqual(realCandidate.claims.local_mvp_runtime_invoked, false);
assert.strictEqual(realCandidate.claims.stress_test_receipt_created, false);

expectReject(value => { value.source_context.human_classification_supplied = false; }, 'missing human classification');
expectReject(value => { value.source_context.personal_data_present = true; }, 'personal data');
expectReject(value => { value.source_context.sensitive_personal_data_present = true; }, 'sensitive personal data');
expectReject(value => { value.source_context.identity_resolution_required = true; }, 'identity resolution');
expectReject(value => { value.source_context.protected_attribute_data_present = true; }, 'protected attribute data');
expectReject(value => { value.source_context.psychological_vulnerability_data_present = true; }, 'psychological vulnerability data');
expectReject(value => { value.source_context.retention_mode = 'persistent'; }, 'persistent retention');
expectReject(value => { value.source_context.deletion_supported = false; }, 'deletion unavailable');
expectReject(value => { value.source_context.correction_supported = false; }, 'correction unavailable');
expectReject(value => { value.controls.network_access_required = true; }, 'network access');
expectReject(value => { value.controls.provider_invocation_available = true; }, 'provider invocation');
expectReject(value => { value.controls.publication_available = true; }, 'publication');
expectReject(value => { value.controls.campaign_send_available = true; }, 'campaign send');
expectReject(value => { value.controls.spend_available = true; }, 'spend');
expectReject(value => { value.controls.personal_targeting_available = true; }, 'targeting');
expectReject(value => { value.controls.external_system_mutation_available = true; }, 'external mutation');
expectReject(value => { value.controls.pilot_permit_available = true; }, 'pilot permit');
expectReject(value => { value.controls.action_permit_available = true; }, 'action permit');
expectReject(value => { value.controls.execution_available = true; }, 'execution');
expectReject(value => { value.controls.external_effect_available = true; }, 'external effect');
expectReject(value => {
  value.source_context.mode = 'real_non_personal';
  value.source_context.source_reference = 'urn:synthetic:not-allowed-for-real-mode';
}, 'real mode synthetic reference');
expectReject(value => {
  value.claim_package.material_statements[1].evidence_refs = ['ev-missing'];
}, 'unknown evidence reference');
expectReject(value => {
  value.supporting_evidence[1].supports_statement_ids = ['stmt-observed-trial-starts'];
}, 'lineage mismatch');
expectReject(value => {
  value.claim_package.material_statements.push(clone(value.claim_package.material_statements[0]));
}, 'duplicate statement id');
expectReject(value => {
  value.supporting_evidence.push(clone(value.supporting_evidence[0]));
}, 'duplicate evidence id');

console.log('PASS: Marketer Pessimist Real Review Intake v0.1 conformance');