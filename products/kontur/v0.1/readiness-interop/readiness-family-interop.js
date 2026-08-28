'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Aggregator = require('../../../../server/kontur/v0.1/readiness-aggregator.js');

const PROTOCOL = 'UU-AAP-KONTUR-FAMILY-READINESS-INTEROP';
const VERSION = '0.1';
const RECEIPT_TYPE = 'KONTURFamilyReadinessInteropReceipt';
const STATUS = 'READINESS_EVIDENCE_AVAILABLE_FOR_FAMILY_INSPECTION';
const NEXT_SAFE_ACTION = 'READ_ONLY_FAMILY_READINESS_INSPECTION_ONLY';
const EXPECTED_MANIFEST_HASH = 'sha256:90da81f7c33f44f34410790e9269bf8b05a5ad47db596437b214b8301701a5a1';
const EXPECTED_READINESS_PATHS = [
  'server/kontur/v0.1/READINESS_AGGREGATOR.md',
  'server/kontur/v0.1/readiness-aggregator.js',
  'server/kontur/v0.1/test-readiness-aggregator.js',
  'server/kontur/v0.1/kontur-readiness-aggregation.schema.json'
];
const REQUIRED_FAMILY_NON_EFFECTS = [
  'KONTUR Product Family Contract != KONTUR Activation',
  'Readiness Aggregation != Kernel Activation',
  'Ready Signal != ActionPermit',
  'Family Membership != Shared Data Access',
  'Live Host Eligibility != Live Host Designation',
  'Designation != Activation',
  'Activation Review != Activation Execution',
  'Observed Runtime != Permitted Runtime Mutation',
  'Pause or Recovery Evidence != Successor Authority'
];
const REQUIRED_NON_EFFECTS = [
  'Family Readiness Interop != Activation Frontier',
  'Readiness Aggregation != Kernel Activation',
  'Ready Signal != ActionPermit',
  'Readiness Acceptance != Activation Authority',
  'Readiness Boundary Permission != Activation Execution',
  'Family Membership != Shared Data Access',
  'Family Interoperability != Responsibility Transfer',
  'Family Inspection != Host Designation',
  'Family Inspection != Ledger Mutation',
  'Family Inspection != Runtime Start',
  'Family Inspection != Successor Authority'
];
const FALSE_CLAIMS = [
  'activation_frontier_created',
  'activation_authorized',
  'activation_started',
  'activation_intent_created',
  'preflight_run',
  'kernel_activated',
  'responsibility_state_created',
  'responsibility_accepted',
  'host_designated',
  'ledger_mutated',
  'runtime_started',
  'cross_member_data_access_admitted',
  'authority_created',
  'action_permit_created',
  'execution_admitted',
  'external_effect_performed',
  'successor_authority_created'
];

class KONTURFamilyReadinessInteropError extends Error {
  constructor(message) {
    super(message);
    this.name = 'KONTURFamilyReadinessInteropError';
  }
}

