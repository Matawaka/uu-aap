'use strict';

const path = require('path');
const { composeRubric, validateCorpus, readJson } = require('./validate-corpus');

const root = __dirname;
const base = readJson(path.resolve(root, '../c2pa-semantic-boundary/rubric-v0.1.json'));
const supplement = readJson(path.join(root, 'supplemental-rules-v0.1.json'));
const corpus = readJson(path.join(root, 'corpus-v0.1.json'));
const rubric = composeRubric(base, supplement);

const result = validateCorpus(corpus, rubric);
if (!result.all_unsafe_cases_rejected || !result.all_safe_cases_accepted || result.case_count !== 5) {
  throw new Error('baseline P0.7 corpus did not pass');
}
console.log('baseline semantic-adversarial corpus: PASS');

function expectReject(name, fn) {
  try {
    fn();
  } catch (err) {
    console.log(`expected rejection: ${name}: ${err.message}`);
    return;
  }
  throw new Error(`unsafe mutation accepted: ${name}`);
}

expectReject('aggregate trust score injection', () => {
  const c = structuredClone(corpus);
  c.cases[0].unsafe_fixture.trust_score = 0.99;
  validateCorpus(c, rubric);
});

{
  const c = structuredClone(corpus);
  c.cases[0].unsafe_fixture.evidence.push({ id: 'integrity', kind: 'c2pa.integrity', valid: true });
  c.cases[0].unsafe_fixture.claims[0].evidence_refs.push('integrity');
  const r = validateCorpus(c, rubric);
  const signerCase = r.cases.find((item) => item.case_id === 'signer-display-author');
  if (!signerCase || signerCase.unsafe_semantic_boundary_passed !== false || !signerCase.violated_rule_ids.includes('I1_SIGNER_NOT_GOVERNANCE')) {
    throw new Error('unrelated C2PA integrity evidence laundered signer -> author claim');
  }
  console.log('PASS: unrelated C2PA evidence does not launder signer -> author claim');
}

expectReject('unsafe case made semantically safe while still labelled adversarial', () => {
  const c = structuredClone(corpus);
  c.cases[2].unsafe_fixture.evidence.push({ id: 'lineage', kind: 'uu_aap.concept_lineage_evidence' });
  c.cases[2].unsafe_fixture.claims[0].evidence_refs.push('lineage');
  validateCorpus(c, rubric);
});

expectReject('historical base rubric replaced by conformance rubric', () => {
  const b = structuredClone(base);
  b.status = 'c2pa-conformance';
  composeRubric(b, supplement);
});

expectReject('supplement claims C2PA conformance', () => {
  const s = structuredClone(supplement);
  s.status = 'c2pa-conformance';
  composeRubric(base, s);
});

expectReject('action publication-authority rule omitted', () => {
  const s = structuredClone(supplement);
  s.rules = [];
  const r = composeRubric(base, s);
  validateCorpus(corpus, r);
});

expectReject('corpus non-effect promoted', () => {
  const c = structuredClone(corpus);
  c.non_effects.truth_certified_from_integrity = true;
  validateCorpus(c, rubric);
});

console.log('PASS: P0.7 semantic-adversarial corpus fail-closed suite');
