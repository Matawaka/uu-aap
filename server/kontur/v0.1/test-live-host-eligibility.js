'use strict';

const fs = require('fs');
const path = require('path');
const Designation = require('./live-host-designation.js');
const Host = require('./live-host-eligibility.js');

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }

async function syntheticDesignation(overrides = {}) {
  return Designation.buildLiveHostDesignationDecision({
    declaredAt: overrides.declaredAt || '2026-08-24T08:44:59.000Z',
    designatorRef: overrides.designatorRef || 'human:reviewer:synthetic-live-host-designator',
    systemId: overrides.systemId || 'urn:uu-aap:kontur:system:server-responsibility',
    serverInstanceId: overrides.serverInstanceId || 'urn:uu-aap:kontur:server:reference-primary',
    hostId: overrides.hostId || 'urn:uu-aap:kontur:host:synthetic-human-designated-primary',
    repositoryRoot: overrides.repositoryRoot || 'C:\\KONTUR-LIVE\\uu-aap',
    durableLedgerRoot: overrides.durableLedgerRoot || 'C:\\ProgramData\\KONTUR\\responsibility-ledger',
    typedConfirmation: overrides.typedConfirmation || 'DESIGNATE_KONTUR_LIVE_HOST',
    nonce: overrides.nonce || 'urn:uu-aap:kontur:live-host-designation-nonce:synthetic-eligibility-fixture-001'
  });
}