function fail(message) {
  throw new KONTURFamilyReadinessInteropError(message);
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

function contentHash(value) {
  const projected = clone(value);
  if (Object.prototype.hasOwnProperty.call(projected, 'content_hash')) projected.content_hash = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}

async function artifactBinding(artifactType, artifactRef, artifact) {
  return {
    artifact_type: artifactType,
    artifact_ref: artifactRef,
    digest: {
      canonicalization: 'RFC8785-JCS',
      digest_algorithm: 'SHA-256',
      digest_encoding: 'hex',
      value: await Aggregator.digestJson(artifact)
    }
  };
}

function sameCanonical(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function assertFalseClaims(claims, keys, label) {
  assertObject(claims, `${label}.claims`);
  for (const key of keys) {
    requireCondition(claims[key] === false, `${label}: prohibited claim ${key}`);
  }
}

function validateFamilyManifest(manifest) {
  assertObject(manifest, 'family_manifest');
  requireCondition(manifest.schema_version === '0.1', 'family manifest schema version mismatch');
  requireCondition(manifest.manifest_id === 'kontur-product-family-manifest-v0.1', 'family manifest id mismatch');
  requireCondition(
    manifest.identity && manifest.identity.content_hash === EXPECTED_MANIFEST_HASH,
    'family manifest canonical identity mismatch'
  );
  requireCondition(
    manifest.family && manifest.family.id === 'kontur' && manifest.family.version === '0.1',
    'KONTUR family identity mismatch'
  );
  requireCondition(manifest.family.activated === false, 'family manifest cannot claim activation');
  requireCondition(manifest.family.production_ready === false, 'family manifest cannot claim production readiness');

  requireCondition(Array.isArray(manifest.members), 'family members must be an array');
  const readinessMembers = manifest.members.filter(member => member.id === 'readiness-aggregator');
  requireCondition(readinessMembers.length === 1, 'exactly one readiness-aggregator member required');
  const member = readinessMembers[0];
  requireCondition(member.evidence_status === 'implemented_experimental', 'readiness member evidence status mismatch');
  requireCondition(member.runtime_activation_state === 'not_activated', 'readiness member activation state mismatch');
  requireCondition(member.core_member === false, 'readiness member cannot be Core member');
  requireCondition(member.authority_source === false, 'readiness member cannot be authority source');
  requireCondition(member.responsibility_holder === false, 'readiness member cannot be responsibility holder');
  requireCondition(member.shared_data_access === false, 'readiness member cannot gain shared data access');
  requireCondition(member.external_effect_authorized === false, 'readiness member cannot authorize external effect');
  requireCondition(
    JSON.stringify([...member.canonical_paths].sort()) === JSON.stringify([...EXPECTED_READINESS_PATHS].sort()),
    'readiness member canonical path set mismatch'
  );

  requireCondition(Array.isArray(manifest.edges), 'family edges must be an array');
  const edges = manifest.edges.filter(edge => edge.from === 'readiness-aggregator' && edge.to === 'activation-boundary');
  requireCondition(edges.length === 1, 'exact readiness -> activation edge required');
  const edge = edges[0];
  requireCondition(edge.status === 'established_evidence_dependency', 'readiness edge status mismatch');
  for (const key of ['authority_transfer', 'responsibility_transfer', 'shared_data_access', 'activation_authorized']) {
    requireCondition(edge[key] === false, `readiness edge must keep ${key}=false`);
  }

  const policy = manifest.consolidation_policy;
  assertObject(policy, 'family consolidation policy');
  for (const key of [
    'automatic_activation',
    'automatic_host_designation',
    'automatic_ledger_mutation',
    'automatic_runtime_start',
    'automatic_external_effect',
    'automatic_stable_core_promotion'
  ]) {
    requireCondition(policy[key] === false, `family consolidation policy must keep ${key}=false`);
  }
  requireCondition(policy.cross_member_data_access_default === 'denied', 'cross-member data access default must remain denied');
  requireCondition(policy.human_activation_boundary_required === true, 'human activation boundary must remain required');
  requireCondition(policy.fresh_frontier_required === true, 'fresh frontier must remain required');
  requireCondition(policy.observe_before_retry === true, 'observe-before-retry must remain required');

  requireCondition(Array.isArray(manifest.non_effects), 'family non_effects must be an array');
  const familyNonEffects = new Set(manifest.non_effects);
  for (const nonEffect of REQUIRED_FAMILY_NON_EFFECTS) {
    requireCondition(familyNonEffects.has(nonEffect), `family non-effect missing: ${nonEffect}`);
  }
  return member;
}

function validateEvaluationFrontier(frontier) {
  assertExactKeys(frontier, ['repository', 'revision'], 'evaluation_frontier');
  requireCondition(frontier.repository === 'Matawaka/uu-aap', 'evaluation repository mismatch');
  requireCondition(/^[0-9a-f]{40}$/.test(frontier.revision), 'evaluation frontier requires exact Git SHA');
}

async function validateReadinessEvidence(readiness) {
  assertExactKeys(
    readiness,
    ['aggregation_receipt', 'readiness_signal', 'responsibility_policy', 'acceptance_receipt'],
    'readiness'
  );
  const aggregationReceipt = readiness.aggregation_receipt;
  const readinessSignal = readiness.readiness_signal;
  const responsibilityPolicy = readiness.responsibility_policy;
  const acceptanceReceipt = readiness.acceptance_receipt;

  requireCondition(
    aggregationReceipt && aggregationReceipt.artifact_type === 'KONTURReadinessAggregationReceipt' &&
      aggregationReceipt.artifact_version === '0.1',
    'KONTURReadinessAggregationReceipt v0.1 required'
  );
  requireCondition(
    aggregationReceipt.aggregation_result && aggregationReceipt.aggregation_result.ready === true &&
      aggregationReceipt.aggregation_result.passed_check_count === 6 &&
      aggregationReceipt.aggregation_result.failed_check_count === 0,
    'positive six-axis aggregation required'
  );
  requireCondition(
    aggregationReceipt.claims && aggregationReceipt.claims.global_readiness_aggregated === true &&
      aggregationReceipt.claims.readiness_signal_emitted === true,
    'aggregation positive claims missing'
  );
  assertFalseClaims(aggregationReceipt.claims, [
    'single_source_self_certified_global_readiness',
    'kernel_activated',
    'responsibility_state_created',
    'execution_authority_granted',
    'legal_responsibility_determined',
    'moral_blame_assigned',
    'truth_certified',
    'poai_materialization_event_recorded',
    'universal_canonicality_established'
  ], 'aggregation_receipt');

  requireCondition(
    readinessSignal && readinessSignal.artifact_type === 'KONTURReadinessSignal' &&
      readinessSignal.artifact_version === '0.1' && readinessSignal.ready === true,
    'positive KONTURReadinessSignal v0.1 required'
  );
  requireCondition(readinessSignal.claims && readinessSignal.claims.readiness_observed === true, 'readiness signal observation missing');
  assertFalseClaims(readinessSignal.claims, [
    'execution_authority_granted',
    'responsibility_accepted',
    'kernel_activated',
    'legal_responsibility_determined',
    'moral_blame_assigned',
    'truth_certified',
    'poai_materialization_event_recorded',
    'universal_canonicality_established'
  ], 'readiness_signal');

  await Aggregator.validateReadinessAcceptanceReceipt({
    receipt: acceptanceReceipt,
    aggregationReceipt,
    readinessSignal,
    responsibilityPolicy
  });

  requireCondition(
    acceptanceReceipt.decision === 'accepted_for_activation_precondition' &&
      acceptanceReceipt.claims.readiness_signal_accepted === true &&
      acceptanceReceipt.claims.human_activation_step_still_required === true,
    'positive dry-run readiness acceptance required'
  );
  assertFalseClaims(acceptanceReceipt.claims, [
    'kernel_activated',
    'responsibility_state_created',
    'responsibility_accepted',
    'execution_authority_granted',
    'legal_responsibility_determined',
    'legal_effect_established',
    'moral_blame_assigned',
    'truth_certified',
    'poai_materialization_event_recorded',
    'universal_canonicality_established'
  ], 'acceptance_receipt');

  const reproducedAcceptance = await Aggregator.dryRunAcceptReadiness({
    aggregationReceipt,
    readinessSignal,
    responsibilityPolicy,
    evaluatedAt: acceptanceReceipt.evaluated_at,
    minimumEpoch: readinessSignal.readiness_epoch,
    parallelActiveHolders: []
  });
  requireCondition(
    sameCanonical(reproducedAcceptance, acceptanceReceipt),
    'readiness acceptance does not reproduce under canonical dry-run boundary'
  );

  return true;
}

function validateControls(controls) {
  assertExactKeys(
    controls,
    [
      'surface',
      'read_only',
      'network_access_required',
      'filesystem_write_required',
      'activation_available',
      'responsibility_acceptance_available',
      'host_designation_available',
      'ledger_write_available',
      'runtime_start_available',
      'action_permit_available',
      'execution_available'
    ],
    'controls'
  );
  requireCondition(controls.surface === 'validate_inspect_only', 'controls surface mismatch');
  requireCondition(controls.read_only === true, 'read-only control required');
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
    requireCondition(controls[key] === false, `controls.${key} must remain false`);
  }
}

async function validateInput(input) {
  assertExactKeys(
    input,
    ['protocol', 'version', 'artifact_type', 'evaluation_frontier', 'family_manifest', 'readiness', 'controls'],
    'input'
  );
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === 'KONTURFamilyReadinessInteropInput', 'input artifact type mismatch');
  validateEvaluationFrontier(input.evaluation_frontier);
  validateFamilyManifest(input.family_manifest);
  validateControls(input.controls);
  await validateReadinessEvidence(input.readiness);
  return input;
}

