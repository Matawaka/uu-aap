'use strict';

const fs = require('fs');
const path = require('path');
const Bridge = require('./bridge.js');
const Deployment = require(path.resolve(__dirname, '../../deployment-observation/v0.1/deployment-observation.js'));

const fixturePath = path.resolve(__dirname, 'examples/synthetic-minimized-review.input.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectReject(mutator, label) {
  const candidate = clone(fixture);
  mutator(candidate);
  Bridge.rehash(candidate);
  let rejected = false;
  try { Bridge.deriveReceipt(candidate); } catch (_) { rejected = true; }
  if (!rejected) throw new Error(`mutation unexpectedly accepted: ${label}`);
}

const receipt = Bridge.deriveReceipt(fixture);
if (receipt.status !== 'SYNTHETIC_MINIMIZED_BRIDGE_READY') throw new Error('synthetic bridge status mismatch');
if (receipt.marketer_binding.candidate_state !== 'SYNTHETIC_CONFORMANCE_CANDIDATE_READY') {
  throw new Error('synthetic Marketer candidate state mismatch');
}
if (receipt.deployment_observation_binding.binding_status !== 'DEPLOYMENT_BINDING_INSUFFICIENT') {
  throw new Error('deployment binding insufficiency was not preserved');
}
if (receipt.next_safe_action !== 'REAL_REVIEW_RUN_AUTHORITY_GATE_REQUIRED') throw new Error('next safe action mismatch');
for (const value of Object.values(receipt.transfer_boundary)) {
  if (value !== false) throw new Error('transfer boundary overclaim');
}

const marketerIntake = Bridge.deriveMarketerIntake(fixture, Deployment.deriveReceipt(fixture.deployment_observation));
if ('pressure_context' in marketerIntake) throw new Error('pressure context crossed Marketer boundary');
if ('source_epistemic_status' in marketerIntake.supporting_evidence[0]) {
  throw new Error('application-only evidence metadata crossed Marketer boundary');
}
if (marketerIntake.supporting_evidence[0].quality !== 'unverified') throw new Error('evidence quality changed during projection');

expectReject(x => { x.minimization.raw_review_text_included = true; }, 'raw review transfer');
expectReject(x => { x.minimization.raw_reviewer_identity_included = true; }, 'raw identity transfer');
expectReject(x => { x.minimization.personal_data_present = true; }, 'personal data');
expectReject(x => { x.pressure_context.transferred_to_marketer = true; }, 'pressure transfer');
expectReject(x => { x.pressure_context.epistemic_weight = true; }, 'pressure epistemic weight');
expectReject(x => { x.evidence_policy.deployment_binding_inferred = true; }, 'deployment binding inference');
expectReject(x => {
  x.minimized_case.supporting_evidence[0].source_epistemic_status = 'user_asserted_evidence_reference';
  x.minimized_case.supporting_evidence[0].quality = 'verified';
}, 'unverified evidence promotion');

const realShape = clone(fixture);
realShape.bridge_id = 'urn:uu-aap:marketcloser:minimized-real-review-bridge:in-memory-real-shape-001';
realShape.source_mode = 'real_non_personal';
realShape.minimized_case.source_claim_epistemic_status = 'unverified_user_claim';
realShape.minimized_case.supporting_evidence[0].source_epistemic_status = 'user_asserted_evidence_reference';
realShape.deployment_observation.observation.method = 'manual_operator_sharing';
realShape.deployment_observation.source_artifact.kind = 'metadata_export';
Deployment.rehash(realShape.deployment_observation);
Bridge.rehash(realShape);
const realReceipt = Bridge.deriveReceipt(realShape);
if (realReceipt.status !== 'REAL_MINIMIZED_REVIEW_CANDIDATE_READY') throw new Error('real-shape bridge status mismatch');
if (realReceipt.marketer_binding.candidate_state !== 'REAL_REVIEW_CANDIDATE_READY') {
  throw new Error('real-shape Marketer candidate state mismatch');
}
if (realReceipt.claims.stress_test_run !== false || realReceipt.claims.response_candidate_created !== false) {
  throw new Error('bridge overclaimed downstream work');
}

console.log('MarketCloser Minimized Real Review Bridge v0.1 conformance: PASS');