async function main() {
  const expectedGitRevision = `git:${'a'.repeat(40)}`;
  const designation = await syntheticDesignation();
  await Designation.validateLiveHostDesignationDecision(designation);

  const profile = await Host.buildLiveHostProfile({
    createdAt: '2026-08-24T08:45:00.000Z',
    designationDecision: designation
  });
  await Host.validateLiveHostProfile(profile);
  assert(profile.human_designation_binding.artifact_ref === designation.decision_id,
    'profile must bind exact human designation decision');
  assert(profile.human_designation_evidence.decision_id === designation.decision_id,
    'profile must embed exact human designation evidence');
  assert(profile.operator_ref === designation.designator_ref,
    'profile operator_ref must derive from human designation');
  assert(profile.repository_root === designation.target.repository_root &&
    profile.durable_ledger_root === designation.target.durable_ledger_root,
    'profile paths must derive from explicit designation target');

  const baseEnvironment = {
    repositoryRoot: profile.repository_root,
    durableLedgerRoot: profile.durable_ledger_root,
    durableLedgerRootExists: true,
    durableLedgerRootReadable: true,
    durableLedgerRootWritable: true,
    durableLedgerRootOutsideRepository: true,
    ciEnvironmentDetected: false,
    temporarySandboxDetected: false,
    runtimeBoundary: 'host_local',
    processIdentity: 'SYNTHETIC-HOST\\interactive-user',
    workspaceRoot: profile.repository_root,
    observedGitRevision: expectedGitRevision
  };

  const eligible = await Host.evaluateLiveHostEligibility({
    profile, expectedGitRevision, observedAt: '2026-08-24T08:46:00.000Z', environment: baseEnvironment
  });
  assert(eligible.decision === 'live_host_eligible', 'eligible host must be admitted');
  assert(eligible.safe_next_step === 'live_preflight_may_be_attempted', 'eligible host may only advance to live preflight');
  assert(eligible.claims.live_host_eligibility_established === true, 'eligibility claim missing');
  assert(eligible.claims.live_preflight_may_be_attempted === true, 'preflight disposition missing');
  for (const key of [
    'execution_authority_granted', 'execute_command_created', 'kernel_activated',
    'responsibility_state_created', 'responsibility_accepted', 'durable_ledger_written',
    'permission_expansion_authorized', 'permission_bypass_authorized',
    'legal_authority_established', 'truth_certified', 'universal_canonicality_established'
  ]) assert(eligible.claims[key] === false, `eligible receipt must preserve non-effect ${key}`);
  await Host.validateLiveHostEligibilityReceipt({ receipt: eligible, profile });

  const vectors = [];
  vectors.push(await reject('legacy_raw_parameters_cannot_designate_host', () => Host.buildLiveHostProfile({
    createdAt: '2026-08-24T08:45:00.000Z',
    systemId: designation.target.system_id,
    serverInstanceId: designation.target.server_instance_id,
    hostId: designation.target.host_id,
    operatorRef: designation.designator_ref,
    repositoryRoot: designation.target.repository_root,
    durableLedgerRoot: designation.target.durable_ledger_root
  }), /object required|decision required|exact v0\.1 decision required/));

  vectors.push(await reject('wrong_typed_human_designation', () => syntheticDesignation({
    typedConfirmation: 'DESIGNATE_KONTUR_LIVE_HOST_NOW'
  }), /exact typed human confirmation required/));

  const tamperedDecision = clone(designation);
  tamperedDecision.target.host_id = 'urn:uu-aap:kontur:host:substituted';
  vectors.push(await reject('designation_decision_id_binding',
    () => Designation.validateLiveHostDesignationDecision(tamperedDecision),
    /deterministic decision ID mismatch/));

  const tamperedDecisionDeclarations = clone(designation);
  tamperedDecisionDeclarations.declarations.temporary_sandbox = true;
  vectors.push(await reject('designation_declaration_boundary',
    () => Designation.validateLiveHostDesignationDecision(tamperedDecisionDeclarations),
    /temporary sandbox cannot be designated/));

  const bindingTamper = clone(profile);
  bindingTamper.human_designation_binding.digest.value = '0'.repeat(64);
  vectors.push(await reject('designation_binding_substitution',
    () => Host.validateLiveHostProfile(bindingTamper),
    /human designation binding substitution/));

  const evidenceTamper = clone(profile);
  evidenceTamper.human_designation_evidence.designator_ref = 'human:reviewer:substituted';
  vectors.push(await reject('designation_evidence_substitution',
    () => Host.validateLiveHostProfile(evidenceTamper),
    /deterministic decision ID mismatch/));

  const profileTargetTamper = clone(profile);
  profileTargetTamper.repository_root = 'D:\\substituted-repository';
  vectors.push(await reject('profile_target_must_equal_designation',
    () => Host.validateLiveHostProfile(profileTargetTamper),
    /profile target differs from explicit human designation/));

  const profileDeclarationTamper = clone(profile);
  profileDeclarationTamper.declarations.repository_root_persistent = false;
  vectors.push(await reject('profile_declarations_must_equal_designation',
    () => Host.validateLiveHostProfile(profileDeclarationTamper),
    /profile declarations differ from explicit human designation/));

  const profilePredatesDesignation = clone(profile);
  profilePredatesDesignation.created_at = '2026-08-24T08:44:58.000Z';
  vectors.push(await reject('profile_cannot_predate_designation',
    () => Host.validateLiveHostProfile(profilePredatesDesignation),
    /profile cannot predate human designation/));

  const sandboxEnv = { ...baseEnvironment, temporarySandboxDetected: true, processIdentity: 'SYNTHETIC-HOST\\CodexSandboxOffline' };
  const sandbox = await Host.evaluateLiveHostEligibility({
    profile, expectedGitRevision, observedAt: '2026-08-24T08:46:01.000Z', environment: sandboxEnv
  });
  assert(sandbox.decision === 'live_host_ineligible' && sandbox.safe_next_step === 'stop_host_ineligible',
    'temporary sandbox must fail closed');
  assert(sandbox.claims.live_preflight_may_be_attempted === false, 'sandbox cannot advance to live preflight');

  const ci = await Host.evaluateLiveHostEligibility({
    profile, expectedGitRevision, observedAt: '2026-08-24T08:46:02.000Z',
    environment: { ...baseEnvironment, ciEnvironmentDetected: true, processIdentity: 'github-actions' }
  });
  assert(ci.decision === 'live_host_ineligible', 'CI must fail closed');

  const noLedger = await Host.evaluateLiveHostEligibility({
    profile, expectedGitRevision, observedAt: '2026-08-24T08:46:03.000Z',
    environment: { ...baseEnvironment, durableLedgerRootExists: false, durableLedgerRootReadable: false, durableLedgerRootWritable: false }
  });
  assert(noLedger.decision === 'live_host_ineligible', 'missing durable ledger root must fail closed');

  const revisionDrift = await Host.evaluateLiveHostEligibility({
    profile, expectedGitRevision, observedAt: '2026-08-24T08:46:04.000Z',
    environment: { ...baseEnvironment, observedGitRevision: `git:${'b'.repeat(40)}` }
  });
  assert(revisionDrift.decision === 'live_host_ineligible', 'Git revision drift must fail closed');

  const wrongRoot = await Host.evaluateLiveHostEligibility({
    profile, expectedGitRevision, observedAt: '2026-08-24T08:46:05.000Z',
    environment: { ...baseEnvironment, durableLedgerRoot: 'D:\\temporary-ledger' }
  });
  assert(wrongRoot.decision === 'live_host_ineligible', 'ledger-root substitution must fail closed');

  const tamperedProfile = clone(profile);
  tamperedProfile.durable_ledger_root = 'D:\\substituted';
  vectors.push(await reject('profile_designation_target_binding',
    () => Host.validateLiveHostProfile(tamperedProfile), /profile target differs from explicit human designation/));

  const inconsistentRoot = clone(eligible);
  inconsistentRoot.observations.observed_repository_root = 'D:\\substituted-repository';
  vectors.push(await reject('raw_repository_root_revalidation',
    () => Host.validateLiveHostEligibilityReceipt({ receipt: inconsistentRoot, profile }),
    /repository-root match flag inconsistent with raw observation/));

  const inconsistentRevision = clone(eligible);
  inconsistentRevision.observations.observed_git_revision = `git:${'b'.repeat(40)}`;
  vectors.push(await reject('raw_revision_revalidation',
    () => Host.validateLiveHostEligibilityReceipt({ receipt: inconsistentRevision, profile }),
    /Git revision match flag inconsistent with raw observation/));

  const tamperedReceipt = clone(eligible);
  tamperedReceipt.observations.process_identity = 'substituted-process';
  vectors.push(await reject('receipt_id_binding', () => Host.validateLiveHostEligibilityReceipt({ receipt: tamperedReceipt, profile }), /deterministic receipt ID mismatch/));

  const tamperedBinding = clone(eligible);
  tamperedBinding.host_profile_binding.digest.value = '0'.repeat(64);
  vectors.push(await reject('profile_binding', () => Host.validateLiveHostEligibilityReceipt({ receipt: tamperedBinding, profile }), /host profile binding substitution/));

  const outputDir = process.argv[2];
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    writeJson(path.join(outputDir, 'live-host-designation-decision.json'), designation);
    writeJson(path.join(outputDir, 'live-host-profile.json'), profile);
    writeJson(path.join(outputDir, 'live-host-eligibility.json'), eligible);
    writeJson(path.join(outputDir, 'sandbox-ineligible.json'), sandbox);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    designation_decision_id: designation.decision_id,
    profile_id: profile.profile_id,
    eligible_receipt_id: eligible.receipt_id,
    sandbox_decision: sandbox.decision,
    vectors: vectors.map((item) => item.name).concat([
      'ci', 'sandbox', 'missing-ledger', 'revision-drift', 'ledger-root-substitution'
    ])
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
