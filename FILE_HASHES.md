# Repository integrity status

## Public Draft v0.1

The canonical integrity anchor for the first public release is the **Git tag `v0.1` pointing to one specific Git commit and tree**.

UU-AAP v0.1 intentionally does not publish a hand-maintained flat SHA-256 table for every repository file. A manually copied hash table can become stale during publication and would create a stronger-looking integrity claim than the process actually supports.

For v0.1:

- the Git commit referenced by tag `v0.1` is the authoritative repository snapshot;
- the commit recursively identifies the exact Git tree and blobs that form the release;
- the tag SHOULD be protected against update and deletion with a GitHub tag ruleset;
- later edits on `main` do not redefine what `v0.1` means;
- a future release MAY add a separate signed SHA-256 artifact manifest for distribution files such as PDF and EPUB;
- a book-level UU-AAP/V record SHOULD bind the actual distributed ebook artifact, rather than infer artifact identity from this protocol-repository tag.

This replaces an earlier local pre-publication hash candidate that was withdrawn because API serialization changed byte-level formatting of some files before publication.

**Epistemic status:** `asserted / git-tag-anchored`
