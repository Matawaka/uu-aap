'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL = 'MARKETER-PESSIMIST-LOCAL-MVP';
const VERSION = '0.1';
const INPUT_TYPE = 'MarketerPessimistStressTestInput';
const RECEIPT_TYPE = 'MarketerPessimistStressTestReceipt';
const CONTRACT_ID = 'marketer-pessimist-product-contract';
const PRODUCT_ID = 'marketer-pessimist';
const PRODUCT_VERSION = '0.1';
const CONTRACT_HASH = 'sha256:83a61669152e34221ab2df1f5024211356a10a4e347ef86b27a8e11d96f46fa6';
const NEXT_SAFE_ACTION = 'HUMAN_ANALYSIS_DISPOSITION_GATE_REQUIRED';

const CLASSIFICATIONS = Object.freeze([
  'observed_evidence',
  'interpretation',
  'assumption',
  'hypothesis',
  'declared_objective'
]);
const EVIDENCE_QUALITY = Object.freeze(['verified', 'unverified', 'stale', 'conflicting']);
const STATES = Object.freeze(['UNKNOWN', 'CONFLICT', 'INSUFFICIENT_EVIDENCE', 'CANDIDATE_READY']);
const RECOMMENDATION_CANDIDATES = Object.freeze([
  'REQUEST_MORE_EVIDENCE_CANDIDATE',
  'HUMAN_RECONCILIATION_REQUIRED',
  'READY_FOR_HUMAN_DISPOSITION_CANDIDATE'
]);

const INPUT_KEYS = Object.freeze([
  'protocol', 'version', 'artifact_type', 'input_id', 'contract_binding',
  'evaluation_frontier', 'claim_package', 'supporting_evidence',
  'decision_constraints', 'controls', 'content_hash'
]);
const CONTRACT_BINDING_KEYS = Object.freeze(['contract_id', 'product_id', 'product_version', 'content_hash']);
const FRONTIER_KEYS = Object.freeze(['repository', 'revision', 'observed_at']);
const CLAIM_PACKAGE_KEYS = Object.freeze(['claim_id', 'data_class', 'claim_text', 'review_purpose', 'scope', 'material_statements']);
const STATEMENT_KEYS = Object.freeze([
  'statement_id', 'data_class', 'text', 'classification', 'material',
  'evidence_refs', 'falsification_probe'
]);
const FALSIFICATION_KEYS = Object.freeze(['status', 'kind', 'description', 'unavailable_reason']);
const EVIDENCE_KEYS = Object.freeze([
  'evidence_id', 'data_class', 'summary', 'provenance_ref', 'quality',
  'observed_at', 'supports_statement_ids', 'contradicts_statement_ids'
]);
const CONSTRAINT_KEYS = Object.freeze([
  'data_class', 'objectives', 'constraints', 'unacceptable_outcomes', 'success_conditions'
]);
const CONTROL_KEYS = Object.freeze([
  'synthetic_only', 'local_only', 'read_only', 'network_access_required',
  'filesystem_write_required', 'provider_invocation_available', 'publication_available',
  'campaign_send_available', 'advertising_account_access_available', 'spend_available',
  'audience_upload_available', 'personal_targeting_available',
  'cross_context_correlation_available', 'identity_resolution_available',
  'protected_attribute_inference_available', 'psychological_vulnerability_inference_available',
  'external_system_mutation_available', 'human_disposition_available',
  'action_permit_available', 'execution_available', 'external_effect_available',
  'automatic_retry'
]);

const RECEIPT_KEYS = Object.freeze([
  'protocol', 'version', 'receipt_type', 'receipt_id', 'contract_binding',
  'evaluation_frontier', 'source_input', 'state', 'uncertainty_states',
  'classification_summary', 'evidence_lineage', 'counterarguments',
  'causal_alternatives', 'falsifiers', 'missing_evidence',
  'recommendation_candidate', 'success_criteria', 'claims', 'non_effects',
  'next_safe_action', 'content_hash'
]);
const SOURCE_INPUT_KEYS = Object.freeze(['input_id', 'input_hash']);
const CLASSIFICATION_SUMMARY_KEYS = Object.freeze(['counts', 'statement_ids_by_classification']);
const COUNT_KEYS = Object.freeze([...CLASSIFICATIONS]);
const LINEAGE_KEYS = Object.freeze(['statement_id', 'classification', 'evidence_refs', 'evidence_quality']);
const COUNTERARGUMENT_KEYS = Object.freeze(['candidate_id', 'statement_id', 'status', 'reason_code', 'text', 'basis_evidence_refs']);
const CAUSAL_ALTERNATIVE_KEYS = Object.freeze(['candidate_id', 'statement_id', 'status', 'text', 'basis_evidence_refs']);
const FALSIFIER_KEYS = Object.freeze(['statement_id', 'status', 'kind', 'description', 'unavailable_reason']);
const MISSING_EVIDENCE_KEYS = Object.freeze(['gap_id', 'statement_id', 'code', 'evidence_ref', 'description']);
const RECOMMENDATION_KEYS = Object.freeze(['candidate', 'rationale_codes', 'human_disposition_required']);
const SUCCESS_KEYS = Object.freeze(['material_claim_classification', 'recommendation_falsifiability', 'no_external_effect']);