async function buildInteropReceipt(input) {
  await validateInput(input);
  const readiness = input.readiness;
  const manifest = input.family_manifest;
  const member = manifest.members.find(item => item.id === 'readiness-aggregator');
  const edge = manifest.edges.find(item => item.from === 'readiness-aggregator' && item.to === 'activation-boundary');

  const familyManifestBinding = await artifactBinding('KONTURProductFamilyManifest', manifest.manifest_id, manifest);
  const aggregationBinding = await artifactBinding(
    'KONTURReadinessAggregationReceipt',
    readiness.aggregation_receipt.aggregation_id,
    readiness.aggregation_receipt
  );
  const readinessSignalBinding = await artifactBinding(
    'KONTURReadinessSignal',
    readiness.readiness_signal.signal_id,
    readiness.readiness_signal
  );
  const acceptanceBinding = await artifactBinding(
    'KONTURReadinessAcceptanceReceipt',
    readiness.acceptance_receipt.acceptance_id,
    readiness.acceptance_receipt
  );
  const responsibilityPolicyBinding = await artifactBinding(
    'KONTURResponsibilityPolicy',
    readiness.responsibility_policy.policy_id,
    readiness.responsibility_policy
  );

  const seed = [
    input.evaluation_frontier.revision,
    familyManifestBinding.digest.value,
    aggregationBinding.digest.value,
    readinessSignalBinding.digest.value,
    acceptanceBinding.digest.value,
    responsibilityPolicyBinding.digest.value
  ].join('|');
  const idHash = crypto.createHash('sha256').update(seed, 'utf8').digest('hex');

  const falseClaims = {};
  for (const key of FALSE_CLAIMS) falseClaims[key] = false;

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    interop_id: `urn:uu-aap:kontur:family-readiness-interop:${idHash.slice(0, 24)}`,
    evaluation_frontier: clone(input.evaluation_frontier),
    status: STATUS,
    family: {
      family_id: manifest.family.id,
      family_version: manifest.family.version,
      historical_manifest_frontier: clone(manifest.frontier),
      family_manifest_binding: familyManifestBinding,
      readiness_member_id: member.id,
      readiness_member_evidence_status: member.evidence_status,
      readiness_to_activation_edge_status: edge.status
    },
    readiness: {
      aggregation_receipt_binding: aggregationBinding,
      readiness_signal_binding: readinessSignalBinding,
      acceptance_receipt_binding: acceptanceBinding,
      responsibility_policy_binding: responsibilityPolicyBinding,
      readiness_epoch: readiness.readiness_signal.readiness_epoch,
      readiness_signal_ready: true,
      source_acceptance_decision: readiness.acceptance_receipt.decision,
      human_activation_step_still_required: true
    },
    assertions: {
      exact_evaluation_frontier_bound: true,
      historical_family_manifest_frontier_preserved: true,
      readiness_member_bound: true,
      readiness_acceptance_reproduced: true,
      family_edge_non_transfer_preserved: true,
      cross_member_data_access_default_denied: true,
      read_only_family_inspection_available: true
    },
    claims: {
      ...falseClaims
    },
    next_safe_action: NEXT_SAFE_ACTION,
    non_effects: [...REQUIRED_NON_EFFECTS],
    content_hash: ''
  };
  receipt.content_hash = contentHash(receipt);
  validateReceipt(receipt);
  return receipt;
}

