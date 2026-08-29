# 03 Controller

The controller is the only component that converts intent into execution authority.

## Responsibilities

- durable task intake and deduplication
- formal state transitions
- task lease and fencing token
- capability grants
- budget enforcement
- evidence validation
- retry and timeout policy
- recovery after crash or restart
- Human Gate persistence
- narrow source-control mutation

## Required rule

A model recommendation, role name, memory entry, event, prompt or handoff text never creates authority.

## Protected mutations

Before any protected mutation, revalidate:

1. task and state
2. lease generation and fencing token
3. exact candidate/tree
4. policy and capability versions
5. fresh trusted evidence
6. remaining budget
7. Human Gate when required

Remote mutations must be idempotent or reconciled before replay.