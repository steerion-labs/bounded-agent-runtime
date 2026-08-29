# 10 Operate the System

## Start small

Use one active engineering task at a time. Queue additional tasks durably instead of starting uncontrolled parallel agents.

## Normal cycle

1. Controller accepts and deduplicates a task.
2. Policy classifies risk and required capabilities.
3. Controller acquires a lease and fencing token.
4. Builder receives only the bounded task context and workspace.
5. Builder completes the allowed change and approved checks.
6. Verifier binds test evidence to the exact candidate/tree.
7. Controller validates the handoff and evidence.
8. Independent Reviewer inspects the same exact candidate.
9. Controller evaluates review and policy.
10. Protected transitions stop at Human Gate.
11. Controller alone performs an approved remote mutation.
12. Final state and evidence are journalled.

## Stop conditions

Stop automatically on security boundary violation, stale evidence, candidate drift, expired lease, budget exhaustion, unrecoverable failure or required Human Gate.

## Never auto-escalate

A fallback tool may not silently add network, filesystem, credential, deployment or mutation capability. Higher-risk fallback requires a new policy decision or Human Gate.