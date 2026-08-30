# Legacy PoAI 3.1 issue-state admission audit v0.1

**Tracking:** #767  
**Origin frontier:** `8e1051c12b4b5b01afdb5783230102ac6393e9d7`

This audit decides issue state without rewriting historical PoAI 3.1 artifacts.

The audit deliberately distinguishes completed research semantics from still-open historical boundary-test checklists:

- `CLOSE_COMPLETED`: #34, #37, #38, #45, #49, #55, #60, #64, #69, #75;
- `PRESERVE_OPEN`: #43, #47, #51, #57, #62, #66.

The research/RFC closures are admitted because the canonical Level 3.1 checkpoint records the accepted append-only chain and the legacy successor map binds each exact family to current `REUSED` or `SUPERSEDED_BY` surfaces. #75 is admitted separately because the checkpoint deliverable itself exists and preserves the non-PoAI/V and manual-tag boundary.

The six live-acceptance issues remain open because the checkpoint explicitly says they still carry additional boundary coverage. Main-path implementation is not evidence that every historical acceptance vector was exercised.

`Implemented main path != Every boundary vector tested`

`Semantic successor != Historical live evidence`

`Issue closure != Historical rewrite`

`PRESERVE_OPEN != Failure`

The validator byte-binds both the legacy successor map and the Level 3.1 checkpoint, verifies exact issue/family membership and current successor paths, rejects candidate-set expansion, rejects closing any preserved live-acceptance issue, and keeps all stronger effects false.

Closure mutation is authorized only after the dedicated PR is merged with green required checks. This audit creates no PoAI/V conformance, truth certification, identity/authority verification, universal canonicality, execution authority, external-effect authority, release, field observation or fabricated evidence.
