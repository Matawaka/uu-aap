'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Runtime = require('./protective-assessment.js');

const fixturePath = path.join(__dirname, 'examples/synthetic-honest-hiring.input.json');
const outputPath = process.argv[2] || '/tmp/freeshield-protective-assessment.json';

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadFixture() { return JSON.parse(fs.readFileSync(fixturePath, 'utf8')); }
function mutateInput(input, mutation) {
  const changed = clone(input);
  mutation(changed);
  Runtime.rehash(changed);
  return changed;
}
function reject(name, operation, pattern = null) {
  let error = null;
  try { operation(); } catch (value) { error = value; }
  assert(error, `${name}: expected rejection`);
  if (pattern) assert.match(error.message, pattern, `${name}: unexpected rejection`);
  return name;
}

const input = loadFixture();
Runtime.validateInput(input);
assert.strictEqual(input.consumer_binding.product_id, 'honest-hiring');
assert.strictEqual(input.consumer_binding.product_contract_hash, 'sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae');

const receipt = Runtime.deriveAssessment(input);
assert.strictEqual(receipt.state, 'ASSESSMENT_READY');
assert.strictEqual(receipt.protective_outcome.outcome, 'ALLOW_ANALYSIS');
assert.strictEqual(receipt.protective_outcome.status, 'candidate');
assert.strictEqual(receipt.protective_outcome.human_disposition_required, true);
assert.strictEqual(receipt.next_safe_action, 'HUMAN_PROTECTIVE_DISPOSITION_REQUIRED');
assert.strictEqual(receipt.claims.candidate_rejected, false);
assert.strictEqual(receipt.claims.employment_decision_made, false);
assert.strictEqual(receipt.claims.actuator_blocked, false);
assert.strictEqual(receipt.claims.action_permit_created, false);
assert.strictEqual(receipt.claims.execution_admitted, false);
assert.strictEqual(receipt.claims.external_effect_performed, false);
assert.deepStrictEqual(receipt.risk_hypotheses, []);
assert.strictEqual(receipt.authority_findings.scope_covered, true);
assert.strictEqual(receipt.authority_findings.action_permit_present, false);
assert.deepStrictEqual(receipt.evidence_findings.unverified_ids, []);
assert.deepStrictEqual(receipt.evidence_findings.stale_ids, []);
assert.deepStrictEqual(receipt.evidence_findings.conflicting_ids, []);
Runtime.validateReceipt(receipt);

