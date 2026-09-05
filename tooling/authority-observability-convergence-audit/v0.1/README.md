# Authority Observability Convergence + Reuse Audit v0.1

**Status:** read-only architecture admission audit / no generic runtime admitted  
**Issue:** #907  
**Origin main:** `928249c2e356d4cfaa9255a9701d30b82bb19cd9`

## Question

Has the merged #890 -> #906 authority-observability line become a genuinely reusable UU-AAP component, or should it remain a C2PA-specialized implementation with reusable semantic lessons only?

The audit deliberately follows the existing evidence-first admission discipline from `Reusable Component Admission Audit v0.1`:

```text
semantic similarity != direct reusable consumer
composition possible != new generic component required
candidate usefulness != Stable Core admission
```

## Result

```text
semantic reusable demand                     = CONFIRMED
strong independent second-domain matches     = Public Review + KONTUR
partial independent match                    = Life Situation Resolver
direct generic API reuse                     = NOT PROVEN
existing reusable observation/provenance     = AVAILABLE
multi-surface profile extraction              = CANDIDATE
observation-set calculus extraction           = CANDIDATE
generic runtime helper                        = DEFER
new action lifecycle                          = NOT JUSTIFIED
Stable Core admission                         = NO_CORE_ADMISSION
Interface Registry admission                  = DEFER
Workbench reuse evidence                      = EXCLUDED WHILE PAUSED
```

Overall machine decision:

```text
PROFILE_EXTRACTION_CANDIDATE_NO_CORE_ADMISSION
```

## What converged

The nine merged implementations form two layers rather than one monolith.

### 1. Domain-specific C2PA / authority adapter

```text
#890 Authority-Admission Consistency Gate
#892 Observable Authority Consistency
#894 three-surface triangulation
```

The exact source vocabulary remains domain-specific:

```text
runtime/configured signers
exported signers
signed-root admitted signers
cryptographic state
quorum eligibility
```

Those terms should **not** be renamed into a generic Core contract. They remain a valid C2PA/transparency-log authority adapter.

### 2. Increasingly generic observation composition

```text
#896 snapshot transition
#898 local continuity
#900 two-branch divergence
#902 N-branch observed set
#904 observed-set transition
#906 local observed-set transition chain
```

The upper line is much less dependent on C2PA meaning. Its durable invariants are:

```text
observed divergence != global equivocation proof
newly observed != globally created
not observed later != globally deleted
local adjacency != complete history
caller-supplied order != trusted chronology
same source digest + conflicting normalized content = fail closed
```

This is the part that now has evidence of independent demand.

## Independent-domain evidence

### Public Review — strong semantic match

Current exact repository evidence already separates:

```text
source observed != admitted
admission != disposition
covered-surface absence != global absence
observation checkpoint != external validation/certification
indexed disposition != new disposition
accept_for_followup != accepted as truth
```

The observation checkpoint also preserves exact receipt bytes after transient Actions artifact retention expires, without upgrading retention into trusted time or producer authentication.

This is the strongest first adapter target because Public Review is a current active repository lane and is already observation-only.

**Classification:** `SECOND_DOMAIN_SEMANTIC_MATCH / STRONG`  
**Direct consumer of #890-#906 API:** `false`

### KONTUR — strong semantic cross-check

KONTUR independently preserves:

```text
readiness != authority
readiness != responsibility acceptance
readiness != kernel activation
transition receipt -> next typed responsibility state
```

Its existing state machine should not be replaced by the observation-set calculus. The value is architectural cross-check: the same non-overclaim boundary survives in a completely different subsystem.

KONTUR is therefore **not** the recommended first adapter. Its mature typed lifecycle creates more semantic-collapse risk than the Public Review observation surfaces.

**Classification:** `SECOND_DOMAIN_SEMANTIC_MATCH / STRONG`  
**Direct consumer:** `false`

### Life Situation Resolver — partial epistemic match

LSR explicitly preserves:

```text
Observed transaction != Family need
Category inference != Verified fact
Scenario != Forecast != Intent != Authorization
Priority attention != Required action
```

This proves independent demand for epistemic separation, but current LSR does not demonstrate a need for branch/fork/divergence calculus. Forcing that vocabulary onto LSR would be premature abstraction.

**Classification:** `SECOND_DOMAIN_SEMANTIC_MATCH / PARTIAL`  
**Branch-set consumer:** not proven

### Bounded Action — existing downstream lifecycle, not a second copy

