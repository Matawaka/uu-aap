'use strict';

const Response = require('./response-candidate.js');
const Binding = require('./receipt-binding.js');
const Positive = require('./synthetic-positive-helper.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  const positive = await Positive.buildReadyResponseInput({ responsePath: '/tmp/marketcloser-response-binding-input.json' });
  const input = positive.responseInput;
  const receipt = Response.deriveReceipt(input);
  Binding.validateReceiptForSource(input, receipt);

  const substitutions = [
    source => { source.request_id = 'urn:uu-aap:marketcloser:response-candidate-request:synthetic-substitution-001'; },
    source => { source.customer_context.tone = 'concise_factual'; },
    source => { source.customer_context.context_id = 'urn:synthetic:marketcloser:response-context:substituted-001'; },
    source => { source.disposition_receipt.human_decision.rationale = 'Substituted rationale'; Response.rehash(source.disposition_receipt); }
  ];
  for (const mutate of substitutions) {
    const source = clone(input);
    mutate(source);
    Response.rehash(source);
    let rejected = false;
    try { Binding.validateReceiptForSource(source, receipt); } catch (_) { rejected = true; }
    assert(rejected, 'source-substituted receipt binding must fail closed');
  }

  const changed = clone(receipt);
  changed.response_candidate.draft_text += '\n\nSubstituted text.';
  Response.rehash(changed);
  let rejected = false;
  try { Binding.validateReceiptForSource(input, changed); } catch (_) { rejected = true; }
  assert(rejected, 'receipt-substituted binding must fail closed');

  console.log('MarketCloser response candidate exact source binding: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
