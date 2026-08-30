# Workbench source mirror helper

**Purpose:** preserve the exact accepted local Matawaka Workbench Git history on GitHub without importing the Workbench tree into `uu-aap/main`.

**Boundary:** external human Git maintenance only. This helper is not executed by Matawaka Workbench, does not grant Workbench runtime network access, does not grant Agent Execute authority, and does not alter UU-AAP Core semantics.

## v0.27 target

The helper is fail-closed around the accepted local frontier:

```text
repository: K:\Matawaka\Workbench
HEAD:       8cdea04c2304f8589e9120d0451efa9e7e6b2f2b
tag:        workbench-v0.27-accepted
```

It refuses publication unless:

- the repository exists and is a Git worktree;
- `HEAD` equals the exact expected commit;
- the working tree is clean;
- `workbench-v0.27-accepted` resolves to that same commit;
- GitHub CLI authentication is available;
- any pre-existing backup remote uses the exact expected URL;
- any pre-existing target branch/tag resolves to the exact expected accepted commit.

On success it publishes only:

```text
Matawaka/uu-aap branch: workbench-source/v0.27-accepted
Matawaka/uu-aap tag:    workbench-v0.27-accepted
```

The branch is intentionally an unrelated-history source mirror. It is **not** merged into `main`.

After remote verification the helper writes a local external publication receipt below:

```text
K:\Matawaka\Workbench-Publication\
```

## Non-effects

The helper does not:

- modify Workbench source files;
- create or move a local commit/tag;
- force-push;
- target `uu-aap/main`;
- give Workbench runtime or Agent Execute network authority;
- establish canonical UU-AAP conformance;
- promote anything to Stable Core.

## Use

Run `Publish-Workbench-v0.27-SourceMirror.ps1` from an explicit human PowerShell session after reviewing it. A convenience `.cmd` launcher may invoke the same PowerShell file with `-ExecutionPolicy Bypass`; this changes only script-launch policy for that process and does not relax the helper's Git guards.