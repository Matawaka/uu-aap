'use strict';

const fs = require('fs');
const Adapter = require('./adapter.js');
const Binding = require('./receipt-binding.js');

const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const input = JSON.parse(fs.readFileSync('/tmp/marketcloser-adapter-positive-input.json', 'utf8'));
const receipt = JSON.parse(fs.readFileSync('/tmp/marketcloser-adapter-positive-receipt.json', 'utf8'));

Binding.assertExactBinding(input, receipt);

for (const mutate of [
  value => { value.candidate_binding.candidate_hash = `sha256:${'1'.repeat(64)}`; },
  value => { value.revalidation_binding.receipt_hash = `sha256:${'2'.repeat(64)}`; },
  value => { value.permit_binding.logical_invocation_id = `urn:uu-aap:marketcloser:real-stress-test-logical-invocation:${'3'.repeat(24)}`; }
]) {
  const changed = clone(receipt);
  mutate(changed);
  Adapter.rehash(changed);
  Adapter.validateReceipt(changed);
  let rejected = false;
  try { Binding.assertExactBinding(input, changed); } catch (_) { rejected = true; }
  assert(rejected, 'substituted self-consistent receipt must fail exact source binding');
}

console.log('MarketCloser real stress-test exact source binding: PASS');
