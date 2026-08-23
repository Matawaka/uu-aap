# Repository integrity status

## Public Draft v0.1

The canonical integrity anchor for the first public release is the **Git tag `v0.1` pointing to one specific Git commit and tree**.

Verified release binding:

- `v0.1` → `16f83e655b80d1dabcd1d6b7533dc823796c767c`

UU-AAP v0.1 intentionally does not publish a hand-maintained flat SHA-256 table for every repository file. A manually copied hash table can become stale during publication and would create a stronger-looking integrity claim than the process actually supports.

For v0.1:

- the Git commit referenced by tag `v0.1` is the authoritative repository snapshot;
- the commit recursively identifies the exact Git tree and blobs that form the release;
- later edits on `main` do not redefine what `v0.1` means;
- a future release MAY add a separate signed SHA-256 artifact manifest for distribution files such as PDF and EPUB;
- a book-level UU-AAP/V record SHOULD bind the actual distributed ebook artifact, rather than infer artifact identity from this protocol-repository tag.

## Later repository-scoped checkpoint anchors

Later protection, authority and licensing work is recorded as separate checkpoint tags rather than by moving `v0.1` or rewriting historical meaning.

Verified bindings as of 2026-08-23:

| Tag | Role | Exact commit |
| --- | --- | --- |
| `poai-authority-exp-v0.1` | PoAI authority-root experimental checkpoint | `2424e61846fd262f9c01ccc406931683d3c6e616` |
| `poai-ccrp-exp-v0.1` | frozen CCRP v0.1 experimental checkpoint | `33215e251310105e2fac591b17ae2d90522488d9` |
| `uu-aap-product-protection-v0.1` | product provenance, attribution and responsibility checkpoint | `66cbeb97b512bc3d09babdfb43fbd4339bae4dda` |
| `uu-aap-licensing-v0.1` | finalized open-licensing package checkpoint | `541d345432de851b198fa459cb33447c096aebe7` |

Relevant committed manifests:

- [`protection/checkpoints/product-provenance-responsibility-v0.1.json`](protection/checkpoints/product-provenance-responsibility-v0.1.json)
- [`protection/checkpoints/open-licensing-v0.1.json`](protection/checkpoints/open-licensing-v0.1.json)

The human-readable consolidated map is [`docs/CANONICAL-STATE.md`](docs/CANONICAL-STATE.md).

## Immutability policy and administrative controls

The repository policy designates release and checkpoint tags listed here as immutable reference anchors. They SHOULD be protected against update and deletion by repository administration.

GitHub tag Rulesets are administrative controls, not committed artifacts or cryptographic proof. This document therefore does not claim that a particular Ruleset configuration can be proven from Git history alone. Administrators should verify the active target set in repository Settings.

A tag-to-commit binding can be independently checked against the canonical Git repository even when administrative protection settings are evaluated separately.

## Artifact-level integrity remains separate

Repository tags identify repository states. They do not automatically identify external distributed artifacts such as PDF or EPUB files.

A UU-AAP/V record for a book or other publication SHOULD bind the exact distributed artifact through its own digest/signature/provenance record and SHOULD preserve edition/version relationships explicitly.

This replaces an earlier local pre-publication hash candidate that was withdrawn because API serialization changed byte-level formatting of some files before publication.

**Epistemic status:** `asserted / git-tag-anchored / repository-scoped`
