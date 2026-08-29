'use strict';

const fs = require('fs');
const path = require('path');
const Response = require('./response-candidate.js');
const Positive = require('./synthetic-positive-helper.js');
const Disposition = require(path.resolve(__dirname, '../../human-analysis-disposition/v0.1/disposition.js'));

const fixturePath = path.resolve(__dirname, 'examples/synthetic-response-wait.input.json');
const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  const wait = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  Response.validateInput(wait);
  const waitReceipt = Response.deriveReceipt(wait);
  assert(waitReceipt.classification === 'DISPOSITION_ACCEPTANCE_REQUIRED', 'committed fixture must require accepted disposition');
  assert(waitReceipt.response_candidate === null, 'committed fixture cannot contain response candidate');
  assert(waitReceipt.claims.response_candidate_created === false, 'committed fixture cannot claim candidate creation');

  const positive = await Positive.buildReadyResponseInput();
  const input = positive.responseInput;
  const receipt = Response.deriveReceipt(input);
  assert(receipt.classification === 'RESPONSE_CANDIDATE_READY', 'positive synthetic response candidate should be ready');
  assert(receipt.response_candidate !== null, 'positive receipt must contain response candidate');
  assert(receipt.response_candidate.human_approval_required === true, 'human response approval required');
  assert(receipt.response_candidate.approved === false, 'response candidate cannot be pre-approved');
  assert(receipt.response_candidate.copy_export_allowed === false, 'response candidate cannot authorize copy export');
  assert(receipt.response_candidate.published === false, 'response candidate cannot be published');
  assert(receipt.claims.response_candidate_created === true, 'candidate creation claim required');
  assert(receipt.claims.publication_authorized === false, 'candidate cannot authorize publication');
  assert(receipt.next_safe_action === Response.NEXT_SAFE_ACTION, 'next safe action mismatch');

  const candidate = positive.chain.candidate;
  const statements = new Map(candidate.bounded_case.claim_package.material_statements.map(item => [item.statement_id, item]));
  const evidence = new Map(candidate.bounded_case.supporting_evidence.map(item => [item.evidence_id, item]));
  for (const point of receipt.response_candidate.evidence_bound_points) {
    const statement = statements.get(point.statement_id);
    assert(statement, `missing source statement ${point.statement_id}`);
    if (point.rendering === 'verified_fact') {
      assert(statement.classification === 'observed_evidence', 'verified_fact requires observed_evidence classification');
      assert(statement.evidence_refs.length > 0, 'verified_fact requires evidence');
      for (const ref of statement.evidence_refs) {
        const item = evidence.get(ref);
        assert(item && item.quality === 'verified', 'verified_fact requires verified evidence only');
        assert(item.supports_statement_ids.includes(statement.statement_id), 'verified_fact evidence must support statement');
        assert(!item.contradicts_statement_ids.includes(statement.statement_id), 'verified_fact cannot use contradicting evidence');
      }
    } else {
      assert(['qualified','conflict'].includes(point.rendering), 'weak evidence must remain qualified or conflicting');
    }
  }

  const replay = Response.deriveReceipt(input);
  assert(replay.content_hash === receipt.content_hash, 'deterministic response construction must replay identically');
  assert(replay.response_candidate.draft_text === receipt.response_candidate.draft_text, 'draft text replay mismatch');

  const rejectedDisposition = clone(positive.dispositionInput);
  rejectedDisposition.decision.value = 'REJECT';
  rejectedDisposition.decision.rationale = 'Synthetic rejected analysis for response-candidate boundary test.';
  Disposition.rehash(rejectedDisposition);
  Disposition.validateInput(rejectedDisposition);
  const rejectedReceipt = Disposition.deriveReceipt(rejectedDisposition);
  const rejectedPath = '/tmp/marketcloser-response-rejected-disposition.json';
  fs.writeFileSync(rejectedPath, `${JSON.stringify(rejectedDisposition, null, 2)}\n`);
  const rejectedInput = clone(input);
  rejectedInput.disposition_source.path = rejectedPath;
  rejectedInput.disposition_source.expected_disposition_input_hash = rejectedDisposition.content_hash;
  rejectedInput.disposition_receipt = rejectedReceipt;
  Response.rehash(rejectedInput);
  const stopped = Response.deriveReceipt(rejectedInput);
  assert(stopped.classification === 'DISPOSITION_ACCEPTANCE_REQUIRED', 'non-accepted analysis must not create response candidate');
  assert(stopped.response_candidate === null, 'non-accepted analysis produced candidate');

  for (const privacyKey of [
    'personal_data_present','sensitive_personal_data_present','reviewer_identity_present',
    'protected_attribute_data_present','psychological_vulnerability_data_present',
    'cross_context_identifier_present','raw_review_content_present','business_pressure_included'
  ]) {
    const bad = clone(input);
    bad.customer_context.privacy[privacyKey] = true;
    Response.rehash(bad);
    let rejected = false;
    try { Response.validateInput(bad); } catch (_) { rejected = true; }
    assert(rejected, `privacy boundary accepted ${privacyKey}=true`);
  }

  const unknownStatement = clone(input);
  unknownStatement.customer_context.selected_statement_ids = ['stmt-does-not-exist'];
  Response.rehash(unknownStatement);
  let rejected = false;
  try { Response.deriveReceipt(unknownStatement); } catch (_) { rejected = true; }
  assert(rejected, 'unknown statement selection must fail closed');

  const wrongSource = clone(input);
  wrongSource.disposition_source.expected_disposition_input_hash = `sha256:${'0'.repeat(64)}`;
  Response.rehash(wrongSource);
  rejected = false;
  try { Response.deriveReceipt(wrongSource); } catch (_) { rejected = true; }
  assert(rejected, 'disposition source substitution must fail closed');

  const overclaim = clone(receipt);
  overclaim.response_candidate.approved = true;
  overclaim.claims.response_approved = true;
  Response.rehash(overclaim);
  rejected = false;
  try { Response.validateReceipt(overclaim); } catch (_) { rejected = true; }
  assert(rejected, 'response approval overclaim must fail closed');

  const publicationOverclaim = clone(receipt);
  publicationOverclaim.response_candidate.published = true;
  publicationOverclaim.claims.publication_authorized = true;
  Response.rehash(publicationOverclaim);
  rejected = false;
  try { Response.validateReceipt(publicationOverclaim); } catch (_) { rejected = true; }
  assert(rejected, 'publication overclaim must fail closed');

  fs.writeFileSync('/tmp/marketcloser-response-positive-input.json', `${JSON.stringify(input, null, 2)}\n`);
  fs.writeFileSync('/tmp/marketcloser-response-positive-receipt.json', `${JSON.stringify(receipt, null, 2)}\n`);
  console.log('MarketCloser Response Candidate Construction v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
