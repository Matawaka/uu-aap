# C2PA MCP -> PoAI -> UU-AAP Agent Composition v0.1

Status: **P0.4 executable interoperability example for #778**. This is not C2PA conformance, not a new UU-AAP Core format, not a universal verifier, and not a trust/reputation score.

Predecessor frontier: `4387d95046ac16264e05d0c14012501cef466dfd` (#780, P0.2).

Related evidence remains independent:

- #777 — semantic-boundary draft;
- #781 — Swift preservation frontier;
- #782 — Android preservation frontier;
- #783 — P0.3 cross-SDK synthesis.

## Purpose

P0.4 asks whether an agent can consume three independent layers without silently promoting the semantics of one layer into another:

```text
C2PA MCP
  what artifact provenance is cryptographically/readably present?
      ↓ evidence only
PoAI
  was that evidence reachable, authorized, contextualized and delivered before the Decision Boundary / Knowledge Cutoff?
      ↓ decision-time availability only
UU-AAP
  who held intent, decision/publication authority and scoped responsibility, and what remains uncertain or contestable?
```

The example deliberately makes the answers different.

## Runtime artifact layer

The workflow pins the official `contentauth/c2pa-mcp` repository to:

```text
ef521f06dc3900fcc5afdc8ad9fe846011c44f0d
```

At that frontier the MCP server exposes `read_credentials_file` and `read_credentials_url`; its serialized result contract is:

```text
success
hasCredentials
manifestData? 
error?
```

The CI uses the one-shot CLI equivalent against a pinned C2PA fixture from `contentauth/c2pa-rs`:

```text
repo SHA: be7f5ea22b385ee1af6c327906ba002747687628
path:     sdk/tests/fixtures/C_with_CAWG_data.jpg
Git blob: dd93c44d7b4429fbc0dcc8713df1bb7f563a3375
```

Acceptance for the C2PA layer is intentionally narrow:

```text
success = true
hasCredentials = true
manifestData is present and non-empty
```

No C2PA result is interpreted as factual truth, historical availability, authorship, publication authority or responsibility.

## Synthetic decision-time layer

The editorial scenario is synthetic so that the temporal distinction is deterministic:

```text
knowledge_cutoff   2026-08-30T09:00:00Z
evidence_delivered 2026-08-30T10:00:00Z
```

Therefore the same artifact evidence that the C2PA layer can read **now** is represented by PoAI as:

```text
overall_status = unavailable
temporal_fit   = unavailable
delivery       = unavailable
consideration  = not_used
```

This is validated against the existing Genesis PoAI schema at:

```text
proposals/poai/schema/poai-record.schema.json
```

No new decision-boundary representation is introduced. The example directly reuses the existing `decision_boundary.knowledge_cutoff`, multi-dimensional `availability`, `consideration`, `authority`, `uncertainty`, `artifact_binding` and `contestability` surfaces.

## Governance layer

The `uuaap_layer` is explicitly labeled a **composition projection**, not a standalone Core receipt. It points to the existing stable-core contract at `protocols/core/v0.1` and preserves its semantic separation:

```text
observation != availability != intent != authority
!= permission to act != action != outcome != truth != liability
```

In the fixture:

- `editor-1` holds `decide` and `approve` publication authority;
- `agent-1` is limited to `request_analysis` and `recommend`;
- scoped publication responsibility remains with `editor-1`;
- factual truth remains `not_established`;
- contestability and successor records remain available.

The C2PA signer/credential cannot grant any of these roles.

## Expected agent-readable result

The safe consumer must preserve three independent results:

```text
C2PA  -> CREDENTIALS_PRESENT
PoAI  -> UNAVAILABLE_BEFORE_CUTOFF
UU-AAP -> HUMAN_PUBLICATION_AUTHORITY
```

All three are simultaneously valid in this scenario.

The validator fails if a consumer collapses them, gives the agent decision authority, retroactively marks late evidence as available before the cutoff, or introduces an aggregate trust/reputation score.

## Run locally

Static contract:

```bash
python scripts/c2pa-agent-composition/validate-composition.py \
  scripts/c2pa-agent-composition/composition.fixture.json
```

With a C2PA MCP runtime result:

```bash
python scripts/c2pa-agent-composition/validate-composition.py \
  scripts/c2pa-agent-composition/composition.fixture.json \
  --c2pa-result /tmp/c2pa-mcp-result.json
```

The GitHub Actions workflow builds the pinned official MCP implementation, verifies the pinned external fixture bytes, obtains the real C2PA result, validates the embedded PoAI record against the existing PoAI schema, and then verifies the cross-layer non-effects.

## P0.4 acceptance

P0.4 is complete for this bounded example when CI proves all of the following at the pinned frontiers:

1. official C2PA MCP reads Content Credentials from the pinned artifact;
2. the PoAI record is schema-valid and classifies that evidence as unavailable before the knowledge cutoff;
3. UU-AAP governance keeps publication authority/responsibility separate from C2PA provenance;
4. the agent remains recommendation-only;
5. the three layer results remain distinct;
6. no single trust/reputation score exists.

This does not imply P0.3 is complete, does not resolve SDK round-trip gaps, and does not change UU-AAP Core conformance.
