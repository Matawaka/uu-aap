'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateHandoff } = require('./evaluate-handoff.js');

const here = __dirname;
const examples = path.join(here, 'examples');

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(examples, name), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(fn, pattern, label) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown, `${label}: expected rejection`);
  if (pattern) assert(pattern.test(thrown.message), `${label}: unexpected error: ${thrown.message}`);
}

const e0 = read('e0-internal.boundary-assessment.json');
const assessment = read('e2-handoff.boundary-assessment.json');
const receipt = read('e2-handoff.elevation-receipt.json');
const assignment = read('e2-handoff.current-responsibility-assignment.json');
const offer = read('e2-handoff.offer.json');
const acceptance = read('e2-handoff.acceptance.json');

// 1. E0 must remain outside IAL handoff machinery.
const e0Result = evaluateHandoff({ assessment: e0 });
assert(e0Result.status === 'not_required', 'E0 must be not_required');
assert(e0Result.claims.responsibility_boundary_required === false, 'E0 must not require responsibility boundary');
assert(e0Result.claims.responsibility_transfer_established === false, 'E0 must not establish responsibility transfer');

// 2. Creating handoff artifacts for E0 is itself rejected as over-protocolization.
const e0WithOffer = evaluateHandoff({ assessment: e0, offer });
assert(e0WithOffer.status === 'blocked', 'E0 with handoff artifacts must be blocked');
assert(e0WithOffer.reason_codes.includes('ial_artifacts_for_e0_forbidden'), 'E0 over-protocolization reason missing');

// 3. Positive E2: exact acceptance + reproducible attestation establishes responsibility transfer only.
const positive = evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance }, { rerunAttestation: true });
assert(positive.status === 'accepted', 'exact E2 handoff must be accepted');
assert(positive.claims.capability_attestation_verified === true, 'positive E2 must verify attestation');
assert(positive.claims.responsibility_transfer_established === true, 'positive E2 must establish responsibility transfer');
assert(positive.claims.responsibility_accepted === true, 'positive E2 must record explicit responsibility acceptance');
assert(positive.assignment_after_handoff.responsible_party_id === offer.receiving_party_id, 'responsibility must move to receiving party');
for (const key of [
  'authority_established',
  'context_admission_established',
  'execution_admitted',
  'materialization_permitted',
  'commit_performed',
  'outcome_observed',
  'canonical_state_established',
  'poai_v_conformance_established'
]) assert(positive.claims[key] === false, `positive E2 must not establish ${key}`);

// Preserve one positive result for schema validation in CI.
const outputPath = process.argv[2] || '/tmp/ial-e2-handoff-result.json';
fs.writeFileSync(outputPath, JSON.stringify(positive, null, 2) + '\n');

// 4. A binding-only attestation check is insufficient for this v0.1 handoff.
const bindingOnly = evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance }, { rerunAttestation: false });
assert(bindingOnly.status === 'blocked', 'binding-only attestation must not establish handoff');
assert(bindingOnly.reason_codes.includes('attestation_not_reproduced'), 'binding-only failure reason missing');

// 5. Silent partial acceptance is forbidden.
const partialAcceptance = clone(acceptance);
partialAcceptance.accepted_responsibility_scope = partialAcceptance.accepted_responsibility_scope.slice(0, 2);
const partial = evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance: partialAcceptance });
assert(partial.status === 'blocked', 'partial responsibility scope must be blocked');
assert(partial.reason_codes.includes('partial_or_changed_responsibility_scope'), 'partial scope reason missing');

// 6. Explicit rejection wins over technical capability.
const rejectedAcceptance = clone(acceptance);
rejectedAcceptance.decision = 'rejected';
rejectedAcceptance.accepted_responsibility_scope = [];
rejectedAcceptance.attestation_ref = null;
rejectedAcceptance.claims.responsibility_accepted = false;
const rejected = evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance: rejectedAcceptance });
assert(rejected.status === 'rejected', 'explicit rejection must remain rejected');
assert(rejected.claims.capability_attestation_verified === false, 'rejection must not be upgraded by capability');
assert(rejected.claims.responsibility_transfer_established === false, 'rejection must not transfer responsibility');

// 7. Receiver substitution is forbidden.
const wrongReceiver = clone(acceptance);
wrongReceiver.receiving_party_id = 'urn:uu-aap:party:other-recipient';
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance: wrongReceiver }),
  /receiving_party_id mismatch/,
  'wrong receiver'
);

// 8. Executor substitution is forbidden.
const wrongExecutor = clone(acceptance);
wrongExecutor.executor_implementation_id = 'urn:uu-aap:implementation:other:0.1';
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance: wrongExecutor }),
  /executor implementation mismatch/,
  'wrong executor'
);

// 9. Registry/release drift is forbidden.
const driftedOffer = clone(offer);
driftedOffer.required_capability.release_commit = '0000000000000000000000000000000000000000';
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer: driftedOffer, acceptance }),
  /release_commit drift/,
  'release drift'
);

// 10. Unknown/unreleased conformance requirements are forbidden.
const impossibleOffer = clone(offer);
impossibleOffer.required_capability.required_conformance_levels.push('C6');
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer: impossibleOffer, acceptance }),
  /required levels not present/,
  'unknown conformance level'
);

// 11. Attestation blob substitution is forbidden.
const driftedAttestation = clone(acceptance);
driftedAttestation.attestation_ref.git_blob_sha = '0000000000000000000000000000000000000000';
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance: driftedAttestation }),
  /blob drift/,
  'attestation blob drift'
);

// 12. Attestation subject must equal the executor implementation, not the receiving party or another implementation.
const wrongAttestationSubject = clone(acceptance);
wrongAttestationSubject.attestation_ref.subject_id = 'urn:uu-aap:implementation:other:0.1';
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer, acceptance: wrongAttestationSubject }),
  /subject_id mismatch/,
  'attestation subject substitution'
);

// 13. Source responsibility must be the assignment being handed off.
const wrongSource = clone(offer);
wrongSource.source_responsible_party_id = 'urn:uu-aap:party:not-current-owner';
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: receipt, assignment, offer: wrongSource, acceptance }),
  /source is not current responsible party/,
  'wrong source responsibility'
);

// 14. Private reasoning remains outside the protocol surface.
const leakedReceipt = clone(receipt);
leakedReceipt.private_reasoning_disclosed = true;
expectThrow(
  () => evaluateHandoff({ assessment, elevationReceipt: leakedReceipt, assignment, offer, acceptance }),
  /private reasoning disclosure is forbidden/,
  'private reasoning disclosure'
);

console.log(JSON.stringify({
  suite: 'IAL responsibility boundary and handoff v0.1',
  vectors: 14,
  positive_status: positive.status,
  output: outputPath,
  stronger_claims_preserved_false: true
}, null, 2));
