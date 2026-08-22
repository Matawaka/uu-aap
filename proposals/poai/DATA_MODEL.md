# Proof of Available Intelligence — Genesis Data Model

**Proposal:** PoAI Genesis Proposal v0.0  
**Status:** Experimental data-model draft  
**Date:** 2026-08-22  
**Schema status:** No normative JSON Schema is defined in v0.0

This document defines the first machine-readable shape proposed for **Proof of Available Intelligence (PoAI)** records.

The model is intentionally conservative. It is designed to preserve distinctions among capability, availability, use, consideration, authority, action and outcome without forcing uncertain historical data into false precision.

## 1. Top-level record

A PoAI record SHOULD have the following shape:

```json
{
  "protocol": "PoAI",
  "protocol_version": "0.0",
  "profile": "T",
  "record_id": "urn:poai:record:...",
  "subject": {},
  "decision_boundary": {},
  "future_target": null,
  "actors": [],
  "intelligence_resources": [],
  "availability": [],
  "consideration": [],
  "alternatives": [],
  "authority": [],
  "constraints": [],
  "uncertainty": [],
  "evidence": [],
  "artifact_binding": {},
  "contestability": {},
  "outcome": {},
  "links": {},
  "versioning": {}
}
```

Genesis v0.0 uses `MUST`, `SHOULD` and `MAY` as design language, but this proposal is not yet part of normative UU-AAP conformance.

## 2. `protocol`

MUST equal:

```json
"PoAI"
```

## 3. `protocol_version`

For this proposal:

```json
"0.0"
```

## 4. `profile`

Tentative values:

- `D` — Declared;
- `T` — Traceable;
- `V` — Verifiable;
- `R` — Reviewed.

The profile describes evidence strength, not intelligence quality or truth.

## 5. `record_id`

A stable identifier for this PoAI record.

Recommended form:

```text
urn:poai:record:<project>:<decision>:<version>
```

The identifier scheme is provisional in v0.0.

## 6. `subject`

Identifies the thing whose available intelligence is being described.

Recommended fields:

```json
{
  "type": "decision",
  "id": "decision:example",
  "label": "Human-readable label",
  "description": "What was being decided"
}
```

Tentative `type` values:

- `decision`;
- `claim`;
- `action`;
- `artifact`;
- `future_event`;
- `other`.

Genesis examples SHOULD prefer `decision` because the initial model is decision-centered.

## 7. `decision_boundary`

Defines the temporal frame within which intelligence can count as available to the original decision.

Recommended fields:

```json
{
  "opened_at": null,
  "closed_at": "2026-08-08",
  "knowledge_cutoff": "2026-08-08",
  "precision": "date_only",
  "timezone": null,
  "status": "historical_reconstruction",
  "notes": "..."
}
```

### 7.1 Precision

Tentative values:

- `instant`;
- `minute`;
- `hour`;
- `date_only`;
- `month_only`;
- `approximate`;
- `unknown`.

Unknown timestamps MUST remain `null` rather than be invented.

### 7.2 Status

Tentative values:

- `live_record`;
- `historical_reconstruction`;
- `mixed`.

## 8. `future_target`

Optional object describing a future event that is materially represented before realization.

If not applicable, use `null`.

Example:

```json
{
  "future_target_id": "future:shipment-arrival:123",
  "label": "Expected shipment arrival",
  "observation_window": {
    "starts_at": "2026-09-01",
    "ends_at": "2026-09-03"
  },
  "epistemic_status": "probable",
  "probability": null,
  "notes": "No scalar probability is required by PoAI."
}
```

PoAI MUST NOT require a probability number merely to make a Future Target conformant.

## 9. `actors`

Actors participate in availability, consideration, authority, review or action.

Example:

```json
{
  "actor_id": "human:matawaka",
  "actor_type": "human",
  "name": "Matawaka",
  "identifier": "https://github.com/Matawaka"
}
```

Tentative actor types:

- `human`;
- `organization`;
- `ai_system`;
- `automated_system`;
- `reviewer`;
- `other`.

Recording an AI system as an actor is technical participation metadata and does not imply moral or legal personhood.

## 10. `intelligence_resources`

An Intelligence Resource is anything capable of contributing relevant cognition, evidence, analysis, comparison or forecasting to the subject.

Example:

```json
{
  "resource_id": "resource:chatgpt-workflow",
  "resource_type": "ai_system",
  "label": "OpenAI ChatGPT-assisted workflow",
  "provider": "OpenAI",
  "version": null,
  "capability_claims": [
    "concept_generation",
    "comparison",
    "drafting",
    "critique"
  ],
  "identity_status": "partially_known",
  "notes": "Exact historical model continuity was not preserved."
}
```

