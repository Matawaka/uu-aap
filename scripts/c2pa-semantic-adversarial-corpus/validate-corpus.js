'use strict';

const fs = require('fs');
const path = require('path');
const { evaluateFixture, validateRubric } = require('../c2pa-semantic-boundary/evaluate');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function scoreLikeKeys(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) scoreLikeKeys(item, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const [key, child] of Object.entries(value)) {
    if (['score', 'trust_score', 'compatibility_score', 'confidence_score', 'probability', 'rating', 'percentage'].includes(key)) {
      out.push(key);
    }
    scoreLikeKeys(child, out);
  }
  return out;
}

function composeRubric(base, supplement) {
  if (base.status !== 'application-semantics-only-not-c2pa-conformance') {
    throw new Error('base rubric semantic boundary changed');
  }
  if (supplement.status !== 'application-semantics-only-not-c2pa-conformance') {
    throw new Error('supplement must remain application semantics only');
  }
  if (base.c2pa_baseline !== supplement.c2pa_baseline) {
    throw new Error('C2PA baseline mismatch');
  }
  const combined = {
    $schema: 'urn:uu-aap:c2pa-semantic-adversarial-composed-rubric:0.1',
    name: `${base.name} + ${supplement.name}`,
    status: 'application-semantics-only-not-c2pa-conformance',
    c2pa_baseline: base.c2pa_baseline,
    rules: [...base.rules, ...supplement.rules]
  };
  validateRubric(combined);
  return combined;
}

function validateCorpus(corpus, rubric) {
  if (corpus.schema !== 'urn:uu-aap:c2pa-semantic-adversarial-corpus:0.1') throw new Error('unexpected corpus schema');
  if (corpus.issue !== 792) throw new Error('corpus must bind issue #792');
  if (corpus.aggregate_score_permitted !== false) throw new Error('aggregate score must be prohibited');
  if (!Array.isArray(corpus.cases) || corpus.cases.length !== 5) throw new Error('exactly five P0.7 cases required');
  if (!corpus.non_effects || Object.values(corpus.non_effects).some((v) => v !== false)) {
    throw new Error('all corpus non-effects must remain false');
  }

  const ids = new Set();
  const results = [];
  for (const item of corpus.cases) {
    if (!item.case_id || ids.has(item.case_id)) throw new Error(`invalid/duplicate case_id ${item.case_id}`);
    ids.add(item.case_id);
    if (!Array.isArray(item.expected_rule_ids) || item.expected_rule_ids.length === 0) {
      throw new Error(`${item.case_id}: expected_rule_ids required`);
    }
    if (!item.safe_interpretation) throw new Error(`${item.case_id}: safe_interpretation required`);

    const unsafeScores = scoreLikeKeys(item.unsafe_fixture);
    const safeScores = scoreLikeKeys(item.safe_fixture);
    if (unsafeScores.length || safeScores.length) {
      throw new Error(`${item.case_id}: score-like fields forbidden`);
    }

    const unsafe = evaluateFixture(item.unsafe_fixture, rubric);
    const safe = evaluateFixture(item.safe_fixture, rubric);
    if (unsafe.semantic_boundary_passed !== false) {
      throw new Error(`${item.case_id}: unsafe consumer interpretation was accepted`);
    }
    if (safe.semantic_boundary_passed !== true) {
      throw new Error(`${item.case_id}: safe interpretation did not pass`);
    }
    if (unsafe.c2pa_conformance_evaluated !== false || safe.c2pa_conformance_evaluated !== false) {
      throw new Error(`${item.case_id}: semantic evaluator must not claim C2PA conformance`);
    }

    const actual = [...new Set(unsafe.findings.map((f) => f.rule_id))].sort();
    const expected = [...new Set(item.expected_rule_ids)].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${item.case_id}: expected rules ${expected.join(',')} but got ${actual.join(',')}`);
    }
    results.push({
      case_id: item.case_id,
      unsafe_semantic_boundary_passed: false,
      safe_semantic_boundary_passed: true,
      violated_rule_ids: actual,
      safe_interpretation: item.safe_interpretation,
      c2pa_validation_result_mutated: false
    });
  }

  return {
    schema: 'urn:uu-aap:c2pa-semantic-adversarial-corpus-result:0.1',
    corpus_issue: 792,
    case_count: results.length,
    all_unsafe_cases_rejected: true,
    all_safe_cases_accepted: true,
    c2pa_conformance_evaluated_by_semantic_layer: false,
    c2pa_validation_result_mutated: false,
    aggregate_score_present: false,
    cases: results
  };
}

function main() {
  const root = path.resolve(__dirname);
  const basePath = process.argv[2] || path.resolve(root, '../c2pa-semantic-boundary/rubric-v0.1.json');
  const supplementPath = process.argv[3] || path.join(root, 'supplemental-rules-v0.1.json');
  const corpusPath = process.argv[4] || path.join(root, 'corpus-v0.1.json');
  const rubric = composeRubric(readJson(basePath), readJson(supplementPath));
  const result = validateCorpus(readJson(corpusPath), rubric);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) main();
module.exports = { composeRubric, validateCorpus, scoreLikeKeys, readJson };
