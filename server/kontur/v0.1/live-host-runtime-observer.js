'use strict';

const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Host = require('./live-host-eligibility.js');

function assert(value, message) { if (!value) throw new Error(message); }
function envFlag(value) {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== '' && !['0', 'false', 'no', 'off', 'null', 'undefined'].includes(normalized);
}
function isWithin(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}
function realPath(value, label) {
  try { return fs.realpathSync(value); }
  catch (error) { throw new Error(`KONTUR Live Host Runtime Observer: cannot resolve ${label}: ${error.message}`); }
}
function git(repositoryRoot, args) {
  const result = cp.spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.error || result.status !== 0) {
    const detail = result.error ? result.error.message : (result.stderr || '').trim();
    throw new Error(`KONTUR Live Host Runtime Observer: Git observation failed: ${detail || 'unknown error'}`);
  }
  return (result.stdout || '').trim();
}
function processIdentity() {
  const username = os.userInfo().username;
  return `${os.hostname()}\\${username}`;
}
function detectCi(environment = process.env) {
  return [
    'CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI',
    'TF_BUILD', 'JENKINS_URL', 'TEAMCITY_VERSION'
  ].some((key) => envFlag(environment[key]));
}
function detectTemporarySandbox({ identity, repositoryRoot, environment = process.env }) {
  if ([
    'KONTUR_TEMPORARY_SANDBOX', 'CODEX_SANDBOX', 'CODEX_SANDBOX_OFFLINE',
    'OPENAI_SANDBOX', 'CHATGPT_SANDBOX', 'SANDBOX'
  ].some((key) => envFlag(environment[key]))) return true;
  const markers = [
    identity,
    repositoryRoot,
    environment.USERPROFILE || '',
    environment.HOME || '',
    environment.CODEX_HOME || ''
  ].join('\n');
  return /codexsandboxoffline|temporary[-_ ]?sandbox|\\sandbox(?:\\|$)|\/sandbox(?:\/|$)/i.test(markers);
}
function access(value, mode) {
  try { fs.accessSync(value, mode); return true; }
  catch (_) { return false; }
}

function observeLiveHostEnvironment({ profile, ledgerRoot = null, environment = process.env }) {
  assert(profile && typeof profile.repository_root === 'string' && profile.repository_root.length > 0,
    'KONTUR Live Host Runtime Observer: profile repository_root required');
  assert(typeof profile.durable_ledger_root === 'string' && profile.durable_ledger_root.length > 0,
    'KONTUR Live Host Runtime Observer: profile durable_ledger_root required');

  const requestedLedgerRoot = ledgerRoot === null || ledgerRoot === undefined
    ? profile.durable_ledger_root
    : ledgerRoot;
  assert(typeof requestedLedgerRoot === 'string' && requestedLedgerRoot.length > 0,
    'KONTUR Live Host Runtime Observer: ledgerRoot required');

  const repositoryRoot = realPath(profile.repository_root, 'repository root');
  const gitTopLevel = realPath(git(repositoryRoot, ['rev-parse', '--show-toplevel']), 'Git top-level');
  assert(gitTopLevel === repositoryRoot,
    'KONTUR Live Host Runtime Observer: profile repository root is not exact Git top-level');

  const sha = git(repositoryRoot, ['rev-parse', 'HEAD']);
  assert(/^[0-9a-f]{40}$/.test(sha),
    'KONTUR Live Host Runtime Observer: exact Git HEAD required');

  const ledgerExists = fs.existsSync(requestedLedgerRoot);
  let durableLedgerRoot = path.resolve(requestedLedgerRoot);
  let outsideRepository = false;
  if (ledgerExists) {
    durableLedgerRoot = realPath(requestedLedgerRoot, 'durable ledger root');
    outsideRepository = !isWithin(repositoryRoot, durableLedgerRoot);
  }

  const identity = processIdentity();
  const ci = detectCi(environment);
  const sandbox = detectTemporarySandbox({ identity, repositoryRoot, environment });

  return {
    repositoryRoot,
    durableLedgerRoot,
    durableLedgerRootExists: ledgerExists,
    durableLedgerRootReadable: ledgerExists && access(durableLedgerRoot, fs.constants.R_OK),
    durableLedgerRootWritable: ledgerExists && access(durableLedgerRoot, fs.constants.W_OK),
    durableLedgerRootOutsideRepository: ledgerExists && outsideRepository,
    ciEnvironmentDetected: ci,
    temporarySandboxDetected: sandbox,
    runtimeBoundary: ci || sandbox ? 'unknown' : 'host_local',
    processIdentity: identity,
    workspaceRoot: gitTopLevel,
    observedGitRevision: `git:${sha}`
  };
}

async function observeAndEvaluateLiveHostEligibility({
  profile, expectedGitRevision, observedAt, ledgerRoot = null, environment = process.env
}) {
  const observedEnvironment = observeLiveHostEnvironment({ profile, ledgerRoot, environment });
  return Host.evaluateLiveHostEligibility({
    profile,
    expectedGitRevision,
    observedAt,
    environment: observedEnvironment
  });
}

async function assertRuntimeMatchesEligibilityReceipt({
  profile, receipt, expectedGitRevision, ledgerRoot = null, environment = process.env
}) {
  await Host.validateLiveHostProfile(profile);
  await Host.validateLiveHostEligibilityReceipt({ receipt, profile });
  assert(receipt.expected_git_revision === expectedGitRevision,
    'KONTUR Live Host Runtime Observer: eligibility expected Git revision drift');

  const reconstructed = await observeAndEvaluateLiveHostEligibility({
    profile,
    expectedGitRevision,
    observedAt: receipt.observed_at,
    ledgerRoot,
    environment
  });
  assert(reconstructed.decision === 'live_host_eligible' &&
    reconstructed.safe_next_step === 'live_preflight_may_be_attempted',
    'KONTUR Live Host Runtime Observer: current runtime is not live-host eligible');

  const expectedDigest = await Host.digestJson(receipt);
  const reconstructedDigest = await Host.digestJson(reconstructed);
  assert(reconstructedDigest === expectedDigest,
    'KONTUR Live Host Runtime Observer: runtime re-observation differs from bound eligibility receipt');

  return {
    matched: true,
    reconstructed_receipt_id: reconstructed.receipt_id,
    observed_environment: observedLiveHostEnvironmentSummary(reconstructed.observations)
  };
}

function observedLiveHostEnvironmentSummary(observations) {
  return {
    observed_repository_root: observations.observed_repository_root,
    observed_durable_ledger_root: observations.observed_durable_ledger_root,
    observed_git_revision: observations.observed_git_revision,
    ci_environment_detected: observations.ci_environment_detected,
    temporary_sandbox_detected: observations.temporary_sandbox_detected,
    runtime_boundary: observations.runtime_boundary,
    process_identity: observations.process_identity,
    workspace_root: observations.workspace_root
  };
}

module.exports = {
  detectCi,
  detectTemporarySandbox,
  observeLiveHostEnvironment,
  observeAndEvaluateLiveHostEligibility,
  assertRuntimeMatchesEligibilityReceipt
};
