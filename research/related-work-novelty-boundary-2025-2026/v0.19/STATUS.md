# v0.19 qualification boundary

The frozen first observation is `BOUND_SINGLE_RESPONSE_FILTER_BRIDGE_EXECUTED_PASS`,
limited to one synthetic response per exact request through the unchanged default
`none: take_first` filter and unchanged v0.18 bound scorer.

First complete head: `dfda99dc27d0d62b324864359331ff84f64abc70`.
Run `34259729761`, A job `102174384420`, B job `102174383762`, both success on
distinct runners. No technical v0.19 runtime RED preceded the first pair.

All 61 files from both real downloaded ZIPs match byte-for-byte. All 47 predecessor
members retain their old manifest identities. The 14 new members include complete
filtered Instances, response envelopes, scoring ledger/native reference, all 94
zero-effect rejection records, raw diagnostics and post-filter namespace/imports.
The 771511-byte filtered snapshot matches the independently computed oracle posted
before artifact observation in #995 comment 5589532232. Predictions are not runtime
observations and never replace adapter inputs.

The raw upstream diagnostics remain explicit: two responses select only the first;
a string container produces its first character; a late empty list raises IndexError
after the preceding Instance has already received a filtered output. These are
outside the admitted profile and are not scored. The wrapper rejects malformed
collections before calling native filters and validates every filtered output
before any scoring. No transactional rollback of native failures is claimed.

A successor qualifies only when BOTH fresh A/B jobs repeat the unchanged runtime
and pass the unconditional validate_qualification.py step. Missing or changed
members, altered historical statuses and source mismatches fail closed. A stored
first-pair receipt alone does not qualify a successor that has not executed.

The evidence manifest is layered: its 14 new entries plus the exact SHA-bound
v0.18 manifest prefixed by predecessor/ expand to precisely 61 file identities.
This is not a skip of older evidence: every expanded path, byte size and hash is
compared against the newly executed artifacts. Full snapshots are supplementary
Actions artifacts (30 days), not claimed as Git-committed. Git retains source,
contract, result, layered manifest, receipt and validator.

Original upstream Task and metric remain NONPASS. This is synthetic-only routing
fidelity, not full evaluator/aggregation integration, general filters, model
semantics or model provenance. Hash/origin labels do not authenticate a producer.
Synthetic empty-response rejection does not permit excluding failed real-model
answers from a future benchmark denominator. No model, provider, dispatch,
aggregate benchmark, main update, release or merge authority.

Next separate candidate boundary: synthetic per-document-result aggregation and
exact denominator/conservation contract, without evaluator dispatch or models.
No such next-stage execution is claimed by v0.19.
