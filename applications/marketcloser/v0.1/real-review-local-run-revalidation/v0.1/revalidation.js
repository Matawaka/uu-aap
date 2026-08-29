'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Permit = require(path.resolve(__dirname, '../../real-review-run-permit/v0.1/permit.js'));
const Gate = require(path.resolve(__dirname, '../../real-review-run-authority-gate/v0.1/authority-gate.js'));
const AuthorityCore = require(path.resolve(__dirname, '../../../../../proposals/poai/authority/tools/authority-core.js'));

const PROTOCOL = 'MARKETCLOSER-REAL-REVIEW-LOCAL-RUN-REVALIDATION';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserRealReviewLocalRunRevalidationInput';
const RECEIPT_TYPE = 'MarketCloserRealReviewLocalRunRevalidationReceipt';
const ORIGIN_FRONTIER = '72f6ea7185b75ecf6ca459c8f88c8c613f3ae968';
const ORIGIN_TREE = '4610936795b5726eb074d4b0431e6d5b919e0d13';
const AUTHORITY_MAX_AGE_SECONDS = 3600;
const NEXT_SAFE_ACTION = 'REAL_STRESS_TEST_ADAPTER_REQUIRED';

const INPUT_KEYS = Object.freeze([
  'protocol','version','artifact_type','revalidation_id','origin','materialization_source',
  'permit','observed_frontier','revalidated_at','controls','content_hash'
]);
const ORIGIN_KEYS = Object.freeze(['repository','revision','tree']);
const SOURCE_KEYS = Object.freeze(['mode','path','expected_materialization_input_hash']);
const FRONTIER_KEYS = Object.freeze(['repository','revision','tree','observed_at']);
const CONTROL_KEYS = Object.freeze([
  'local_only','read_only','stress_test_run_available','real_stress_test_adapter_available',
  'network_access_available','filesystem_write_available','provider_invocation_available',
  'platform_mutation_available','response_candidate_available','publication_available',
  'pilot_permit_available','action_permit_available','external_execution_available','external_effect_available'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol','version','receipt_type','receipt_id','source_input','materialization_binding',
  'permit_binding','frontier_revalidation','authority_revalidation','candidate_binding',
  'classification','local_run_ready','stress_test_run','claims','non_effects',
  'next_safe_action','revalidated_at','content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['revalidation_id','revalidation_hash']);
const MATERIALIZATION_BINDING_KEYS = Object.freeze([
  'materialization_id','materialization_hash','decision_classification','decision_hash','permit_created'
]);
const PERMIT_BINDING_KEYS = Object.freeze([
  'present','permit_id','permit_hash','one_shot','consumed','remaining_invocations','operation'
]);
const FRONTIER_REVALIDATION_KEYS = Object.freeze([
  'expected_revision','expected_tree','observed_revision','observed_tree','revision_match','tree_match',
  'within_validity_window','frontier_time_valid'
]);
const AUTHORITY_REVALIDATION_KEYS = Object.freeze([
  'result_present','canonical_result_valid','status_established','scope_match','target_match','subject_match',
  'verified_not_future','within_freshness_window','root_accepted_by_policy','issuer_entitlement_chain_valid'
]);
const CANDIDATE_BINDING_KEYS = Object.freeze([
  'bridge_receipt_hash','marketer_candidate_id','marketer_candidate_hash','exact_materialization_match'
]);

const CLASSIFICATIONS = Object.freeze([
  'PERMIT_REQUIRED','PERMIT_INVALID','PERMIT_EXPIRED','PERMIT_FRONTIER_STALE',
  'PERMIT_ALREADY_CONSUMED','PERMIT_INVOCATION_COUNT_INVALID','AUTHORITY_REVALIDATION_FAILED',
  'CANDIDATE_BINDING_MISMATCH','SYNTHETIC_LOCAL_RUN_READY','REAL_LOCAL_RUN_READY'
]);

const TRUE_CLAIMS = Object.freeze([
  'exact_materialization_source_revalidated','current_frontier_observed','synthetic_local_mvp_not_invoked',
  'revalidation_only_boundary_preserved'
]);
const FALSE_CLAIMS = Object.freeze([
  'stress_test_run','stress_test_receipt_created','synthetic_local_mvp_invoked','real_source_relabelled_synthetic',
  'response_candidate_created','pilot_permit_created','action_permit_created','provider_invoked','network_accessed',
  'filesystem_written','platform_mutated','publication_authorized','external_execution_admitted',
  'external_effect_performed','successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Permit Possession != Current Preconditions',
  'Authority Previously Verified != Authority Still Current',
  'Main Changed != Permit Still Current',
  'Revalidation Ready != Stress-Test Executed',
  'Real Candidate != Synthetic Local MVP Input',
  'Run Permit != PilotPermit',
  'Run Permit != ActionPermit',
  'Local Run Ready != Publication Authority',
  'Consumed Permit != Retry Permission',
  'Successful Revalidation != Successor Authority'
]);

class MarketCloserRealReviewLocalRunRevalidationError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserRealReviewLocalRunRevalidationError(message); };
const clone = value => JSON.parse(JSON.stringify(value));
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonicalize(value[k])]));
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
function instant(value, label) {
  str(value, label); const n = Date.parse(value); req(Number.isFinite(n), `${label} invalid date-time`); return n;
}
function actorEq(a, b) { return Boolean(a && b && a.id === b.id && a.key_ref === b.key_ref); }
function deepEqual(a, b) { return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b)); }

