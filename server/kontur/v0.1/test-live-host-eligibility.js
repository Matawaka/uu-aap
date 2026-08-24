'use strict';

const fs = require('fs');
const path = require('path');
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

async function main() {
  const expectedGitRevision = `git:${'a'.repeat(40)}`;
  const profile = await Host.buildLiveHostProfile({
    createdAt: '2026-08-24T08:45:00.000Z',
    systemId: 'urn:uu-aap:kontur:system:server-responsibility',
    serverInstanceId: 'urn:uu-aap:kontur:server:reference-primary',
    hostId: 'urn:uu-aap:kontur:host:human-designated-primary',
    operatorRef: 'human:reviewer:Matawaka',
    repositoryRoot: 'C:\\KONTUR-LIVE\\uu-aap',
    durableLedgerRoot: 'C:\\ProgramData\\KONTUR\\responsibility-ledger'
  });
  await Host.validateLiveHostProfile(profile);

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
    processIdentity: 'DESKTOP-D4N4RCN\\interactive-user',
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

  const sandboxEnv = { ...baseEnvironment, temporarySandboxDetected: true, processIdentity: 'DESKTOP-D4N4RCN\\CodexSandboxOffline' };
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
  await reject('profile_id_binding', () => Host.validateLiveHostProfile(tamperedProfile), /deterministic profile ID mismatch/);

  const inconsistentRoot = clone(eligible);
  inconsistentRoot.observations.observed_repository_root = 'D:\\substituted-repository';
  await reject('raw_repository_root_revalidation',
    () => Host.validateLiveHostEligibilityReceipt({ receipt: inconsistentRoot, profile }),
    /repository-root match flag inconsistent with raw observation/);

  const inconsistentRevision = clone(eligible);
  inconsistentRevision.observations.observed_git_revision = `git:${'b'.repeat(40)}`;
  await reject('raw_revision_revalidation',
    () => Host.validateLiveHostEligibilityReceipt({ receipt: inconsistentRevision, profile }),
    /Git revision match flag inconsistent with raw observation/);

  const tamperedReceipt = clone(eligible);
  tamperedReceipt.observations.process_identity = 'substituted-process';
  await reject('receipt_id_binding', () => Host.validateLiveHostEligibilityReceipt({ receipt: tamperedReceipt, profile }), /deterministic receipt ID mismatch/);

  const tamperedBinding = clone(eligible);
  tamperedBinding.host_profile_binding.digest.value = '0'.repeat(64);
  await reject('profile_binding', () => Host.validateLiveHostEligibilityReceipt({ receipt: tamperedBinding, profile }), /host profile binding substitution/);

  const outputDir = process.argv[2];
  if (outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    writeJson(path.join(outputDir, 'live-host-profile.json'), profile);
    writeJson(path.join(outputDir, 'live-host-eligibility.json'), eligible);
    writeJson(path.join(outputDir, 'sandbox-ineligible.json'), sandbox);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    eligible_receipt_id: eligible.receipt_id,
    sandbox_decision: sandbox.decision,
    vectors: [
      'ci', 'sandbox', 'missing-ledger', 'revision-drift', 'ledger-root-substitution',
      'profile-id-binding', 'raw-repository-root-revalidation', 'raw-revision-revalidation',
      'receipt-id-binding', 'profile-binding'
    ]
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
