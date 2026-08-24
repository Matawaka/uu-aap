'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));
const Designation = require('./live-host-designation.js');

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Live Host Eligibility: invalid ${label}`);
  return ms;
}
function assertExactKeys(value, keys, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: object required`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  assert(actual.length === expected.length && actual.every((key, i) => key === expected[i]),
    `${label}: exact keys required`);
}
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}
function sameBinding(a, b) {
  return !!a && !!b && a.artifact_type === b.artifact_type && a.artifact_ref === b.artifact_ref &&
    a.digest && b.digest && a.digest.canonicalization === b.digest.canonicalization &&
    a.digest.digest_algorithm === b.digest.digest_algorithm && a.digest.digest_encoding === b.digest.digest_encoding &&
    a.digest.value === b.digest.value;
}
function sameDeclarations(a, b) {
  return !!a && !!b &&
    a.repository_root_persistent === b.repository_root_persistent &&
    a.durable_ledger_root_persistent === b.durable_ledger_root_persistent &&
    a.durable_ledger_root_outside_repository === b.durable_ledger_root_outside_repository &&
    a.ci_environment === b.ci_environment &&
    a.temporary_sandbox === b.temporary_sandbox;
}

const PROFILE_KEYS = [
  '$schema', 'artifact_type', 'artifact_version', 'profile_id', 'created_at',
  'human_designation_binding', 'human_designation_evidence',
  'system_id', 'server_instance_id', 'host_id', 'operator_ref', 'repository_full_name',
  'repository_root', 'durable_ledger_root', 'runtime_boundary', 'identity_assurance',
  'declarations', 'claims'
];
const DECLARATION_KEYS = [
  'repository_root_persistent', 'durable_ledger_root_persistent',
  'durable_ledger_root_outside_repository', 'ci_environment', 'temporary_sandbox'
];
const PROFILE_CLAIM_KEYS = [
  'live_host_designated', 'live_host_eligibility_established', 'execution_authority_granted',
  'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
  'permission_expansion_authorized', 'permission_bypass_authorized',
  'legal_authority_established', 'truth_certified', 'universal_canonicality_established'
];
const OBSERVATION_KEYS = [
  'observed_repository_root', 'observed_durable_ledger_root',
  'repository_root_matches_profile', 'durable_ledger_root_matches_profile',
  'durable_ledger_root_exists', 'durable_ledger_root_readable', 'durable_ledger_root_writable',
  'durable_ledger_root_outside_repository', 'current_git_revision_exact',
  'ci_environment_detected', 'temporary_sandbox_detected', 'runtime_boundary',
  'process_identity', 'workspace_root', 'observed_git_revision'
];
const RECEIPT_CLAIM_KEYS = [
  'host_profile_bound', 'live_host_eligibility_established', 'live_preflight_may_be_attempted',
  'execution_authority_granted', 'execute_command_created', 'kernel_activated',
  'responsibility_state_created', 'responsibility_accepted', 'durable_ledger_written',
  'permission_expansion_authorized', 'permission_bypass_authorized',
  'legal_authority_established', 'truth_certified', 'universal_canonicality_established'
];
const RECEIPT_KEYS = [
  '$schema', 'artifact_type', 'artifact_version', 'receipt_id', 'observed_at',
  'expected_git_revision', 'host_profile_binding', 'host_id', 'system_id',
  'server_instance_id', 'observations', 'decision', 'safe_next_step', 'claims'
];

function profileIdentitySeed(profile) {
  return {
    artifact_type: 'KONTURLiveHostProfileIdentitySeed',
    artifact_version: '0.1',
    created_at: profile.created_at,
    human_designation_binding: profile.human_designation_binding,
    system_id: profile.system_id,
    server_instance_id: profile.server_instance_id,
    host_id: profile.host_id,
    operator_ref: profile.operator_ref,
    repository_full_name: profile.repository_full_name,
    repository_root: profile.repository_root,
    durable_ledger_root: profile.durable_ledger_root,
    runtime_boundary: profile.runtime_boundary,
    identity_assurance: profile.identity_assurance,
    declarations: profile.declarations
  };
}

