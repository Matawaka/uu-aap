#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ReceiptRuntime = require('../../receipt-runtime/v0.1/receipt-runtime.js');

const VERSION = '0.1';
const PROTOCOL = 'UU-AAP-IMPLEMENTATION-SUBSTITUTION-ASSESSMENT';
const RECEIPT_TYPE = 'SubstitutionAssessmentReceipt';
const IDENTITY_PROFILE = ReceiptRuntime.PROFILE_OMIT_CONTENT_HASH;

const DIMENSIONS = Object.freeze([
  'wire_schema',
  'semantic',
  'conformance',
  'dependency_fit',
  'effect_ceiling',
  'authority_responsibility',
  'frontier_freshness',
  'consumer_operational'
]);

const FINDINGS = Object.freeze([
  'SATISFIED',
  'ADAPTER_REQUIRED',
  'UNSATISFIED',
  'INSUFFICIENT_EVIDENCE',
  'NOT_APPLICABLE'
]);

const DECISIONS = Object.freeze([
  'SUBSTITUTABLE',
  'ADAPTER_REQUIRED',
  'NOT_SUBSTITUTABLE',
  'INSUFFICIENT_EVIDENCE'
]);

const NON_EFFECTS = Object.freeze({
  implementation_selected: false,
  runtime_activated: false,
  authority_created: false,
  authority_expanded: false,
  responsibility_accepted: false,
  action_permit_created: false,
  execution_admitted: false,
  action_performed: false,
  external_effect_performed: false,
  universal_compatibility_established: false,
  universal_substitutability_established: false,
  historical_evidence_rewritten: false
});

class ImplementationSubstitutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImplementationSubstitutionError';
  }
}

function fail(message) {
  throw new ImplementationSubstitutionError(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} keys mismatch`);
  }
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be a non-empty string`);
}

function stringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  if (!allowEmpty && value.length === 0) fail(`${label} must not be empty`);
  const seen = new Set();
  value.forEach((item, index) => {
    nonEmptyString(item, `${label}[${index}]`);
    if (seen.has(item)) fail(`${label} contains duplicate evidence ref: ${item}`);
    seen.add(item);
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function computeContentHash(value) {
  return ReceiptRuntime.computeContentHash(IDENTITY_PROFILE, value);
}

function rehash(value) {
  return ReceiptRuntime.rehash(IDENTITY_PROFILE, value);
}

function validateImplementation(value, label) {
  exactKeys(value, ['implementation_id', 'component_id', 'source_path', 'source_blob_sha', 'profile_ref'], label);
  nonEmptyString(value.implementation_id, `${label}.implementation_id`);
  nonEmptyString(value.component_id, `${label}.component_id`);
  nonEmptyString(value.source_path, `${label}.source_path`);
  if (!/^[0-9a-f]{40}$/.test(value.source_blob_sha || '')) fail(`${label}.source_blob_sha must be a Git blob SHA`);
  nonEmptyString(value.profile_ref, `${label}.profile_ref`);
}

function validateDimension(value, label) {
  exactKeys(value, ['required', 'finding', 'evidence_refs', 'reason'], label);
  if (typeof value.required !== 'boolean') fail(`${label}.required must be boolean`);
  if (!FINDINGS.includes(value.finding)) fail(`${label}.finding is unsupported: ${value.finding}`);
  stringArray(value.evidence_refs, `${label}.evidence_refs`, {
    allowEmpty: value.finding === 'INSUFFICIENT_EVIDENCE'
  });
  nonEmptyString(value.reason, `${label}.reason`);
  if (value.required && value.finding === 'NOT_APPLICABLE') {
    fail(`${label}: required dimension cannot be NOT_APPLICABLE`);
  }
}

function validateInput(input) {
  exactKeys(input, [
    'artifact_type',
    'version',
    'assessment_id',
    'assessment_frontier',
    'consumer',
    'substitution_scope',
    'incumbent',
    'candidate',
    'dimensions',
    'constraints',
    'content_hash'
  ], 'input');

  if (input.artifact_type !== 'UU-AAP-Implementation-Substitution-Assessment-Input') {
    fail('input artifact_type mismatch');
  }
  if (input.version !== VERSION) fail(`input version must be ${VERSION}`);
  nonEmptyString(input.assessment_id, 'input.assessment_id');

  exactKeys(input.assessment_frontier, ['repository', 'revision'], 'input.assessment_frontier');
  nonEmptyString(input.assessment_frontier.repository, 'input.assessment_frontier.repository');
  if (!/^[0-9a-f]{40}$/.test(input.assessment_frontier.revision || '')) {
    fail('input.assessment_frontier.revision must be a Git commit SHA');
  }

  exactKeys(input.consumer, ['component_id', 'component_version'], 'input.consumer');
  nonEmptyString(input.consumer.component_id, 'input.consumer.component_id');
  nonEmptyString(input.consumer.component_version, 'input.consumer.component_version');

  exactKeys(input.substitution_scope, ['scope_kind', 'scope_id', 'whole_component_substitution'], 'input.substitution_scope');
  if (!['FUNCTION', 'INTERFACE'].includes(input.substitution_scope.scope_kind)) {
    fail('v0.1 substitution_scope.scope_kind must be FUNCTION or INTERFACE');
  }
  nonEmptyString(input.substitution_scope.scope_id, 'input.substitution_scope.scope_id');
  if (input.substitution_scope.whole_component_substitution !== false) {
    fail('v0.1 does not assess whole-component substitutability');
  }

  validateImplementation(input.incumbent, 'input.incumbent');
  validateImplementation(input.candidate, 'input.candidate');
  if (input.incumbent.implementation_id === input.candidate.implementation_id) {
    fail('incumbent and candidate implementation_id must differ');
  }

  exactKeys(input.dimensions, DIMENSIONS, 'input.dimensions');
  for (const dimension of DIMENSIONS) validateDimension(input.dimensions[dimension], `input.dimensions.${dimension}`);

  exactKeys(input.constraints, [
    'selection_requested',
    'authorization_requested',
    'activation_requested',
    'execution_requested'
  ], 'input.constraints');
  for (const key of Object.keys(input.constraints)) {
    if (input.constraints[key] !== false) fail(`input.constraints.${key} must remain false`);
  }

  if (!/^sha256:[0-9a-f]{64}$/.test(input.content_hash || '')) fail('input.content_hash format invalid');
  const expected = computeContentHash(input);
  if (input.content_hash !== expected) fail(`input.content_hash mismatch: expected ${expected}`);
  return input;
}

function dimensionNamesByFinding(dimensions, finding) {
  return DIMENSIONS.filter((name) => dimensions[name].finding === finding);
}

function deriveDecision(dimensions) {
  const unsatisfied = dimensionNamesByFinding(dimensions, 'UNSATISFIED');
  const insufficient = dimensionNamesByFinding(dimensions, 'INSUFFICIENT_EVIDENCE');
  const adapter = dimensionNamesByFinding(dimensions, 'ADAPTER_REQUIRED');

  if (unsatisfied.length) return 'NOT_SUBSTITUTABLE';
  if (insufficient.length) return 'INSUFFICIENT_EVIDENCE';
  if (adapter.length) return 'ADAPTER_REQUIRED';
  return 'SUBSTITUTABLE';
}

function buildReceipt(input) {
  validateInput(input);
  const decision = deriveDecision(input.dimensions);
  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    assessment_id: input.assessment_id,
    assessment_input_hash: input.content_hash,
    assessment_frontier: clone(input.assessment_frontier),
    consumer: clone(input.consumer),
    substitution_scope: clone(input.substitution_scope),
    incumbent: clone(input.incumbent),
    candidate: clone(input.candidate),
    decision,
    dimension_results: clone(input.dimensions),
    decision_basis: {
      unsatisfied_dimensions: dimensionNamesByFinding(input.dimensions, 'UNSATISFIED'),
      insufficient_dimensions: dimensionNamesByFinding(input.dimensions, 'INSUFFICIENT_EVIDENCE'),
      adapter_required_dimensions: dimensionNamesByFinding(input.dimensions, 'ADAPTER_REQUIRED'),
      not_applicable_dimensions: dimensionNamesByFinding(input.dimensions, 'NOT_APPLICABLE'),
      evidence_ref_count: DIMENSIONS.reduce((count, name) => count + input.dimensions[name].evidence_refs.length, 0)
    },
    assertions: {
      consumer_specific: true,
      scope_specific: true,
      exact_frontier_bound: true,
      no_required_dimension_relaxed: true,
      decision_precedence_applied: true,
      whole_component_substitution_assessed: false
    },
    non_effects: clone(NON_EFFECTS),
    content_hash: ''
  };
  rehash(receipt);
  return validateReceipt(receipt, input);
}

function validateReceipt(receipt, input = null) {
  exactKeys(receipt, [
    'protocol',
    'version',
    'receipt_type',
    'assessment_id',
    'assessment_input_hash',
    'assessment_frontier',
    'consumer',
    'substitution_scope',
    'incumbent',
    'candidate',
    'decision',
    'dimension_results',
    'decision_basis',
    'assertions',
    'non_effects',
    'content_hash'
  ], 'receipt');

  if (receipt.protocol !== PROTOCOL || receipt.version !== VERSION || receipt.receipt_type !== RECEIPT_TYPE) {
    fail('receipt envelope mismatch');
  }
  if (!DECISIONS.includes(receipt.decision)) fail(`receipt decision unsupported: ${receipt.decision}`);

  exactKeys(receipt.dimension_results, DIMENSIONS, 'receipt.dimension_results');
  for (const dimension of DIMENSIONS) {
    validateDimension(receipt.dimension_results[dimension], `receipt.dimension_results.${dimension}`);
  }
  const expectedDecision = deriveDecision(receipt.dimension_results);
  if (receipt.decision !== expectedDecision) fail(`receipt decision mismatch: expected ${expectedDecision}`);

  exactKeys(receipt.decision_basis, [
    'unsatisfied_dimensions',
    'insufficient_dimensions',
    'adapter_required_dimensions',
    'not_applicable_dimensions',
    'evidence_ref_count'
  ], 'receipt.decision_basis');
  const expectedBasis = {
    unsatisfied_dimensions: dimensionNamesByFinding(receipt.dimension_results, 'UNSATISFIED'),
    insufficient_dimensions: dimensionNamesByFinding(receipt.dimension_results, 'INSUFFICIENT_EVIDENCE'),
    adapter_required_dimensions: dimensionNamesByFinding(receipt.dimension_results, 'ADAPTER_REQUIRED'),
    not_applicable_dimensions: dimensionNamesByFinding(receipt.dimension_results, 'NOT_APPLICABLE'),
    evidence_ref_count: DIMENSIONS.reduce((count, name) => count + receipt.dimension_results[name].evidence_refs.length, 0)
  };
  if (JSON.stringify(receipt.decision_basis) !== JSON.stringify(expectedBasis)) fail('receipt decision_basis mismatch');

  exactKeys(receipt.assertions, [
    'consumer_specific',
    'scope_specific',
    'exact_frontier_bound',
    'no_required_dimension_relaxed',
    'decision_precedence_applied',
    'whole_component_substitution_assessed'
  ], 'receipt.assertions');
  for (const key of [
    'consumer_specific',
    'scope_specific',
    'exact_frontier_bound',
    'no_required_dimension_relaxed',
    'decision_precedence_applied'
  ]) {
    if (receipt.assertions[key] !== true) fail(`receipt.assertions.${key} must be true`);
  }
  if (receipt.assertions.whole_component_substitution_assessed !== false) {
    fail('receipt cannot claim whole-component substitution assessment in v0.1');
  }

  exactKeys(receipt.non_effects, Object.keys(NON_EFFECTS), 'receipt.non_effects');
  for (const [key, expected] of Object.entries(NON_EFFECTS)) {
    if (receipt.non_effects[key] !== expected) fail(`receipt.non_effects.${key} boundary mismatch`);
  }

  if (!/^sha256:[0-9a-f]{64}$/.test(receipt.assessment_input_hash || '')) fail('receipt assessment_input_hash invalid');
  if (!/^sha256:[0-9a-f]{64}$/.test(receipt.content_hash || '')) fail('receipt content_hash invalid');
  const expectedHash = computeContentHash(receipt);
  if (receipt.content_hash !== expectedHash) fail(`receipt content_hash mismatch: expected ${expectedHash}`);

  if (input) {
    validateInput(input);
    if (receipt.assessment_id !== input.assessment_id) fail('receipt assessment_id/input mismatch');
    if (receipt.assessment_input_hash !== input.content_hash) fail('receipt assessment_input_hash/input mismatch');
    for (const key of ['assessment_frontier', 'consumer', 'substitution_scope', 'incumbent', 'candidate']) {
      if (!ReceiptRuntime.deepEqualCanonical(receipt[key], input[key])) fail(`receipt ${key}/input mismatch`);
    }
    if (!ReceiptRuntime.deepEqualCanonical(receipt.dimension_results, input.dimensions)) {
      fail('receipt dimension_results/input mismatch');
    }
  }

  return receipt;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function usage() {
  return [
    'UU-AAP Implementation Substitution Assessment v0.1',
    '',
    'Usage:',
    '  node tooling/implementation-substitution/v0.1/implementation-substitution.js assess <input.json>',
    '',
    'The assessment is read-only and does not select, authorize, activate or execute an implementation.'
  ].join('\n');
}

function runCli(argv = process.argv.slice(2)) {
  const command = argv[0] || 'help';
  if (['help', '--help', '-h'].includes(command)) {
    return { exitCode: 0, text: `${usage()}\n` };
  }
  if (command !== 'assess' || argv.length !== 2) {
    fail('assess requires exactly one input JSON path');
  }
  const receipt = buildReceipt(readJson(argv[1]));
  return { exitCode: 0, text: `${JSON.stringify(ReceiptRuntime.canonicalize(receipt), null, 2)}\n` };
}

function main() {
  try {
    const result = runCli();
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      error: 'IMPLEMENTATION_SUBSTITUTION_ASSESSMENT_REJECTED',
      message: error.message || String(error)
    })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  VERSION,
  PROTOCOL,
  RECEIPT_TYPE,
  IDENTITY_PROFILE,
  DIMENSIONS,
  FINDINGS,
  DECISIONS,
  NON_EFFECTS,
  ImplementationSubstitutionError,
  computeContentHash,
  rehash,
  validateInput,
  deriveDecision,
  buildReceipt,
  validateReceipt,
  readJson,
  usage,
  runCli
};
