'use strict';

const assert = require('assert');
const cp = require('child_process');
const fs = require('fs');
const path = require('path');

const Interop = require('./readiness-family-interop.js');

const repoRoot = path.resolve(__dirname, '../../../..');
const outputDir = process.argv[2] || '/tmp/kontur-readiness-interop';
const MANIFEST_TAMPER = /family manifest hash mismatch/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function currentGitSha() {
  const result = cp.spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  assert.strictEqual(result.status, 0, result.stderr || 'git rev-parse failed');
  const sha = result.stdout.trim();
  assert.match(sha, /^[0-9a-f]{40}$/);
  return sha;
}

function buildInput() {
  return {
    protocol: Interop.PROTOCOL,
    version: Interop.VERSION,
    artifact_type: 'KONTURFamilyReadinessInteropInput',
    evaluation_frontier: {
      repository: 'Matawaka/uu-aap',
      revision: currentGitSha()
    },
    family_manifest: readJson(path.join(repoRoot, 'products/kontur/v0.1/family-manifest.json')),
    readiness: {
      aggregation_receipt: readJson(path.join(outputDir, 'aggregation-receipt.json')),
      readiness_signal: readJson(path.join(outputDir, 'readiness-signal.json')),
      responsibility_policy: readJson(path.join(repoRoot, 'server/kontur/v0.1/policies/reference-server.responsibility-policy.json')),
      acceptance_receipt: readJson(path.join(outputDir, 'acceptance-receipt.json'))
    },
    controls: {
      surface: 'validate_inspect_only',
      read_only: true,
      network_access_required: false,
      filesystem_write_required: false,
      activation_available: false,
      responsibility_acceptance_available: false,
      host_designation_available: false,
      ledger_write_available: false,
      runtime_start_available: false,
      action_permit_available: false,
      execution_available: false
    }
  };
}

async function reject(name, operation, pattern = null) {
  let error = null;
  try {
    await operation();
  } catch (value) {
    error = value;
  }
  assert(error, `${name}: expected rejection`);
  if (pattern) assert.match(error.message, pattern, `${name}: unexpected error`);
  return name;
}

