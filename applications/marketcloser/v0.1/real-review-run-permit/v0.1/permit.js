'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Gate = require(path.resolve(__dirname, '../../real-review-run-authority-gate/v0.1/authority-gate.js'));

const PROTOCOL = 'MARKETCLOSER-REAL-REVIEW-RUN-PERMIT';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserRealReviewRunPermitMaterializationInput';
const DECISION_TYPE = 'MarketCloserRealReviewRunPermitMaterializationReceipt';
const PERMIT_TYPE = 'MarketCloserRealReviewRunPermit';
const ORIGIN_FRONTIER = '87714d88146ff88bc0bddddde84b99b26a639e2c';
const ORIGIN_TREE = 'd305e58633c87832895791232f34ecb399de487f';
const OPERATION = 'marketer-pessimist.real-review.stress-test.v0.1';
const MAX_VALIDITY_SECONDS = 3600;
const NEXT_SAFE_ACTION = 'REAL_REVIEW_LOCAL_RUN_REVALIDATION_REQUIRED';

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'materialization_id', 'permit_origin',
  'authority_gate_source', 'execution_frontier', 'requested_run', 'materialized_at',
  'controls', 'content_hash'
]);
const ORIGIN_KEYS = Object.freeze(['repository', 'revision', 'tree']);
const SOURCE_KEYS = Object.freeze(['mode', 'path', 'expected_gate_input_hash']);
const FRONTIER_KEYS = Object.freeze(['repository', 'revision', 'tree', 'observed_at']);
const RUN_KEYS = Object.freeze([
  'run_id', 'operation', 'one_shot', 'max_invocations', 'valid_for_seconds',
  'local_only', 'read_only', 'deterministic_input_bound', 'pre_run_revalidation_required',
  'network_access_available', 'filesystem_write_available', 'provider_invocation_available',
  'platform_mutation_available', 'response_candidate_available', 'publication_available',
  'pilot_permit_available', 'action_permit_available', 'external_execution_available',
  'external_effect_available'
]);
const CONTROL_KEYS = Object.freeze([
  'local_only', 'read_only', 'permit_materialization_available', 'stress_test_run_available',
  'network_access_available', 'provider_invocation_available', 'platform_mutation_available',
  'publication_available', 'pilot_permit_available', 'action_permit_available',
  'external_execution_available', 'external_effect_available'
]);

const DECISION_KEYS = Object.freeze([
  'protocol', 'version', 'receipt_type', 'receipt_id', 'source_input',
  'authority_gate_binding', 'execution_frontier', 'requested_run', 'classification',
  'permit_created', 'permit_binding', 'claims', 'non_effects', 'next_safe_action',
  'evaluated_at', 'content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['materialization_id', 'materialization_hash']);
const GATE_BINDING_KEYS = Object.freeze([
  'gate_id', 'gate_hash', 'gate_receipt_id', 'gate_receipt_hash', 'gate_classification',
  'authority_verified', 'required_scope', 'required_target', 'authority_verification_id',
  'bridge_receipt_hash', 'marketer_candidate_id', 'marketer_candidate_hash'
]);
const PERMIT_BINDING_KEYS = Object.freeze(['permit_id', 'permit_hash']);

const PERMIT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'permit_id', 'source_materialization',
  'authority_gate_binding', 'bridge_binding', 'execution_frontier', 'run',
  'issued_at', 'valid_until', 'one_shot', 'max_invocations', 'remaining_invocations',
  'consumed', 'frontier_revalidation_required', 'authority_revalidation_required',
  'capabilities', 'non_effects', 'next_safe_action', 'content_hash'
]);
const MATERIALIZATION_BINDING_KEYS = Object.freeze(['materialization_id', 'materialization_hash']);
const BRIDGE_BINDING_KEYS = Object.freeze([
  'bridge_receipt_hash', 'marketer_candidate_id', 'marketer_candidate_hash', 'marketer_candidate_state'
]);
const PERMIT_RUN_KEYS = Object.freeze(['run_id', 'operation', 'deterministic_input_bound']);
const CAPABILITY_KEYS = Object.freeze([
  'local_analysis_permitted', 'network_access_permitted', 'filesystem_write_permitted',
  'provider_invocation_permitted', 'platform_mutation_permitted', 'response_publication_permitted',
  'pilot_permit_created', 'action_permit_created', 'external_execution_permitted',
  'external_effect_permitted'
]);

