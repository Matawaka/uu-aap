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

function hasExplicitFailure(report) {
  const explicit = validationState(report);
  if (typeof explicit === 'string' && explicit.toLowerCase() === 'invalid') return true;

  const active = activeStatusCodes(report);
  const activeFailures = Array.isArray(active?.failure) ? active.failure : [];
  if (activeFailures.some((entry) => !isToleratedFailure(entry))) return true;
  if (ingredientFailureEntries(report).some((entry) => !isToleratedFailure(entry))) return true;

  const statuses = report?.validation_status || report?.validationStatus;
  if (Array.isArray(statuses) && statuses.length > 0) {
    return statuses.some((entry) => {
      if (isToleratedFailure(entry)) return false;
      const success = entry?.success;
      if (success === true) return false;
      const severity = String(entry?.severity || '').toLowerCase();
      return success === false || severity === 'error' || severity === 'failure' || severity === 'invalid';
    });
  }
  return false;
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
  if (hasExplicitFailure(report)) throw new Error('live C2PA report contains non-tolerated validation failure');
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
  isToleratedFailure
};
