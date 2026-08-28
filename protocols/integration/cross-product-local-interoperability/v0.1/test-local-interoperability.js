'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const IAL = require('../../../ial/v0.1/compact/ial-compact.js');
const Gateway = require('../../ai-gateway/v0.1/validate-gateway.js');
const Transport = require('../../ai-transport-reference/v0.1/reference-transport.js');
const Interop = require('./local-interoperability.js');

const ORIGIN_FRONTIER = 'c3056d552bfa8f07a01e571a6d17c7ed04f1f3d1';
const ORIGIN_OBSERVED_AT = '2026-08-28T14:22:40Z';
const repoRoot = path.resolve(__dirname, '../../../..');
const outputDir = process.argv[2] || '/tmp/cross-product-local-interop';

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
  const file = path.join(repoRoot, 'protocols/ial/v0.1/compact/examples', name);
  const envelope = JSON.parse(fs.readFileSync(file, 'utf8'));
  envelope.frontier.revision = ORIGIN_FRONTIER;
  envelope.frontier.observed_at = ORIGIN_OBSERVED_AT;
  IAL.rehash(envelope);
  IAL.validateEnvelope(envelope);
  return envelope;
}

function makeGatewayPair(envelope, operation) {
  const result = operation === 'inspect' ? 'inspected' : 'qualified';
  const expectedEffect = operation === 'inspect' ? 'local_analysis_candidate' : 'human_review_candidate';
  const request = {
    protocol: 'UU-AAP-AI-GATEWAY',
    version: '0.1',
    artifact_type: 'GatewayRequest',
    request_id: `urn:uu-aap:gateway-request:cross-product-${envelope.consumer.product_id}-001`,
    operation,
    subject: `urn:uu-aap:product:${envelope.consumer.product_id}:${envelope.envelope_id}`,
    frontier: ORIGIN_FRONTIER,
    action: {
      action_id: `urn:uu-aap:action:cross-product-${envelope.consumer.product_id}-${operation}`,
      read_only: true,
      external_effect: false,
      reversible: true,
      requires_approval: false,
      authority_scope: 'local-cross-product-read-only',
      expected_effects: [expectedEffect],
      explicit_non_effects: ['external_mutation', 'authority_transfer', 'action_execution', 'provider_invocation']
    },
    core_receipts: [],
    intent_evidence_refs: [],
    approval_ref: null,
    protocol_mode_consent: { enabled: true, blanket_action_approval: false },
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
    evidence_refs: [],
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

function makePacket(envelope, operation) {
  const pair = makeGatewayPair(envelope, operation);
  return Transport.createPacket({
    packetId: `urn:uu-aap:ai-transport-reference:cross-product:${envelope.consumer.product_id}:001`,
    ialEnvelope: envelope,
    gatewayRequest: pair.request,
    gatewayDecision: pair.decision
  });
}

function rehashGatewayPair(packet) {
  packet.gateway.request.content_hash = Gateway.hash(packet.gateway.request);
  packet.gateway.decision.request_hash = packet.gateway.request.content_hash;
  packet.gateway.decision.content_hash = Gateway.hash(packet.gateway.decision);
  Transport.rehash(packet);
  return packet;
}

function rebuildIAL(packet) {
  IAL.rehash(packet.ial.envelope);
  packet.ial.inspection_receipt = IAL.inspectEnvelope(packet.ial.envelope);
  Transport.rehash(packet);
  return packet;
}

function rebindPacketFrontier(packet, revision, observedAt) {
  packet.frontier.revision = revision;
  packet.frontier.observed_at = observedAt;
  packet.ial.envelope.frontier.revision = revision;
  packet.ial.envelope.frontier.observed_at = observedAt;
  IAL.rehash(packet.ial.envelope);
  packet.ial.inspection_receipt = IAL.inspectEnvelope(packet.ial.envelope);
  packet.gateway.request.frontier = revision;
  packet.gateway.request.issued_at = observedAt;
  packet.gateway.decision.frontier = revision;
  packet.gateway.decision.issued_at = observedAt;
  return rehashGatewayPair(packet);
}

function buildScenario() {
  const marketer = loadEnvelope('marketer-pessimist-e0.envelope.json');
  const hiring = loadEnvelope('honest-hiring-e1.envelope.json');
  const input = {
    protocol: Interop.PROTOCOL,
    version: Interop.VERSION,
    artifact_type: Interop.SCENARIO_TYPE,
    scenario_id: 'urn:uu-aap:cross-product-local-interop:phase-c-two-product-001',
    evaluation_frontier: {
      repository: 'Matawaka/uu-aap',
      revision: ORIGIN_FRONTIER,
      observed_at: ORIGIN_OBSERVED_AT
    },
    lanes: [
      {
        lane_id: 'marketer-pessimist-e0',
        product_id: 'marketer-pessimist',
        expected_role: 'local_claim_inspection',
        transport_packet: makePacket(marketer, 'inspect')
      },
      {
        lane_id: 'honest-hiring-e1',
        product_id: 'honest-hiring',
        expected_role: 'fictional_human_review_candidate',
        transport_packet: makePacket(hiring, 'qualify')
      }
    ],
    controls: {
      local_only: true,
      read_only: true,
      network_access_required: false,
      filesystem_write_required: false,
      transport_delivery_available: false,
      provider_invocation_available: false,
      cross_product_data_sharing: false,
      cross_product_state_sharing: false,
      authority_transfer_available: false,
      responsibility_transfer_available: false,
      action_permit_available: false,
      execution_available: false,
      external_effect_available: false,
      automatic_retry: false
    },
    assertions: [...Interop.REQUIRED_ASSERTIONS],
    non_effects: [...Interop.REQUIRED_NON_EFFECTS],
    content_hash: ''
  };
  return Interop.rehash(input);
}

function mutateScenario(input, mutation) {
  const changed = clone(input);
  mutation(changed);
  return Interop.rehash(changed);
}

async function reject(name, operation, pattern = null) {
  let error = null;
  try {
    await operation();
  } catch (value) {
    error = value;
  }
  assert(error, `${name}: expected rejection`);
  if (pattern) assert.match(error.message, pattern, `${name}: unexpected error`);
  return name;
}

async function main() {
  const input = buildScenario();
  const receipt = Interop.buildReceipt(input);
  const receipt2 = Interop.buildReceipt(clone(input));
  assert.deepStrictEqual(receipt2, receipt, 'exact scenario must produce deterministic receipt');
  assert.strictEqual(Interop.validateReceipt(receipt), receipt);
  assert.strictEqual(receipt.status, Interop.STATUS);
  assert.strictEqual(receipt.next_safe_action, Interop.NEXT_SAFE_ACTION);
  assert.strictEqual(receipt.lanes.length, 2);
  assert.strictEqual(receipt.shared_infrastructure.exact_frontier_shared, true);
  assert.strictEqual(receipt.isolation.shared_product_evidence_ref_count, 0);
  for (const key of Interop.TRUE_CLAIMS) assert.strictEqual(receipt.claims[key], true, `${key} must be true`);
  for (const key of Interop.FALSE_CLAIMS) assert.strictEqual(receipt.claims[key], false, `${key} must be false`);

  const validation = Interop.validationReceipt(input);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.product_isolation_preserved, true);
  assert.strictEqual(validation.cross_product_data_shared, false);
  assert.strictEqual(validation.authority_transferred_between_products, false);
  assert.strictEqual(validation.execution_admitted, false);

  fs.mkdirSync(outputDir, { recursive: true });
  const inputPath = path.join(outputDir, 'scenario.json');
  fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);
  const cliValidation = Interop.runCli(['validate', inputPath]);
  assert.strictEqual(cliValidation.exitCode, 0);
  assert.match(cliValidation.text, /CrossProductLocalInteropValidationReceipt/);
  const cliInspection = Interop.runCli(['inspect', inputPath]);
  assert.strictEqual(cliInspection.exitCode, 0);
  assert.match(cliInspection.text, /LOCAL_CROSS_PRODUCT_INTEROPERABILITY_OBSERVED/);

  const rejected = [];

  rejected.push(await reject('scenario_unknown_key', async () => {
    const changed = clone(input);
    changed.unexpected = true;
    Interop.validateScenario(changed);
  }, /scenario keys mismatch/));

  rejected.push(await reject('duplicate_product_lane', async () => {
    const changed = mutateScenario(input, scenario => {
      scenario.lanes[1].product_id = 'marketer-pessimist';
    });
    Interop.validateScenario(changed);
  }, /two-product consumer set/));

  rejected.push(await reject('wrong_product_contract_hash', async () => {
    const changed = mutateScenario(input, scenario => {
      const packet = scenario.lanes[1].transport_packet;
      packet.consumer.product_contract_hash = `sha256:${'0'.repeat(64)}`;
      Transport.rehash(packet);
    });
    Interop.validateScenario(changed);
  }, /consumer product contract hash mismatch|product contract hash mismatch/));

  rejected.push(await reject('e0_e1_lane_packet_substitution', async () => {
    const changed = mutateScenario(input, scenario => {
      scenario.lanes[0].transport_packet = clone(scenario.lanes[1].transport_packet);
    });
    Interop.validateScenario(changed);
  }, /packet product mismatch/));

  rejected.push(await reject('gateway_operation_semantic_substitution', async () => {
    const changed = mutateScenario(input, scenario => {
      const packet = scenario.lanes[1].transport_packet;
      packet.gateway.request.operation = 'inspect';
      packet.gateway.decision.operation = 'inspect';
      packet.gateway.decision.result = 'inspected';
      rehashGatewayPair(packet);
    });
    Interop.validateScenario(changed);
  }, /Gateway operation mismatch/));

  rejected.push(await reject('mixed_exact_frontier', async () => {
    const changed = mutateScenario(input, scenario => {
      rebindPacketFrontier(scenario.lanes[1].transport_packet, 'f'.repeat(40), ORIGIN_OBSERVED_AT);
    });
    Interop.validateScenario(changed);
  }, /lane revision frontier mismatch/));

  rejected.push(await reject('provider_binding', async () => {
    const changed = mutateScenario(input, scenario => {
      const packet = scenario.lanes[0].transport_packet;
      packet.transport.provider_binding = 'provider-x';
      Transport.rehash(packet);
    });
    Interop.validateScenario(changed);
  }, /provider binding must remain none/));

  rejected.push(await reject('delivery_request', async () => {
    const changed = mutateScenario(input, scenario => {
      const packet = scenario.lanes[0].transport_packet;
      packet.transport.delivery_requested = true;
      Transport.rehash(packet);
    });
    Interop.validateScenario(changed);
  }, /delivery_requested must remain false/));

  for (const key of [
    'cross_product_data_sharing', 'cross_product_state_sharing', 'authority_transfer_available',
    'responsibility_transfer_available', 'action_permit_available', 'execution_available',
    'external_effect_available'
  ]) {
    rejected.push(await reject(`control_${key}`, async () => {
      const changed = mutateScenario(input, scenario => { scenario.controls[key] = true; });
      Interop.validateScenario(changed);
    }, new RegExp(`controls\\.${key} must remain false`)));
  }

  rejected.push(await reject('duplicate_transport_packet_identity', async () => {
    const changed = mutateScenario(input, scenario => {
      scenario.lanes[1].transport_packet.packet_id = scenario.lanes[0].transport_packet.packet_id;
      Transport.rehash(scenario.lanes[1].transport_packet);
    });
    Interop.validateScenario(changed);
  }, /transport packet identity must remain distinct/));

  rejected.push(await reject('duplicate_gateway_request_identity', async () => {
    const changed = mutateScenario(input, scenario => {
      const first = scenario.lanes[0].transport_packet.gateway.request.request_id;
      const packet = scenario.lanes[1].transport_packet;
      packet.gateway.request.request_id = first;
      packet.gateway.decision.request_id = first;
      rehashGatewayPair(packet);
    });
    Interop.validateScenario(changed);
  }, /Gateway request identity must remain distinct/));

  rejected.push(await reject('shared_product_evidence', async () => {
    const changed = mutateScenario(input, scenario => {
      const firstRef = clone(scenario.lanes[0].transport_packet.ial.envelope.evidence.refs[1]);
      const packet = scenario.lanes[1].transport_packet;
      packet.ial.envelope.evidence.refs.push(firstRef);
      rebuildIAL(packet);
    });
    Interop.validateScenario(changed);
  }, /product-specific evidence must not be shared/));

  for (const claim of Interop.FALSE_CLAIMS) {
    rejected.push(await reject(`receipt_overclaim_${claim}`, async () => {
      const changed = clone(receipt);
      changed.claims[claim] = true;
      Interop.rehash(changed);
      Interop.validateReceipt(changed);
    }, new RegExp(`prohibited claim ${claim} must remain false`)));
  }

  rejected.push(await reject('receipt_unknown_claim', async () => {
    const changed = clone(receipt);
    changed.claims.future_authority = false;
    Interop.rehash(changed);
    Interop.validateReceipt(changed);
  }, /receipt\.claims keys mismatch/));

  for (const command of ['send', 'execute', 'share', 'merge', 'activate', 'publish']) {
    rejected.push(await reject(`forbidden_cli_${command}`, async () => {
      Interop.runCli([command, '-']);
    }, /unsupported command/));
  }

  console.log(JSON.stringify({
    suite: 'Cross-Product Local Interoperability v0.1',
    origin_frontier: ORIGIN_FRONTIER,
    products: receipt.lanes.map(lane => lane.product_id),
    shared_transport_profile: receipt.shared_infrastructure.transport_profile,
    local_cross_product_interoperability_observed: true,
    product_isolation_preserved: true,
    fail_closed_vectors_rejected: rejected.length,
    authority_transferred_between_products: false,
    responsibility_transferred_between_products: false,
    execution_admitted: false,
    external_effect_performed: false,
    result: 'PASS'
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
