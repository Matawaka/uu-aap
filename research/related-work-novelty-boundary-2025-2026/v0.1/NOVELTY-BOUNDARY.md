# Novelty Boundary — Matawaka / UU-AAP / PoAI, 2025–2026

Status: `BOUNDED_RESEARCH_SYNTHESIS`

This document states what the current 2025–2026 landscape audit supports, what it does not support, and which narrower research contributions remain plausible candidates after obvious prior public work is removed.

It is not a patentability opinion, freedom-to-operate analysis, legal priority determination, or complete prior-art search.

## 1. Public comparison frontier

The bounded audit uses only public repository evidence for Matawaka chronology:

- 2026-08-22 — public `Matawaka/uu-aap` repository frontier;
- 2026-08-22 — PoAI compositional-intelligence boundary in Issue #27;
- 2026-08-24 — Minimal Stable Core in Issue #303;
- 2026-08-24 — AI Gateway / Agent-Callable Protocol in Issue #307.

Private conception, unpublished work and earlier private project history are intentionally not used to make public-priority claims.

A conservative 2026-08-17 through 2026-08-24 interval is treated as a `PARALLEL_WINDOW`. Chronology inside that window is not used to infer influence.

## 2. Broad claims the audit rejects

The current evidence makes the following statements unsuitable as Matawaka novelty claims.

### 2.1 AI-contribution disclosure is not new

GAIDeT, TAS-5, Provenance Not Prohibition, PETMALU-AI and relational-authorship research predate the public UU-AAP frontier and already structure disclosure/accountability for AI-assisted work.

Do not claim:

> UU-AAP was the first framework to disclose or classify human/AI contribution.

### 2.2 `Provenance != Permission` is not new

CAWG Endorsement, CAWG Consent and the March 2026 `org.c2pa.digital-likeness` proposal already separate artifact provenance, identity and consent/permission-like state. The latter states the gap explicitly as `Provenance is not permission`.

Do not claim:

> Matawaka first discovered that provenance is not permission.

### 2.3 The AI action-authorization boundary is not new

Public work predating August 2026 includes Agentic JWT, FERZ authorization-boundary work, Verifiable Intent, Intent Token, AgentROA, Delegation Receipt Protocol, Permit Receipts, NCS and CVA.

Collectively these already cover substantial parts of:

```text
identity/access
  !=
exact action authorization
  -> pre-effect verification
  -> bounded scope / validity / anti-replay
  -> execution coupling / receipt
```

Do not claim:

> Matawaka invented the AI Agent Action Gateway.

> Matawaka was first to require a permit before an AI-agent external effect.

> Matawaka was first to separate access authorization from action authorization.

### 2.4 Delegation receipts and monotonic scope narrowing are not new

Agentic JWT, Intent Token, AgentROA, Delegation Receipt Protocol and MJWT contain public pre-UU-AAP delegation/scope machinery.

Do not claim that signed bounded delegation is unique to Matawaka.

### 2.5 Execution receipts and decision traces are not new

AgentROA, GAR/AEP, BAXDT, Decision Event Schema, Auditable LLM Autonomy and related work already preserve decision/execution/audit evidence.

Do not claim that Matawaka invented post-action receipts, decision traces or the general question of what context existed around a decision.

### 2.6 Append-only transparency and non-equivocation are not new

SCITT RFC 9943 is an IETF consensus architecture for signed statements and transparency services. C2PA-related external work independently explores append-only checkpoint consistency, witnesses and anchors.

Do not claim transparency logs, witnessed checkpoints or external anchoring as Matawaka core novelty.

## 3. Closest predecessor pressure

The strongest comparisons are not all in one family.

### 3.1 EP-AEC — strongest evidence-composition pressure

`ep-aec-2026` already composes heterogeneous evidence for one consequential action, including identity, delegation, policy/permit, approval, transparency, capability and execution evidence.

It also preserves an important semantic boundary:

