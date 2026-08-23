'use strict';

const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

function assert(value, message) { if (!value) throw new Error(message); }
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
async function binding(type, ref, artifact) {
  return { artifact_type: type, artifact_ref: ref, digest: digest(await digestJson(artifact)) };
}

function assertConvergence(manifest) {
  assert(manifest && manifest.schema_version === 'architecture-convergence-readiness-v0.1',
    'Project Readiness Checkpoint: exact convergence v0.1 manifest required');
  assert(manifest.project_id === 'Matawaka/uu-aap', 'Project Readiness Checkpoint: project mismatch');
  assert(manifest.assessment && manifest.assessment.state === 'cross-plane-integration-review-eligible' &&
    manifest.assessment.safe_effect === 'integration-review-only',
    'Project Readiness Checkpoint: convergence is not integration-review eligible');
  const claims = manifest.claims || {};
  assert(claims.all_declared_planes_present === true, 'Project Readiness Checkpoint: planes not present');
  assert(claims.cross_plane_separation_preserved === true, 'Project Readiness Checkpoint: plane separation not preserved');
  assert(claims.future_evolution_allowed === true, 'Project Readiness Checkpoint: future evolution must remain allowed');
  for (const key of [
    'external_execution_authorized', 'kontur_activation_authorized', 'kontur_activated',
    'current_kontur_activation_frontier_verified',
    'repository_ownership_transferred', 'canonical_origin_mutated', 'legal_authority_established',
    'distributed_consensus_established', 'universal_architecture_completeness_proven'
  ]) assert(claims[key] === false, `Project Readiness Checkpoint: unsafe convergence claim ${key}`);
}

function assertCurrentMainVerification(receipt, gitRevision) {
  assert(receipt && receipt.artifact_type === 'KONTURCurrentMainFrontierVerificationReceipt' &&
    receipt.artifact_version === '0.1',
    'Project Readiness Checkpoint: exact current-main verification receipt required');
  assert(receipt.repository === 'Matawaka/uu-aap', 'Project Readiness Checkpoint: receipt repository mismatch');
  assert(receipt.decision === 'current_main_frontier_verified_for_workflow_event',
    'Project Readiness Checkpoint: current-main frontier not verified');
  assert(receipt.frontier_git_revision === gitRevision,
    'Project Readiness Checkpoint: frontier/current checkpoint revision drift');
  const ctx = receipt.workflow_context || {};
  assert(ctx.event_name === 'push' && ctx.ref === 'refs/heads/main',
    'Project Readiness Checkpoint: canonical main push context required');
  assert(`git:${ctx.github_sha}` === gitRevision && ctx.github_sha === ctx.checkout_sha,
    'Project Readiness Checkpoint: workflow SHA drift');
  const claims = receipt.claims || {};
  assert(claims.current_main_frontier_verified_for_workflow_event === true,
    'Project Readiness Checkpoint: positive frontier verification claim required');
  assert(claims.activation_prompt_may_be_requested === true &&
    claims.human_activation_step_still_required === true,
    'Project Readiness Checkpoint: human activation boundary missing');
  for (const key of [
    'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
    'execution_authority_granted', 'repository_ownership_transferred',
    'canonical_origin_mutated', 'legal_responsibility_determined', 'truth_certified',
    'universal_canonicality_established'
  ]) assert(claims[key] === false, `Project Readiness Checkpoint: unsafe frontier verification claim ${key}`);
}

async function buildProjectReadinessCheckpoint({ convergenceManifest, currentMainVerification, gitRevision, recordedAt }) {
  assert(/^git:[0-9a-f]{40}$/.test(gitRevision), 'Project Readiness Checkpoint: exact git revision required');
  assert(Number.isFinite(Date.parse(recordedAt)), 'Project Readiness Checkpoint: invalid recorded_at');
  assertConvergence(convergenceManifest);
  assertCurrentMainVerification(currentMainVerification, gitRevision);

  const convergenceBinding = await binding(
    'ArchitectureConvergenceReadinessManifest',
    'schemas/architecture/v0.1/examples/architecture-convergence-readiness.example.json',
    convergenceManifest
  );
  const verificationBinding = await binding(
    'KONTURCurrentMainFrontierVerificationReceipt',
    currentMainVerification.verification_id,
    currentMainVerification
  );
  const seed = [gitRevision, convergenceBinding.digest.value, verificationBinding.digest.value, recordedAt].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './project-readiness-checkpoint.schema.json',
    artifact_type: 'ProjectReadinessCheckpointReceipt',
    artifact_version: '0.1',
    checkpoint_id: `urn:uu-aap:architecture:readiness-checkpoint:${hash.slice(0, 24)}`,
    recorded_at: recordedAt,
    project_id: 'Matawaka/uu-aap',
    git_revision: gitRevision,
    convergence_manifest_binding: convergenceBinding,
    current_main_frontier_verification_binding: verificationBinding,
    status: 'project_readiness_checkpoint_established',
    claims: {
      cross_plane_integration_review_eligible: true,
      current_main_frontier_verified: true,
      project_readiness_checkpoint_established: true,
      human_activation_step_still_required: true,
      kontur_activation_authorized: false,
      kontur_activated: false,
      execution_authority_granted: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_authority_established: false,
      truth_certified: false,
      distributed_consensus_established: false,
      universal_architecture_completeness_proven: false,
      future_evolution_allowed: true
    }
  };
}

module.exports = { digestJson, buildProjectReadinessCheckpoint };
