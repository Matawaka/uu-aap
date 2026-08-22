# PoAI Successor Proposal Artifact — experimental Level 3.1j

Status: research-only successor extension after the frozen `poai-genesis-v0.0.1` checkpoint.

## Purpose

A later outcome observation may justify creating a successor PoAI decision record. The proposal to do so is not itself the successor record and must not silently rewrite the original Decision Boundary, Knowledge Cutoff, or decision-time Future Target state.

Core invariants:

`outcome observation != successor proposal != successor record != canonical successor`

`later evidence != earlier knowledge`

`proposal readiness cues != authority to publish successor`

## Why a separate artifact

The Genesis synthetic Future Target example already demonstrates append-only successor semantics: record version 2 preserves the original decision-time state and adds a later observed outcome. Level 3.1i adds separate Observed Outcome Sidecars. This extension introduces the missing provenance step between those two layers: a proposal stating which later observations support a candidate successor and what must remain unchanged.

## Experimental machine shape

`PoAISuccessorProposalSidecar` v0.0.1-experimental contains:

- proposal id and creation time;
- source decision record id/version and validation state;
- proposed successor decision record id/version;
- one or more Outcome Observation IDs;
- optional Future Target id;
- proposed Genesis outcome status and optional observed time;
- intervention provenance and separate causal status;
- contradiction state and optional conflicting Outcome Observation IDs;
- self-declared proposer with authority intentionally left `unknown`;
- explicit preservation requirements;
- non-scalar review cues;
- explicit negative claims for canonicalization, truth, causal proof, authority, responsibility and legal effect.

## Preservation requirements

A materialized successor candidate derived from this proposal must preserve:

- the original Decision Boundary;
- the original Knowledge Cutoff;
- the decision-time Future Target epistemic status.

Outcome information belongs to the successor layer and must not be injected into the earlier decision horizon.

## Readiness without scoring

The proposal may expose discrete cues such as:

- source record validated;
- outcome observations present;
- proposed successor differs from source;
- proposed record version increments the source;
- proposed observed time present or absent;
- intervention provenance present or absent;
- contradictions `none_known`, `present`, or `unknown`.

These are not combined into a percentage or readiness score. No cue grants authority to publish a successor.

## Contradictory observations

Multiple outcome observations may coexist. If contradictions are known, the proposal records them explicitly instead of selecting a winner by overwrite. A future governance or verification layer may define stronger rules for adjudicating conflicting observations, but Level 3.1j does not.

## Non-goals

This artifact does not:

- implement PoAI/V;
- create a Genesis PoAI record;
- establish a successor automatically;
- establish a canonical outcome;
- certify truth or causal proof;
- determine proposer authority;
- determine responsibility or legal effect;
- use chain-of-thought;
- use scalar trust/readiness/completeness/intelligence scores.

Tracking: RFC #69, implementation #70, live acceptance #71.
