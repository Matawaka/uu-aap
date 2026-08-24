'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Preflight = require('./activation-preflight.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function iso(ms) { return new Date(ms).toISOString(); }
function run(command, args) {
  const result = cp.spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  assert(result.status === 0, `prerequisite failed: ${command} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return (result.stdout || '').trim();
}
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

const HAR_CONFIRMATIONS = [
  'exact_revision_and_review_packet_understood',
  'existing_permissions_only',
  'no_permission_bypass_or_escalation',
  'activation_intent_is_separate_future_artifact',
  'preflight_is_separate_and_must_be_fresh',
  'execute_command_requires_separate_human_step',
  'holder_scopes_and_lease_must_be_explicit_before_intent',
  'activation_does_not_establish_legal_truth_or_universal_authority'
];

async function makeHarApproval(currentGitRevision, baseMs) {
  const packet = {
    $schema: './kontur-human-activation-review-packet.schema.json',
    artifact_type: 'KONTURHumanActivationReviewPacket',
    artifact_version: '0.1',
    review_packet_id: `urn:uu-aap:kontur:human-activation-review-packet:test-${currentGitRevision.slice(-12)}`,
    prepared_at: iso(baseMs - 30000),
    expires_at: iso(baseMs - 30000 + 24 * 60 * 60 * 1000),
    project_id: 'Matawaka/uu-aap',
    git_revision: currentGitRevision,
    project_readiness_checkpoint_binding: {
      artifact_type: 'ProjectReadinessCheckpointReceipt',
      artifact_ref: 'urn:uu-aap:architecture:readiness-checkpoint:test',
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: '1'.repeat(64) }
    },
    current_main_frontier_verification_binding: {
      artifact_type: 'KONTURCurrentMainFrontierVerificationReceipt',
      artifact_ref: 'urn:uu-aap:kontur:current-main-frontier-verification:test',
      digest: { canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex', value: '2'.repeat(64) }
    },
    required_human_confirmations: [...HAR_CONFIRMATIONS],
    review_state: 'ready_for_human_activation_review',
    safe_next_step: 'human_review_decision_only',
    claims: {
      project_readiness_checkpoint_verified: true,
      current_main_frontier_verified: true,
      human_activation_review_ready: true,
      human_review_decision_recorded: false,
      activation_intent_preparation_authorized: false,
      activation_intent_created: false,
      preflight_requested: false,
      execute_command_created: false,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      permission_expansion_authorized: false,
      permission_bypass_authorized: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_authority_established: false,
      truth_certified: false,
      distributed_consensus_established: false
    }
  };
  const reviewPacketBinding = {
    artifact_type: 'KONTURHumanActivationReviewPacket',
    artifact_ref: packet.review_packet_id,
    digest: {
      canonicalization: 'RFC8785-JCS', digest_algorithm: 'SHA-256', digest_encoding: 'hex',
      value: await Preflight.digestJson(packet)
    }
  };
  const reviewedAt = iso(baseMs - 20000);
  const observedAt = iso(baseMs - 10000);
  const nonce = `urn:uu-aap:kontur:human-activation-review-nonce:test-${currentGitRevision.slice(-12)}`;
  const identitySeed = {
    artifact_type: 'KONTURHumanActivationReviewDecisionIdentitySeed',
    artifact_version: '0.1',
    review_packet_binding: reviewPacketBinding,
    reviewer_ref: 'human:reviewer:test',
    decision: 'approve_intent_preparation',
    human_declaration_nonce: nonce,
    reviewed_at: reviewedAt,
    observed_current_git_revision: currentGitRevision,
    observed_at: observedAt
  };
  const idHash = await Preflight.digestJson(identitySeed);
  const decision = {
    $schema: './kontur-human-activation-review-decision.schema.json',
    artifact_type: 'KONTURHumanActivationReviewDecision',
    artifact_version: '0.1',
    decision_id: `urn:uu-aap:kontur:human-activation-review-decision:${idHash.slice(0, 24)}`,
    reviewed_at: reviewedAt,
    review_packet_binding: reviewPacketBinding,
    reviewer_ref: 'human:reviewer:test',
    decision: 'approve_intent_preparation',
    confirmations: Object.fromEntries(HAR_CONFIRMATIONS.map((key) => [key, true])),
    human_declaration: {
      declaration_type: 'approve_intent_preparation_only',
      typed_confirmation: 'APPROVE_KONTUR_ACTIVATION_INTENT_PREPARATION_ONLY',
      nonce,
      explicit: true
    },
    review_context: {
      observed_current_git_revision: currentGitRevision,
      observed_at: observedAt,
      packet_expires_at: packet.expires_at,
      prior_decisions_complete: true,
      prior_decision_count: 0,
      replay_guard: { nonce_not_seen: true, packet_not_previously_decided: true }
    },
    safe_effect: 'activation_intent_preparation_may_be_requested',
    claims: {
      human_review_decision_recorded: true,
      activation_intent_preparation_may_be_requested: true,
      activation_intent_created: false,
      preflight_requested: false,
      execute_command_created: false,
      kernel_activated: false,
      responsibility_state_created: false,
      responsibility_accepted: false,
      execution_authority_granted: false,
      permission_expansion_authorized: false,
      permission_bypass_authorized: false,
      repository_ownership_transferred: false,
      canonical_origin_mutated: false,
      legal_authority_established: false,
      truth_certified: false,
      distributed_consensus_established: false
    }
  };
  return { packet, decision };
}

async function main() {
  const outputDir = process.argv[2] || '/tmp/kontur-activation-preflight';
  const readinessDir = path.join(outputDir, 'readiness');
  fs.mkdirSync(readinessDir, { recursive: true });

  run('node', ['server/kontur/v0.1/test-readiness-aggregator.js', readinessDir]);

  const frontier = readJson(path.join(readinessDir, 'activation-frontier.json'));
  const readinessSignal = readJson(path.join(readinessDir, 'readiness-signal.json'));
  const health = readJson(path.join(readinessDir, 'server-health.json'));
  const aggregationPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.readiness-aggregation-policy.json'));
  const responsibilityPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-policy.json'));
  const activationPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.activation-policy.json'));
  const gitSha = run('git', ['rev-parse', 'HEAD']);
  const currentGitRevision = `git:${gitSha}`;
  assert(frontier.git_revision === currentGitRevision, 'readiness frontier must bind current checkout');

  const evaluatorSource = fs.readFileSync(path.join(repoRoot, 'server/kontur/v0.1/activation-preflight.js'), 'utf8');
  assert(!evaluatorSource.includes('responsibility-kernel.js'), 'activation preflight must not import responsibility-kernel.js');
  assert(!evaluatorSource.includes('transitionResponsibility'), 'activation preflight must not call transitionResponsibility');

  const baseMs = Math.max(
    Date.parse(frontier.recorded_at) + 1000,
    Date.parse(health.observed_at) + 1000,
    Date.parse(activationPolicy.effective_from) + 1000
  );
  const declaredAt = iso(baseMs);
  const evaluatedAt = iso(baseMs + 1000);
  const holderId = 'urn:uu-aap:kontur:holder:human-controlled-primary';
  const scopes = [...responsibilityPolicy.responsibility_scope_allowlist].sort();
  const lease = {
    lease_id: `urn:uu-aap:kontur:lease:activation-preflight-${gitSha.slice(0, 12)}`,
    holder_id: holderId,
    server_instance_id: activationPolicy.server_instance_id,
    issued_at: iso(baseMs - 1000),
    expires_at: iso(baseMs + 120000)
  };
  const har = await makeHarApproval(currentGitRevision, baseMs);
  const humanActivationReviewPacket = har.packet;
  const humanActivationReviewDecision = har.decision;

  const buildArgs = {
    currentGitRevision,
    frontier,
    readinessSignal,
    aggregationPolicy,
    responsibilityPolicy,
    activationPolicy,
    humanActivationReviewPacket,
    humanActivationReviewDecision,
    health,
    declaredAt,
    actorRef: 'urn:uu-aap:human-actor:repository-owner-declared',
    intentNonce: `urn:uu-aap:kontur:activation-intent-nonce:${gitSha.slice(0, 16)}`,
    holderId,
    responsibilityScopes: scopes,
    fencingEpoch: frontier.readiness_epoch,
    lease
  };

  const validationContext = {
    currentGitRevision, frontier, readinessSignal, aggregationPolicy, responsibilityPolicy,
    activationPolicy, humanActivationReviewPacket, humanActivationReviewDecision, health
  };
  const intent = await Preflight.buildActivationIntent(buildArgs);
  await Preflight.validateActivationIntent({ intent, ...validationContext });
  const receipt = await Preflight.preflightActivation({
    intent, ...validationContext, evaluatedAt, parallelActiveHolders: [], currentResponsibilityState: null
  });

  writeJson(path.join(outputDir, 'activation-intent.json'), intent);
  writeJson(path.join(outputDir, 'activation-preflight.json'), receipt);

  assert(intent.claims.human_activation_review_approval_bound === true, 'HAR approval must be bound');
  assert(intent.human_activation_review_decision_binding.artifact_ref === humanActivationReviewDecision.decision_id,
    'intent must bind exact HAR decision');
  assert(receipt.decision === 'human_execute_step_may_proceed', 'positive preflight decision missing');
  assert(receipt.claims.activation_intent_verified === true, 'activation intent must be verified');
  assert(receipt.claims.activation_preconditions_revalidated === true, 'preconditions must be revalidated');
  assert(receipt.claims.human_execute_step_may_proceed === true, 'human execute step must be the only positive disposition');
  for (const key of [
    'kernel_activated', 'responsibility_state_created', 'responsibility_accepted',
    'execution_authority_granted', 'legal_responsibility_determined', 'truth_certified',
    'universal_canonicality_established'
  ]) assert(receipt.claims[key] === false, key);

  const vectors = [];
  const build = (overrides = {}) => Preflight.buildActivationIntent({ ...buildArgs, ...overrides });
  const validate = (changedIntent, overrides = {}) => Preflight.validateActivationIntent({
    intent: changedIntent, ...validationContext, ...overrides
  });
  const preflight = (overrides = {}) => Preflight.preflightActivation({
    intent, ...validationContext, evaluatedAt, parallelActiveHolders: [], currentResponsibilityState: null,
    ...overrides
  });
  const validateReceipt = (changedReceipt, overrides = {}) => Preflight.validateActivationPreflightReceipt({
    receipt: changedReceipt, intent, ...validationContext, ...overrides
  });

  vectors.push(await reject('missing_har_packet', () => build({ humanActivationReviewPacket: undefined }), /HAR packet/));
  vectors.push(await reject('missing_har_decision', () => build({ humanActivationReviewDecision: undefined }), /HAR decision/));
  vectors.push(await reject('har_defer_rejected', async () => {
    const changed = clone(humanActivationReviewDecision); changed.decision = 'defer'; await build({ humanActivationReviewDecision: changed });
  }, /did not approve|decision_id/));
  vectors.push(await reject('har_decision_id_tamper', async () => {
    const changed = clone(humanActivationReviewDecision); changed.decision_id = `urn:uu-aap:kontur:human-activation-review-decision:${'0'.repeat(24)}`;
    await build({ humanActivationReviewDecision: changed });
  }, /decision_id binding mismatch/));
  vectors.push(await reject('har_packet_substitution', async () => {
    const changed = clone(humanActivationReviewPacket); changed.project_id = 'Matawaka/substituted'; await build({ humanActivationReviewPacket: changed });
  }, /project drift|binding substitution/));
  vectors.push(await reject('har_revision_drift', async () => {
    const changed = clone(humanActivationReviewDecision); changed.review_context.observed_current_git_revision = `git:${'0'.repeat(40)}`;
    await build({ humanActivationReviewDecision: changed });
  }, /revision drift|decision_id/));
  vectors.push(await reject('intent_har_binding_substitution', async () => {
    const changed = clone(intent); changed.human_activation_review_decision_binding.digest.value = '0'.repeat(64); await validate(changed);
  }, /HAR decision binding substitution/));

  vectors.push(await reject('git_revision_drift', () => build({ currentGitRevision: `git:${'0'.repeat(40)}` }), /Git revision|frontier/));
  vectors.push(await reject('frontier_status_substitution', async () => {
    const changed = clone(frontier); changed.status = 'blocked'; await build({ frontier: changed });
  }, /frontier does not admit/));
  vectors.push(await reject('frontier_readiness_digest_substitution', async () => {
    const changed = clone(frontier); changed.readiness_signal_binding.digest.value = '0'.repeat(64); await build({ frontier: changed });
  }, /frontier readiness binding substitution/));
  vectors.push(await reject('readiness_epoch_substitution', async () => {
    const changed = clone(readinessSignal); changed.readiness_epoch += 1; await build({ readinessSignal: changed });
  }, /frontier\/readiness epoch mismatch|binding substitution/));
  vectors.push(await reject('expired_readiness', () => preflight({ evaluatedAt: iso(Date.parse(readinessSignal.valid_until) + 1) }), /readiness signal expired|activation intent is stale or future-dated/));
  vectors.push(await reject('aggregation_policy_drift', async () => {
    const changed = clone(aggregationPolicy); changed.policy_version += 1; await build({ aggregationPolicy: changed });
  }, /frontier aggregation policy binding substitution/));
  vectors.push(await reject('responsibility_policy_drift', async () => {
    const changed = clone(responsibilityPolicy); changed.responsibility_scope_allowlist = changed.responsibility_scope_allowlist.slice(0, 1);
    await build({ responsibilityPolicy: changed });
  }, /scope not allowed|frontier responsibility policy binding substitution/));
  vectors.push(await reject('activation_policy_auto_activation', async () => {
    const changed = clone(activationPolicy); changed.requirements.auto_activation_allowed = true; await build({ activationPolicy: changed });
  }, /auto activation/));
  vectors.push(await reject('activation_policy_freshness_weakened', async () => {
    const changed = clone(activationPolicy); changed.max_health_age_seconds = 301; await build({ activationPolicy: changed });
  }, /invalid health freshness/));
  vectors.push(await reject('server_identity_substitution', async () => {
    const changed = clone(health); changed.server_instance_id = 'urn:uu-aap:kontur:server:other'; await build({ health: changed });
  }, /health identity mismatch/));
  vectors.push(await reject('unhealthy_server', async () => {
    const changed = clone(health); changed.status = 'degraded'; changed.components[0].status = 'degraded'; await build({ health: changed });
  }, /server health is not healthy/));
  vectors.push(await reject('stale_health', async () => {
    const changed = clone(health); changed.observed_at = iso(baseMs - (activationPolicy.max_health_age_seconds + 1) * 1000); await build({ health: changed });
  }, /health observation is stale/));
  vectors.push(await reject('future_health', async () => {
    const changed = clone(health); changed.observed_at = iso(baseMs + 10000); await build({ health: changed });
  }, /health observation is in the future/));
  vectors.push(await reject('invalid_holder', () => build({ holderId: 'holder:other' }), /responsibility holder/));
  vectors.push(await reject('scope_outside_allowlist', () => build({ responsibilityScopes: ['server.root.override'] }), /scope not allowed/));
  vectors.push(await reject('lease_holder_mismatch', async () => {
    const changed = clone(lease); changed.holder_id = 'urn:uu-aap:kontur:holder:other'; await build({ lease: changed });
  }, /lease holder mismatch/));
  vectors.push(await reject('lease_server_mismatch', async () => {
    const changed = clone(lease); changed.server_instance_id = 'urn:uu-aap:kontur:server:other'; await build({ lease: changed });
  }, /lease server mismatch/));
  vectors.push(await reject('expired_lease', async () => {
    const changed = clone(lease); changed.expires_at = iso(baseMs - 1); await build({ lease: changed });
  }, /lease expired/));
  vectors.push(await reject('parallel_active_holder', () => preflight({ parallelActiveHolders: ['urn:uu-aap:kontur:holder:other'] }), /parallel active holder/));
  vectors.push(await reject('existing_responsibility_state', () => preflight({ currentResponsibilityState: { artifact_type: 'KONTURResponsibilityState' } }), /genesis activation requires no current/));
  vectors.push(await reject('stale_human_intent', () => preflight({ evaluatedAt: iso(baseMs + (activationPolicy.max_intent_age_seconds + 1) * 1000) }), /intent is stale|readiness signal expired/));
  vectors.push(await reject('human_intent_removed', async () => {
    const changed = clone(intent); changed.human_intent.explicit = false; await validate(changed);
  }, /explicit human activation intent missing/));
  vectors.push(await reject('transition_substitution', async () => {
    const changed = clone(intent); changed.intended_transition = 'resume'; await validate(changed);
  }, /transition substitution/));
  vectors.push(await reject('intent_frontier_digest_substitution', async () => {
    const changed = clone(intent); changed.frontier_binding.digest.value = '0'.repeat(64); await validate(changed);
  }, /intent frontier binding substitution/));
  vectors.push(await reject('intent_holder_substitution', async () => {
    const changed = clone(intent); changed.holder_id = 'urn:uu-aap:kontur:holder:other'; await validate(changed);
  }, /lease holder mismatch/));
  vectors.push(await reject('intent_scalar_injection', async () => {
    const changed = clone(intent); changed.responsibility_score = 1; await validate(changed);
  }, /scalar scores prohibited|exact contract keys/));
  vectors.push(await reject('intent_activation_overclaim', async () => {
    const changed = clone(intent); changed.claims.kernel_activated = true; await validate(changed);
  }, /prohibited claim kernel_activated/));
  vectors.push(await reject('preflight_activation_overclaim', async () => {
    const changed = clone(receipt); changed.claims.kernel_activated = true; await validateReceipt(changed);
  }, /prohibited claim kernel_activated/));
  vectors.push(await reject('preflight_responsibility_overclaim', async () => {
    const changed = clone(receipt); changed.claims.responsibility_accepted = true; await validateReceipt(changed);
  }, /prohibited claim responsibility_accepted/));
  vectors.push(await reject('preflight_execution_authority_overclaim', async () => {
    const changed = clone(receipt); changed.claims.execution_authority_granted = true; await validateReceipt(changed);
  }, /prohibited claim execution_authority_granted/));
  vectors.push(await reject('preflight_legal_overclaim', async () => {
    const changed = clone(receipt); changed.claims.legal_responsibility_determined = true; await validateReceipt(changed);
  }, /prohibited claim legal_responsibility_determined/));
  vectors.push(await reject('preflight_truth_overclaim', async () => {
    const changed = clone(receipt); changed.claims.truth_certified = true; await validateReceipt(changed);
  }, /prohibited claim truth_certified/));
  vectors.push(await reject('preflight_scope_substitution', async () => {
    const changed = clone(receipt); changed.responsibility_scopes = changed.responsibility_scopes.slice(0, 1); await validateReceipt(changed);
  }, /holder\/scope substitution/));
  vectors.push(await reject('preflight_binding_substitution', async () => {
    const changed = clone(receipt); changed.intent_binding.digest.value = '0'.repeat(64); await validateReceipt(changed);
  }, /preflight intent binding substitution/));

  writeJson(path.join(outputDir, 'summary.json'), {
    suite: 'KONTUR Activation Preflight v0.1',
    git_revision: currentGitRevision,
    activation_policy_id: activationPolicy.policy_id,
    frontier_ref: frontier.frontier_id,
    readiness_signal_ref: readinessSignal.signal_id,
    har_decision_ref: humanActivationReviewDecision.decision_id,
    intent_ref: intent.intent_id,
    preflight_ref: receipt.preflight_id,
    decision: receipt.decision,
    human_execute_step_may_proceed: true,
    kernel_activated: false,
    responsibility_state_created: false,
    negative_vectors: vectors.length
  });

  console.log(JSON.stringify({
    suite: 'KONTUR Activation Preflight v0.1',
    git_revision: currentGitRevision,
    har_decision_bound: true,
    decision: receipt.decision,
    kernel_activated: false,
    responsibility_state_created: false,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
