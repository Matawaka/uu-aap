'use strict';

const fs = require('fs');
const path = require('path');
const C3 = require(path.resolve(__dirname, 'tools/ccrp-c3.js'));

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const outDir = process.argv[2] || '/tmp/ccrp-c3';
const baseRevision = 'git:4eb19eb841bc4202f4dc483d33e2bb38c750ba91';
const evaluatedAt = '2026-08-22T23:44:00Z';
const target = 'ccrp:shared-document:proof-of-available-intelligence';
const intentId = 'urn:ccrp:intent:convergent-collaboration-c3';
const intentDigest = `sha256:${'c'.repeat(64)}`;

const baseState = {
  document: {
    title: 'CCRP v0.1',
    metadata: {
      status: 'draft',
      labels: ['poai']
    }
  }
};

function claims() {
  return {
    context_bound: true,
    source_intent_preserved: true,
    reconciliation_checked: false,
    coordination_relative_convergence_established: false,
    execution_admitted: false,
    materialization_permitted: false,
    canonical_state_established: false,
    poai_authority_established: false,
    policy_relative_canonicality_established: false,
    universal_canonicality_established: false,
    truth_certified: false,
    causal_proof_certified: false,
    legal_responsibility_determined: false,
    moral_correctness_established: false,
    legal_effect_established: false,
    poai_v_conformance_established: false
  };
}

function operation({ suffix, session, context, mutations, concurrencyClass = 'mergeable', key = null, base = baseRevision, digest = intentDigest }) {
  return {
    artifact_type: 'CCRPCollaborationOperation',
    artifact_version: '0.1-experimental',
    ccrp_version: '0.1',
    conformance_level: 'CCRP/C3',
    operation_id: `urn:ccrp:collaboration-operation:uu-aap:${suffix}`,
    context_ref: {
      context_id: `urn:ccrp:context:uu-aap:${context}`,
      actor_id: 'urn:ccrp:actor:chatgpt-project-agent',
      session_id: `urn:ccrp:session:${session}`,
      intent_id: intentId,
      intent_revision: 1,
      intent_digest: digest
    },
    target,
    base_revision: base,
    concurrency_class: concurrencyClass,
    idempotency_key: key || `ccrp-c3-${suffix}`,
    causal_predecessors: [],
    mutations,
    created_at: session === 'chat-a' ? '2026-08-22T23:43:01Z' : '2026-08-22T23:43:00Z',
    claims: claims()
  };
}

const operationA = operation({
  suffix: 'chat-a:structured-edit:1',
  session: 'chat-a',
  context: 'collab-a:1',
  mutations: [
    { kind: 'set', path: '/document/metadata/status', value: 'review' },
    { kind: 'set_add', path: '/document/metadata/labels', values: ['protocol'] }
  ]
});
const operationB = operation({
  suffix: 'chat-b:structured-edit:1',
  session: 'chat-b',
  context: 'collab-b:1',
  mutations: [
    { kind: 'set', path: '/document/title', value: 'CCRP v0.1 — Convergent Collaboration' },
    { kind: 'set_add', path: '/document/metadata/labels', values: ['ccrp', 'collaboration'] }
  ]
});

assert(C3.operationBoundaryErrors(operationA).length === 0, 'operation A must satisfy C3 operation boundary');
assert(C3.operationBoundaryErrors(operationB).length === 0, 'operation B must satisfy C3 operation boundary');
assert(operationA.context_ref.context_id !== operationB.context_ref.context_id, 'C3 vector must preserve distinct source contexts');
assert(operationA.context_ref.session_id !== operationB.context_ref.session_id, 'C3 vector must preserve distinct sessions');
assert(operationA.context_ref.intent_digest === operationB.context_ref.intent_digest, 'C3 vector must explicitly bind the same intent semantics');
assert(new Date(operationA.created_at).getTime() > new Date(operationB.created_at).getTime(), 'arrival/timestamp ordering vector must not accidentally match deterministic operation ordering');

const originalA = JSON.stringify(operationA);
const originalB = JSON.stringify(operationB);

