'use strict';

// Contract regressions against the existing validator, not a PCC authenticator.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repo = path.resolve(__dirname, '../../../../..');
const integration = path.join(repo, 'protocols/integration');
const seam = path.join(integration, 'execute-revalidation/v0.1');
const { validateDecision, hashWithoutContentHash } = require(
  path.join(seam, 'validate-parameterized-decision.js')
);
const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const start = '2026-11-16T12:00:00.000Z';
const deadline = '2026-11-16T12:05:00.000Z';
const dateFields = ['availability_valid_until', 'approval_valid_until',
  'permit_expires_at', 'authorization_must_occur_by'];

function seal(record) {
  record.content_hash = hashWithoutContentHash(record);
  return record;
}

function pair() {
  const decision = read(path.join(seam, 'conformance.fixture.json'));
  const admission = read(path.join(integration,
    'pre-action-authorize-admission/v0.1/conformance.fixture.json'));
  admission.evaluated_at = start;
  decision.evaluated_at = start;
  for (const key of dateFields) {
    admission.freshness_binding[key] = deadline;
    decision.freshness_binding[key] = deadline;
  }
  decision.freshness_binding.execute_revalidation_must_occur_by = deadline;
  bindCurrentAdmission(decision, admission);
  return { decision, admission };
}

function bindCurrentAdmission(decision, admission) {
  seal(admission);
  decision.authorize_admission_ref.content_hash = admission.content_hash;
  seal(decision);
}

function evaluateAt(p, at) {
  // Retaining a record does not make its earlier evaluation time current.
  const candidate = structuredClone(p.decision);
  candidate.evaluated_at = at;
  seal(candidate);
  return validateDecision(candidate, p.admission);
}

function rejectAt(p, at, reason) {
  const before = JSON.stringify(p);
  assert.throws(() => evaluateAt(p, at), reason);
  assert.equal(JSON.stringify(p), before, 'rejection must preserve input evidence');
}

test('PA-A01: valid, exactly bound positive control remains acceptable', () => {
  const p = pair();
  assert.equal(validateDecision(p.decision, p.admission), true);
  assert.equal(evaluateAt(p, '2026-11-16T12:04:59.999Z'), true);
});

test('PA-A02: each deadline is rechecked at completion, even after rehashing', async t => {
  for (const field of dateFields) {
    await t.test(field, () => {
      const p = pair();
      p.admission.freshness_binding[field] = '2026-11-16T12:01:00.000Z';
      p.decision.freshness_binding[field] = '2026-11-16T12:01:00.000Z';
      if (field === 'authorization_must_occur_by') {
        p.decision.freshness_binding.execute_revalidation_must_occur_by =
          p.admission.freshness_binding[field];
      }
      bindCurrentAdmission(p.decision, p.admission);
      assert.equal(evaluateAt(p, '2026-11-16T12:00:59.999Z'), true);
      rejectAt(p, '2026-11-16T12:01:00.001Z',
        new RegExp(`stale execute revalidation: evaluated_at > ${field}`));
    });
  }
});

test('PA-A03: an uncollected pending record cannot revive expired authority', () => {
  const p = pair();
  const retained = new Map([['pending', p]]);
  rejectAt(retained.get('pending'), '2026-11-16T13:00:00.000Z',
    /stale execute revalidation/);
  assert.equal(retained.size, 1, 'no queue cleanup is needed for rejection');
});

test('PA-A04: current denial wins over earlier successful admission', () => {
  const p = pair();
  p.admission.decision.status = 'denied';
  // Even updating the public record digest cannot turn denied into admissible.
  bindCurrentAdmission(p.decision, p.admission);
  rejectAt(p, start, /source admission decision: expected admissible, got denied/);
});

test('PA-A05: an old approval binding cannot be reused against a changed current binding', () => {
  const p = pair();
  p.admission.freshness_binding.approval_hash = 'sha256:' + '1'.repeat(64);
  // Rebind the outer reference to expose the nested approval check itself.
  bindCurrentAdmission(p.decision, p.admission);
  rejectAt(p, start, /freshness approval_hash/);
});

test('PA-A06: an old permit cannot survive replacement of the current permit', () => {
  const p = pair();
  p.admission.freshness_binding.action_permit_hash = 'sha256:' + '2'.repeat(64);
  bindCurrentAdmission(p.decision, p.admission);
  rejectAt(p, start, /freshness action_permit_hash/);
});

test('PA-A07: a correct earlier record does not authorize a different current target', () => {
  const p = pair();
  p.admission.action_binding.target_binding_hash = 'sha256:' + '3'.repeat(64);
  bindCurrentAdmission(p.decision, p.admission);
  rejectAt(p, start, /action binding target_binding_hash/);
});

test('PA-A08: new source metadata cannot refresh unchanged expiry bounds', () => {
  const p = pair();
  p.admission.evaluated_at = '2026-11-16T12:06:00.000Z';
  bindCurrentAdmission(p.decision, p.admission);
  rejectAt(p, p.admission.evaluated_at, /stale execute revalidation/);
});

test('PA-A09: a declared consumed permit is rejected after recomputing the digest', () => {
  const p = pair();
  p.decision.freshness_binding.permit_consumed = true;
  seal(p.decision);
  rejectAt(p, start, /permit consumed: expected false, got true/);
});

test('PA-A10: a successful check cannot claim newly created authority', () => {
  const p = pair();
  p.decision.non_effects.authority_created_or_expanded = true;
  seal(p.decision);
  rejectAt(p, start, /non-effect authority_created_or_expanded/);
});

test('PA-A11: matched replacement records remain only an offline consistency control', () => {
  const p = pair();
  p.admission.freshness_binding.approval_hash = 'sha256:' + '4'.repeat(64);
  p.decision.freshness_binding.approval_hash = p.admission.freshness_binding.approval_hash;
  bindCurrentAdmission(p.decision, p.admission);
  // The seam accepts self-consistent caller-supplied records. It does not
  // authenticate this source, prove a live person, rotate keys, or consume a
  // global one-shot token. This control must not be reported as identity proof.
  assert.equal(validateDecision(p.decision, p.admission), true);
  assert.equal(p.decision.non_effects.authority_created_or_expanded, false);
  assert.equal(p.decision.non_effects.actuator_invocation_emitted, false);
});