function validateReceipt(receipt) {
  assertExactKeys(
    receipt,
    [
      'protocol',
      'version',
      'receipt_type',
      'interop_id',
      'evaluation_frontier',
      'status',
      'family',
      'readiness',
      'assertions',
      'claims',
      'next_safe_action',
      'non_effects',
      'content_hash'
    ],
    'receipt'
  );
  requireCondition(receipt.protocol === PROTOCOL && receipt.version === VERSION, 'receipt protocol/version mismatch');
  requireCondition(receipt.receipt_type === RECEIPT_TYPE, 'receipt type mismatch');
  requireCondition(/^urn:uu-aap:kontur:family-readiness-interop:[0-9a-f]{24}$/.test(receipt.interop_id), 'interop id invalid');
  validateEvaluationFrontier(receipt.evaluation_frontier);
  requireCondition(receipt.status === STATUS, 'receipt status mismatch');
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'next safe action mismatch');

  assertObject(receipt.family, 'receipt.family');
  requireCondition(receipt.family.family_id === 'kontur' && receipt.family.family_version === '0.1', 'receipt family identity mismatch');
  requireCondition(receipt.family.readiness_member_id === 'readiness-aggregator', 'receipt readiness member mismatch');
  requireCondition(receipt.family.readiness_member_evidence_status === 'implemented_experimental', 'receipt readiness member status mismatch');
  requireCondition(receipt.family.readiness_to_activation_edge_status === 'established_evidence_dependency', 'receipt readiness edge status mismatch');

  assertObject(receipt.readiness, 'receipt.readiness');
  requireCondition(receipt.readiness.readiness_signal_ready === true, 'receipt must preserve source readiness=true');
  requireCondition(receipt.readiness.source_acceptance_decision === 'accepted_for_activation_precondition', 'receipt acceptance decision mismatch');
  requireCondition(receipt.readiness.human_activation_step_still_required === true, 'human activation boundary must remain explicit');
  requireCondition(Number.isInteger(receipt.readiness.readiness_epoch) && receipt.readiness.readiness_epoch >= 1, 'readiness epoch invalid');

  assertObject(receipt.assertions, 'receipt.assertions');
  for (const key of [
    'exact_evaluation_frontier_bound',
    'historical_family_manifest_frontier_preserved',
    'readiness_member_bound',
    'readiness_acceptance_reproduced',
    'family_edge_non_transfer_preserved',
    'cross_member_data_access_default_denied',
    'read_only_family_inspection_available'
  ]) {
    requireCondition(receipt.assertions[key] === true, `receipt assertion ${key} must be true`);
  }

  assertFalseClaims(receipt.claims, FALSE_CLAIMS, 'interop receipt');
  const nonEffects = new Set(receipt.non_effects || []);
  for (const nonEffect of REQUIRED_NON_EFFECTS) {
    requireCondition(nonEffects.has(nonEffect), `interop non-effect missing: ${nonEffect}`);
  }
  requireCondition(receipt.content_hash === contentHash(receipt), 'interop receipt content hash mismatch');
  return true;
}

