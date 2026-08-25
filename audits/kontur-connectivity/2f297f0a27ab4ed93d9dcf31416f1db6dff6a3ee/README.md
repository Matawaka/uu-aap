# KONTUR Connectivity Audit at `2f297f0`

## Purpose

This directory publishes a repository-grounded connectivity audit of the materialized
KONTUR / UU-AAP architecture. It records evidence and classifications; it does not
repair, promote, activate, deploy, or otherwise change the architecture.

```text
EXPECTED_FRONTIER = 2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee
OBSERVED_MAIN_SHA = 2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee
```

The observed GitHub `main` exactly matched the expected frontier. The expected value
is retained verbatim as provenance.

## Audit method

The audit used a commit-pinned repository archive, direct inspection of the public
GitHub commit/PR/issue records, repository search, fixture/validator/workflow tracing,
and local deterministic execution of the existing validators. Each material relation
was classified as `PROVEN`, `DOCUMENTED`, `IMPLIED`, `MISSING`,
`CONFLICTING`, or `OUT_OF_SCOPE`.

A relation is `PROVEN` only when concrete repository evidence establishes it and
the relevant validation supports the claim. Passing a validator establishes synthetic
fixture conformance only; it is not evidence of live behavior or semantic connectedness
outside what the validator checks.

Source snapshot:

- URL: https://github.com/Matawaka/uu-aap/archive/2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee.zip
- SHA-256: `faf109a86c7fe61dc06a0956d6129eb32bb3c2af4b603137d3784f431e1b8b6d`
- Size: 2,199,429 bytes
- Extracted repository files: 1,096

## Permission boundary

Audit Authority != Architecture Authority.

This directory contains evidence only. It creates no action permit, successor permit,
stable-core requirement, runtime permission, remediation authority, deployment authority,
or authority over KONTUR, a game, an account, or a user.

No existing architecture document, implementation, fixture, validator, workflow,
repository protection, secret, environment, release, tag, or deployment configuration
was modified. No live gameplay, live-user observation, external effect, proactive
message, background notification, or autonomous activity was invoked.

## Contents

- `connectivity-report.md` — human-readable assessment and exact findings.
- `connectivity-graph.json` — machine-readable nodes and classified relations.
- `findings.json` — structured findings with remediation explicitly unauthorized.
- `evidence-index.json` — repository evidence, artifact hashes, PR origins, and
  validator/workflow roles.
- `audit-summary.json` — frontier, counts, status, and non-effect receipt.
- `validate-audit.py` — deterministic internal consistency check for this package.

## Reproduction

From the root of the commit-pinned source tree, verify the archive hash independently,
then run:

```powershell
node protocols/core/v0.1/validate-core.js
python pilots/kontur-game-companion/observational-lane/validate.py
python pilots/kontur-game-companion/assistance-gate/validate.py
python pilots/kontur-game-companion/shared-discovery-memory/validate.py
python pilots/kontur-game-companion/bounded-initiative/validate.py
python pilots/kontur-game-companion/focus-diversity/validate.py
python pilots/kontur-game-companion/interaction-receipt/validate.py
python pilots/kontur-game-companion/pause-resume/validate.py
python audits/kontur-connectivity/2f297f0a27ab4ed93d9dcf31416f1db6dff6a3ee/validate-audit.py
```

Then inspect every graph edge through its `evidence_refs`; resolve repository paths
against the exact observed commit and public references against the listed GitHub
commit, PR, or issue.

## Recovery and publication status

Status: `PUBLISHED`.

After a network interruption, remote `main` was re-observed and still matched the
frozen frontier. No pre-existing audit branch or PR was found, while the local partial
package passed its deterministic checks. Recovery details are in
`recovery-state.json`.

- Branch: `audit/kontur-connectivity-2f297f0`
- Pull request: https://github.com/Matawaka/uu-aap/pull/458
- Pull request merged: `false`
- Duplicate audit publication created: `false`

Publication used an already-authorized GitHub connector. No additional permission was
requested. Parallel unmerged work was not included in the frozen audited architecture.

**Audit Publication != Architecture Change**

**This audit contains evidence only and authorizes no remediation.**


