# Witness Key Provenance Reproof v0.1

Tracking issue: #935.

This additive successor starts from merged #934 at exact main `529522f6a47cd202918175ea81f024d12246faaf`.

#934 already verifies an observed RFC-consistent append-only extension to an authenticated later checkpoint, but deliberately leaves witness-key provenance at:

`OPERATOR_CURATED_PINS_NOT_INDEPENDENTLY_REPROVEN`.

This package asks one narrower question: can quorum-many of the exact pinned witness vkeys be re-observed from explicitly bounded operator-published or operator-owned sources independently of the Markovian Protocol monitor configuration?

## Exact source set

- `https://witness.stagemole.eu/about` — exact stagemole vkey; `OPERATOR_PUBLISHED_WITNESS_PAGE`;
- `https://transparency.dev/witnesses` — exact little-garden vkey and exact ring-any-bells vkey; `OPERATOR_PUBLISHED_WITNESS_PAGE`;
- `https://remora.n621.de/` — exact remora vkey; `OPERATOR_PUBLISHED_WITNESS_PAGE`;
- `geomys/magnolia@0545421c001b16c0fb328cd9254010c46fa424a6`, `cmd/hetrix/geomys.go` — exact Navigli vkey inside Geomys operational monitoring configuration; fetched from the commit-pinned raw URL and required to have Git blob `95a3e95134487229343bb6197f6fa1723cfa20d7`; `OPERATOR_OWNED_REPOSITORY_SOURCE`.

The five vkeys are a strict subset of the seven exact pins already accepted as #934 input. No new witness key can be introduced by this package.

The Geomys repository source replaces the dynamic `https://navigli.sunlight.geomys.org/` page as the executable source for the historical #934 Navigli pin. During qualification the dynamic page was repeatedly reachable but its raw GitHub Actions `curl` body did not contain that historical exact vkey, yielding a correct fail-closed `4 keys / 3 URLs / 3 hosts` result. The source replacement preserves that observation rather than rewriting it or weakening the threshold.

## Counting boundary

The receipt exposes three independent counts:

```text
matched_witness_key_count
unique_source_url_count
unique_source_host_count
```

The canonical strong case is expected to be `5 / 4 / 4` because the TrustFabric page publishes two distinct pinned witness keys. Strong admission requires both at least four exact pinned vkeys and at least four distinct bounded operator source URLs; host count is reported separately and is not an independence claim.

Therefore:

```text
Two exact keys on one page != two independent operators
Operator-owned repository source != witness identity proof
Repository ownership/source provenance != legal operator identity proof
Multiple source hosts != organizational independence
Exact vkey re-observed != witness identity proven
```

Four keys from only three URLs are deliberately insufficient for the strongest result, even though the cryptographic witness quorum in #934 is four.

The strongest allowed result remains:

`QUORUM_MANY_PINNED_WITNESS_KEYS_REOBSERVED_FROM_OPERATOR_PUBLISHED_SOURCES_IDENTITY_AND_INDEPENDENCE_NOT_ESTABLISHED`

Here `operator-published sources` is the bounded umbrella for the accepted source classes `OPERATOR_PUBLISHED_WITNESS_PAGE` and `OPERATOR_OWNED_REPOSITORY_SOURCE`; it is not a claim of legal identity or operator independence.

This refines only current evidence about the provenance of matched key bytes. It does not rewrite #934's historical receipt.

## Live evidence and historical evidence

CI performs HTTPS GET only against four exact allowlisted source URLs and records SHA-256 for every fetched body. Exact full vkey presence is the semantic admission condition. For the Geomys repository source, CI additionally recomputes the Git blob and requires exact equality with `95a3e95134487229343bb6197f6fa1723cfa20d7`.

A later unrelated dynamic-page change is allowed to change the current body digest without rewriting a previously frozen qualification receipt. Historical source-body digests are evidence of what was observed during qualification; current source state is re-evaluated separately. The commit-pinned Geomys repository source is intentionally immutable for this v0.1 qualification.

## Non-claims

Always false include witness identity, operator independence, all-witness independence, all-seven provenance, second Bitcoin anchor, complete history, global/producer non-equivocation, C2PA manifest inclusion/completeness, trusted time, truth, authority, canonicality, maliciousness and automatic remediation.

No POST, no log/witness mutation, no OTS submission, no Bitcoin transaction, no upstream comment, no Core/SPEC/Registry mutation, no release/tag.

## Exact #934 replay input recovery

Merged #934 intentionally stored the receipt and RFC consistency proof but not the raw later checkpoint. This successor does not invent that byte sequence: `predecessor-934-checkpoint.txt` is copied byte-for-byte from the final GREEN #934 Actions artifact `9967291562` produced by workflow run `33958949408` on qualified head `f0df1a4103b2b47db608757469077d9465332418` (artifact digest `sha256:55d880331a56d7d511d92977a95b106ab5c8ccd1f82990c408792f817977573d`).

Its SHA-256 is `10fc3eed711589dcfe19dfc2fc59442bb63892f1b5b53fd4759ab4689c75a1c4`, exactly the `later_checkpoint.checkpoint_sha256` frozen in merged #934. The corresponding consistency bytes hash to `bce3db419bce94c7917fbadaf37253f346733845c4bcbd1fd56d93833af18648`, exactly the frozen #934 receipt value. CI uses those two exact byte sets to replay #934 before evaluating the new provenance layer.
