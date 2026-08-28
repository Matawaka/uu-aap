'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Transport = require('../../ai-transport-reference/v0.1/reference-transport.js');

const PROTOCOL = 'UU-AAP-CROSS-PRODUCT-LOCAL-INTEROP';
const VERSION = '0.1';
const SCENARIO_TYPE = 'CrossProductLocalInteropScenario';
const RECEIPT_TYPE = 'CrossProductLocalInteropReceipt';
const STATUS = 'LOCAL_CROSS_PRODUCT_INTEROPERABILITY_OBSERVED';
const NEXT_SAFE_ACTION = 'READ_ONLY_INTEROPERABILITY_REVIEW_ONLY';

const SCENARIO_KEYS = [
  'protocol', 'version', 'artifact_type', 'scenario_id', 'evaluation_frontier',
  'lanes', 'controls', 'assertions', 'non_effects', 'content_hash'
];
const LANE_KEYS = ['lane_id', 'product_id', 'expected_role', 'transport_packet'];
const FRONTIER_KEYS = ['repository', 'revision', 'observed_at'];
const CONTROL_KEYS = [
  'local_only', 'read_only', 'network_access_required', 'filesystem_write_required',
  'transport_delivery_available', 'provider_invocation_available',
  'cross_product_data_sharing', 'cross_product_state_sharing',
  'authority_transfer_available', 'responsibility_transfer_available',
  'action_permit_available', 'execution_available', 'external_effect_available',
  'automatic_retry'
];
const RECEIPT_KEYS = [
  'protocol', 'version', 'receipt_type', 'scenario_id', 'scenario_hash', 'status',
  'evaluation_frontier', 'lanes', 'shared_infrastructure', 'isolation', 'claims',
  'non_effects', 'next_safe_action', 'content_hash'
];
const RECEIPT_LANE_KEYS = [
  'lane_id', 'product_id', 'product_version', 'product_contract_hash',
  'transport_packet_id', 'transport_packet_hash', 'ial_envelope_id',
  'ial_elevation_level', 'gateway_request_id', 'gateway_operation', 'gateway_result'
];
const SHARED_INFRASTRUCTURE_KEYS = [
  'ial_protocol', 'ial_version', 'ial_profile', 'transport_protocol',
  'transport_version', 'transport_profile', 'exact_frontier_shared',
  'local_only', 'read_only'
];
const ISOLATION_KEYS = [
  'distinct_product_ids', 'distinct_packet_ids', 'distinct_envelope_ids',
  'distinct_gateway_request_ids', 'shared_product_evidence_ref_count'
];

const EXPECTED_PRODUCTS = Object.freeze({
  'marketer-pessimist': Object.freeze({
    lane_id: 'marketer-pessimist-e0',
    product_version: '0.1',
    product_contract_hash: 'sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6',
    expected_role: 'local_claim_inspection',
    elevation_level: 'E0',
    operation_class: 'local_analysis',
    gateway_operation: 'inspect',
    gateway_result: 'inspected'
  }),
  'honest-hiring': Object.freeze({
    lane_id: 'honest-hiring-e1',
    product_version: '0.1',
    product_contract_hash: 'sha256:796580b9a4dc3eb9f7b7bd9215ed1b9379182786caeafbdb15fada4353f1d2ae',
    expected_role: 'fictional_human_review_candidate',
    elevation_level: 'E1',
    operation_class: 'display_candidate',
    gateway_operation: 'qualify',
    gateway_result: 'qualified'
  })
});

const REQUIRED_ASSERTIONS = Object.freeze([
  'Both product lanes reuse the same IAL and AI Transport infrastructure',
  'Each product lane preserves its own product identity and semantics',
  'Cross-product composition is local read-only evidence inspection only'
]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Shared Infrastructure != Shared Product Semantics',
  'Cross-Product Interoperability != Cross-Product Data Sharing',
  'Cross-Product Interoperability != Cross-Product State Sharing',
  'Cross-Product Composition != Authority Transfer',
  'Cross-Product Composition != Responsibility Transfer',
  'Transport Reuse != Provider Invocation',
  'Transport Inspection != Network Delivery',
  'Interoperability Receipt != ActionPermit',
  'Interoperability Receipt != Execution Admission',
  'Local Scenario != External Effect',
  'Product Compatibility != Stable-Core Promotion',
  'Bounded Interoperability != Universal Interoperability'
]);

