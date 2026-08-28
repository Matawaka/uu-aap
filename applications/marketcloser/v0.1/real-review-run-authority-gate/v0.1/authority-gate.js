'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Bridge = require(path.resolve(__dirname, '../../minimized-real-review-bridge/v0.1/bridge.js'));
const AuthorityCore = require(path.resolve(__dirname, '../../../../../proposals/poai/authority/tools/authority-core.js'));

const PROTOCOL = 'MARKETCLOSER-REAL-REVIEW-RUN-AUTHORITY-GATE';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserRealReviewRunAuthorityGateInput';
const RECEIPT_TYPE = 'MarketCloserRealReviewRunAuthorityGateReceipt';
const ORIGIN_FRONTIER = 'c22967d4ebf82336bf772fa7526b6d4e7b54765e';
const REQUIRED_SCOPE = 'marketcloser.real-review.run';

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'gate_id', 'evaluation_frontier',
  'bridge_source', 'effect_actor_subject', 'authority_verification_result',
  'evaluated_at', 'controls', 'content_hash'
]);
const FRONTIER_KEYS = Object.freeze(['repository', 'revision', 'observed_at']);
const BRIDGE_SOURCE_KEYS = Object.freeze(['mode', 'path', 'expected_bridge_input_hash']);
const ACTOR_KEYS = Object.freeze(['id', 'key_ref']);
const CONTROL_KEYS = Object.freeze([
  'local_only', 'read_only', 'authority_grant_creation_available',
  'live_root_mutation_available', 'stress_test_run_available',
  'response_candidate_available', 'publication_available', 'provider_invocation_available',
  'platform_mutation_available', 'pilot_permit_available', 'action_permit_available',
  'execution_available', 'external_effect_available'
]);
const RECEIPT_KEYS = Object.freeze([
  'protocol', 'version', 'receipt_type', 'receipt_id', 'source_input',
  'bridge_binding', 'authority_requirement', 'authority_evidence', 'classification',
  'authority_verified', 'run_permit_created', 'claims', 'non_effects',
  'next_safe_action', 'evaluated_at', 'content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['gate_id', 'gate_hash']);
const BRIDGE_BINDING_KEYS = Object.freeze([
  'bridge_id', 'bridge_hash', 'bridge_receipt_id', 'bridge_receipt_hash',
  'bridge_status', 'marketer_candidate_id', 'marketer_candidate_hash', 'marketer_candidate_state'
]);
const AUTHORITY_REQUIREMENT_KEYS = Object.freeze(['required_scope', 'required_target', 'effect_actor_subject']);
const AUTHORITY_EVIDENCE_KEYS = Object.freeze([
  'present', 'verification_result_valid', 'verification_id', 'verified_at',
  'result_status', 'result_required_scope', 'result_target', 'result_subject',
  'scope_match', 'target_match', 'subject_match', 'fresh'
]);

const CLASSIFICATIONS = Object.freeze([
  'SYNTHETIC_AUTHORITY_CONFORMANCE_READY',
  'AUTHORITY_EVIDENCE_REQUIRED',
  'AUTHORITY_SCOPE_MISMATCH',
  'AUTHORITY_TARGET_MISMATCH',
  'AUTHORITY_SUBJECT_MISMATCH',
  'AUTHORITY_EVIDENCE_STALE',
  'AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED'
]);

const TRUE_CLAIMS = Object.freeze([
  'exact_bridge_revalidated',
  'exact_bridge_receipt_bound',
  'application_run_scope_declared',
  'exact_run_target_declared',
  'authority_core_reused'
]);
const FALSE_CLAIMS = Object.freeze([
  'human_approval_treated_as_authority',
  'repository_authority_treated_as_application_authority',
  'fcl_scope_treated_as_marketcloser_scope',
  'authority_grant_created',
  'live_authority_root_modified',
  'run_permit_created',
  'stress_test_run',
  'stress_test_receipt_created',
  'response_candidate_created',
  'human_disposition_recorded',
  'pilot_permit_created',
  'action_permit_created',
  'execution_admitted',
  'publication_authorized',
  'external_effect_performed'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Human Approval != Authority Verification',
  'Repository Authority != Application Run Authority',
  'FCL Authority Scope != MarketCloser Run Scope',
  'Authority Verification Result != Authority Grant Creation',
  'Authority Verified != Run Permit Created',
  'Run Permit Candidate != Stress-Test Run',
  'Stress-Test Run != Response Publication',
  'Bridge Candidate != PilotPermit',
  'PilotPermit != ActionPermit',
  'ActionPermit != Execution'
]);

class MarketCloserRealReviewRunAuthorityGateError extends Error {}
function req(condition, message) { if (!condition) throw new MarketCloserRealReviewRunAuthorityGateError(message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
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
function hashObject(value) { return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex')}`; }
function exact(value, keys, label) {
  req(value && typeof value === 'object' && !Array.isArray(value), `${label} must be object`);
  req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} key mismatch`);
}
function str(value, label, pattern = null) { req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`); if (pattern) req(pattern.test(value), `${label} invalid`); }
function instant(value, label) { str(value, label); const n = Date.parse(value); req(Number.isFinite(n), `${label} invalid date-time`); return n; }
function actor(value, label) { exact(value, ACTOR_KEYS, label); str(value.id, `${label}.id`); str(value.key_ref, `${label}.key_ref`); }
function actorEq(a, b) { return Boolean(a && b && a.id === b.id && a.key_ref === b.key_ref); }

function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveBridgePath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository synthetic bridge path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'repository bridge path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported bridge source mode');
  return path.resolve(source.path);
}
function loadBridgeInput(source) {
  const resolved = resolveBridgePath(source);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  Bridge.validateInput(input);
  req(input.content_hash === source.expected_bridge_input_hash, 'bridge input hash does not match expected hash');
  return input;
}
function requiredTargetForBridgeReceipt(receipt) {
  return `urn:uu-aap:marketcloser:real-review-run:bridge-sha256:${receipt.content_hash.slice(7)}`;
}
function validateAuthorityResult(result) {
  if (result === null) return false;
  req(result && typeof result === 'object' && !Array.isArray(result), 'authority_verification_result must be object or null');
  const errors = AuthorityCore.validateVerificationResult(result);
  req(errors.length === 0, `authority verification result invalid: ${errors.join(', ')}`);
  return true;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.gate_id, 'gate_id', /^urn:uu-aap:marketcloser:real-review-run-authority-gate:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  req(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'repository mismatch');
  req(input.evaluation_frontier.revision === ORIGIN_FRONTIER, 'origin frontier mismatch');
  instant(input.evaluation_frontier.observed_at, 'evaluation_frontier.observed_at');
  exact(input.bridge_source, BRIDGE_SOURCE_KEYS, 'bridge_source');
  req(['repository_synthetic', 'local_private'].includes(input.bridge_source.mode), 'bridge source mode unsupported');
  str(input.bridge_source.path, 'bridge_source.path');
  str(input.bridge_source.expected_bridge_input_hash, 'bridge_source.expected_bridge_input_hash', /^sha256:[0-9a-f]{64}$/);
  actor(input.effect_actor_subject, 'effect_actor_subject');
  validateAuthorityResult(input.authority_verification_result);
  req(instant(input.evaluated_at, 'evaluated_at') >= instant(input.evaluation_frontier.observed_at, 'frontier observed_at'), 'evaluated_at before frontier');
  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true, 'gate must remain local/read-only');
  for (const key of CONTROL_KEYS.filter(k => !['local_only','read_only'].includes(k))) req(input.controls[key] === false, `effect capability must remain false: ${key}`);
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function classify(input, bridgeInput, bridgeReceipt, requiredTarget) {
  const result = input.authority_verification_result;
  if (result === null) return 'AUTHORITY_EVIDENCE_REQUIRED';
  if (result.required_scope !== REQUIRED_SCOPE) return 'AUTHORITY_SCOPE_MISMATCH';
  if (result.target !== requiredTarget) return 'AUTHORITY_TARGET_MISMATCH';
  if (!actorEq(result.subject, input.effect_actor_subject)) return 'AUTHORITY_SUBJECT_MISMATCH';
  const verifiedAt = instant(result.verified_at, 'authority verified_at');
  const bridgeAt = instant(bridgeInput.evaluation_frontier.observed_at, 'bridge observed_at');
  const evaluatedAt = instant(input.evaluated_at, 'gate evaluated_at');
  if (verifiedAt < bridgeAt || verifiedAt > evaluatedAt) return 'AUTHORITY_EVIDENCE_STALE';
  if (result.status !== 'established' || result.claims.issuer_entitlement_chain_valid !== true || result.claims.root_accepted_by_policy !== true) return 'AUTHORITY_EVIDENCE_REQUIRED';
  return bridgeReceipt.status === 'SYNTHETIC_MINIMIZED_BRIDGE_READY'
    ? 'SYNTHETIC_AUTHORITY_CONFORMANCE_READY'
    : 'AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED';
}

function deriveReceipt(input) {
  validateInput(input);
  const bridgeInput = loadBridgeInput(input.bridge_source);
  const bridgeReceipt = Bridge.deriveReceipt(bridgeInput);
  const requiredTarget = requiredTargetForBridgeReceipt(bridgeReceipt);
  const classification = classify(input, bridgeInput, bridgeReceipt, requiredTarget);
  const result = input.authority_verification_result;
  const resultPresent = result !== null;
  const scopeMatch = resultPresent && result.required_scope === REQUIRED_SCOPE;
  const targetMatch = resultPresent && result.target === requiredTarget;
  const subjectMatch = resultPresent && actorEq(result.subject, input.effect_actor_subject);
  const fresh = resultPresent && instant(result.verified_at, 'authority verified_at') >= instant(bridgeInput.evaluation_frontier.observed_at, 'bridge observed_at') && instant(result.verified_at, 'authority verified_at') <= instant(input.evaluated_at, 'gate evaluated_at');
  const positive = ['SYNTHETIC_AUTHORITY_CONFORMANCE_READY','AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED'].includes(classification);
  const claims = {}; TRUE_CLAIMS.forEach(k => { claims[k] = true; }); FALSE_CLAIMS.forEach(k => { claims[k] = false; });
  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:real-review-run-authority-gate-receipt:${input.content_hash.slice(-24)}`,
    source_input: { gate_id: input.gate_id, gate_hash: input.content_hash },
    bridge_binding: {
      bridge_id: bridgeInput.bridge_id,
      bridge_hash: bridgeInput.content_hash,
      bridge_receipt_id: bridgeReceipt.receipt_id,
      bridge_receipt_hash: bridgeReceipt.content_hash,
      bridge_status: bridgeReceipt.status,
      marketer_candidate_id: bridgeReceipt.marketer_binding.candidate_id,
      marketer_candidate_hash: bridgeReceipt.marketer_binding.candidate_hash,
      marketer_candidate_state: bridgeReceipt.marketer_binding.candidate_state
    },
    authority_requirement: {
      required_scope: REQUIRED_SCOPE,
      required_target: requiredTarget,
      effect_actor_subject: clone(input.effect_actor_subject)
    },
    authority_evidence: {
      present: resultPresent,
      verification_result_valid: resultPresent,
      verification_id: resultPresent ? result.verification_id : null,
      verified_at: resultPresent ? result.verified_at : null,
      result_status: resultPresent ? result.status : null,
      result_required_scope: resultPresent ? result.required_scope : null,
      result_target: resultPresent ? result.target : null,
      result_subject: resultPresent ? clone(result.subject) : null,
      scope_match: scopeMatch,
      target_match: targetMatch,
      subject_match: subjectMatch,
      fresh
    },
    classification,
    authority_verified: positive,
    run_permit_created: false,
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: positive && bridgeReceipt.status !== 'SYNTHETIC_MINIMIZED_BRIDGE_READY'
      ? 'REAL_REVIEW_RUN_PERMIT_REQUIRED'
      : positive
        ? 'STOP_AFTER_SYNTHETIC_AUTHORITY_CONFORMANCE'
        : 'OBTAIN_MATCHING_APPLICATION_AUTHORITY_EVIDENCE',
    evaluated_at: input.evaluated_at,
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === RECEIPT_TYPE, 'receipt header mismatch');
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:real-review-run-authority-gate-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.bridge_binding, BRIDGE_BINDING_KEYS, 'bridge_binding');
  exact(receipt.authority_requirement, AUTHORITY_REQUIREMENT_KEYS, 'authority_requirement');
  req(receipt.authority_requirement.required_scope === REQUIRED_SCOPE, 'required scope mismatch');
  actor(receipt.authority_requirement.effect_actor_subject, 'authority_requirement.effect_actor_subject');
  exact(receipt.authority_evidence, AUTHORITY_EVIDENCE_KEYS, 'authority_evidence');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification invalid');
  req(typeof receipt.authority_verified === 'boolean', 'authority_verified must be boolean');
  req(receipt.run_permit_created === false, 'gate cannot create run permit');
  const shouldPositive = ['SYNTHETIC_AUTHORITY_CONFORMANCE_READY','AUTHORITY_VERIFIED_RUN_PERMIT_NOT_CREATED'].includes(receipt.classification);
  req(receipt.authority_verified === shouldPositive, 'authority_verified/classification mismatch');
  exact(receipt.claims, CLAIM_KEYS, 'claims'); TRUE_CLAIMS.forEach(k => req(receipt.claims[k] === true, `required claim ${k}`)); FALSE_CLAIMS.forEach(k => req(receipt.claims[k] === false, `prohibited claim ${k}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'non_effect set mismatch');
  instant(receipt.evaluated_at, 'receipt.evaluated_at');
  req(receipt.content_hash === computeContentHash(receipt), 'receipt hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return { protocol: PROTOCOL, version: VERSION, receipt_type: 'MarketCloserRealReviewRunAuthorityGateInputValidationReceipt', gate_id: input.gate_id, gate_hash: input.content_hash, valid: true, authority_grant_created: false, run_permit_created: false, stress_test_run: false, external_effect_available: false };
}
function parseText(text) { req(typeof text === 'string' && text.trim(), 'input JSON required'); try { return JSON.parse(text); } catch (e) { throw new MarketCloserRealReviewRunAuthorityGateError(`invalid JSON: ${e.message}`); } }
function readInput(inputPath) { str(inputPath, 'input path'); return parseText(inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8')); }
function usage() { return ['MarketCloser Real Review Run Authority Gate v0.1','','Usage:','  node applications/marketcloser/v0.1/real-review-run-authority-gate/v0.1/authority-gate.js validate <file|->','  node applications/marketcloser/v0.1/real-review-run-authority-gate/v0.1/authority-gate.js evaluate <file|->','  node applications/marketcloser/v0.1/real-review-run-authority-gate/v0.1/authority-gate.js help','','The gate validates pre-existing application authority evidence only. It creates no authority grant, run permit or stress-test execution.'].join('\n'); }
function runCli(argv) { const command = argv[0] || 'help'; if (['help','--help','-h'].includes(command)) return {text:`${usage()}\n`,exitCode:0}; req(['validate','evaluate'].includes(command),`unsupported command: ${command}`); req(argv.length===2,`${command} requires one input`); const input=readInput(argv[1]); const result=command==='validate'?validationReceipt(input):deriveReceipt(input); return {text:`${JSON.stringify(canonicalize(result),null,2)}\n`,exitCode:0}; }
function main(){try{const r=runCli(process.argv.slice(2));process.stdout.write(r.text);process.exitCode=r.exitCode;}catch(e){process.stderr.write(`${JSON.stringify({error:'MARKETCLOSER_REAL_REVIEW_RUN_AUTHORITY_GATE_REJECTED',message:e.message||String(e)})}\n`);process.exitCode=1;}}
if(require.main===module)main();
module.exports={MarketCloserRealReviewRunAuthorityGateError,PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,REQUIRED_SCOPE,CLASSIFICATIONS,TRUE_CLAIMS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,canonicalize,computeContentHash,rehash,hashObject,requiredTargetForBridgeReceipt,validateInput,deriveReceipt,validateReceipt,validationReceipt,loadBridgeInput,parseText,readInput,usage,runCli};