async function validateLiveHostProfile(profile) {
  const label = 'KONTUR Live Host Profile';
  assertExactKeys(profile, PROFILE_KEYS, label);
  assert(/(^|.*\/)kontur-live-host-profile\.schema\.json$/.test(profile.$schema), `${label}: schema mismatch`);
  assert(profile.artifact_type === 'KONTURLiveHostProfile' && profile.artifact_version === '0.1', `${label}: exact v0.1 profile required`);
  const createdMs = parseTime(profile.created_at, 'profile created_at');

  const designation = profile.human_designation_evidence;
  await Designation.validateLiveHostDesignationDecision(designation);
  const designationBinding = await Designation.designationBinding(designation);
  assert(sameBinding(profile.human_designation_binding, designationBinding),
    `${label}: human designation binding substitution`);
  assert(parseTime(designation.declared_at, 'designation declared_at') <= createdMs,
    `${label}: profile cannot predate human designation`);

  assert(/^urn:uu-aap:kontur:system:/.test(profile.system_id || ''), `${label}: system_id required`);
  assert(/^urn:uu-aap:kontur:server:/.test(profile.server_instance_id || ''), `${label}: server_instance_id required`);
  assert(/^urn:uu-aap:kontur:host:/.test(profile.host_id || ''), `${label}: host_id required`);
  assert(typeof profile.operator_ref === 'string' && profile.operator_ref.length > 0, `${label}: operator_ref required`);
  assert(profile.repository_full_name === 'Matawaka/uu-aap', `${label}: canonical repository required`);
  assert(typeof profile.repository_root === 'string' && profile.repository_root.length > 0, `${label}: repository_root required`);
  assert(typeof profile.durable_ledger_root === 'string' && profile.durable_ledger_root.length > 0, `${label}: durable_ledger_root required`);
  assert(profile.repository_root !== profile.durable_ledger_root, `${label}: repository and durable ledger roots must differ`);
  assert(profile.runtime_boundary === 'host_local', `${label}: v0.1 permits only host_local runtime boundary`);
  assert(profile.identity_assurance === 'human_designated_not_cryptographically_verified', `${label}: identity assurance mismatch`);

  assert(profile.system_id === designation.target.system_id &&
    profile.server_instance_id === designation.target.server_instance_id &&
    profile.host_id === designation.target.host_id &&
    profile.operator_ref === designation.target.operator_ref &&
    profile.repository_full_name === designation.target.repository_full_name &&
    profile.repository_root === designation.target.repository_root &&
    profile.durable_ledger_root === designation.target.durable_ledger_root &&
    profile.runtime_boundary === designation.target.runtime_boundary,
    `${label}: profile target differs from explicit human designation`);

  assertExactKeys(profile.declarations, DECLARATION_KEYS, `${label}: declarations`);
  assert(sameDeclarations(profile.declarations, designation.declarations),
    `${label}: profile declarations differ from explicit human designation`);
  assert(profile.declarations.repository_root_persistent === true, `${label}: persistent repository declaration required`);
  assert(profile.declarations.durable_ledger_root_persistent === true, `${label}: persistent durable ledger declaration required`);
  assert(profile.declarations.durable_ledger_root_outside_repository === true, `${label}: ledger must be declared outside repository`);
  assert(profile.declarations.ci_environment === false, `${label}: CI cannot be designated as live host`);
  assert(profile.declarations.temporary_sandbox === false, `${label}: temporary sandbox cannot be designated as live host`);

  assertExactKeys(profile.claims, PROFILE_CLAIM_KEYS, `${label}: claims`);
  assert(profile.claims.live_host_designated === true, `${label}: designation claim required`);
  for (const key of PROFILE_CLAIM_KEYS.filter((key) => key !== 'live_host_designated')) {
    assert(profile.claims[key] === false, `${label}: prohibited positive claim ${key}`);
  }
  const expected = `urn:uu-aap:kontur:live-host-profile:${(await digestJson(profileIdentitySeed(profile))).slice(0, 24)}`;
  assert(profile.profile_id === expected, `${label}: deterministic profile ID mismatch`);
  return true;
}

async function buildLiveHostProfile({ createdAt, designationDecision }) {
  parseTime(createdAt, 'profile created_at');
  await Designation.validateLiveHostDesignationDecision(designationDecision);
  const designationBinding = await Designation.designationBinding(designationDecision);
  const target = designationDecision.target;
  const profile = {
    $schema: './kontur-live-host-profile.schema.json',
    artifact_type: 'KONTURLiveHostProfile', artifact_version: '0.1', profile_id: '',
    created_at: createdAt,
    human_designation_binding: designationBinding,
    human_designation_evidence: clone(designationDecision),
    system_id: target.system_id,
    server_instance_id: target.server_instance_id,
    host_id: target.host_id,
    operator_ref: target.operator_ref,
    repository_full_name: target.repository_full_name,
    repository_root: target.repository_root,
    durable_ledger_root: target.durable_ledger_root,
    runtime_boundary: target.runtime_boundary,
    identity_assurance: 'human_designated_not_cryptographically_verified',
    declarations: clone(designationDecision.declarations),
    claims: {
      live_host_designated: true,
      live_host_eligibility_established: false,
      execution_authority_granted: false,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      permission_expansion_authorized: false,
      permission_bypass_authorized: false,
      legal_authority_established: false,
      truth_certified: false,
      universal_canonicality_established: false
    }
  };
  profile.profile_id = `urn:uu-aap:kontur:live-host-profile:${(await digestJson(profileIdentitySeed(profile))).slice(0, 24)}`;
  await validateLiveHostProfile(profile);
  return profile;
}

