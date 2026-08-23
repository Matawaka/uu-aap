# UU-AAP Continuity v0.2 — metadata and mirror verification

**Status:** experimental repository-continuity layer  
**Scope:** read-only capture of selected GitHub-hosted metadata and read-only verification of a future non-canonical Git mirror.

This layer extends `protection/continuity/v0.1` without changing its Git bundle semantics.

## Motivation

A full Git mirror preserves Git objects, refs and tags, but it does not preserve all repository-hosted context such as issue conversations, pull-request metadata, releases, workflow-run metadata, Discussions, or administrative ruleset observations.

Continuity v0.2 therefore separates two additional concerns:

```text
Git object continuity          -> v0.1 mirror + bundle
GitHub context continuity      -> v0.2 metadata snapshot
remote replica consistency     -> v0.2 mirror verification receipt
```

None of these creates a canonical successor.

## Metadata capture

`github_metadata.py` has a live read-only mode using `gh api` and a fixture mode used by CI.

Live example:

```bash
python3 protection/continuity/v0.2/github_metadata.py capture \
  --repo Matawaka/uu-aap \
  --out /secure/uu-aap-metadata
```

The tool captures JSON snapshots for:

- repository metadata;
- `main` branch identity/frontier;
- issues endpoint history;
- pull requests;
- issue/PR conversation comments;
- pull-request review comments;
- releases and release-asset **metadata**;
- Actions workflow-run **metadata**;
- Rulesets when readable;
- Discussions when readable.

It does **not** capture credentials, Actions logs, Actions artifact bytes, release asset bytes, full PR review submissions, or complete nested Discussion reply graphs.

Every captured JSON file is SHA-256 bound by `metadata-manifest.json`. Optional datasets that cannot be read are recorded as unavailable rather than silently claimed as captured.

Verify later with:

```bash
python3 protection/continuity/v0.2/github_metadata.py verify \
  --manifest /secure/uu-aap-metadata/<timestamp>/metadata-manifest.json
```

The output directory can contain personal data already present in repository conversations. Store it encrypted and do not commit the generated snapshots back into the public repository.

## Future non-canonical mirror verification

`mirror_verify.py` performs only `git ls-remote` reads against two Git remotes and emits a receipt comparing:

- `HEAD`;
- all branch refs;
- all tag refs, including peeled annotated tag refs;
- `refs/heads/main`;
- SHA-256 digests of the complete normalized ref maps.

Example after a second remote exists:

```bash
python3 protection/continuity/v0.2/mirror_verify.py \
  --canonical https://github.com/Matawaka/uu-aap.git \
  --mirror <independent-read-only-mirror-url> \
  --out /secure/mirror-verification.json
```

Exit code `0` means exact ref equality at the observation time. Any missing, extra or divergent ref exits non-zero.

The verifier performs no fetch, push, tag creation, branch update or remote mutation.

## Security boundaries

```text
metadata captured != metadata complete
mirror exact-match != mirror canonical
replica readable != replica writable
collaborator available != owner recovered
backup present != recovery tested
```

Credential-bearing HTTP(S) mirror URLs are rejected by the verifier to avoid writing secrets into receipts.

Continuity v0.2 does not activate KONTUR, replicate the KONTUR responsibility ledger, create distributed consensus, transfer repository ownership, or assign successor authority.

## Next boundary

Before any future live KONTUR activation, continuity should add a separate sealed read-only ledger replication protocol with explicit anti-authority semantics and independent recovery verification.
