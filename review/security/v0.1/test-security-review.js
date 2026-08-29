'use strict';

const fs = require('node:fs');
const { assess, validateInput, SecurityReviewError } = require('./security-review.js');

const input = JSON.parse(fs.readFileSync('review/security/v0.1/current-boundaries.input.json','utf8'));
const report = assess(input);

if (report.outcome !== 'INSUFFICIENT_EVIDENCE') throw new Error(`expected INSUFFICIENT_EVIDENCE, got ${report.outcome}`);
if (report.failed_dimensions.length !== 0) throw new Error('current security review must have no failed dimensions');
for (const id of ['threat_model','revision_provenance_hardening','ci_dependency_fail_closed','main_write_governance']) {
  const d = report.dimensions.find((x) => x.dimension_id === id);
  if (!d || d.status !== 'PASS') throw new Error(`expected PASS for ${id}`);
}
for (const id of ['dependency_vulnerability_assessment','secret_exposure_assessment','deployment_surface_assessment','workflow_supply_chain_assessment','adversarial_surface_assessment']) {
  if (!report.insufficient_evidence_dimensions.includes(id)) throw new Error(`expected insufficient evidence for ${id}`);
}
if (report.p0_mapping.status !== 'INSUFFICIENT_EVIDENCE' || report.p0_mapping.blocking !== false || report.p0_mapping.explicit_review_outcome !== true) throw new Error('unexpected P0 mapping');
if (report.security_certified || report.vulnerability_free_proven || report.secret_free_proven || report.legal_compliance_established || report.all_surfaces_tested || report.release_authorized || report.publication_authorized || report.authority_created || report.runtime_activated) throw new Error('security review overclaim');

const defect = structuredClone(input);
defect.observations.main_no_bypass_actors = false;
const defectReport = assess(defect);
if (defectReport.outcome !== 'FAIL' || !defectReport.failed_dimensions.includes('main_write_governance') || defectReport.p0_mapping.blocking !== true) throw new Error('governance defect must fail closed');

const complete = structuredClone(input);
complete.observations.dependency_vulnerability_review_current = true;
complete.observations.secret_exposure_review_current = true;
complete.observations.deployment_surface_security_review_current = true;
complete.observations.workflow_supply_chain_review_current = true;
complete.observations.adversarial_surface_review_current = true;
const completeReport = assess(complete);
if (completeReport.outcome !== 'PASS' || completeReport.p0_mapping.status !== 'PASS' || completeReport.p0_mapping.blocking !== false) throw new Error('complete evidence vector must PASS');

const badClaim = structuredClone(input);
badClaim.claims.security_certified = true;
let rejected = false;
try { validateInput(badClaim); } catch (error) { rejected = error instanceof SecurityReviewError && error.code === 'PROHIBITED_CLAIM'; }
if (!rejected) throw new Error('security certification overclaim not rejected');

const wrongChecks = structuredClone(input);
wrongChecks.observations.main_required_status_checks.pop();
rejected = false;
try { validateInput(wrongChecks); } catch (error) { rejected = error instanceof SecurityReviewError && error.code === 'STATUS_CHECK_SET_MISMATCH'; }
if (!rejected) throw new Error('status-check substitution not rejected');

console.log('SECURITY_REVIEW_V0_1_PASS');
