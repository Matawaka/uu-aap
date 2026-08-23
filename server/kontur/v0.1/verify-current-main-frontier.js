'use strict';

const fs = require('fs');
const path = require('path');
const Binding = require(path.resolve(__dirname, '../../../docs/poai/binding-receipt.js'));

function assert(value, message) { if (!value) throw new Error(message); }
async function digestJson(value) {
  return Binding.sha256Hex(Binding.utf8Bytes(Binding.canonicalize(value, '$')));
}
function digest(value) {
  return { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value };
}
function assertFalseClaims(claims) {
  for (const key of [
    'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
    'execution_authority_granted', 'legal_responsibility_determined', 'truth_certified',
    'universal_canonicality_established'
  ]) {
    assert(claims && claims[key] === false, `KONTUR Current Main Frontier Verification: prohibited frontier claim ${key}`);
  }
}

async function verifyCurrentMainFrontier({
  frontier,
  eventName,
  ref,
  githubSha,
  checkoutSha,
  verifiedAt = new Date().toISOString(),
  repository = 'Matawaka/uu-aap'
}) {
  assert(frontier && frontier.artifact_type === 'KONTURActivationFrontierReceipt',
    'KONTUR Current Main Frontier Verification: activation frontier required');
  assert(frontier.artifact_version === '0.1',
    'KONTUR Current Main Frontier Verification: unsupported frontier version');
  assert(frontier.status === 'activation_prompt_may_be_requested',
    'KONTUR Current Main Frontier Verification: frontier status does not admit prompt request');
  assert(frontier.claims && frontier.claims.canonical_frontier_bound === true,
    'KONTUR Current Main Frontier Verification: frontier binding claim missing');
  assert(frontier.claims.readiness_accepted === true,
    'KONTUR Current Main Frontier Verification: readiness not accepted');
  assert(frontier.claims.activation_prompt_may_be_requested === true,
    'KONTUR Current Main Frontier Verification: prompt-request boundary missing');
  assert(frontier.claims.human_activation_step_still_required === true,
    'KONTUR Current Main Frontier Verification: human activation boundary missing');
  assertFalseClaims(frontier.claims);

  assert(eventName === 'push',
    'KONTUR Current Main Frontier Verification: workflow event must be push');
  assert(ref === 'refs/heads/main',
    'KONTUR Current Main Frontier Verification: workflow ref must be refs/heads/main');
  assert(repository === 'Matawaka/uu-aap',
    'KONTUR Current Main Frontier Verification: repository identity mismatch');
  assert(/^[0-9a-f]{40}$/.test(githubSha),
    'KONTUR Current Main Frontier Verification: exact GITHUB_SHA required');
  assert(/^[0-9a-f]{40}$/.test(checkoutSha),
    'KONTUR Current Main Frontier Verification: exact checkout SHA required');
  assert(githubSha === checkoutSha,
    'KONTUR Current Main Frontier Verification: GITHUB_SHA and checkout SHA differ');
  assert(frontier.git_revision === `git:${githubSha}`,
    'KONTUR Current Main Frontier Verification: frontier revision does not match GITHUB_SHA');
  assert(frontier.git_revision === `git:${checkoutSha}`,
    'KONTUR Current Main Frontier Verification: frontier revision does not match checkout SHA');
  assert(Number.isFinite(Date.parse(verifiedAt)),
    'KONTUR Current Main Frontier Verification: invalid verified_at');

  const frontierDigest = await digestJson(frontier);
  const seed = [repository, eventName, ref, githubSha, checkoutSha, frontierDigest, verifiedAt].join('|');
  const hash = await Binding.sha256Hex(Binding.utf8Bytes(seed));

  return {
    $schema: './kontur-current-main-frontier-verification.schema.json',
    artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt',
    artifact_version: '0.1',
    verification_id: `urn:uu-aap:kontur:current-main-frontier-verification:${hash.slice(0, 24)}`,
    verified_at: verifiedAt,
    repository,
    workflow_context: {
      event_name: eventName,
      ref,
      github_sha: githubSha,
      checkout_sha: checkoutSha
    },
    frontier_binding: {
      artifact_type: 'KONTURActivationFrontierReceipt',
      artifact_ref: frontier.frontier_id,
      digest: digest(frontierDigest)
    },
    frontier_git_revision: frontier.git_revision,
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

async function main(argv) {
  const [frontierPath, outPath, eventName, ref, githubSha, checkoutSha, verifiedAt] = argv.slice(2);
  assert(frontierPath && outPath && eventName && ref && githubSha && checkoutSha,
    'usage: node verify-current-main-frontier.js <frontier.json> <out.json> <event> <ref> <github-sha> <checkout-sha> [verified-at]');
  const frontier = JSON.parse(fs.readFileSync(frontierPath, 'utf8'));
  const receipt = await verifyCurrentMainFrontier({
    frontier, eventName, ref, githubSha, checkoutSha,
    verifiedAt: verifiedAt || new Date().toISOString()
  });
  fs.writeFileSync(outPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (require.main === module) {
  main(process.argv).catch((error) => {
    console.error(error.stack || error.message || String(error));
    process.exit(1);
  });
}

module.exports = { digestJson, verifyCurrentMainFrontier };
