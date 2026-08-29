'use strict';

const fs = require('fs');
const path = require('path');

const IAL = require('../../../ial/v0.1/compact/ial-compact.js');
const Gateway = require('../../ai-gateway/v0.1/validate-gateway.js');
const ReceiptRuntime = require('../../../../tooling/receipt-runtime/v0.1/receipt-runtime.js');

const PROTOCOL = 'UU-AAP-AI-TRANSPORT-REFERENCE';
const VERSION = '0.1';
const PROFILE = 'local-evidence-packet-v0.1';
const RECEIPT_IDENTITY_PROFILE = ReceiptRuntime.PROFILE_ZERO_CONTENT_HASH;

const PACKET_KEYS = [
  'protocol',
  'version',
  'profile',
  'artifact_type',
  'packet_id',
  'frontier',
  'consumer',
  'ial',
  'gateway',
  'transport',
  'assertions',
  'non_effects',
  'content_hash'
];

const TRANSPORT_KEYS = [
  'delivery_mode',
  'provider_binding',
  'network_access_required',
  'filesystem_write_required',
  'delivery_requested',
  'external_effect_requested',
  'authority_created',
  'responsibility_accepted',
  'action_permit_created',
  'execution_admitted'
];

const REQUIRED_ASSERTIONS = [
  'IAL and Gateway evidence are preserved without reinterpretation',
  'Packet is bound to one exact repository frontier',
  'Transport delivery is unavailable in the reference CLI'
];

const REQUIRED_NON_EFFECTS = [
  'Transport Packet != Transport Delivery',
  'Transport Validation != Network Send',
  'Transport != Authority',
  'Transport != Responsibility Acceptance',
  'Transport != ActionPermit',
  'Transport != Execution Admission',
  'IAL Inspection != Gateway Decision',
  'Gateway Decision != Core Receipt',
  'Consumer Binding != Authority Transfer',
  'Exact Frontier Binding != Frontier Refresh',
  'Provider Neutrality != Provider Invocation'
];

const ALLOWED_OPERATIONS = new Set(['inspect', 'qualify']);
const ALLOWED_RESULTS = {
  inspect: new Set(['inspected', 'denied']),
  qualify: new Set(['qualified', 'denied'])
};

class AITransportReferenceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AITransportReferenceError';
  }
}

function fail(message) {
  throw new AITransportReferenceError(message);
}