async function main() {
  for (const file of ['aggregation-receipt.json', 'readiness-signal.json', 'acceptance-receipt.json']) {
    assert.strictEqual(
      fs.existsSync(path.join(outputDir, file)),
      true,
      `missing predecessor readiness output ${file}; run test-readiness-aggregator.js first`
    );
  }

  const input = buildInput();
  const receipt = await Interop.buildInteropReceipt(input);
  const receipt2 = await Interop.buildInteropReceipt(clone(input));
  assert.deepStrictEqual(receipt2, receipt, 'interop receipt must be deterministic for exact input');
  assert.strictEqual(Interop.validateReceipt(receipt), true);
  assert.strictEqual(receipt.status, Interop.STATUS);
  assert.strictEqual(receipt.next_safe_action, Interop.NEXT_SAFE_ACTION);
  assert.strictEqual(receipt.family.readiness_member_id, 'readiness-aggregator');
  assert.strictEqual(receipt.family.readiness_to_activation_edge_status, 'established_evidence_dependency');
  assert.strictEqual(receipt.readiness.readiness_signal_ready, true);
  assert.strictEqual(receipt.readiness.source_acceptance_decision, 'accepted_for_activation_precondition');
  assert.strictEqual(receipt.readiness.human_activation_step_still_required, true);
  for (const key of Interop.FALSE_CLAIMS) assert.strictEqual(receipt.claims[key], false, `${key} must remain false`);

  const validation = await Interop.validationReceipt(input);
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(validation.activation_authorized, false);
  assert.strictEqual(validation.kernel_activated, false);
  assert.strictEqual(validation.responsibility_accepted, false);
  assert.strictEqual(validation.execution_admitted, false);

  const inputPath = path.join(outputDir, 'family-readiness-interop.input.json');
  fs.writeFileSync(inputPath, `${JSON.stringify(input, null, 2)}\n`);
  const cliValidation = await Interop.runCli(['validate', inputPath]);
  assert.strictEqual(cliValidation.exitCode, 0);
  assert.match(cliValidation.text, /KONTURFamilyReadinessInteropValidationReceipt/);
  const cliInspection = await Interop.runCli(['inspect', inputPath]);
  assert.strictEqual(cliInspection.exitCode, 0);
  assert.match(cliInspection.text, /READINESS_EVIDENCE_AVAILABLE_FOR_FAMILY_INSPECTION/);

  const rejected = [];

  rejected.push(await reject('manifest_identity_substitution', async () => {
    const changed = clone(input);
    changed.family_manifest.identity.content_hash = `sha256:${'0'.repeat(64)}`;
    await Interop.validateInput(changed);
  }, /family manifest canonical identity mismatch/));

  rejected.push(await reject('family_id_substitution', async () => {
    const changed = clone(input);
    changed.family_manifest.family.id = 'other-family';
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('readiness_member_activation_overclaim', async () => {
    const changed = clone(input);
    changed.family_manifest.members.find(item => item.id === 'readiness-aggregator').runtime_activation_state = 'activated';
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('readiness_member_authority_overclaim', async () => {
    const changed = clone(input);
    changed.family_manifest.members.find(item => item.id === 'readiness-aggregator').authority_source = true;
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('readiness_member_data_access_overclaim', async () => {
    const changed = clone(input);
    changed.family_manifest.members.find(item => item.id === 'readiness-aggregator').shared_data_access = true;
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('readiness_member_path_drift', async () => {
    const changed = clone(input);
    changed.family_manifest.members.find(item => item.id === 'readiness-aggregator').canonical_paths.pop();
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('readiness_edge_activation_authority', async () => {
    const changed = clone(input);
    changed.family_manifest.edges.find(item => item.from === 'readiness-aggregator' && item.to === 'activation-boundary').activation_authorized = true;
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('readiness_edge_responsibility_transfer', async () => {
    const changed = clone(input);
    changed.family_manifest.edges.find(item => item.from === 'readiness-aggregator' && item.to === 'activation-boundary').responsibility_transfer = true;
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('automatic_activation_policy_weakening', async () => {
    const changed = clone(input);
    changed.family_manifest.consolidation_policy.automatic_activation = true;
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('cross_member_data_default_weakening', async () => {
    const changed = clone(input);
    changed.family_manifest.consolidation_policy.cross_member_data_access_default = 'allowed';
    await Interop.validateInput(changed);
  }, MANIFEST_TAMPER));

  rejected.push(await reject('evaluation_frontier_not_git_sha', async () => {
    const changed = clone(input);
    changed.evaluation_frontier.revision = 'main';
    await Interop.validateInput(changed);
  }, /exact Git SHA/));

  rejected.push(await reject('non_ready_aggregation', async () => {
    const changed = clone(input);
    changed.readiness.aggregation_receipt.aggregation_result.ready = false;
    await Interop.validateInput(changed);
  }, /positive six-axis aggregation required/));

  rejected.push(await reject('non_ready_signal', async () => {
    const changed = clone(input);
    changed.readiness.readiness_signal.ready = false;
    await Interop.validateInput(changed);
  }, /positive KONTURReadinessSignal/));

  rejected.push(await reject('acceptance_binding_substitution', async () => {
    const changed = clone(input);
    changed.readiness.acceptance_receipt.readiness_signal_binding.digest.value = '0'.repeat(64);
    await Interop.validateInput(changed);
  }, /readiness signal binding substitution/));

  rejected.push(await reject('acceptance_kernel_activation_overclaim', async () => {
    const changed = clone(input);
    changed.readiness.acceptance_receipt.claims.kernel_activated = true;
    await Interop.validateInput(changed);
  }, /prohibited claim kernel_activated/));

  rejected.push(await reject('control_activation_available', async () => {
    const changed = clone(input);
    changed.controls.activation_available = true;
    await Interop.validateInput(changed);
  }, /activation_available must remain false/));

  for (const claim of Interop.FALSE_CLAIMS) {
    rejected.push(await reject(`receipt_overclaim_${claim}`, async () => {
      const changed = clone(receipt);
      changed.claims[claim] = true;
      changed.content_hash = Interop.contentHash(changed);
      Interop.validateReceipt(changed);
    }, new RegExp(`prohibited claim ${claim}`)));
  }

  rejected.push(await reject('receipt_unknown_claim', async () => {
    const changed = clone(receipt);
    changed.claims.activation_completed = true;
    changed.content_hash = Interop.contentHash(changed);
    Interop.validateReceipt(changed);
  }, /interop receipt\.claims keys mismatch/));

  for (const command of ['activate', 'execute', 'start', 'designate', 'write-ledger', 'send']) {
    rejected.push(await reject(`forbidden_cli_${command}`, async () => {
      await Interop.runCli([command, '-']);
    }, /unsupported command/));
  }

  console.log(JSON.stringify({
    suite: 'KONTUR Family Readiness Interoperability v0.1',
    evaluation_frontier: input.evaluation_frontier.revision,
    readiness_epoch: receipt.readiness.readiness_epoch,
    source_signal_ready: true,
    source_acceptance: receipt.readiness.source_acceptance_decision,
    interop_status: receipt.status,
    fail_closed_vectors_rejected: rejected.length,
    activation_authorized: false,
    responsibility_accepted: false,
    execution_admitted: false,
    result: 'PASS'
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