Tentative resource types:

- `human_judgment`;
- `ai_system`;
- `expert_group`;
- `document`;
- `dataset`;
- `retrieval_service`;
- `forecasting_model`;
- `simulation`;
- `institutional_process`;
- `other`.

## 11. `availability`

Each entry represents an Availability Claim connecting one resource to the subject.

Example:

```json
{
  "availability_id": "availability:chatgpt-workflow",
  "resource_id": "resource:chatgpt-workflow",
  "subject_id": "decision:example",
  "dimensions": {
    "identity": "partial",
    "discoverability": "available",
    "reachability": "available",
    "authorization": "available",
    "temporal_fit": "available",
    "context_sufficiency": "partial",
    "execution_capability": "available",
    "delivery": "available"
  },
  "overall_status": "available",
  "evidence_class": "E0",
  "evidence_refs": [],
  "notes": "..."
}
```

### 11.1 Dimension values

Recommended generic values:

- `available`;
- `unavailable`;
- `partial`;
- `unknown`;
- `not_applicable`.

Specific implementations MAY introduce additional values but SHOULD preserve crosswalks to this minimum vocabulary.

### 11.2 Overall status

Tentative values:

- `available`;
- `partially_available`;
- `unavailable`;
- `unknown`.

`overall_status` MUST NOT be treated as a universal intelligence score. It is a categorical summary of the availability relation.

## 12. Availability vector

Conceptually, PoAI treats availability as a vector:

```text
A(I,D,T) = {
  identity,
  discoverability,
  reachability,
  authorization,
  temporal_fit,
  context_sufficiency,
  execution_capability,
  delivery,
  evidence_strength
}
```

Implementations MUST preserve dimensions separately even if they also display a categorical summary.

## 13. `consideration`

Records whether a resource or output entered the actual decision process.

Example:

```json
{
  "consideration_id": "consideration:chatgpt-workflow",
  "resource_id": "resource:chatgpt-workflow",
  "status": "relied_upon",
  "summary": "AI outputs were iteratively compared, retained, rejected and reframed under human direction.",
  "evidence_class": "E0",
  "evidence_refs": []
}
```

Tentative statuses:

- `not_invoked`;
- `invoked`;
- `output_received`;
- `considered`;
- `relied_upon`;
- `rejected`;
- `not_used`;
- `unknown`.

Availability MUST remain distinct from consideration status.

## 14. `alternatives`

Represents material alternatives available before the Decision Event closed.

Example:

```json
{
  "alternative_id": "alternative:delegate-authority-to-ai",
  "label": "Delegate governing authority to AI output",
  "availability_status": "available",
  "consideration_status": "rejected",
  "reason": "The project retained human governing authority over final selection.",
  "epistemic_status": "asserted",
  "evidence_refs": []
}
```

Historical examples SHOULD avoid inventing alternatives that are not supported by evidence.

## 15. `authority`

Maps actors to powers relevant to the decision.

Example:

```json
{
  "actor_id": "human:matawaka",
  "scopes": [
    "observe",
    "request_analysis",
    "recommend",
    "decide",
    "approve"
  ],
  "status": "accepted",
  "notes": "Final governing authority remained human."
}
```

Recommended scopes:

- `observe`;
- `request_analysis`;
- `recommend`;
- `decide`;
- `approve`;
- `block`;
- `execute`;
- `review`;
- `appeal`.

PoAI MUST NOT infer an authority scope merely because an actor generated information.

## 16. `constraints`

Describes factors limiting availability or action.

Example:

```json
{
  "constraint_id": "constraint:model-version-history",
  "type": "missing_metadata",
  "applies_to": ["resource:chatgpt-workflow"],
  "effect": "Exact historical model/version continuity cannot be reconstructed.",
  "status": "active_at_reconstruction"
}
```

Recommended types:

- `authorization`;
- `privacy`;
- `legal`;
- `cost`;
- `latency`;
- `technical_failure`;
- `missing_context`;
- `missing_metadata`;
- `policy`;
- `security`;
- `capacity`;
- `operator_choice`;
- `unknown`.

## 17. `uncertainty`

Stores material uncertainty explicitly.

Example:

```json
{
  "uncertainty_id": "uncertainty:model-version",
  "target": "resource:chatgpt-workflow",
  "status": "unknown",
  "statement": "Exact model/version continuity is not known for every historical session."
}
```

Recommended statuses:

- `asserted`;
- `probable`;
- `provisional`;
- `speculative`;
- `disputed`;
- `unknown`;
- `not_verified`;
- `unavailable`.

