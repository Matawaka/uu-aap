'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Runtime = require('./honest-hiring.js');
const FreeShield = require('../../../freeshield/v0.1/local-mvp/protective-assessment.js');

const EXAMPLE = path.join(__dirname, 'examples/synthetic-sap-data-platform-architect.input.json');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function load() { return JSON.parse(fs.readFileSync(EXAMPLE, 'utf8')); }
function reject(name, operation, pattern = null) {
  let rejected = false;
  try { operation(); }
  catch (error) {
    rejected = true;
    if (pattern) assert.match(error.message, pattern, `${name}: unexpected error`);
  }
  assert.strictEqual(rejected, true, `${name}: negative vector accepted`);
}
function rehashInput(input) { Runtime.rehash(input); return input; }
function rebuildFreeShield(input, mutateSource = null) {
  const source = input.freeshield.assessment_input;
  source.candidate.payload_digest = Runtime.comparisonPayloadDigest(input);
  if (mutateSource) mutateSource(source);
  FreeShield.rehash(source);
  input.freeshield.assessment_receipt = FreeShield.deriveAssessment(source);
  Runtime.rehash(input);
  return input;
}
function mutatePayload(input, mutation) {
  mutation(input);
  return rebuildFreeShield(input);
}

const input = load();
Runtime.validateInput(input);
const result = Runtime.deriveResult(input);
Runtime.validateResult(result);

assert.strictEqual(result.requirement_receipt.receipt_type, 'HonestHiringRequirementReceipt');
assert.strictEqual(result.requirement_receipt.coverage.material_requirement_count, 3);
assert.strictEqual(result.requirement_receipt.coverage.attributable_material_count, 3);
assert.strictEqual(result.requirement_receipt.coverage.coverage_complete, true);
assert.strictEqual(result.comparison_receipt.receipt_type, 'HonestHiringComparisonReceipt');
assert.strictEqual(result.comparison_receipt.freeshield_assessment_ref.outcome, 'ALLOW_ANALYSIS');
assert.strictEqual(result.comparison_receipt.state, 'COMPARISON_CANDIDATE_READY');
assert.strictEqual(result.comparison_receipt.global_ranking.created, false);
assert.strictEqual(result.comparison_receipt.claims.candidate_rejected, false);
assert.strictEqual(result.comparison_receipt.claims.employment_decision_made, false);
assert.strictEqual(result.comparison_receipt.claims.external_effect_performed, false);
assert.strictEqual(result.comparison_receipt.human_review_packet.protective_disposition_required, true);
assert.strictEqual(result.comparison_receipt.human_review_packet.comparison_disposition_required, true);
assert.deepStrictEqual(result.comparison_receipt.uncertainty_summary.unverified_evidence_ids, ['ev-abap-extraction-claim']);
assert.deepStrictEqual(result.comparison_receipt.uncertainty_summary.unavailable_evidence_ids, ['ev-knowledge-transfer-unavailable']);
assert.deepStrictEqual(result.comparison_receipt.uncertainty_summary.unknown_requirement_ids, ['req-design-knowledge-transfer']);

const byReq = new Map(result.comparison_receipt.comparison_by_requirement.map(item => [item.requirement_id, item]));
assert.strictEqual(byReq.get('req-sap-bw-architecture').finding, 'EVIDENCED');
assert.strictEqual(byReq.get('req-abap-extraction').finding, 'PARTIAL_UNVERIFIED');
assert.strictEqual(byReq.get('req-design-knowledge-transfer').finding, 'UNAVAILABLE');

reject('wrong Honest Hiring contract', () => {
  const value = load();
  value.contract_binding.content_hash = 'sha256:' + '0'.repeat(64);
  rehashInput(value);
  Runtime.validateInput(value);
}, /contract hash mismatch/);

