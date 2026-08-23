'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { negotiate } = require('./negotiate');

const here = __dirname;

function read(name) {
  return JSON.parse(fs.readFileSync(path.join(here, 'examples', name), 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectThrow(fn, pattern) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert(thrown, 'Expected operation to throw');
  if (pattern) assert(pattern.test(thrown.message), `Unexpected error: ${thrown.message}`);
}

(function main() {
  const full = read('full-ccrp-capability.json');
  const partial = read('partial-ccrp-capability.json');
  const requirement = read('require-ccrp-c0-c4.json');

  const compatible = negotiate(full, requirement);
  assert.strictEqual(compatible.status, 'declared_compatible');
  assert.strictEqual(compatible.failures.length, 0);
  assert.strictEqual(compatible.matches.length, 1);
  assert.strictEqual(compatible.matches[0].satisfied, true);
  assert.deepStrictEqual(compatible.matches[0].missing_conformance_levels, []);

  const partialResult = negotiate(partial, requirement);
  assert.strictEqual(partialResult.status, 'incompatible');
  assert(partialResult.failures.some((failure) => failure.includes('C4')));
  assert.deepStrictEqual(partialResult.matches[0].missing_conformance_levels, ['C4']);

  const unknownVersion = clone(requirement);
  unknownVersion.requirement_id = 'urn:example:requirement:unknown-version';
  unknownVersion.requirements[0].version = '0.2';
  unknownVersion.requirements[0].logical_uri = 'urn:uu-aap:protocol:ccrp:0.2';
  const unknownResult = negotiate(full, unknownVersion);
  assert.strictEqual(unknownResult.status, 'incompatible');
  assert(unknownResult.failures.some((failure) => failure.includes('not uniquely registered')));

  const latest = clone(requirement);
  latest.requirement_id = 'urn:example:requirement:latest-forbidden';
  latest.requirements[0].version = 'latest';
  latest.requirements[0].logical_uri = 'urn:uu-aap:protocol:ccrp:latest';
  expectThrow(() => negotiate(full, latest), /latest alias is forbidden/);

  const ranged = clone(requirement);
  ranged.requirement_id = 'urn:example:requirement:range-forbidden';
  ranged.requirements[0].version = '^0.1';
  ranged.requirements[0].logical_uri = 'urn:uu-aap:protocol:ccrp:^0.1';
  expectThrow(() => negotiate(full, ranged), /version must be exact/);

  const driftedDeclaration = clone(full);
  driftedDeclaration.declaration_id = 'urn:example:declaration:drifted-release';
  driftedDeclaration.capabilities[0].release_commit = '0000000000000000000000000000000000000000';
  expectThrow(() => negotiate(driftedDeclaration, requirement), /release_commit disagrees with registry/);

  const noHierarchy = clone(full);
  noHierarchy.declaration_id = 'urn:example:declaration:c5-only';
  noHierarchy.capabilities[0].conformance_levels = ['C5'];
  const requiresC0 = clone(requirement);
  requiresC0.requirement_id = 'urn:example:requirement:c0-only';
  requiresC0.requirements[0].required_conformance_levels = ['C0'];
  const noHierarchyResult = negotiate(noHierarchy, requiresC0);
  assert.strictEqual(noHierarchyResult.status, 'incompatible');
  assert.deepStrictEqual(noHierarchyResult.matches[0].missing_conformance_levels, ['C0']);

  const duplicateDeclaration = clone(full);
  duplicateDeclaration.declaration_id = 'urn:example:declaration:duplicate';
  duplicateDeclaration.capabilities.push(clone(duplicateDeclaration.capabilities[0]));
  expectThrow(() => negotiate(duplicateDeclaration, requirement), /duplicate exact capability declaration/);

  const dependencyRequirement = clone(requirement);
  dependencyRequirement.requirement_id = 'urn:example:requirement:dependency-c5';
  dependencyRequirement.requirements[0].required_conformance_levels = ['C0'];
  dependencyRequirement.dependency_requirements = [
    {
      protocol_id: 'CCRP',
      version: '0.1',
      logical_uri: 'urn:uu-aap:protocol:ccrp:0.1',
      required_conformance_levels: ['C5']
    }
  ];
  const dependencyResult = negotiate(partial, dependencyRequirement);
  assert.strictEqual(dependencyResult.status, 'incompatible');
  assert(dependencyResult.matches.some((match) => match.kind === 'dependency' && match.satisfied === false));

  assert(compatible.non_claims.includes('legal_authority_established'));
  assert(compatible.non_claims.includes('execution_admission_established'));
  assert(compatible.non_claims.includes('materialization_permission_established'));

  console.log(JSON.stringify({
    suite: 'protocol-capability-negotiation-v0.1',
    vectors: 9,
    positive_exact_match: 'passed',
    partial_profile_rejection: 'passed',
    unknown_version_fail_closed: 'passed',
    latest_rejected: 'passed',
    range_rejected: 'passed',
    release_binding_drift_rejected: 'passed',
    conformance_hierarchy_not_inferred: 'passed',
    duplicate_declaration_rejected: 'passed',
    dependency_requirement_checked: 'passed'
  }, null, 2));
})();