const CLASSIFICATIONS = Object.freeze([
  'AUTHORITY_NOT_READY_PERMIT_NOT_CREATED',
  'SYNTHETIC_RUN_PERMIT_MATERIALIZED',
  'REAL_RUN_PERMIT_MATERIALIZED'
]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Run Permit != PilotPermit',
  'Run Permit != ActionPermit',
  'Local Analysis Permission != External Effect Permission',
  'Authority Verified != Permit Materialized',
  'Permit Materialized != Stress-Test Run',
  'Permit Possession != Current Preconditions',
  'One-Shot Permit != Reusable Authority',
  'Main Changed != Permit Still Current',
  'Successful Analysis != Publication Authority',
  'Consumed Permit != Retry Permission'
]);

const TRUE_CLAIMS = Object.freeze([
  'exact_authority_gate_revalidated',
  'exact_bridge_and_candidate_binding_preserved',
  'execution_frontier_recorded',
  'one_shot_constraint_recorded',
  'pre_run_revalidation_required'
]);
const FALSE_CLAIMS = Object.freeze([
  'pilot_permit_created',
  'action_permit_created',
  'stress_test_run',
  'stress_test_receipt_created',
  'response_candidate_created',
  'provider_invoked',
  'network_accessed',
  'platform_mutated',
  'publication_authorized',
  'external_execution_admitted',
  'external_effect_performed',
  'successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

class MarketCloserRealReviewRunPermitError extends Error {}
function req(condition, message) { if (!condition) throw new MarketCloserRealReviewRunPermitError(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}
function computeContentHash(value) {
  const copy = clone(value); delete copy.content_hash;
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(copy)), 'utf8').digest('hex')}`;
}
function rehash(value) { value.content_hash = computeContentHash(value); return value; }
function exact(value, keys, label) {
  req(value && typeof value === 'object' && !Array.isArray(value), `${label} must be object`);
  req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} key mismatch`);
}
function str(value, label, pattern = null) {
  req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
  if (pattern) req(pattern.test(value), `${label} invalid`);
}
function integer(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  req(Number.isInteger(value) && value >= min && value <= max, `${label} must be integer in range ${min}..${max}`);
}
function instant(value, label) {
  str(value, label); const n = Date.parse(value); req(Number.isFinite(n), `${label} invalid date-time`); return n;
}

function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveGatePath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository gate path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'gate path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported authority gate source mode');
  return path.resolve(source.path);
}
function loadGateInput(source) {
  const resolved = resolveGatePath(source);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  Gate.validateInput(input);
  req(input.content_hash === source.expected_gate_input_hash, 'authority gate input hash mismatch');
  return input;
}

