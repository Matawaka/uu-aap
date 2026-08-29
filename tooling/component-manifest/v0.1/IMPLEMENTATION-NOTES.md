# Implementation notes

`validate-component-manifest.js` is intentionally dependency-free and import-safe. It validates semantic constraints needed by the first slice and checks local repository paths without invoking the described runtime.

The JSON Schema remains the machine-readable structural contract; the JavaScript validator additionally enforces repository/path, mandatory non-effect, no-effect ceiling and deterministic identity rules.
