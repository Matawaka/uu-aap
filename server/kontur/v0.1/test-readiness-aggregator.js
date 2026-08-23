'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Aggregator = require('./readiness-aggregator.js');
const Health = require('./observe-server-health.js');
const Frontier = require('./build-activation-frontier.js');

const repoRoot = path.resolve(__dirname, '../../..');
function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function run(command, args) {
  const result = cp.spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  assert(result.status === 0, `producer failed: ${command} ${args.join(' ')}\n${result.stdout || ''}\n${result.stderr || ''}`);
  return result.stdout || '';
}
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}
function iso(ms) { return new Date(ms).toISOString(); }

async function main() {
  const outputDir = process.argv[2] || '/tmp/kontur-readiness';
  fs.mkdirSync(outputDir, { recursive: true });

  const policy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.readiness-aggregation-policy.json'));
  const responsibilityPolicy = readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-policy.json'));
  const effectiveMs = Date.parse(policy.effective_from);

  // 1. Protocol Registry: rerun its exact immutable-tag validator before binding registry.json.
  run('node', ['protocols/registry/v0.1/validate-registry.js']);
  const registry = readJson(path.join(repoRoot, 'protocols/registry/v0.1/registry.json'));

  // 2. Authority: reproduce current published live authority verification.
  const authorityPath = path.join(outputDir, 'authority-verification.json');
  const authorityCheckPath = path.join(outputDir, 'authority-publication-check.json');
  run('node', [
    'proposals/poai/authority/live/test-live-published-grant-authority.js',
    authorityPath,
    authorityCheckPath
  ]);
  const authority = readJson(authorityPath);

  // 3. Coordination: consume the exact authority result in CCRP/C5.
  const coordinationPath = path.join(outputDir, 'coordination-result.json');
  const coordinationCheckPath = path.join(outputDir, 'coordination-check.json');
  run('node', [
    'proposals/ccrp/test-c5.js', authorityPath, coordinationPath, coordinationCheckPath
  ]);
  const coordination = readJson(coordinationPath);

  // 4. Provenance completion: rerun full machine provenance completion harness.
  const provenancePath = path.join(outputDir, 'provenance-completion.json');
  run('node', ['protocols/integration/v0.1/test-origin-provenance.js', provenancePath]);
  const provenance = readJson(provenancePath);

  // 5. Causal qualification: rerun complete causal qualification harness.
  const causalPath = path.join(outputDir, 'causal-qualification.json');
  run('node', ['protocols/integration/v0.1/test-causal-claim-qualification.js', causalPath]);
  const causal = readJson(causalPath);

  // The evidence observation frontier is captured only after all upstream validators completed.
  const captureMs = Math.max(Date.now(), effectiveMs + 5000);
  const sourceObservedAt = iso(captureMs);
  const aggregatedAt = iso(captureMs + 1000);
  const acceptedAt = iso(captureMs + 2000);
  const frontierAt = iso(captureMs + 3000);

  // 6. Server health: independently prove basic reference-harness runtime components.
  run('node', ['--version']);
  run('git', ['cat-file', '-e', 'HEAD^{commit}']);
  fs.accessSync(path.join(repoRoot, 'server/kontur/v0.1/readiness-aggregator.js'), fs.constants.R_OK);
  const gitSha = run('git', ['rev-parse', 'HEAD']).trim();
  assert(/^[0-9a-f]{40}$/.test(gitSha), 'reference harness requires exact HEAD SHA');
  const health = await Health.observeServerHealth({
    systemId: policy.system_id,
    serverInstanceId: policy.server_instance_id,
    observedAt: sourceObservedAt,
    components: [
      { component_id: 'node-runtime', status: 'pass', evidence_ref: `git:${gitSha}:runtime:node` },
      { component_id: 'git-object-database', status: 'pass', evidence_ref: `git:${gitSha}:object-database:head` },
      { component_id: 'kontur-code-readable', status: 'pass', evidence_ref: `git:${gitSha}:path:server/kontur/v0.1/readiness-aggregator.js` }
    ]
  });
  writeJson(path.join(outputDir, 'server-health.json'), health);

  const sources = [
    { checkId: 'protocol_registry_ready', producerId: 'urn:uu-aap:producer:protocol-registry-validator', artifact: registry, observedAt: sourceObservedAt },
    { checkId: 'coordination_ready', producerId: 'urn:uu-aap:producer:ccrp-c5-validator', artifact: coordination, observedAt: sourceObservedAt },
    { checkId: 'authority_ready', producerId: 'urn:uu-aap:producer:poai-authority-validator', artifact: authority, observedAt: sourceObservedAt },
    { checkId: 'provenance_ready', producerId: 'urn:uu-aap:producer:origin-provenance-validator', artifact: provenance, observedAt: sourceObservedAt },
    { checkId: 'causal_qualification_ready', producerId: 'urn:uu-aap:producer:causal-qualification-validator', artifact: causal, observedAt: sourceObservedAt },
    { checkId: 'server_health_ready', producerId: 'urn:uu-aap:producer:kontur-server-health-observer', artifact: health, observedAt: sourceObservedAt }
  ];

  const aggregated = await Aggregator.aggregateReadiness({ policy, sources, aggregatedAt, readinessEpoch: 1 });
  const acceptance = await Aggregator.dryRunAcceptReadiness({
    aggregationReceipt: aggregated.receipt,
    readinessSignal: aggregated.readinessSignal,
    responsibilityPolicy,
    evaluatedAt: acceptedAt,
    minimumEpoch: 1,
    parallelActiveHolders: []
  });
  const frontier = await Frontier.buildActivationFrontier({
    gitRevision: `git:${gitSha}`,
    aggregationPolicy: policy,
    responsibilityPolicy,
    readinessSignal: aggregated.readinessSignal,
    aggregationReceipt: aggregated.receipt,
    acceptanceReceipt: acceptance,
    recordedAt: frontierAt
  });

  writeJson(path.join(outputDir, 'evidence-set.json'), aggregated.evidenceSet);
  writeJson(path.join(outputDir, 'readiness-signal.json'), aggregated.readinessSignal);
  writeJson(path.join(outputDir, 'aggregation-receipt.json'), aggregated.receipt);
  writeJson(path.join(outputDir, 'acceptance-receipt.json'), acceptance);
  writeJson(path.join(outputDir, 'activation-frontier.json'), frontier);

  assert(aggregated.readinessSignal.ready === true, 'readiness signal must be ready');
  assert(aggregated.receipt.aggregation_result.passed_check_count === 6, 'six checks must pass');
  assert(acceptance.decision === 'accepted_for_activation_precondition', 'dry-run readiness must be accepted');
  assert(acceptance.claims.kernel_activated === false && acceptance.claims.responsibility_state_created === false,
    'dry-run acceptance must not activate KONTUR');
  assert(frontier.status === 'activation_prompt_may_be_requested' && frontier.claims.human_activation_step_still_required === true,
    'activation frontier must preserve human activation boundary');
  assert(frontier.claims.kernel_activated === false, 'activation frontier cannot activate kernel');

  const vectors = [];
  const aggregate = (overrides = {}) => Aggregator.aggregateReadiness({
    policy: overrides.policy || policy,
    sources: overrides.sources || sources,
    aggregatedAt: overrides.aggregatedAt || aggregatedAt,
    readinessEpoch: overrides.readinessEpoch === undefined ? 1 : overrides.readinessEpoch
  });

  vectors.push(await reject('missing_source', async () => aggregate({ sources: sources.slice(0, 5) }), /exactly six source/));
  vectors.push(await reject('duplicate_check', async () => {
    const changed = clone(sources); changed[5].checkId = changed[4].checkId; await aggregate({ sources: changed });
  }, /missing or duplicate/));
  vectors.push(await reject('duplicate_producer', async () => {
    const changed = clone(sources); changed[5].producerId = changed[4].producerId; await aggregate({ sources: changed });
  }, /producer independence/));
  vectors.push(await reject('wrong_producer', async () => {
    const changed = clone(sources); changed[0].producerId = 'urn:uu-aap:producer:other'; await aggregate({ sources: changed });
  }, /producer substitution/));
  vectors.push(await reject('wrong_artifact_type', async () => {
    const changed = clone(sources); changed[0].artifact.artifact_type = 'OtherRegistry'; await aggregate({ sources: changed });
  }, /source artifact type substitution/));
  vectors.push(await reject('policy_id_substitution', async () => {
    const changed = clone(policy); changed.policy_id = 'urn:uu-aap:kontur:readiness-aggregation-policy:other:1'; await aggregate({ policy: changed });
  }, /policy ID\/version substitution/));
  vectors.push(await reject('policy_version_substitution', async () => {
    const changed = clone(policy); changed.policy_version = 2; await aggregate({ policy: changed });
  }, /policy ID\/version substitution/));
  vectors.push(await reject('policy_scope_substitution', async () => {
    const changed = clone(policy); changed.aggregation_scope = 'urn:uu-aap:kontur:readiness-aggregation-scope:other'; await aggregate({ policy: changed });
  }, /aggregation scope substitution/));
  vectors.push(await reject('stale_evidence', async () => {
    const changed = clone(sources); changed[0].observedAt = iso(captureMs - (policy.evidence_freshness_seconds + 10) * 1000); await aggregate({ sources: changed });
  }, /stale evidence/));
  vectors.push(await reject('future_evidence', async () => {
    const changed = clone(sources); changed[0].observedAt = iso(Date.parse(aggregatedAt) + 1000); await aggregate({ sources: changed });
  }, /observed after aggregation/));
  vectors.push(await reject('coordination_self_permits', async () => {
    const changed = clone(sources); changed[1].artifact.claims.materialization_permitted = true; await aggregate({ sources: changed });
  }, /prohibited claim materialization_permitted/));
  vectors.push(await reject('authority_legal_overclaim', async () => {
    const changed = clone(sources); changed[2].artifact.claims.legal_authority_established = true; await aggregate({ sources: changed });
  }, /prohibited claim legal_authority_established/));
  vectors.push(await reject('provenance_truth_overclaim', async () => {
    const changed = clone(sources); changed[3].artifact.claims.truth_certified = true; await aggregate({ sources: changed });
  }, /prohibited claim truth_certified/));
  vectors.push(await reject('causal_necessity_overclaim', async () => {
    const changed = clone(sources); changed[4].artifact.claims.necessary_cause_established = true; await aggregate({ sources: changed });
  }, /prohibited claim necessary_cause_established/));
  vectors.push(await reject('unhealthy_server', async () => {
    const changed = clone(sources); changed[5].artifact.status = 'degraded'; changed[5].artifact.components[0].status = 'degraded'; await aggregate({ sources: changed });
  }, /server health is not healthy/));
  vectors.push(await reject('wrong_server_identity', async () => {
    const changed = clone(sources); changed[5].artifact.server_instance_id = 'urn:uu-aap:kontur:server:other'; await aggregate({ sources: changed });
  }, /server health identity mismatch/));
  vectors.push(await reject('scalar_readiness_score', async () => {
    const changed = clone(sources); changed[0].artifact.readiness_score = 1; await aggregate({ sources: changed });
  }, /scalar readiness\/responsibility scores prohibited/));
  vectors.push(await reject('invalid_epoch', async () => aggregate({ readinessEpoch: 0 }), /positive readiness epoch/));

  vectors.push(await reject('aggregation_digest_substitution', async () => {
    const bad = clone(aggregated.receipt); bad.evidence_set.evidence[0].source_artifact_digest.value = '0'.repeat(64);
    await Aggregator.validateAggregationReceipt({ receipt: bad, readinessSignal: aggregated.readinessSignal, policy, sources });
  }, /evidence set binding substitution|source digest substitution/));
  vectors.push(await reject('signal_digest_substitution', async () => {
    const bad = clone(aggregated.receipt); bad.readiness_signal_binding.digest.value = '0'.repeat(64);
    await Aggregator.validateAggregationReceipt({ receipt: bad, readinessSignal: aggregated.readinessSignal, policy, sources });
  }, /readiness signal binding substitution/));

  vectors.push(await reject('expired_signal_acceptance', async () => {
    await Aggregator.dryRunAcceptReadiness({
      aggregationReceipt: aggregated.receipt,
      readinessSignal: aggregated.readinessSignal,
      responsibilityPolicy,
      evaluatedAt: iso(Date.parse(aggregated.readinessSignal.valid_until) + 1),
      minimumEpoch: 1,
      parallelActiveHolders: []
    });
  }, /expired or not yet valid/));
  vectors.push(await reject('wrong_responsibility_policy', async () => {
    const changed = clone(responsibilityPolicy); changed.policy_version = 2;
    await Aggregator.dryRunAcceptReadiness({
      aggregationReceipt: aggregated.receipt, readinessSignal: aggregated.readinessSignal,
      responsibilityPolicy: changed, evaluatedAt: acceptedAt, parallelActiveHolders: []
    });
  }, /responsibility policy substitution/));
  vectors.push(await reject('parallel_active_holder', async () => {
    await Aggregator.dryRunAcceptReadiness({
      aggregationReceipt: aggregated.receipt, readinessSignal: aggregated.readinessSignal,
      responsibilityPolicy, evaluatedAt: acceptedAt,
      parallelActiveHolders: ['urn:uu-aap:kontur:holder:parallel']
    });
  }, /parallel active holder frontier/));
  vectors.push(await reject('stale_epoch_acceptance', async () => {
    await Aggregator.dryRunAcceptReadiness({
      aggregationReceipt: aggregated.receipt, readinessSignal: aggregated.readinessSignal,
      responsibilityPolicy, evaluatedAt: acceptedAt, minimumEpoch: 2, parallelActiveHolders: []
    });
  }, /stale readiness epoch/));
  vectors.push(await reject('acceptance_binding_substitution', async () => {
    const bad = clone(acceptance); bad.readiness_signal_binding.digest.value = '0'.repeat(64);
    await Aggregator.validateReadinessAcceptanceReceipt({
      receipt: bad, aggregationReceipt: aggregated.receipt,
      readinessSignal: aggregated.readinessSignal, responsibilityPolicy
    });
  }, /readiness signal binding substitution/));
  vectors.push(await reject('frontier_git_revision_invalid', async () => {
    await Frontier.buildActivationFrontier({
      gitRevision: 'git:not-a-sha', aggregationPolicy: policy, responsibilityPolicy,
      readinessSignal: aggregated.readinessSignal, aggregationReceipt: aggregated.receipt,
      acceptanceReceipt: acceptance, recordedAt: frontierAt
    });
  }, /exact Git revision/));
  vectors.push(await reject('frontier_acceptance_overclaim', async () => {
    const bad = clone(acceptance); bad.claims.kernel_activated = true;
    await Frontier.buildActivationFrontier({
      gitRevision: `git:${gitSha}`, aggregationPolicy: policy, responsibilityPolicy,
      readinessSignal: aggregated.readinessSignal, aggregationReceipt: aggregated.receipt,
      acceptanceReceipt: bad, recordedAt: frontierAt
    });
  }, /prohibited claim kernel_activated/));

  writeJson(path.join(outputDir, 'summary.json'), {
    suite: 'KONTUR Readiness Aggregator v0.1',
    git_revision: `git:${gitSha}`,
    readiness_epoch: aggregated.readinessSignal.readiness_epoch,
    checks: aggregated.readinessSignal.checks.map((item) => ({ check_id: item.check_id, status: item.status })),
    readiness_signal_ref: aggregated.readinessSignal.signal_id,
    aggregation_ref: aggregated.receipt.aggregation_id,
    acceptance_ref: acceptance.acceptance_id,
    activation_frontier_ref: frontier.frontier_id,
    activation_prompt_may_be_requested: true,
    kernel_activated: false,
    negative_vectors: vectors.length
  });

  console.log(JSON.stringify({
    suite: 'KONTUR Readiness Aggregator v0.1',
    git_revision: `git:${gitSha}`,
    ready: aggregated.readinessSignal.ready,
    accepted: acceptance.claims.readiness_signal_accepted,
    activation_prompt_may_be_requested: frontier.claims.activation_prompt_may_be_requested,
    kernel_activated: frontier.claims.kernel_activated,
    negative_vectors: vectors.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
