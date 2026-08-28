'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Runtime = require('./stress-test.js');

const examplePath = path.join(__dirname, 'examples', 'synthetic-onboarding.input.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadExample() {
  return JSON.parse(fs.readFileSync(examplePath, 'utf8'));
}

function mutateInput(input, mutation, rehash = true) {
  const changed = clone(input);
  mutation(changed);
  if (rehash) Runtime.rehash(changed);
  return changed;
}

function mutateReceipt(receipt, mutation, rehash = true) {
  const changed = clone(receipt);
  mutation(changed);
  if (rehash) Runtime.rehash(changed);
  return changed;
}

function reject(name, operation, pattern = null) {
  let error = null;
  try {
    operation();
  } catch (value) {
    error = value;
  }
  assert(error, `${name}: expected rejection`);
  if (pattern) assert.match(error.message, pattern, `${name}: unexpected rejection`);
  return name;
}

const input = loadExample();
Runtime.validateInput(input);
assert.strictEqual(input.content_hash, Runtime.computeContentHash(input), 'committed synthetic example hash must be canonical');

const receipt = Runtime.analyze(input);
const receipt2 = Runtime.analyze(clone(input));
assert.deepStrictEqual(receipt2, receipt, 'stress-test output must be deterministic for exact input');
assert.strictEqual(Runtime.validateReceipt(receipt), receipt);
assert.strictEqual(receipt.state, 'CONFLICT');
assert.deepStrictEqual(receipt.uncertainty_states, ['CONFLICT', 'INSUFFICIENT_EVIDENCE', 'UNKNOWN']);
assert.strictEqual(receipt.recommendation_candidate.candidate, 'HUMAN_RECONCILIATION_REQUIRED');
assert.strictEqual(receipt.recommendation_candidate.human_disposition_required, true);
assert.strictEqual(receipt.next_safe_action, Runtime.NEXT_SAFE_ACTION);
assert.strictEqual(receipt.claims.claim_rejected, false);
assert.strictEqual(receipt.claims.automatic_negative_judgment, false);
assert.strictEqual(receipt.claims.truth_certified, false);
assert.strictEqual(receipt.claims.human_disposition_recorded, false);
assert.strictEqual(receipt.claims.external_effect_performed, false);
assert.strictEqual(receipt.claims.action_permit_created, false);
assert.strictEqual(receipt.claims.execution_admitted, false);
assert.strictEqual(receipt.success_criteria.material_claim_classification, true);
assert.strictEqual(receipt.success_criteria.recommendation_falsifiability, true);
assert.strictEqual(receipt.success_criteria.no_external_effect, true);
assert.deepStrictEqual(receipt.classification_summary.counts, {
  observed_evidence: 1,
  interpretation: 1,
  assumption: 1,
  hypothesis: 1,
  declared_objective: 1
});
assert.strictEqual(receipt.evidence_lineage.length, 5);
assert.strictEqual(receipt.causal_alternatives.length, 3);
assert.strictEqual(receipt.falsifiers.length, 5);
assert.strictEqual(receipt.missing_evidence.length, 3);
assert(receipt.counterarguments.length >= 6, 'synthetic conflict should produce bounded counterargument candidates');
assert(receipt.counterarguments.every(item => item.status === 'candidate'));
assert(receipt.causal_alternatives.every(item => item.status === 'candidate'));

const inspection = Runtime.inspectInput(input);
assert.strictEqual(inspection.state, 'CONFLICT');
assert.strictEqual(inspection.human_disposition_required, true);
assert.strictEqual(inspection.external_effect_performed, false);

const validation = Runtime.validationReceipt(input);
assert.strictEqual(validation.valid, true);
assert.strictEqual(validation.synthetic_only, true);
assert.strictEqual(validation.external_effect_available, false);
assert.strictEqual(validation.human_disposition_available, false);

const rejected = [];

rejected.push(reject('input_hash_tamper', () => {
  const changed = clone(input);
  changed.claim_package.claim_text += ' tampered';
  Runtime.validateInput(changed);
}, /input content hash mismatch/));

rejected.push(reject('wrong_contract_hash', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.contract_binding.content_hash = `sha256:${'0'.repeat(64)}`;
})), /Product Contract hash mismatch/));

rejected.push(reject('duplicate_statement_id', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.claim_package.material_statements[1].statement_id = changed.claim_package.material_statements[0].statement_id;
})), /duplicate statement id/));

rejected.push(reject('missing_classification', () => Runtime.validateInput(mutateInput(input, changed => {
  delete changed.claim_package.material_statements[1].classification;
})), /material_statement keys mismatch/));

rejected.push(reject('unsupported_classification', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.claim_package.material_statements[1].classification = 'truth';
})), /classification unsupported/));

