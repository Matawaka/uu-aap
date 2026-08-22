'use strict';

const fs = require('fs');
const path = require('path');
const Core = require('./tools/materialization-core.js');

function read(rel) { return JSON.parse(fs.readFileSync(path.resolve(__dirname, rel), 'utf8')); }
function write(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

(async () => {
  const policy = read('./examples/synthetic-shipment.materialization-policy.json');
  const source = read('../examples/quasi-existent-future.synthetic.poai.json');
  const successorTemplate = read('../examples/quasi-existent-future.synthetic.successor.poai.json');
  const candidate = Core.normalizedSuccessorCandidate(source, successorTemplate);
  const authority = {
    subject: 'key:synthetic-materializer',
    scope: Core.EXECUTE_SCOPE,
    target: policy.authority_verification_rule.required_target,
    valid_from: '2026-07-01T00:00:00Z',
    valid_until: '2026-08-01T00:00:00Z',
    delegation_mode: 'non_delegable',
    delegated_from: null,
    issuer_entitlement_verified: true,
    authority_verified: true,
    evidence_refs: ['urn:poai:authority-evidence:synthetic-materializer', 'urn:poai:issuer-entitlement:synthetic-policy-root']
  };
  const event = await Core.buildMaterializationEvent({
    source, candidate, policy,
    successorProposalRef: 'urn:poai:successor-proposal:synthetic-shipment-r2',
    authority,
    contest: { active_stay: false, refs: [] },
    conflict: { status: 'none', candidate_refs: [candidate.record_id] },
    recordedAt: '2026-07-16T12:00:00Z'
  });

  const positiveErrors = await Core.validateMaterializationEvent(event, { source, candidate, policy });
  assert(positiveErrors.length === 0, `positive vector failed: ${positiveErrors.join(', ')}`);
  assert(event.declared_disposition === 'materialized', 'positive vector should materialize');
  assert(event.canonicality_claim.status === 'materialized', 'positive vector should establish policy-relative materialized status');
  assert(event.claims.truth_certified === false, 'materialization must not certify truth');
  assert(event.claims.poai_v_conformance_established === false, 'materialization must not establish PoAI/V');

  const cases = [
    ['proposal_scope_used_as_execute_scope', e => { e.authority_evaluation.scope = 'poai.successor.materialization.propose'; }],
    ['candidate_digest_substitution', e => { e.candidate_successor.digest.value = '0'.repeat(64); }],
    ['policy_version_substitution', e => { e.materialization_policy.policy_version = 2; }],
    ['authority_outside_validity_window', e => { e.authority_evaluation.valid_until = '2026-07-15T00:00:00Z'; }],
    ['authority_target_mismatch', e => { e.authority_evaluation.target = 'github:Other/example'; }],
    ['non_delegable_authority_redelegated', e => { e.authority_evaluation.delegated_from = 'urn:poai:authority-evidence:upstream'; }],
    ['active_stay_ignored', e => { e.contest_or_stay.active_stay = true; e.contest_or_stay.refs = ['urn:poai:appeal:synthetic']; }],
    ['single_head_conflict_silently_selected', e => { e.conflict_state.status = 'unresolved'; e.conflict_state.candidate_refs = [candidate.record_id, 'urn:poai:record:synthetic-shipment:delay-risk:2b']; }],
    ['materialization_claims_truth_certified', e => { e.claims.truth_certified = true; }]
  ];

  for (const [expected, mutate] of cases) {
    const bad = clone(event); mutate(bad);
    const errors = await Core.validateMaterializationEvent(bad, { source, candidate, policy });
    assert(errors.includes(expected), `${expected}: expected error not found; got ${errors.join(', ')}`);
  }

  const rewrittenCandidate = clone(candidate);
  rewrittenCandidate.decision_boundary.knowledge_cutoff = '2026-07-10T09:29:59Z';
  const rewrittenEvent = clone(event);
  rewrittenEvent.candidate_successor.digest.value = await Core.digestJson(rewrittenCandidate);
  const rewrittenErrors = await Core.validateMaterializationEvent(rewrittenEvent, { source, candidate: rewrittenCandidate, policy });
  assert(rewrittenErrors.includes('decision_boundary_rewritten_in_successor'), `decision boundary rewrite was not rejected: ${rewrittenErrors.join(', ')}`);

  const policySwap = clone(policy);
  policySwap.policy_version = 2;
  const policySwapErrors = await Core.validateMaterializationEvent(event, { source, candidate, policy: policySwap });
  assert(policySwapErrors.includes('policy_digest_substitution') || policySwapErrors.includes('policy_version_substitution'), 'policy substitution was not rejected');

  const outEvent = process.argv[2] || '/tmp/materialization-event.json';
  const outCandidate = process.argv[3] || '/tmp/materialization-candidate.json';
  write(outEvent, event);
  write(outCandidate, candidate);
  console.log(`materialization tests passed; event=${outEvent}; candidate=${outCandidate}`);
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
