'use strict';

const fs = require('fs');
const path = require('path');
const { assertLiveC2paReport } = require('../c2pa-semantic-boundary/check-live-report');
const { composeRubric, validateCorpus, readJson } = require('./validate-corpus');

function main() {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error('usage: node check-live-corpus.js <c2patool-report.json>');
    process.exit(2);
  }

  const root = __dirname;
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const c2pa = assertLiveC2paReport(report);

  const base = readJson(path.resolve(root, '../c2pa-semantic-boundary/rubric-v0.1.json'));
  const supplement = readJson(path.join(root, 'supplemental-rules-v0.1.json'));
  const corpus = readJson(path.join(root, 'corpus-v0.1.json'));
  const rubric = composeRubric(base, supplement);
  const semantic = validateCorpus(corpus, rubric);

  if (!semantic.all_unsafe_cases_rejected || !semantic.all_safe_cases_accepted || semantic.case_count !== 5) {
    throw new Error('semantic-adversarial corpus acceptance incomplete');
  }

  const receipt = {
    schema: 'urn:uu-aap:c2pa-semantic-adversarial-live-receipt:0.1',
    issue: 792,
    live_c2pa_base: {
      active_manifest_present: Boolean(c2pa.active_manifest),
      validation_state: c2pa.validation_state,
      validation_accepted_before_semantic_evaluation: true
    },
    semantic_corpus: semantic,
    artifact_validation_result_mutated_by_semantic_layer: false,
    c2pa_conformance_claimed: false,
    parser_security_attack_executed: false,
    semantic_overclaim_attack_executed: true,
    conclusion: 'A currently valid C2PA test asset coexists with five rejected unsafe consumer interpretations; provenance validation remains separate from authorship, authority, responsibility, concept origin and truth.'
  };
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (require.main === module) main();