async function validationReceipt(input) {
  const receipt = await buildInteropReceipt(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'KONTURFamilyReadinessInteropValidationReceipt',
    interop_id: receipt.interop_id,
    interop_hash: receipt.content_hash,
    valid: true,
    status: receipt.status,
    next_safe_action: receipt.next_safe_action,
    activation_authorized: false,
    kernel_activated: false,
    responsibility_accepted: false,
    execution_admitted: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new KONTURFamilyReadinessInteropError(`invalid JSON: ${error.message}`);
  }
}

function readInput(inputPath) {
  requireCondition(typeof inputPath === 'string' && inputPath.length > 0, 'input path required');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function usage() {
  return [
    'KONTUR Family Readiness Interoperability CLI v0.1',
    '',
    'Usage:',
    '  node products/kontur/v0.1/readiness-interop/readiness-family-interop.js validate <file|->',
    '  node products/kontur/v0.1/readiness-interop/readiness-family-interop.js inspect <file|->',
    '  node products/kontur/v0.1/readiness-interop/readiness-family-interop.js help',
    '',
    'Read-only inspection only. No activation, responsibility acceptance, host designation, ledger write, runtime start or execution command exists.'
  ].join('\n');
}

async function runCli(argv) {
  const command = argv[0] || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    return { stream: 'stdout', text: `${usage()}\n`, exitCode: 0 };
  }
  requireCondition(
    ['validate', 'inspect'].includes(command),
    `unsupported command: ${command}; allowed commands are validate, inspect and help`
  );
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? await validationReceipt(input) : await buildInteropReceipt(input);
  return { stream: 'stdout', text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}

async function main() {
  try {
    const result = await runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: 'KONTUR_FAMILY_READINESS_INTEROP_REJECTED', message })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  KONTURFamilyReadinessInteropError,
  PROTOCOL,
  VERSION,
  RECEIPT_TYPE,
  STATUS,
  NEXT_SAFE_ACTION,
  EXPECTED_MANIFEST_HASH,
  EXPECTED_READINESS_PATHS,
  REQUIRED_NON_EFFECTS,
  FALSE_CLAIMS,
  canonicalize,
  contentHash,
  validateFamilyManifest,
  validateEvaluationFrontier,
  validateReadinessEvidence,
  validateControls,
  validateInput,
  buildInteropReceipt,
  validateReceipt,
  validationReceipt,
  parseText,
  readInput,
  usage,
  runCli
};
