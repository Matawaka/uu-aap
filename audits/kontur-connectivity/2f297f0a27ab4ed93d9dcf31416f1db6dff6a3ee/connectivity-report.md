# KONTUR / UU-AAP Connectivity Report

## Executive summary

The audit examined the repository state at
`2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee`. The observed GitHub `main`
exactly matched the expected frontier, so there is no expected/observed divergence to
normalize or conceal.

The materialized architecture has strong **local synthetic connectedness**:

- Stable Core expresses and validates its typed forward direction from state/evidence
  through successor state.
- Each of the seven Game Companion layers has a specification, machine-readable
  fixture, deterministic validator, and workflow that invokes that validator.
- All eight relevant validators passed against the commit-pinned source.
- No Game Companion import into Stable Core, orphaned component in the audited
  seven-layer line, external effect, action permit, or successor permit was found.

The architecture has weaker **cross-layer evidence connectedness**:

- the six successor relations are not bound to predecessor artifact hashes, typed
  receipts, fixture digests, or consumed validator results;
- predecessor-only changes do not trigger downstream validators;
- Focus Diversity's predecessor claim is prose/PR evidence rather than fixture/validator
  evidence;
- the optional Core-to-KONTUR relation is documented but not materialized as a typed
  interface-registry edge;
- the Interaction Receipt's `response_authorized` field conflicts semantically with
  the same specification's `Receipt != Authority` denial absent a separately bound
  authority decision.

This is not a pass/fail result. It is a classified evidence map. Synthetic validation
does not establish live KONTUR behavior, and live behavior was neither observed nor
invoked.

## Frontier and method

| Item | Value |
|---|---|
| Expected frontier | `2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee` |
| Observed `main` | `2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee` |
| Divergence | None |
| Commit-pinned archive SHA-256 | `faf109a86c7fe61dc06a0956d6129eb32bb3c2af4b603137d3784f431e1b8b6d` |
| Nodes examined | 50 |
| Relations examined | 97 |

The method combined direct public GitHub commit/PR/issue inspection, repository search,
artifact hashing, specification-to-fixture-to-validator-to-workflow tracing, mutation
expectation review, and execution of existing deterministic validators. Each conclusion
uses the form Claim → Evidence → Classification.

Classification ledger:

| Classification | Count |
|---|---:|
| PROVEN | 78 |
| DOCUMENTED | 4 |
| IMPLIED | 0 |
| MISSING | 13 |
| CONFLICTING | 1 |
| OUT_OF_SCOPE | 1 |

## Overall connectivity assessment

**Claim:** The current architecture is locally connected as a deterministic synthetic
model but is not fully connected as a cross-layer evidence chain.

**Evidence:** The Core validator and seven Game Companion validators pass; every audited
layer has a direct workflow execution path. Graph relations R062–R073 show that all six
predecessor artifact bindings and all six downstream change triggers are absent.

**Classification:** `PROVEN` for the local validation chains; `MISSING` for the
twelve cross-layer binding/trigger relations.

The distinction is material: repository adjacency, linear merge history, and green
fixture validation do not prove that one layer consumes the exact state validated by
another.

## Stable-core connectivity

**Claim:** Stable Core materializes the intended reusable forward direction:

```text
State / Evidence Anchor
→ Possibility / Availability
→ Intent
→ Authority / Responsibility
→ Coordination / CCRP
→ Action Gate
→ Outcome / Provenance / Successor State
```

**Evidence:** `protocols/core/v0.1/README.md` defines this direction;
`end-to-end.fixture.json` materializes the typed sequence
`StateReceipt → AvailabilityClaim → IntentReceipt → AuthorityReceipt →
CoordinationReceipt → ActionPermit → ActionReceipt → OutcomeReceipt →
SuccessorStateReceipt`; `validate-core.js` checks required predecessor types,
frontiers, coordination, permission expansion, outcomes, and successor state; the
Stable Core workflow executes that validator.

**Classification:** `PROVEN`.

No evidence was found that an outcome or receipt silently creates reverse authority.
A receipt is evidence of a prior relation; it is not treated here as permission for a
successor action.

## KONTUR optional-adapter boundary

**Claim:** The allowed conceptual direction remains:

```text
stable primitive → optional KONTUR/Game Companion adapter → synthetic pilot
```

and not the reverse.

**Evidence:** Stable Core explicitly states that it does not import, activate, or mutate
KONTUR. Repository search found no Stable Core import of the Game Companion layers.
The interface registry contains the Core interface but no KONTUR/Game Companion entry.

