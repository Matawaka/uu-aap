# CCRP v0.1

**Status:** Experimental Draft
**Version:** 0.1
**Scope:** concurrent human/agent execution, context ownership, delayed signals, conflict prevention, pause/resume continuity and convergent collaborative state.

## 1. Purpose

CCRP defines how multiple humans, agents, sessions, chats, devices or execution environments may act upon a shared task or resource without silently creating incompatible parallel realities.

The protocol addresses not only the case of two concurrent agents attempting the same work, but also the more subtle case where:

* one valid agent is initiated from the wrong conversation or workspace;
* an old agent continues after a new execution epoch has begun;
* a delayed signal arrives after the visible state has changed;
* two valid operations are individually correct but mutually incompatible;
* a paused task is resumed from stale context;
* different participants observe different intermediate states;
* collaborative edits are valid locally but need deterministic convergence globally.

The central CCRP principle is:

> **Permission to act is not sufficient. An execution must also prove that it belongs to the current task context, current execution epoch and permitted resource scope.**

---

## 2. Core distinction

CCRP separates:

`identity != permission != context != intent != execution ownership != canonical state`

A participant MAY possess valid repository, filesystem, API or application authority and still MUST NOT execute an operation when the operation is not admitted by the active CCRP context.

Therefore:

`can_write(resource) != may_execute(this_intent, this_context, this_epoch)`

---

## 3. Coordination model

CCRP models shared work as a sequence of causally related operations rather than as a sequence of chat messages.

A chat, browser tab or agent session is an interface to the protocol.

It is **not** the authoritative unit of work.

The authoritative unit is a **Work Context**.

Each Work Context MUST have a stable `context_id`.

Example:

```text
urn:ccrp:context:uu-aap:authority-root-v0.1
```

A Work Context binds:

* the intended objective;
* target resources;
* accepted starting state;
* active execution epoch;
* current work owner or owner set;
* permitted operation scope;
* observed predecessor state;
* unresolved conflicts;
* pause/resume state;
* provenance of material operations.

---

## 4. Protocol entities

### 4.1 Actor

An `Actor` is any human, AI agent, service, process or collaborative client capable of proposing or executing an operation.

An actor MUST NOT be assumed to possess execution ownership solely because it possesses technical access.

### 4.2 Session

A `Session` represents one active interaction environment.

Examples include:

* Chat A;
* Chat B;
* a GitHub automation;
* a coding agent;
* a browser session;
* a collaborative editor client.

A single Actor MAY have multiple Sessions.

### 4.3 Work Context

A `WorkContext` identifies the task to which an operation belongs.

At minimum:

```json
{
  "context_id": "...",
  "intent_id": "...",
  "target_scope": [],
  "base_revision": "...",
  "epoch": 1,
  "status": "active"
}
```

### 4.4 Intent

An `Intent` defines what the participant believes it is trying to accomplish.

The Intent SHOULD be deterministically bindable through an `intent_digest`.

Changing the essential objective MUST create a new intent revision.

### 4.5 Work Claim

A `WorkClaim` is a temporary declaration that a Session is actively performing a defined operation set inside a Work Context.

A Work Claim is not permanent ownership.

### 4.6 Lease

A `Lease` gives an Actor temporary execution ownership over a declared scope.

A lease MUST contain:

* `context_id`;
* `actor_id`;
* `session_id`;
* `epoch`;
* `lease_id`;
* operation scope;
* target scope;
* start time;
* expiry condition.

### 4.7 Fencing Token

Every new exclusive execution epoch MUST obtain a monotonically increasing `fencing_token`.

An operation carrying an older fencing token MUST be rejected even if the old participant still believes its lease is valid.

Thus a stale executor cannot become authoritative merely because its stop signal was delayed.

### 4.8 Operation

An `Operation` is an atomic proposed state transition.

Every material operation SHOULD bind:

```text
operation_id
context_id
intent_id
actor_id
session_id
epoch
fencing_token
base_revision
target
operation_type
idempotency_key
causal_predecessors
timestamp_observed
```

Wall-clock ordering alone MUST NOT determine validity.

