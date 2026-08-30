# P1.10 Federated Candidate Disposition v0.1

P1.10 is the explicit disposition successor for the merged P1.9 federated candidate set.

It reuses the historical P1.5 decision vocabulary exactly:

```text
ACCEPT
REJECT
DEFER
```

but does not rewrite P1.5 or pretend that a P1.9 result is a P1.4 adapter result.

## Boundary

```text
P1.9 FederatedCandidateSet
+ explicit disposition event
→ P1.10 FederatedCandidateDispositionResult
→ valid P1.3 InteractiveVerifierInput
```

Every federated candidate must receive exactly one explicit disposition. At most one candidate may be accepted per verifier dimension.

No source family, source count, source ordering or evaluation state can automatically select a candidate.

```text
SUPPORTED != automatic ACCEPT
UNKNOWN != automatic REJECT
REJECT != negative evidence
DEFER != negative evidence
accepted identity != authority
accepted authority != responsibility
```

Accepted claim semantics are copied unchanged. The only allowed change to an accepted claim is appending the P1.10 disposition receipt evidence reference.

Source evidence inventories are concatenated without deduplication. Cross-source evidence-id collisions fail closed rather than silently merging evidence.

CAWG role attestations and W3C review attestations remain auxiliary observations and are not dispositionable candidates.

## Pages

The local reference surface is:

```text
/verifier/disposition/
```

It loads the existing P1.3, P1.4, P1.8 and P1.9 browser components locally before P1.10. It performs no server upload, model call, analytics or external runtime/network request.

EN/RU localization applies only to static shell labels. Candidate values/evaluations, source ids, dispositions/rationales, actor refs, evidence and JSON remain canonical.

## Historical source bindings

- P1.5 `acceptance.py`: `cfa17d11a01888422dd4f5c4a606142792dee5b9`
- P1.9 `federation.py`: `1398d303ca3f5786af21754cbe8c39ceaa9a844c`

Neither file is modified by P1.10.