**Classification:** The absence of a reverse stable-core dependency is `PROVEN`.
The forward optional reuse relation is `DOCUMENTED`. The typed registry connection is
`MISSING`.

The missing registry edge is a connectivity observation only. It does not imply that
the optional adapter should be promoted into Core.

## Game Companion chain assessment

PR numbers were not used as dependency proof. Public GitHub records establish the
actual merge history:

```text
#446 / 75c150a
→ #448 / 6465e6b (unrelated intervening merge)
→ #452 / 3fc4b66
→ #453 / b3df9ac
→ #454 / 282f132
→ #455 / b45eaf9
→ #456 / 7c97e26
→ #457 / 2f297f0
```

Issue #445 is the open bounded-fallibility/backlog contract; the seven merged PRs
materialize separate layers. Their semantic relations were classified from artifacts,
not from numbering.

| From | To | Declared relation | Artifact binding | Downstream CI trigger |
|---|---|---|---|---|
| #445 | #446 Observational Lane | PROVEN materialization | — | Direct layer workflow PROVEN |
| #446 | #452 Assistance Gate | PROVEN | MISSING | MISSING |
| #452 | #453 Shared Discovery Memory | PROVEN | MISSING | MISSING |
| #453 | #454 Bounded Initiative | PROVEN | MISSING | MISSING |
| #454 | #455 Focus Diversity | DOCUMENTED | MISSING | MISSING |
| #455 | #456 Interaction Receipt | PROVEN | MISSING | MISSING |
| #456 | #457 Pause / Resume | PROVEN | MISSING | MISSING |

The Focus Diversity row is `DOCUMENTED` because its README and PR name the
predecessors while its fixture and validator do not carry or verify that metadata.

## Validation-chain assessment

For every audited synthetic layer the direct chain exists and is effective:

| Layer | Specification | Fixture consumed | Validator checks claimed boundary | Workflow executes validator | Local result |
|---|---|---|---|---|---|
| Stable Core | PROVEN | PROVEN | PROVEN | PROVEN | PASS |
| Observational Lane | PROVEN | PROVEN | PROVEN | PROVEN | PASS, 16 mutation checks |
| Assistance Gate | PROVEN | PROVEN | PROVEN | PROVEN | PASS, 18 mutation checks |
| Shared Discovery Memory | PROVEN | PROVEN | PROVEN | PROVEN | PASS, 24 mutation checks |
| Bounded Initiative | PROVEN | PROVEN | PROVEN | PROVEN | PASS, 26 mutation checks |
| Focus Diversity | PROVEN | PROVEN | PROVEN | PROVEN | PASS, 28 mutation checks |
| Interaction Receipt | PROVEN | PROVEN | PROVEN | PROVEN | PASS, 35 mutation checks |
| Pause / Resume | PROVEN | PROVEN | PROVEN | PROVEN | PASS, 33 mutation checks |

This proves that the named workflow invokes the intended validator and that the
validator consumes its adjacent fixture. It does not prove runtime behavior, and it
does not make cross-layer validation transitive. Several broader non-effects in prose
are not represented as machine fields, so their status remains `DOCUMENTED`.

## Provenance assessment

**Claim:** Frontier provenance and layer origins are identifiable and repository
history is linear.

**Evidence:** Direct commit and PR records establish merge commits for #446 and
#452–#457, and the final #457 merge is the observed frontier. README origin references
correspond to those PRs.

**Classification:** `PROVEN` for commit/PR origin and history.

**Claim:** The semantic predecessor chain is cryptographically or structurally bound.

**Evidence:** No predecessor artifact hash, fixture digest, typed cross-layer receipt,
or consumed validator result was found in the six successor boundaries.

**Classification:** `MISSING`.

Origin metadata is not silently upgraded to semantic dependency proof.

## Authority and non-effect assessment

The audited fixtures and validators preserve the following issue #445 invariants at
machine level: `Companion != Solver`, `Hypothesis != Fact`,
`Knowledge != Spoiler Right`, `Optimal Move != Interesting Move`,
`Confidence != Authority`, `Request for Conversation != Request for Completion`,
`Permission to Be Wrong != Permission to Cause Avoidable Loss`,
`Remembered Correction != Permanent Player Profile`,
`Memory Candidate != Durable Memory`, `Memory Available != Initiative Authorized`,
`Silence != Invitation`, `Player Cue > System Agenda`,
`Repeated Ignoring -> Less Initiative`,
`Interesting Detail != Attention Capture Right`,
`Predicted Interest != Player Intent`,
`Player-Selected Focus > System-Predicted Interest`,
`Recall != Intent Continuity`,
`Previous Help Request != Current Help Request`,
`Session Resume != Topic Resume`, and
`Remembered Spoiler Exposure != Deeper Spoiler Authority`.