reject('duplicate requirement id', () => {
  const value = load();
  value.role.requirements[1].requirement_id = value.role.requirements[0].requirement_id;
  rehashInput(value);
  Runtime.validateInput(value);
}, /requirement_id values must be unique/);

reject('unattributed material requirement', () => {
  const value = load();
  value.role.requirements[0].owner_role_id = 'other-owner';
  rehashInput(value);
  Runtime.validateInput(value);
}, /material requirement owner mismatch/);

reject('missing relevance rationale', () => {
  const value = load();
  value.role.requirements[0].job_relevance_rationale = '';
  rehashInput(value);
  Runtime.validateInput(value);
}, /job_relevance_rationale must be a non-empty string/);

reject('duplicate evidence id', () => {
  const value = load();
  value.candidate.evidence_items[1].evidence_id = value.candidate.evidence_items[0].evidence_id;
  rehashInput(value);
  Runtime.validateInput(value);
}, /evidence_id values must be unique/);

reject('unknown claim evidence ref', () => {
  const value = load();
  value.candidate.claims[0].evidence_refs = ['missing-evidence'];
  rehashInput(value);
  Runtime.validateInput(value);
}, /claim references unknown evidence/);

reject('unknown claim requirement ref', () => {
  const value = load();
  value.candidate.claims[0].requirement_refs = ['missing-requirement'];
  rehashInput(value);
  Runtime.validateInput(value);
}, /claim references unknown requirement/);

reject('non-fictional candidate', () => {
  const value = load();
  value.candidate.fictional = false;
  rehashInput(value);
  Runtime.validateInput(value);
}, /fictional candidate data only/);

reject('global ranking control', () => {
  const value = load();
  value.controls.global_ranking_available = true;
  rehashInput(value);
  Runtime.validateInput(value);
}, /global_ranking_available must remain false/);

reject('cross-context correlation review', () => {
  const value = load();
  value.review_constraints.cross_context_correlation_allowed = true;
  rehashInput(value);
  Runtime.validateInput(value);
}, /cross_context_correlation_allowed must remain false/);

reject('FREESHIELD receipt substitution', () => {
  const value = load();
  value.freeshield.assessment_receipt.source_input.input_hash = 'sha256:' + '9'.repeat(64);
  FreeShield.rehash(value.freeshield.assessment_receipt);
  rehashInput(value);
  Runtime.validateInput(value);
}, /does not reproduce exact source input/);

reject('FREESHIELD wrong consumer contract', () => {
  const value = load();
  value.freeshield.assessment_input.consumer_binding.product_contract_hash = 'sha256:' + 'a'.repeat(64);
  FreeShield.rehash(value.freeshield.assessment_input);
  value.freeshield.assessment_receipt = FreeShield.deriveAssessment(value.freeshield.assessment_input);
  rehashInput(value);
  Runtime.validateInput(value);
}, /consumer contract hash mismatch/);

const prohibited = mutatePayload(load(), value => {
  value.candidate.evidence_items[0].feature_tags.push('protected_attribute');
});
const prohibitedResult = Runtime.deriveResult(prohibited);
assert.strictEqual(prohibitedResult.comparison_receipt.freeshield_assessment_ref.outcome, 'ALLOW_ANALYSIS');
assert.strictEqual(prohibitedResult.comparison_receipt.state, 'PROHIBITED_FEATURE_RISK');
assert.strictEqual(prohibitedResult.comparison_receipt.success_criteria.prohibited_feature_exclusion, false);
assert.strictEqual(prohibitedResult.comparison_receipt.claims.protected_attribute_inferred, false);
assert.strictEqual(prohibitedResult.comparison_receipt.claims.candidate_rejected, false);

const missingClaim = mutatePayload(load(), value => {
  value.candidate.claims = value.candidate.claims.filter(item => item.claim_id !== 'claim-knowledge-transfer');
});
const missingClaimResult = Runtime.deriveResult(missingClaim);
assert.strictEqual(missingClaimResult.comparison_receipt.state, 'INSUFFICIENT_JOB_RELEVANT_EVIDENCE');
assert.strictEqual(missingClaimResult.comparison_receipt.claims.candidate_rejected, false);