function validateRequestedRun(run) {
  exact(run, RUN_KEYS, 'requested_run');
  str(run.run_id, 'requested_run.run_id', /^urn:uu-aap:marketcloser:real-review-run:[a-z0-9][a-z0-9:-]{2,191}$/);
  req(run.operation === OPERATION, 'requested_run.operation mismatch');
  req(run.one_shot === true, 'requested run must be one-shot');
  integer(run.max_invocations, 'requested_run.max_invocations', 1, 1);
  integer(run.valid_for_seconds, 'requested_run.valid_for_seconds', 1, MAX_VALIDITY_SECONDS);
  req(run.local_only === true && run.read_only === true, 'requested run must remain local/read-only');
  req(run.deterministic_input_bound === true, 'requested run must bind deterministic exact input');
  req(run.pre_run_revalidation_required === true, 'pre-run revalidation required');
  for (const key of [
    'network_access_available', 'filesystem_write_available', 'provider_invocation_available',
    'platform_mutation_available', 'response_candidate_available', 'publication_available',
    'pilot_permit_available', 'action_permit_available', 'external_execution_available',
    'external_effect_available'
  ]) req(run[key] === false, `requested run capability must remain false: ${key}`);
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.materialization_id, 'materialization_id', /^urn:uu-aap:marketcloser:real-review-run-permit-materialization:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.permit_origin, ORIGIN_KEYS, 'permit_origin');
  req(input.permit_origin.repository === 'Matawaka/uu-aap', 'permit origin repository mismatch');
  req(input.permit_origin.revision === ORIGIN_FRONTIER && input.permit_origin.tree === ORIGIN_TREE, 'permit origin mismatch');
  exact(input.authority_gate_source, SOURCE_KEYS, 'authority_gate_source');
  req(['repository_synthetic', 'local_private'].includes(input.authority_gate_source.mode), 'authority gate source mode unsupported');
  str(input.authority_gate_source.path, 'authority_gate_source.path');
  str(input.authority_gate_source.expected_gate_input_hash, 'authority_gate_source.expected_gate_input_hash', /^sha256:[0-9a-f]{64}$/);
  exact(input.execution_frontier, FRONTIER_KEYS, 'execution_frontier');
  req(input.execution_frontier.repository === 'Matawaka/uu-aap', 'execution frontier repository mismatch');
  str(input.execution_frontier.revision, 'execution_frontier.revision', /^[0-9a-f]{40}$/);
  str(input.execution_frontier.tree, 'execution_frontier.tree', /^[0-9a-f]{40}$/);
  instant(input.execution_frontier.observed_at, 'execution_frontier.observed_at');
  validateRequestedRun(input.requested_run);
  instant(input.materialized_at, 'materialized_at');
  req(instant(input.materialized_at, 'materialized_at') >= instant(input.execution_frontier.observed_at, 'execution_frontier.observed_at'),
    'materialized_at cannot precede execution frontier observation');
  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true, 'materializer must remain local/read-only');
  req(input.controls.permit_materialization_available === true, 'permit materialization capability must be explicit');
  for (const key of CONTROL_KEYS.filter(key => !['local_only','read_only','permit_materialization_available'].includes(key))) {
    req(input.controls[key] === false, `effect capability must remain false: ${key}`);
  }
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function gatePositive(receipt) {
  return ['SYNTHETIC_AUTHORITY_CONFORMANCE_READY', 'AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED'].includes(receipt.classification)
    && receipt.authority_verified === true
    && receipt.run_permit_created === false;
}

function validateTemporalBinding(input, gateReceipt) {
  const gateAt = instant(gateReceipt.evaluated_at, 'gate receipt evaluated_at');
  const frontierAt = instant(input.execution_frontier.observed_at, 'execution frontier observed_at');
  const materializedAt = instant(input.materialized_at, 'materialized_at');
  req(frontierAt >= gateAt, 'execution frontier observation must not precede authority gate evaluation');
  req(materializedAt >= frontierAt, 'permit materialization must not precede frontier observation');
}

function buildGateBinding(gateInput, gateReceipt) {
  return {
    gate_id: gateInput.gate_id,
    gate_hash: gateInput.content_hash,
    gate_receipt_id: gateReceipt.receipt_id,
    gate_receipt_hash: gateReceipt.content_hash,
    gate_classification: gateReceipt.classification,
    authority_verified: gateReceipt.authority_verified,
    required_scope: gateReceipt.authority_requirement.required_scope,
    required_target: gateReceipt.authority_requirement.required_target,
    authority_verification_id: gateReceipt.authority_evidence.verification_id,
    bridge_receipt_hash: gateReceipt.bridge_binding.bridge_receipt_hash,
    marketer_candidate_id: gateReceipt.bridge_binding.marketer_candidate_id,
    marketer_candidate_hash: gateReceipt.bridge_binding.marketer_candidate_hash
  };
}