const TRUE_CLAIMS = Object.freeze([
  'local_cross_product_interoperability_observed',
  'shared_infrastructure_reused',
  'exact_frontier_shared',
  'product_identity_isolation_preserved',
  'product_semantics_remain_distinct'
]);

const FALSE_CLAIMS = Object.freeze([
  'product_semantics_merged',
  'cross_product_data_shared',
  'cross_product_state_shared',
  'authority_transferred_between_products',
  'responsibility_transferred_between_products',
  'authority_created',
  'responsibility_accepted',
  'action_permit_created',
  'execution_admitted',
  'transport_delivery_performed',
  'provider_invoked',
  'external_effect_performed',
  'successor_authority_created',
  'stable_core_promotion_established',
  'universal_interoperability_established'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

class CrossProductLocalInteropError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CrossProductLocalInteropError';
  }
}

function fail(message) {
  throw new CrossProductLocalInteropError(message);
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}

function computeContentHash(value) {
  const projected = clone(value);
  projected.content_hash = '';
  const canonical = JSON.stringify(canonicalize(projected));
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function rehash(value) {
  value.content_hash = computeContentHash(value);
  return value;
}

function sameSet(left, right) {
  return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]);
}

function assertExactStringSet(value, expected, label) {
  requireCondition(Array.isArray(value), `${label} must be an array`);
  requireCondition(value.every(item => typeof item === 'string' && item.length > 0), `${label} must contain strings`);
  requireCondition(new Set(value).size === value.length, `${label} must contain unique items`);
  requireCondition(sameSet(value, expected), `${label} set mismatch`);
}

function evidenceDigests(packet) {
  const refs = packet.ial && packet.ial.envelope && packet.ial.envelope.evidence && packet.ial.envelope.evidence.refs;
  requireCondition(Array.isArray(refs), 'IAL product evidence refs must be an array');
  return refs.map(ref => ref.digest);
}

function validateControls(controls) {
  assertExactKeys(controls, CONTROL_KEYS, 'controls');
  for (const key of CONTROL_KEYS) assertBoolean(controls[key], `controls.${key}`);
  requireCondition(controls.local_only === true, 'controls.local_only must remain true');
  requireCondition(controls.read_only === true, 'controls.read_only must remain true');
  for (const key of CONTROL_KEYS.filter(key => !['local_only', 'read_only'].includes(key))) {
    requireCondition(controls[key] === false, `controls.${key} must remain false`);
  }
}