const forward = C3.reconcileC3({ operations: [operationA, operationB], inputState: baseState, evaluatedAt });
const reverse = C3.reconcileC3({ operations: [operationB, operationA], inputState: baseState, evaluatedAt });
assert(forward.decision === 'merge', 'compatible mergeable operations must converge');
assert(reverse.decision === 'merge', 'reversed arrival order must also converge');
assert(JSON.stringify(forward) === JSON.stringify(reverse), 'reconciliation result must be independent of arrival order');
assert(forward.provisional_converged_projection_digest === reverse.provisional_converged_projection_digest, 'reversed arrival order must produce the same projection digest');
assert(forward.deterministic_operation_order[0] === operationA.operation_id, 'deterministic operation order must use stable operation identity, not timestamps');
assert(forward.provisional_converged_projection.document.title === 'CCRP v0.1 — Convergent Collaboration', 'independent title edit must converge');
assert(forward.provisional_converged_projection.document.metadata.status === 'review', 'independent status edit must converge');
assert(JSON.stringify(forward.provisional_converged_projection.document.metadata.labels) === JSON.stringify(['ccrp', 'collaboration', 'poai', 'protocol']), 'set_add operations must converge by deterministic set union');
assert(forward.claims.coordination_relative_convergence_established === true, 'successful C3 merge may establish coordination-relative convergence');
assert(forward.claims.canonical_state_established === false, 'C3 merge must not establish canonical state');
assert(forward.claims.materialization_permitted === false, 'C3 merge must not establish materialization permission');
assert(C3.validateC3Boundary(forward).length === 0, 'positive C3 boundary must validate');

const identicalA = operation({
  suffix: 'chat-a:identical-set:1', session: 'chat-a', context: 'collab-a:1',
  mutations: [{ kind: 'set', path: '/document/metadata/status', value: 'review' }]
});
const identicalB = operation({
  suffix: 'chat-b:identical-set:1', session: 'chat-b', context: 'collab-b:1',
  mutations: [{ kind: 'set', path: '/document/metadata/status', value: 'review' }]
});
const identical = C3.reconcileC3({ operations: [identicalB, identicalA], inputState: baseState, evaluatedAt });
assert(identical.decision === 'merge', 'identical same-path set operations must converge idempotently');
assert(identical.provisional_converged_projection.document.metadata.status === 'review', 'identical set value must be applied once semantically');
assert(C3.validateC3Boundary(identical).length === 0, 'identical-set C3 boundary must validate');

const conflictA = operation({
  suffix: 'chat-a:conflicting-status:1', session: 'chat-a', context: 'collab-a:1',
  mutations: [{ kind: 'set', path: '/document/metadata/status', value: 'accepted' }]
});
const conflictB = operation({
  suffix: 'chat-b:conflicting-status:1', session: 'chat-b', context: 'collab-b:1',
  mutations: [{ kind: 'set', path: '/document/metadata/status', value: 'rejected' }]
});
const semanticConflict = C3.reconcileC3({ operations: [conflictA, conflictB], inputState: baseState, evaluatedAt });
assert(semanticConflict.decision === 'human_resolution_required', 'different same-path values must not choose an arbitrary winner');
assert(semanticConflict.reason_codes.includes('semantic_write_conflict'), 'semantic conflict reason must be explicit');
assert(semanticConflict.conflict_paths.includes('/document/metadata/status'), 'conflicting path must remain observable');
assert(semanticConflict.provisional_converged_projection === null, 'semantic conflict must not emit a winner projection');
assert(semanticConflict.claims.human_resolution_required === true, 'semantic conflict must require explicit resolution');
assert(C3.validateC3Boundary(semanticConflict).length === 0, 'semantic-conflict C3 boundary must validate');

const overlapA = operation({
  suffix: 'chat-a:parent-write:1', session: 'chat-a', context: 'collab-a:1',
  mutations: [{ kind: 'set', path: '/document/metadata', value: { status: 'review', labels: ['poai'] } }]
});
const overlapB = operation({
  suffix: 'chat-b:child-write:1', session: 'chat-b', context: 'collab-b:1',
  mutations: [{ kind: 'set', path: '/document/metadata/status', value: 'accepted' }]
});
const pathOverlap = C3.reconcileC3({ operations: [overlapA, overlapB], inputState: baseState, evaluatedAt });
assert(pathOverlap.decision === 'human_resolution_required', 'parent/child semantic overlap must not be silently ordered');
assert(pathOverlap.reason_codes.includes('semantic_path_overlap'), 'parent/child overlap reason must be explicit');
assert(C3.validateC3Boundary(pathOverlap).length === 0, 'path-overlap C3 boundary must validate');

