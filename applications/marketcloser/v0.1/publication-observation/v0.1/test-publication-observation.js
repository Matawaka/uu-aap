'use strict';

const fs = require('fs');
const path = require('path');
const Publication = require('./publication-observation.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const fixturePath = path.resolve(__dirname, 'examples/synthetic-publication-wait.input.json');

(async () => {
  const wait = JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  Publication.validateInput(wait);
  const waitReceipt = Publication.deriveReceipt(wait);
  assert(waitReceipt.classification === 'COPY_EXPORT_REQUIRED', 'committed fixture must require copy/export');
  assert(waitReceipt.observation_event_recorded === false && waitReceipt.publication_observed === false, 'waiting fixture cannot observe publication');

  const positive = await Positive.buildCopiedDraft();

  const noObservation = Positive.publicationInputFor(positive, null, 'synthetic-no-observation-001');
  Publication.validateInput(noObservation);
  const noObservationReceipt = Publication.deriveReceipt(noObservation);
  assert(noObservationReceipt.classification === 'PUBLICATION_OBSERVATION_REQUIRED', 'copied draft should require publication observation');

  const cases = [
    ['not_observed','PUBLICATION_NOT_OBSERVED',false],
    ['content_mismatch','PUBLICATION_CONTENT_MISMATCH',false],
    ['content_match','PUBLICATION_OBSERVED',true]
  ];
  let positiveInput = null;
  let positiveReceipt = null;
  for (const [result, classification, observed] of cases) {
    const input = Positive.publicationInputFor(
      positive,
      Positive.observationFor(positive.copyExportReceipt, result),
      `synthetic-${result.replaceAll('_','-')}-001`
    );
    Publication.validateInput(input);
    const receipt = Publication.deriveReceipt(input);
    assert(receipt.classification === classification, `${result} classification mismatch`);
    assert(receipt.publication_observed === observed, `${result} publication_observed mismatch`);
    assert(receipt.claims.publication_authorized === false, 'observation cannot authorize publication');
    assert(receipt.claims.runtime_network_accessed === false && receipt.claims.platform_mutated === false, 'observation runtime must remain non-actuating');
    if (observed) {
      positiveInput = input;
      positiveReceipt = receipt;
      assert(receipt.content_match === true, 'exact observed publication requires content_match');
      assert(receipt.copy_export_binding.draft_hash === receipt.observation_binding.observed_content_hash, 'exact published hash mismatch');
      assert(receipt.next_safe_action === 'OUTCOME_EVIDENCE_REQUIRED', 'published observation next action mismatch');
    }
  }

  const independentInput = Positive.publicationInputFor(
    positive,
    Positive.observationFor(positive.copyExportReceipt, 'content_match', {
      context:'independent_observer',
      publicationUrl:'https://independent.example.invalid/review/001'
    }),
    'synthetic-independent-observer-001'
  );
  Publication.validateInput(independentInput);
  const independentReceipt = Publication.deriveReceipt(independentInput);
  assert(independentReceipt.classification === 'PUBLICATION_OBSERVED', 'independent exact observation should observe publication');
  assert(independentReceipt.claims.observation_independently_verified === true, 'independent observation flag required');
  assert(independentReceipt.claims.runtime_network_accessed === false, 'recording supplied independent evidence is not runtime fetch');

  const badMatch = clone(positiveInput);
  badMatch.observation.observed_content_hash = `sha256:${'0'.repeat(64)}`;
  Publication.rehash(badMatch);
  let rejected = false;
  try { Publication.deriveReceipt(badMatch); } catch (_) { rejected = true; }
  assert(rejected, 'content_match with wrong hash must fail closed');

  const badMismatch = Positive.publicationInputFor(
    positive,
    Positive.observationFor(positive.copyExportReceipt, 'content_mismatch'),
    'synthetic-bad-mismatch-001'
  );
  badMismatch.observation.observed_content_hash = positive.copyExportReceipt.approval_binding.draft_hash;
  Publication.rehash(badMismatch);
  rejected = false;
  try { Publication.deriveReceipt(badMismatch); } catch (_) { rejected = true; }
  assert(rejected, 'content_mismatch with exact draft hash must fail closed');

  const badHuman = Positive.publicationInputFor(
    positive,
    Positive.observationFor(positive.copyExportReceipt, 'content_match', {
      context:'human_asserted',
      publicationUrl:'https://human.example.invalid/review/001',
      independentlyVerified:true
    }),
    'synthetic-human-overclaim-001'
  );
  Publication.rehash(badHuman);
  rejected = false;
  try { Publication.validateInput(badHuman); } catch (_) { rejected = true; }
  assert(rejected, 'human assertion cannot claim independent verification');

  const missingCopy = clone(wait);
  missingCopy.observation = {
    context:'synthetic_conformance',
    method:'synthetic_probe',
    observation_ref:'urn:synthetic:marketcloser:publication-observation-event:without-copy',
    observer_ref:'urn:synthetic:marketcloser:publication-observer:without-copy',
    observed_at:'2026-08-29T03:28:30Z',
    publication_url:'https://without-copy.example.invalid/review/001',
    result:'not_observed',
    match_mode:Publication.MATCH_MODE,
    observed_content_hash:null,
    independently_verified:false
  };
  Publication.rehash(missingCopy);
  rejected = false;
  try { Publication.validateInput(missingCopy); } catch (_) { rejected = true; }
  assert(rejected, 'observation cannot exist without copy/export receipt');

  fs.writeFileSync('/tmp/marketcloser-publication-positive-input.json', `${JSON.stringify(positiveInput,null,2)}\n`);
  fs.writeFileSync('/tmp/marketcloser-publication-positive-receipt.json', `${JSON.stringify(positiveReceipt,null,2)}\n`);
  console.log('MarketCloser Publication Observation v0.1 conformance: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
