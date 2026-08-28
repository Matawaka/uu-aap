# FCL <-> PreAction Evidence Contract Reconciliation v0.1

Status: experimental, read-only compatibility profile
Issue: #564
Origin frontier: b4fcda2bfe19670dccd3ed265dcaad04b2f22232

## Purpose

This profile proves the exact boundary between the merged FCL action-gate chain and the reusable provider-neutral PreActionEvidenceBundle contract before any bundle assembly is attempted.

FCL Capability Identity Mapping + Execution Capability Availability + FCL Core ActionPermit chain -> canonical source revalidation -> compatibility matrix -> reconciliation receipt != PreActionEvidenceBundle.

A positive reconciliation means the compatibility result is proven, not that direct bundle assembly is allowed.

## Canonical distinctions

Semantic Compatibility != Receipt Identity
Operation-to-Scope Mapping != Identifier Equality
Normalized Context Shape Valid != Whole Bundle Contract Satisfied
Negative Compatibility Result != Failure To Progress

## Current v0.1 result

The current frontier proves exact operation-to-scope mapping, exact Selection identity, fresh Execution Availability, valid FCL ActionPermit chain and shared predecessor frontier. It also proves that the generic and FCL Core StateReceipt / AvailabilityClaim identities are distinct, FCL receipts do not embed all generic PreAction projections, and direct_preaction_bundle_contract_satisfied is false.

next_safe_action = PARAMETERIZE_PRE_ACTION_FCL_EVIDENCE_BRIDGE

## Non-effects

The reconciliation does not observe live availability, rewrite source receipts, create Core receipts, establish intent or authority, create approval, create or consume an ActionPermit, assemble a PreActionEvidenceBundle, enter authorize/execute, perform an action, interrupt a run, create a successor, mutate runtime state, establish legal effect, certify truth/causality/liability, or include private reasoning.