function validateScenario(input) {
  assertExactKeys(input, SCENARIO_KEYS, 'scenario');
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === SCENARIO_TYPE, `artifact_type must be ${SCENARIO_TYPE}`);
  assertString(input.scenario_id, 'scenario_id', /^urn:uu-aap:cross-product-local-interop:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'evaluation frontier repository mismatch');
  assertString(input.evaluation_frontier.revision, 'evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  assertString(input.evaluation_frontier.observed_at, 'evaluation_frontier.observed_at');

  requireCondition(Array.isArray(input.lanes) && input.lanes.length === 2, 'exactly two product lanes required');
  const expectedIds = Object.keys(EXPECTED_PRODUCTS).sort();
  const productIds = input.lanes.map(lane => lane.product_id).sort();
  requireCondition(JSON.stringify(productIds) === JSON.stringify(expectedIds), 'exact two-product consumer set required');

  const inspections = [];
  const packetIds = [];
  const envelopeIds = [];
  const requestIds = [];
  const laneEvidence = [];

  for (const lane of input.lanes) {
    assertExactKeys(lane, LANE_KEYS, 'lane');
    const expected = EXPECTED_PRODUCTS[lane.product_id];
    requireCondition(expected, `unsupported product lane: ${lane.product_id}`);
    requireCondition(lane.lane_id === expected.lane_id, `lane id mismatch for ${lane.product_id}`);
    requireCondition(lane.expected_role === expected.expected_role, `lane role mismatch for ${lane.product_id}`);

    const packet = lane.transport_packet;
    Transport.validatePacket(packet);
    const inspection = Transport.inspectPacket(packet);

    requireCondition(packet.frontier.repository === input.evaluation_frontier.repository, `lane repository frontier mismatch: ${lane.product_id}`);
    requireCondition(packet.frontier.revision === input.evaluation_frontier.revision, `lane revision frontier mismatch: ${lane.product_id}`);
    requireCondition(packet.frontier.observed_at === input.evaluation_frontier.observed_at, `lane observed_at frontier mismatch: ${lane.product_id}`);

    requireCondition(packet.consumer.product_id === lane.product_id, `packet product mismatch: ${lane.product_id}`);
    requireCondition(packet.consumer.product_version === expected.product_version, `product version mismatch: ${lane.product_id}`);
    requireCondition(packet.consumer.product_contract_hash === expected.product_contract_hash, `product contract hash mismatch: ${lane.product_id}`);
    requireCondition(inspection.consumer.product_id === lane.product_id, `inspection product mismatch: ${lane.product_id}`);
    requireCondition(inspection.ial.elevation_level === expected.elevation_level, `IAL elevation mismatch: ${lane.product_id}`);
    requireCondition(packet.ial.envelope.requested_operation.operation_class === expected.operation_class, `IAL operation class mismatch: ${lane.product_id}`);
    requireCondition(inspection.gateway.operation === expected.gateway_operation, `Gateway operation mismatch: ${lane.product_id}`);
    requireCondition(inspection.gateway.result === expected.gateway_result, `Gateway result mismatch: ${lane.product_id}`);

    requireCondition(packet.gateway.request.core_receipts.length === 0, `scenario forbids carried Core receipts: ${lane.product_id}`);
    requireCondition(packet.gateway.request.intent_evidence_refs.length === 0, `scenario forbids carried intent refs: ${lane.product_id}`);
    requireCondition(packet.gateway.decision.evidence_refs.length === 0, `scenario forbids carried decision evidence refs: ${lane.product_id}`);

    packetIds.push(packet.packet_id);
    envelopeIds.push(packet.ial.envelope.envelope_id);
    requestIds.push(packet.gateway.request.request_id);
    laneEvidence.push(evidenceDigests(packet));
    inspections.push({ lane, inspection });
  }

  requireCondition(new Set(packetIds).size === 2, 'transport packet identity must remain distinct across products');
  requireCondition(new Set(envelopeIds).size === 2, 'IAL envelope identity must remain distinct across products');
  requireCondition(new Set(requestIds).size === 2, 'Gateway request identity must remain distinct across products');

  const sharedEvidence = laneEvidence[0].filter(digest => laneEvidence[1].includes(digest));
  requireCondition(sharedEvidence.length === 0, 'product-specific evidence must not be shared across lanes');

  const profiles = input.lanes.map(lane => lane.transport_packet.profile);
  requireCondition(new Set(profiles).size === 1 && profiles[0] === Transport.PROFILE, 'transport profile must be shared exactly');

  validateControls(input.controls);
  assertExactStringSet(input.assertions, REQUIRED_ASSERTIONS, 'assertions');
  assertExactStringSet(input.non_effects, REQUIRED_NON_EFFECTS, 'non_effects');
  requireCondition(input.content_hash === computeContentHash(input), 'scenario content hash mismatch');

  return { input, inspections, sharedEvidenceCount: sharedEvidence.length };
}

