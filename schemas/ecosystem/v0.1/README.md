# Ecosystem Product Portfolio v0.1

This directory defines a machine-readable, evidence-bounded snapshot of the UU-AAP ecosystem portfolio.

It is intentionally separate from:

- Stable Core membership;
- product runtime implementation;
- release status;
- legal registration status;
- execution or successor authority.

## Files

- `product-portfolio.schema.json` — structural contract for the portfolio snapshot;
- `examples/uu-aap-ecosystem-portfolio.json` — current evidence-frontier classification;
- `validate_portfolio.py` — deterministic fail-closed validation and negative mutations.

## Evidence semantics

A product with `repository_evidence_state = not_materialized_at_frontier` is not declared nonexistent. It means only that the reviewed repository frontier does not yet contain a canonical implementation or pilot manifest sufficient to claim implementation maturity.

An external milestone with `evidence_source = applicant_report` records the applicant's report without fabricating a public receipt or external legal outcome.

```text
Applicant Report != Public Receipt
Application Filed != Application Registered
Product Name != Product Contract
Product Contract != Product Runtime
Repository Evidence Gap != Proof of Non-Existence
```

## Portfolio boundaries

The portfolio is descriptive and planning-oriented. It MUST NOT:

- create a new Core primitive;
- promote a product into Stable Core;
- authorize a product effect;
- transfer authority along a dependency edge;
- claim that a provider, runtime or transport accepted responsibility;
- claim legal registration without separately bound evidence.

## Validation

```bash
python schemas/ecosystem/v0.1/validate_portfolio.py
```

The validator checks the exact evidence frontier, retained product inventory, dependency direction, balance policy, evidence-path existence and the non-overclaiming filing boundary.