const TRUE_CLAIMS = Object.freeze([
  'stress_test_completed',
  'exact_contract_bound',
  'material_statements_classified',
  'evidence_lineage_preserved',
  'uncertainty_preserved',
  'human_disposition_still_required'
]);
const FALSE_CLAIMS = Object.freeze([
  'truth_certified',
  'claim_rejected',
  'automatic_negative_judgment',
  'human_disposition_recorded',
  'publication_authorized',
  'campaign_send_authorized',
  'campaign_sent',
  'advertising_account_accessed',
  'funds_spent',
  'audience_uploaded',
  'personal_targeting_performed',
  'protected_attribute_inferred',
  'psychological_vulnerability_inferred',
  'external_system_mutated',
  'authority_created',
  'responsibility_accepted',
  'action_permit_created',
  'execution_admitted',
  'external_effect_performed',
  'stable_core_promotion_established',
  'successor_authority_created'
]);
const CLAIM_KEYS = Object.freeze([...TRUE_CLAIMS, ...FALSE_CLAIMS]);

const REQUIRED_NON_EFFECTS = Object.freeze([
  'Pessimistic Analysis != Truth',
  'Counterargument != Rejection',
  'Risk Hypothesis != Proof of Harm',
  'Missing Evidence != Negative Evidence',
  'Candidate Output != Publication Authority',
  'Marketing Recommendation != Campaign Authority',
  'Stress-Test Receipt != Human Disposition',
  'Stress-Test Receipt != ActionPermit',
  'Local Analysis != External Effect',
  'Product MVP != Stable-Core Promotion'
]);

class MarketerPessimistMVPError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MarketerPessimistMVPError';
  }
}

function fail(message) {
  throw new MarketerPessimistMVPError(message);
}

