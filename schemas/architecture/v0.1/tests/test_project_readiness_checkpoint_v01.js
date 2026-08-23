'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const Builder = require('../build-project-readiness-checkpoint.js');

const ROOT = path.resolve(__dirname, '../../../..');
const convergence = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'schemas/architecture/v0.1/examples/architecture-convergence-readiness.example.json'), 'utf8'
));
const SHA = 'a'.repeat(40);
const RECORDED_AT = '2026-08-23T18:30:00Z';

function receipt() {
  return {
    $schema: './kontur-current-main-frontier-verification.schema.json',
    artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt',
    artifact_version: '0.1',
    verification_id: 'urn:uu-aap:kontur:current-main-frontier-verification:test',
    verified_at: RECORDED_AT,
    repository: 'Matawaka/uu-aap',
    workflow_context: { event_name: 'push', ref: 'refs/heads/main', github_sha: SHA, checkout_sha: SHA },
    frontier_binding: {
      artifact_type: 'KONTURActivationFrontierReceipt',
      artifact_ref: 'urn:uu-aap:kontur:activation-frontier:test',
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: 'b'.repeat(64) }
    },
    frontier_git_revision: `git:${SHA}`,
    decision: 'current_main_frontier_verified_for_workflow_event',
    claims: {
      workflow_context_is_main_push: true,
      github_sha_matches_checkout_sha: true,
      frontier_revision_matches_github_sha: true,
      frontier_revision_matches_checkout_sha: true,
      current_main_frontier_verified_for_workflow_event: true,
      activation_prompt_may_be_requested: true,
      human_activation_step_still_required: true,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_responsibility_determined: false,
      truth_certified: false,
      universal_canonicality_established: false
    }
  };
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
async function reject(label, mutateManifest, mutateReceipt, revision = `git:${SHA}`) {
  const m = clone(convergence);
  const r = receipt();
  if (mutateManifest) mutateManifest(m);
  if (mutateReceipt) mutateReceipt(r);
  let failed = false;
  try {
    await Builder.buildProjectReadinessCheckpoint({ convergenceManifest: m, currentMainVerification: r, gitRevision: revision, recordedAt: RECORDED_AT });
  } catch (_) { failed = true; }
  assert.strictEqual(failed, true, `${label}: expected fail-closed rejection`);
}

(async () => {
  const good = await Builder.buildProjectReadinessCheckpoint({
    convergenceManifest: clone(convergence), currentMainVerification: receipt(),
    gitRevision: `git:${SHA}`, recordedAt: RECORDED_AT
  });
  assert.strictEqual(good.status, 'project_readiness_checkpoint_established');
  assert.strictEqual(good.git_revision, `git:${SHA}`);
  assert.strictEqual(good.claims.cross_plane_integration_review_eligible, true);
  assert.strictEqual(good.claims.current_main_frontier_verified, true);
  assert.strictEqual(good.claims.project_readiness_checkpoint_established, true);
  assert.strictEqual(good.claims.human_activation_step_still_required, true);
  for (const key of [
    'kontur_activation_authorized', 'kontur_activated', 'execution_authority_granted',
    'repository_ownership_transferred', 'canonical_origin_mutated', 'legal_authority_established',
    'truth_certified', 'distributed_consensus_established', 'universal_architecture_completeness_proven'
  ]) assert.strictEqual(good.claims[key], false, key);

  const same = await Builder.buildProjectReadinessCheckpoint({
    convergenceManifest: clone(convergence), currentMainVerification: receipt(),
    gitRevision: `git:${SHA}`, recordedAt: RECORDED_AT
  });
  assert.deepStrictEqual(same, good, 'fixed inputs must produce deterministic checkpoint');

  await reject('non-main event', null, r => { r.workflow_context.event_name = 'pull_request'; });
  await reject('non-main ref', null, r => { r.workflow_context.ref = 'refs/heads/feature'; });
  await reject('workflow sha drift', null, r => { r.workflow_context.checkout_sha = 'c'.repeat(40); });
  await reject('frontier revision drift', null, r => { r.frontier_git_revision = `git:${'d'.repeat(40)}`; });
  await reject('negative frontier decision', null, r => { r.decision = 'not_verified'; });
  await reject('frontier verification removed', null, r => { r.claims.current_main_frontier_verified_for_workflow_event = false; });
  await reject('activation already claimed', null, r => { r.claims.kernel_activated = true; });
  await reject('execution authority claimed', null, r => { r.claims.execution_authority_granted = true; });
  await reject('convergence not eligible', m => { m.assessment.state = 'incomplete'; });
  await reject('unsafe convergence activation', m => { m.claims.kontur_activation_authorized = true; });
  await reject('unsafe convergence execution', m => { m.claims.external_execution_authorized = true; });
  await reject('convergence already claims current frontier', m => { m.claims.current_kontur_activation_frontier_verified = true; });
  await reject('future evolution closed', m => { m.claims.future_evolution_allowed = false; });
  await reject('checkpoint revision mismatch', null, null, `git:${'e'.repeat(40)}`);

  console.log('Project readiness checkpoint v0.1: PASS');
})().catch(error => { console.error(error); process.exit(1); });
