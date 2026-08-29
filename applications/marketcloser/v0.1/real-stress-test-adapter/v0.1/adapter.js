'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const Revalidation = require(path.resolve(__dirname, '../../real-review-local-run-revalidation/v0.1/revalidation.js'));
const Permit = require(path.resolve(__dirname, '../../real-review-run-permit/v0.1/permit.js'));
const Gate = require(path.resolve(__dirname, '../../real-review-run-authority-gate/v0.1/authority-gate.js'));
const Bridge = require(path.resolve(__dirname, '../../minimized-real-review-bridge/v0.1/bridge.js'));
const Deployment = require(path.resolve(__dirname, '../../deployment-observation/v0.1/deployment-observation.js'));
const Marketer = require(path.resolve(__dirname, '../../../../../products/marketer-pessimist/v0.1/real-review-intake/v0.1/real-review-intake.js'));
const Engine = require('./engine.js');

const PROTOCOL = 'MARKETCLOSER-REAL-STRESS-TEST-ADAPTER';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketCloserRealStressTestAdapterInput';
const RECEIPT_TYPE = 'MarketCloserRealStressTestReceipt';
const ORIGIN_FRONTIER = '2e06c019d2d94a2e72e13d461906ad508b987293';
const ORIGIN_TREE = 'f02e2960f64585ee02dcec9f93a069d1f8658991';
const OPERATION = Permit.OPERATION;
const NEXT_SAFE_ACTION = 'HUMAN_ANALYSIS_DISPOSITION_GATE_REQUIRED';