function requireCondition(condition, message) {
  if (!condition) fail(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
  requireCondition(isObject(value), `${label} must be an object`);
}

function assertExactKeys(value, expectedKeys, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  requireCondition(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} keys mismatch: expected ${expected.join(', ')}, got ${actual.join(', ')}`
  );
}

function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}

function assertBoolean(value, label) {
  requireCondition(typeof value === 'boolean', `${label} must be boolean`);
}

function assertStringArray(value, label, { minItems = 0 } = {}) {
  requireCondition(Array.isArray(value), `${label} must be an array`);
  requireCondition(value.length >= minItems, `${label} requires at least ${minItems} item(s)`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${label}[${index}]`);
    requireCondition(!seen.has(item), `${label} must contain unique items`);
    seen.add(item);
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const canonicalize = ReceiptRuntime.canonicalize;

function computeContentHash(packet) {
  return ReceiptRuntime.computeContentHash(RECEIPT_IDENTITY_PROFILE, packet);
}

function rehash(packet) {
  return ReceiptRuntime.rehash(RECEIPT_IDENTITY_PROFILE, packet);
}

function deepEqualCanonical(left, right) {
  return ReceiptRuntime.deepEqualCanonical(left, right);
}

function validateTransportRef(ref, label, frontier) {
  assertObject(ref, label);
  assertExactKeys(ref, ['receipt_type', 'content_hash', 'frontier'], label);
  assertString(ref.receipt_type, `${label}.receipt_type`);
  assertString(ref.content_hash, `${label}.content_hash`, /^[a-f0-9]{64}$/);
  requireCondition(ref.frontier === frontier, `${label} frontier mismatch`);
}

function validateShape(packet) {
  assertExactKeys(packet, PACKET_KEYS, 'packet');
  requireCondition(packet.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(packet.version === VERSION, `version must be ${VERSION}`);
  requireCondition(packet.profile === PROFILE, `profile must be ${PROFILE}`);
  requireCondition(packet.artifact_type === 'AITransportReferencePacket', 'artifact_type mismatch');
  assertString(packet.packet_id, 'packet_id', /^urn:uu-aap:ai-transport-reference:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(packet.frontier, ['repository', 'revision', 'observed_at'], 'frontier');
  assertString(packet.frontier.repository, 'frontier.repository');
  assertString(packet.frontier.revision, 'frontier.revision', /^[0-9a-f]{40}$/);
  assertString(packet.frontier.observed_at, 'frontier.observed_at');

  assertExactKeys(
    packet.consumer,
    ['product_id', 'product_version', 'product_contract_hash'],
    'consumer'
  );
  assertString(packet.consumer.product_id, 'consumer.product_id', /^[a-z][a-z0-9-]{1,63}$/);
  assertString(packet.consumer.product_version, 'consumer.product_version');
  assertString(packet.consumer.product_contract_hash, 'consumer.product_contract_hash', /^sha256:[0-9a-f]{64}$/);

  assertExactKeys(packet.ial, ['envelope', 'inspection_receipt'], 'ial');
  assertObject(packet.ial.envelope, 'ial.envelope');
  assertObject(packet.ial.inspection_receipt, 'ial.inspection_receipt');

  assertExactKeys(packet.gateway, ['request', 'decision'], 'gateway');
  assertObject(packet.gateway.request, 'gateway.request');
  assertObject(packet.gateway.decision, 'gateway.decision');

  assertExactKeys(packet.transport, TRANSPORT_KEYS, 'transport');
  requireCondition(packet.transport.delivery_mode === 'local_return_only', 'transport delivery mode mismatch');
  requireCondition(packet.transport.provider_binding === 'none', 'provider binding must remain none');
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
    assertBoolean(packet.transport[key], `transport.${key}`);
    requireCondition(packet.transport[key] === false, `transport.${key} must remain false`);
  }

  assertStringArray(packet.assertions, 'assertions', { minItems: REQUIRED_ASSERTIONS.length });
  assertStringArray(packet.non_effects, 'non_effects', { minItems: REQUIRED_NON_EFFECTS.length });
  assertString(packet.content_hash, 'content_hash', /^sha256:[0-9a-f]{64}$/);
}

function validateSemantics(packet) {
  IAL.validateEnvelope(packet.ial.envelope);
  const expectedInspection = IAL.inspectEnvelope(packet.ial.envelope);
  requireCondition(
    deepEqualCanonical(packet.ial.inspection_receipt, expectedInspection),
    'IAL inspection receipt does not reproduce canonical inspection'
  );

  const envelope = packet.ial.envelope;
  requireCondition(packet.frontier.repository === envelope.frontier.repository, 'repository frontier mismatch');
  requireCondition(packet.frontier.revision === envelope.frontier.revision, 'revision frontier mismatch');
  requireCondition(packet.frontier.observed_at === envelope.frontier.observed_at, 'frontier timestamp mismatch');

  requireCondition(packet.consumer.product_id === envelope.consumer.product_id, 'consumer product id mismatch');
  requireCondition(packet.consumer.product_version === envelope.consumer.product_version, 'consumer version mismatch');
  requireCondition(
    packet.consumer.product_contract_hash === envelope.consumer.product_contract_hash,
    'consumer product contract hash mismatch'
  );

  const request = packet.gateway.request;
  const decision = packet.gateway.decision;
  Gateway.validateRequest(request);
  Gateway.validateDecision(decision, request);

  requireCondition(request.frontier === packet.frontier.revision, 'Gateway request frontier mismatch');
  requireCondition(decision.frontier === packet.frontier.revision, 'Gateway decision frontier mismatch');
  requireCondition(
    request.subject === `urn:uu-aap:product:${packet.consumer.product_id}:${envelope.envelope_id}`,
    'Gateway subject does not bind the IAL consumer and envelope'
  );
  requireCondition(ALLOWED_OPERATIONS.has(request.operation), 'reference transport permits inspect/qualify only');
  requireCondition(
    ALLOWED_RESULTS[request.operation].has(decision.result),
    'Gateway decision result is incompatible with reference transport operation'
  );

  requireCondition(request.action.external_effect === false, 'reference transport forbids external-effect Gateway action');
  requireCondition(request.action.read_only === true, 'reference transport requires read_only Gateway action');
  requireCondition(request.action.requires_approval === false, 'reference transport cannot request approval');
  requireCondition(request.approval_ref === null, 'reference transport cannot carry approval authority');
  requireCondition(Array.isArray(request.action.expected_effects), 'Gateway expected_effects must be an array');
  requireCondition(Array.isArray(request.action.explicit_non_effects), 'Gateway explicit_non_effects must be an array');
  requireCondition(Array.isArray(request.core_receipts), 'Gateway core_receipts must be an array');
  requireCondition(Array.isArray(request.intent_evidence_refs), 'Gateway intent_evidence_refs must be an array');
  requireCondition(Array.isArray(decision.evidence_refs), 'Gateway decision evidence_refs must be an array');

  for (let index = 0; index < request.core_receipts.length; index += 1) {
    const ref = request.core_receipts[index];
    validateTransportRef(ref, `gateway.request.core_receipts[${index}]`, packet.frontier.revision);
    requireCondition(ref.receipt_type !== 'ActionPermit', 'ActionPermit carriage is unavailable in the local reference profile');
  }
  for (let index = 0; index < request.intent_evidence_refs.length; index += 1) {
    validateTransportRef(
      request.intent_evidence_refs[index],
      `gateway.request.intent_evidence_refs[${index}]`,
      packet.frontier.revision
    );
  }
  for (let index = 0; index < decision.evidence_refs.length; index += 1) {
    validateTransportRef(
      decision.evidence_refs[index],
      `gateway.decision.evidence_refs[${index}]`,
      packet.frontier.revision
    );
    requireCondition(
      decision.evidence_refs[index].receipt_type !== 'ActionPermit',
      'ActionPermit carriage is unavailable in the local reference profile'
    );
  }

  const assertionSet = new Set(packet.assertions);
  for (const assertion of REQUIRED_ASSERTIONS) {
    requireCondition(assertionSet.has(assertion), `required assertion missing: ${assertion}`);
  }

  const nonEffectSet = new Set(packet.non_effects);
  for (const nonEffect of REQUIRED_NON_EFFECTS) {
    requireCondition(nonEffectSet.has(nonEffect), `required non-effect missing: ${nonEffect}`);
  }

  requireCondition(packet.content_hash === computeContentHash(packet), 'transport packet content hash mismatch');
  return packet;
}

function validatePacket(packet) {
  validateShape(packet);
  return validateSemantics(packet);
}

function createPacket({ packetId, ialEnvelope, gatewayRequest, gatewayDecision }) {
  IAL.validateEnvelope(ialEnvelope);
  Gateway.validateRequest(gatewayRequest);
  Gateway.validateDecision(gatewayDecision, gatewayRequest);

  const packet = {
    protocol: PROTOCOL,
    version: VERSION,
    profile: PROFILE,
    artifact_type: 'AITransportReferencePacket',
    packet_id: packetId,
    frontier: clone(ialEnvelope.frontier),
    consumer: {
      product_id: ialEnvelope.consumer.product_id,
      product_version: ialEnvelope.consumer.product_version,
      product_contract_hash: ialEnvelope.consumer.product_contract_hash
    },
    ial: {
      envelope: clone(ialEnvelope),
      inspection_receipt: IAL.inspectEnvelope(ialEnvelope)
    },
    gateway: {
      request: clone(gatewayRequest),
      decision: clone(gatewayDecision)
    },
    transport: {
      delivery_mode: 'local_return_only',
      provider_binding: 'none',
      network_access_required: false,
      filesystem_write_required: false,
      delivery_requested: false,
      external_effect_requested: false,
      authority_created: false,
      responsibility_accepted: false,
      action_permit_created: false,
      execution_admitted: false
    },
    assertions: [...REQUIRED_ASSERTIONS],
    non_effects: [...REQUIRED_NON_EFFECTS],
    content_hash: ''
  };

  rehash(packet);
  return validatePacket(packet);
}

function inspectPacket(packet) {
  validatePacket(packet);
  const envelope = packet.ial.envelope;
  const request = packet.gateway.request;
  const decision = packet.gateway.decision;
  const carriedCoreReceiptTypes = [...new Set(request.core_receipts.map(ref => ref.receipt_type))].sort();

  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'AITransportReferenceInspectionReceipt',
    profile: PROFILE,
    packet_id: packet.packet_id,
    packet_hash: packet.content_hash,
    frontier: clone(packet.frontier),
    consumer: clone(packet.consumer),
    ial: {
      envelope_id: envelope.envelope_id,
      envelope_hash: envelope.identity.content_hash,
      elevation_level: envelope.boundary.elevation_level,
      inspection_status: packet.ial.inspection_receipt.status
    },
    gateway: {
      request_id: request.request_id,
      request_hash: request.content_hash,
      operation: request.operation,
      result: decision.result
    },
    transport: {
      delivery_available: false,
      provider_bound: false,
      network_required: false,
      carried_core_receipt_types: carriedCoreReceiptTypes,
      action_permit_present: false
    },
    claims: {
      exact_frontier_bound: true,
      ial_revalidated: true,
      ial_inspection_reproduced: true,
      gateway_request_revalidated: true,
      gateway_decision_revalidated: true,
      transport_delivery_performed: false,
      authority_created: false,
      responsibility_accepted: false,
      action_permit_created: false,
      execution_admitted: false,
      external_effect_observed: false
    },
    non_effects: [...REQUIRED_NON_EFFECTS]
  };
}

function validationReceipt(packet) {
  validatePacket(packet);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'AITransportReferenceValidationReceipt',
    profile: PROFILE,
    packet_id: packet.packet_id,
    packet_hash: packet.content_hash,
    valid: true,
    network_access_required: false,
    delivery_performed: false,
    authority_created: false,
    responsibility_accepted: false,
    action_permit_created: false,
    execution_admitted: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new AITransportReferenceError(`invalid JSON: ${error.message}`);
  }
}