function materializePermit(input, gateInput = null, gateReceipt = null) {
  validateInput(input);
  const resolvedGateInput = gateInput || loadGateInput(input.authority_gate_source);
  Gate.validateInput(resolvedGateInput);
  req(resolvedGateInput.content_hash === input.authority_gate_source.expected_gate_input_hash, 'gate source hash mismatch');
  const resolvedGateReceipt = gateReceipt || Gate.deriveReceipt(resolvedGateInput);
  req(gatePositive(resolvedGateReceipt), 'authority gate is not positive; run permit cannot be materialized');
  validateTemporalBinding(input, resolvedGateReceipt);

  const issuedAtMs = instant(input.materialized_at, 'materialized_at');
  const validUntil = new Date(issuedAtMs + input.requested_run.valid_for_seconds * 1000).toISOString();
  const gateBinding = buildGateBinding(resolvedGateInput, resolvedGateReceipt);
  const permit = {
    protocol: PROTOCOL,
    version: VERSION,
    artifact_type: PERMIT_TYPE,
    permit_id: `urn:uu-aap:marketcloser:real-review-run-permit:${input.content_hash.slice(-24)}`,
    source_materialization: {
      materialization_id: input.materialization_id,
      materialization_hash: input.content_hash
    },
    authority_gate_binding: gateBinding,
    bridge_binding: {
      bridge_receipt_hash: resolvedGateReceipt.bridge_binding.bridge_receipt_hash,
      marketer_candidate_id: resolvedGateReceipt.bridge_binding.marketer_candidate_id,
      marketer_candidate_hash: resolvedGateReceipt.bridge_binding.marketer_candidate_hash,
      marketer_candidate_state: resolvedGateReceipt.bridge_binding.marketer_candidate_state
    },
    execution_frontier: clone(input.execution_frontier),
    run: {
      run_id: input.requested_run.run_id,
      operation: OPERATION,
      deterministic_input_bound: true
    },
    issued_at: input.materialized_at,
    valid_until: validUntil,
    one_shot: true,
    max_invocations: 1,
    remaining_invocations: 1,
    consumed: false,
    frontier_revalidation_required: true,
    authority_revalidation_required: true,
    capabilities: {
      local_analysis_permitted: true,
      network_access_permitted: false,
      filesystem_write_permitted: false,
      provider_invocation_permitted: false,
      platform_mutation_permitted: false,
      response_publication_permitted: false,
      pilot_permit_created: false,
      action_permit_created: false,
      external_execution_permitted: false,
      external_effect_permitted: false
    },
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(permit);
  return validatePermit(permit);
}

function validatePermit(permit) {
  exact(permit, PERMIT_KEYS, 'permit');
  req(permit.protocol === PROTOCOL && permit.version === VERSION && permit.artifact_type === PERMIT_TYPE, 'permit header mismatch');
  str(permit.permit_id, 'permit_id', /^urn:uu-aap:marketcloser:real-review-run-permit:[0-9a-f]{24}$/);
  exact(permit.source_materialization, MATERIALIZATION_BINDING_KEYS, 'source_materialization');
  exact(permit.authority_gate_binding, GATE_BINDING_KEYS, 'authority_gate_binding');
  req(permit.authority_gate_binding.authority_verified === true, 'permit requires positive authority gate');
  req(permit.authority_gate_binding.required_scope === Gate.REQUIRED_SCOPE, 'permit authority scope mismatch');
  req(['SYNTHETIC_AUTHORITY_CONFORMANCE_READY','AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED'].includes(permit.authority_gate_binding.gate_classification),
    'permit gate classification not positive');
  exact(permit.bridge_binding, BRIDGE_BINDING_KEYS, 'bridge_binding');
  exact(permit.execution_frontier, FRONTIER_KEYS, 'permit.execution_frontier');
  str(permit.execution_frontier.revision, 'permit.execution_frontier.revision', /^[0-9a-f]{40}$/);
  str(permit.execution_frontier.tree, 'permit.execution_frontier.tree', /^[0-9a-f]{40}$/);
  instant(permit.execution_frontier.observed_at, 'permit.execution_frontier.observed_at');
  exact(permit.run, PERMIT_RUN_KEYS, 'permit.run');
  req(permit.run.operation === OPERATION && permit.run.deterministic_input_bound === true, 'permit run binding mismatch');
  instant(permit.issued_at, 'permit.issued_at');
  instant(permit.valid_until, 'permit.valid_until');
  req(instant(permit.valid_until, 'permit.valid_until') > instant(permit.issued_at, 'permit.issued_at'), 'permit validity window invalid');
  req(instant(permit.valid_until, 'permit.valid_until') - instant(permit.issued_at, 'permit.issued_at') <= MAX_VALIDITY_SECONDS * 1000,
    'permit validity exceeds maximum');
  req(permit.one_shot === true && permit.max_invocations === 1 && permit.remaining_invocations === 1,
    'permit must remain one-shot with one remaining invocation');
  req(permit.consumed === false, 'materialized permit cannot already be consumed');
  req(permit.frontier_revalidation_required === true && permit.authority_revalidation_required === true,
    'permit must require frontier and authority revalidation');
  exact(permit.capabilities, CAPABILITY_KEYS, 'permit.capabilities');
  req(permit.capabilities.local_analysis_permitted === true, 'local analysis permission required');
  for (const key of CAPABILITY_KEYS.filter(key => key !== 'local_analysis_permitted')) {
    req(permit.capabilities[key] === false, `permit external capability must remain false: ${key}`);
  }
  req(Array.isArray(permit.non_effects) && JSON.stringify([...permit.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()),
    'permit non-effect set mismatch');
  req(permit.next_safe_action === NEXT_SAFE_ACTION, 'permit next safe action mismatch');
  req(permit.content_hash === computeContentHash(permit), 'permit content_hash mismatch');
  return permit;
}

function evaluateCurrentness(permit, observedFrontier, at) {
  validatePermit(permit);
  exact(observedFrontier, FRONTIER_KEYS, 'observed_frontier');
  const now = instant(at, 'revalidation time');
  if (now > instant(permit.valid_until, 'permit.valid_until')) return 'PERMIT_EXPIRED';
  if (observedFrontier.repository !== permit.execution_frontier.repository ||
      observedFrontier.revision !== permit.execution_frontier.revision ||
      observedFrontier.tree !== permit.execution_frontier.tree) return 'PERMIT_FRONTIER_STALE';
  if (instant(observedFrontier.observed_at, 'observed_frontier.observed_at') > now) return 'PERMIT_FRONTIER_TIME_INVALID';
  return 'PERMIT_FRONTIER_CURRENT_AUTHORITY_REVALIDATION_REQUIRED';
}

function deriveDecisionReceipt(input) {
  validateInput(input);
  const gateInput = loadGateInput(input.authority_gate_source);
  const gateReceipt = Gate.deriveReceipt(gateInput);
  const positive = gatePositive(gateReceipt);
  if (positive) validateTemporalBinding(input, gateReceipt);
  const permit = positive ? materializePermit(input, gateInput, gateReceipt) : null;
  const syntheticPositive = positive && gateReceipt.classification === 'SYNTHETIC_AUTHORITY_CONFORMANCE_READY';
  const classification = !positive
    ? 'AUTHORITY_NOT_READY_PERMIT_NOT_CREATED'
    : syntheticPositive
      ? 'SYNTHETIC_RUN_PERMIT_MATERIALIZED'
      : 'REAL_RUN_PERMIT_MATERIALIZED';
  const claims = {};
  TRUE_CLAIMS.forEach(key => { claims[key] = true; });
  FALSE_CLAIMS.forEach(key => { claims[key] = false; });
  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: DECISION_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:real-review-run-permit-materialization-receipt:${input.content_hash.slice(-24)}`,
    source_input: {
      materialization_id: input.materialization_id,
      materialization_hash: input.content_hash
    },
    authority_gate_binding: buildGateBinding(gateInput, gateReceipt),
    execution_frontier: clone(input.execution_frontier),
    requested_run: clone(input.requested_run),
    classification,
    permit_created: Boolean(permit),
    permit_binding: permit ? { permit_id: permit.permit_id, permit_hash: permit.content_hash } : null,
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: permit ? NEXT_SAFE_ACTION : 'OBTAIN_POSITIVE_REAL_REVIEW_RUN_AUTHORITY_GATE',
    evaluated_at: input.materialized_at,
    content_hash: ''
  };
  rehash(receipt);
  return validateDecisionReceipt(receipt);
}

function validateDecisionReceipt(receipt) {
  exact(receipt, DECISION_KEYS, 'decision receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === DECISION_TYPE, 'decision receipt header mismatch');
  str(receipt.receipt_id, 'decision receipt id', /^urn:uu-aap:marketcloser:real-review-run-permit-materialization-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'decision source_input');
  exact(receipt.authority_gate_binding, GATE_BINDING_KEYS, 'decision authority_gate_binding');
  exact(receipt.execution_frontier, FRONTIER_KEYS, 'decision execution_frontier');
  validateRequestedRun(receipt.requested_run);
  req(CLASSIFICATIONS.includes(receipt.classification), 'decision classification invalid');
  req(typeof receipt.permit_created === 'boolean', 'permit_created must be boolean');
  const shouldCreate = ['SYNTHETIC_RUN_PERMIT_MATERIALIZED','REAL_RUN_PERMIT_MATERIALIZED'].includes(receipt.classification);
  req(receipt.permit_created === shouldCreate, 'permit_created/classification mismatch');
  if (shouldCreate) exact(receipt.permit_binding, PERMIT_BINDING_KEYS, 'permit_binding');
  else req(receipt.permit_binding === null, 'non-issuable decision cannot contain permit binding');
  exact(receipt.claims, CLAIM_KEYS, 'claims');
  TRUE_CLAIMS.forEach(key => req(receipt.claims[key] === true, `required claim ${key}`));
  FALSE_CLAIMS.forEach(key => req(receipt.claims[key] === false, `prohibited claim ${key}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()),
    'decision non-effect set mismatch');
  instant(receipt.evaluated_at, 'decision evaluated_at');
  req(receipt.content_hash === computeContentHash(receipt), 'decision content_hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserRealReviewRunPermitMaterializationInputValidationReceipt',
    materialization_id: input.materialization_id,
    materialization_hash: input.content_hash,
    valid: true,
    stress_test_run: false,
    external_effect_available: false
  };
}

