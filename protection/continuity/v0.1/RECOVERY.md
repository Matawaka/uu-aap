# UU-AAP Continuity Recovery Runbook v0.1

## Recovery principle

Restore evidence first. Restore write authority only after evidence is independently verified.

```text
locate capture
-> verify SHA-256
-> verify Git bundle
-> reconstruct repository
-> verify canonical anchors
-> compare expected frontier
-> only then consider publication or authority actions
```

## Restore from a continuity bundle

1. Locate a capture directory containing `CAPTURE_COMPLETE`.
2. Run:

```bash
python continuity.py verify --manifest /path/to/capture/continuity-manifest.json
```

3. Read `source.main_commit_sha`, `source.main_tree_sha`, and the tag map from the manifest.
4. Restore into a new directory:

```bash
git clone /path/to/capture/uu-aap-<timestamp>.bundle uu-aap-recovered
git -C uu-aap-recovered fsck --full
git -C uu-aap-recovered rev-parse HEAD
git -C uu-aap-recovered rev-parse 'HEAD^{tree}'
```

5. Compare the recovered refs with the manifest before adding any writable remote.

## Failure handling

Fail closed if any of the following occurs:

- bundle SHA-256 mismatch;
- `git bundle verify` failure;
- `git fsck --full` failure;
- unexpected main commit or tree;
- missing expected release/checkpoint tag;
- conflicting continuity manifests without an explainable lineage.

Do not "repair" a failed capture in place. Preserve it as evidence and use another independently verified capture.

## Primary-account loss

If the primary GitHub account becomes unavailable:

1. do not attempt credential sharing or impersonation;
2. verify a local/offline continuity capture;
3. use the independent standby GitHub account only under its own identity;
4. preserve the original canonical repository URL and historical tag/commit bindings in all recovery records;
5. if an organization or successor path has been preconfigured, use that formal path;
6. do not declare a mirror to be canonical merely because the original account is inaccessible.

## Required periodic drill

At least every 30 days:

- verify the newest bundle;
- restore it into a disposable directory;
- run `git fsck --full`;
- compare at least the current `main` and all protected release/checkpoint tags;
- record the drill date separately from the repository being tested.

The drill must not push or alter the canonical repository.
