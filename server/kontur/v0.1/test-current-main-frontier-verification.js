'use strict';

const assert = require('assert');
const Verifier = require('./verify-current-main-frontier.js');

const SHA = '3e03fda0c93c91faaa58ddbb4e328aa65558647f';
const OTHER_SHA = '1111111111111111111111111111111111111111';
const VERIFIED_AT = '2026-08-23T18:20:00.000Z';

function frontier(overrides = {}) {
  const base = {
    $schema: './kontur-activation-frontier.schema.json',
    artifact_type: 'KONTURActivationFrontierReceipt',
    artifact_version: '0.1',
    frontier_id: 'urn:uu-aap:kontur:activation-frontier:test-current-main',
    recorded_at: '2026-08-23T18:19:59.000Z',
    git_revision: `git:${SHA}`,
    system_id: 'urn:uu-aap:kontur:system:server-responsibility',
    server_instance_id: 'urn:uu-aap:kontur:server:reference-primary',
    readiness_epoch: 1,
    aggregation_policy_binding: {},
    responsibility_policy_binding: {},
    readiness_signal_binding: {},
    aggregation_receipt_binding: {},
    acceptance_receipt_binding: {},
    status: 'activation_prompt_may_be_requested',
    claims: {
      canonical_frontier_bound: true,
      readiness_accepted: true,
      activation_prompt_may_be_requested: true,
      human_activation_step_still_required: true,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      legal_responsibility_determined: false,
      legal_effect_established: false,
      moral_blame_assigned: false,
      truth_certified: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
  return { ...base, ...overrides, claims: { ...base.claims, ...(overrides.claims || {}) } };
}

async function expectReject(label, args, pattern) {
  let rejected = false;
  try {
    await Verifier.verifyCurrentMainFrontier(args);
  } catch (error) {
    rejected = true;
    if (pattern) assert.match(String(error.message), pattern, label);
  }
  assert.strictEqual(rejected, true, `${label}: expected rejection`);
}

async function main() {
  const valid = await Verifier.verifyCurrentMainFrontier({
    frontier: frontier(),
    eventName: 'push',
    ref: 'refs/heads/main',
    githubSha: SHA,
    checkoutSha: SHA,
    verifiedAt: VERIFIED_AT,
    repository: 'Matawaka/uu-aap'
  });

  assert.strictEqual(valid.artifact_type, 'KONTURCurrentMainFrontierVerificationReceipt');
  assert.strictEqual(valid.decision, 'current_main_frontier_verified_for_workflow_event');
  assert.strictEqual(valid.workflow_context.event_name, 'push');
  assert.strictEqual(valid.workflow_context.ref, 'refs/heads/main');
  assert.strictEqual(valid.workflow_context.github_sha, SHA);
  assert.strictEqual(valid.workflow_context.checkout_sha, SHA);
  assert.strictEqual(valid.frontier_git_revision, `git:${SHA}`);
  assert.strictEqual(valid.claims.current_main_frontier_verified_for_workflow_event, true);
  assert.strictEqual(valid.claims.activation_prompt_may_be_requested, true);
  assert.strictEqual(valid.claims.human_activation_step_still_required, true);
  for (const key of [
    'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
    'execution_authority_granted', 'repository_ownership_transferred',
    'canonical_origin_mutated', 'legal_responsibility_determined', 'truth_certified',
    'universal_canonicality_established'
  ]) assert.strictEqual(valid.claims[key], false, key);

  await expectReject('PR event', {
    frontier: frontier(), eventName: 'pull_request', ref: 'refs/pull/285/merge',
    githubSha: SHA, checkoutSha: SHA, verifiedAt: VERIFIED_AT
  }, /workflow event must be push/);

  await expectReject('non-main ref', {
    frontier: frontier(), eventName: 'push', ref: 'refs/heads/feature',
    githubSha: SHA, checkoutSha: SHA, verifiedAt: VERIFIED_AT
  }, /workflow ref must be refs\/heads\/main/);

  await expectReject('github checkout drift', {
    frontier: frontier(), eventName: 'push', ref: 'refs/heads/main',
    githubSha: SHA, checkoutSha: OTHER_SHA, verifiedAt: VERIFIED_AT
  }, /GITHUB_SHA and checkout SHA differ/);

  await expectReject('frontier revision drift', {
    frontier: frontier({ git_revision: `git:${OTHER_SHA}` }), eventName: 'push', ref: 'refs/heads/main',
    githubSha: SHA, checkoutSha: SHA, verifiedAt: VERIFIED_AT
  }, /frontier revision does not match GITHUB_SHA/);

  await expectReject('frontier not prompt eligible', {
    frontier: frontier({ status: 'not_ready' }), eventName: 'push', ref: 'refs/heads/main',
    githubSha: SHA, checkoutSha: SHA, verifiedAt: VERIFIED_AT
  }, /frontier status does not admit prompt request/);

  await expectReject('frontier activation overclaim', {
    frontier: frontier({ claims: { kernel_activated: true } }), eventName: 'push', ref: 'refs/heads/main',
    githubSha: SHA, checkoutSha: SHA, verifiedAt: VERIFIED_AT
  }, /prohibited frontier claim kernel_activated/);

  await expectReject('repository substitution', {
    frontier: frontier(), eventName: 'push', ref: 'refs/heads/main',
    githubSha: SHA, checkoutSha: SHA, verifiedAt: VERIFIED_AT, repository: 'other/repo'
  }, /repository identity mismatch/);

  const repeat = await Verifier.verifyCurrentMainFrontier({
    frontier: frontier(), eventName: 'push', ref: 'refs/heads/main',
    githubSha: SHA, checkoutSha: SHA, verifiedAt: VERIFIED_AT
  });
  assert.deepStrictEqual(repeat, valid, 'fixed inputs must reproduce exact receipt');

  console.log('KONTUR current-main frontier verification tests: SUCCESS');
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