### 4.9 Canonical State

`CanonicalState` is the currently accepted result of applying admitted operations according to CCRP convergence rules.

Canonicality under CCRP is coordination-relative.

It does not establish factual truth, legal authority or moral correctness.

---

## 5. Context Admission Gate

Before any material operation is executed, the executor MUST perform a **Context Admission** check.

An operation MUST NOT execute unless all required conditions hold:

```text
context exists
AND context is active
AND intent matches
AND target is within scope
AND actor/session is admitted
AND epoch is current
AND fencing token is current
AND base revision is admissible
AND no blocking stay exists
AND no unresolved exclusive conflict exists
```

Failure of any mandatory condition produces:

```text
EXECUTION_NOT_ADMITTED
```

rather than silently continuing with best-effort execution.

This rule specifically prevents an agent initiated from the wrong chat from inheriting a different chat's work merely because the agent is technically capable of performing it.

---

## 6. Context mismatch

A **Context Mismatch** exists when an Actor receives a valid-looking instruction whose execution context does not match the active Work Context.

Examples:

* Chat B requests continuation of work owned by Chat A without explicit handoff;
* an old coding agent receives a repository instruction after ownership moved to another session;
* the intended repository is correct but the objective belongs to another task;
* a valid resume request references an obsolete epoch.

On mismatch, an implementation MUST prefer:

```text
REFUSE / HOLD / REQUEST REBIND
```

over speculative continuation.

Context mismatch MUST NOT automatically be interpreted as user cancellation, error or malicious activity.

It is a coordination state.

---

## 7. Execution epochs

Every exclusive execution lineage has an integer `epoch`.

Example:

```text
epoch 41 -> agent A
epoch 42 -> resumed agent B
epoch 43 -> human takeover
```

A successor epoch invalidates execution authority of earlier epochs for the same exclusive scope.

Historical operations remain preserved.

Therefore:

```text
new epoch invalidates future authority
!=
new epoch rewrites historical provenance
```

This is analogous to authoritative server ticks or generations in distributed systems.

---

## 8. Delayed signals

CCRP MUST tolerate delayed communication.

A delayed signal is not invalid merely because it arrives late.

Its validity is evaluated against:

* its causal predecessor;
* the epoch in which it was produced;
* whether that epoch still authorizes new operations;
* whether the operation is commutative;
* whether another accepted operation superseded its target;
* whether applying it would violate an invariant.

A delayed read-only observation MAY remain valid historically.

A delayed write from a superseded epoch MUST NOT mutate current canonical state.

Thus:

```text
late != false
late != current
historically valid != currently executable
```

---

## 9. Multiplayer-style authoritative state

CCRP adopts an important pattern from networked multiplayer systems:

Clients MAY speculate locally, but a shared state requires an authoritative convergence rule.

Local agent state is therefore treated as:

```text
predicted / provisional
```

until admitted into shared canonical state.

When client prediction and canonical state diverge, reconciliation MUST preserve the operation history rather than pretending that the divergence never existed.

This permits latency without granting delayed clients authority over newer state.

---

## 10. Collaborative-document semantics

Exclusive locking is not appropriate for every operation.

CCRP therefore distinguishes at least three concurrency classes.

### 10.1 Commutative

Operations can coexist and be merged independently.

Examples:

* adding independent annotations;
* adding distinct evidence records;
* adding non-overlapping document elements.

These SHOULD converge without acquiring an exclusive lease.

### 10.2 Mergeable

Operations affect a shared structure but can be deterministically reconciled through operation-based merge semantics.

Examples:

* collaborative text editing;
* structured document editing;
* independent changes to separate fields.

Implementations MAY use CRDT-, OT-, patch-, or event-based convergence mechanisms.

CCRP does not require one particular merge algorithm.

### 10.3 Exclusive

Operations cannot safely coexist.

Examples:

* merging the same PR;
* replacing a canonical manifest;
* publishing one successor under a uniqueness constraint;
* assigning one active execution owner;
* changing a governance anchor.

Exclusive operations MUST use current epoch + fencing semantics.

