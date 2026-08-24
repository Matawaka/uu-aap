'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

function assert(value, message) { if (!value) throw new Error(message); }
function parseTime(value, label) {
  const ms = Date.parse(value);
  assert(Number.isFinite(ms), `KONTUR Live Host Designation: invalid ${label}`);
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

const DECISION_KEYS = [
  '$schema', 'artifact_type', 'artifact_version', 'decision_id', 'declared_at',
  'designator_ref', 'decision', 'target', 'declarations', 'human_declaration', 'safe_effect', 'claims'
];
const TARGET_KEYS = [
  'system_id', 'server_instance_id', 'host_id', 'operator_ref', 'repository_full_name',
  'repository_root', 'durable_ledger_root', 'runtime_boundary'
];
const HOST_DECLARATION_KEYS = [
  'repository_root_persistent', 'durable_ledger_root_persistent',
  'durable_ledger_root_outside_repository', 'ci_environment', 'temporary_sandbox'
];
const HUMAN_DECLARATION_KEYS = [
  'declaration_type', 'typed_confirmation', 'nonce', 'explicit', 'identity_assurance'
];
const CLAIM_KEYS = [
  'human_live_host_designation_recorded', 'live_host_profile_may_be_built',
  'live_host_profile_created', 'live_host_eligibility_established',
  'execution_authority_granted', 'execute_command_created', 'kernel_activated',
  'responsibility_state_created', 'responsibility_accepted', 'durable_ledger_written',
  'permission_expansion_authorized', 'permission_bypass_authorized',
  'legal_authority_established', 'truth_certified', 'universal_canonicality_established'
];

function decisionIdentitySeed(decision) {
  return {
    artifact_type: 'KONTURLiveHostDesignationDecisionIdentitySeed',
    artifact_version: '0.1',
    declared_at: decision.declared_at,
    designator_ref: decision.designator_ref,
    decision: decision.decision,
    target: decision.target,
    declarations: decision.declarations,
    human_declaration: decision.human_declaration
  };
}

async function validateLiveHostDesignationDecision(decision) {
  const label = 'KONTUR Live Host Designation Decision';
  assertExactKeys(decision, DECISION_KEYS, label);
  assert(/(^|.*\/)kontur-live-host-designation-decision\.schema\.json$/.test(decision.$schema),
    `${label}: schema mismatch`);
  assert(decision.artifact_type === 'KONTURLiveHostDesignationDecision' && decision.artifact_version === '0.1',
    `${label}: exact v0.1 decision required`);
  parseTime(decision.declared_at, 'declared_at');
  assert(typeof decision.designator_ref === 'string' && decision.designator_ref.length > 0,
    `${label}: designator_ref required`);
  assert(decision.decision === 'designate_live_host', `${label}: positive explicit designation required`);

  assertExactKeys(decision.target, TARGET_KEYS, `${label}: target`);
  assert(/^urn:uu-aap:kontur:system:/.test(decision.target.system_id || ''), `${label}: system_id required`);
  assert(/^urn:uu-aap:kontur:server:/.test(decision.target.server_instance_id || ''), `${label}: server_instance_id required`);
  assert(/^urn:uu-aap:kontur:host:/.test(decision.target.host_id || ''), `${label}: host_id required`);
  assert(typeof decision.target.operator_ref === 'string' && decision.target.operator_ref.length > 0,
    `${label}: designated operator_ref required`);
  assert(decision.target.repository_full_name === 'Matawaka/uu-aap', `${label}: canonical repository required`);
  assert(typeof decision.target.repository_root === 'string' && decision.target.repository_root.length > 0,
    `${label}: repository_root required`);
  assert(typeof decision.target.durable_ledger_root === 'string' && decision.target.durable_ledger_root.length > 0,
    `${label}: durable_ledger_root required`);
  assert(decision.target.repository_root !== decision.target.durable_ledger_root,
    `${label}: repository and durable ledger roots must differ`);
  assert(decision.target.runtime_boundary === 'host_local', `${label}: host_local target required`);

  assertExactKeys(decision.declarations, HOST_DECLARATION_KEYS, `${label}: declarations`);
  assert(decision.declarations.repository_root_persistent === true,
    `${label}: persistent repository declaration required`);
  assert(decision.declarations.durable_ledger_root_persistent === true,
    `${label}: persistent durable ledger declaration required`);
  assert(decision.declarations.durable_ledger_root_outside_repository === true,
    `${label}: ledger-outside-repository declaration required`);
  assert(decision.declarations.ci_environment === false,
    `${label}: CI environment cannot be designated`);
  assert(decision.declarations.temporary_sandbox === false,
    `${label}: temporary sandbox cannot be designated`);

  assertExactKeys(decision.human_declaration, HUMAN_DECLARATION_KEYS, `${label}: human_declaration`);
  assert(decision.human_declaration.declaration_type === 'explicit_live_host_designation',
    `${label}: declaration type mismatch`);
  assert(decision.human_declaration.typed_confirmation === 'DESIGNATE_KONTUR_LIVE_HOST',
    `${label}: exact typed confirmation required`);
  assert(typeof decision.human_declaration.nonce === 'string' &&
    /^urn:uu-aap:kontur:live-host-designation-nonce:[A-Za-z0-9._:-]+$/.test(decision.human_declaration.nonce),
    `${label}: designation nonce required`);
  assert(decision.human_declaration.explicit === true, `${label}: explicit human declaration required`);
  assert(decision.human_declaration.identity_assurance === 'declared_not_cryptographically_verified',
    `${label}: identity assurance mismatch`);
  assert(decision.safe_effect === 'live_host_profile_may_be_built', `${label}: safe effect mismatch`);

  assertExactKeys(decision.claims, CLAIM_KEYS, `${label}: claims`);
  assert(decision.claims.human_live_host_designation_recorded === true,
    `${label}: human designation claim required`);
  assert(decision.claims.live_host_profile_may_be_built === true,
    `${label}: profile-build disposition required`);
  for (const key of CLAIM_KEYS.filter((key) => ![
    'human_live_host_designation_recorded', 'live_host_profile_may_be_built'
  ].includes(key))) {
    assert(decision.claims[key] === false, `${label}: prohibited positive claim ${key}`);
  }

  const expectedId = `urn:uu-aap:kontur:live-host-designation-decision:${
    (await digestJson(decisionIdentitySeed(decision))).slice(0, 24)
  }`;
  assert(decision.decision_id === expectedId, `${label}: deterministic decision ID mismatch`);
  return true;
}

async function buildLiveHostDesignationDecision({
  declaredAt, designatorRef, systemId, serverInstanceId, hostId, operatorRef,
  repositoryRoot, durableLedgerRoot, typedConfirmation, nonce
}) {
  parseTime(declaredAt, 'declared_at');
  assert(typedConfirmation === 'DESIGNATE_KONTUR_LIVE_HOST',
    'KONTUR Live Host Designation: exact typed human confirmation required');
  assert(typeof nonce === 'string' &&
    /^urn:uu-aap:kontur:live-host-designation-nonce:[A-Za-z0-9._:-]+$/.test(nonce),
    'KONTUR Live Host Designation: designation nonce required');

  const decision = {
    $schema: './kontur-live-host-designation-decision.schema.json',
    artifact_type: 'KONTURLiveHostDesignationDecision',
    artifact_version: '0.1',
    decision_id: '',
    declared_at: declaredAt,
    designator_ref: designatorRef,
    decision: 'designate_live_host',
    target: {
      system_id: systemId,
      server_instance_id: serverInstanceId,
      host_id: hostId,
      operator_ref: operatorRef,
      repository_full_name: 'Matawaka/uu-aap',
      repository_root: repositoryRoot,
      durable_ledger_root: durableLedgerRoot,
      runtime_boundary: 'host_local'
    },
    declarations: {
      repository_root_persistent: true,
      durable_ledger_root_persistent: true,
      durable_ledger_root_outside_repository: true,
      ci_environment: false,
      temporary_sandbox: false
    },
    human_declaration: {
      declaration_type: 'explicit_live_host_designation',
      typed_confirmation: typedConfirmation,
      nonce,
      explicit: true,
      identity_assurance: 'declared_not_cryptographically_verified'
    },
    safe_effect: 'live_host_profile_may_be_built',
    claims: {
      human_live_host_designation_recorded: true,
      live_host_profile_may_be_built: true,
      live_host_profile_created: false,
      live_host_eligibility_established: false,
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
  decision.decision_id = `urn:uu-aap:kontur:live-host-designation-decision:${
    (await digestJson(decisionIdentitySeed(decision))).slice(0, 24)
  }`;
  await validateLiveHostDesignationDecision(decision);
  return decision;
}

async function designationBinding(decision) {
  await validateLiveHostDesignationDecision(decision);
  return {
    artifact_type: 'KONTURLiveHostDesignationDecision',
    artifact_ref: decision.decision_id,
    digest: digest(await digestJson(decision))
  };
}

module.exports = {
  digestJson,
  buildLiveHostDesignationDecision,
  validateLiveHostDesignationDecision,
  designationBinding
};