```text
native-valid evidence
  !=
material-action-bound evidence
  !=
universal authorization
  !=
execution/outcome proof
```

Therefore `heterogeneous receipt composition` alone is not a surviving Matawaka novelty claim.

The remaining comparison question is whether Matawaka applies a more general semantic non-escalation discipline outside the authorization-evidence domain, including availability, consideration, intent, responsibility, coordination, outcome, causality and truth.

### 3.2 Sato/SOOS family — strongest lifecycle pressure

The Sato/SOOS drafts independently materialize several distinct governance primitives:

- IDP — structured intent declaration;
- MJWT — human-principal/mission/action-scope authority binding;
- HEM — human escalation state;
- AEP — reasoning-loop to enforcement-kernel interface;
- GAR — signed governance audit stream.

This is serious predecessor pressure against any broad statement that UU-AAP first linked intent, human review, authority, execution and audit.

The surviving question is narrower: whether the exact provider-neutral UU-AAP composition adds semantically necessary independent layers — especially Availability, Responsibility, Coordination, explicit non-effects and successor-state closure — that are not already equivalent to the SOOS family when considered as a system.

### 3.3 FERZ / Permit Receipts / NCS / CVA — strongest action-boundary pressure

These sources strongly narrow any novelty claim around deterministic execution-time authorization.

Matawaka should treat its action boundary as an important implementation/reuse surface, not as the principal research-origin claim.

### 3.4 C2PA / CAWG — strongest provenance/identity/consent separation pressure

The C2PA/CAWG ecosystem already demonstrates that provenance, identity, endorsement/consent, repository evidence and related assertions are different evidence classes.

Matawaka's possible contribution is not discovering those distinctions, but preserving non-substitutability when those evidence classes are composed with decision and action semantics.

### 3.5 Decision-trace literature — strongest decision-evidence pressure

BAXDT, Decision Event Schema and Auditable LLM Autonomy already preserve structured decision-time evidence, traces and outcomes.

PoAI therefore cannot be positioned as the invention of decision provenance or the question "what information existed when this decision happened?".

The narrower PoAI question is whether a system can explicitly represent heterogeneous intelligence resources as distinct `available`, `considered`, and authority-independent objects rather than only storing consumed inputs or reconstructing a trace after the decision.

## 4. Candidate contribution A — Semantic Non-Escalation under Heterogeneous Evidence Composition

Provisional name:

**Semantic Non-Escalation under Heterogeneous Evidence Composition (SNE-HEC)**

Candidate principle:

> A valid evidence object may establish only semantics admitted by its own type and explicit transition contract. Composition with other valid evidence objects must not silently promote it into a stronger or orthogonal claim.

This is not adequately modeled as a single scalar confidence or trust order. The semantic classes are partially ordered or orthogonal.

Examples:

```text
provenance != identity
identity != authority
availability != consideration
consideration != intent
intent != authority
authority != responsibility acceptance
coordination != execution permission
permit != attempted action
attempt != confirmed external effect
observed outcome != causal proof
integrity != truth
```

The candidate research contribution is not that each individual inequality is new. Many are not. The candidate is a reusable composition discipline that prevents invalid semantic strengthening across the entire graph.

### Falsifiable proposition SNE-1 — Type containment

For every receipt type `T`, there exists an explicit semantic capability set `Cap(T)`.

A conforming receipt `R:T` cannot assert a positive semantic claim outside `Cap(T)`.

A counterexample in which a conforming receipt legitimately establishes an unlisted semantic class falsifies the proposed type-containment formulation.

### Falsifiable proposition SNE-2 — Composition non-escalation

Given individually valid receipts `R1..Rn`, their presence alone cannot establish semantic claim `q` unless:

1. at least one receipt already establishes `q`; or
2. an explicit typed transition `tau` accepts the required receipts as exact inputs, revalidates its preconditions, and is normatively permitted to emit `q`.

Therefore:

```text
valid(R1) + ... + valid(Rn)
  !=
permission to infer arbitrary stronger q
```

