# KONTUR Current Main Frontier Verification v0.1

## Purpose

A valid `KONTURActivationFrontierReceipt` proves that readiness evidence is bound to one exact Git revision. It does not, by itself, prove that the revision was the canonical repository `main` at the time of the workflow event.

This layer closes that observability gap without adding activation or execution authority.

```text
activation frontier
+ workflow event = push
+ workflow ref = refs/heads/main
+ GITHUB_SHA
+ checkout SHA
        |
        v
KONTURCurrentMainFrontierVerificationReceipt
```

## Exact verification rule

A positive receipt requires all of the following:

```text
workflow event == push
AND workflow ref == refs/heads/main
AND GITHUB_SHA == checkout SHA
AND frontier.git_revision == git:<GITHUB_SHA>
AND frontier.git_revision == git:<checkout SHA>
```

The frontier must also remain within the existing pre-activation boundary:

```text
status = activation_prompt_may_be_requested
readiness_accepted = true
human_activation_step_still_required = true
kernel_activated = false
execution_authority_granted = false
```

## Time and successor semantics

The strongest positive claim is deliberately event-scoped:

```text
current_main_frontier_verified_for_workflow_event = true
```

It does not mean that the frontier remains current forever.

Any later canonical `main` commit makes the earlier receipt historical for current-main consideration:

```text
main@A verified
main advances to B
=> receipt@A remains historical evidence
!= current frontier at B
```

The main-push refresh workflow therefore regenerates the frontier and this verification receipt for each new canonical `main` revision.

## PR boundary

Pull-request workflows may test the verifier, but they MUST NOT issue a positive current-main verification receipt.

```text
PR merge-ref frontier
!= current-main verified frontier
```

The production workflow step that emits the receipt is guarded by:

```text
github.event_name == 'push'
AND github.ref == 'refs/heads/main'
```

The verifier rechecks those values and SHA equality again rather than trusting the step condition alone.

## Binding

The receipt binds the exact frontier artifact using RFC 8785 JCS + SHA-256, the same canonicalization family already used by the KONTUR frontier machinery.

It records:

- repository identity;
- workflow event and ref;
- exact `GITHUB_SHA`;
- exact checkout SHA;
- exact frontier Git revision;
- exact frontier digest;
- verification time.

## Explicit non-effects

A positive verification receipt does not:

- activate KONTUR;
- create an activation intent;
- call the activation executor;
- create responsibility state;
- accept responsibility;
- grant execution authority;
- transfer repository ownership or account control;
- mutate canonical origin;
- establish legal responsibility;
- certify truth;
- establish universal canonicality.

The strongest operational consequence remains:

```text
current main frontier verified for this workflow event
-> activation prompt may be requested
-> separate explicit human activation step still required
```
