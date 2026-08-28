# Private Portfolio Disclosure Assessment Gate v0.1

**Status:** experimental public-safe assessment harness  
**Issue:** #583  
**Origin frontier:** `82ba7f792f0ea96c7854f849b7c0642477c65454`

## Purpose

Assess one connector-visible private repository without publishing it or requiring its identity to be committed to the public UU-AAP repository.

```text
Private repository evidence
  -> disclosure readiness gates
  -> role + monetization assessment
  -> sanitized assessment receipt
  -> human disclosure decision
```

The raw input may exist ephemerally in a private execution context. The emitted `PrivateRepositoryDisclosureAssessmentReceipt` intentionally omits repository name, URL, private paths and private content.

## Invariants

```text
Private Repository Evidence != Public Disclosure
Assessment PASS != Visibility Change
Disclosure Candidate != Publication Authorization
Repository Name != Required Public Receipt Field
Open Source Candidate != Zero Monetization
Development Priority != Monetization Priority
Monetization Score != Disclosure Authority
```

## Mandatory gates

Every technical/provenance gate must be `pass` before either partial or full disclosure can become a candidate:

- connector frontier verified;
- secret scan clear;
- private-data scan clear;
- IP disclosure clear;
- third-party license clear;
- security/abuse review clear;
- role classified;
- monetization impact assessed;
- canonical provenance bound.

Explicit human disclosure approval is also required. Any `fail` or `unknown` fails closed to `KEEP_PRIVATE`.

## Dispositions

```text
KEEP_PRIVATE
PARTIAL_DISCLOSURE_CANDIDATE
FULL_PUBLIC_DISCLOSURE_CANDIDATE
```

No disposition changes GitHub visibility. A candidate remains advisory until a separate explicit human action changes repository visibility.

## Monetization model

Strategic priority, engineering WIP and monetization-validation priority are independent. The assessment also records direct product revenue fit, managed service/integration fit, enterprise conformance/support fit, audience/adoption leverage, value of source secrecy and value of open network effects.

Open-source value and commercial value may coexist.

## CLI

```text
validate-input
assess
validate-receipt
help
```

There is deliberately no `publish`, `make-public`, `deploy`, `push`, `merge` or `execute` command. The implementation performs no network access and writes no file.

## Successor

After GitHub App repository scope is expanded:

```text
RESCAN_PRIVATE_MATAWAKA_REPOSITORIES_WITH_DISCLOSURE_GATE
```

Each connector-visible private repository can then be evaluated from ephemeral private input. Only explicitly approved public-safe outputs should be retained.
