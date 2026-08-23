# KONTUR Durable Responsibility Ledger v0.1

**Status:** experimental server-level durable responsibility store  
**Machine identity:** `KONTUR`  
**Scope:** local reference server responsibility control plane

## Purpose

The Responsibility Kernel can derive a valid `KONTURResponsibilityState`, but a process-local object is not yet durable responsibility.

This layer adds a persistent authority boundary:

```text
KONTURActivationPreflightReceipt
        |
        v
explicit human execute boundary          (future live executor)
        |
        v
KONTUR Responsibility Kernel
        |
        v
KONTURResponsibilityTransitionReceipt
        |
        v
KONTURResponsibilityLedgerEntry
        |
        v
immutable atomic publication
        |
        v
validated durable ledger chain
        |
        v
recoverable authoritative responsibility head
```

Core invariant:

```text
kernel transition produced
!= ledger entry durably committed
!= recovered authoritative responsibility head
```

## Authority model

There is deliberately no mutable authoritative `HEAD` file.

The only authoritative head is the final entry of the complete validated immutable entry chain.

A cache, snapshot, `HEAD.json`, process variable, or temporary file cannot override the reconstructed chain.

## Immutable entry files

Committed entries are stored as:

```text
entries/<12-digit-sequence>-<entry-digest>.json
```

Each entry binds:

- the exact Ledger Policy bytes;
- the exact Responsibility Policy bytes;
- exact fresh ReadinessSignal bytes for `activate` or `resume`;
- exact responsibility state bytes;
- exact ResponsibilityTransitionReceipt bytes;
- the exact previous ledger entry digest;
- trigger evidence;
- activation preflight bytes for the genesis activation entry;
- activation intent nonce when applicable.

The entry's `entry_digest` is RFC8785-JCS + SHA-256 over the entry body excluding the `entry_digest` field itself.

The deterministic filename contains that digest.

## Historical self-containment

Ledger and Responsibility Policy bytes are embedded in every entry.

This is intentional. A later repository update must not change how an old responsibility transition is interpreted during recovery.

For `activate` and `resume`, the exact ReadinessSignal bytes are also embedded because those transitions cannot later be revalidated from a digest alone.

Policy migration is not silently supported by v0.1. Changing either policy digest across ledger generations requires a future typed migration protocol.

## Atomic local publication

The reference writer uses:

```text
create temp file exclusively
-> write full entry
-> fsync(temp file)
-> close
-> rename(temp, immutable final entry path)
-> fsync(entries directory)
```

Only after the final rename and directory fsync is the entry part of the durable local ledger.

Temporary files remain non-authoritative.

The writer uses an exclusive local `.writer.lock`. An existing lock fails closed; v0.1 does not guess that an existing lock is stale.

## Recovery

Recovery scans only the immutable `entries/` directory and validates every committed file.

It reconstructs:

- complete ordered entry chain;
- current responsibility state;
- holder;
- responsibility scopes;
- fencing epoch;
- consumed command/intent nonces;
- terminal `retired` status.

A malformed, corrupted, hash-broken, sequence-broken, policy-drifted, or predecessor-broken committed entry fails recovery closed.

Invalid committed entries are not silently skipped.

## Replay protection

Every non-null `command_nonce` is accumulated from committed ledger history.

A nonce already present in the ledger cannot be committed again.

For genesis activation, the nonce must use the activation-intent namespace:

```text
urn:uu-aap:kontur:activation-intent-nonce:...
```

This establishes **ledger-relative replay protection** for the local server ledger.

It does not establish distributed consensus or global uniqueness across unrelated ledgers.

## Genesis activation entry

The first ledger entry must be:

```text
sequence = 1
transition_kind = activate
previous_entry_binding = null
```

It additionally requires:

- exact activation preflight bytes;
- `decision = human_execute_step_may_proceed`;
- exact preflight binding as the transition trigger;
- activation intent nonce;
- exact readiness bytes;
- generation 1 active state from the Responsibility Kernel.

The ledger does **not** itself create the activation transition. It only persists and revalidates a Kernel transition result.

## Successors

Every later entry must:

- have `sequence = previous.sequence + 1`;
- exactly bind the previous ledger entry;
- have responsibility generation equal to ledger sequence;
- preserve exact Ledger Policy and Responsibility Policy digests in v0.1;
- pass the existing Responsibility Kernel receipt validator against the predecessor state.

A `retired` recovered head is terminal.

## Test-only activation

The CI suite calls the Responsibility Kernel `activate` transition only to create a **synthetic runner-local fixture** in `/tmp`.

That state:

- is never written to repository paths;
- is never a live server ledger;
- is retired inside the test chain;
- does not mean KONTUR has been activated.

The positive CI chain is:

```text
test-only activate
-> durable entry 1
-> heartbeat
-> durable entry 2
-> independent process restart recovery
-> retire
-> durable entry 3
-> independent process restart recovery
```

## Assurance boundary

A valid ledger entry may establish:

- local durable commit under the exact ledger policy;
- complete local entry-chain derivability;
- embedded historical evidence binding;
- ledger-relative replay protection.

It must keep false:

- distributed consensus;
- legal responsibility;
- legal effect;
- moral blame/correctness;
- universal truth;
- universal causality;
- PoAI materialization;
- universal canonicality.

## Live activation boundary

This layer does not activate live KONTUR.

The future live activation executor must consume:

1. a canonical main-bound activation frontier;
2. an explicit `KONTURActivationIntent`;
3. a fresh positive `KONTURActivationPreflightReceipt`;
4. an explicit final human execute command;
5. the Responsibility Kernel `activate` result;
6. this durable ledger's atomic commit path.

Only after the committed genesis entry is successfully recovered from the durable ledger may the system claim that local server responsibility state survived the activation boundary.

Human activation remains final.