rejected.push(reject('duplicate_evidence_id', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.supporting_evidence[1].evidence_id = changed.supporting_evidence[0].evidence_id;
})), /duplicate evidence id/));

rejected.push(reject('unknown_statement_evidence_ref', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.claim_package.material_statements[0].evidence_refs = ['ev-does-not-exist'];
})), /references unknown evidence/));

rejected.push(reject('evidence_unknown_statement', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.supporting_evidence[0].supports_statement_ids = ['stmt-does-not-exist'];
})), /references unknown statement/));

rejected.push(reject('statement_evidence_lineage_mismatch', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.claim_package.material_statements[0].evidence_refs = ['ev-scripted-setup'];
})), /statement\/evidence lineage mismatch/));

rejected.push(reject('support_contradiction_overlap_not_conflicting', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.supporting_evidence[0].contradicts_statement_ids.push('stmt-observed-activation');
})), /overlap requires conflicting quality/));

rejected.push(reject('empty_scope', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.claim_package.scope = [];
})), /requires at least 1/));

rejected.push(reject('empty_review_purpose', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.claim_package.review_purpose = '';
})), /review_purpose must be a non-empty string/));

rejected.push(reject('missing_objective', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.decision_constraints.objectives = [];
})), /objectives requires at least 1/));

rejected.push(reject('missing_constraint', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.decision_constraints.constraints = [];
})), /constraints requires at least 1/));

rejected.push(reject('forbidden_claim_data_class', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.claim_package.data_class = 'personal-audience-record';
})), /claim_package data class mismatch/));

rejected.push(reject('forbidden_evidence_data_class', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.supporting_evidence[0].data_class = 'protected-attribute-profile';
})), /evidence data class mismatch/));

for (const control of [
  'network_access_required',
  'filesystem_write_required',
  'provider_invocation_available',
  'publication_available',
  'campaign_send_available',
  'advertising_account_access_available',
  'spend_available',
  'audience_upload_available',
  'personal_targeting_available',
  'cross_context_correlation_available',
  'identity_resolution_available',
  'protected_attribute_inference_available',
  'psychological_vulnerability_inference_available',
  'external_system_mutation_available',
  'human_disposition_available',
  'action_permit_available',
  'execution_available',
  'external_effect_available',
  'automatic_retry'
]) {
  rejected.push(reject(`forbidden_control_${control}`, () => Runtime.validateInput(mutateInput(input, changed => {
    changed.controls[control] = true;
  })), new RegExp(`controls\\.${control} must remain false`)));
}

rejected.push(reject('non_synthetic_runtime', () => Runtime.validateInput(mutateInput(input, changed => {
  changed.controls.synthetic_only = false;
})), /synthetic_only must remain true/));

for (const claim of Runtime.FALSE_CLAIMS) {
  rejected.push(reject(`receipt_overclaim_${claim}`, () => Runtime.validateReceipt(mutateReceipt(receipt, changed => {
    changed.claims[claim] = true;
  })), new RegExp(`prohibited claim ${claim} must remain false`)));
}

rejected.push(reject('receipt_unknown_claim', () => Runtime.validateReceipt(mutateReceipt(receipt, changed => {
  changed.claims.new_authority = false;
})), /receipt\.claims keys mismatch/));

rejected.push(reject('receipt_human_disposition_state', () => Runtime.validateReceipt(mutateReceipt(receipt, changed => {
  changed.state = 'REJECTED';
})), /receipt\.state unsupported/));

rejected.push(reject('receipt_fake_next_action', () => Runtime.validateReceipt(mutateReceipt(receipt, changed => {
  changed.next_safe_action = 'PUBLISH';
})), /next_safe_action mismatch/));

for (const command of ['publish', 'send', 'campaign', 'spend', 'target', 'profile', 'execute', 'mutate', 'reject', 'accept']) {
  rejected.push(reject(`forbidden_cli_${command}`, () => Runtime.runCli([command, '-']), /unsupported command/));
}

console.log(JSON.stringify({
  suite: 'Маркетолог Пессимиста Local Stress-Test MVP v0.1',
  input_hash: input.content_hash,
  state: receipt.state,
  recommendation_candidate: receipt.recommendation_candidate.candidate,
  material_statement_count: receipt.evidence_lineage.length,
  missing_evidence_count: receipt.missing_evidence.length,
  counterargument_candidate_count: receipt.counterarguments.length,
  causal_alternative_candidate_count: receipt.causal_alternatives.length,
  fail_closed_vectors_rejected: rejected.length,
  claim_rejected: false,
  human_disposition_recorded: false,
  external_effect_performed: false,
  result: 'PASS'
}, null, 2));
