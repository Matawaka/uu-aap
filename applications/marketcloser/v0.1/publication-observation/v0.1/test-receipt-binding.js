'use strict';

const Publication = require('./publication-observation.js');
const Binding = require('./receipt-binding.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  const positive = await Positive.buildPublicationInput({ publicationPath:'/tmp/marketcloser-publication-binding-input.json' });
  const input = positive.publicationInput;
  const receipt = Publication.deriveReceipt(input);
  Binding.validateReceiptForSource(input, receipt);

  const substitutions = [
    source => { source.observation_id = 'urn:uu-aap:marketcloser:publication-observation:synthetic-substitution-001'; },
    source => { source.observation.observation_ref = 'urn:synthetic:marketcloser:publication-observation-event:substituted'; },
    source => { source.observation.observer_ref = 'urn:synthetic:marketcloser:publication-observer:substituted'; },
    source => { source.observation.observed_at = '2026-08-29T03:28:31Z'; },
    source => { source.observation.publication_url = 'https://substituted.example.invalid/review/001'; }
  ];
  for (const mutate of substitutions) {
    const source = clone(input);
    mutate(source);
    Publication.rehash(source);
    let rejected = false;
    try { Binding.validateReceiptForSource(source, receipt); } catch (_) { rejected = true; }
    assert(rejected, 'source-substituted publication receipt binding must fail closed');
  }

  const changed = clone(receipt);
  changed.observation_binding.publication_url = 'https://receipt-substitution.example.invalid/review/001';
  Publication.rehash(changed);
  let rejected = false;
  try { Binding.validateReceiptForSource(input, changed); } catch (_) { rejected = true; }
  assert(rejected, 'receipt-substituted publication binding must fail closed');

  console.log('MarketCloser publication observation exact source binding: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
