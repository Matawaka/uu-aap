# Matawaka Repository & Disclosure Registry v0.2

v0.2 is an additive successor to v0.1. It does not rewrite the historical three-repository snapshot.

The public registry now admits exactly four verified public repositories and adds the first completed `private-origin → deterministic public projection` event through the already-public repository `Matawaka/truehire-public`.

Core distinctions:

```text
At Least One Publication Completed != All Private Projects Assessed
Public Projection != Private History Export
Public Repository Evidence != Deployment Authority
Source Publication PASS != Binary Distribution Compliance PASS
```

The registry deliberately contains no new private repository names. A future private project remains absent from the central public surface until its own disclosure gate and explicit human decision complete.

Files:

- `repository-disclosure-registry.schema.json` — strict JSON Schema 2020-12 contract;
- `examples/public-repository-disclosure-registry.json` — canonical v0.2 public-safe snapshot;
- `validate_registry.py` — deterministic content hash, exact public frontier checks and fail-closed mutation suite.

TRUEHIRE public evidence is bound to:

```text
main/root commit = 99a8ed329f20d670b1130795eecff305c0c996bf
root tree = 585cd1d24e6feecdfebdcfe54faf27db3d4b1475
release anchor = release/v0.1
projection root = sha256:41be1d4f43f16e7b10f7d4242e782651d326632efe4e56369de40051abb1351e
root parent count = 0
```

The dedicated CI re-observes all four public frontiers and the TRUEHIRE public receipts. It has read-only repository permissions and performs no cross-repository mutation.
