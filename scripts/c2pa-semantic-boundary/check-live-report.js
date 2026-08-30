'use strict';

const fs = require('fs');
const { evaluateFixture, readJson } = require('./evaluate');

const TOLERATED_FAILURE_CODES = new Set(['signingCredential.untrusted']);

function validationResults(report) {
  return report?.validation_results || report?.validationResults || null;
}

function validationState(report) {
  return report?.validation_results?.validation_state
    || report?.validationResults?.validationState
    || report?.validation_state
    || report?.validationState
    || null;
}

function activeManifest(report) {
  return report?.active_manifest || report?.activeManifest || null;
}

function statusCode(entry) {
  return String(entry?.code || entry?.status || '');
}

function isToleratedFailure(entry) {
  const code = statusCode(entry);
  return TOLERATED_FAILURE_CODES.has(code) || code.startsWith('cawg.x509.');
}

function activeStatusCodes(report) {
  const results = validationResults(report);
  return results?.activeManifest || results?.active_manifest || null;
}

function ingredientFailureEntries(report) {
  const results = validationResults(report);
  const deltas = results?.ingredientDeltas || results?.ingredient_deltas || [];
  if (!Array.isArray(deltas)) return [];
  const failures = [];
  for (const delta of deltas) {
    const validationDeltas = delta?.validationDeltas || delta?.validation_deltas || {};
    if (Array.isArray(validationDeltas.failure)) failures.push(...validationDeltas.failure);
  }
  return failures;
}

function untoleratedFailureCodes(report) {
  const codes = [];
  const explicit = validationState(report);
  if (typeof explicit === 'string' && explicit.toLowerCase() === 'invalid') codes.push('validation_state:Invalid');

  const active = activeStatusCodes(report);
  const activeFailures = Array.isArray(active?.failure) ? active.failure : [];
  for (const entry of activeFailures) {
    if (!isToleratedFailure(entry)) codes.push(statusCode(entry) || 'activeManifest.failure:unknown');
  }
  for (const entry of ingredientFailureEntries(report)) {
    if (!isToleratedFailure(entry)) codes.push(statusCode(entry) || 'ingredientDelta.failure:unknown');
  }

  const statuses = report?.validation_status || report?.validationStatus;
  if (Array.isArray(statuses) && statuses.length > 0) {
    for (const entry of statuses) {
      if (isToleratedFailure(entry)) continue;
      const success = entry?.success;
      const severity = String(entry?.severity || '').toLowerCase();
      if (success === false || severity === 'error' || severity === 'failure' || severity === 'invalid') {
        codes.push(statusCode(entry) || 'validationStatus:unknown');
      }
    }
  }
  return [...new Set(codes)];
}

function hasExplicitFailure(report) {
  return untoleratedFailureCodes(report).length > 0;
}

function inferredValidationState(report) {
  const explicit = validationState(report);
  if (explicit) return String(explicit);

  const active = activeStatusCodes(report);
  if (!active) return null;
  const successes = Array.isArray(active.success) ? active.success.map(statusCode) : [];
  const activeFailures = Array.isArray(active.failure) ? active.failure : [];
  const ingredientFailures = ingredientFailureEntries(report);

  const cryptographicallyValid = successes.includes('claimSignature.validated')
    && successes.includes('claimSignature.insideValidity')
    && activeFailures.every(isToleratedFailure)
    && ingredientFailures.every(isToleratedFailure);

  if (!cryptographicallyValid) return 'Invalid';

  const trusted = successes.includes('signingCredential.trusted')
    && activeFailures.length === 0
    && ingredientFailures.length === 0;
  return trusted ? 'Trusted' : 'Valid';
}

function assertLiveC2paReport(report) {
  const active = activeManifest(report);
  if (!active) throw new Error('live C2PA report has no active manifest');
  const failures = untoleratedFailureCodes(report);
  if (failures.length > 0) throw new Error(`live C2PA report contains non-tolerated validation failure: ${failures.join(', ')}`);
  const state = inferredValidationState(report);
  if (!state || !['valid', 'trusted'].includes(String(state).toLowerCase())) {
    throw new Error(`unexpected C2PA validation state: ${state || 'unknown'}`);
  }
  return { active_manifest: active, validation_state: state };
}

if (require.main === module) {
  const [reportPath, rubricPath, overlayPath] = process.argv.slice(2);
  if (!reportPath || !rubricPath || !overlayPath) {
    console.error('usage: node check-live-report.js <c2patool-report.json> <rubric.json> <overlay.json>');
    process.exit(2);
  }
  const c2pa = assertLiveC2paReport(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
  const result = evaluateFixture(readJson(overlayPath), readJson(rubricPath));
  const caughtExpectedUnsafeInference = !result.semantic_boundary_passed
    && result.findings.some((finding) => finding.rule_id === 'I1_SIGNER_NOT_GOVERNANCE');
  if (!caughtExpectedUnsafeInference) {
    throw new Error('semantic rubric did not catch signer -> author promotion');
  }
  process.stdout.write(`${JSON.stringify({
    schema: 'urn:uu-aap:c2pa-live-semantic-fixture-receipt:0.1',
    c2pa,
    semantic_result: result,
    c2pa_conformance_claimed: false,
    conclusion: 'C2PA asset validation and UU-AAP semantic-boundary evaluation remain separate; unsafe signer -> author promotion was caught.'
  }, null, 2)}\n`);
}

module.exports = {
  assertLiveC2paReport,
  activeManifest,
  validationState,
  inferredValidationState,
  hasExplicitFailure,
  isToleratedFailure,
  untoleratedFailureCodes
};