const conflict = mutatePayload(load(), value => {
  value.candidate.evidence_items[1].status = 'conflicting';
  value.candidate.claims[1].status = 'conflicting';
});
const conflictResult = Runtime.deriveResult(conflict);
assert.strictEqual(conflictResult.comparison_receipt.state, 'CONFLICT');
assert.strictEqual(conflictResult.comparison_receipt.claims.candidate_rejected, false);

const protectiveCases = [
  ['REQUIRE_EVIDENCE', 'INSUFFICIENT_JOB_RELEVANT_EVIDENCE', source => { source.evidence[1].quality = 'unverified'; }],
  ['HUMAN_REVIEW', 'CONFLICT', source => { source.evidence[1].quality = 'conflicting'; }],
  ['NARROW_SCOPE', 'UNKNOWN', source => { source.authority.authority_scope = ['fictional-role-requirement-comparison']; }],
  ['BLOCK_EFFECT', 'PROHIBITED_FEATURE_RISK', source => { source.candidate.analysis_only = false; source.candidate.external_effect_requested = true; }]
];
for (const [expectedOutcome, expectedState, mutation] of protectiveCases) {
  const value = rebuildFreeShield(load(), mutation);
  const localResult = Runtime.deriveResult(value);
  assert.strictEqual(localResult.comparison_receipt.freeshield_assessment_ref.outcome, expectedOutcome);
  assert.strictEqual(localResult.comparison_receipt.state, expectedState);
  assert.notStrictEqual(localResult.comparison_receipt.state, 'COMPARISON_CANDIDATE_READY');
  assert.strictEqual(localResult.comparison_receipt.claims.candidate_rejected, false);
  assert.strictEqual(localResult.comparison_receipt.claims.employment_decision_made, false);
}

for (const claimName of Runtime.COMPARISON_FALSE_CLAIMS) {
  reject(`comparison overclaim ${claimName}`, () => {
    const forged = clone(result);
    forged.comparison_receipt.claims[claimName] = true;
    Runtime.rehash(forged.comparison_receipt);
    Runtime.rehash(forged);
    Runtime.validateResult(forged);
  }, /must remain false/);
}

reject('unknown comparison claim', () => {
  const forged = clone(result);
  forged.comparison_receipt.claims.hidden_rank = false;
  Runtime.rehash(forged.comparison_receipt);
  Runtime.rehash(forged);
  Runtime.validateResult(forged);
}, /claims keys mismatch/);

reject('human disposition state', () => {
  const forged = clone(result);
  forged.comparison_receipt.state = 'ACCEPTED_FOR_HUMAN_REVIEW';
  Runtime.rehash(forged.comparison_receipt);
  Runtime.rehash(forged);
  Runtime.validateResult(forged);
}, /machine state invalid/);

reject('requirement receipt authority overclaim', () => {
  const forged = clone(result);
  forged.requirement_receipt.claims.candidate_comparison_authorized = true;
  Runtime.rehash(forged.requirement_receipt);
  Runtime.rehash(forged);
  Runtime.validateResult(forged);
}, /candidate_comparison_authorized must remain false/);

reject('result next action substitution', () => {
  const forged = clone(result);
  forged.next_safe_action = 'AUTOMATIC_HIRING_DECISION';
  Runtime.rehash(forged);
  Runtime.validateResult(forged);
}, /next safe action mismatch/);

for (const command of ['rank','score','reject','shortlist','hire','offer','contact','send','schedule','ats','execute','mutate','publish']) {
  reject(`forbidden CLI ${command}`, () => Runtime.runCli([command, '-']), /unsupported command/);
}

console.log('HONEST_HIRING_LOCAL_MVP_V0_1_PASS');
