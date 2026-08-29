# Component Manifest v0.1 dependency edge kinds

- `RUNTIME_IMPORT` — implementation imports/calls the dependency runtime API.
- `SCHEMA` — component structurally consumes a dependency-owned schema.
- `EVIDENCE` — component may consume/carry typed evidence from the dependency without runtime ownership.
- `CONFORMANCE` — component conformance requires predecessor conformance evidence or commands.
- `TRANSPORT` — dependency supplies the transport representation/path.
- `OPTIONAL_ADAPTER` — optional forward adapter relationship; no reverse dependency is implied.
- `TEST_ONLY` — dependency is used only by conformance/testing surfaces.

Reachability across any edge kind is not authority, responsibility, compatibility or execution evidence.