---

## 11. Conflict

A conflict is not defined merely as simultaneous activity.

A `Conflict` occurs when two otherwise admissible operations cannot both be materialized without changing their meaning or violating an invariant.

Possible outcomes are:

```text
MERGE
SUPERSEDE
REBASE
HOLD
REJECT
HUMAN_RESOLUTION_REQUIRED
```

CCRP MUST NOT resolve semantic conflicts merely by:

* latest timestamp wins;
* fastest agent wins;
* longest-running agent wins;
* highest model capability wins;
* last chat message wins.

---

## 12. Duplicate execution

Every material operation SHOULD carry an `idempotency_key`.

If the same logical request is delivered more than once, the protocol SHOULD recognize subsequent deliveries as duplicates.

Therefore:

```text
same request delivered twice
!=
permission to perform the operation twice
```

This directly addresses accidental double invocation.

---

## 13. Pause

A Work Context MAY enter:

```text
PAUSED
```

A pause prevents new material operations within the paused scope.

It MUST NOT erase:

* provenance;
* active conflict information;
* previous epoch;
* last accepted revision;
* reason for pause.

Pause is therefore a protocol state, not merely absence of agent activity.

---

## 14. Resume

Resume MUST be explicit.

A resume operation MUST bind at least:

```text
context_id
previous_epoch
last_canonical_revision
resume_intent
resuming_actor
resuming_session
```

Successful resume creates a **new epoch** and therefore a new fencing token.

A resumed executor MUST re-read canonical state before performing a material write.

It MUST NOT continue solely from its private pre-pause memory.

Thus:

```text
resume != continue local memory
resume = reacquire context + reconcile + new epoch
```

---

## 15. Handoff

Execution ownership MAY move between Sessions.

A handoff SHOULD explicitly identify:

```text
from_session
to_session
context_id
intent_id
last_revision
scope
handoff_reason
```

The receiving Session MUST independently perform Context Admission.

A message saying “continue” is not by itself sufficient proof of handoff when multiple active contexts could plausibly satisfy the instruction.

---

## 16. Presence versus authority

A participant may advertise presence or intention without holding execution authority.

CCRP distinguishes:

```text
PRESENT
INTERESTED
OBSERVING
CLAIMING
LEASED
EXECUTING
PAUSED
SUPERSEDED
```

Presence information MAY be eventually consistent.

Execution authority MUST use stronger consistency.

This allows Google-Docs-like awareness without forcing every cursor movement through exclusive consensus.

---

## 17. Required invariants

A conforming CCRP implementation MUST preserve the following invariants.

### I1 — No implicit context inheritance

A Session MUST NOT silently inherit another Work Context merely because both can access the same resource.

### I2 — No stale writes

A superseded epoch MUST NOT perform a new material mutation.

### I3 — Historical preservation

Invalidation of future execution authority MUST NOT erase previously admitted operations.

### I4 — Explicit exclusive ownership

Exclusive operations MUST have an unambiguous current execution epoch.

### I5 — Idempotent material actions

Duplicate delivery MUST NOT silently duplicate a non-repeatable effect.

### I6 — Causal evaluation

Delayed operations MUST be evaluated causally, not solely by arrival time.

### I7 — Scope containment

Execution authority MUST NOT expand beyond the scope declared by the active context/lease.

### I8 — Intent containment

Technical permission MUST NOT substitute for intent match.

### I9 — Pause persistence

Pause MUST survive across clients/sessions until explicitly superseded or resumed.

### I10 — Resume reconciliation

A resumed executor MUST reconcile against current canonical state.

### I11 — Observable conflict

A conflict MUST NOT be hidden by arbitrary winner selection when that selection changes semantic meaning.

### I12 — Human recoverability

A human-authorized participant MUST be able to stop execution, inspect ownership and explicitly establish a successor epoch.

---

## 18. Minimal state machine

```text
DECLARED
   |
   v
ADMITTED
   |
   v
CLAIMED
   |
   v
LEASED
   |
   v
EXECUTING
   | \
   |  \--> CONFLICTED
   |
   +-----> PAUSED
   |
   +-----> COMPLETED
   |
   +-----> SUPERSEDED
```