function normalizeEnvironment(environment) {
  assertExactKeys(environment, [
    'repositoryRoot', 'durableLedgerRoot', 'durableLedgerRootExists',
    'durableLedgerRootReadable', 'durableLedgerRootWritable',
    'durableLedgerRootOutsideRepository', 'ciEnvironmentDetected',
    'temporarySandboxDetected', 'runtimeBoundary', 'processIdentity',
    'workspaceRoot', 'observedGitRevision'
  ], 'KONTUR Live Host Eligibility: environment');
  assert(typeof environment.repositoryRoot === 'string' && environment.repositoryRoot.length > 0,
    'KONTUR Live Host Eligibility: observed repository root required');
  assert(typeof environment.durableLedgerRoot === 'string' && environment.durableLedgerRoot.length > 0,
    'KONTUR Live Host Eligibility: observed durable ledger root required');
  assert(/^git:[0-9a-f]{40}$/.test(environment.observedGitRevision || ''),
    'KONTUR Live Host Eligibility: exact observed Git revision required');
  assert(['host_local', 'unknown'].includes(environment.runtimeBoundary),
    'KONTUR Live Host Eligibility: invalid runtime boundary observation');
  assert(typeof environment.processIdentity === 'string' && environment.processIdentity.length > 0,
    'KONTUR Live Host Eligibility: process identity observation required');
  assert(typeof environment.workspaceRoot === 'string' && environment.workspaceRoot.length > 0,
    'KONTUR Live Host Eligibility: workspace root observation required');
  return environment;
}

function eligibilityFromObservations(observations) {
  return observations.repository_root_matches_profile === true &&
    observations.durable_ledger_root_matches_profile === true &&
    observations.durable_ledger_root_exists === true &&
    observations.durable_ledger_root_readable === true &&
    observations.durable_ledger_root_writable === true &&
    observations.durable_ledger_root_outside_repository === true &&
    observations.current_git_revision_exact === true &&
    observations.ci_environment_detected === false &&
    observations.temporary_sandbox_detected === false &&
    observations.runtime_boundary === 'host_local' &&
    observations.workspace_root === observations.observed_repository_root;
}

function receiptIdentitySeed(receipt) {
  return {
    artifact_type: 'KONTURLiveHostEligibilityReceiptIdentitySeed',
    artifact_version: '0.1',
    observed_at: receipt.observed_at,
    expected_git_revision: receipt.expected_git_revision,
    host_profile_binding: receipt.host_profile_binding,
    observations: receipt.observations,
    decision: receipt.decision
  };
}

async function evaluateLiveHostEligibility({ profile, expectedGitRevision, observedAt, environment }) {
  await validateLiveHostProfile(profile);
  parseTime(observedAt, 'eligibility observed_at');
  assert(/^git:[0-9a-f]{40}$/.test(expectedGitRevision || ''),
    'KONTUR Live Host Eligibility: exact expected Git revision required');
  normalizeEnvironment(environment);

  const observations = {
    observed_repository_root: environment.repositoryRoot,
    observed_durable_ledger_root: environment.durableLedgerRoot,
    repository_root_matches_profile: environment.repositoryRoot === profile.repository_root,
    durable_ledger_root_matches_profile: environment.durableLedgerRoot === profile.durable_ledger_root,
    durable_ledger_root_exists: environment.durableLedgerRootExists === true,
    durable_ledger_root_readable: environment.durableLedgerRootReadable === true,
    durable_ledger_root_writable: environment.durableLedgerRootWritable === true,
    durable_ledger_root_outside_repository: environment.durableLedgerRootOutsideRepository === true,
    current_git_revision_exact: environment.observedGitRevision === expectedGitRevision,
    ci_environment_detected: environment.ciEnvironmentDetected === true,
    temporary_sandbox_detected: environment.temporarySandboxDetected === true,
    runtime_boundary: environment.runtimeBoundary,
    process_identity: environment.processIdentity,
    workspace_root: environment.workspaceRoot,
    observed_git_revision: environment.observedGitRevision
  };
  const eligible = eligibilityFromObservations(observations);
  const profileBinding = await binding('KONTURLiveHostProfile', profile.profile_id, profile);
  const receipt = {
    $schema: './kontur-live-host-eligibility.schema.json',
    artifact_type: 'KONTURLiveHostEligibilityReceipt', artifact_version: '0.1', receipt_id: '',
    observed_at: observedAt, expected_git_revision: expectedGitRevision,
    host_profile_binding: profileBinding, host_id: profile.host_id,
    system_id: profile.system_id, server_instance_id: profile.server_instance_id,
    observations,
    decision: eligible ? 'live_host_eligible' : 'live_host_ineligible',
    safe_next_step: eligible ? 'live_preflight_may_be_attempted' : 'stop_host_ineligible',
    claims: {
      host_profile_bound: true,
      live_host_eligibility_established: eligible,
      live_preflight_may_be_attempted: eligible,
      execution_authority_granted: false,
      execute_command_created: false,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      durable_ledger_written: false,
      permission_expansion_authorized: false,
      permission_bypass_authorized: false,
      legal_authority_established: false,
      truth_certified: false,
      universal_canonicality_established: false
    }
  };
  receipt.receipt_id = `urn:uu-aap:kontur:live-host-eligibility:${(await digestJson(receiptIdentitySeed(receipt))).slice(0, 24)}`;
  await validateLiveHostEligibilityReceipt({ receipt, profile });
  return receipt;
}

