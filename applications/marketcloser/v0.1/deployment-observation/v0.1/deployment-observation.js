'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'MARKETCLOSER-DEPLOYMENT-OBSERVATION';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserDeploymentObservationInput';
const RECEIPT_TYPE = 'MarketCloserDeploymentObservationReceipt';
const BOUNDARY_HASH = 'sha256:143981c45d5a8cfa82261247325aef81da9686d5303ef9f696683ef6e5e9ee97';
const NEXT_SAFE_ACTION = 'MINIMIZED_REAL_REVIEW_BRIDGE_REQUIRED';

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'observation_id', 'boundary_binding',
  'deployment', 'observed_application', 'source_artifact', 'observation', 'controls', 'content_hash'
]);
const BOUNDARY_KEYS = Object.freeze([
  'application_id', 'boundary_version', 'boundary_hash', 'successor_frontier'
]);
const DEPLOYMENT_KEYS = Object.freeze([
  'url', 'supplied_by', 'independently_verified', 'reachability_verified'
]);
const APPLICATION_KEYS = Object.freeze([
  'application_id', 'name', 'reported_version', 'reported_architecture_profile', 'uu_aap_conformance_claimed'
]);
const SOURCE_ARTIFACT_KEYS = Object.freeze([
  'kind', 'artifact_ref', 'digest', 'private_material_committed'
]);
const DIGEST_KEYS = Object.freeze([
  'algorithm', 'value', 'canonicalization_declared', 'canonicalization_profile', 'independently_attested'
]);
const OBSERVATION_KEYS = Object.freeze([
  'method', 'observed_at', 'operator_supplied', 'independent', 'network_fetch_performed',
  'dns_resolution_performed', 'artifact_deployment_binding_evidence_present', 'automatically_transmitted'
]);
const CONTROL_KEYS = Object.freeze([
  'local_only', 'read_only', 'network_access_available', 'dns_resolution_available',
  'platform_mutation_available', 'external_publication_available', 'provider_invocation_available',
  'action_permit_available', 'pilot_permit_available', 'execution_available', 'external_effect_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol', 'version', 'receipt_type', 'receipt_id', 'boundary_binding', 'source_input',
  'deployment', 'observed_application', 'source_artifact', 'observation',
  'observation_status', 'binding_status', 'claims', 'non_effects', 'next_safe_action', 'content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['observation_id', 'input_hash']);

const TRUE_CLAIMS = Object.freeze([
  'exact_application_boundary_bound',
  'exact_input_bound',
  'operator_observation_recorded',
  'local_read_only_validation_completed'
]);
const FALSE_CLAIMS = Object.freeze([
  'deployment_verified',
  'deployment_reachability_verified',
  'source_provenance_established',
  'audit_deployment_binding_established',
  'independent_observation_completed',
  'network_fetch_performed',
  'dns_resolution_performed',
  'uu_aap_conformance_established',
  'publication_authorized',
  'action_permit_created',
  'pilot_permit_created',
  'execution_admitted',
  'external_effect_performed',
  'private_material_committed'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Deployment URL != Deployment Verification',
  'Operator Observation != Independent Observation',
  'Audit Export != Deployment Provenance',
  'Audit Digest != Independent Attestation',
  'Application Version != Protocol Conformance',
  'UU-AAP/T-inspired != UU-AAP Conformance',
  'Manual Sharing != Automatic Transmission',
  'Developer Analysis Authorization != Publication Authority',
  'Application Event != Authority Effect',
  'Observation Receipt != PilotPermit',
  'Observation Receipt != ActionPermit',
  'Observation Receipt != Execution'
]);

class MarketCloserDeploymentObservationError extends Error {}

function requireCondition(condition, message) {
  if (!condition) throw new MarketCloserDeploymentObservationError(message);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function computeContentHash(value) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.content_hash;
  const text = JSON.stringify(canonicalize(copy));
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function rehash(value) {
  value.content_hash = computeContentHash(value);
  return value;
}

function assertExactKeys(value, expected, label) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  requireCondition(JSON.stringify(actual) === JSON.stringify(wanted), `${label} key mismatch`);
}

function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} format invalid`);
}

function assertBoolean(value, label) {
  requireCondition(typeof value === 'boolean', `${label} must be boolean`);
}

function assertTime(value, label) {
  assertString(value, label);
  requireCondition(Number.isFinite(Date.parse(value)), `${label} must be an ISO date-time`);
}

function validateUrl(value) {
  assertString(value, 'deployment.url');
  let parsed;
  try { parsed = new URL(value); } catch (_) { throw new MarketCloserDeploymentObservationError('deployment.url invalid'); }
  requireCondition(parsed.protocol === 'https:', 'deployment.url must use https');
  requireCondition(parsed.username === '' && parsed.password === '', 'deployment.url credentials are forbidden');
  requireCondition(parsed.hash === '', 'deployment.url fragment is forbidden');
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, 'protocol mismatch');
  requireCondition(input.version === VERSION, 'version mismatch');
  requireCondition(input.artifact_type === INPUT_TYPE, 'artifact_type mismatch');
  assertString(input.observation_id, 'observation_id', /^urn:uu-aap:marketcloser:deployment-observation:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(input.boundary_binding, BOUNDARY_KEYS, 'boundary_binding');
  requireCondition(input.boundary_binding.application_id === 'marketcloser', 'boundary application mismatch');
  requireCondition(input.boundary_binding.boundary_version === '0.1', 'boundary version mismatch');
  requireCondition(input.boundary_binding.boundary_hash === BOUNDARY_HASH, 'boundary hash mismatch');
  requireCondition(input.boundary_binding.successor_frontier === '39af0064e71c545fd38edc65eacd073b7801f729', 'successor frontier mismatch');

  assertExactKeys(input.deployment, DEPLOYMENT_KEYS, 'deployment');
  validateUrl(input.deployment.url);
  requireCondition(input.deployment.supplied_by === 'operator', 'deployment URL must be operator supplied in v0.1');
  requireCondition(input.deployment.independently_verified === false, 'v0.1 cannot independently verify deployment URL');
  requireCondition(input.deployment.reachability_verified === false, 'v0.1 cannot verify deployment reachability');

  assertExactKeys(input.observed_application, APPLICATION_KEYS, 'observed_application');
  requireCondition(input.observed_application.application_id === 'marketcloser', 'observed application id mismatch');
  requireCondition(input.observed_application.name === 'MarketCloser', 'observed application name mismatch');
  assertString(input.observed_application.reported_version, 'observed_application.reported_version');
  assertString(input.observed_application.reported_architecture_profile, 'observed_application.reported_architecture_profile');
  requireCondition(input.observed_application.uu_aap_conformance_claimed === false, 'observation input cannot claim UU-AAP conformance');

  assertExactKeys(input.source_artifact, SOURCE_ARTIFACT_KEYS, 'source_artifact');
  requireCondition(['audit_export', 'metadata_export', 'synthetic_conformance'].includes(input.source_artifact.kind), 'source artifact kind unsupported');
  assertString(input.source_artifact.artifact_ref, 'source_artifact.artifact_ref');
  assertExactKeys(input.source_artifact.digest, DIGEST_KEYS, 'source_artifact.digest');
  requireCondition(input.source_artifact.digest.algorithm === 'SHA-256', 'digest algorithm must be SHA-256');
  assertString(input.source_artifact.digest.value, 'source_artifact.digest.value', /^[0-9a-f]{64}$/);
  assertBoolean(input.source_artifact.digest.canonicalization_declared, 'digest.canonicalization_declared');
  if (input.source_artifact.digest.canonicalization_declared) {
    assertString(input.source_artifact.digest.canonicalization_profile, 'digest.canonicalization_profile');
  } else {
    requireCondition(input.source_artifact.digest.canonicalization_profile === null, 'undeclared canonicalization profile must be null');
  }
  requireCondition(input.source_artifact.digest.independently_attested === false, 'v0.1 cannot independently attest source digest');
  requireCondition(input.source_artifact.private_material_committed === false, 'private material must not be committed');

  assertExactKeys(input.observation, OBSERVATION_KEYS, 'observation');
  requireCondition(['synthetic_conformance', 'manual_operator_sharing'].includes(input.observation.method), 'observation method unsupported');
  assertTime(input.observation.observed_at, 'observation.observed_at');
  requireCondition(input.observation.operator_supplied === true, 'observation must be operator supplied');
  requireCondition(input.observation.independent === false, 'v0.1 observation cannot be independent');
  requireCondition(input.observation.network_fetch_performed === false, 'network fetch forbidden');
  requireCondition(input.observation.dns_resolution_performed === false, 'DNS resolution forbidden');
  requireCondition(input.observation.artifact_deployment_binding_evidence_present === false, 'v0.1 cannot claim deployment/artifact binding evidence');
  requireCondition(input.observation.automatically_transmitted === false, 'automatic transmission cannot be claimed');

  assertExactKeys(input.controls, CONTROL_KEYS, 'controls');
  requireCondition(input.controls.local_only === true, 'controls.local_only must be true');
  requireCondition(input.controls.read_only === true, 'controls.read_only must be true');
  for (const key of CONTROL_KEYS) {
    if (key === 'local_only' || key === 'read_only') continue;
    requireCondition(input.controls[key] === false, `effect capability must remain false: ${key}`);
  }

  requireCondition(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function deriveReceipt(input) {
  validateInput(input);
  const claims = {};
  for (const key of TRUE_CLAIMS) claims[key] = true;
  for (const key of FALSE_CLAIMS) claims[key] = false;

  const observationStatus = input.observation.method === 'synthetic_conformance'
    ? 'SYNTHETIC_CONFORMANCE_OBSERVATION_RECORDED'
    : 'OPERATOR_DEPLOYMENT_OBSERVATION_RECORDED';

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:deployment-observation-receipt:${input.content_hash.slice(-24)}`,
    boundary_binding: JSON.parse(JSON.stringify(input.boundary_binding)),
    source_input: {
      observation_id: input.observation_id,
      input_hash: input.content_hash
    },
    deployment: JSON.parse(JSON.stringify(input.deployment)),
    observed_application: JSON.parse(JSON.stringify(input.observed_application)),
    source_artifact: JSON.parse(JSON.stringify(input.source_artifact)),
    observation: JSON.parse(JSON.stringify(input.observation)),
    observation_status: observationStatus,
    binding_status: 'DEPLOYMENT_BINDING_INSUFFICIENT',
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
  assertString(receipt.receipt_id, 'receipt.receipt_id', /^urn:uu-aap:marketcloser:deployment-observation-receipt:[0-9a-f]{24}$/);
  assertExactKeys(receipt.boundary_binding, BOUNDARY_KEYS, 'receipt.boundary_binding');
  requireCondition(receipt.boundary_binding.boundary_hash === BOUNDARY_HASH, 'receipt boundary hash mismatch');
  assertExactKeys(receipt.source_input, SOURCE_INPUT_KEYS, 'receipt.source_input');
  assertString(receipt.source_input.observation_id, 'receipt.source_input.observation_id');
  assertString(receipt.source_input.input_hash, 'receipt.source_input.input_hash', /^sha256:[0-9a-f]{64}$/);
  assertExactKeys(receipt.deployment, DEPLOYMENT_KEYS, 'receipt.deployment');
  validateUrl(receipt.deployment.url);
  assertExactKeys(receipt.observed_application, APPLICATION_KEYS, 'receipt.observed_application');
  assertExactKeys(receipt.source_artifact, SOURCE_ARTIFACT_KEYS, 'receipt.source_artifact');
  assertExactKeys(receipt.source_artifact.digest, DIGEST_KEYS, 'receipt.source_artifact.digest');
  assertExactKeys(receipt.observation, OBSERVATION_KEYS, 'receipt.observation');
  requireCondition(['SYNTHETIC_CONFORMANCE_OBSERVATION_RECORDED', 'OPERATOR_DEPLOYMENT_OBSERVATION_RECORDED'].includes(receipt.observation_status), 'receipt observation_status invalid');
  requireCondition(receipt.binding_status === 'DEPLOYMENT_BINDING_INSUFFICIENT', 'receipt binding_status must remain insufficient');
  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  for (const key of TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required claim ${key} must be true`);
  for (const key of FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited claim ${key} must remain false`);
  requireCondition(Array.isArray(receipt.non_effects), 'receipt.non_effects must be an array');
  requireCondition(JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'receipt non_effect set mismatch');
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'receipt next_safe_action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserDeploymentObservationInputValidationReceipt',
    observation_id: input.observation_id,
    input_hash: input.content_hash,
    valid: true,
    network_fetch_performed: false,
    deployment_verified: false,
    deployment_binding_established: false,
    external_effect_available: false
  };
}

