'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const Transport = require('./reference-transport.js');

const packetSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'transport-packet.schema.json'), 'utf8')
);
const inspectionSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'inspection-receipt.schema.json'), 'utf8')
);

assert.strictEqual(packetSchema.additionalProperties, false);
assert.deepStrictEqual(
  [...packetSchema.required].sort(),
  [...Transport.PACKET_KEYS].sort(),
  'packet schema/runtime top-level keys must match'
);
assert.strictEqual(packetSchema.properties.protocol.const, Transport.PROTOCOL);
assert.strictEqual(packetSchema.properties.version.const, Transport.VERSION);
assert.strictEqual(packetSchema.properties.profile.const, Transport.PROFILE);

assert.deepStrictEqual(
  [...packetSchema.properties.transport.required].sort(),
  [...Transport.TRANSPORT_KEYS].sort(),
  'transport control keys must match'
);

for (const key of [
  'network_access_required',
  'filesystem_write_required',
  'delivery_requested',
  'external_effect_requested',
  'authority_created',
  'responsibility_accepted',
  'action_permit_created',
  'execution_admitted'
]) {
  assert.strictEqual(packetSchema.properties.transport.properties[key].const, false, `${key} must be false in schema`);
}

assert.strictEqual(
  packetSchema.properties.ial.properties.envelope.$ref,
  '../../../ial/v0.1/compact/compact-envelope.schema.json'
);
assert.strictEqual(
  packetSchema.properties.ial.properties.inspection_receipt.$ref,
  '../../../ial/v0.1/compact/inspection-receipt.schema.json'
);
assert.strictEqual(
  packetSchema.properties.gateway.properties.request.$ref,
  '../../ai-gateway/v0.1/gateway-request.schema.json'
);
assert.strictEqual(
  packetSchema.properties.gateway.properties.decision.$ref,
  '../../ai-gateway/v0.1/gateway-decision-receipt.schema.json'
);

const assertionContains = new Set(
  packetSchema.properties.assertions.allOf.map(rule => rule.contains.const)
);
for (const assertion of Transport.REQUIRED_ASSERTIONS) {
  assert.strictEqual(assertionContains.has(assertion), true, `schema missing assertion: ${assertion}`);
}

const nonEffectContains = new Set(
  packetSchema.properties.non_effects.allOf.map(rule => rule.contains.const)
);
for (const nonEffect of Transport.REQUIRED_NON_EFFECTS) {
  assert.strictEqual(nonEffectContains.has(nonEffect), true, `schema missing non-effect: ${nonEffect}`);
}

assert.strictEqual(inspectionSchema.additionalProperties, false);
assert.strictEqual(
  inspectionSchema.properties.receipt_type.const,
  'AITransportReferenceInspectionReceipt'
);
assert.strictEqual(inspectionSchema.properties.transport.properties.delivery_available.const, false);
assert.strictEqual(inspectionSchema.properties.transport.properties.provider_bound.const, false);
assert.strictEqual(inspectionSchema.properties.transport.properties.network_required.const, false);
assert.strictEqual(inspectionSchema.properties.transport.properties.action_permit_present.const, false);
assert.strictEqual(inspectionSchema.properties.claims.properties.transport_delivery_performed.const, false);
assert.strictEqual(inspectionSchema.properties.claims.properties.authority_created.const, false);
assert.strictEqual(inspectionSchema.properties.claims.properties.responsibility_accepted.const, false);
assert.strictEqual(inspectionSchema.properties.claims.properties.action_permit_created.const, false);
assert.strictEqual(inspectionSchema.properties.claims.properties.execution_admitted.const, false);

console.log('UU_AAP_AI_TRANSPORT_REFERENCE_SCHEMA_RUNTIME_PARITY_V0_1_PASS');
