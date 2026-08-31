# Core Pilot 002 External Input Observation v0.1

Read-only observation layer over the dedicated Core Pilot 002 intake issue #422.

Origin frontier:

`d83297e526abfb5a0d9148cc0906223fe49f870b`

## Why this successor exists

Current Frontier Reconciliation v0.2 and RC Checkpoint v0.5 retained the previous operational state `WAITING_EXTERNAL`. During the next external-participation audit, the dedicated #422 intake surface was inspected directly and an existing public comment from another GitHub account label was found.

The earlier reconciliation/checkpoint remain preserved as historical observations. This layer changes only the current **availability observation**; it does not silently rewrite their bytes or conclusions.

## Exact observed source

```text
issue        #422
comment id   5471862585
account      84dnnvbdvp-debug
account id   319250061
author assoc NONE
created      2026-08-30T23:14:24Z
updated      2026-08-30T23:14:24Z
body sha256  23eaf897b361349acfef70809917f17f15cf2b8344e98c2c361ee099cfaa1ba8
via app      chatgpt-codex-connector / 1144995
```

The full submission is not duplicated into this receipt. The evidence binding uses the public source reference plus observed body digest.

## Safe conclusion

```text
EXTERNAL_ACCOUNT_SUBMISSION_OBSERVED_AWAITING_HUMAN_ADMISSION_DECISION
```

The source-account label differs from the repository-owner label and GitHub reports `author_association=NONE`. GitHub also reports that the comment was performed via the ChatGPT Codex Connector app.

Those observations do **not** prove that the source is an independent human, that it is unrelated to the project/user, or that it has any standing, expertise or authority.

```text
Different Account Label != Verified Human Identity
Author Association NONE != Independence Proof
App-Mediated Submission != Synthetic By Definition
Public Comment != Eligible Run Input Until Human Gate
Observed Counterexample != True Counterexample
Observation != Disposition
Disposition != Normative Change
```

## Human gate

`pilots/core-pilot-002/README.md` explicitly makes selection of the first real Public Review item a separate human-gated run-materialization step.

Therefore this layer does **not**:

- select the comment for Run 001;
- create an admission artifact;
- choose `accept_for_followup`, `request_clarification`, `decline_with_rationale`, `defer_unresolved` or `duplicate_or_already_covered`;
- contact or mutate the source comment;
- modify SPEC/Core/schema;
- assign responsibility or liability;
- create release/publication/action authority.

After this observation is accepted, the next decision belongs to the human project owner: whether this exact source should be selected for the real Pilot 002 Run 001 admission path despite the unresolved identity/independence question and explicit app mediation.