function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveMaterializationPath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository materialization path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'materialization path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported materialization source mode');
  return path.resolve(source.path);
}
function loadMaterializationInput(source) {
  const resolved = resolveMaterializationPath(source);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  Permit.validateInput(input);
  req(input.content_hash === source.expected_materialization_input_hash, 'materialization input hash mismatch');
  return input;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.revalidation_id, 'revalidation_id', /^urn:uu-aap:marketcloser:real-review-local-run-revalidation:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.origin, ORIGIN_KEYS, 'origin');
  req(input.origin.repository === 'Matawaka/uu-aap', 'origin repository mismatch');
  req(input.origin.revision === ORIGIN_FRONTIER && input.origin.tree === ORIGIN_TREE, 'origin frontier mismatch');
  exact(input.materialization_source, SOURCE_KEYS, 'materialization_source');
  req(['repository_synthetic','local_private'].includes(input.materialization_source.mode), 'materialization source mode unsupported');
  str(input.materialization_source.path, 'materialization_source.path');
  str(input.materialization_source.expected_materialization_input_hash, 'expected materialization hash', /^sha256:[0-9a-f]{64}$/);
  req(input.permit === null || (input.permit && typeof input.permit === 'object' && !Array.isArray(input.permit)), 'permit must be object or null');
  exact(input.observed_frontier, FRONTIER_KEYS, 'observed_frontier');
  req(input.observed_frontier.repository === 'Matawaka/uu-aap', 'observed frontier repository mismatch');
  str(input.observed_frontier.revision, 'observed_frontier.revision', /^[0-9a-f]{40}$/);
  str(input.observed_frontier.tree, 'observed_frontier.tree', /^[0-9a-f]{40}$/);
  instant(input.observed_frontier.observed_at, 'observed_frontier.observed_at');
  req(instant(input.revalidated_at, 'revalidated_at') >= instant(input.observed_frontier.observed_at, 'observed_frontier.observed_at'), 'revalidated_at precedes frontier observation');
  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true, 'revalidation must remain local/read-only');
  for (const key of CONTROL_KEYS.filter(k => !['local_only','read_only'].includes(k))) req(input.controls[key] === false, `effect capability must remain false: ${key}`);
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function authorityChecks(materializationInput, gateInput, gateReceipt, revalidatedAt) {
  const result = gateInput.authority_verification_result;
  if (!result) return {
    result_present: false, canonical_result_valid: false, status_established: false,
    scope_match: false, target_match: false, subject_match: false,
    verified_not_future: false, within_freshness_window: false,
    root_accepted_by_policy: false, issuer_entitlement_chain_valid: false
  };
  const coreErrors = AuthorityCore.validateVerificationResult(result);
  const now = instant(revalidatedAt, 'revalidated_at');
  const verifiedAt = instant(result.verified_at, 'authority verified_at');
  const age = now - verifiedAt;
  return {
    result_present: true,
    canonical_result_valid: coreErrors.length === 0,
    status_established: result.status === 'established',
    scope_match: result.required_scope === gateReceipt.authority_requirement.required_scope,
    target_match: result.target === gateReceipt.authority_requirement.required_target,
    subject_match: actorEq(result.subject, gateReceipt.authority_requirement.effect_actor_subject),
    verified_not_future: verifiedAt <= now,
    within_freshness_window: age >= 0 && age <= AUTHORITY_MAX_AGE_SECONDS * 1000,
    root_accepted_by_policy: result.claims && result.claims.root_accepted_by_policy === true,
    issuer_entitlement_chain_valid: result.claims && result.claims.issuer_entitlement_chain_valid === true
  };
}
function authorityReady(checks) { return Object.values(checks).every(Boolean); }

function inspectPermitState(permit) {
  if (permit === null) return 'PERMIT_REQUIRED';
  if (permit.consumed === true) return 'PERMIT_ALREADY_CONSUMED';
  if (permit.one_shot !== true || permit.max_invocations !== 1 || permit.remaining_invocations !== 1) return 'PERMIT_INVOCATION_COUNT_INVALID';
  try { Permit.validatePermit(permit); }
  catch (_) { return 'PERMIT_INVALID'; }
  return null;
}