const exclusive = clone(operationB);
exclusive.operation_id = 'urn:ccrp:collaboration-operation:uu-aap:chat-b:exclusive:1';
exclusive.idempotency_key = 'ccrp-c3-exclusive-1';
exclusive.concurrency_class = 'exclusive';
const exclusiveResult = C3.reconcileC3({ operations: [operationA, exclusive], inputState: baseState, evaluatedAt });
assert(exclusiveResult.decision === 'reject', 'exclusive operation must be rejected from C3 merge path');
assert(exclusiveResult.reason_codes.includes('exclusive_operation_requires_c2_fencing'), 'exclusive C3 rejection must point to C2 fencing');
assert(C3.validateC3Boundary(exclusiveResult).length === 0, 'exclusive rejection boundary must validate');

const staleBase = clone(operationB);
staleBase.operation_id = 'urn:ccrp:collaboration-operation:uu-aap:chat-b:stale-base:1';
staleBase.idempotency_key = 'ccrp-c3-stale-base-1';
staleBase.base_revision = 'git:2321c014c8f67999b01fc765e1415d785517a2a0';
const baseMismatch = C3.reconcileC3({ operations: [operationA, staleBase], inputState: baseState, evaluatedAt });
assert(baseMismatch.decision === 'hold', 'base mismatch must be held rather than silently rebased');
assert(baseMismatch.reason_codes.includes('base_revision_mismatch_rebase_required'), 'base mismatch must require explicit rebase');
assert(C3.validateC3Boundary(baseMismatch).length === 0, 'base-mismatch C3 boundary must validate');

const foreignIntent = clone(operationB);
foreignIntent.operation_id = 'urn:ccrp:collaboration-operation:uu-aap:chat-b:foreign-intent:1';
foreignIntent.idempotency_key = 'ccrp-c3-foreign-intent-1';
foreignIntent.context_ref.intent_digest = `sha256:${'d'.repeat(64)}`;
const intentMismatch = C3.reconcileC3({ operations: [operationA, foreignIntent], inputState: baseState, evaluatedAt });
assert(intentMismatch.decision === 'reject', 'different intent semantics must not converge merely because targets match');
assert(intentMismatch.reason_codes.includes('intent_binding_mismatch'), 'intent mismatch reason must be explicit');
assert(C3.validateC3Boundary(intentMismatch).length === 0, 'intent-mismatch C3 boundary must validate');

const duplicateDelivery = clone(operationB);
duplicateDelivery.operation_id = 'urn:ccrp:collaboration-operation:uu-aap:chat-b:duplicate-delivery:1';
duplicateDelivery.idempotency_key = operationA.idempotency_key;
const duplicate = C3.reconcileC3({ operations: [operationA, duplicateDelivery], inputState: baseState, evaluatedAt });
assert(duplicate.decision === 'reject', 'duplicate idempotency key must not produce a second effect');
assert(duplicate.reason_codes.includes('duplicate_idempotency_key'), 'duplicate reason must be explicit');
assert(C3.validateC3Boundary(duplicate).length === 0, 'duplicate C3 boundary must validate');

assert(JSON.stringify(operationA) === originalA, 'C3 reconciliation must not rewrite source operation A');
assert(JSON.stringify(operationB) === originalB, 'C3 reconciliation must not rewrite source operation B');

fs.mkdirSync(outDir, { recursive: true });
const outputs = {
  forward,
  reverse,
  identical,
  semanticConflict,
  pathOverlap,
  exclusiveResult,
  baseMismatch,
  intentMismatch,
  duplicate
};
fs.writeFileSync(path.join(outDir, 'operationA.collaboration-operation.json'), `${JSON.stringify(operationA, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'operationB.collaboration-operation.json'), `${JSON.stringify(operationB, null, 2)}\n`);
for (const [name, result] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outDir, `${name}.reconciliation-result.json`), `${JSON.stringify(result, null, 2)}\n`);
}

console.log('CCRP/C3 convergent collaboration vectors passed');
console.log('arrival_order != semantic_priority confirmed');
console.log('deterministic_convergence != materialization confirmed');
console.log('semantic_conflict -> human_resolution_required confirmed');
