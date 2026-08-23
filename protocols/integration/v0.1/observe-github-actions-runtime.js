'use strict';

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

const PRODUCER_ID = 'urn:uu-aap:producer:github-actions-runtime';
const ARTIFACT_TYPE = 'GitHubActionsRuntimeObservation';
const ARTIFACT_VERSION = '0.1';
const ALLOWED_EVENTS = new Set(['pull_request', 'push']);
const SCALAR_KEYS = new Set(['score', 'probability', 'percentage', 'weight', 'likelihood', 'confidence_score', 'causal_score', 'responsibility_score', 'blame_score', 'rating']);

function assert(value, message) {
  if (!value) throw new Error(`GitHubActionsRuntimeObservation: ${message}`);
}
function hasScalarKey(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasScalarKey);
  return Object.entries(value).some(([key, child]) => SCALAR_KEYS.has(key) || hasScalarKey(child));
}
function rawDigest(bytes) {
  return {
    canonicalization: 'raw-bytes',
    digest_algorithm: 'SHA-256',
    digest_encoding: 'hex',
    value: crypto.createHash('sha256').update(bytes).digest('hex')
  };
}
function envString(env, key) {
  const value = env[key];
  assert(typeof value === 'string' && value.length > 0, `${key} required`);
  return value;
}
function nullableEnv(env, key) {
  const value = env[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function validateEventRef(eventName, ref) {
  if (eventName === 'pull_request') assert(/^refs\/pull\/[1-9][0-9]*\/merge$/.test(ref), 'pull_request must use PR merge ref');
  if (eventName === 'push') assert(ref === 'refs/heads/main', 'push must bind refs/heads/main');
}
async function observationId(observation) {
  const seed = [
    observation.repository,
    observation.workflow_name,
    observation.event_name,
    observation.run_id,
    observation.run_attempt,
    observation.sha,
    observation.ref,
    observation.event_payload_digest.value,
    observation.observed_at
  ].join('|');
  const digest = await Binding.sha256Hex(Binding.utf8Bytes(seed));
  return `urn:uu-aap:github-actions-runtime-observation:${digest.slice(0, 24)}`;
}

async function validateRuntimeObservation(observation) {
  assert(observation && observation.artifact_type === ARTIFACT_TYPE && observation.artifact_version === ARTIFACT_VERSION, 'runtime observation v0.1 required');
  assert(!hasScalarKey(observation), 'scalar fields prohibited');
  assert(observation.producer_id === PRODUCER_ID, 'producer ID substitution');
  assert(observation.provider === 'github_actions', 'provider substitution');
  assert(typeof observation.repository === 'string' && observation.repository.length > 0, 'repository required');
  assert(typeof observation.workflow_name === 'string' && observation.workflow_name.length > 0, 'workflow name required');
  assert(ALLOWED_EVENTS.has(observation.event_name), 'unsupported event name');
  for (const key of ['run_id', 'run_number', 'run_attempt']) assert(/^[1-9][0-9]*$/.test(observation[key]), `${key} invalid`);
  assert(/^[0-9a-f]{40}$/.test(observation.sha), 'sha invalid');
  assert(typeof observation.ref === 'string' && observation.ref.length > 0, 'ref required');
  validateEventRef(observation.event_name, observation.ref);
  assert(observation.server_url === 'https://github.com', 'server URL substitution');
  const observedMs = Date.parse(observation.observed_at);
  assert(Number.isFinite(observedMs), 'invalid observed_at');
  const expectedClass = observation.event_name === 'pull_request' ? 'candidate_pull_request' : 'main_push';
  assert(observation.context_class === expectedClass, 'context class substitution');
  assert(observation.run_ref === `urn:github-actions:run:${observation.run_id}:attempt:${observation.run_attempt}`, 'run ref substitution');
  const digest = observation.event_payload_digest;
  assert(digest && digest.canonicalization === 'raw-bytes' && digest.digest_algorithm === 'SHA-256' && digest.digest_encoding === 'hex' && /^[0-9a-f]{64}$/.test(digest.value), 'event payload digest invalid');
  const claims = observation.claims || {};
  assert(claims.runtime_context_observed === true && claims.event_payload_bytes_digest_bound === true, 'runtime positive claims missing');
  for (const key of [
    'provider_identity_cryptographically_attested', 'github_remote_truth_certified',
    'external_consequence_certified', 'causal_proof_certified',
    'responsibility_for_consequence_attributed', 'legal_liability_established',
    'moral_blame_assigned', 'truth_certified', 'remote_canonicality_established',
    'universal_canonicality_established'
  ]) assert(claims[key] === false, `prohibited claim ${key}`);
  assert(observation.observation_id === await observationId(observation), 'observation ID substitution');
  return true;
}

async function observeGitHubActionsRuntime({ env = process.env, observedAt = new Date().toISOString(), eventBytes = null } = {}) {
  assert(env.GITHUB_ACTIONS === 'true', 'GITHUB_ACTIONS=true required; local/environment spoofing is outside this producer contract');
  const eventPath = envString(env, 'GITHUB_EVENT_PATH');
  const bytes = eventBytes === null ? fs.readFileSync(eventPath) : Buffer.from(eventBytes);
  assert(bytes.length > 0, 'GitHub event payload bytes required');
  const eventName = envString(env, 'GITHUB_EVENT_NAME');
  assert(ALLOWED_EVENTS.has(eventName), 'unsupported GitHub Actions event');
  const ref = envString(env, 'GITHUB_REF');
  validateEventRef(eventName, ref);
  const observation = {
    $schema: './github-actions-runtime-observation.schema.json',
    artifact_type: ARTIFACT_TYPE,
    artifact_version: ARTIFACT_VERSION,
    observation_id: '',
    observed_at: observedAt,
    producer_id: PRODUCER_ID,
    provider: 'github_actions',
    repository: envString(env, 'GITHUB_REPOSITORY'),
    workflow_name: envString(env, 'GITHUB_WORKFLOW'),
    event_name: eventName,
    run_id: envString(env, 'GITHUB_RUN_ID'),
    run_number: envString(env, 'GITHUB_RUN_NUMBER'),
    run_attempt: envString(env, 'GITHUB_RUN_ATTEMPT'),
    sha: envString(env, 'GITHUB_SHA'),
    ref,
    head_ref: nullableEnv(env, 'GITHUB_HEAD_REF'),
    base_ref: nullableEnv(env, 'GITHUB_BASE_REF'),
    server_url: envString(env, 'GITHUB_SERVER_URL'),
    event_payload_digest: rawDigest(bytes),
    context_class: eventName === 'pull_request' ? 'candidate_pull_request' : 'main_push',
    run_ref: `urn:github-actions:run:${env.GITHUB_RUN_ID}:attempt:${env.GITHUB_RUN_ATTEMPT}`,
    claims: {
      runtime_context_observed: true,
      event_payload_bytes_digest_bound: true,
      provider_identity_cryptographically_attested: false,
      github_remote_truth_certified: false,
      external_consequence_certified: false,
      causal_proof_certified: false,
      responsibility_for_consequence_attributed: false,
      legal_liability_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      remote_canonicality_established: false,
      universal_canonicality_established: false
    }
  };
  observation.observation_id = await observationId(observation);
  await validateRuntimeObservation(observation);
  return observation;
}

module.exports = {
  PRODUCER_ID,
  ARTIFACT_TYPE,
  ARTIFACT_VERSION,
  rawDigest,
  validateEventRef,
  validateRuntimeObservation,
  observeGitHubActionsRuntime
};
