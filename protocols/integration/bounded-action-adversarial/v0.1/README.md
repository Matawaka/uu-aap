# UU-AAP Bounded Action Cross-Stage Adversarial Suite v0.1

**Status:** experimental stacked adversarial profile  
**Issue:** #377  
**Dependency:** #375 / PR #376

## Purpose

Exercise attacks that can look locally plausible but violate cross-stage continuity in the complete bounded action lifecycle.

The suite never attacks a live system. It mutates synthetic conformance state and requires deterministic fail-closed rejection.

## Attack families

Replay/double-consume, stale evidence, target/frontier/capability/operation/permit substitution, confused deputy, time reversal, predecessor/successor relabeling, hash laundering, post-hoc receipt replacement, adapter authority escalation, carry-forward of approval/permit/authority and automatic successor-action inference.

## Rule

A test passes only when every declared adversarial case is rejected. Weakening the normal chain to make an attack pass is itself a conformance failure.

CI is read-only and performs no actuator or external observation action.