const insufficient = Runtime.deriveAssessment(mutateInput(input, value => {
  value.authority.authority_lineage_complete = false;
}));
assert.strictEqual(insufficient.state, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(insufficient.protective_outcome.outcome, 'REQUIRE_EVIDENCE');
assert.strictEqual(insufficient.evidence_findings.missing_required_evidence, true);

const stale = Runtime.deriveAssessment(mutateInput(input, value => {
  value.evidence.find(item => item.id === 'current-frontier').quality = 'stale';
}));
assert.strictEqual(stale.state, 'INSUFFICIENT_EVIDENCE');
assert.strictEqual(stale.protective_outcome.outcome, 'REQUIRE_EVIDENCE');
assert.deepStrictEqual(stale.evidence_findings.stale_ids, ['current-frontier']);

const conflict = Runtime.deriveAssessment(mutateInput(input, value => {
  value.evidence.find(item => item.id === 'review-constraints').quality = 'conflicting';
}));
assert.strictEqual(conflict.state, 'CONFLICT');
assert.strictEqual(conflict.protective_outcome.outcome, 'HUMAN_REVIEW');
assert.strictEqual(conflict.reconciliation_candidate.required, true);

const narrowed = Runtime.deriveAssessment(mutateInput(input, value => {
  value.candidate.declared_scope.push('candidate-ranking');
}));
assert.strictEqual(narrowed.state, 'SCOPE_UNBOUND');
assert.strictEqual(narrowed.protective_outcome.outcome, 'NARROW_SCOPE');
assert.deepStrictEqual(narrowed.scope_findings.uncovered_scope, ['candidate-ranking']);

const block = Runtime.deriveAssessment(mutateInput(input, value => {
  value.candidate.analysis_only = false;
  value.candidate.external_effect_requested = true;
}));
assert.strictEqual(block.state, 'ASSESSMENT_READY');
assert.strictEqual(block.protective_outcome.outcome, 'BLOCK_EFFECT');
assert.strictEqual(block.protective_outcome.status, 'candidate');
assert.strictEqual(block.claims.actuator_blocked, false);
assert.strictEqual(block.claims.global_prohibition_created, false);
assert.strictEqual(block.claims.candidate_rejected, false);
assert.strictEqual(block.claims.external_effect_performed, false);
assert.strictEqual(block.risk_hypotheses[0].status, 'bounded_candidate');

const humanReviewConstraint = Runtime.deriveAssessment(mutateInput(input, value => {
  value.constraints[0].disposition = 'human_review';
}));
assert.strictEqual(humanReviewConstraint.state, 'CONFLICT');
assert.strictEqual(humanReviewConstraint.protective_outcome.outcome, 'HUMAN_REVIEW');

const rejected = [];
rejected.push(reject('input_hash_tamper', () => Runtime.validateInput({ ...clone(input), content_hash: `sha256:${'0'.repeat(64)}` }), /input content hash mismatch/));
rejected.push(reject('freeshield_contract_substitution', () => Runtime.validateInput(mutateInput(input, value => {
  value.contract_binding.content_hash = `sha256:${'0'.repeat(64)}`;
})), /FREESHIELD contract hash mismatch/));
rejected.push(reject('consumer_authority_transfer', () => Runtime.validateInput(mutateInput(input, value => {
  value.consumer_binding.authority_transfer = true;
})), /authority transfer/));
rejected.push(reject('duplicate_evidence_id', () => Runtime.validateInput(mutateInput(input, value => {
  value.evidence[1].id = value.evidence[0].id;
})), /duplicate evidence id/));
rejected.push(reject('unsupported_data_class', () => Runtime.validateInput(mutateInput(input, value => {
  value.evidence[1].data_class = 'candidate-personality-profile';
})), /unsupported FREESHIELD data class/));
rejected.push(reject('unknown_candidate_evidence_ref', () => Runtime.validateInput(mutateInput(input, value => {
  value.candidate.evidence_refs.push('unknown-evidence');
})), /unknown evidence ref/));
rejected.push(reject('action_permit_carriage', () => Runtime.validateInput(mutateInput(input, value => {
  value.authority.action_permit_ref = 'urn:uu-aap:permit:forbidden';
})), /does not accept ActionPermit/));
rejected.push(reject('network_control_enabled', () => Runtime.validateInput(mutateInput(input, value => {
  value.controls.network_access_required = true;
})), /network_access_required must remain false/));
rejected.push(reject('provider_control_enabled', () => Runtime.validateInput(mutateInput(input, value => {
  value.controls.provider_invocation_available = true;
})), /provider_invocation_available must remain false/));
rejected.push(reject('actuator_control_enabled', () => Runtime.validateInput(mutateInput(input, value => {
  value.controls.actuator_control_available = true;
})), /actuator_control_available must remain false/));

for (const claim of Runtime.FALSE_CLAIMS) {
  rejected.push(reject(`receipt_overclaim_${claim}`, () => {
    const changed = clone(receipt);
    changed.claims[claim] = true;
    Runtime.rehash(changed);
    Runtime.validateReceipt(changed);
  }, new RegExp(`prohibited receipt claim ${claim}`)));
}

rejected.push(reject('receipt_unknown_claim', () => {
  const changed = clone(receipt);
  changed.claims.future_power = false;
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /receipt.claims keys mismatch/));
rejected.push(reject('human_disposition_state', () => {
  const changed = clone(receipt);
  changed.state = 'ACCEPTED_PROTECTIVE_ASSESSMENT';
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /machine state invalid/));
rejected.push(reject('protective_outcome_not_candidate', () => {
  const changed = clone(receipt);
  changed.protective_outcome.status = 'accepted';
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /must remain candidate/));
rejected.push(reject('next_safe_action_substitution', () => {
  const changed = clone(receipt);
  changed.next_safe_action = 'EXECUTE';
  Runtime.rehash(changed);
  Runtime.validateReceipt(changed);
}, /next_safe_action mismatch/));

for (const command of ['block', 'ban', 'sanction', 'blacklist', 'reject', 'hire', 'send', 'execute', 'mutate', 'publish']) {
  rejected.push(reject(`forbidden_cli_${command}`, () => Runtime.runCli([command, '-']), /unsupported command/));
}

fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({
  suite: 'FREESHIELD Local Protective Assessment MVP v0.1',
  consumer: input.consumer_binding.product_id,
  canonical_outcome: receipt.protective_outcome.outcome,
  canonical_state: receipt.state,
  block_effect_is_local_candidate_only: block.claims.actuator_blocked === false,
  fail_closed_vectors_rejected: rejected.length,
  result: 'PASS'
}, null, 2));
