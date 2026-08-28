'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Interop = require('./readiness-family-interop.js');

const inputSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'readiness-family-interop-input.schema.json'), 'utf8'));
const receiptSchema = JSON.parse(fs.readFileSync(path.join(__dirname, 'readiness-family-interop-receipt.schema.json'), 'utf8'));

assert.strictEqual(inputSchema.additionalProperties, false);
assert.strictEqual(inputSchema.properties.protocol.const, Interop.PROTOCOL);
assert.strictEqual(inputSchema.properties.version.const, Interop.VERSION);
assert.strictEqual(inputSchema.properties.artifact_type.const, 'KONTURFamilyReadinessInteropInput');
assert.strictEqual(inputSchema.properties.evaluation_frontier.properties.repository.const, 'Matawaka/uu-aap');
assert.strictEqual(inputSchema.properties.controls.properties.surface.const, 'validate_inspect_only');
assert.strictEqual(inputSchema.properties.controls.properties.read_only.const, true);
for (const key of [
  'network_access_required',
  'filesystem_write_required',
  'activation_available',
  'responsibility_acceptance_available',
  'host_designation_available',
  'ledger_write_available',
  'runtime_start_available',
  'action_permit_available',
  'execution_available'
]) {
  assert.strictEqual(inputSchema.properties.controls.properties[key].const, false, `${key} must be false in input schema`);
}

assert.strictEqual(inputSchema.properties.family_manifest.$ref, '../family-manifest.schema.json');
assert.match(inputSchema.properties.readiness.properties.aggregation_receipt.$ref, /kontur-readiness-aggregation\.schema\.json$/);
assert.match(inputSchema.properties.readiness.properties.readiness_signal.$ref, /kontur-readiness-signal\.schema\.json$/);
assert.match(inputSchema.properties.readiness.properties.responsibility_policy.$ref, /kontur-responsibility-policy\.schema\.json$/);
assert.match(inputSchema.properties.readiness.properties.acceptance_receipt.$ref, /kontur-readiness-acceptance\.schema\.json$/);

assert.strictEqual(receiptSchema.additionalProperties, false);
assert.strictEqual(receiptSchema.properties.protocol.const, Interop.PROTOCOL);
assert.strictEqual(receiptSchema.properties.version.const, Interop.VERSION);
assert.strictEqual(receiptSchema.properties.receipt_type.const, Interop.RECEIPT_TYPE);
assert.strictEqual(receiptSchema.properties.status.const, Interop.STATUS);
assert.strictEqual(receiptSchema.properties.next_safe_action.const, Interop.NEXT_SAFE_ACTION);
assert.strictEqual(receiptSchema.properties.family.properties.family_id.const, 'kontur');
assert.strictEqual(receiptSchema.properties.family.properties.readiness_member_id.const, 'readiness-aggregator');
assert.strictEqual(receiptSchema.properties.family.properties.readiness_member_evidence_status.const, 'implemented_experimental');
assert.strictEqual(receiptSchema.properties.family.properties.readiness_to_activation_edge_status.const, 'established_evidence_dependency');
assert.strictEqual(receiptSchema.properties.readiness.properties.readiness_signal_ready.const, true);
assert.strictEqual(receiptSchema.properties.readiness.properties.source_acceptance_decision.const, 'accepted_for_activation_precondition');
assert.strictEqual(receiptSchema.properties.readiness.properties.human_activation_step_still_required.const, true);

const schemaClaimKeys = Object.keys(receiptSchema.properties.claims.properties).sort();
assert.deepStrictEqual(schemaClaimKeys, [...Interop.FALSE_CLAIMS].sort(), 'runtime/schema false-claim vocabulary must match');
for (const claim of Interop.FALSE_CLAIMS) {
  assert.strictEqual(receiptSchema.properties.claims.properties[claim].const, false, `${claim} must remain false in schema`);
}

console.log(JSON.stringify({
  suite: 'KONTUR Family Readiness Interop schema/runtime parity',
  false_claims_closed: Interop.FALSE_CLAIMS.length,
  predecessor_schema_refs_bound: 5,
  result: 'PASS'
}, null, 2));
