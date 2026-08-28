'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validateAuthorizePhase } = require('./validate-authorize-phase.js');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'conformance.fixture.json'), 'utf8'));
const fullValidator = path.join(__dirname, 'validate-execution-lifecycle.js');

const historical = spawnSync(process.execPath, [fullValidator], { encoding: 'utf8' });
assert.strictEqual(historical.status, 0, historical.stderr);
assert(/UU_AAP_BOUNDED_EXECUTION_LIFECYCLE_V0_1_PASS/.test(historical.stdout));

const context = {
  predecessor_frontier: fixture.target.expected_predecessor_frontier,
  target_binding_hash: fixture.target.binding_hash,
  requires_approval: fixture.action.requires_approval,
};

assert.strictEqual(validateAuthorizePhase(fixture.phases.authorize, context), true);

function expectFailure(label, mutate, pattern) {
  const phase = JSON.parse(JSON.stringify(fixture.phases.authorize));
  mutate(phase);
  assert.throws(() => validateAuthorizePhase(phase, context), pattern, label);
}

expectFailure('missing approval', p => { delete p.approval_ref; }, /approval required/);
expectFailure('adapter creates permit', p => { p.non_effects.action_permit_created_by_adapter = true; }, /forbidden effect/);
expectFailure('consumed permit', p => { p.consumed = true; }, /one-shot and unconsumed/);
expectFailure('non one-shot permit', p => { p.one_shot = false; }, /one-shot and unconsumed/);
expectFailure('target substitution', p => { p.target_binding_hash = 'sha256:' + '1'.repeat(64); }, /target substitution/);
expectFailure('frontier substitution', p => { p.frontier = 'other'; }, /frontier mismatch/);
expectFailure('permit frontier substitution', p => { p.action_permit_ref.frontier = 'other'; }, /ActionPermit ref mismatch/);
expectFailure('admission predates permit', p => { p.admission_assessed_at = '2026-08-24T18:00:09Z'; }, /admission predates Core ActionPermit/);

const imported = spawnSync(process.execPath, ['-e', `
  const m=require(${JSON.stringify(path.join(__dirname, 'validate-authorize-phase.js'))});
  if(typeof m.validateAuthorizePhase!=='function') process.exit(9);
`], { encoding: 'utf8' });
assert.strictEqual(imported.status, 0, imported.stderr);
assert.strictEqual(imported.stdout, '');
assert.strictEqual(imported.stderr, '');

process.stdout.write('PASS reusable execution-lifecycle authorize-phase seam\n');