The provider-neutral bounded-action stack already owns:

```text
PreActionEvidenceBundle
-> AuthorizeAdmission
-> ExecuteRevalidation
-> Invocation
-> ActionReceipt
-> Outcome/Successor
-> Closure
```

Observation evidence may later be projected into an evidence context only through a separately validated adapter.

```text
Evidence Context != Source Verification
Observation Evidence != ActionPermit
Observation Profile != Second Action Lifecycle
```

**Classification:** `REUSE_EXISTING`

### Workbench — deliberately excluded

The current roadmap still states:

```text
Workbench = PAUSED_EXTERNAL_PRODUCT
```

and explicitly requires a separate human decision before resuming it.

Therefore Workbench is not counted as a reusable-demand consumer and is not an adapter target in this audit.

```text
reuse audit != Workbench reactivation
```

## Component-by-component admission

| Candidate | Result | Why |
|---|---|---|
| Authority admission consistency | `REUSE_EXISTING` | `Admission != Authority` is already a cross-repository invariant; C2PA quorum implementation remains domain-specific. |
| Explainability / observable consistency | `REUSE_EXISTING` | Ambient Observability + Circumstantial Provenance + Event-Hash Minimalism already cover bounded observation/provenance/non-overclaim. |
| Multi-surface triangulation | `PROFILE_EXTRACTION_CANDIDATE` | Public Review and KONTUR independently exhibit multi-surface state separation, but no direct shared API exists. |
| Observation-set calculus | `PROFILE_EXTRACTION_CANDIDATE` | Public Review supplies real second-domain demand for set/absence/history semantics; direct neutral reuse is still absent. |
| C2PA authority surface adapter | `DOMAIN_IMPLEMENTED` | trust-root/config/export/quorum semantics should remain an adapter, not generic Core. |

## Why this is not `ADMIT`

The old admission rule is still binding:

> `ADMIT` requires at least two genuinely independent current consumer families **and** no adequate existing reusable interface.

This audit confirms independent **semantic demand**, not direct consumption of one neutral API.

There is currently no second domain importing or validating a neutral #890-#906 interface because such a neutral interface does not yet exist.

Therefore:

```text
second-domain semantic match = yes
direct reusable consumer = no
profile extraction candidate = yes
Stable Core admission = no
```

## Next safe action

The audit recommends one concrete successor, not another recursive receipt layer:

```text
PROVE_TWO_DOMAIN_ADAPTERS_TO_CANDIDATE_NEUTRAL_PROFILE
```

Order:

1. define a **candidate**, non-registered, provider-neutral observation-set profile containing only the semantics that survived the audit;
2. build a C2PA adapter that projects accepted authority-observation receipts into that profile without changing #890-#906;
3. build a Public Review adapter that projects exact accepted observation checkpoint/disposition evidence into the same profile without changing Public Review semantics;
4. require both adapters to pass the same neutral conformance and hostile suite;
5. only then re-run reusable-component admission.

KONTUR should be used as an independent semantic cross-check after the first two adapters, not as the first consumer.

LSR should remain a partial epistemic cross-check unless a genuine branch/set need appears.

Workbench remains paused.

## Existing reusable substrate retained

This audit does not create a new generic observation/provenance umbrella. The following accepted reusable profiles remain authoritative for their existing scopes:

- Ambient Observability / Non-Identification;
- Circumstantial Provenance / Evidence Independence;
- Event-Hash Minimalism.

A candidate observation-set profile would need to add only the missing **plural-set / transition / local-history calculus**, not duplicate identity, provenance, retention or event-commitment semantics.

## Files

- `audit.json` — exact result and source/domain/component matrix;
- `audit.schema.json` — closed structural contract;
- `validate_audit.py` — byte-bound and semantic-marker validator;
- `test_audit.py` — hostile promotion/generalization suite;
- `implementation-receipt.json` — exact audit-package bindings;
- `implementation-receipt.schema.json` — receipt contract.

## Non-effects

This audit performs no Stable Core/SPEC/PRINCIPLES mutation, Interface Registry promotion, generic runtime implementation, C2PA reclassification, KONTUR activation, LSR actuation, ActionPermit creation, Workbench reactivation, release/tag/publication action or external effect.

```text
Convergence Audit != Genericization Authority
Second-Domain Semantic Match != Direct Reuse Proof
Reusable Candidate != Stable Core
Profile Extraction Candidate != Interface Registry Admission
```