Two exact invariants remain prose-level: `Advice != Command` and
`Correction by Player != Model Defeat`. Related external-control and
correction-provenance constraints are checked, but those exact semantic distinctions
have no direct fixture representation. Classification: `DOCUMENTED`.

For `Receipt != Authority`, README denial and fixture/validator use of
`response_authorized` are not cleanly separated by a bound authority decision.
Classification: `CONFLICTING`. The same fixture still asserts no action permit,
successor permit, or external game effect; the conflict is semantic connectedness, not
evidence that an external action occurred.

Search and validator review found no authorization for live response generation,
background notification, autonomous gameplay, account control, external effects,
successor permits, action permits, mood/psychological inference, attention capture,
engagement maximization, retention optimization, total-history capture, cross-game
profiling, or automatic Stable Core promotion. Some denials are machine checked and
others exist only in prose; the graph preserves that distinction.

## Orphan and reverse-dependency assessment

**Claim:** The seven materialized Game Companion layers are not locally orphaned.

**Evidence:** Each has a README, fixture, validator, and workflow; each workflow points
to an existing validator that consumes the intended fixture.

**Classification:** `PROVEN`.

**Claim:** Optional pilot observation has become a mandatory Core dependency.

**Evidence:** No import/reference path from Stable Core to the Game Companion
implementation was found; Core explicitly denies importing or activating KONTUR.

**Classification:** The reverse dependency is not observed and the non-import boundary
is `PROVEN`. Missing evidence is not generalized into a claim about all possible
future or runtime dependencies.

No circular authority or circular provenance was found in the materialized fixture
graphs. The unbound predecessor relations and non-transitive CI paths are reported as
gaps, not reinterpreted as cycles.

## Unresolved uncertainty

- Live KONTUR, gameplay, live-user observation, and runtime integration are
  `OUT_OF_SCOPE`; no runtime connectedness claim is made.
- Public repository evidence can show materialized artifacts and history, but cannot
  establish unrecorded design intent.
- Prose-only non-effects cannot be elevated to `PROVEN` without machine evidence.
- The `response_authorized` semantic conflict does not show an external effect, but
  the repository alone does not provide enough separation to resolve its authority
  meaning.
- The absence of a typed optional-adapter registry edge leaves the exact forward
  Core-to-KONTUR interface unspecified.
- The audit was recovered after a network interruption and published in PR #458 using
  an already-authorized GitHub connector. No permission expansion was sought, no
  duplicate audit was created, and the PR remains unmerged.

## Exact findings

| ID | Severity | Classification | Finding |
|---|---|---|---|
| F-001 | HIGH | MISSING | Six successor transitions lack artifact/hash/typed-receipt validation binding. |
| F-002 | HIGH | MISSING | Successor workflows do not run on predecessor-only changes. |
| F-003 | MEDIUM | CONFLICTING | Interaction Receipt denial of authority conflicts with unbound `response_authorized` semantics. |
| F-004 | MEDIUM | DOCUMENTED | Focus Diversity predecessor provenance is absent from its fixture and validator. |
| F-005 | MEDIUM | DOCUMENTED | Several documented non-effects exceed machine-validated fields. |
| F-006 | MEDIUM | DOCUMENTED | Optional Core-to-KONTUR reuse lacks a typed interface-registry edge. |
| F-007 | LOW | DOCUMENTED | Two exact issue #445 invariants remain prose-level. |
| F-008 | NOTE | PROVEN | Expected and observed frontier match; history includes unrelated #448. |
| F-009 | NOTE | PROVEN | All relevant validators pass, proving synthetic conformance only. |
| F-010 | NOTE | PROVEN | No local layer orphan or reverse Stable Core dependency was found. |

Detailed evidence and non-authorization fields are in `findings.json`.
No remediation is authorized by any finding.

## Audit non-effect receipt

- Architecture modified: `false`
- External effect authorized: `false`
- Action permit created: `false`
- Successor permit created: `false`
- Stable-core change implied: `false`
- Remediation authorized: `false`

**Audit Publication != Architecture Change**

**This report contains evidence only and authorizes no remediation.**


