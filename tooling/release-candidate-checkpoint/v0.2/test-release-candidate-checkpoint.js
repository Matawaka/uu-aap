'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assess, ENGINEERING_GATES, GOVERNANCE_GATES, NON_EFFECTS, ReleaseCandidateCheckpointError } = require('./release-candidate-checkpoint.js');

const factual = JSON.parse(fs.readFileSync(path.join(__dirname, 'post-t5-frontier.input.json'), 'utf8'));
const clone = (value) => JSON.parse(JSON.stringify(value));
function expectCode(fn, code) { assert.throws(fn, (error) => error instanceof ReleaseCandidateCheckpointError && error.code === code); }

{
  const report = assess(factual);
  assert.equal(report.git_revision, factual.git_revision);
  assert.equal(report.engineering.status, 'PASS');
  assert.equal(report.governance.status, 'REVIEW_PENDING');
  assert.equal(report.decision, 'RELEASE_CANDIDATE_REVIEW_PENDING');
  assert.deepEqual(report.engineering.gates.map((gate) => gate.gate_id), ENGINEERING_GATES);
  assert.deepEqual(report.governance.gates.map((gate) => gate.gate_id), GOVERNANCE_GATES);
  assert.deepEqual(report.blocking_findings, []);
  for (const field of ['release_authorized','publication_authorized','certification_granted','legal_status_established','authority_created','runtime_activated','ci_narrowing_authorized','assurance_escalated']) assert.equal(report[field], false);
  assert.equal(report.future_evolution_allowed, true);
  assert.deepEqual(report.non_effects, NON_EFFECTS);
}

{
  const input = clone(factual);
  for (const gate of input.governance_evidence) {
    gate.status = 'PASS';
    gate.explicit_review_outcome = true;
    gate.reviewed_revision = input.git_revision;
    if (gate.source_path === null) gate.source_path = `review/${gate.gate_id}.md`;
  }
  const report = assess(input);
  assert.equal(report.governance.status, 'PASS');
  assert.equal(report.decision, 'READY');
  assert.equal(report.release_authorized, false);
}

{
  const input = clone(factual);
  input.engineering_evidence[0].status = 'INSUFFICIENT_EVIDENCE';
  input.engineering_evidence[0].conformance_evidence_verified = false;
  assert.equal(assess(input).decision, 'INSUFFICIENT_EVIDENCE');
}

{
  const input = clone(factual);
  input.governance_evidence[1].blocking = true;
  const report = assess(input);
  assert.equal(report.decision, 'BLOCKED');
  assert.deepEqual(report.blocking_findings, ['privacy']);
}

{
  const input = clone(factual);
  input.engineering_evidence.push(clone(input.engineering_evidence[0]));
  expectCode(() => assess(input), 'DUPLICATE_GATE');
}

{
  const input = clone(factual);
  input.governance_evidence = input.governance_evidence.filter((gate) => gate.gate_id !== 'accessibility');
  expectCode(() => assess(input), 'MISSING_GATE');
}

{
  const input = clone(factual);
  input.governance_evidence[0].gate_id = 'unknown_governance_gate';
  expectCode(() => assess(input), 'UNKNOWN_GATE');
}

{
  const input = clone(factual);
  const privacy = input.governance_evidence.find((gate) => gate.gate_id === 'privacy');
  privacy.status = 'PASS';
  privacy.explicit_review_outcome = true;
  privacy.reviewed_revision = 'd4e3efd63416d9ef97d868fea096d966b843b350';
  expectCode(() => assess(input), 'HISTORICAL_REVIEW_AS_CURRENT');
}

{
  const input = clone(factual);
  const contestability = input.governance_evidence.find((gate) => gate.gate_id === 'contestability');
  contestability.status = 'PASS';
  contestability.explicit_review_outcome = false;
  contestability.reviewed_revision = input.git_revision;
  expectCode(() => assess(input), 'PASS_WITHOUT_REVIEW_OUTCOME');
}

{
  const input = clone(factual);
  const accessibility = input.governance_evidence.find((gate) => gate.gate_id === 'accessibility');
  accessibility.source_path = 'review/accessibility.md';
  expectCode(() => assess(input), 'MISSING_WITH_SOURCE');
}

{
  const input = clone(factual);
  input.engineering_evidence[0].observed_at_revision = '5d9d9e0faf35230ede54e8f49c71e049311b7e4a';
  expectCode(() => assess(input), 'STALE_ENGINEERING_OBSERVATION');
}

{
  const left = JSON.stringify(assess(factual));
  const reordered = clone(factual);
  reordered.engineering_evidence.reverse();
  reordered.governance_evidence.reverse();
  assert.equal(left, JSON.stringify(assess(reordered)));
}

console.log('Release Candidate Checkpoint v0.2 tests passed');
