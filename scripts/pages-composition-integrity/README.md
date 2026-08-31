# P1.16 Relocatable Unified Pages Integrity Envelope v0.1

P1.16 is a historical-preserving integrity successor over the accepted P1.15 unified Pages composition.

P1.15 verifies the composed site against the original `docs/` and generated verifier roots. P1.16 adds a separate self-contained byte inventory so a finalized copy can later be checked after those build roots are unavailable.

```text
validated P1.15 composed artifact
        ↓ byte-preserving copy
P1.16 pages-integrity-envelope.json
        ↓
relocated verify-only against final bytes
```

## Envelope

`pages-integrity-envelope.json` binds every P1.15 payload file, including `pages-composition-receipt.json`, by:

- relative path;
- byte length;
- SHA-256;
- deterministic payload-tree digest;
- exact historical P1.15 implementation blobs and predecessor main.

The envelope does not inventory itself. The final artifact path set must equal exactly the declared P1.15 payload set plus the envelope.

## Use

Finalize an already validated P1.15 artifact:

```text
python scripts/pages-composition-integrity/finalize_pages.py \
  --p1-15-root <validated-composed-root> \
  --output <final-root>
```

Verify a relocated final artifact without source roots:

```text
python finalize_pages.py --verify-only <relocated-final-root>
```

The verify-only path accepts no `docs/`, verifier-source or P1.15 source-root argument.

## Integrity boundary

This is self-consistency against retained envelope bytes, not producer authentication. A party that can replace both payload and envelope can create a different self-consistent set.

```text
byte inventory != signature
manifest match != trusted producer
manifest match != truth
manifest match != identity
manifest match != authority
manifest match != responsibility
public reachability != publication/action authority
```

P1.16 therefore explicitly records `false` for producer authentication, trust anchor, external timestamp, truth, identity, authority, responsibility and publication/action authority.

## Non-effects

No Stable Core, SPEC or CONTESTABILITY change. No change to P1.15 composition semantics. No PoAI/verifier semantic merge. No candidate re-selection. No truth/authority promotion. No package registry, custom domain or second Pages deploy owner.