## 18. `evidence`

Genesis v0.0 reuses UU-AAP-style evidence classes:

- `E0` — declaration;
- `E1` — artifact;
- `E2` — hash-bound;
- `E3` — signed;
- `E4` — independent third-party attestation.

Example:

```json
{
  "evidence_id": "evidence:uu-aap-pilot-manifest",
  "class": "E1",
  "type": "public_artifact",
  "location": "../../../pilots/vibe-coding-reality/manifest.json",
  "availability": "public",
  "notes": "Existing UU-AAP/T provenance record."
}
```

Evidence class MUST NOT imply factual truth.

## 19. `artifact_binding`

Optional cryptographic or standards-based binding.

Example:

```json
{
  "status": "not_bound",
  "sha256": null,
  "signature": null,
  "c2pa": null,
  "notes": "Profile T does not claim PoAI/V binding."
}
```

Profile V is expected to require stronger binding in a future specification.

## 20. `contestability`

Recommended fields:

```json
{
  "channel_available": true,
  "channel": "https://github.com/Matawaka/uu-aap/issues",
  "open_disputes": 0,
  "appeal_available": false,
  "notes": "Genesis proposal uses repository discussion mechanisms."
}
```

A dispute SHOULD be linked rather than used to overwrite the challenged record.

## 21. `outcome`

For completed or future-related decisions, outcome state SHOULD remain separate from the original availability state.

Recommended structure:

```json
{
  "status": "not_applicable",
  "observed_at": null,
  "intervention": null,
  "successor_record": null,
  "notes": null
}
```

For Future Targets, tentative statuses include:

- `not_yet_observable`;
- `realized`;
- `not_realized_without_intervention`;
- `not_realized_after_intervention`;
- `indeterminate`;
- `not_applicable`.

## 22. `links`

Connects PoAI to adjacent provenance systems without merging their semantics.

Example:

```json
{
  "uu_aap_manifest": "../../../pilots/vibe-coding-reality/manifest.json",
  "related_decisions": ["decision:ai-as-augmentation"],
  "external": []
}
```

A link to UU-AAP MUST NOT imply that PoAI and UU-AAP have identical conformance status.

## 23. `versioning`

Recommended fields:

```json
{
  "record_version": 1,
  "previous_record": null,
  "successor_record": null,
  "change_summary": "Initial PoAI Genesis example."
}
```

Corrections SHOULD create successor records rather than silently mutate already published evidence where a durable publication mechanism is in use.

## 24. Minimum invariants

A future PoAI validator SHOULD enforce at least these invariants:

1. `protocol` equals `PoAI`.
2. Every Availability Claim references an existing Intelligence Resource.
3. Every Consideration record references an existing Intelligence Resource or identified output.
4. Availability and consideration are separate fields.
5. Authority is explicit and is not inferred from generation.
6. Unknown historical values may be `null` or `unknown`.
7. `knowledge_cutoff` MUST NOT be later than a known `closed_at` unless an explanatory status explicitly permits post-decision reconstruction metadata.
8. Future Target state MUST remain separate from Outcome state.
9. A `not_realized_after_intervention` outcome SHOULD identify the intervention where evidence exists.
10. Evidence strength MUST remain distinct from epistemic status.
11. No protocol-defined scalar intelligence or trust score is permitted.

## 25. Historical reconstruction rule

PoAI is expected to support both live instrumentation and reconstruction of older decisions.

For historical reconstruction:

- exact timestamps MUST NOT be fabricated;
- missing model versions MUST remain unknown;
- private evidence MAY remain private;
- evidence limitations SHOULD be explicit;
- categorical statements SHOULD not exceed the supporting evidence.

This rule is central to the first **«Вайбкодинг реальности»** example.

## 26. Interoperability notes

Future mappings MAY represent:

- PoAI actors/resources/activities using W3C PROV-compatible concepts;
- signed authority or reviewer claims using Verifiable Credentials or equivalent mechanisms;
- artifact bindings through C2PA where appropriate;
- signed PoAI statements in append-only transparency systems;
- digests and ordinary digital signatures for minimal implementations.

Genesis v0.0 deliberately specifies semantics before selecting a mandatory cryptographic transport.

## 27. Next data-model steps

Before PoAI can claim a normative machine-readable specification, the project should add:

1. `schema/poai-record.schema.json`;
2. positive and negative test vectors;
3. at least one non-authorship pilot;
4. a dedicated threat-model document;
5. explicit successor/dispute object schemas;
6. interoperability mappings;
7. privacy review of context-sufficiency evidence;
8. a decision on whether PoAI remains under UU-AAP proposals or becomes a standalone repository.
