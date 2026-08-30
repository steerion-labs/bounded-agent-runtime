# 07 Recovery and Budgets

Autonomy must remain bounded when something fails.

## Recovery

The controller journal is an HMAC-authenticated hash chain with a controller-secret anchor. Recovery verifies every journal entry, sequence number, previous-entry hash, HMAC and final anchor.

A consistent state returns:

```text
SAFE_RESUME
```

If a crash occurs after a valid transition is durably journaled but before the atomic state file is replaced, recovery can replay that single transition and returns:

```text
RECOVERED_FORWARD
```

Malformed, truncated, reordered or cryptographically invalid journal data fails closed. State/journal divergence outside the single recoverable transition is treated as a security stop.

State writes use temporary files, `fsync` and atomic rename. Journal entries are flushed before the anchor is updated.

## Lease and fencing

Every active task carries controller ownership, generation, expiry and a fencing token. Persisted generation and fencing token are rechecked before controller-authorized work.

## Budgets

The reference task model enforces:

- model/adapter call count
- retry count
- wall-clock deadline

Worker adapter processes and controller Git commands receive finite timeouts derived from the remaining wall-clock budget. The runtime does not currently implement token-count or monetary budgets; adapters may add them as explicit task fields and controller checks.

### Controller exclusivity

Mutating controller commands acquire an atomic controller-owned lock under `runtime-core` before reading/mutating runtime state. A live owner blocks concurrent controllers. A dead owner can be taken over, after which the controller claims a fresh monotonic lease generation and fencing token.

The lock serializes runtime state, journal, approval/nonce and protected-authorization mutations on one host. It is not a distributed lock; a multi-host deployment requires a durable compare-and-swap/lease service with equivalent fencing semantics.