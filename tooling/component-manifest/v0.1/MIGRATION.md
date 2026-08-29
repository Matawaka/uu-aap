# Migration policy

Component Manifest adoption is additive. Existing components are not required to move files, rename receipts, alter canonicalization, change runtime entrypoints or reissue historical artifacts.

A component receives a manifest only when its existing surfaces can be described without semantic reinterpretation. Future manifest versions must preserve v0.1 meaning or use an explicit successor/migration artifact.