function deriveReceipt(input) {
  validateInput(input);
  const materializationInput = loadMaterializationInput(input.materialization_source);
  const materializationDecision = Permit.deriveDecisionReceipt(materializationInput);
  const gateInput = Permit.loadGateInput(materializationInput.authority_gate_source);
  const gateReceipt = Gate.deriveReceipt(gateInput);
  const aChecks = authorityChecks(materializationInput, gateInput, gateReceipt, input.revalidated_at);

  let classification = inspectPermitState(input.permit);
  let expectedPermit = null;
  let exactPermitMatch = false;
  let currentness = null;

  if (classification === null) {
    if (!Permit.gatePositive(gateReceipt) || !authorityReady(aChecks)) {
      classification = 'AUTHORITY_REVALIDATION_FAILED';
    } else {
      try { expectedPermit = Permit.materializePermit(materializationInput); }
      catch (_) { classification = 'AUTHORITY_REVALIDATION_FAILED'; }
    }
  }

  if (classification === null) {
    exactPermitMatch = deepEqual(expectedPermit, input.permit);
    if (!exactPermitMatch) classification = 'CANDIDATE_BINDING_MISMATCH';
  }

  if (classification === null) {
    currentness = Permit.evaluateCurrentness(input.permit, input.observed_frontier, input.revalidated_at);
    if (currentness === 'PERMIT_EXPIRED') classification = 'PERMIT_EXPIRED';
    else if (currentness === 'PERMIT_FRONTIER_STALE') classification = 'PERMIT_FRONTIER_STALE';
    else if (currentness !== 'PERMIT_FRONTIER_CURRENT_AUTHORITY_REVALIDATION_REQUIRED') classification = 'PERMIT_INVALID';
  }

  if (classification === null) {
    classification = gateReceipt.classification === 'SYNTHETIC_AUTHORITY_CONFORMANCE_READY'
      ? 'SYNTHETIC_LOCAL_RUN_READY'
      : 'REAL_LOCAL_RUN_READY';
  }

  const ready = ['SYNTHETIC_LOCAL_RUN_READY','REAL_LOCAL_RUN_READY'].includes(classification);
  const permit = input.permit;
  const revisionMatch = Boolean(permit && permit.execution_frontier && permit.execution_frontier.revision === input.observed_frontier.revision);
  const treeMatch = Boolean(permit && permit.execution_frontier && permit.execution_frontier.tree === input.observed_frontier.tree);
  const now = instant(input.revalidated_at, 'revalidated_at');
  const withinValidity = Boolean(permit && Number.isFinite(Date.parse(permit.issued_at)) && Number.isFinite(Date.parse(permit.valid_until)) && now >= Date.parse(permit.issued_at) && now <= Date.parse(permit.valid_until));
  const frontierTimeValid = instant(input.observed_frontier.observed_at, 'observed_frontier.observed_at') <= now;

  const claims = {};
  TRUE_CLAIMS.forEach(k => { claims[k] = true; });
  FALSE_CLAIMS.forEach(k => { claims[k] = false; });

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:real-review-local-run-revalidation-receipt:${input.content_hash.slice(-24)}`,
    source_input: { revalidation_id: input.revalidation_id, revalidation_hash: input.content_hash },
    materialization_binding: {
      materialization_id: materializationInput.materialization_id,
      materialization_hash: materializationInput.content_hash,
      decision_classification: materializationDecision.classification,
      decision_hash: materializationDecision.content_hash,
      permit_created: materializationDecision.permit_created
    },
    permit_binding: {
      present: permit !== null,
      permit_id: permit ? permit.permit_id || null : null,
      permit_hash: permit ? permit.content_hash || null : null,
      one_shot: permit ? permit.one_shot === true : false,
      consumed: permit ? permit.consumed === true : false,
      remaining_invocations: permit && Number.isInteger(permit.remaining_invocations) ? permit.remaining_invocations : 0,
      operation: permit && permit.run ? permit.run.operation || null : null
    },
    frontier_revalidation: {
      expected_revision: permit && permit.execution_frontier ? permit.execution_frontier.revision : null,
      expected_tree: permit && permit.execution_frontier ? permit.execution_frontier.tree : null,
      observed_revision: input.observed_frontier.revision,
      observed_tree: input.observed_frontier.tree,
      revision_match: revisionMatch,
      tree_match: treeMatch,
      within_validity_window: withinValidity,
      frontier_time_valid: frontierTimeValid
    },
    authority_revalidation: aChecks,
    candidate_binding: {
      bridge_receipt_hash: gateReceipt.bridge_binding.bridge_receipt_hash,
      marketer_candidate_id: gateReceipt.bridge_binding.marketer_candidate_id,
      marketer_candidate_hash: gateReceipt.bridge_binding.marketer_candidate_hash,
      exact_materialization_match: exactPermitMatch
    },
    classification,
    local_run_ready: ready,
    stress_test_run: false,
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: ready ? NEXT_SAFE_ACTION : 'STOP_AND_REPAIR_REVALIDATION_PRECONDITIONS',
    revalidated_at: input.revalidated_at,
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === RECEIPT_TYPE, 'receipt header mismatch');
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:real-review-local-run-revalidation-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.materialization_binding, MATERIALIZATION_BINDING_KEYS, 'materialization_binding');
  exact(receipt.permit_binding, PERMIT_BINDING_KEYS, 'permit_binding');
  exact(receipt.frontier_revalidation, FRONTIER_REVALIDATION_KEYS, 'frontier_revalidation');
  exact(receipt.authority_revalidation, AUTHORITY_REVALIDATION_KEYS, 'authority_revalidation');
  exact(receipt.candidate_binding, CANDIDATE_BINDING_KEYS, 'candidate_binding');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification invalid');
  const shouldReady = ['SYNTHETIC_LOCAL_RUN_READY','REAL_LOCAL_RUN_READY'].includes(receipt.classification);
  req(receipt.local_run_ready === shouldReady, 'local_run_ready/classification mismatch');
  req(receipt.stress_test_run === false, 'revalidation cannot run stress-test');
  if (shouldReady) {
    req(receipt.permit_binding.present === true && receipt.permit_binding.one_shot === true && receipt.permit_binding.consumed === false && receipt.permit_binding.remaining_invocations === 1, 'ready receipt permit state invalid');
    req(receipt.frontier_revalidation.revision_match === true && receipt.frontier_revalidation.tree_match === true && receipt.frontier_revalidation.within_validity_window === true && receipt.frontier_revalidation.frontier_time_valid === true, 'ready receipt frontier invalid');
    req(authorityReady(receipt.authority_revalidation), 'ready receipt authority revalidation invalid');
    req(receipt.candidate_binding.exact_materialization_match === true, 'ready receipt candidate binding invalid');
    req(receipt.next_safe_action === NEXT_SAFE_ACTION, 'ready receipt next action mismatch');
  } else {
    req(receipt.next_safe_action === 'STOP_AND_REPAIR_REVALIDATION_PRECONDITIONS', 'non-ready receipt must stop');
  }
  exact(receipt.claims, CLAIM_KEYS, 'claims');
  TRUE_CLAIMS.forEach(k => req(receipt.claims[k] === true, `required claim ${k}`));
  FALSE_CLAIMS.forEach(k => req(receipt.claims[k] === false, `prohibited claim ${k}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'non_effect set mismatch');
  instant(receipt.revalidated_at, 'receipt.revalidated_at');
  req(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserRealReviewLocalRunRevalidationInputValidationReceipt',
    revalidation_id: input.revalidation_id,
    revalidation_hash: input.content_hash,
    valid: true,
    stress_test_run: false,
    external_effect_available: false
  };
}
function parseText(text) {
  req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserRealReviewLocalRunRevalidationError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}