A predecessor architecture that already enforces the same generalized rule over an equivalent semantic domain would materially weaken this novelty candidate.

### Falsifiable proposition SNE-3 — No implicit semantic laundering

Adapters, version translation, aggregation, persistence, copying, rendering and re-encoding cannot increase semantic standing by themselves.

Examples:

```text
stored != supported
translated != re-observed
rendered != verified
aggregated != authorized
copied != independently corroborated
```

## 5. Candidate contribution B — Explicit machine-readable non-effects

The UU-AAP common receipt model requires not only positive assertions but explicit semantic non-effects where confusion is materially possible.

Candidate form:

```text
Receipt R = {
  inputs,
  assertions,
  non_effects,
  frontier,
  provenance
}
```

The important claim is not that negative statements have never existed. External protocols frequently contain prose limitations and some typed negative states.

The narrower candidate is:

> `non_effects` are first-class, machine-checkable receipt semantics across the lifecycle and participate in composition safety.

Examples:

```text
intent_declared = true
authority_created = false
responsibility_accepted = false
action_performed = false
```

### Falsifiable proposition NE-1 — Contradiction closure

If a receipt or aggregate tries to assert a claim explicitly forbidden by a bound predecessor `non_effect`, validation fails unless a separately defined successor transition explicitly supersedes that historical boundary without rewriting the predecessor.

### Falsifiable proposition NE-2 — Prose is not equivalent by default

If moving a limitation from machine-readable `non_effects` to non-normative prose permits an otherwise invalid composition to pass automated validation, then machine-readable non-effects provide a distinct enforcement property.

This must be tested rather than assumed.

## 6. Candidate contribution C — Available Intelligence != Considered Intelligence != Authority

PoAI's strongest candidate is narrower than "decision evidence".

A decision may have heterogeneous intelligence resources:

```text
human judgment
AI system
forecasting model
dataset
document
expert group
institutional process
other bounded resource
```

For each resource, PoAI can represent separately:

```text
resource provenance
availability
consideration
evidence status
actor relation
```

while decision-level authority and responsibility remain independent.

Candidate distinctions:

```text
resource existed
  !=
resource was available
  !=
resource was considered
  !=
resource was relied upon
  !=
resource materially influenced the decision
  !=
actor had authority
  !=
actor accepted responsibility
```

The current PoAI public anchor already requires:

```text
resource provenance != consideration != authority != responsibility
epistemic advantage != authority
```

### Falsifiable proposition AI-1 — Available-not-considered representation

The model must represent a relevant resource that was evidenced as available but was not considered without treating it as a consumed decision input.

### Falsifiable proposition AI-2 — Considered-not-authoritative representation

The model must represent a resource that materially informed reasoning without creating decision authority for its producer, holder or associated actor.

### Falsifiable proposition AI-3 — Epistemic advantage does not grant authority

More/better available intelligence cannot by itself satisfy an authority transition.

### Unresolved boundary

`considered` and `materially influenced` may need to remain separate. The current audit does not assume they are equivalent.

## 7. Candidate contribution D — End-to-end typed semantic continuity

The public Minimal Stable Core defines:

```text
State / Evidence
  -> Availability
  -> Intent
  -> Authority / Responsibility
  -> Coordination
  -> Action Gate
  -> Outcome / Provenance / Successor State
```

The candidate claim is not that every component is individually new. They are not.

The candidate is the exact composition property:

> One provider-neutral protocol carries independently typed semantics across the complete chain while prohibiting implicit transitions and preserving predecessor meaning.

### Required differentiation test

For each predecessor family, ask whether it contains an equivalent independent boundary for:

1. state/evidence anchoring;
2. resource/capability availability;
3. intent;
4. authority;
5. responsibility acceptance;
6. cross-context coordination;
7. pre-effect action permission;
8. action attempt/effect evidence;
9. outcome;
10. successor state/frontier;
11. explicit machine non-effects;
12. historical non-reinterpretation.

