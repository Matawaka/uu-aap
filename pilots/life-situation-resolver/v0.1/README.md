# Life Situation Resolver v0.1 — Family Resilience Slice

**Status:** experimental pilot / local-first / non-actuating  
**Tracking:** issue #887  
**Layer:** application/pilot above UU-AAP Core and PoAI research surfaces

## Purpose

Life Situation Resolver (LSR) is a decision-support surface for serious family and personal situations. It does not try to choose a life for a person. It creates an evidence-bound state, separates facts from inference, exposes resource and obligation constraints, preserves uncertainty, compresses low-value noise only operationally, and presents the few conditions that can materially change the future.

The first slice is deliberately narrow: **family financial resilience when primary employment cannot be assumed**.

It answers five bounded questions:

1. What liquid resources are evidenced now, and which are immediately usable versus time-locked or uncertain?
2. What recurring income and expense commitments shape the next year?
3. What is the family's monthly protected burn (`essential + committed`) and current-lifestyle burn?
4. Under explicit non-employment-income scenarios, how long can current liquid resources cover the protected burn?
5. How large are user-defined resilience reserve corridors, and where are the evidence, liquidity, maturity, or concentration gaps that deserve attention first?

It does **not** select investments in v0.1.

## Architecture

```text
Local Source Evidence
  -> Normalized Household State
  -> Evidence / Classification Boundary
  -> Liquidity & Recurring Cash-flow Model
  -> Protected Burn + Reserve Corridors
  -> Runway Scenarios
  -> Attention Frontier
  -> Human Review / Correction
  -> Future Option Comparison (later slice)
  -> Human Decision (outside v0.1)
  -> Outcome / Successor Household State (later slice)
```

The application follows the UU-AAP Core separation:

```text
state != availability != intent != authority != action != outcome
```

and PoAI discipline that uncertainty and time-bounded availability remain explicit. Future scenarios are non-binding representations, consistent with Future Optionality / Non-Commitment semantics.

## Critical invariants

```text
Observed transaction != Family need
Category inference != Verified fact
Scenario != Forecast != Intent != Authorization
Priority attention != Required action
Runway estimate != Guarantee
Liquid asset != Immediately available cash
Nominal rate != Realized return
Optimization != Authority
Data completeness != Truth completeness
```

No single "family health score" is emitted. Liquidity, evidence quality, cash-flow, maturity, concentration, and runway remain separate dimensions.

## Privacy boundary

The public repository must never contain real household banking data.

Do not commit:

- bank statements, screenshots, receipts, account numbers or card numbers;
- API tokens, cookies, credentials or session material;
- names, addresses or identity documents;
- exact real provider identifiers when they reveal a private household relationship;
- raw transaction histories from a real household.

Use local-only source references such as `local://bank-export-2026-08` and pseudonymous provider refs such as `provider-a`. Example data in this directory is synthetic.

A future importer should preserve raw evidence locally and emit normalized events with provenance; it must not require uploading raw private evidence to a public repository or external model.

## Input model

`household-state.schema.json` models:

- an `as_of` decision boundary;
- base currency;
- evidence sources and epistemic status;
- liquid resources with access mode, maturity/notice constraints and nominal rates;
- recurring income with source type and reliability class;
- recurring expenses classified as `essential`, `committed`, `deferrable`, `discretionary`, or `unknown`;
- user-supplied resilience corridors and concentration-attention threshold.

The classification boundary is explicit: observed/user-asserted facts are not silently upgraded from inferred labels.

## Deterministic outputs

`resolver.js` emits a `LSRFamilyResilienceAssessment` with:

- immediate, time-locked and unknown-access liquidity;
- per-resource principal, access terms, maturity, nominal rate and evidence status;
- annualized and monthly recurring income/expense views;
- protected burn and current-lifestyle burn;
- non-employment income baseline;
- reserve corridor amounts;
- protected-runway scenarios using immediate liquidity and total stated liquid principal;
- attention items for evidence gaps, negative cash-flow, insufficient immediate reserve, maturity mismatch and concentration;
- explicit assumptions and non-effects.

Interest is recorded as evidence but **not** added to runway in v0.1. Taxes, inflation, exchange-rate changes, deposit early-withdrawal penalties, credit facilities, asset-sale values and investment returns are not silently guessed.

## Runway semantics

The primary runway scenario is:

```text
monthly_gap = max(0, protected_monthly_burn - active_non_employment_monthly_income)
runway_months = available_principal / monthly_gap
```

If the gap is zero or negative, the output is `SELF_SUSTAINING_AT_STATED_BASELINE` rather than infinity.

Two principal bases are kept separate:

- `immediate_principal`: usable now under the stated evidence;
- `total_stated_liquid_principal`: includes time-locked resources and therefore may hide a maturity mismatch.

A time-locked resource maturing after the immediate runway boundary creates an attention item rather than being silently treated as cash available today.

## Reserve corridors

The household supplies named target months (`minimum`, `preferred`, `strong`). LSR multiplies each by protected monthly burn. These are **user-defined resilience corridors**, not universal financial advice.

The output reports gaps/surpluses against immediate liquidity without converting them into an instruction to invest, withdraw, or move funds.

## Attention frontier

LSR does not collapse all risk into one score. Each attention item has a lane and evidence-based reason:

- `EVIDENCE_GAP`
- `CASHFLOW`
- `LIQUIDITY`
- `MATURITY`
- `CONCENTRATION`

This is an application-local attention projection. It does not promote KONTUR-specific Non-Binding Attention into a reusable protocol interface. A later RERC integration may preserve a rich observed graph while reversibly suppressing low-impact relations from the operational view.

## Future import path

Planned adapters, each producing the same normalized event/state contract:

```text
Bank API -> normalized events
CSV/TSV -> normalized events
XLSX -> normalized events
PDF statement -> extracted candidate events -> human verification
Image/screenshot -> extracted candidate events -> human verification
Manual entry -> user-asserted events
Receipt/check analysis -> spending-pattern evidence -> need hypotheses -> human confirmation
```

For unstructured inputs:

```text
extracted value != observed bank fact
spending pattern != family need
need hypothesis != priority commitment
```

## Future domains

The same resolver can later host separate domain profiles for housing, health, education, relocation, caregiving and community coordination. Cross-domain composition must preserve each person's authority and must not infer that a household optimization grants authority over an individual.

## Run locally

```bash
node pilots/life-situation-resolver/v0.1/resolver.js \
  pilots/life-situation-resolver/v0.1/examples/synthetic-household.json

node pilots/life-situation-resolver/v0.1/test-resolver.js
```

The CLI reads one local JSON file, writes the assessment only to stdout, makes no network request, and performs no external action.
