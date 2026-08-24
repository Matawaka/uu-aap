# UU-AAP CI Dependency Hardening Audit v0.1

**Status:** experimental audit artifact  
**Issue:** #381  
**Stacked on:** #379/#380

## Purpose

Record evidence about CI trigger coupling between reusable integration evolution and KONTUR-specific workflows without weakening validation on inference alone.

```text
broad trigger observed != dependency proven
no direct import found != no transitive dependency
CI cost != permission to weaken validation
```

A workflow may be classified `candidate_false_coupling`, `dependency_confirmed`, `safe_to_narrow`, or `insufficient_evidence`. `safe_to_narrow` is valid only when both direct and transitive dependency evidence are complete and no required dependency remains.

## Current conclusion

The inspected KONTUR workflows are **not** approved for trigger narrowing by this artifact. Broad `protocols/integration/**` triggering is recorded as a candidate coupling, but the evidence set is intentionally insufficient to prove that every transitive KONTUR readiness/responsibility path is independent of integration artifacts.

## Non-effects

This audit does not modify workflow triggers, KONTUR runtime/state, activation semantics, permissions, authority, releases, tags, branch protection, or external systems.

## Conformance

`validate-ci-dependency-audit.js` rejects any record claiming `safe_to_narrow=true` without explicit complete direct and transitive evidence, and rejects any artifact claiming that audit completion itself changes CI behavior.