function usage() {
  return [
    'MarketCloser Real Review Local Run Revalidation v0.1',
    '',
    'Usage:',
    '  node applications/marketcloser/v0.1/real-review-local-run-revalidation/v0.1/revalidation.js validate <file|->',
    '  node applications/marketcloser/v0.1/real-review-local-run-revalidation/v0.1/revalidation.js receipt <file|->',
    '  node applications/marketcloser/v0.1/real-review-local-run-revalidation/v0.1/revalidation.js help',
    '',
    'Revalidation never runs the stress-test. A ready receipt only permits handoff to a separate real stress-test adapter.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help','--help','-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  req(['validate','receipt'].includes(command), `unsupported command: ${command}`);
  req(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : deriveReceipt(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try { const result = runCli(process.argv.slice(2)); process.stdout.write(result.text); process.exitCode = result.exitCode; }
  catch (error) { process.stderr.write(`${JSON.stringify({ error: 'MARKETCLOSER_REAL_REVIEW_LOCAL_RUN_REVALIDATION_REJECTED', message: error.message || String(error) })}\n`); process.exitCode = 1; }
}
if (require.main === module) main();

module.exports = {
  MarketCloserRealReviewLocalRunRevalidationError,
  PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,ORIGIN_TREE,AUTHORITY_MAX_AGE_SECONDS,NEXT_SAFE_ACTION,
  INPUT_KEYS,CONTROL_KEYS,RECEIPT_KEYS,CLASSIFICATIONS,TRUE_CLAIMS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,
  canonicalize,computeContentHash,rehash,validateInput,loadMaterializationInput,authorityChecks,authorityReady,
  inspectPermitState,deriveReceipt,validateReceipt,validationReceipt,parseText,readInput,usage,runCli
};