async function validateLiveHostEligibilityReceipt({ receipt, profile }) {
  await validateLiveHostProfile(profile);
  const label = 'KONTUR Live Host Eligibility Receipt';
  assertExactKeys(receipt, RECEIPT_KEYS, label);
  assert(/(^|.*\/)kontur-live-host-eligibility\.schema\.json$/.test(receipt.$schema), `${label}: schema mismatch`);
  assert(receipt.artifact_type === 'KONTURLiveHostEligibilityReceipt' && receipt.artifact_version === '0.1',
    `${label}: exact v0.1 receipt required`);
  parseTime(receipt.observed_at, 'eligibility observed_at');
  assert(/^git:[0-9a-f]{40}$/.test(receipt.expected_git_revision || ''), `${label}: exact expected Git revision required`);
  assert(receipt.host_id === profile.host_id && receipt.system_id === profile.system_id &&
    receipt.server_instance_id === profile.server_instance_id, `${label}: profile identity drift`);
  const expectedProfileBinding = await binding('KONTURLiveHostProfile', profile.profile_id, profile);
  assert(sameBinding(receipt.host_profile_binding, expectedProfileBinding), `${label}: host profile binding substitution`);
  assertExactKeys(receipt.observations, OBSERVATION_KEYS, `${label}: observations`);
  assert(receipt.observations.repository_root_matches_profile ===
    (receipt.observations.observed_repository_root === profile.repository_root),
    `${label}: repository-root match flag inconsistent with raw observation`);
  assert(receipt.observations.durable_ledger_root_matches_profile ===
    (receipt.observations.observed_durable_ledger_root === profile.durable_ledger_root),
    `${label}: ledger-root match flag inconsistent with raw observation`);
  assert(receipt.observations.current_git_revision_exact ===
    (receipt.observations.observed_git_revision === receipt.expected_git_revision),
    `${label}: Git revision match flag inconsistent with raw observation`);
  assertExactKeys(receipt.claims, RECEIPT_CLAIM_KEYS, `${label}: claims`);
  assert(receipt.claims.host_profile_bound === true, `${label}: host profile bound claim required`);
  for (const key of RECEIPT_CLAIM_KEYS.filter((key) => ![
    'host_profile_bound', 'live_host_eligibility_established', 'live_preflight_may_be_attempted'
  ].includes(key))) assert(receipt.claims[key] === false, `${label}: prohibited positive claim ${key}`);

  const eligible = eligibilityFromObservations(receipt.observations);
  assert(receipt.decision === (eligible ? 'live_host_eligible' : 'live_host_ineligible'), `${label}: decision mismatch`);
  assert(receipt.safe_next_step === (eligible ? 'live_preflight_may_be_attempted' : 'stop_host_ineligible'), `${label}: safe next step mismatch`);
  assert(receipt.claims.live_host_eligibility_established === eligible &&
    receipt.claims.live_preflight_may_be_attempted === eligible, `${label}: eligibility claims mismatch`);
  const expectedId = `urn:uu-aap:kontur:live-host-eligibility:${(await digestJson(receiptIdentitySeed(receipt))).slice(0, 24)}`;
  assert(receipt.receipt_id === expectedId, `${label}: deterministic receipt ID mismatch`);
  return true;
}

module.exports = {
  digestJson,
  buildLiveHostProfile,
  validateLiveHostProfile,
  evaluateLiveHostEligibility,
  validateLiveHostEligibilityReceipt
};