function parseText(text) {
  req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserRealReviewRunPermitError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function usage() {
  return [
    'MarketCloser Real Review Run Permit Materialization v0.1',
    '',
    'Usage:',
    '  node applications/marketcloser/v0.1/real-review-run-permit/v0.1/permit.js validate <file|->',
    '  node applications/marketcloser/v0.1/real-review-run-permit/v0.1/permit.js decision <file|->',
    '  node applications/marketcloser/v0.1/real-review-run-permit/v0.1/permit.js materialize <file|->',
    '  node applications/marketcloser/v0.1/real-review-run-permit/v0.1/permit.js help',
    '',
    'Materialization creates only a local one-shot analysis permit from an already-positive authority gate. It never runs the stress-test or creates PilotPermit/ActionPermit.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help','--help','-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  req(['validate','decision','materialize'].includes(command), `unsupported command: ${command}`);
  req(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input)
    : command === 'decision' ? deriveDecisionReceipt(input)
      : materializePermit(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: 'MARKETCLOSER_REAL_REVIEW_RUN_PERMIT_REJECTED', message: error.message || String(error) })}\n`);
    process.exitCode = 1;
  }
}
if (require.main === module) main();

module.exports = {
  MarketCloserRealReviewRunPermitError,
  PROTOCOL, VERSION, INPUT_TYPE, DECISION_TYPE, PERMIT_TYPE,
  ORIGIN_FRONTIER, ORIGIN_TREE, OPERATION, MAX_VALIDITY_SECONDS, NEXT_SAFE_ACTION,
  INPUT_KEYS, RUN_KEYS, CONTROL_KEYS, DECISION_KEYS, PERMIT_KEYS,
  CLASSIFICATIONS, REQUIRED_NON_EFFECTS, TRUE_CLAIMS, FALSE_CLAIMS, CLAIM_KEYS,
  canonicalize, computeContentHash, rehash, validateInput, loadGateInput,
  gatePositive, materializePermit, validatePermit, evaluateCurrentness,
  deriveDecisionReceipt, validateDecisionReceipt, validationReceipt,
  parseText, readInput, usage, runCli
};
