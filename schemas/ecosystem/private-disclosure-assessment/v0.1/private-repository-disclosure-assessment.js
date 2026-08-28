#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PrivateRepositoryDisclosureAssessmentError extends Error {
  constructor(message) { super(message); this.name = 'PrivateRepositoryDisclosureAssessmentError'; }
}
const req = (condition, message) => { if (!condition) throw new PrivateRepositoryDisclosureAssessmentError(message); };
const obj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const stable = value => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (obj(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
};
const hashWithoutContentHash = value => {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy.content_hash;
  return 'sha256:' + crypto.createHash('sha256').update(stable(copy)).digest('hex');
};
const exact = (value, keys, label) => {
  req(obj(value), `${label} must be object`);
  req(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} keys mismatch`);
};
const str = (value, label) => req(typeof value === 'string' && value.length > 0, `${label} must be non-empty string`);
const instant = (value, label) => { str(value, label); req(Number.isFinite(Date.parse(value)), `${label} invalid date-time`); };

const INPUT_KEYS = ['protocol','version','artifact_type','candidate_id','evaluated_at','repository_evidence','gates','role_classification','priorities','monetization','disclosure_request'];
const REPO_KEYS = ['owner','name','url','visibility','default_branch','frontier'];
const FRONTIER_KEYS = ['commit_sha','tree_sha'];
const GATE_KEYS = ['connector_frontier_verified','secret_scan_clear','private_data_scan_clear','ip_disclosure_clear','third_party_license_clear','security_abuse_review_clear','role_classified','monetization_impact_assessed','canonical_provenance_bound','human_disclosure_approval'];
const TECHNICAL_GATES = GATE_KEYS.filter(k => k !== 'human_disclosure_approval');
const ROLE_VALUES = ['protocol','shared_infrastructure','product','pilot','publication','experiment','archive','mixed'];
const PRIORITY_KEYS = ['strategic','development_wip','monetization_validation'];
const MONETIZATION_KEYS = ['direct_product_revenue_fit','managed_service_integration_fit','enterprise_conformance_support_fit','audience_adoption_leverage','source_secrecy_value','open_network_effect_value'];
const RECEIPT_KEYS = ['protocol','version','receipt_type','candidate_id','assessed_at','role_classification','gate_statuses','priorities','monetization_posture','recommended_disposition','blockers','sanitization','assertions','non_effects','next_safe_action','content_hash'];
const HASH40 = /^[0-9a-f]{40}$/;

function validateInput(input) {
  exact(input, INPUT_KEYS, 'input');
  req(input.protocol === 'UU-AAP-PRIVATE-PORTFOLIO-DISCLOSURE-ASSESSMENT', 'protocol mismatch');
  req(input.version === '0.1', 'version mismatch');
  req(input.artifact_type === 'PrivateRepositoryDisclosureAssessmentInput', 'artifact_type mismatch');
  str(input.candidate_id, 'candidate_id');
  instant(input.evaluated_at, 'evaluated_at');
  exact(input.repository_evidence, REPO_KEYS, 'repository_evidence');
  for (const k of ['owner','name','url','default_branch']) str(input.repository_evidence[k], `repository_evidence.${k}`);
  req(input.repository_evidence.visibility === 'private', 'repository must be private for this assessment');
  exact(input.repository_evidence.frontier, FRONTIER_KEYS, 'repository_evidence.frontier');
  for (const k of FRONTIER_KEYS) req(HASH40.test(input.repository_evidence.frontier[k]), `frontier.${k} invalid SHA`);
  exact(input.gates, GATE_KEYS, 'gates');
  for (const k of TECHNICAL_GATES) req(['pass','fail','unknown'].includes(input.gates[k]), `gates.${k} invalid`);
  req(['approved','not_approved','unknown'].includes(input.gates.human_disclosure_approval), 'human_disclosure_approval invalid');
  req(ROLE_VALUES.includes(input.role_classification), 'role_classification invalid');
  exact(input.priorities, PRIORITY_KEYS, 'priorities');
  for (const k of PRIORITY_KEYS) req(['P0','P1','P2','P3'].includes(input.priorities[k]), `priorities.${k} invalid`);
  exact(input.monetization, MONETIZATION_KEYS, 'monetization');
  for (const k of MONETIZATION_KEYS) req(['high','medium','low','unknown'].includes(input.monetization[k]), `monetization.${k} invalid`);
  exact(input.disclosure_request, ['partial','full'], 'disclosure_request');
  req(typeof input.disclosure_request.partial === 'boolean' && typeof input.disclosure_request.full === 'boolean', 'disclosure_request flags must be boolean');
  req(!(input.disclosure_request.partial && input.disclosure_request.full), 'partial and full disclosure cannot both be requested');
  return true;
}

function assess(input) {
  validateInput(input);
  const blockers = [];
  for (const k of TECHNICAL_GATES) if (input.gates[k] !== 'pass') blockers.push(`${k}:${input.gates[k]}`);
  if (input.gates.human_disclosure_approval !== 'approved') blockers.push(`human_disclosure_approval:${input.gates.human_disclosure_approval}`);
  if (!input.disclosure_request.partial && !input.disclosure_request.full) blockers.push('disclosure_request:none');

  const allTechnicalPass = TECHNICAL_GATES.every(k => input.gates[k] === 'pass');
  const humanApproved = input.gates.human_disclosure_approval === 'approved';
  let disposition = 'KEEP_PRIVATE';
  if (allTechnicalPass && humanApproved && input.disclosure_request.full) disposition = 'FULL_PUBLIC_DISCLOSURE_CANDIDATE';
  else if (allTechnicalPass && humanApproved && input.disclosure_request.partial) disposition = 'PARTIAL_DISCLOSURE_CANDIDATE';

  const receipt = {
    protocol: input.protocol,
    version: input.version,
    receipt_type: 'PrivateRepositoryDisclosureAssessmentReceipt',
    candidate_id: input.candidate_id,
    assessed_at: input.evaluated_at,
    role_classification: input.role_classification,
    gate_statuses: JSON.parse(JSON.stringify(input.gates)),
    priorities: JSON.parse(JSON.stringify(input.priorities)),
    monetization_posture: JSON.parse(JSON.stringify(input.monetization)),
    recommended_disposition: disposition,
    blockers: blockers.sort(),
    sanitization: {
      repository_identity_included: false,
      repository_url_included: false,
      private_paths_included: false,
      private_content_included: false
    },
    assertions: {
      assessment_is_advisory: true,
      explicit_human_gate_required: true,
      monetization_does_not_authorize_disclosure: true,
      repository_visibility_unchanged: true
    },
    non_effects: {
      visibility_change_performed: false,
      repository_publication_performed: false,
      license_change_performed: false,
      deployment_performed: false,
      external_effect_performed: false
    },
    next_safe_action: disposition === 'KEEP_PRIVATE' ? 'COMPLETE_MISSING_PRIVATE_REPOSITORY_GATES' : 'HUMAN_REVIEW_DISCLOSURE_CANDIDATE',
    content_hash: ''
  };
  receipt.content_hash = hashWithoutContentHash(receipt);
  validateReceipt(receipt);
  return receipt;
}

function validateReceipt(receipt) {
  exact(receipt, RECEIPT_KEYS, 'receipt');
  req(receipt.protocol === 'UU-AAP-PRIVATE-PORTFOLIO-DISCLOSURE-ASSESSMENT', 'receipt protocol mismatch');
  req(receipt.version === '0.1', 'receipt version mismatch');
  req(receipt.receipt_type === 'PrivateRepositoryDisclosureAssessmentReceipt', 'receipt_type mismatch');
  str(receipt.candidate_id, 'receipt.candidate_id');
  instant(receipt.assessed_at, 'receipt.assessed_at');
  req(ROLE_VALUES.includes(receipt.role_classification), 'receipt role invalid');
  exact(receipt.gate_statuses, GATE_KEYS, 'receipt.gate_statuses');
  exact(receipt.priorities, PRIORITY_KEYS, 'receipt.priorities');
  exact(receipt.monetization_posture, MONETIZATION_KEYS, 'receipt.monetization_posture');
  req(['KEEP_PRIVATE','PARTIAL_DISCLOSURE_CANDIDATE','FULL_PUBLIC_DISCLOSURE_CANDIDATE'].includes(receipt.recommended_disposition), 'receipt disposition invalid');
  req(Array.isArray(receipt.blockers) && receipt.blockers.every(x => typeof x === 'string'), 'receipt blockers invalid');
  exact(receipt.sanitization, ['repository_identity_included','repository_url_included','private_paths_included','private_content_included'], 'receipt.sanitization');
  req(Object.values(receipt.sanitization).every(v => v === false), 'receipt must remain sanitized');
  exact(receipt.assertions, ['assessment_is_advisory','explicit_human_gate_required','monetization_does_not_authorize_disclosure','repository_visibility_unchanged'], 'receipt.assertions');
  req(Object.values(receipt.assertions).every(v => v === true), 'receipt assertions must be true');
  exact(receipt.non_effects, ['visibility_change_performed','repository_publication_performed','license_change_performed','deployment_performed','external_effect_performed'], 'receipt.non_effects');
  req(Object.values(receipt.non_effects).every(v => v === false), 'receipt non-effects must be false');
  req(['COMPLETE_MISSING_PRIVATE_REPOSITORY_GATES','HUMAN_REVIEW_DISCLOSURE_CANDIDATE'].includes(receipt.next_safe_action), 'next_safe_action invalid');
  req(/^sha256:[0-9a-f]{64}$/.test(receipt.content_hash), 'receipt content_hash invalid');
  req(receipt.content_hash === hashWithoutContentHash(receipt), 'receipt content hash mismatch');

  const serialized = JSON.stringify(receipt);
  for (const forbidden of ['repository_evidence','repository_name','repository_url','private_paths','private_content']) req(!serialized.includes(`"${forbidden}"`), `sanitized receipt leaks ${forbidden}`);
  return true;
}

function readJson(inputPath) {
  str(inputPath, 'input path');
  const text = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(path.resolve(inputPath), 'utf8');
  try { return JSON.parse(text); } catch (error) { throw new PrivateRepositoryDisclosureAssessmentError(`invalid JSON: ${error.message}`); }
}

function main(args) {
  const [command, inputPath, ...extra] = args;
  if (!command || ['help','--help','-h'].includes(command)) {
    req(!inputPath && extra.length === 0, 'help accepts no extra arguments');
    process.stdout.write('Private Portfolio Disclosure Assessment Gate v0.1 read-only CLI\nUsage: private-repository-disclosure-assessment.js validate-input|assess|validate-receipt <json|->\nNo publish/make-public/deploy/push/merge/execute command exists.\n');
    return 0;
  }
  req(extra.length === 0, 'unexpected extra arguments');
  req(['validate-input','assess','validate-receipt'].includes(command), `unsupported command: ${command}`);
  req(inputPath !== undefined, `${command} requires input path`);
  const value = readJson(inputPath);
  if (command === 'validate-input') { validateInput(value); process.stdout.write('VALID\n'); }
  else if (command === 'assess') process.stdout.write(JSON.stringify(assess(value), null, 2) + '\n');
  else { validateReceipt(value); process.stdout.write('VALID\n'); }
  return 0;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (error) {
    if (error instanceof PrivateRepositoryDisclosureAssessmentError) {
      process.stderr.write(`Private Portfolio Disclosure Assessment error: ${error.message}\n`);
      process.exitCode = 1;
    } else throw error;
  }
}

module.exports = { PrivateRepositoryDisclosureAssessmentError, assess, hashWithoutContentHash, stable, validateInput, validateReceipt };