function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-'
    ? fs.readFileSync(0, 'utf8')
    : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function usage() {
  return [
    'UU-AAP AI Transport Reference CLI/SDK v0.1',
    '',
    'Usage:',
    '  node protocols/integration/ai-transport-reference/v0.1/reference-transport.js validate <file|->',
    '  node protocols/integration/ai-transport-reference/v0.1/reference-transport.js inspect <file|->',
    '  node protocols/integration/ai-transport-reference/v0.1/reference-transport.js help',
    '',
    'This reference surface performs no network delivery, provider invocation, actuator call or filesystem write.'
  ].join('\n');
}

function runCli(argv) {
  const command = argv[0] || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    return { stream: 'stdout', text: `${usage()}\n`, exitCode: 0 };
  }

  requireCondition(
    ['validate', 'inspect'].includes(command),
    `unsupported command: ${command}; allowed commands are validate, inspect and help`
  );
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or - for stdin`);

  const packet = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(packet) : inspectPacket(packet);
  return {
    stream: 'stdout',
    text: `${JSON.stringify(canonicalize(result), null, 2)}\n`,
    exitCode: 0
  };
}

function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: 'AI_TRANSPORT_REFERENCE_REJECTED', message })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  AITransportReferenceError,
  PROTOCOL,
  VERSION,
  PROFILE,
  RECEIPT_IDENTITY_PROFILE,
  PACKET_KEYS,
  TRANSPORT_KEYS,
  REQUIRED_ASSERTIONS,
  REQUIRED_NON_EFFECTS,
  canonicalize,
  computeContentHash,
  rehash,
  validateShape,
  validateSemantics,
  validatePacket,
  createPacket,
  inspectPacket,
  validationReceipt,
  parseText,
  readInput,
  usage,
  runCli
};
