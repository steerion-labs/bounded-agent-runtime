# 04 Bounded Autonomy Loop

## Minimal autonomous loop

```text
NEW
-> CLASSIFIED
-> CONTEXT_READY
-> AUTHORIZED
-> BUILDING
-> TESTING
-> HANDOFF_VALIDATION
-> REVIEWING
-> REVIEW_READY
-> HUMAN_GATE
-> ACCEPTED
-> CONTROLLER_MUTATION
-> VERIFIED
-> DONE
```

## Autonomous actions

The system may automatically continue only while the current state and capability policy explicitly allow the next action.

Typical automatic scope:

- inspect task-scoped files
- edit an assigned worktree
- run approved tests
- retry bounded transient failures
- collect exact-candidate evidence
- prepare a structured handoff
- launch a separate review execution

Protected operations stop at Human Gate.