function buildReceipt(input) {
  const validated = validateScenario(input);
  const laneSummaries = validated.inspections
    .map(({ lane, inspection }) => ({
      lane_id: lane.lane_id,
      product_id: lane.product_id,
      product_version: inspection.consumer.product_version,
      product_contract_hash: inspection.consumer.product_contract_hash,
      transport_packet_id: inspection.packet_id,
      transport_packet_hash: inspection.packet_hash,
      ial_envelope_id: inspection.ial.envelope_id,
      ial_elevation_level: inspection.ial.elevation_level,
      gateway_request_id: inspection.gateway.request_id,
      gateway_operation: inspection.gateway.operation,
      gateway_result: inspection.gateway.result
    }))
    .sort((left, right) => left.product_id.localeCompare(right.product_id));

  const claims = {};
  for (const key of TRUE_CLAIMS) claims[key] = true;
  for (const key of FALSE_CLAIMS) claims[key] = false;

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    scenario_id: input.scenario_id,
    scenario_hash: input.content_hash,
    status: STATUS,
    evaluation_frontier: clone(input.evaluation_frontier),
    lanes: laneSummaries,
    shared_infrastructure: {
      ial_protocol: 'IAL',
      ial_version: '0.1',
      ial_profile: 'compact-envelope-v0.1',
      transport_protocol: Transport.PROTOCOL,
      transport_version: Transport.VERSION,
      transport_profile: Transport.PROFILE,
      exact_frontier_shared: true,
      local_only: true,
      read_only: true
    },
    isolation: {
      distinct_product_ids: true,
      distinct_packet_ids: true,
      distinct_envelope_ids: true,
      distinct_gateway_request_ids: true,
      shared_product_evidence_ref_count: validated.sharedEvidenceCount
    },
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  assertExactKeys(receipt, RECEIPT_KEYS, 'receipt');
  requireCondition(receipt.protocol === PROTOCOL, 'receipt protocol mismatch');
  requireCondition(receipt.version === VERSION, 'receipt version mismatch');
  requireCondition(receipt.receipt_type === RECEIPT_TYPE, 'receipt type mismatch');
  requireCondition(receipt.status === STATUS, 'receipt status mismatch');
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'receipt next_safe_action mismatch');
  assertString(receipt.scenario_id, 'receipt.scenario_id');
  assertString(receipt.scenario_hash, 'receipt.scenario_hash', /^sha256:[0-9a-f]{64}$/);
  assertExactKeys(receipt.evaluation_frontier, FRONTIER_KEYS, 'receipt.evaluation_frontier');
  requireCondition(receipt.evaluation_frontier.repository === 'Matawaka/uu-aap', 'receipt repository frontier mismatch');
  assertString(receipt.evaluation_frontier.revision, 'receipt.evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  assertString(receipt.evaluation_frontier.observed_at, 'receipt.evaluation_frontier.observed_at');

  requireCondition(Array.isArray(receipt.lanes) && receipt.lanes.length === 2, 'receipt requires exactly two lanes');
  const seenProducts = [];
  const packetIds = [];
  const envelopeIds = [];
  const requestIds = [];
  for (const lane of receipt.lanes) {
    assertExactKeys(lane, RECEIPT_LANE_KEYS, 'receipt.lane');
    const expected = EXPECTED_PRODUCTS[lane.product_id];
    requireCondition(expected, `receipt unsupported product: ${lane.product_id}`);
    requireCondition(lane.lane_id === expected.lane_id, `receipt lane id mismatch: ${lane.product_id}`);
    requireCondition(lane.product_version === expected.product_version, `receipt product version mismatch: ${lane.product_id}`);
    requireCondition(lane.product_contract_hash === expected.product_contract_hash, `receipt product contract hash mismatch: ${lane.product_id}`);
    requireCondition(lane.ial_elevation_level === expected.elevation_level, `receipt IAL elevation mismatch: ${lane.product_id}`);
    requireCondition(lane.gateway_operation === expected.gateway_operation, `receipt Gateway operation mismatch: ${lane.product_id}`);
    requireCondition(lane.gateway_result === expected.gateway_result, `receipt Gateway result mismatch: ${lane.product_id}`);
    assertString(lane.transport_packet_hash, 'receipt.transport_packet_hash', /^sha256:[0-9a-f]{64}$/);
    seenProducts.push(lane.product_id);
    packetIds.push(lane.transport_packet_id);
    envelopeIds.push(lane.ial_envelope_id);
    requestIds.push(lane.gateway_request_id);
  }
  requireCondition(JSON.stringify(seenProducts.sort()) === JSON.stringify(Object.keys(EXPECTED_PRODUCTS).sort()), 'receipt product set mismatch');
  requireCondition(new Set(packetIds).size === 2, 'receipt packet identities must remain distinct');
  requireCondition(new Set(envelopeIds).size === 2, 'receipt envelope identities must remain distinct');
  requireCondition(new Set(requestIds).size === 2, 'receipt request identities must remain distinct');

  assertExactKeys(receipt.shared_infrastructure, SHARED_INFRASTRUCTURE_KEYS, 'receipt.shared_infrastructure');
  requireCondition(receipt.shared_infrastructure.ial_protocol === 'IAL', 'shared IAL protocol mismatch');
  requireCondition(receipt.shared_infrastructure.ial_version === '0.1', 'shared IAL version mismatch');
  requireCondition(receipt.shared_infrastructure.ial_profile === 'compact-envelope-v0.1', 'shared IAL profile mismatch');
  requireCondition(receipt.shared_infrastructure.transport_protocol === Transport.PROTOCOL, 'shared transport protocol mismatch');
  requireCondition(receipt.shared_infrastructure.transport_version === Transport.VERSION, 'shared transport version mismatch');
  requireCondition(receipt.shared_infrastructure.transport_profile === Transport.PROFILE, 'shared transport profile mismatch');
  for (const key of ['exact_frontier_shared', 'local_only', 'read_only']) {
    requireCondition(receipt.shared_infrastructure[key] === true, `shared infrastructure ${key} must remain true`);
  }

  assertExactKeys(receipt.isolation, ISOLATION_KEYS, 'receipt.isolation');
  for (const key of ['distinct_product_ids', 'distinct_packet_ids', 'distinct_envelope_ids', 'distinct_gateway_request_ids']) {
    requireCondition(receipt.isolation[key] === true, `isolation ${key} must remain true`);
  }
  requireCondition(receipt.isolation.shared_product_evidence_ref_count === 0, 'shared product evidence refs must remain zero');

  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  for (const key of TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required claim ${key} must be true`);
  for (const key of FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited claim ${key} must remain false`);
  assertExactStringSet(receipt.non_effects, REQUIRED_NON_EFFECTS, 'receipt.non_effects');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  const receipt = buildReceipt(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'CrossProductLocalInteropValidationReceipt',
    scenario_id: receipt.scenario_id,
    scenario_hash: receipt.scenario_hash,
    valid: true,
    local_cross_product_interoperability_observed: true,
    product_isolation_preserved: true,
    cross_product_data_shared: false,
    authority_transferred_between_products: false,
    responsibility_transferred_between_products: false,
    action_permit_created: false,
    execution_admitted: false,
    external_effect_performed: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CrossProductLocalInteropError(`invalid JSON: ${error.message}`);
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
    'UU-AAP Cross-Product Local Interoperability v0.1',
    '',
    'Usage:',
    '  node protocols/integration/cross-product-local-interoperability/v0.1/local-interoperability.js validate <file|->',
    '  node protocols/integration/cross-product-local-interoperability/v0.1/local-interoperability.js inspect <file|->',
    '  node protocols/integration/cross-product-local-interoperability/v0.1/local-interoperability.js help',
    '',
    'This surface validates two local read-only product lanes and performs no delivery, provider invocation, execution or cross-product data sharing.'
  ].join('\n');
}