If an earlier public architecture materially provides the same set with equivalent transition safety, this candidate must be downgraded.

## 8. Candidate contribution E — Cross-domain authorship-to-action semantics

The bounded landscape contains substantial prior work in two largely separate clusters:

```text
human-AI authorship / disclosure / accountability
```

and

```text
autonomous-agent authorization / execution / audit
```

Matawaka/UU-AAP attempts to use one semantic discipline across both.

The candidate contribution is not replacement or subsumption of either cluster. It is reusable cross-domain semantic continuity:

```text
same evidence != truth boundary
same availability != intent boundary
same intent != authority boundary
same permit != action boundary
same outcome != causality boundary
```

applied whether the external effect is publication authorship, a GitHub merge, a tool call, a model invocation, a display permit, or another bounded action.

### Falsifiable proposition CD-1 — Shared invariant, independent domains

At least two genuinely independent domains must use the same semantic primitive/validator directly rather than merely exhibit similar prose.

Without direct reusable demand, the cross-domain claim remains architectural aspiration rather than demonstrated contribution.

## 9. Historical non-reinterpretation as a cross-cutting property

Matawaka repeatedly preserves:

```text
new evidence != historical rewrite
translation != re-observation
successor authority != predecessor authority
```

This property is relevant to SNE-HEC because otherwise later evidence can silently strengthen historical receipts.

It is not currently asserted as a separate novelty candidate; it should be evaluated as a composition constraint of the broader semantic non-escalation thesis.

## 10. Research program implied by this audit

The next scientific question should not be "Can we build another agent authorization gateway?"

That question is already crowded.

The stronger research question is:

> Can heterogeneous evidence from human-AI and agentic systems be composed without semantic escalation, while still allowing explicit evidence-backed transitions to stronger claims when their independent prerequisites are satisfied?

A useful paper/evaluation can compare:

- naive evidence aggregation;
- type-separated evidence without machine non-effects;
- typed evidence + machine non-effects;
- typed evidence + explicit transition gates + non-effects.

Candidate hostile cases should include:

1. valid identity + valid intent -> authority falsely inferred;
2. valid provenance + valid signature -> truth falsely inferred;
3. resource exists + actor can access it -> consideration falsely inferred;
4. considered evidence + actor association -> responsibility falsely inferred;
5. human review + readiness -> execution permission falsely inferred;
6. permit + dispatched tool call -> confirmed effect falsely inferred;
7. repeated observation -> continuous availability falsely inferred;
8. successor evidence -> historical predecessor semantics silently upgraded;
9. two valid but differently scoped receipts -> aggregate scope silently broadened;
10. copied evidence -> independent corroboration falsely inferred.

The value of SNE-HEC should be measured by whether the typed system rejects these invalid promotions while still admitting legitimate explicit transitions.

## 11. Current bounded conclusion

As of 2026-09-07:

```text
AI disclosure                         -> crowded
provenance != permission              -> crowded
pre-action agent authorization        -> crowded
delegation / scope narrowing          -> crowded
execution receipts                    -> crowded
transparency / non-equivocation       -> crowded
decision-time evidence traces         -> crowded
heterogeneous authorization evidence  -> materially overlapped

semantic non-escalation               -> NOVELTY_CANDIDATE
machine-readable non-effects          -> NOVELTY_CANDIDATE
available != considered != authority  -> NOVELTY_CANDIDATE
seven-layer typed continuity          -> NOVELTY_CANDIDATE
cross-domain authorship-to-action     -> NOVELTY_CANDIDATE
```

`NOVELTY_CANDIDATE` means only that the exact materialization was not found in this bounded current audit after stronger broad claims were removed.

It does not mean:

```text
world-first
patentably novel
non-obvious
unencumbered
non-infringing
complete prior-art search
scientifically validated
standards consensus
```

The safe next step is formalization plus hostile comparative evaluation, not stronger marketing language.
