# Observation Set Calculus — Two-Domain Direct Reuse Proof v0.1

**Status:** direct-reuse evidence / candidate only / no admission  
**Tracking:** #909  
**Origin:** merged #908 / `70346024ece165735c7ecb043d048448a18c7578`

## Question

Can two independent repository domains invoke the **same provider-neutral candidate implementation** without importing each other's semantics?

The proof requires both:

1. C2PA authority-observability adapter;
2. Public Review external-source observation adapter.

## Strongest positive result

When `prove.py` succeeds it may establish only:

```text
direct_shared_implementation_reuse_proven = true
independent_adapter_count = 2
```

That result requires:

- the same resolved candidate profile path;
- the same candidate profile bytes;
- the same candidate set receipt schema;
- actual successful candidate evaluator invocation by both adapters;
- accepted source-domain validation before projection;
- source-domain parity checks.

A copied helper at another path does not satisfy the v0.1 shared-runtime-seam proof even if its bytes happen to match.

## Different adapter depth is intentional

C2PA currently proves reuse of:

```text
set + transition + local chain
```

because merged #902/#904/#906 provide exact source comparators.

Public Review currently proves reuse of:

```text
set
```

against the exact accepted #872 checkpoint. It does not fabricate a second historical checkpoint merely to demonstrate transition/chain syntax.

```text
Shared API Consumption != Identical Domain Lifecycle
Missing Second Checkpoint != Permission to Invent History
```

## Historical audit remains historical

Merged #908 honestly concluded:

```text
direct generic API reuse = NOT PROVEN
Stable Core admission = NO_CORE_ADMISSION
```

This successor does not rewrite #908. If the two-domain proof passes, it creates later evidence that can motivate a **new** reusable-component admission audit.

## Mandatory non-claims

Even after a positive direct-reuse proof:

```text
cross-domain semantic equivalence = not proven
universal applicability = not proven
Stable Core admission = not performed
Interface Registry admission = not performed
global equivocation proof = not performed
complete history = not proven
trusted time = not proven
truth = not proven
authority = not created
```

## Next gate

Only after accepted direct-reuse evidence:

```text
RE_RUN_REUSABLE_COMPONENT_ADMISSION_AUDIT_AFTER_DIRECT_REUSE_PROOF
```

A later audit must decide whether the candidate should remain a local reusable helper, become an experimental registered interface, or remain unregistered. This PR itself makes none of those admission decisions.
