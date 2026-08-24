# UU-AAP Core Extension Composition v0.1

**Status:** experimental composition profile  
**Depends on:** `protocols/core/v0.1`  
**Tracking:** issue #303

## Purpose

This profile defines how non-core UU-AAP mechanisms compose above the seven-primitives Core without becoming hidden authority, execution, or canonicality paths.

Core remains the only place where an externally consequential transition may cross the `Action Gate` boundary.

```text
extension observation/challenge/review/provenance signal
  -> ExtensionReceipt
  -> optional contribution to one or more Core prerequisites
  -> Core validation
  -> ActionPermit (only if Core prerequisites are independently satisfied)
```

An extension receipt is evidence about an extension event. It is never a substitute for `IntentReceipt`, `AuthorityReceipt`, `CoordinationReceipt`, `ActionPermit`, `ActionReceipt`, `OutcomeReceipt`, or `SuccessorStateReceipt` merely because its prose sounds similar.

## Core composition invariant

```text
extension signal != intent != authority != coordination != action permission
!= performed action != observed outcome != truth != causality != liability
```

No extension may create an implicit transition between Core layers.

## ExtensionReceipt envelope

Every extension receipt MUST contain:

- `protocol = "UU-AAP-EXT"`;
- `version = "0.1"`;
- `receipt_type = "ExtensionReceipt"`;
- `extension_type`;
- `subject`;
- exact `frontier`;
- `predecessor_receipt_hashes`;
- `assertions`;
- `non_effects`;
- `safe_effects`;
- `core_binding`;
- `issuer`;
- `issued_at`;
- `payload`;
- deterministic `content_hash`.

`safe_effects` are bounded protocol-local effects that do not cross the external action boundary. A safe effect may record, request, challenge, warn, qualify, or recommend. It MUST NOT itself perform the externally consequential operation under review.

`core_binding.may_contribute_to` is advisory typed composition metadata. It says which Core prerequisite family may consume the extension evidence. It does not make the extension receipt a Core receipt.

## Required universal non-effects

Every extension receipt MUST explicitly keep all of the following false:

- `intent_created`;
- `intent_inferred_from_challenge`;
- `authority_expanded`;
- `responsibility_accepted`;
- `coordination_completed`;
- `action_authorized`;
- `action_performed`;
- `outcome_established`;
- `causality_proven`;
- `truth_certified`;
- `liability_established`;
- `universal_canonicality_established`.

A profile may add stricter non-effects.

## Initial extension profiles

### Preventive Intent Challenge (PIC)

PIC may record a drift concern or request an intent checkpoint.

Allowed safe effects:

- `intent_checkpoint_requested`;
- `intent_drift_concern_recorded`.

PIC MUST NOT infer, manufacture, replace, revoke, or negate intent by itself.

```text
challenge raised != harmful intent proven != refusal != authority to block
```

### Appeal / Contestability

Appeal may record a contest request or request reconsideration/stay review.

Allowed safe effects:

- `contest_recorded`;
- `reconsideration_requested`;
- `stay_review_requested`.

An appeal request does not itself reverse, suspend, erase, or execute anything.

### Readiness

Readiness may aggregate evidence and declare a bounded readiness assessment.

Allowed safe effects:

- `readiness_assessed`;
- `missing_precondition_recorded`.

A positive readiness assessment does not create `ActionPermit`.

### Circumstantial Provenance

Circumstantial Provenance may record converging evidence that supports a provenance hypothesis.

Allowed safe effects:

- `provenance_hypothesis_recorded`;
- `converging_evidence_recorded`.

Convergence does not certify causality, identity, truth, or liability.

### Sustainability / Convergence

Sustainability may record drift, convergence risk, resource pressure, or a recommendation for review.

Allowed safe effects:

- `sustainability_warning_recorded`;
- `convergence_review_requested`.

Warnings and recommendations do not create authority or automatic blocking power.

## Action Gate firewall

A Core `ActionPermit` MUST be derived from valid Core receipts according to `protocols/core/v0.1`.

The following are forbidden:

1. treating an `ExtensionReceipt` as an `ActionPermit`;
2. treating an extension assertion as authority without an `AuthorityReceipt`;
3. treating a PIC challenge as intent evidence for the challenged intent;
4. treating readiness as execution permission;
5. treating an appeal as an already-applied stay/reversal;
6. treating provenance convergence as causal proof;
7. treating a sustainability warning as an execution veto unless a separate explicit authority/policy path produces the required Core receipts.

## Extension stacking

Multiple extensions may coexist on the same frontier.

They MUST NOT silently merge into stronger semantics. Composition is additive evidence only unless a Core primitive independently validates the stronger transition.

```text
PIC + Readiness + Appeal + Provenance
!= ActionPermit
```

Even unanimous extension outputs do not bypass missing Core authority, coordination, or intent.

## Frontier rules

An extension receipt MUST bind to an exact frontier.

If it contributes evidence to a Core action decision, that contribution is stale when its frontier no longer matches the predecessor frontier required by the consuming Core receipt, unless the consuming profile explicitly re-observes and re-binds it.

## Fail-closed validation

`validate-extensions.js` rejects at least:

- missing universal non-effects;
- any universal non-effect set to a value other than `false`;
- safe effects not allowed for the declared extension type;
- an extension claiming `ActionPermit` or `ActionReceipt` identity;
- PIC that asserts intent was inferred/created from the challenge;
- Readiness claiming action authorization;
- Appeal claiming reversal/stay already executed;
- Circumstantial Provenance claiming causality/truth;
- Sustainability claiming implicit veto/authority;
- frontier mismatch between extension evidence and the Core predecessor frontier in the composition fixture.

## Conformance fixture

`composition.fixture.json` contains five extension receipts on one Core predecessor frontier plus a composition check demonstrating that they remain advisory evidence and do not create an action permit.

Run:

```bash
node protocols/core/extensions/v0.1/validate-extensions.js
```

## Non-effects of this composition profile

This profile does not:

- activate KONTUR or any other system;
- mutate existing KONTUR/activation runtime;
- grant or transfer authority;
- accept responsibility;
- execute a stay, reversal, block, merge, publication, deletion, or other external action;
- certify identity, factual truth, causality, legality, liability, or universal canonicality.

It constrains how extensions may contribute evidence without becoming hidden execution paths.
