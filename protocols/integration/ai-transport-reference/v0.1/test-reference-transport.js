'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const IAL = require('../../../ial/v0.1/compact/ial-compact.js');
const Gateway = require('../../ai-gateway/v0.1/validate-gateway.js');
const Transport = require('./reference-transport.js');

const ORIGIN_FRONTIER = '7b712abe8f70e51468a24eecc97d61c0927603f8';
const ORIGIN_OBSERVED_AT = '2026-08-28T13:35:17Z';

const DECISION_NON_EFFECTS = {
  intent_created: false,
  intent_inferred: false,
  authority_created: false,
  authority_expanded: false,
  responsibility_accepted: false,
  coordination_completed: false,
  action_permit_created: false,
  action_performed_by_gateway: false,
  frontier_refreshed: false,
  truth_certified: false,
  causality_proven: false,
  liability_established: false,
  universal_canonicality_established: false
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadEnvelope(name) {
  const envelopePath = path.join(
    __dirname,
    '../../../ial/v0.1/compact/examples',
    name
  );
  const envelope = JSON.parse(fs.readFileSync(envelopePath, 'utf8'));
  envelope.frontier.revision = ORIGIN_FRONTIER;
  envelope.frontier.observed_at = ORIGIN_OBSERVED_AT;
  IAL.rehash(envelope);
  IAL.validateEnvelope(envelope);
  return envelope;
}

function makeGatewayPair(envelope, operation, coreReceipts = []) {
  const result = operation === 'inspect' ? 'inspected' : 'qualified';
  const expectedEffect = operation === 'inspect'
    ? 'local_analysis_candidate'
    : 'human_review_candidate';

  const request = {
    protocol: 'UU-AAP-AI-GATEWAY',
    version: '0.1',
    artifact_type: 'GatewayRequest',
    request_id: `urn:uu-aap:gateway-request:transport-${envelope.consumer.product_id}-001`,
    operation,
    subject: `urn:uu-aap:product:${envelope.consumer.product_id}:${envelope.envelope_id}`,
    frontier: ORIGIN_FRONTIER,
    action: {
      action_id: `urn:uu-aap:action:transport-${envelope.consumer.product_id}-${operation}`,
      read_only: true,
      external_effect: false,
      reversible: true,
      requires_approval: false,
      authority_scope: 'local-reference-read-only',
      expected_effects: [expectedEffect],
      explicit_non_effects: [
        'external_mutation',
        'authority_transfer',
        'action_execution',
        'provider_invocation'
      ]
    },
    core_receipts: clone(coreReceipts),
    intent_evidence_refs: [],
    approval_ref: null,
    protocol_mode_consent: {
      enabled: true,
      blanket_action_approval: false
    },
    issued_at: ORIGIN_OBSERVED_AT,
    content_hash: ''
  };
  request.content_hash = Gateway.hash(request);

  const decision = {
    protocol: 'UU-AAP-AI-GATEWAY',
    version: '0.1',
    receipt_type: 'GatewayDecisionReceipt',
    request_hash: request.content_hash,
    request_id: request.request_id,
    operation: request.operation,
    subject: request.subject,
    frontier: request.frontier,
    result,
    evidence_refs: clone(coreReceipts),
    assertions: {
      exact_frontier_bound: true,
      core_action_gate_preserved: true,
      intent_evidence_not_substituted: true,
      protocol_mode_consent_not_blanket_approval: true
    },
    non_effects: clone(DECISION_NON_EFFECTS),
    issued_at: ORIGIN_OBSERVED_AT,
    content_hash: ''
  };
  decision.content_hash = Gateway.hash(decision);

  Gateway.validateRequest(request);
  Gateway.validateDecision(decision, request);
  return { request, decision };
}

function makePacket(envelope, operation, coreReceipts = []) {
  const { request, decision } = makeGatewayPair(envelope, operation, coreReceipts);
  return Transport.createPacket({
    packetId: `urn:uu-aap:ai-transport-reference:${envelope.consumer.product_id}:001`,
    ialEnvelope: envelope,
    gatewayRequest: request,
    gatewayDecision: decision
  });
}

function repacket(packet, mutation) {
  const copy = clone(packet);
  mutation(copy);
  Transport.rehash(copy);
  return copy;
}

function rehashGatewayPair(packet) {
  packet.gateway.request.content_hash = Gateway.hash(packet.gateway.request);
  packet.gateway.decision.request_hash = packet.gateway.request.content_hash;
  packet.gateway.decision.content_hash = Gateway.hash(packet.gateway.decision);
  Transport.rehash(packet);
  return packet;
}

function reject(name, operation, pattern = null) {
  let rejected = false;
  try {
    operation();
  } catch (error) {
    rejected = true;
    if (pattern) assert.match(error.message, pattern, `${name}: unexpected rejection`);
  }
  assert.strictEqual(rejected, true, `${name}: negative vector was accepted`);
}

const marketer = loadEnvelope('marketer-pessimist-e0.envelope.json');
const hiring = loadEnvelope('honest-hiring-e1.envelope.json');

const marketerPacket = makePacket(marketer, 'inspect');
const hiringPacket = makePacket(hiring, 'qualify');

Transport.validatePacket(marketerPacket);
Transport.validatePacket(hiringPacket);

const marketerInspection = Transport.inspectPacket(marketerPacket);
assert.strictEqual(marketerInspection.consumer.product_id, 'marketer-pessimist');
assert.strictEqual(marketerInspection.ial.elevation_level, 'E0');
assert.strictEqual(marketerInspection.gateway.operation, 'inspect');
assert.strictEqual(marketerInspection.gateway.result, 'inspected');
assert.deepStrictEqual(marketerInspection.transport.carried_core_receipt_types, []);
assert.strictEqual(marketerInspection.transport.action_permit_present, false);

const hiringInspection = Transport.inspectPacket(hiringPacket);
assert.strictEqual(hiringInspection.consumer.product_id, 'honest-hiring');
assert.strictEqual(hiringInspection.ial.elevation_level, 'E1');
assert.strictEqual(hiringInspection.gateway.operation, 'qualify');
assert.strictEqual(hiringInspection.gateway.result, 'qualified');
assert.strictEqual(hiringInspection.claims.execution_admitted, false);

const stateReceipt = {
  receipt_type: 'StateReceipt',
  content_hash: '1'.repeat(64),
  frontier: ORIGIN_FRONTIER
};
const coreCarryingPacket = makePacket(marketer, 'inspect', [stateReceipt]);
const coreInspection = Transport.inspectPacket(coreCarryingPacket);
assert.deepStrictEqual(coreInspection.transport.carried_core_receipt_types, ['StateReceipt']);
assert.strictEqual(coreInspection.transport.action_permit_present, false);
assert.strictEqual(coreInspection.claims.authority_created, false);
assert.strictEqual(coreInspection.claims.action_permit_created, false);

reject(
  'cross-product consumer substitution',
  () => Transport.validatePacket(repacket(marketerPacket, packet => {
    packet.consumer.product_id = 'honest-hiring';
  })),
  /consumer product id mismatch/
);

reject(
  'stale transport frontier',
  () => Transport.validatePacket(repacket(marketerPacket, packet => {
    packet.frontier.revision = 'f'.repeat(40);
  })),
  /revision frontier mismatch/
);

reject(
  'altered IAL inspection',
  () => Transport.validatePacket(repacket(marketerPacket, packet => {
    packet.ial.inspection_receipt.status = 'ELEVATED';
  })),
  /does not reproduce canonical inspection/
);

reject(
  'altered Gateway request',
  () => Transport.validatePacket(repacket(marketerPacket, packet => {
    packet.gateway.request.subject = 'urn:uu-aap:product:other:forged';
  })),
  /request hash/
);

reject(
  'Gateway decision authority overclaim',
  () => Transport.validatePacket(repacket(marketerPacket, packet => {
    packet.gateway.decision.non_effects.authority_created = true;
    packet.gateway.decision.content_hash = Gateway.hash(packet.gateway.decision);
  })),
  /decision non_effect authority_created/
);

reject(
  'external-effect carriage',
  () => Transport.validatePacket((() => {
    const packet = clone(marketerPacket);
    packet.gateway.request.action.read_only = false;
    packet.gateway.request.action.external_effect = true;
    return rehashGatewayPair(packet);
  })()),
  /forbids external-effect Gateway action/
);

reject(
  'provider binding',
  () => Transport.validatePacket(repacket(marketerPacket, packet => {
    packet.transport.provider_binding = 'openai';
  })),
  /provider binding must remain none/
);

reject(
  'delivery request',
  () => Transport.validatePacket(repacket(marketerPacket, packet => {
    packet.transport.delivery_requested = true;
  })),
  /delivery_requested must remain false/
);

reject(
  'stale carried Core evidence',
  () => Transport.validatePacket((() => {
    const packet = clone(coreCarryingPacket);
    packet.gateway.request.core_receipts[0].frontier = 'e'.repeat(40);
    packet.gateway.decision.evidence_refs[0].frontier = 'e'.repeat(40);
    return rehashGatewayPair(packet);
  })()),
  /core_receipts\[0\] frontier mismatch/
);

reject(
  'ActionPermit carriage',
  () => Transport.validatePacket((() => {
    const packet = clone(marketerPacket);
    const actionPermit = {
      receipt_type: 'ActionPermit',
      content_hash: '2'.repeat(64),
      frontier: ORIGIN_FRONTIER
    };
    packet.gateway.request.core_receipts.push(actionPermit);
    packet.gateway.decision.evidence_refs.push(clone(actionPermit));
    return rehashGatewayPair(packet);
  })()),
  /ActionPermit carriage is unavailable/
);

reject(
  'authorize operation',
  () => Transport.validatePacket((() => {
    const packet = clone(marketerPacket);
    packet.gateway.request.operation = 'authorize';
    packet.gateway.decision.operation = 'authorize';
    packet.gateway.decision.result = 'qualified';
    return rehashGatewayPair(packet);
  })()),
  /permits inspect\/qualify only/
);

reject(
  'forbidden send command',
  () => Transport.runCli(['send', '-']),
  /unsupported command/
);

const validation = Transport.validationReceipt(marketerPacket);
assert.strictEqual(validation.valid, true);
assert.strictEqual(validation.delivery_performed, false);
assert.strictEqual(validation.execution_admitted, false);

console.log('UU_AAP_AI_TRANSPORT_REFERENCE_V0_1_PASS');
