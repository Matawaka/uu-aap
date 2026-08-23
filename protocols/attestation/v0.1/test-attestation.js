'use strict';

const path = require('path');
const { verifyAttestation, readJson } = require('./verify-attestation');

const basePath = path.join(__dirname, 'attestations/ccrp-reference-implementation.v0.1.json');
const base = readJson(basePath);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function expectThrow(name, mutate, pattern) {
  const candidate = clone(base);
  mutate(candidate);
  let threw = false;
  try {
    verifyAttestation(candidate, { rerunTests: false });
  } catch (error) {
    threw = true;
    if (pattern) assert(pattern.test(error.message), `${name}: unexpected error: ${error.message}`);
  }
  assert(threw, `${name}: expected verification failure`);
}

const bindingOnly = verifyAttestation(clone(base), { rerunTests: false });
assert(bindingOnly.status === 'binding_verification_passed', 'binding-only verification did not pass');
assert(bindingOnly.conformance_tests_verified === 6, 'expected six conformance tests');

const reproduced = verifyAttestation(clone(base), { rerunTests: true });
assert(reproduced.status === 'reproducible_conformance_evidence', 'reproducible attestation did not pass');
assert(JSON.stringify(reproduced.rerun_levels) === JSON.stringify(['C0', 'C1', 'C2', 'C3', 'C4', 'C5']), 'expected C0-C5 reruns');

expectThrow('release_commit_drift', (candidate) => {
  candidate.protocol_binding.release_commit = '0000000000000000000000000000000000000000';
}, /release_commit drift/);

expectThrow('implementation_blob_drift', (candidate) => {
  candidate.subject.artifact_set[0].git_blob_sha = '0000000000000000000000000000000000000000';
}, /attestation blob disagrees with release manifest/);

expectThrow('dependency_blob_drift', (candidate) => {
  candidate.dependency_artifacts[0].git_blob_sha = '0000000000000000000000000000000000000000';
}, /attestation blob disagrees with release manifest/);

expectThrow('test_blob_drift', (candidate) => {
  candidate.test_evidence[0].git_blob_sha = '0000000000000000000000000000000000000000';
}, /test blob disagrees with release manifest/);

expectThrow('command_substitution', (candidate) => {
  candidate.test_evidence[0].runner.args = ['proposals/ccrp/test-c1.js'];
}, /command substitution detected/);

expectThrow('missing_level_evidence', (candidate) => {
  candidate.test_evidence.pop();
}, /cover each attested level exactly once/);

expectThrow('duplicate_attested_level', (candidate) => {
  candidate.attested_conformance_levels[5] = 'C4';
}, /duplicates/);

expectThrow('unknown_attested_level', (candidate) => {
  candidate.attested_conformance_levels[5] = 'C9';
}, /unknown C9/);

expectThrow('duplicate_test_level', (candidate) => {
  candidate.test_evidence[5].level = 'C4';
}, /duplicate level/);

expectThrow('release_manifest_blob_drift', (candidate) => {
  candidate.protocol_binding.release_manifest_git_blob_sha = '0000000000000000000000000000000000000000';
}, /release_manifest blob drift/);

expectThrow('boundary_removed', (candidate) => {
  candidate.non_claims = candidate.non_claims.filter((value) => value !== 'materialization_permission_established');
}, /required boundary missing materialization_permission_established/);

console.log(JSON.stringify({
  suite: 'Protocol capability attestation v0.1',
  positive_vectors: 2,
  fail_closed_vectors: 11,
  result: 'passed'
}, null, 2));
