# Draft Governance

UU-AAP 0.x uses an open-editor model intended to transition toward plural governance if adoption grows.

## Principles

1. Normative text is publicly readable.
2. Material changes are proposed publicly.
3. Historical releases are immutable.
4. Significant rejected proposals receive a rationale.
5. Security, privacy, coercion and accessibility objections receive priority review.
6. Minority technical objections may be documented rather than erased.
7. The initial proposer has no permanent veto by virtue of originating the project.
8. Commercial implementations do not receive exclusive authority over protocol meaning.

## Initial roles

- **Initial proposer/editor:** Matawaka (GitHub).
- **Editors:** maintain specification and issue disposition.
- **Implementers:** build validators, registries and publishing integrations.
- **Reviewers:** test legal, editorial, privacy, security, library and accessibility assumptions.
- **Participants:** anyone may comment through public channels.

## Decision model for 0.x

During 0.x, editors MAY merge changes after public review, but SHOULD document:

- issue/proposal;
- accepted alternative;
- rejected alternatives;
- rationale;
- compatibility impact.

Changes that weaken a principle in `PRINCIPLES.md` SHOULD require an explicit public proposal titled **Principle Change**.

## Repository-state protection

Historical release/checkpoint anchors are listed in [`FILE_HASHES.md`](FILE_HASHES.md) and summarized in [`docs/CANONICAL-STATE.md`](docs/CANONICAL-STATE.md).

Repository administration SHOULD protect designated immutable release/checkpoint tags against update and deletion. GitHub Rulesets are operational controls and do not themselves redefine protocol semantics or prove legal/canonical claims beyond the repository-scoped state they protect.

The repository contains [`.github/CODEOWNERS`](.github/CODEOWNERS) with `* @Matawaka` for repository-scoped review routing. CODEOWNERS metadata does not itself assert intellectual-property ownership and does not prove that code-owner approval is required by GitHub settings.

At the current single-code-owner stage, mandatory independent code-owner approval SHOULD NOT be represented as a completed assurance unless a safe second-reviewer or explicit bypass model exists. A strict approval gate with only one eligible reviewer can deadlock self-authored pull requests and therefore may reduce governance availability rather than improve review quality.

`review routing != independent approval`

`repository control != universal authority`

## Future transition trigger

The project SHOULD seek a more neutral standards venue when at least two of the following exist:

- two independent implementations;
- three independent publishing/author pilots;
- a functioning external review mechanism;
- sustained external contributors not controlled by the initial editor.

Possible venues MAY include a W3C Community Group or another appropriate open standards process.