From `PAUSED`, continuation requires:

```text
RECONCILE -> NEW_EPOCH -> LEASED
```

A `SUPERSEDED` executor MUST NOT return directly to `EXECUTING`.

---

## 19. Minimal Work Context representation

```json
{
  "ccrp_version": "0.1",
  "context_id": "urn:ccrp:context:example",
  "intent": {
    "intent_id": "urn:ccrp:intent:example",
    "revision": 1,
    "digest": "sha256:..."
  },
  "target_scope": [
    "github:Matawaka/uu-aap"
  ],
  "base_revision": "git:...",
  "epoch": 7,
  "fencing_token": 7,
  "state": "executing",
  "owner": {
    "actor_id": "...",
    "session_id": "..."
  },
  "lease": {
    "lease_id": "...",
    "scope": [
      "repository.propose"
    ]
  },
  "blocking_conflicts": [],
  "last_canonical_revision": "...",
  "provenance": []
}
```

This representation is illustrative in v0.1 and is not yet a normative JSON Schema.

---

## 20. Relationship to PoAI / UU-AAP

CCRP and PoAI solve different problems.

PoAI may determine:

```text
who/what has policy-relative authority to perform an action
```

CCRP determines:

```text
whether that otherwise-authorized action belongs to the current coordinated execution context
```

Therefore:

```text
PoAI authority established
!=
CCRP execution admitted
```

Conversely:

```text
CCRP context match
!=
PoAI authority established
```

A future integration MAY require both:

```text
authority_verified
AND
context_admitted
AND
current_epoch
AND
scope_contained
```

before materialization.

---

## 21. Assurance boundary

CCRP coordination MUST NOT be interpreted as proof of:

* truth;
* legal authority;
* identity;
* correctness of the requested objective;
* moral correctness;
* causal truth;
* universal canonicality;
* PoAI/V conformance.

CCRP establishes only coordination-relative claims.

For example:

```text
current_execution_owner_established = true
```

does not imply:

```text
owner_is_correct = true
```

---

## 22. Conformance levels

### CCRP/C0 — Context Identification

Stable contexts, intents and target scopes exist.

### CCRP/C1 — Collision Detection

Duplicate and conflicting execution can be detected.

### CCRP/C2 — Execution Fencing

Epochs, leases and fencing prevent stale mutations.

### CCRP/C3 — Convergent Collaboration

Concurrent mergeable operations can deterministically converge.

### CCRP/C4 — Cross-Context Coordination

Multiple sessions, agents and interfaces can perform explicit handoff, pause/resume and context admission.

### CCRP/C5 — Policy-integrated Coordination

Execution admission may consume external authority, governance or materialization policies without conflating them with CCRP context.

v0.1 defines the semantic direction through C5 but does not claim a complete machine implementation.

---

## 23. Required v0.1 negative vectors

A future machine implementation MUST test at least:

1. two agents receive the same non-idempotent action;
2. an old agent writes after its lease is superseded;
3. a new chat attempts to continue an unrelated active task;
4. a delayed operation from the previous epoch arrives after resume;
5. two mergeable edits arrive in opposite orders;
6. two exclusive operations target the same canonical resource;
7. a paused context receives an otherwise valid write;
8. an agent attempts to enlarge its target scope;
9. a duplicate GitHub merge command is delivered twice;
10. the same Actor operates from two Sessions with different contexts;
11. a valid technical authority is presented with the wrong `intent_id`;
12. an executor resumes from private memory without reconciling canonical state.

Every negative vector MUST fail safely without rewriting valid historical provenance.

---

## 24. Central CCRP proposition

CCRP treats coordination as a first-class property of execution.

The protocol therefore replaces:

```text
“the agent can perform the action”
```

with:

```text
“the agent can perform the action,
the action belongs to this context,
the intent matches,
the scope matches,
the execution epoch is current,
the operation is causally admissible,
and concurrent state can safely converge.”
```

This is the minimum semantic boundary required for reliable multi-agent and multi-session work.
