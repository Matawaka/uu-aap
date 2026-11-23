# UU-AAP × C2PA — Bounded Independent Replay Guide v0.1

**Date:** 2026-11-04  
**Status:** non-normative *review protocol* referencing existing public tests. This document itself does **not** run tests, include a frozen redistributable signed vector, or assert external reproduction.

## Reviewer goal

Reproduce **two different results** without conflating them:

1. A legitimate C2PA validation outcome plus correct externally referenced JSON *byte binding*.
2. A separate application-level refusal to infer UU-AAP publication authority from C2PA signer identity.

These are NOT a single trust verdict. A safe consumer can report provenance valid AND authorization not demonstrated.

## Public starting points

- [`scripts/c2pa-semantic-boundary/`](https://github.com/Matawaka/uu-aap/tree/main/scripts/c2pa-semantic-boundary) — current semantic rubric, deliberately unsafe and safe fixtures.
- [`scripts/c2pa-external-reference/`](https://github.com/Matawaka/uu-aap/tree/main/scripts/c2pa-external-reference) — standard hashed `c2pa.external-reference`, external synthetic record, readback verifier.
- [`scripts/c2pa-external-reference-v25/`](https://github.com/Matawaka/uu-aap/tree/main/scripts/c2pa-external-reference-v25) — successor representation experiment; do NOT assume this changes the 2.4 baseline.
- [Experimental signed-asset matrix PR #1019 at pinned head](https://github.com/Matawaka/uu-aap/pull/1019) — additional internal CI evidence, **not on main**.

## Minimal replay from a clean local checkout

Use the published repository code as test subject, not as an independent oracle. Pin and record the exact Git commit before running. Node.js is required for the local examples; inspect scripts and dependencies before execution.

### A — semantic boundary (local, no signing)

```sh
git clone https://github.com/Matawaka/uu-aap.git
cd uu-aap
git rev-parse HEAD
node scripts/c2pa-semantic-boundary/test.js
node scripts/c2pa-semantic-boundary/evaluate.js \
  scripts/c2pa-semantic-boundary/rubric-v0.1.json \
  scripts/c2pa-semantic-boundary/fixtures/unsafe-all-invariants.json
```

The `evaluate.js` call is intentionally expected to produce semantic findings and a **non-zero exit** for unsafe input. Check that the result distinguishes `c2pa_conformance_evaluated: false`. Compare with the safe fixture following the harness README. A passing local rubric test only proves the examples' **application semantics**, not the correctness of an independent C2PA verifier.

### B — exact-byte external reference (inspect/build locally)

```sh
node scripts/c2pa-external-reference/build-config.js \
  scripts/c2pa-external-reference/fixtures/external-uu-aap-record.json \
  /tmp/c2pa-external-reference-manifest.json
```

Inspect the generated assertion's `location.url`, `alg`, hash bytes, `dc:format`, `size`, absent arbitrary C2PA UU-AAP assertion label, and gathered-assertion posture. Compare the digest to an **independent hash over identical file bytes**. A modified-byte copy must not match the recorded digest. This build step alone neither signs an asset nor proves C2PA validation.

### C — real signed asset (external C2PA validator required)

Follow the original [P0.2 fixture README](https://github.com/Matawaka/uu-aap/blob/main/scripts/c2pa-external-reference/README.md) and inspect the pinned `c2patool v0.27.16` workflow, or independently repeat the optional [PR #1019 matrix](https://github.com/Matawaka/uu-aap/pull/1019) using its exact head and `c2patool v0.28.4`/release archive checksum. Record tool identity, certificate/trust status, active-manifest validation, assertion representation, reference hash match, byte-size, and the negative altered-resource case. Do **not** count a forged or edited reader JSON report as a cryptographic signature-tamper test. No SDK commands have been executed in preparing this guide.

## Adversarial interpretation matrix

| Stimulus | Required conclusion | Forbidden conclusion |
| --- | --- | --- |
| A valid C2PA signer named 'Author' | Signer assertion/validation only | This signer is necessarily the UU-AAP author or publication authority |
| A gathered hashed reference matches the external JSON bytes | Exact resource binding within the tested hash/representation scope | External claims are true or independently reviewed |
| C2PA action indicates a publication/export step | Operation/provenance evidence | Actor had decision or publication authority |
| An ingredient is titled 'Original Concept' | Artifact relation (if validated) | Intellectual concept origination proved |
| AI involvement is disclosed | Disclosure assertion available | Human approval/responsibility proved |
| Valid repository receipt | Receipt/provenance in stated scope | Verified truth, completeness or release authority |
| Resource can be retrieved today | Present retrieval observation | Resource was available to a specified historical decision |
| Correct C2PA signature, missing separately evidenced UU-AAP authority | C2PA validity can remain true; application inference denied | ActionPermit or authorized publication inferred |

## Reviewer-owned evidence to return

Record: reviewer-controlled implementation and version; repository commit and fixture bytes/digests; C2PA validator and status/credential-trust details; observed hash/size/media-type fields; raw safe/unsafe inference results; whether remote retrieval occurred; deviations/bugs; source URLs. Distinguish **independent recomputation** from merely repeating project CI. An external review may conclude FAIL or INCONCLUSIVE; do not substitute project-authored PASS.

**Classification:** `REPRODUCED_BOUNDED`, `MISMATCH`, `BLOCKED`, or `INSUFFICIENT_EVIDENCE` for the exact tested surface only; no universal certification. External feedback is stored as a new observation rather than modifying old receipts.

## Gates after this document

1. Freeze/publish a truly portable, byte-pinned signed asset and expected-output bundle for reviewer convenience if one is not already directly accessible.
2. Obtain one independently performed replay (preferably a different SDK or a reviewer-owned script), retaining negative controls.
3. Only then decide whether a narrowly scoped C2PA/CAI community discussion is useful; ask a technical interoperability question rather than for adoption of UU-AAP or a standards amendment.

**No effect on:** SPEC, Core, canonical release, UV-02/UV-03, production authority, signer/trust roots, marks, workflow dispatch, or live-video handling.