'use strict';

const fs = require('fs');
const { evaluateFixture, readJson } = require('./evaluate');

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

function hasExplicitFailure(report) {
  const state = validationState(report);
  if (typeof state === 'string' && state.toLowerCase() === 'invalid') return true;
  const validationResults = report?.validation_results || report?.validationResults;
  const activeResults = validationResults?.activeManifest || validationResults?.active_manifest;
  if (Array.isArray(activeResults?.failure) && activeResults.failure.length > 0) return true;
  const statuses = report?.validation_status || report?.validationStatus;
  if (Array.isArray(statuses) && statuses.length > 0) {
    return statuses.some((entry) => {
      const success = entry?.success;
      if (success === true) return false;
      const severity = String(entry?.severity || entry?.status || '').toLowerCase();
      return success === false || severity === 'error' || severity === 'failure' || severity === 'invalid';
    });
  }
  return false;
}

function assertLiveC2paReport(report) {
  const active = activeManifest(report);
  if (!active) throw new Error('live C2PA report has no active manifest');
  if (hasExplicitFailure(report)) throw new Error('live C2PA report contains explicit validation failure');
  const state = validationState(report);
  if (state && !['valid', 'trusted'].includes(String(state).toLowerCase())) {
    throw new Error(`unexpected C2PA validation state: ${state}`);
  }
  return { active_manifest: active, validation_state: state || 'no-explicit-failure' };
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

module.exports = { assertLiveC2paReport, activeManifest, validationState, hasExplicitFailure };
