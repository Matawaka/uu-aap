# Repository integrity status

## Public Draft v0.1 — pre-release note

The SHA-256 table generated for the local pre-publication candidate is **not canonical for the GitHub publication**.

During publication, some text and JSON files were serialized through the GitHub API. Their semantic content is the same candidate material, but byte-level formatting can differ from the local snapshot. Publishing the old hash table as if it described the remote repository would therefore create a false integrity claim.

For the current public-review stage:

- Git commit history is the authoritative version history of the repository;
- each GitHub blob/commit provides content-addressed integrity inside Git;
- no v0.1 release hash set is claimed yet;
- a canonical SHA-256 manifest SHOULD be generated only after the review candidate is frozen and tagged;
- that release manifest SHOULD itself be signed or bound to a future UU-AAP/V record.

This correction intentionally preserves the fact that a pre-publication hash snapshot existed while withdrawing it as a claim about the published repository.

**Epistemic status:** `corrected / not_applicable_to_remote_bytes`
