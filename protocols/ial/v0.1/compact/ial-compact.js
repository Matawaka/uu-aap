'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REQUIRED_ASSERTIONS = new Set([
  'Envelope is bound to one exact product contract and repository frontier',
  'The requested operation remains within the declared boundary',
  'CLI surface is parse, validate and inspect only'
]);

const REQUIRED_NON_EFFECTS = new Set([
  'IAL Envelope != Responsibility Acceptance',
  'IAL Expression != Authority',
  'IAL Expression != Execution Admission',
  'Validation Success != ActionPermit',
  'Inspection Receipt != External Effect',
  'Consumer Binding != Authority Transfer',
  'Private Reasoning != Required Payload',
  'E0 Parsing != Responsibility Artifact Creation',
  'E1 Observability != External Mutation Authority',
  'E2 Handoff Candidate != Accepted Handoff',
  'E3 Materialization Candidate != Materialization Permission'
]);

const TOP_LEVEL_KEYS = [
  'protocol',
  'version',
  'profile',
  'envelope_id',
  'identity',
  'frontier',
  'consumer',
  'intent',
  'target',
  'boundary',
  'responsibility',
  'authority_refs',
  'evidence',
  'requested_operation',
  'controls',
  'assertions',
  'non_effects'
];

const RFC3339_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[Tt]([01]\d|2[0-3]):([0-5]\d):([0-5]\d|60)(?:\.\d+)?(?:[Zz]|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

class IALCompactError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IALCompactError';
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new IALCompactError(message);
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

function assertRfc3339DateTime(value, label) {
  assertString(value, label);
  const match = RFC3339_DATE_TIME.exec(value);
  requireCondition(match !== null, `${label} must be RFC3339 date-time`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendar = new Date(0);
  calendar.setUTCHours(0, 0, 0, 0);
  calendar.setUTCFullYear(year, month - 1, day);
  requireCondition(
    calendar.getUTCFullYear() === year &&
      calendar.getUTCMonth() === month - 1 &&
      calendar.getUTCDate() === day,
    `${label} must contain a valid calendar date`
  );
}

function assertBoolean(value, label) {
  requireCondition(typeof value === 'boolean', `${label} must be boolean`);
}

function assertArray(value, label, { minItems = 0, unique = false } = {}) {
  requireCondition(Array.isArray(value), `${label} must be an array`);
  requireCondition(value.length >= minItems, `${label} requires at least ${minItems} item(s)`);
  if (unique) {
    requireCondition(new Set(value.map(item => JSON.stringify(item))).size === value.length, `${label} must contain unique items`);
  }
}

function assertStringArray(value, label, { minItems = 1 } = {}) {
  assertArray(value, label, { minItems, unique: true });
  value.forEach((item, index) => assertString(item, `${label}[${index}]`));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function identityProjection(envelope) {
  const projected = clone(envelope);
  projected.identity.content_hash = '';
  return projected;
}

function computeContentHash(envelope) {
  const canonical = JSON.stringify(canonicalize(identityProjection(envelope)));
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function rehash(envelope) {
  envelope.identity.content_hash = computeContentHash(envelope);
  return envelope;
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new IALCompactError(`invalid JSON: ${error.message}`);
  }
}

function readInput(inputPath) {
  requireCondition(typeof inputPath === 'string' && inputPath.length > 0, 'input path is required');
  const text = inputPath === '-'
    ? fs.readFileSync(0, 'utf8')
    : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function validateShape(envelope) {
  assertExactKeys(envelope, TOP_LEVEL_KEYS, 'envelope');
  requireCondition(envelope.protocol === 'IAL', 'protocol must be IAL');
  requireCondition(envelope.version === '0.1', 'version must be 0.1');
  requireCondition(envelope.profile === 'compact-envelope-v0.1', 'profile mismatch');
  assertString(envelope.envelope_id, 'envelope_id', /^[a-z][a-z0-9-]{2,95}$/);

  assertExactKeys(envelope.identity, ['canonicalization_profile', 'hash_algorithm', 'content_hash'], 'identity');
  requireCondition(envelope.identity.canonicalization_profile === 'ial-compact-json-v0.1', 'canonicalization profile mismatch');
  requireCondition(envelope.identity.hash_algorithm === 'sha256', 'hash algorithm mismatch');
  assertString(envelope.identity.content_hash, 'identity.content_hash', /^sha256:[0-9a-f]{64}$/);

  assertExactKeys(envelope.frontier, ['repository', 'revision', 'observed_at'], 'frontier');
  assertString(envelope.frontier.repository, 'frontier.repository');
  assertString(envelope.frontier.revision, 'frontier.revision', /^[0-9a-f]{40}$/);
  assertRfc3339DateTime(envelope.frontier.observed_at, 'frontier.observed_at');

  assertExactKeys(
    envelope.consumer,
    ['product_id', 'product_version', 'product_contract_path', 'product_contract_hash', 'requester_role_id'],
    'consumer'
  );
  assertString(envelope.consumer.product_id, 'consumer.product_id', /^[a-z][a-z0-9-]{1,63}$/);
  assertString(envelope.consumer.product_version, 'consumer.product_version');
  requireCondition(envelope.consumer.product_version.length <= 64, 'consumer.product_version exceeds 64 characters');
  assertString(
    envelope.consumer.product_contract_path,
    'consumer.product_contract_path',
    /^products\/[a-z0-9-]+\/v[0-9]+\.[0-9]+\/product-contract\.json$/
  );
  assertString(envelope.consumer.product_contract_hash, 'consumer.product_contract_hash', /^sha256:[0-9a-f]{64}$/);
  assertString(envelope.consumer.requester_role_id, 'consumer.requester_role_id', /^[a-z][a-z0-9-]{1,95}$/);

  assertExactKeys(envelope.intent, ['origin', 'statement', 'scope', 'non_goals'], 'intent');
  requireCondition(['human_declared', 'system_proposed', 'mixed'].includes(envelope.intent.origin), 'intent.origin invalid');
  assertString(envelope.intent.statement, 'intent.statement');
  assertStringArray(envelope.intent.scope, 'intent.scope');
  assertStringArray(envelope.intent.non_goals, 'intent.non_goals');

  assertExactKeys(envelope.target, ['kind', 'identifier'], 'target');
  requireCondition([
    'local_artifact',
    'repository_artifact',
    'human_decision_packet',
    'external_resource_candidate',
    'canonical_state_candidate'
  ].includes(envelope.target.kind), 'target.kind invalid');
  assertString(envelope.target.identifier, 'target.identifier');

  assertExactKeys(
    envelope.boundary,
    ['elevation_level', 'effect_class', 'observable_effect', 'responsibility_handoff', 'materialization_commitment'],
    'boundary'
  );
  requireCondition(['E0', 'E1', 'E2', 'E3'].includes(envelope.boundary.elevation_level), 'boundary.elevation_level invalid');
  requireCondition([
    'internal_analysis',
    'observable_output',
    'responsibility_handoff',
    'materialization_candidate'
  ].includes(envelope.boundary.effect_class), 'boundary.effect_class invalid');
  assertBoolean(envelope.boundary.observable_effect, 'boundary.observable_effect');
  assertBoolean(envelope.boundary.responsibility_handoff, 'boundary.responsibility_handoff');
  assertBoolean(envelope.boundary.materialization_commitment, 'boundary.materialization_commitment');

  assertExactKeys(
    envelope.responsibility,
    ['current_responsible_party_id', 'receiving_party_id', 'handoff_scope', 'acceptance_ref'],
    'responsibility'
  );
  assertString(envelope.responsibility.current_responsible_party_id, 'responsibility.current_responsible_party_id');
  requireCondition(
    envelope.responsibility.receiving_party_id === null ||
      (typeof envelope.responsibility.receiving_party_id === 'string' && envelope.responsibility.receiving_party_id.length > 0),
    'responsibility.receiving_party_id must be null or a non-empty string'
  );
  assertStringArray(envelope.responsibility.handoff_scope, 'responsibility.handoff_scope', { minItems: 0 });
  requireCondition(envelope.responsibility.acceptance_ref === null, 'compact envelope must not claim responsibility acceptance');

  assertExactKeys(
    envelope.authority_refs,
    ['authority_evidence_ref', 'action_permit_ref', 'execution_admission_ref', 'materialization_permission_ref'],
    'authority_refs'
  );
  for (const [key, value] of Object.entries(envelope.authority_refs)) {
    requireCondition(value === null, `compact envelope must not establish ${key}`);
  }

  assertExactKeys(envelope.evidence, ['refs', 'private_reasoning_included'], 'evidence');
  assertArray(envelope.evidence.refs, 'evidence.refs', { minItems: 1 });
  const evidenceIds = [];
  for (let index = 0; index < envelope.evidence.refs.length; index += 1) {
    const ref = envelope.evidence.refs[index];
    assertExactKeys(ref, ['id', 'kind', 'digest', 'description'], `evidence.refs[${index}]`);
    assertString(ref.id, `evidence.refs[${index}].id`, /^[a-z][a-z0-9-]{1,95}$/);
    requireCondition([
      'product_contract',
      'user_input',
      'repository_artifact',
      'derived_candidate',
      'protective_assessment',
      'other'
    ].includes(ref.kind), `evidence.refs[${index}].kind invalid`);
    assertString(ref.digest, `evidence.refs[${index}].digest`, /^sha256:[0-9a-f]{64}$/);
    assertString(ref.description, `evidence.refs[${index}].description`);
    evidenceIds.push(ref.id);
  }
  requireCondition(new Set(evidenceIds).size === evidenceIds.length, 'evidence ref ids must be unique');
  requireCondition(envelope.evidence.private_reasoning_included === false, 'private reasoning inclusion is forbidden');

  assertExactKeys(
    envelope.requested_operation,
    ['operation_class', 'verb', 'description', 'external_mutation_requested'],
    'requested_operation'
  );
  requireCondition([
    'local_analysis',
    'display_candidate',
    'handoff_candidate',
    'materialization_candidate'
  ].includes(envelope.requested_operation.operation_class), 'requested_operation.operation_class invalid');
  assertString(envelope.requested_operation.verb, 'requested_operation.verb', /^[a-z][a-z0-9-]{1,63}$/);
  assertString(envelope.requested_operation.description, 'requested_operation.description');
  assertBoolean(envelope.requested_operation.external_mutation_requested, 'requested_operation.external_mutation_requested');

  assertExactKeys(
    envelope.controls,
    [
      'surface',
      'execute_command_available',
      'network_access_required',
      'filesystem_write_required',
      'responsibility_accepted',
      'execution_admitted',
      'materialization_permitted',
      'external_effect_requires_separate_gate',
      'observe_before_retry',
      'automatic_retry_on_unknown'
    ],
    'controls'
  );
  requireCondition(envelope.controls.surface === 'parse_validate_inspect_only', 'controls.surface mismatch');
  requireCondition(envelope.controls.execute_command_available === false, 'execute command must remain unavailable');
  requireCondition(envelope.controls.network_access_required === false, 'network access must not be required');
  requireCondition(envelope.controls.filesystem_write_required === false, 'filesystem write must not be required');
  requireCondition(envelope.controls.responsibility_accepted === false, 'responsibility acceptance must remain false');
  requireCondition(envelope.controls.execution_admitted === false, 'execution admission must remain false');
  requireCondition(envelope.controls.materialization_permitted === false, 'materialization permission must remain false');
  requireCondition(envelope.controls.external_effect_requires_separate_gate === true, 'separate external-effect gate required');
  requireCondition(envelope.controls.observe_before_retry === true, 'observe-before-retry required');
  requireCondition(envelope.controls.automatic_retry_on_unknown === false, 'automatic retry on UNKNOWN forbidden');

  assertStringArray(envelope.assertions, 'assertions');
  assertStringArray(envelope.non_effects, 'non_effects');
}

function validateSemantics(envelope) {
  requireCondition(envelope.identity.content_hash === computeContentHash(envelope), 'content hash mismatch');

  const assertionSet = new Set(envelope.assertions);
  for (const assertion of REQUIRED_ASSERTIONS) {
    requireCondition(assertionSet.has(assertion), `required assertion missing: ${assertion}`);
  }
  const nonEffectSet = new Set(envelope.non_effects);
  for (const nonEffect of REQUIRED_NON_EFFECTS) {
    requireCondition(nonEffectSet.has(nonEffect), `required non-effect missing: ${nonEffect}`);
  }

  const expectedPathPrefix = `products/${envelope.consumer.product_id}/`;
  requireCondition(
    envelope.consumer.product_contract_path.startsWith(expectedPathPrefix),
    'product contract path does not match consumer product id'
  );

  const contractRefs = envelope.evidence.refs.filter(ref => ref.kind === 'product_contract');
  requireCondition(contractRefs.length === 1, 'exactly one product_contract evidence ref is required');
  requireCondition(
    contractRefs[0].digest === envelope.consumer.product_contract_hash,
    'product contract evidence digest mismatch'
  );

  const level = envelope.boundary.elevation_level;
  const operationClass = envelope.requested_operation.operation_class;
  const receivingParty = envelope.responsibility.receiving_party_id;
  const handoffScope = envelope.responsibility.handoff_scope;

  if (level === 'E0') {
    requireCondition(envelope.boundary.effect_class === 'internal_analysis', 'E0 effect class mismatch');
    requireCondition(envelope.boundary.observable_effect === false, 'E0 cannot claim observable effect');
    requireCondition(envelope.boundary.responsibility_handoff === false, 'E0 cannot request responsibility handoff');
    requireCondition(envelope.boundary.materialization_commitment === false, 'E0 cannot request materialization');
    requireCondition(operationClass === 'local_analysis', 'E0 operation class mismatch');
    requireCondition(envelope.requested_operation.external_mutation_requested === false, 'E0 cannot request external mutation');
    requireCondition(receivingParty === null && handoffScope.length === 0, 'E0 cannot carry receiving party or handoff scope');
  } else if (level === 'E1') {
    requireCondition(envelope.boundary.effect_class === 'observable_output', 'E1 effect class mismatch');
    requireCondition(envelope.boundary.observable_effect === true, 'E1 requires observable effect');
    requireCondition(envelope.boundary.responsibility_handoff === false, 'E1 cannot request responsibility handoff');
    requireCondition(envelope.boundary.materialization_commitment === false, 'E1 cannot request materialization');
    requireCondition(operationClass === 'display_candidate', 'E1 operation class mismatch');
    requireCondition(receivingParty === null && handoffScope.length === 0, 'E1 cannot carry receiving party or handoff scope');
  } else if (level === 'E2') {
    requireCondition(envelope.boundary.effect_class === 'responsibility_handoff', 'E2 effect class mismatch');
    requireCondition(envelope.boundary.observable_effect === true, 'E2 requires observable boundary');
    requireCondition(envelope.boundary.responsibility_handoff === true, 'E2 requires responsibility handoff candidate');
    requireCondition(envelope.boundary.materialization_commitment === false, 'E2 cannot claim materialization commitment');
    requireCondition(operationClass === 'handoff_candidate', 'E2 operation class mismatch');
    requireCondition(typeof receivingParty === 'string' && receivingParty.length > 0, 'E2 receiving party required');
    requireCondition(handoffScope.length > 0, 'E2 handoff scope required');
  } else if (level === 'E3') {
    requireCondition(envelope.boundary.effect_class === 'materialization_candidate', 'E3 effect class mismatch');
    requireCondition(envelope.boundary.observable_effect === true, 'E3 requires observable boundary');
    requireCondition(envelope.boundary.materialization_commitment === true, 'E3 materialization candidate required');
    requireCondition(operationClass === 'materialization_candidate', 'E3 operation class mismatch');
    if (envelope.boundary.responsibility_handoff) {
      requireCondition(typeof receivingParty === 'string' && receivingParty.length > 0, 'E3 handoff receiving party required');
      requireCondition(handoffScope.length > 0, 'E3 handoff scope required');
    } else {
      requireCondition(receivingParty === null && handoffScope.length === 0, 'E3 without handoff cannot carry receiving party or scope');
    }
  }

  return envelope;
}

function validateEnvelope(envelope) {
  validateShape(envelope);
  return validateSemantics(envelope);
}

function inspectEnvelope(envelope) {
  validateEnvelope(envelope);
  const level = envelope.boundary.elevation_level;
  const handoff = envelope.boundary.responsibility_handoff;
  const materialization = envelope.boundary.materialization_commitment;
  const elevated = level !== 'E0';
  const fullHandoff = level === 'E2' || (level === 'E3' && handoff);
  const reasonCodes = [];

  if (level === 'E0') reasonCodes.push('internal_action_no_responsibility_boundary');
  if (level === 'E1') reasonCodes.push('observable_effect_boundary');
  if (level === 'E2') reasonCodes.push('responsibility_handoff_boundary', 'explicit_acceptance_required');
  if (level === 'E3') {
    reasonCodes.push('materialization_commitment_boundary', 'materialization_permission_required');
    if (handoff) reasonCodes.push('explicit_acceptance_required');
  }
  if (envelope.requested_operation.external_mutation_requested) {
    reasonCodes.push('external_mutation_candidate_not_admitted');
  }

  return {
    protocol: 'IAL',
    version: '0.1',
    receipt_type: 'IALCompactInspectionReceipt',
    cli_profile: 'parse_validate_inspect_only',
    envelope_id: envelope.envelope_id,
    envelope_hash: envelope.identity.content_hash,
    frontier: clone(envelope.frontier),
    consumer_product_id: envelope.consumer.product_id,
    status: elevated ? 'ELEVATED' : 'IAL_NOT_REQUIRED',
    elevation_level: level,
    reason_codes: reasonCodes,
    requirements: {
      full_handoff_chain_required: fullHandoff,
      explicit_responsibility_acceptance_required: fullHandoff,
      downstream_action_gate_required: elevated,
      materialization_permission_required: level === 'E3',
      observation_required_after_attempt: elevated
    },
    claims: {
      syntax_parsed: true,
      schema_shape_valid: true,
      semantic_consistency_valid: true,
      consumer_contract_binding_present: true,
      responsibility_boundary_required: elevated,
      responsibility_handoff_requested: handoff,
      materialization_candidate: materialization,
      responsibility_accepted: false,
      authority_established: false,
      action_permit_established: false,
      execution_admitted: false,
      materialization_permitted: false,
      external_effect_observed: false,
      canonical_state_established: false
    },
    non_effects: [...REQUIRED_NON_EFFECTS]
  };
}

function validationReceipt(envelope) {
  validateEnvelope(envelope);
  return {
    protocol: 'IAL',
    version: '0.1',
    cli_profile: 'parse_validate_inspect_only',
    command: 'validate',
    envelope_id: envelope.envelope_id,
    envelope_hash: envelope.identity.content_hash,
    valid: true,
    responsibility_accepted: false,
    authority_established: false,
    action_permit_created: false,
    execution_admitted: false,
    materialization_permitted: false
  };
}

function usage() {
  return [
    'IAL Compact CLI v0.1',
    '',
    'Usage:',
    '  node protocols/ial/v0.1/compact/ial-compact.js parse <file|->',
    '  node protocols/ial/v0.1/compact/ial-compact.js validate <file|->',
    '  node protocols/ial/v0.1/compact/ial-compact.js inspect <file|->',
    '  node protocols/ial/v0.1/compact/ial-compact.js help',
    '',
    'The CLI has no execute command and performs no network or filesystem write operation.'
  ].join('\n');
}

function runCli(argv) {
  const command = argv[0] || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    return { stream: 'stdout', text: `${usage()}\n`, exitCode: 0 };
  }
  requireCondition(['parse', 'validate', 'inspect'].includes(command), `unsupported command: ${command}; allowed commands are parse, validate, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or - for stdin`);

  const envelope = readInput(argv[1]);
  if (command === 'parse') {
    return {
      stream: 'stdout',
      text: `${JSON.stringify(canonicalize(envelope), null, 2)}\n`,
      exitCode: 0
    };
  }
  if (command === 'validate') {
    return {
      stream: 'stdout',
      text: `${JSON.stringify(validationReceipt(envelope), null, 2)}\n`,
      exitCode: 0
    };
  }
  return {
    stream: 'stdout',
    text: `${JSON.stringify(inspectEnvelope(envelope), null, 2)}\n`,
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
    process.stderr.write(`${JSON.stringify({ error: 'IAL_COMPACT_REJECTED', message })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  IALCompactError,
  REQUIRED_ASSERTIONS,
  REQUIRED_NON_EFFECTS,
  canonicalize,
  computeContentHash,
  rehash,
  parseText,
  readInput,
  validateShape,
  validateSemantics,
  validateEnvelope,
  inspectEnvelope,
  validationReceipt,
  usage,
  runCli
};