function requireCondition(condition, message) {
  if (!condition) fail(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertObject(value, label) {
  requireCondition(isObject(value), `${label} must be an object`);
}

function assertExactKeys(value, expectedKeys, label) {
  assertObject(value, label);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  requireCondition(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${label} keys mismatch: expected ${expected.join(', ')}, got ${actual.join(', ')}`
  );
}

function assertString(value, label, pattern = null) {
  requireCondition(typeof value === 'string' && value.trim().length > 0, `${label} must be a non-empty string`);
  if (pattern) requireCondition(pattern.test(value), `${label} has invalid format`);
}

function assertStringArray(value, label, { minItems = 0 } = {}) {
  requireCondition(Array.isArray(value), `${label} must be an array`);
  requireCondition(value.length >= minItems, `${label} requires at least ${minItems} item(s)`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${label}[${index}]`);
    requireCondition(!seen.has(item), `${label} must contain unique items`);
    seen.add(item);
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}

function computeContentHash(value) {
  const projected = clone(value);
  projected.content_hash = '';
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(projected)), 'utf8').digest('hex')}`;
}

function rehash(value) {
  value.content_hash = computeContentHash(value);
  return value;
}

function parseTime(value, label) {
  const time = Date.parse(value);
  requireCondition(Number.isFinite(time), `${label} must be an RFC3339-compatible timestamp`);
  return time;
}

function assertKnownEnum(value, allowed, label) {
  requireCondition(allowed.includes(value), `${label} unsupported: ${value}`);
}

function validateControls(controls) {
  assertExactKeys(controls, CONTROL_KEYS, 'controls');
  for (const key of CONTROL_KEYS) requireCondition(typeof controls[key] === 'boolean', `controls.${key} must be boolean`);
  requireCondition(controls.synthetic_only === true, 'controls.synthetic_only must remain true');
  requireCondition(controls.local_only === true, 'controls.local_only must remain true');
  requireCondition(controls.read_only === true, 'controls.read_only must remain true');
  for (const key of CONTROL_KEYS.filter(item => !['synthetic_only', 'local_only', 'read_only'].includes(item))) {
    requireCondition(controls[key] === false, `controls.${key} must remain false`);
  }
}

function validateInput(input) {
  assertExactKeys(input, INPUT_KEYS, 'input');
  requireCondition(input.protocol === PROTOCOL, `protocol must be ${PROTOCOL}`);
  requireCondition(input.version === VERSION, `version must be ${VERSION}`);
  requireCondition(input.artifact_type === INPUT_TYPE, `artifact_type must be ${INPUT_TYPE}`);
  assertString(input.input_id, 'input_id', /^urn:uu-aap:marketer-pessimist:stress-test-input:[a-z0-9][a-z0-9:-]{2,191}$/);

  assertExactKeys(input.contract_binding, CONTRACT_BINDING_KEYS, 'contract_binding');
  requireCondition(input.contract_binding.contract_id === CONTRACT_ID, 'Product Contract id mismatch');
  requireCondition(input.contract_binding.product_id === PRODUCT_ID, 'Product Contract product id mismatch');
  requireCondition(input.contract_binding.product_version === PRODUCT_VERSION, 'Product Contract product version mismatch');
  requireCondition(input.contract_binding.content_hash === CONTRACT_HASH, 'Product Contract hash mismatch');

  assertExactKeys(input.evaluation_frontier, FRONTIER_KEYS, 'evaluation_frontier');
  requireCondition(input.evaluation_frontier.repository === 'Matawaka/uu-aap', 'evaluation frontier repository mismatch');
  assertString(input.evaluation_frontier.revision, 'evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  parseTime(input.evaluation_frontier.observed_at, 'evaluation_frontier.observed_at');

  assertExactKeys(input.claim_package, CLAIM_PACKAGE_KEYS, 'claim_package');
  assertString(input.claim_package.claim_id, 'claim_package.claim_id', /^claim-[a-z0-9][a-z0-9-]{1,63}$/);
  requireCondition(input.claim_package.data_class === 'claim-content', 'claim_package data class mismatch');
  assertString(input.claim_package.claim_text, 'claim_package.claim_text');
  assertString(input.claim_package.review_purpose, 'claim_package.review_purpose');
  assertStringArray(input.claim_package.scope, 'claim_package.scope', { minItems: 1 });
  requireCondition(Array.isArray(input.claim_package.material_statements) && input.claim_package.material_statements.length > 0,
    'at least one material statement required');

  const statementIds = new Set();
  const statements = new Map();
  for (const statement of input.claim_package.material_statements) {
    assertExactKeys(statement, STATEMENT_KEYS, 'material_statement');
    assertString(statement.statement_id, 'material_statement.statement_id', /^stmt-[a-z0-9][a-z0-9-]{1,63}$/);
    requireCondition(!statementIds.has(statement.statement_id), `duplicate statement id: ${statement.statement_id}`);
    statementIds.add(statement.statement_id);
    requireCondition(statement.data_class === 'claim-content', `statement data class mismatch: ${statement.statement_id}`);
    assertString(statement.text, `statement ${statement.statement_id}.text`);
    assertKnownEnum(statement.classification, CLASSIFICATIONS, `statement ${statement.statement_id}.classification`);
    requireCondition(statement.material === true, `statement ${statement.statement_id} must remain material`);
    assertStringArray(statement.evidence_refs, `statement ${statement.statement_id}.evidence_refs`);
    assertExactKeys(statement.falsification_probe, FALSIFICATION_KEYS, `statement ${statement.statement_id}.falsification_probe`);
    assertKnownEnum(statement.falsification_probe.status, ['available', 'unavailable'], `statement ${statement.statement_id}.falsification_probe.status`);
    if (statement.falsification_probe.status === 'available') {
      assertKnownEnum(statement.falsification_probe.kind, ['observation', 'test'], `statement ${statement.statement_id}.falsification_probe.kind`);
      assertString(statement.falsification_probe.description, `statement ${statement.statement_id}.falsification_probe.description`);
      requireCondition(statement.falsification_probe.unavailable_reason === null,
        `statement ${statement.statement_id} available falsifier cannot carry unavailable_reason`);
    } else {
      requireCondition(statement.falsification_probe.kind === 'none',
        `statement ${statement.statement_id} unavailable falsifier kind must be none`);
      requireCondition(statement.falsification_probe.description === null,
        `statement ${statement.statement_id} unavailable falsifier description must be null`);
      assertString(statement.falsification_probe.unavailable_reason,
        `statement ${statement.statement_id}.falsification_probe.unavailable_reason`);
    }
    statements.set(statement.statement_id, statement);
  }

  requireCondition(Array.isArray(input.supporting_evidence), 'supporting_evidence must be an array');
  const evidenceIds = new Set();
  const evidence = new Map();
  for (const item of input.supporting_evidence) {
    assertExactKeys(item, EVIDENCE_KEYS, 'supporting_evidence item');
    assertString(item.evidence_id, 'supporting_evidence.evidence_id', /^ev-[a-z0-9][a-z0-9-]{1,63}$/);
    requireCondition(!evidenceIds.has(item.evidence_id), `duplicate evidence id: ${item.evidence_id}`);
    evidenceIds.add(item.evidence_id);
    requireCondition(item.data_class === 'evidence-bundle', `evidence data class mismatch: ${item.evidence_id}`);
    assertString(item.summary, `evidence ${item.evidence_id}.summary`);
    assertString(item.provenance_ref, `evidence ${item.evidence_id}.provenance_ref`);
    assertKnownEnum(item.quality, EVIDENCE_QUALITY, `evidence ${item.evidence_id}.quality`);
    parseTime(item.observed_at, `evidence ${item.evidence_id}.observed_at`);
    assertStringArray(item.supports_statement_ids, `evidence ${item.evidence_id}.supports_statement_ids`);
    assertStringArray(item.contradicts_statement_ids, `evidence ${item.evidence_id}.contradicts_statement_ids`);
    for (const id of [...item.supports_statement_ids, ...item.contradicts_statement_ids]) {
      requireCondition(statements.has(id), `evidence ${item.evidence_id} references unknown statement: ${id}`);
    }
    const overlap = item.supports_statement_ids.filter(id => item.contradicts_statement_ids.includes(id));
    requireCondition(overlap.length === 0 || item.quality === 'conflicting',
      `evidence ${item.evidence_id} support/contradiction overlap requires conflicting quality`);
    evidence.set(item.evidence_id, item);
  }

  for (const statement of statements.values()) {
    for (const evidenceRef of statement.evidence_refs) {
      requireCondition(evidence.has(evidenceRef), `statement ${statement.statement_id} references unknown evidence: ${evidenceRef}`);
      const item = evidence.get(evidenceRef);
      requireCondition(
        item.supports_statement_ids.includes(statement.statement_id) || item.contradicts_statement_ids.includes(statement.statement_id),
        `statement/evidence lineage mismatch: ${statement.statement_id} -> ${evidenceRef}`
      );
    }
  }

  assertExactKeys(input.decision_constraints, CONSTRAINT_KEYS, 'decision_constraints');
  requireCondition(input.decision_constraints.data_class === 'decision-context', 'decision_constraints data class mismatch');
  assertStringArray(input.decision_constraints.objectives, 'decision_constraints.objectives', { minItems: 1 });
  assertStringArray(input.decision_constraints.constraints, 'decision_constraints.constraints', { minItems: 1 });
  assertStringArray(input.decision_constraints.unacceptable_outcomes, 'decision_constraints.unacceptable_outcomes', { minItems: 1 });
  assertStringArray(input.decision_constraints.success_conditions, 'decision_constraints.success_conditions', { minItems: 1 });

  validateControls(input.controls);
  requireCondition(input.content_hash === computeContentHash(input), 'input content hash mismatch');
  return input;
}

function gapRecord(statementId, code, evidenceRef, description) {
  return {
    gap_id: `gap-${statementId}-${code.toLowerCase().replace(/_/g, '-')}${evidenceRef ? `-${evidenceRef}` : ''}`,
    statement_id: statementId,
    code,
    evidence_ref: evidenceRef,
    description
  };
}

function counterargumentRecord(statementId, reasonCode, text, evidenceRefs) {
  return {
    candidate_id: `counter-${statementId}-${reasonCode.toLowerCase().replace(/_/g, '-')}`,
    statement_id: statementId,
    status: 'candidate',
    reason_code: reasonCode,
    text,
    basis_evidence_refs: [...evidenceRefs].sort()
  };
}

function analyze(input) {
  validateInput(input);
  const evidenceById = new Map(input.supporting_evidence.map(item => [item.evidence_id, item]));
  const counts = Object.fromEntries(CLASSIFICATIONS.map(key => [key, 0]));
  const grouped = Object.fromEntries(CLASSIFICATIONS.map(key => [key, []]));
  const evidenceLineage = [];
  const counterarguments = [];
  const causalAlternatives = [];
  const falsifiers = [];
  const missingEvidence = [];
  const uncertaintyStates = new Set();
  let conflictObserved = false;

  for (const statement of input.claim_package.material_statements) {
    counts[statement.classification] += 1;
    grouped[statement.classification].push(statement.statement_id);
    const refs = statement.evidence_refs.map(ref => evidenceById.get(ref));
    const qualities = [...new Set(refs.map(item => item.quality))].sort();
    evidenceLineage.push({
      statement_id: statement.statement_id,
      classification: statement.classification,
      evidence_refs: [...statement.evidence_refs].sort(),
      evidence_quality: qualities
    });

    const contradicting = refs.filter(item => item.contradicts_statement_ids.includes(statement.statement_id));
    const weak = refs.filter(item => ['unverified', 'stale', 'conflicting'].includes(item.quality));
    if (statement.classification !== 'declared_objective' && statement.evidence_refs.length === 0) {
      missingEvidence.push(gapRecord(statement.statement_id, 'NO_SUPPORTING_EVIDENCE', null,
        'No supporting or contradicting evidence is bound to this material statement.'));
    }
    for (const item of weak) {
      const code = item.quality === 'unverified'
        ? 'UNVERIFIED_EVIDENCE'
        : item.quality === 'stale'
          ? 'STALE_EVIDENCE'
          : 'CONFLICTING_EVIDENCE';
      missingEvidence.push(gapRecord(statement.statement_id, code, item.evidence_id,
        `Evidence ${item.evidence_id} is ${item.quality}; uncertainty is preserved.`));
      if (item.quality === 'conflicting') conflictObserved = true;
    }
    if (contradicting.length > 0) {
      counterarguments.push(counterargumentRecord(
        statement.statement_id,
        'CONTRADICTING_EVIDENCE_PRESENT',
        'Contradicting evidence is present; the statement cannot be treated as unqualified support.',
        contradicting.map(item => item.evidence_id)
      ));
      conflictObserved = true;
    }
    if (['interpretation', 'assumption', 'hypothesis'].includes(statement.classification)) {
      const reason = `${statement.classification.toUpperCase()}_IS_NOT_OBSERVED_EVIDENCE`;
      counterarguments.push(counterargumentRecord(
        statement.statement_id,
        reason,
        `${statement.classification} is not direct observed evidence and remains contestable.`,
        statement.evidence_refs
      ));
      causalAlternatives.push({
        candidate_id: `causal-alt-${statement.statement_id}`,
        statement_id: statement.statement_id,
        status: 'candidate',
        text: 'The observed material may be consistent with causes other than this statement; necessity, sufficiency and exclusivity are not established.',
        basis_evidence_refs: [...statement.evidence_refs].sort()
      });
    }
    if (weak.length > 0) {
      counterarguments.push(counterargumentRecord(
        statement.statement_id,
        'EVIDENCE_QUALITY_LIMITS_SUPPORT',
        'One or more bound evidence items are unverified, stale or conflicting, limiting the strength of this statement.',
        weak.map(item => item.evidence_id)
      ));
    }

    falsifiers.push({
      statement_id: statement.statement_id,
      status: statement.falsification_probe.status,
      kind: statement.falsification_probe.kind,
      description: statement.falsification_probe.description,
      unavailable_reason: statement.falsification_probe.unavailable_reason
    });

    const hasVerifiedSupport = refs.some(item =>
      item.quality === 'verified' && item.supports_statement_ids.includes(statement.statement_id));
    if (['interpretation', 'assumption', 'hypothesis'].includes(statement.classification) && !hasVerifiedSupport) {
      uncertaintyStates.add('UNKNOWN');
    }
  }

  if (conflictObserved) uncertaintyStates.add('CONFLICT');
  if (missingEvidence.length > 0) uncertaintyStates.add('INSUFFICIENT_EVIDENCE');
  const state = conflictObserved
    ? 'CONFLICT'
    : missingEvidence.length > 0
      ? 'INSUFFICIENT_EVIDENCE'
      : 'CANDIDATE_READY';
  if (state === 'CANDIDATE_READY' && uncertaintyStates.size === 0) uncertaintyStates.add('CANDIDATE_READY');

  const candidate = conflictObserved
    ? 'HUMAN_RECONCILIATION_REQUIRED'
    : missingEvidence.length > 0
      ? 'REQUEST_MORE_EVIDENCE_CANDIDATE'
      : 'READY_FOR_HUMAN_DISPOSITION_CANDIDATE';
  const rationaleCodes = [];
  if (conflictObserved) rationaleCodes.push('CONFLICT_REQUIRES_HUMAN_RECONCILIATION');
  if (missingEvidence.length > 0) rationaleCodes.push('EVIDENCE_GAPS_REMAIN_VISIBLE');
  if (!conflictObserved && missingEvidence.length === 0) rationaleCodes.push('BOUNDED_ANALYSIS_COMPLETE');

  const claims = {};
  for (const key of TRUE_CLAIMS) claims[key] = true;
  for (const key of FALSE_CLAIMS) claims[key] = false;

  const receipt = {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: RECEIPT_TYPE,
    receipt_id: `urn:uu-aap:marketer-pessimist:stress-test-receipt:${input.content_hash.slice(-24)}`,
    contract_binding: clone(input.contract_binding),
    evaluation_frontier: clone(input.evaluation_frontier),
    source_input: {
      input_id: input.input_id,
      input_hash: input.content_hash
    },
    state,
    uncertainty_states: [...uncertaintyStates].sort(),
    classification_summary: {
      counts,
      statement_ids_by_classification: Object.fromEntries(
        CLASSIFICATIONS.map(key => [key, [...grouped[key]].sort()])
      )
    },
    evidence_lineage: evidenceLineage.sort((a, b) => a.statement_id.localeCompare(b.statement_id)),
    counterarguments: counterarguments.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id)),
    causal_alternatives: causalAlternatives.sort((a, b) => a.candidate_id.localeCompare(b.candidate_id)),
    falsifiers: falsifiers.sort((a, b) => a.statement_id.localeCompare(b.statement_id)),
    missing_evidence: missingEvidence.sort((a, b) => a.gap_id.localeCompare(b.gap_id)),
    recommendation_candidate: {
      candidate,
      rationale_codes: rationaleCodes,
      human_disposition_required: true
    },
    success_criteria: {
      material_claim_classification: true,
      recommendation_falsifiability: falsifiers.every(item =>
        item.status === 'available' || (item.status === 'unavailable' && typeof item.unavailable_reason === 'string' && item.unavailable_reason.length > 0)),
      no_external_effect: true
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
  assertExactKeys(receipt, RECEIPT_KEYS, 'receipt');
  requireCondition(receipt.protocol === PROTOCOL, 'receipt protocol mismatch');
  requireCondition(receipt.version === VERSION, 'receipt version mismatch');
  requireCondition(receipt.receipt_type === RECEIPT_TYPE, 'receipt type mismatch');
  assertString(receipt.receipt_id, 'receipt.receipt_id', /^urn:uu-aap:marketer-pessimist:stress-test-receipt:[0-9a-f]{24}$/);

  assertExactKeys(receipt.contract_binding, CONTRACT_BINDING_KEYS, 'receipt.contract_binding');
  requireCondition(receipt.contract_binding.contract_id === CONTRACT_ID, 'receipt Product Contract id mismatch');
  requireCondition(receipt.contract_binding.product_id === PRODUCT_ID, 'receipt product id mismatch');
  requireCondition(receipt.contract_binding.product_version === PRODUCT_VERSION, 'receipt product version mismatch');
  requireCondition(receipt.contract_binding.content_hash === CONTRACT_HASH, 'receipt Product Contract hash mismatch');

  assertExactKeys(receipt.evaluation_frontier, FRONTIER_KEYS, 'receipt.evaluation_frontier');
  requireCondition(receipt.evaluation_frontier.repository === 'Matawaka/uu-aap', 'receipt frontier repository mismatch');
  assertString(receipt.evaluation_frontier.revision, 'receipt.evaluation_frontier.revision', /^[0-9a-f]{40}$/);
  parseTime(receipt.evaluation_frontier.observed_at, 'receipt.evaluation_frontier.observed_at');

  assertExactKeys(receipt.source_input, SOURCE_INPUT_KEYS, 'receipt.source_input');
  assertString(receipt.source_input.input_id, 'receipt.source_input.input_id');
  assertString(receipt.source_input.input_hash, 'receipt.source_input.input_hash', /^sha256:[0-9a-f]{64}$/);
  assertKnownEnum(receipt.state, STATES, 'receipt.state');
  assertStringArray(receipt.uncertainty_states, 'receipt.uncertainty_states', { minItems: 1 });
  receipt.uncertainty_states.forEach(state => assertKnownEnum(state, STATES, 'receipt.uncertainty_state'));
  requireCondition(!receipt.uncertainty_states.includes('REJECTED') && !receipt.uncertainty_states.includes('ACCEPTED_FOR_HUMAN_USE'),
    'local MVP cannot record human disposition states');

  assertExactKeys(receipt.classification_summary, CLASSIFICATION_SUMMARY_KEYS, 'receipt.classification_summary');
  assertExactKeys(receipt.classification_summary.counts, COUNT_KEYS, 'receipt.classification_summary.counts');
  assertExactKeys(receipt.classification_summary.statement_ids_by_classification, COUNT_KEYS,
    'receipt.classification_summary.statement_ids_by_classification');
  for (const key of CLASSIFICATIONS) {
    requireCondition(Number.isInteger(receipt.classification_summary.counts[key]) && receipt.classification_summary.counts[key] >= 0,
      `receipt classification count invalid: ${key}`);
    assertStringArray(receipt.classification_summary.statement_ids_by_classification[key],
      `receipt classification ids ${key}`);
  }

  requireCondition(Array.isArray(receipt.evidence_lineage), 'receipt.evidence_lineage must be an array');
  receipt.evidence_lineage.forEach(item => {
    assertExactKeys(item, LINEAGE_KEYS, 'receipt.evidence_lineage item');
    assertString(item.statement_id, 'receipt.evidence_lineage.statement_id');
    assertKnownEnum(item.classification, CLASSIFICATIONS, 'receipt.evidence_lineage.classification');
    assertStringArray(item.evidence_refs, 'receipt.evidence_lineage.evidence_refs');
    assertStringArray(item.evidence_quality, 'receipt.evidence_lineage.evidence_quality');
    item.evidence_quality.forEach(value => assertKnownEnum(value, EVIDENCE_QUALITY, 'receipt.evidence_lineage.evidence_quality item'));
  });

  requireCondition(Array.isArray(receipt.counterarguments), 'receipt.counterarguments must be an array');
  receipt.counterarguments.forEach(item => {
    assertExactKeys(item, COUNTERARGUMENT_KEYS, 'receipt.counterargument');
    assertString(item.candidate_id, 'receipt.counterargument.candidate_id');
    assertString(item.statement_id, 'receipt.counterargument.statement_id');
    requireCondition(item.status === 'candidate', 'counterargument status must remain candidate');
    assertString(item.reason_code, 'receipt.counterargument.reason_code');
    assertString(item.text, 'receipt.counterargument.text');
    assertStringArray(item.basis_evidence_refs, 'receipt.counterargument.basis_evidence_refs');
  });

  requireCondition(Array.isArray(receipt.causal_alternatives), 'receipt.causal_alternatives must be an array');
  receipt.causal_alternatives.forEach(item => {
    assertExactKeys(item, CAUSAL_ALTERNATIVE_KEYS, 'receipt.causal_alternative');
    assertString(item.candidate_id, 'receipt.causal_alternative.candidate_id');
    assertString(item.statement_id, 'receipt.causal_alternative.statement_id');
    requireCondition(item.status === 'candidate', 'causal alternative status must remain candidate');
    assertString(item.text, 'receipt.causal_alternative.text');
    assertStringArray(item.basis_evidence_refs, 'receipt.causal_alternative.basis_evidence_refs');
  });

  requireCondition(Array.isArray(receipt.falsifiers) && receipt.falsifiers.length > 0, 'receipt.falsifiers required');
  receipt.falsifiers.forEach(item => {
    assertExactKeys(item, FALSIFIER_KEYS, 'receipt.falsifier');
    assertString(item.statement_id, 'receipt.falsifier.statement_id');
    assertKnownEnum(item.status, ['available', 'unavailable'], 'receipt.falsifier.status');
    if (item.status === 'available') {
      assertKnownEnum(item.kind, ['observation', 'test'], 'receipt.falsifier.kind');
      assertString(item.description, 'receipt.falsifier.description');
      requireCondition(item.unavailable_reason === null, 'available receipt falsifier cannot carry unavailable reason');
    } else {
      requireCondition(item.kind === 'none' && item.description === null, 'unavailable receipt falsifier shape mismatch');
      assertString(item.unavailable_reason, 'receipt.falsifier.unavailable_reason');
    }
  });

  requireCondition(Array.isArray(receipt.missing_evidence), 'receipt.missing_evidence must be an array');
  receipt.missing_evidence.forEach(item => {
    assertExactKeys(item, MISSING_EVIDENCE_KEYS, 'receipt.missing_evidence item');
    assertString(item.gap_id, 'receipt.missing_evidence.gap_id');
    assertString(item.statement_id, 'receipt.missing_evidence.statement_id');
    assertString(item.code, 'receipt.missing_evidence.code');
    requireCondition(item.evidence_ref === null || typeof item.evidence_ref === 'string', 'receipt.missing_evidence.evidence_ref invalid');
    assertString(item.description, 'receipt.missing_evidence.description');
  });

  assertExactKeys(receipt.recommendation_candidate, RECOMMENDATION_KEYS, 'receipt.recommendation_candidate');
  assertKnownEnum(receipt.recommendation_candidate.candidate, RECOMMENDATION_CANDIDATES, 'receipt.recommendation_candidate.candidate');
  assertStringArray(receipt.recommendation_candidate.rationale_codes, 'receipt.recommendation_candidate.rationale_codes', { minItems: 1 });
  requireCondition(receipt.recommendation_candidate.human_disposition_required === true,
    'human disposition must remain required');

  assertExactKeys(receipt.success_criteria, SUCCESS_KEYS, 'receipt.success_criteria');
  for (const key of SUCCESS_KEYS) requireCondition(receipt.success_criteria[key] === true, `success criterion ${key} must be true`);

  assertExactKeys(receipt.claims, CLAIM_KEYS, 'receipt.claims');
  for (const key of TRUE_CLAIMS) requireCondition(receipt.claims[key] === true, `required claim ${key} must be true`);
  for (const key of FALSE_CLAIMS) requireCondition(receipt.claims[key] === false, `prohibited claim ${key} must remain false`);
  assertStringArray(receipt.non_effects, 'receipt.non_effects', { minItems: REQUIRED_NON_EFFECTS.length });
  requireCondition(
    [...REQUIRED_NON_EFFECTS].sort().every((item, index) => item === [...receipt.non_effects].sort()[index]) &&
      receipt.non_effects.length === REQUIRED_NON_EFFECTS.length,
    'receipt non_effect set mismatch'
  );
  requireCondition(receipt.next_safe_action === NEXT_SAFE_ACTION, 'receipt next_safe_action mismatch');
  requireCondition(receipt.content_hash === computeContentHash(receipt), 'receipt content hash mismatch');
  return receipt;
}

function validationReceipt(input) {
  validateInput(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketerPessimistStressTestInputValidationReceipt',
    input_id: input.input_id,
    input_hash: input.content_hash,
    valid: true,
    synthetic_only: true,
    local_only: true,
    external_effect_available: false,
    human_disposition_available: false,
    action_permit_available: false,
    execution_available: false
  };
}

function inspectInput(input) {
  const receipt = analyze(input);
  return {
    protocol: PROTOCOL,
    version: VERSION,
    receipt_type: 'MarketerPessimistStressTestInspectionReceipt',
    input_id: input.input_id,
    input_hash: input.content_hash,
    state: receipt.state,
    uncertainty_states: receipt.uncertainty_states,
    material_statement_count: receipt.evidence_lineage.length,
    counterargument_candidate_count: receipt.counterarguments.length,
    causal_alternative_candidate_count: receipt.causal_alternatives.length,
    missing_evidence_count: receipt.missing_evidence.length,
    recommendation_candidate: receipt.recommendation_candidate.candidate,
    human_disposition_required: true,
    external_effect_performed: false
  };
}

function parseText(text) {
  requireCondition(typeof text === 'string' && text.trim().length > 0, 'input must contain JSON text');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new MarketerPessimistMVPError(`invalid JSON: ${error.message}`);
  }
}

function readInput(inputPath) {
  assertString(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  return parseText(text);
}

function usage() {
  return [
    'Маркетолог Пессимиста Local Stress-Test MVP v0.1',
    '',
    'Usage:',
    '  node products/marketer-pessimist/v0.1/local-mvp/stress-test.js validate <file|->',
    '  node products/marketer-pessimist/v0.1/local-mvp/stress-test.js stress-test <file|->',
    '  node products/marketer-pessimist/v0.1/local-mvp/stress-test.js inspect <file|->',
    '  node products/marketer-pessimist/v0.1/local-mvp/stress-test.js help',
    '',
    'The MVP is deterministic, synthetic-only, local and no-effect. It never records human disposition or performs publication/campaign actions.'
  ].join('\n');
}

function runCli(argv) {
  const command = argv[0] || 'help';
  if (command === 'help' || command === '--help' || command === '-h') {
    return { text: `${usage()}\n`, exitCode: 0 };
  }
  requireCondition(['validate', 'stress-test', 'inspect'].includes(command),
    `unsupported command: ${command}; allowed commands are validate, stress-test, inspect and help`);
  requireCondition(argv.length === 2, `${command} requires exactly one input file path or - for stdin`);
  const input = readInput(argv[1]);
  const result = command === 'validate'
    ? validationReceipt(input)
    : command === 'stress-test'
      ? analyze(input)
      : inspectInput(input);
  return { text: `${JSON.stringify(canonicalize(result), null, 2)}\n`, exitCode: 0 };
}

function main() {
  try {
    const result = runCli(process.argv.slice(2));
    process.stdout.write(result.text);
    process.exitCode = result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${JSON.stringify({ error: 'MARKETER_PESSIMIST_LOCAL_MVP_REJECTED', message })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = {
  MarketerPessimistMVPError,
  PROTOCOL,
  VERSION,
  INPUT_TYPE,
  RECEIPT_TYPE,
  CONTRACT_ID,
  PRODUCT_ID,
  PRODUCT_VERSION,
  CONTRACT_HASH,
  NEXT_SAFE_ACTION,
  CLASSIFICATIONS,
  EVIDENCE_QUALITY,
  STATES,
  RECOMMENDATION_CANDIDATES,
  INPUT_KEYS,
  CONTROL_KEYS,
  RECEIPT_KEYS,
  TRUE_CLAIMS,
  FALSE_CLAIMS,
  CLAIM_KEYS,
  REQUIRED_NON_EFFECTS,
  canonicalize,
  computeContentHash,
  rehash,
  validateInput,
  analyze,
  validateReceipt,
  validationReceipt,
  inspectInput,
  parseText,
  readInput,
  usage,
  runCli
};
