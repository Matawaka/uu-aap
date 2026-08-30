# C2PA / ProofMode -> PoAI -> UU-AAP Field-Evidence Public-Interest Pilot v0.1

Status: **P0.5 executable public-interest timeline pilot for #778**. This is not a real-incident claim, not C2PA conformance, not ProofMode conformance, not UU-AAP Core, and not a trust/reputation score.

Predecessor frontier: `9ff804a01c045601e3f5517dd9e3c919ba0b5674` (#784 / P0.4).

## Purpose

P0.5 asks a different question from P0.1-P0.4:

> Once field evidence has a provenance trail, can a later decision record preserve the difference between evidence existence, decision-time availability, consideration, authority and responsibility?

The pilot deliberately constructs three different resources around one synthetic public-interest publication decision:

```text
ProofMode-modeled capture A
  captured before cutoff
  delivered after cutoff
  -> provenance exists, but NOT decision-time available

ProofMode-modeled capture B
  captured and delivered before cutoff
  -> available, but NOT used

Agent analysis C
  delivered and considered before cutoff
  -> used, but agent has NO publication authority

Human editor
  -> decide + approve authority
  -> scoped publication responsibility
```

Expected result:

```text
capture A -> PROVENANCE_EXISTS_NOT_AVAILABLE
capture B -> AVAILABLE_NOT_USED
agent C   -> USED_WITHOUT_DECISION_AUTHORITY
UU-AAP    -> HUMAN_EDITOR authority/responsibility
truth     -> NOT_ESTABLISHED
```

## Real external capture-workflow anchor

The capture-workflow properties are pinned to:

```text
guardianproject/proofmode-android
commit: b7588b9d6b5e0df892cc929bf7d76ca03d9f5c07
README Git blob: ab0309c2084e3daf00ec62b729d7e49e9fd2ad3d
```

At that exact repository frontier the README describes ProofMode as a lightweight capture/proof workflow that:

- stores proof metadata separately from original media;
- supports chain of custody with SHA-256 hashes and OpenPGP signatures;
- can share media with related proof files and signatures;
- does not require a persistent account identity;
- states C2PA support against the **2.3 specification release**.

The last point is intentionally preserved. This pilot **does not upgrade that statement into a C2PA 2.4 conformance claim**. ProofMode is used here as a real external capture/provenance workflow anchor; the decision-time scenario itself is synthetic and deterministic.

## Semantic boundary under test

The pilot treats capture provenance as evidence, not as a universal verdict:

```text
capture existence/provenance != decision-time availability
availability != consideration
consideration != authority
signature/signer != factual truth
capture signer != publication authority
agent recommendation/consideration != decision authority
late evidence != permission to rewrite historical decision state
```

The PoAI record uses the existing Genesis schema and its current dimensions:

```text
identity
 discoverability
 reachability
 authorization
 temporal_fit
 context_sufficiency
 execution_capability
 delivery
```

No new PoAI availability primitive is introduced.

## Three-resource acceptance timeline

Knowledge cutoff:

```text
2026-08-30T09:30:00Z
```

### A. Capture exists before cutoff but arrives late

```text
captured  09:05Z
delivered 10:05Z
```

The record therefore requires:

```text
overall_status = unavailable
temporal_fit   = unavailable
delivery       = unavailable
consideration  = not_used
```

The presence of capture hashes, signatures or C2PA provenance cannot backfill historical availability.

### B. Capture is available but unused

```text
captured  09:10Z
delivered 09:20Z
```

The record requires:

```text
overall_status = available
delivery       = available
consideration  = not_used
```

This proves that availability is not equivalent to consideration or reliance.

### C. Agent analysis is considered but not authoritative

```text
created/delivered before cutoff
consideration = considered
agent scopes  = request_analysis + recommend
```

The agent is prohibited from `decide`, `approve` or `execute`. Publication authority and scoped responsibility remain with the human editor.

## Failure-closed behavior

The validator and CI reject at least these semantic escalations:

1. retroactively marking the late capture available before the cutoff;
2. changing the available-but-unused capture into considered evidence without changing the frozen scenario;
3. giving the field capture actor publication authority merely because they produced/signed the capture;
4. giving the AI agent decide/approve authority because its analysis was considered;
5. introducing an aggregate trust/reputation score;
6. claiming ProofMode C2PA 2.4 conformance from a pinned README that states 2.3.

## Run locally

```bash
python scripts/c2pa-field-evidence-pilot/validate-pilot.py \
  scripts/c2pa-field-evidence-pilot/pilot.fixture.json
```

The embedded PoAI record is separately validated by CI against:

```text
proposals/poai/schema/poai-record.schema.json
```

## Scope and limitations

This pilot does **not** claim that the synthetic field captures were generated by a live ProofMode installation. It binds the workflow model to real, pinned upstream documentation and then tests the UU-AAP/PoAI semantic boundary with a deterministic public-interest decision timeline.

A later stronger field pilot can replace the modeled capture resources with actual exported ProofMode/C2PA artifacts without changing the core acceptance distinctions.

No `protocols/core/**` file is modified. No C2PA namespace is registered. No new cryptography, identity layer or universal verifier is introduced.
