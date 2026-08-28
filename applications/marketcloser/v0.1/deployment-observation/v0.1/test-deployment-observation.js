'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Runtime = require('./deployment-observation.js');

const fixturePath = path.join(__dirname, 'examples', 'synthetic-deployment-observation.input.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectReject(mutator, label) {
  const candidate = clone(fixture);
  mutator(candidate);
  Runtime.rehash(candidate);
  assert.throws(() => Runtime.validateInput(candidate), undefined, label);
}

Runtime.validateInput(fixture);
const synthetic = Runtime.deriveReceipt(fixture);
assert.equal(synthetic.observation_status, 'SYNTHETIC_CONFORMANCE_OBSERVATION_RECORDED');
assert.equal(synthetic.binding_status, 'DEPLOYMENT_BINDING_INSUFFICIENT');
assert.equal(synthetic.claims.deployment_verified, false);
assert.equal(synthetic.claims.source_provenance_established, false);
assert.equal(synthetic.claims.uu_aap_conformance_established, false);
assert.equal(synthetic.claims.private_material_committed, false);
assert.equal(synthetic.next_safe_action, 'MINIMIZED_REAL_REVIEW_BRIDGE_REQUIRED');

const realShape = clone(fixture);
realShape.observation_id = 'urn:uu-aap:marketcloser:deployment-observation:operator-real-shape-001';
realShape.deployment.url = 'https://operator-supplied.example';
realShape.observed_application.reported_version = 'operator-reported-version';
realShape.observed_application.reported_architecture_profile = 'operator-reported-profile';
realShape.source_artifact.kind = 'metadata_export';
realShape.source_artifact.artifact_ref = 'urn:operator-supplied:private-artifact-reference:001';
realShape.observation.method = 'manual_operator_sharing';
Runtime.rehash(realShape);
Runtime.validateInput(realShape);
const operatorReceipt = Runtime.deriveReceipt(realShape);
assert.equal(operatorReceipt.observation_status, 'OPERATOR_DEPLOYMENT_OBSERVATION_RECORDED');
assert.equal(operatorReceipt.binding_status, 'DEPLOYMENT_BINDING_INSUFFICIENT');
assert.equal(operatorReceipt.claims.independent_observation_completed, false);
assert.equal(operatorReceipt.claims.audit_deployment_binding_established, false);

expectReject(x => { x.deployment.independently_verified = true; }, 'cannot self-verify deployment');
expectReject(x => { x.deployment.reachability_verified = true; }, 'cannot self-verify reachability');
expectReject(x => { x.observed_application.uu_aap_conformance_claimed = true; }, 'cannot claim conformance');
expectReject(x => { x.source_artifact.digest.independently_attested = true; }, 'cannot claim independent digest attestation');
expectReject(x => { x.source_artifact.private_material_committed = true; }, 'cannot commit private material');
expectReject(x => { x.observation.independent = true; }, 'cannot claim independent observation');
expectReject(x => { x.observation.network_fetch_performed = true; }, 'network fetch forbidden');
expectReject(x => { x.observation.dns_resolution_performed = true; }, 'DNS resolution forbidden');
expectReject(x => { x.observation.artifact_deployment_binding_evidence_present = true; }, 'binding evidence not available in v0.1');
expectReject(x => { x.observation.automatically_transmitted = true; }, 'automatic transmission not established');
expectReject(x => { x.controls.external_publication_available = true; }, 'publication unavailable');
expectReject(x => { x.controls.action_permit_available = true; }, 'ActionPermit unavailable');
expectReject(x => { x.controls.execution_available = true; }, 'execution unavailable');

console.log('MarketCloser Deployment-Bound Observation v0.1 conformance: PASS');
