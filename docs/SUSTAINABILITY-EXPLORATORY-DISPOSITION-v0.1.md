# Sustainability Exploratory Disposition / Selective Adoption v0.1

**Status:** non-normative operational contract  
**Canonical predecessor:** `24658379e959c709c4fcefb6d37393969c88b069`  
**Kernel relation:** operationalizes Sustainability Kernel K6-K8 and reinforces K1/K2/K3.

## Purpose

This contract governs how exploratory, parallel, superseded, or otherwise non-main work may be dispositioned without creating pressure on the active main line.

It separates **historical existence**, **review**, **selection**, **integration preparation**, and **authority**.

`exploratory existence != merge entitlement`

`useful artifact != whole branch required`

`selective adoption != whole-branch merge`

`rejection != provenance erasure`

`archive != hidden execution queue`

## Disposition modes

A reviewed source may receive one of five bounded dispositions:

- `selective-adoption` — specific content-addressed artifacts may be prepared for integration;
- `preserve-isolated` — retain the source outside main without integration effect;
- `archive` — preserve as historical material only;
- `reject` — reject integration while retaining provenance and reason;
- `supersede` — record that a later artifact/state replaces practical reliance while preserving the historical source.

Only `selective-adoption` may produce an integration-preparation effect, and that effect is limited to exact selected artifacts.

## Selective adoption

Selective adoption requires:

1. a fresh overlap review against the current main frontier;
2. the exact source ref and source head SHA;
3. a non-empty list of selected artifacts;
4. an exact source blob SHA for every selected artifact;
5. an intended target path for every selected artifact;
6. explicit preservation of source provenance and disposition reason.

The strongest effect is:

`prepare-bounded-adoption-only`

This does not merge, commit, push, publish, execute, activate KONTUR, or create authority.

A whole branch is never made entitled to integration by age, effort, novelty, commit count, branch distance, historical priority, or earlier creation.

## Non-adoption modes

For `preserve-isolated`, `archive`, `reject`, and `supersede`, the selected artifact list MUST be empty.

Their safe effects are respectively:

- `preserve-isolated-only`;
- `archive-only`;
- `preserve-provenance-only`;
- `preserve-provenance-only`.

No non-adoption mode may become a deferred integration queue.

## Provenance preservation

Every disposition preserves:

- source ref;
- source head SHA;
- disposition reason;
- disagreement/history context where present;
- the fact that disposition occurred.

`supersession != historical deletion`

`rejection != source disappearance`

The contract does not claim that preserved provenance is complete, globally unique, or independently verified beyond supplied evidence.

## Freshness

Selective adoption requires `fresh_overlap_review = true` and an exact current-main SHA.

A later main change may stale the overlap review before actual integration. Therefore:

`selective adoption prepared != integration still safe later`

A later integration mechanism must re-check current state as needed.

## Relationship to existing sustainability contracts

Pause / Degradation v0.1 (#279) bounds interruption entry.

Recovery / Resume v0.1 (#276) re-establishes a fresh working frontier.

Capability Ceiling v0.1 (#278) determines whether preparation capability is within the current envelope.

This contract governs disposition of exploratory material after those boundaries are satisfied where applicable.

None of these contracts authorizes external execution.

## Relationship to CHSP

CHSP remains the separate human-governed external transition architecture.

This contract cannot:

- create or renew CHSP authorization;
- invoke the CHSP executor;
- transfer stewardship;
- establish external control;
- publish canonical origin.

`selective adoption != CHSP execution`

## Relationship to KONTUR

This contract does not activate KONTUR and does not grant, widen, reinterpret, restore, or bypass any KONTUR permission.

Exploratory artifacts cannot acquire authority merely because KONTUR or another component can technically read them.

## Required invariants

1. `whole_branch_merge_entitled = false`
2. `exploratory_age_creates_entitlement = false`
3. `effort_creates_entitlement = false`
4. `historical_priority_creates_entitlement = false`
5. `selected_artifacts_only = true` for selective adoption
6. `source_provenance_preserved = true`
7. `disposition_reason_preserved = true`
8. `archive_is_execution_queue = false`
9. `rejection_erases_history = false`
10. `authority_effect = none`
11. `external_execution_authorized = false`
12. `canonicality_changed = false`

## Non-effects

This contract does not:

- merge branches;
- create commits on main;
- push refs;
- change repository permissions;
- add or remove collaborators;
- invoke provider mutation APIs;
- activate KONTUR;
- mutate tags/releases/checkpoints/canonical origin;
- turn archival state into an execution queue;
- make main depend on exploratory work.

## Compact causal chain

`exploratory source -> fresh overlap review when adoption is considered -> explicit disposition -> exact selective artifacts OR preserved isolation/archive/rejection/supersession -> later human integration decision remains separate`

The active main line remains free to continue regardless of the exploratory source's age, size, effort, or historical priority.