function runCli(argv) {
  const command = argv[0] || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    return { stream: 'stdout', text: `${usage()}\n`, exitCode: 0 };
  }
  requireCondition(['validate', 'inspect'].includes(command), `unsupported command: ${command}; allowed commands are validate, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or - for stdin`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : buildReceipt(input);
  return { stream: 'stdout', text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}

function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: 'CROSS_PRODUCT_LOCAL_INTEROP_REJECTED', message })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  CrossProductLocalInteropError,
  PROTOCOL,
  VERSION,
  SCENARIO_TYPE,
  RECEIPT_TYPE,
  STATUS,
  NEXT_SAFE_ACTION,
  SCENARIO_KEYS,
  LANE_KEYS,
  FRONTIER_KEYS,
  CONTROL_KEYS,
  RECEIPT_KEYS,
  RECEIPT_LANE_KEYS,
  SHARED_INFRASTRUCTURE_KEYS,
  ISOLATION_KEYS,
  EXPECTED_PRODUCTS,
  REQUIRED_ASSERTIONS,
  REQUIRED_NON_EFFECTS,
  TRUE_CLAIMS,
  FALSE_CLAIMS,
  CLAIM_KEYS,
  canonicalize,
  computeContentHash,
  rehash,
  validateScenario,
  buildReceipt,
  validateReceipt,
  validationReceipt,
  parseText,
  readInput,
  usage,
  runCli
};