const INPUT_KEYS = Object.freeze([
  'protocol','version','artifact_type','adapter_id','origin','revalidation_source','operation','controls','content_hash'
]);
const ORIGIN_KEYS = Object.freeze(['repository','revision','tree']);
const SOURCE_KEYS = Object.freeze(['mode','path','expected_revalidation_input_hash']);
const CONTROL_KEYS = Object.freeze([
  'local_only','read_only','local_stress_test_compute_available','network_access_available',
  'filesystem_write_available','provider_invocation_available','platform_mutation_available',
  'response_candidate_available','human_disposition_available','publication_available',
  'pilot_permit_available','action_permit_available','external_execution_available','external_effect_available'
]);
const RECEIPT_KEYS = Object.freeze([
  'protocol','version','receipt_type','receipt_id','source_input','revalidation_binding','permit_binding',
  'candidate_binding','classification','analysis','execution','claims','non_effects','next_safe_action','content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['adapter_id','adapter_hash']);
const REVALIDATION_BINDING_KEYS = Object.freeze([
  'revalidation_id','revalidation_hash','receipt_id','receipt_hash','classification','local_run_ready'
]);
const PERMIT_BINDING_KEYS = Object.freeze([
  'permit_id','permit_hash','logical_invocation_id','logical_invocation_count','logically_consumed','compute_replay_idempotent'
]);
const CANDIDATE_BINDING_KEYS = Object.freeze([
  'candidate_id','candidate_hash','candidate_state','source_mode','bridge_receipt_hash'
]);
const EXECUTION_KEYS = Object.freeze([
  'operation','local_compute_performed','provider_invoked','network_accessed','filesystem_written','platform_mutated','external_effect_performed'
]);

const TRUE_CLAIMS = Object.freeze([
  'exact_revalidation_rederived','exact_candidate_rederived','deterministic_analysis_completed',
  'logical_permit_consumption_recorded','same_permit_same_candidate_same_logical_invocation',
  'human_disposition_still_required'
]);
const FALSE_CLAIMS = Object.freeze([
  'truth_certified','claim_rejected','automatic_negative_judgment','response_candidate_created',
  'human_disposition_recorded','publication_authorized','provider_invoked','network_accessed',
  'filesystem_written','platform_mutated','pilot_permit_created','action_permit_created',
  'external_execution_admitted','external_effect_performed','successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);
const REQUIRED_NON_EFFECTS = Object.freeze([
  'Real Source != Synthetic Fixture',
  'Deterministic Analysis != Truth',
  'Counterargument != Rejection',
  'Risk Hypothesis != Proof of Harm',
  'Stress-Test Completed != Response Candidate',
  'Stress-Test Completed != Human Disposition',
  'Stress-Test Completed != Publication Authority',
  'Logical Permit Consumption != ActionPermit Consumption',
  'Compute Replay != New Logical Invocation',
  'Successful Analysis != Successor Authority'
]);
const CLASSIFICATIONS = Object.freeze(['SYNTHETIC_STRESS_TEST_COMPLETED','REAL_STRESS_TEST_COMPLETED']);

class MarketCloserRealStressTestAdapterError extends Error {}
const req = (condition, message) => { if (!condition) throw new MarketCloserRealStressTestAdapterError(message); };
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
function repositoryRoot() { return path.resolve(__dirname, '../../../../../'); }
function resolveRevalidationPath(source) {
  const root = repositoryRoot();
  if (source.mode === 'repository_synthetic') {
    req(!path.isAbsolute(source.path) && !source.path.includes('..'), 'repository revalidation path must be relative and traversal-free');
    const resolved = path.resolve(root, source.path);
    req(resolved.startsWith(root + path.sep), 'revalidation path escapes repository');
    return resolved;
  }
  req(source.mode === 'local_private', 'unsupported revalidation source mode');
  return path.resolve(source.path);
}
function loadRevalidationInput(source) {
  const resolved = resolveRevalidationPath(source);
  const input = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  Revalidation.validateInput(input);
  req(input.content_hash === source.expected_revalidation_input_hash, 'revalidation input hash mismatch');
  return input;
}

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === PROTOCOL && input.version === VERSION && input.artifact_type === INPUT_TYPE, 'input header mismatch');
  str(input.adapter_id, 'adapter_id', /^urn:uu-aap:marketcloser:real-stress-test-adapter:[a-z0-9][a-z0-9:-]{2,191}$/);
  exact(input.origin, ORIGIN_KEYS, 'origin');
  req(input.origin.repository === 'Matawaka/uu-aap' && input.origin.revision === ORIGIN_FRONTIER && input.origin.tree === ORIGIN_TREE,
    'adapter origin mismatch');
  exact(input.revalidation_source, SOURCE_KEYS, 'revalidation_source');
  req(['repository_synthetic','local_private'].includes(input.revalidation_source.mode), 'revalidation source mode unsupported');
  str(input.revalidation_source.path, 'revalidation_source.path');
  str(input.revalidation_source.expected_revalidation_input_hash, 'expected revalidation hash', /^sha256:[0-9a-f]{64}$/);
  req(input.operation === OPERATION, 'operation mismatch');
  exact(input.controls, CONTROL_KEYS, 'controls');
  req(input.controls.local_only === true && input.controls.read_only === true && input.controls.local_stress_test_compute_available === true,
    'adapter must expose only local read-only compute');
  for (const key of CONTROL_KEYS.filter(k => !['local_only','read_only','local_stress_test_compute_available'].includes(k))) {
    req(input.controls[key] === false, `external capability must remain false: ${key}`);
  }
  req(input.content_hash === computeContentHash(input), 'input content_hash mismatch');
  return input;
}

function inspect(input) {
  validateInput(input);
  const revalidationInput = loadRevalidationInput(input.revalidation_source);
  const revalidationReceipt = Revalidation.deriveReceipt(revalidationInput);
  const ready = revalidationReceipt.local_run_ready === true;
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserRealStressTestAdapterInspectionReceipt',
    adapter_id: input.adapter_id,
    adapter_hash: input.content_hash,
    revalidation_id: revalidationInput.revalidation_id,
    revalidation_hash: revalidationInput.content_hash,
    revalidation_classification: revalidationReceipt.classification,
    adapter_status: ready
      ? (revalidationReceipt.classification === 'SYNTHETIC_LOCAL_RUN_READY' ? 'SYNTHETIC_ADAPTER_READY' : 'REAL_ADAPTER_READY')
      : 'REVALIDATION_NOT_READY',
    stress_test_run: false,
    external_effect_available: false
  };
}

function reconstructCandidate(revalidationInput, revalidationReceipt) {
  const materializationInput = Revalidation.loadMaterializationInput(revalidationInput.materialization_source);
  const gateInput = Permit.loadGateInput(materializationInput.authority_gate_source);
  const bridgeInput = Gate.loadBridgeInput(gateInput.bridge_source);
  const deploymentReceipt = Deployment.deriveReceipt(bridgeInput.deployment_observation);
  const marketerIntake = Bridge.deriveMarketerIntake(bridgeInput, deploymentReceipt);
  const candidate = Marketer.deriveCandidate(marketerIntake);
  Marketer.validateCandidate(candidate);
  req(candidate.candidate_id === revalidationReceipt.candidate_binding.marketer_candidate_id, 'candidate id does not match revalidation');
  req(candidate.content_hash === revalidationReceipt.candidate_binding.marketer_candidate_hash, 'candidate hash does not match revalidation');
  const bridgeReceipt = Bridge.deriveReceipt(bridgeInput);
  req(bridgeReceipt.content_hash === revalidationReceipt.candidate_binding.bridge_receipt_hash, 'bridge receipt does not match revalidation');
  return { materializationInput, gateInput, bridgeInput, bridgeReceipt, marketerIntake, candidate };
}

function logicalInvocationId(permit, candidate) {
  const seed = `${permit.content_hash}|${candidate.content_hash}|${OPERATION}`;
  return `urn:uu-aap:marketcloser:real-stress-test-logical-invocation:${crypto.createHash('sha256').update(seed,'utf8').digest('hex').slice(0,24)}`;
}

function stressTest(input) {
  validateInput(input);
  const revalidationInput = loadRevalidationInput(input.revalidation_source);
  const revalidationReceipt = Revalidation.deriveReceipt(revalidationInput);
  req(revalidationReceipt.local_run_ready === true, `revalidation not ready: ${revalidationReceipt.classification}`);
  req(['SYNTHETIC_LOCAL_RUN_READY','REAL_LOCAL_RUN_READY'].includes(revalidationReceipt.classification), 'unsupported ready classification');
  req(revalidationInput.permit !== null, 'ready revalidation must contain permit');
  Permit.validatePermit(revalidationInput.permit);

  const chain = reconstructCandidate(revalidationInput, revalidationReceipt);
  const candidate = chain.candidate;
  req(candidate.state === (revalidationReceipt.classification === 'REAL_LOCAL_RUN_READY'
    ? 'REAL_REVIEW_CANDIDATE_READY' : 'SYNTHETIC_CONFORMANCE_CANDIDATE_READY'), 'candidate state/revalidation mode mismatch');

  const analysis = Engine.analyzeBoundedCase(candidate.bounded_case);
  const logicalId = logicalInvocationId(revalidationInput.permit, candidate);
  const claims = {};
  TRUE_CLAIMS.forEach(k => { claims[k] = true; });
  FALSE_CLAIMS.forEach(k => { claims[k] = false; });

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketcloser:real-stress-test-receipt:${input.content_hash.slice(-24)}`,
    source_input: { adapter_id: input.adapter_id, adapter_hash: input.content_hash },
    revalidation_binding: {
      revalidation_id: revalidationInput.revalidation_id,
      revalidation_hash: revalidationInput.content_hash,
      receipt_id: revalidationReceipt.receipt_id,
      receipt_hash: revalidationReceipt.content_hash,
      classification: revalidationReceipt.classification,
      local_run_ready: true
    },
    permit_binding: {
      permit_id: revalidationInput.permit.permit_id,
      permit_hash: revalidationInput.permit.content_hash,
      logical_invocation_id: logicalId,
      logical_invocation_count: 1,
      logically_consumed: true,
      compute_replay_idempotent: true
    },
    candidate_binding: {
      candidate_id: candidate.candidate_id,
      candidate_hash: candidate.content_hash,
      candidate_state: candidate.state,
      source_mode: candidate.source_binding.mode,
      bridge_receipt_hash: chain.bridgeReceipt.content_hash
    },
    classification: revalidationReceipt.classification === 'REAL_LOCAL_RUN_READY'
      ? 'REAL_STRESS_TEST_COMPLETED' : 'SYNTHETIC_STRESS_TEST_COMPLETED',
    analysis,
    execution: {
      operation: OPERATION,
      local_compute_performed: true,
      provider_invoked: false,
      network_accessed: false,
      filesystem_written: false,
      platform_mutated: false,
      external_effect_performed: false
    },
    claims,
    non_effects: [...REQUIRED_NON_EFFECTS],
    next_safe_action: NEXT_SAFE_ACTION,
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt);
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === PROTOCOL && receipt.version === VERSION && receipt.receipt_type === RECEIPT_TYPE, 'receipt header mismatch');
  str(receipt.receipt_id, 'receipt_id', /^urn:uu-aap:marketcloser:real-stress-test-receipt:[0-9a-f]{24}$/);
  exact(receipt.source_input, SOURCE_INPUT_KEYS, 'source_input');
  exact(receipt.revalidation_binding, REVALIDATION_BINDING_KEYS, 'revalidation_binding');
  req(receipt.revalidation_binding.local_run_ready === true, 'stress-test receipt requires ready revalidation');
  exact(receipt.permit_binding, PERMIT_BINDING_KEYS, 'permit_binding');
  str(receipt.permit_binding.logical_invocation_id, 'logical_invocation_id', /^urn:uu-aap:marketcloser:real-stress-test-logical-invocation:[0-9a-f]{24}$/);
  req(receipt.permit_binding.logical_invocation_count === 1 && receipt.permit_binding.logically_consumed === true && receipt.permit_binding.compute_replay_idempotent === true,
    'logical one-shot consumption mismatch');
  exact(receipt.candidate_binding, CANDIDATE_BINDING_KEYS, 'candidate_binding');
  req(CLASSIFICATIONS.includes(receipt.classification), 'classification invalid');
  req(receipt.classification === (receipt.candidate_binding.candidate_state === 'REAL_REVIEW_CANDIDATE_READY'
    ? 'REAL_STRESS_TEST_COMPLETED' : 'SYNTHETIC_STRESS_TEST_COMPLETED'), 'classification/candidate state mismatch');
  req(receipt.analysis && Engine.STATES.includes(receipt.analysis.state), 'analysis state invalid');
  req(receipt.analysis.recommendation_candidate && Engine.RECOMMENDATION_CANDIDATES.includes(receipt.analysis.recommendation_candidate.candidate),
    'analysis recommendation invalid');
  req(receipt.analysis.success_criteria && receipt.analysis.success_criteria.no_external_effect === true, 'analysis no-effect criterion required');
  exact(receipt.execution, EXECUTION_KEYS, 'execution');
  req(receipt.execution.operation === OPERATION && receipt.execution.local_compute_performed === true, 'execution operation mismatch');
  for (const key of EXECUTION_KEYS.filter(k => !['operation','local_compute_performed'].includes(k))) req(receipt.execution[key] === false, `execution effect must remain false: ${key}`);
  exact(receipt.claims, CLAIM_KEYS, 'claims');
  TRUE_CLAIMS.forEach(k => req(receipt.claims[k] === true, `required claim ${k}`));
  FALSE_CLAIMS.forEach(k => req(receipt.claims[k] === false, `prohibited claim ${k}`));
  req(Array.isArray(receipt.non_effects) && JSON.stringify([...receipt.non_effects].sort()) === JSON.stringify([...REQUIRED_NON_EFFECTS].sort()), 'non_effect set mismatch');
  req(receipt.next_safe_action === NEXT_SAFE_ACTION, 'next safe action mismatch');
  req(receipt.content_hash === computeContentHash(receipt), 'receipt content_hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketCloserRealStressTestAdapterInputValidationReceipt',
    adapter_id: input.adapter_id,
    adapter_hash: input.content_hash,
    valid: true,
    stress_test_run: false,
    external_effect_available: false
  };
}
function parseText(text) {
  req(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON');
  try { return JSON.parse(text); }
  catch (error) { throw new MarketCloserRealStressTestAdapterError(`invalid JSON: ${error.message}`); }
}
function readInput(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0,'utf8') : fs.readFileSync(path.resolve(inputPath),'utf8');
  return parseText(text);
}
function usage() {
  return [
    'MarketCloser Real Stress-Test Adapter v0.1','',
    'Usage:',
    '  node applications/marketcloser/v0.1/real-stress-test-adapter/v0.1/adapter.js validate <file|->',
    '  node applications/marketcloser/v0.1/real-stress-test-adapter/v0.1/adapter.js inspect <file|->',
    '  node applications/marketcloser/v0.1/real-stress-test-adapter/v0.1/adapter.js stress-test <file|->',
    '  node applications/marketcloser/v0.1/real-stress-test-adapter/v0.1/adapter.js help','',
    'The adapter performs only deterministic local analysis after an exact ready revalidation. It never publishes, calls a provider or performs an external effect.'
  ].join('\n');
}
function runCli(argv) {
  const command = argv[0] || 'help';
  if (['help','--help','-h'].includes(command)) return { text: `${usage()}\n`, exitCode: 0 };
  req(['validate','inspect','stress-test'].includes(command), `unsupported command: ${command}`);
  req(argv.length === 2, `${command} requires exactly one input path or -`);
  const input = readInput(argv[1]);
  const result = command === 'validate' ? validationReceipt(input) : command === 'inspect' ? inspect(input) : stressTest(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}
function main() {
  try { const result = runCli(process.argv.slice(2)); process.stdout.write(result.text); process.exitCode = result.exitCode; }
  catch (error) { process.stderr.write(`${JSON.stringify({ error:'MARKETCLOSER_REAL_STRESS_TEST_ADAPTER_REJECTED', message:error.message || String(error) })}\n`); process.exitCode = 1; }
}
if (require.main === module) main();

module.exports = {
  MarketCloserRealStressTestAdapterError,
  PROTOCOL,VERSION,INPUT_TYPE,RECEIPT_TYPE,ORIGIN_FRONTIER,ORIGIN_TREE,OPERATION,NEXT_SAFE_ACTION,
  INPUT_KEYS,CONTROL_KEYS,RECEIPT_KEYS,TRUE_CLAIMS,FALSE_CLAIMS,CLAIM_KEYS,REQUIRED_NON_EFFECTS,CLASSIFICATIONS,
  canonicalize,computeContentHash,rehash,validateInput,loadRevalidationInput,inspect,reconstructCandidate,
  logicalInvocationId,stressTest,validateReceipt,validationReceipt,parseText,readInput,usage,runCli
};
