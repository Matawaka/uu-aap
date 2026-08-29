# Tooling safety boundary

The v0.1 validator is local and read-only. It has no network client, child-process execution path, filesystem write path, provider adapter or actuator surface. Conformance commands are stored as metadata only and are not executed by manifest validation.

The successor Generated Conformance Runner must be a separate reviewed component with an explicit constrained execution policy.
