'use strict';

const fs = require('fs');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function validateRubric(rubric) {
  if (!rubric || !Array.isArray(rubric.rules) || rubric.rules.length === 0) {
    throw new Error('rubric.rules must be a non-empty array');
  }
  const ids = new Set();
  for (const rule of rubric.rules) {
    if (!rule.id || ids.has(rule.id)) throw new Error(`invalid or duplicate rule id: ${rule.id}`);
    ids.add(rule.id);
    if (!Array.isArray(rule.prohibited_support_kinds) || rule.prohibited_support_kinds.length === 0) {
      throw new Error(`${rule.id}: prohibited_support_kinds required`);
    }
    if (!rule.targets || typeof rule.targets !== 'object') throw new Error(`${rule.id}: targets required`);
  }
}

function validateFixture(fixture) {
  if (!fixture || !fixture.case_id) throw new Error('fixture.case_id required');
  if (!Array.isArray(fixture.evidence)) throw new Error(`${fixture.case_id}: evidence[] required`);
  if (!Array.isArray(fixture.claims)) throw new Error(`${fixture.case_id}: claims[] required`);
  const evidenceIds = new Set();
  for (const item of fixture.evidence) {
    if (!item.id || !item.kind) throw new Error(`${fixture.case_id}: evidence id/kind required`);
    if (evidenceIds.has(item.id)) throw new Error(`${fixture.case_id}: duplicate evidence id ${item.id}`);
    evidenceIds.add(item.id);
  }
  for (const claim of fixture.claims) {
    if (!claim.id || !claim.kind) throw new Error(`${fixture.case_id}: claim id/kind required`);
    if (!Array.isArray(claim.evidence_refs)) throw new Error(`${fixture.case_id}:${claim.id}: evidence_refs[] required`);
    for (const ref of claim.evidence_refs) {
      if (!evidenceIds.has(ref)) throw new Error(`${fixture.case_id}:${claim.id}: unknown evidence ref ${ref}`);
    }
  }
}

function evaluateFixture(fixture, rubric) {
  validateRubric(rubric);
  validateFixture(fixture);
  const evidenceById = new Map(fixture.evidence.map((item) => [item.id, item]));
  const findings = [];

  for (const rule of rubric.rules) {
    const prohibited = new Set(rule.prohibited_support_kinds);
    for (const claim of fixture.claims) {
      const requiredIndependentKinds = rule.targets[claim.kind];
      if (!requiredIndependentKinds) continue;

      const referencedEvidence = claim.evidence_refs.map((ref) => evidenceById.get(ref));
      const hasProhibitedSupport = referencedEvidence.some((item) => prohibited.has(item.kind));
      if (!hasProhibitedSupport) continue;

      const allowed = new Set(requiredIndependentKinds);
      const hasIndependentSupport = referencedEvidence.some((item) => allowed.has(item.kind));
      if (hasIndependentSupport) continue;

      findings.push({
        rule_id: rule.id,
        claim_id: claim.id,
        claim_kind: claim.kind,
        prohibited_support: referencedEvidence.filter((item) => prohibited.has(item.kind)).map((item) => item.id),
        required_independent_kinds: requiredIndependentKinds,
        safe_interpretation: rule.safe_interpretation
      });
    }
  }

  return {
    schema: 'urn:uu-aap:c2pa-semantic-boundary-evaluation:0.1',
    case_id: fixture.case_id,
    rubric: rubric.name,
    c2pa_baseline: rubric.c2pa_baseline,
    semantic_boundary_passed: findings.length === 0,
    finding_count: findings.length,
    findings,
    c2pa_conformance_evaluated: false,
    note: 'This result evaluates application-level semantic promotion only; it is not C2PA conformance.'
  };
}

if (require.main === module) {
  const [rubricPath, fixturePath] = process.argv.slice(2);
  if (!rubricPath || !fixturePath) {
    console.error('usage: node evaluate.js <rubric.json> <fixture.json>');
    process.exit(2);
  }
  const result = evaluateFixture(readJson(fixturePath), readJson(rubricPath));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.semantic_boundary_passed ? 0 : 1);
}

module.exports = { evaluateFixture, validateFixture, validateRubric, readJson };
