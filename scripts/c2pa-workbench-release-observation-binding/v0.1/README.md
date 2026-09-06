# Workbench v0.55.2 public-release observation × C2PA binding v0.1

This package creates a product-facing interoperability proof without reconstructing the historical operator-host publication receipt.

The immutable source record is the separately committed public GitHub observation at commit `f88f008e8d96748cdf67223df7d48472d6a17a85`. It records only that `Matawaka/workbench` public `main` and annotated tag `workbench-v0.55.2-accepted` converge on exact commit `ea852feeb0e8d92a8977bb251693e7e977913dca` with the exact two-parent order, while the annotated Git tag signature remains `verified=false / unsigned`.

The C2PA layer reuses the standard `c2pa.external-reference` hashed binding. It does not introduce a custom assertion namespace and does not reinterpret repository facts as truth, publication authority, model/runtime/action authority, historical availability, or a cryptographically verified Git tag.

Required distinctions:

```text
public repository observation != historical operator publication receipt
annotated tag present != signed tag verified
repository publication != truth
repository publication != authority
C2PA external-reference binding != retroactive C2PA inclusion in the original Workbench release
C2PA signer != Workbench release authority
```

Workflow permissions are `contents: read`; external activity is bounded read-only HTTPS GET of public GitHub state, the immutable source record and the pinned official c2patool archive.
