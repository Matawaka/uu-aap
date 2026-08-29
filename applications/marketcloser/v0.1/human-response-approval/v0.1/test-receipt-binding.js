'use strict';

const Approval = require('./approval.js');
const Binding = require('./receipt-binding.js');
const Positive = require('./synthetic-positive-helper.js');
const Test = require('./test-approval.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

(async () => {
  const positive = await Positive.buildReadyResponseCandidate({ responsePath: '/tmp/marketcloser-approval-binding-response.json' });
  const input = Test.approvalInputFor(positive, 'APPROVE_FOR_COPY_EXPORT', 'synthetic-binding-001');
  const receipt = Approval.deriveReceipt(input);
  Binding.validateReceiptForSource(input, receipt);

  const substitutions = [
    source => { source.approval_id = 'urn:uu-aap:marketcloser:human-response-approval:synthetic-binding-substitution'; },
    source => { source.decision.reviewer_ref = 'urn:synthetic:marketcloser:human-response-approver:substituted'; },
    source => { source.decision.rationale = 'Substituted approval rationale.'; },
    source => { source.decision.value = 'REQUEST_RESPONSE_CHANGES'; }
  ];
  for (const mutate of substitutions) {
    const source = clone(input);
    mutate(source);
    Approval.rehash(source);
    let rejected = false;
    try { Binding.validateReceiptForSource(source, receipt); } catch (_) { rejected = true; }
    assert(rejected, 'source-substituted approval receipt binding must fail closed');
  }

  const changed = clone(receipt);
  changed.response_binding.draft_hash = `sha256:${'0'.repeat(64)}`;
  Approval.rehash(changed);
  let rejected = false;
  try { Binding.validateReceiptForSource(input, changed); } catch (_) { rejected = true; }
  assert(rejected, 'receipt-substituted draft binding must fail closed');

  console.log('MarketCloser human response approval exact source binding: PASS');
})().catch(error => { console.error(error.stack || error); process.exit(1); });