function inspectInput(input) {
  const receipt = deriveReceipt(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserDeploymentObservationInspectionReceipt',
    observation_id: input.observation_id,
    input_hash: input.content_hash,
    observation_status: receipt.observation_status,
    binding_status: receipt.binding_status,
    deployment_verified: false,
    source_provenance_established: false,
    next_safe_action: NEXT_SAFE_ACTION
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try { return JSON.parse(text); } catch (error) { throw new MarketCloserDeploymentObservationError(`invalid JSON: ${error.message}`); }
}

function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function usage() {
  return [
    'MarketCloser Deployment-Bound Observation Receipt v0.1',
    '',
    'Usage:',
    '  node applications/marketcloser/v0.1/deployment-observation/v0.1/deployment-observation.js validate <file|->',
    '  node applications/marketcloser/v0.1/deployment-observation/v0.1/deployment-observation.js receipt <file|->',
    '  node applications/marketcloser/v0.1/deployment-observation/v0.1/deployment-observation.js inspect <file|->',
    '  node applications/marketcloser/v0.1/deployment-observation/v0.1/deployment-observation.js help',
    '',
    'This runtime records an operator-supplied observation only. It performs no network fetch and does not verify deployment provenance.'
  ].join('\n');
}

function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  requireCondition(['validate', 'receipt', 'inspect'].includes(command), `unsupported command: ${command}`);
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : command === 'receipt' ? deriveReceipt(input) : inspectInput(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}

function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: 'MARKETCLOSER_DEPLOYMENT_OBSERVATION_REJECTED', message: error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  MarketCloserDeploymentObservationError,
  PROTOCOL,
  VERSION,
  INPUT_TYPE,
  RECEIPT_TYPE,
  BOUNDARY_HASH,
  NEXT_SAFE_ACTION,
  INPUT_KEYS,
  RECEIPT_KEYS,
  TRUE_CLAIMS,
  FALSE_CLAIMS,
  CLAIM_KEYS,
  REQUIRED_NON_EFFECTS,
  canonicalize,
  computeContentHash,
  rehash,
  validateInput,
  deriveReceipt,
  validateReceipt,
  validationReceipt,
  inspectInput,
  parseText,
  readInput,
  usage,
  runCli
};