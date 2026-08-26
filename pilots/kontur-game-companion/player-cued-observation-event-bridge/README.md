# KONTUR Game Companion — Player-Cued Completed-Observation Context Bridge v0.1

Status: **synthetic / non-executing / post-session / not runtime-admitted**.

Origin frontier: 44e7eb4a68189ed096f4642973d5f57b138ca142 (merged PR #505).

This optional adapter explores one narrow interaction seam: how a player-selected
post-session observation category could become a deterministic **event candidate**
without inferring attention, generating an answer, or gaining permission to send.

It does not establish that a cue came from a human. It does not read a live runtime
state. It has no replay registry. Its event is not admitted to the current dialogue
pipeline. Those missing properties are machine-readable boundaries, not assumptions.

## Placement

    completed read-only sidecar-ingest receipt
      + caller-supplied synthetic state anchor
      + caller-supplied structured cue
      -> this pure bridge
      -> synthetic PLAYER event candidate (runtime_eligible=false)
      -> candidate-envelope shape-compatibility probe only
      -> authenticated input/state admission still missing

The bridge is not added to the frozen seven-layer dependency contract. It creates no
reverse Stable Core dependency and performs no model, materializer, policy-gate,
transport, response, or gameplay execution.

## Honest provenance boundary

The bridge validates the exact successful semantics and internal digest of the merged
completed-sidecar receipt, including its policy, session-id grammar, bounded files,
runtime-connectedness label, next decision boundary, sanitized count vocabulary, and
non-effects. The upstream receipt digest is unkeyed, so:

Receipt Integrity Check != Source Authenticity

The supplied state is bound to that receipt and to a source-derived opaque scope:

    game:kontur:completed-observation:<evidence-prefix>

The cue is bound to the same state digest, scope, evidence reference, and turn. This
proves consistency among supplied objects, but not that the state is the current
runtime state or that the cue came from a person:

- Supplied State Frontier != Runtime State Authentication
- Structured Cue != Authenticated Human Cue
- Digest Binding != Human Identity
- Deterministic Replay != Consume-Once Protection

Accordingly every created event candidate has:

- cue_authentication_proven = false;
- input_adapter_verified = false;
- cue_replay_protection_proven = false;
- runtime_state_authentication_proven = false;
- downstream_admission_proven = false;
- runtime_eligible = false.

## Gameplay-attention boundary

The bridge exposes at most three fixed, unranked context categories:

1. LIFECYCLE_COUNTS — matcher counts only, without order, cause, success, or state;
2. SEVERITY_COUNTS — bracketed severity-pattern line counts only;
3. TERM_COUNTS — case-insensitive substring line counts only.

The output discloses no count values. An overview keeps the fixed taxonomy order.
A selected category is used only when it has a non-zero sanitized signal; the bridge
does not substitute another topic. Candidate identity and digest bind the source
receipt, evidence, summary, cue, state, scope, turn, and category.

This yields:

- Attention to Gameplay != Attention Tracking;
- Count Magnitude != Player Interest;
- Observed Term Count != Player Intent;
- Structured Selected Focus > System-Predicted Interest;
- Current Context != Durable Preference;
- Sanitized Count != Semantic Game Fact.

A substring match for error is not a severity error. A zero bracketed severity count
does not prove that no error occurred. Neither can support mood, skill, frustration,
engagement, preference, or psychological inference.

## Supported structured cues

The deliberately small vocabulary is:

- no cue;
- request a post-session overview;
- select lifecycle, severity, or term-count context;
- ask about one selected category, without retaining question text;
- pause or resume;
- decline or redirect.

Hint, partial-solution, and solution request classes are intentionally absent. The
existing synthetic downstream contains fixture-specific answer material unrelated to
this observation evidence, so this bridge cannot safely claim knowledge-aware help.
Every accepted conversational cue remains CONVERSATION with at most a COMMENT shape
request in the compatibility probe.

Turn and phase rules are deterministic:

- only turn == state.last_turn + 1 may create a candidate;
- a turn at or behind the supplied last turn, or beyond the next turn, waits;
- replaying the same cue against the same unchanged supplied state deterministically
  recreates the same runtime-ineligible candidate because no consume-once registry exists;
- RESUME requires PAUSED;
- PAUSE requires ACTIVE or RESUMED_NEUTRAL;
- content is blocked while paused;
- resume restores no topic, focus, help request, or durable authority.

DECLINE and REDIRECT create a suppression receipt for **this evaluation only** and no
event candidate. No successor state is written, so the receipt does not claim durable
suppression.

## Downstream compatibility is not admission

The validator projects the supplied state and passes each created candidate unchanged
to the existing candidate-envelope/generator.py. This proves only deterministic shape
compatibility. That generator does not validate this bridge receipt and can accept a
detached synthetic player event; the validator records that limitation by requiring:

    candidate_envelope_admission_proven = false

The bridge field source_state_anchor_digest binds the full synthetic anchor. The
existing envelope field source_state_digest hashes its smaller compatibility
projection. These are intentionally different representations; no digest equality or
provenance continuity across that projection is claimed.

PAUSE and RESUME retain names recognized by the older synthetic pipeline so their
shape can be probed. Those older gates do not inspect this bridge's authentication,
admission, or runtime-eligibility flags and may materialize their own fixture text if
called directly. Therefore this package never forwards either candidate beyond the
compatibility probe.

The probe still produces no response text or admissibility and reports runtime
connectedness as NOT_PROVEN. No policy evaluator or response materializer is called.

## Validation

Run:

    python pilots/kontur-game-companion/player-cued-observation-event-bridge/validate.py

The deterministic validator:

1. requires the exact predecessor path-to-digest manifest and fails closed if Git blob
   evidence is unavailable;
2. constructs repository-owned synthetic receipts through the merged ingest;
3. checks exact source, state, cue, scope, turn, and phase bindings;
4. proves fixed unranked category selection and count-semantic separation;
5. probes candidate-envelope compatibility without claiming admission;
6. demonstrates that replay remains deterministic but never runtime-eligible;
7. re-signs and rejects unsafe source, state, cue, candidate, event, authority,
   profiling, response, send, action, successor, and scope mutations.

The bridge module itself imports only hashlib, json, and re. It performs no file,
clock, network, process, game, audio, screen, input, or persistence operation.

The fixture uses only repository-owned synthetic sidecar data. CI accesses no real
game, account, player identifier, observation session, or private path.

## Next human boundary

HUMAN_BOUNDED_REACTIVE_DIALOGUE_SANDBOX_DECISION_REQUIRED

This boundary appears only when a synthetic event candidate is created. Wait, blocked,
decline, redirect, and unsupported-category outcomes do not manufacture that decision.

The future decision is whether to design a separate local sandbox with authenticated
input, authenticated state-frontier admission, replay handling, evidence-aware response
policy, and explicit evaluation receipts. It is not authorization for a model, network,
transport, message send, gameplay action, ActionPermit, or successor state.

## Non-effects and IP-process isolation

Merging this slice authorizes no live observation, response generation, language-model
invocation, proactive/background messaging, audio or microphone capture, network,
game-process access, game input, autonomous gameplay, profiling, attention tracking,
engagement/retention optimization, total-history capture, cross-game profile, Stable
Core promotion, deployment, release, or external effect.

Copyright, licensing, patent, legal-author-identity, and pseudonym-publication
processes are neither read nor changed by this package.
