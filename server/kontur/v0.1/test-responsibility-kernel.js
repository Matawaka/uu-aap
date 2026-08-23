'use strict';

const fs = require('fs');
const path = require('path');
const {
  transitionResponsibility,
  validateResponsibilityTransitionReceipt
} = require('./responsibility-kernel.js');

const repoRoot = path.resolve(__dirname, '../../..');
const policy = JSON.parse(fs.readFileSync(path.join(__dirname, 'policies/reference-server.responsibility-policy.json'), 'utf8'));

function assert(value, message) { if (!value) throw new Error(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
async function reject(name, fn, pattern) {
  let error = null;
  try { await fn(); } catch (value) { error = value; }
  assert(error, `${name}: expected failure`);
  if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  return { name, error: error.message };
}

const requiredChecks = [
  'protocol_registry_ready',
  'coordination_ready',
  'authority_ready',
  'provenance_ready',
  'causal_qualification_ready',
  'server_health_ready'
];

function readiness(epoch, emittedAt, validUntil, suffix = String(epoch)) {
  return {
    $schema: './kontur-readiness-signal.schema.json',
    artifact_type: 'KONTURReadinessSignal',
    artifact_version: '0.1',
    signal_id: `urn:uu-aap:kontur:readiness:reference-${suffix}`,
    system_id: policy.system_id,
    server_instance_id: policy.server_instance_id,
    readiness_epoch: epoch,
    emitted_at: emittedAt,
    valid_until: validUntil,
    source_ref: `urn:uu-aap:kontur:readiness-source:${suffix}`,
    checks: requiredChecks.map((checkId, index) => ({
      check_id: checkId,
      status: 'pass',
      observed_at: `2026-08-23T09:0${Math.min(index, 5)}:00Z`,
      evidence_ref: `urn:uu-aap:evidence:${suffix}:${checkId}`
    })),
    ready: true,
    claims: {
      readiness_observed: true,
      execution_authority_granted: false,
      responsibility_accepted: false,
      kernel_activated: false,
      legal_responsibility_determined: false,
      moral_blame_assigned: false,
      truth_certified: false,
      poai_materialization_event_recorded: false,
      universal_canonicality_established: false
    }
  };
}

function healthy(at) {
  return {
    status: 'healthy',
    observed_at: at,
    components: [
      { component_id: 'event-loop', status: 'pass' },
      { component_id: 'storage', status: 'pass' },
      { component_id: 'coordination-link', status: 'pass' }
    ]
  };
}
function degraded(at) {
  return {
    status: 'degraded',
    observed_at: at,
    components: [
      { component_id: 'event-loop', status: 'pass' },
      { component_id: 'storage', status: 'degraded' },
      { component_id: 'coordination-link', status: 'pass' }
    ]
  };
}
function critical(at) {
  return {
    status: 'critical',
    observed_at: at,
    components: [
      { component_id: 'event-loop', status: 'pass' },
      { component_id: 'storage', status: 'fail' },
      { component_id: 'coordination-link', status: 'degraded' }
    ]
  };
}
function lease(id, issuedAt, expiresAt, holder = 'urn:uu-aap:kontur:holder:reference-control-plane') {
  return {
    lease_id: `urn:uu-aap:kontur:lease:${id}`,
    holder_id: holder,
    server_instance_id: policy.server_instance_id,
    issued_at: issuedAt,
    expires_at: expiresAt
  };
}

const holderId = 'urn:uu-aap:kontur:holder:reference-control-plane';
const scopes = [
  'server.readiness.consume',
  'server.responsibility.maintain',
  'server.degradation.control',
  'server.transition.audit'
];

async function main() {
  const outputPath = process.argv[2] || '/tmp/kontur-responsibility-chain.json';
  const r1 = readiness(1, '2026-08-23T09:06:00Z', '2026-08-23T09:30:00Z', 'epoch-1');

  const activate = await transitionResponsibility({
    policy,
    readinessSignal: r1,
    predecessorState: null,
    transitionKind: 'activate',
    evaluatedAt: '2026-08-23T09:07:00Z',
    holderId,
    responsibilityScopes: scopes,
    fencingEpoch: 1,
    lease: lease('g1', '2026-08-23T09:06:30Z', '2026-08-23T09:20:00Z'),
    health: healthy('2026-08-23T09:06:50Z'),
    triggerRef: r1.signal_id,
    parallelActiveHolders: []
  });
  assert(activate.resulting_state.lifecycle_state === 'active' && activate.resulting_state.generation === 1,
    'genesis activation failed');

  const heartbeat = await transitionResponsibility({
    policy,
    predecessorState: activate.resulting_state,
    transitionKind: 'heartbeat',
    evaluatedAt: '2026-08-23T09:10:00Z',
    holderId,
    responsibilityScopes: scopes,
    fencingEpoch: 1,
    lease: lease('g2', '2026-08-23T09:09:30Z', '2026-08-23T09:25:00Z'),
    health: healthy('2026-08-23T09:09:50Z'),
    triggerRef: 'urn:uu-aap:kontur:heartbeat:g2',
    parallelActiveHolders: []
  });
  assert(heartbeat.resulting_state.lifecycle_state === 'active' && heartbeat.resulting_state.generation === 2,
    'heartbeat renewal failed');

  const degradeReceipt = await transitionResponsibility({
    policy,
    predecessorState: heartbeat.resulting_state,
    transitionKind: 'degrade',
    evaluatedAt: '2026-08-23T09:12:00Z',
    holderId,
    responsibilityScopes: scopes,
    fencingEpoch: 1,
    lease: clone(heartbeat.resulting_state.lease),
    health: degraded('2026-08-23T09:11:50Z'),
    triggerRef: 'urn:uu-aap:kontur:health:degraded:g3',
    parallelActiveHolders: []
  });
  assert(degradeReceipt.resulting_state.lifecycle_state === 'degraded' && degradeReceipt.resulting_state.generation === 3,
    'degradation transition failed');

  const suspend = await transitionResponsibility({
    policy,
    predecessorState: degradeReceipt.resulting_state,
    transitionKind: 'suspend',
    evaluatedAt: '2026-08-23T09:13:00Z',
    holderId,
    responsibilityScopes: scopes,
    fencingEpoch: 1,
    lease: clone(degradeReceipt.resulting_state.lease),
    health: critical('2026-08-23T09:12:50Z'),
    triggerRef: 'urn:uu-aap:kontur:health:critical:g4',
    parallelActiveHolders: []
  });
  assert(suspend.resulting_state.lifecycle_state === 'suspended' && suspend.resulting_state.generation === 4,
    'critical suspension failed');

  const r2 = readiness(2, '2026-08-23T09:14:00Z', '2026-08-23T09:45:00Z', 'epoch-2');
  r2.checks = r2.checks.map((check, index) => ({ ...check, observed_at: `2026-08-23T09:1${Math.min(index, 3)}:00Z` }));
  const resume = await transitionResponsibility({
    policy,
    readinessSignal: r2,
    predecessorState: suspend.resulting_state,
    transitionKind: 'resume',
    evaluatedAt: '2026-08-23T09:15:00Z',
    holderId,
    responsibilityScopes: scopes,
    fencingEpoch: 2,
    lease: lease('g5', '2026-08-23T09:14:30Z', '2026-08-23T09:35:00Z'),
    health: healthy('2026-08-23T09:14:50Z'),
    triggerRef: r2.signal_id,
    parallelActiveHolders: []
  });
  assert(resume.resulting_state.lifecycle_state === 'active' && resume.resulting_state.generation === 5 &&
    resume.resulting_state.fencing_epoch === 2,
    'fresh readiness recovery failed');

  const retire = await transitionResponsibility({
    policy,
    predecessorState: resume.resulting_state,
    transitionKind: 'retire',
    evaluatedAt: '2026-08-23T09:16:00Z',
    holderId,
    responsibilityScopes: scopes,
    fencingEpoch: 2,
    lease: clone(resume.resulting_state.lease),
    health: healthy('2026-08-23T09:15:50Z'),
    triggerRef: 'urn:uu-aap:kontur:retirement:reference',
    parallelActiveHolders: []
  });
  assert(retire.resulting_state.lifecycle_state === 'retired' && retire.resulting_state.generation === 6,
    'retirement failed');

  const vectors = [];
  vectors.push(await reject('readiness_system_mismatch', async () => {
    const bad = clone(r1); bad.system_id = 'urn:uu-aap:kontur:system:other';
    await transitionResponsibility({ policy, readinessSignal: bad, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x1','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: bad.signal_id, parallelActiveHolders: [] });
  }, /system identity mismatch/));

  vectors.push(await reject('missing_readiness_check', async () => {
    const bad = clone(r1); bad.checks.pop();
    await transitionResponsibility({ policy, readinessSignal: bad, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x2','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: bad.signal_id, parallelActiveHolders: [] });
  }, /missing readiness check/));

  vectors.push(await reject('failed_readiness_check', async () => {
    const bad = clone(r1); bad.checks[0].status = 'fail';
    await transitionResponsibility({ policy, readinessSignal: bad, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x3','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: bad.signal_id, parallelActiveHolders: [] });
  }, /readiness check failed/));

  vectors.push(await reject('expired_readiness', async () => {
    const bad = clone(r1); bad.valid_until = '2026-08-23T09:06:59Z';
    await transitionResponsibility({ policy, readinessSignal: bad, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x4','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: bad.signal_id, parallelActiveHolders: [] });
  }, /readiness signal expired/));

  vectors.push(await reject('activation_fencing_mismatch', async () => {
    await transitionResponsibility({ policy, readinessSignal: r1, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 2, lease: lease('x5','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: r1.signal_id, parallelActiveHolders: [] });
  }, /must equal readiness epoch/));

  vectors.push(await reject('expired_active_lease', async () => {
    await transitionResponsibility({ policy, readinessSignal: r1, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x6','2026-08-23T09:05:00Z','2026-08-23T09:06:59Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: r1.signal_id, parallelActiveHolders: [] });
  }, /expired lease/));

  vectors.push(await reject('lease_holder_mismatch', async () => {
    await transitionResponsibility({ policy, readinessSignal: r1, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x7','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z','urn:uu-aap:kontur:holder:other'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: r1.signal_id, parallelActiveHolders: [] });
  }, /lease holder mismatch/));

  vectors.push(await reject('empty_responsibility_scope', async () => {
    await transitionResponsibility({ policy, readinessSignal: r1, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: [], fencingEpoch: 1, lease: lease('x8','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: r1.signal_id, parallelActiveHolders: [] });
  }, /non-empty responsibility scope/));

  vectors.push(await reject('parallel_active_holder', async () => {
    await transitionResponsibility({ policy, readinessSignal: r1, predecessorState: null, transitionKind: 'activate', evaluatedAt: '2026-08-23T09:07:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x9','2026-08-23T09:06:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:06:50Z'), triggerRef: r1.signal_id, parallelActiveHolders: ['urn:uu-aap:kontur:holder:other'] });
  }, /parallel active holder/));

  vectors.push(await reject('heartbeat_changes_fencing', async () => {
    await transitionResponsibility({ policy, predecessorState: activate.resulting_state, transitionKind: 'heartbeat', evaluatedAt: '2026-08-23T09:10:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 2, lease: lease('x10','2026-08-23T09:09:00Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:09:50Z'), triggerRef: 'urn:uu-aap:kontur:heartbeat:x10', parallelActiveHolders: [] });
  }, /heartbeat fencing epoch drift/));

  vectors.push(await reject('heartbeat_after_suspension', async () => {
    await transitionResponsibility({ policy, predecessorState: suspend.resulting_state, transitionKind: 'heartbeat', evaluatedAt: '2026-08-23T09:14:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x11','2026-08-23T09:13:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:13:50Z'), triggerRef: 'urn:uu-aap:kontur:heartbeat:x11', parallelActiveHolders: [] });
  }, /heartbeat requires active predecessor/));

  vectors.push(await reject('resume_without_fresh_readiness', async () => {
    await transitionResponsibility({ policy, readinessSignal: null, predecessorState: suspend.resulting_state, transitionKind: 'resume', evaluatedAt: '2026-08-23T09:15:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 2, lease: lease('x12','2026-08-23T09:14:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:14:50Z'), triggerRef: 'urn:uu-aap:kontur:resume:x12', parallelActiveHolders: [] });
  }, /KONTURReadinessSignal/));

  vectors.push(await reject('resume_stale_readiness_epoch', async () => {
    const stale = readiness(1, '2026-08-23T09:14:00Z', '2026-08-23T09:45:00Z', 'stale');
    stale.checks = stale.checks.map((check) => ({ ...check, observed_at: '2026-08-23T09:13:00Z' }));
    await transitionResponsibility({ policy, readinessSignal: stale, predecessorState: suspend.resulting_state, transitionKind: 'resume', evaluatedAt: '2026-08-23T09:15:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 1, lease: lease('x13','2026-08-23T09:14:30Z','2026-08-23T09:20:00Z'), health: healthy('2026-08-23T09:14:50Z'), triggerRef: stale.signal_id, parallelActiveHolders: [] });
  }, /stale readiness epoch/));

  vectors.push(await reject('retired_is_terminal', async () => {
    await transitionResponsibility({ policy, readinessSignal: r2, predecessorState: retire.resulting_state, transitionKind: 'resume', evaluatedAt: '2026-08-23T09:17:00Z', holderId, responsibilityScopes: scopes, fencingEpoch: 3, lease: lease('x14','2026-08-23T09:16:30Z','2026-08-23T09:25:00Z'), health: healthy('2026-08-23T09:16:50Z'), triggerRef: r2.signal_id, parallelActiveHolders: [] });
  }, /retired state is terminal/));

  vectors.push(await reject('predecessor_digest_substitution', async () => {
    const bad = clone(heartbeat); bad.predecessor_state_binding.digest.value = '0'.repeat(64);
    await validateResponsibilityTransitionReceipt({ receipt: bad, policy, predecessorState: activate.resulting_state });
  }, /predecessor state binding substitution/));

  vectors.push(await reject('generation_skip', async () => {
    const bad = clone(heartbeat); bad.resulting_state.generation = 9;
    await validateResponsibilityTransitionReceipt({ receipt: bad, policy, predecessorState: activate.resulting_state });
  }, /resulting state binding substitution|successor generation/));

  vectors.push(await reject('readiness_binding_substitution', async () => {
    const bad = clone(activate); bad.readiness_binding.digest.value = '0'.repeat(64);
    await validateResponsibilityTransitionReceipt({ receipt: bad, policy, readinessSignal: r1, predecessorState: null });
  }, /activation readiness binding substitution/));

  vectors.push(await reject('policy_binding_substitution', async () => {
    const bad = clone(activate); bad.policy_binding.digest.value = '0'.repeat(64);
    await validateResponsibilityTransitionReceipt({ receipt: bad, policy, readinessSignal: r1, predecessorState: null });
  }, /policy binding substitution/));

  vectors.push(await reject('scalar_responsibility_score_injection', async () => {
    const bad = clone(activate); bad.resulting_state.responsibility_score = 0.95;
    await validateResponsibilityTransitionReceipt({ receipt: bad, policy, readinessSignal: r1, predecessorState: null });
  }, /scalar responsibility\/probability scores/));

  vectors.push(await reject('legal_responsibility_overclaim', async () => {
    const bad = clone(activate); bad.claims.legal_responsibility_determined = true;
    await validateResponsibilityTransitionReceipt({ receipt: bad, policy, readinessSignal: r1, predecessorState: null });
  }, /prohibited claim legal_responsibility_determined/));

  const chain = { activate, heartbeat, degrade: degradeReceipt, suspend, resume, retire };
  fs.writeFileSync(outputPath, JSON.stringify(chain, null, 2) + '\n');
  console.log(JSON.stringify({
    suite: 'KONTUR Responsibility Kernel v0.1',
    generations: Object.values(chain).map((receipt) => ({
      transition: receipt.transition_kind,
      generation: receipt.resulting_state.generation,
      state: receipt.resulting_state.lifecycle_state,
      fencing_epoch: receipt.resulting_state.fencing_epoch
    })),
    final_state: retire.resulting_state.lifecycle_state,
    negative_vectors: vectors.length,
    legal_responsibility_determined: retire.claims.legal_responsibility_determined,
    truth_certified: retire.claims.truth_certified
  }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
