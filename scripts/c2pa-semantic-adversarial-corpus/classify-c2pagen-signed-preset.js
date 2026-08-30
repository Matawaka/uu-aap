'use strict';

const fs = require('fs');
const {
  inferredValidationState,
  untoleratedFailureCodes
} = require('../c2pa-semantic-boundary/check-live-report');

function read(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function summarize(report) {
  return {
    validation_state: inferredValidationState(report),
    untolerated_failure_codes: untoleratedFailureCodes(report)
  };
}

function accepted(summary) {
  return ['valid', 'trusted'].includes(String(summary.validation_state || '').toLowerCase())
    && summary.untolerated_failure_codes.length === 0;
}

function hasIngredientMismatch(summary) {
  return summary.untolerated_failure_codes.includes('assertion.action.ingredientMismatch');
}

function classify(matchedReport, currentReport) {
  const matched = summarize(matchedReport);
  const current = summarize(currentReport);

  let classification;
  if (hasIngredientMismatch(matched) && hasIngredientMismatch(current)) {
    classification = 'SIGNED_PRESET_INVALID_MATCHING_AND_CURRENT';
  } else if (accepted(matched) && hasIngredientMismatch(current)) {
    classification = 'VALIDATOR_RULE_DRIFT';
  } else if (accepted(current)) {
    classification = 'SIGNED_PRESET_CURRENTLY_VALID';
  } else {
    classification = 'UNEXPECTED_FRONTIER';
  }

  return {
    schema: 'urn:uu-aap:c2pagen-signed-preset-validation-frontier:0.1',
    c2pagen_sha: '23c2d4c317bbbb5b049c11cc6d8e85a4729704df',
    generator_sdk_version: '0.85.2',
    matched_validator: {
      c2patool_version: '0.26.62',
      c2pa_sdk_version: '0.85.2',
      ...matched
    },
    current_validator: {
      c2patool_version: '0.27.16',
      c2pa_sdk_version: '0.90.16',
      ...current
    },
    source_fixture: {
      path: 'tests/fixtures/simple_manifest.json',
      action: 'c2pa.opened',
      ingredient_declared: false
    },
    classification,
    signed_preset_usable_as_semantic_base: classification === 'SIGNED_PRESET_CURRENTLY_VALID',
    historical_or_current_validation_weakened: false,
    ingredient_mismatch_tolerated: false,
    note: 'A generated signed preset that fails C2PA action/ingredient consistency is recorded as an interoperability frontier and is never promoted into the P0.7 valid semantic base.'
  };
}

if (require.main === module) {
  const [matchedPath, currentPath] = process.argv.slice(2);
  if (!matchedPath || !currentPath) {
    console.error('usage: node classify-c2pagen-signed-preset.js <matched-report.json> <current-report.json>');
    process.exit(2);
  }
  process.stdout.write(`${JSON.stringify(classify(read(matchedPath), read(currentPath)), null, 2)}\n`);
}

module.exports = { classify, summarize };
