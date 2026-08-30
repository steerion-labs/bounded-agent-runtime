# 14 Integrating Your Agent

Bounded Agent Runtime is intentionally model-agnostic. The demo adapters are replaceable process boundaries, not privileged components.

## Mental model

Your model or coding agent is a **worker**. It can propose changes or review a candidate, but it does not decide what authority it has.

```text
Claude / Codex / OpenCode / Ollama / custom agent
                     |
                bounded adapter
                     |
                 Controller
                     |
       policy + budgets + evidence + gate
```

Changing the model should not require changing the authority model.

## Builder adapter

A Builder adapter should receive only the bounded task context it needs and write only inside the assigned workspace. It must not receive controller secrets, Human Gate private keys, GitHub deployment credentials, journal integrity keys, or permission to expand its own capabilities.

The controller is responsible for checking changed paths and deriving the resulting Git commit/tree identity.

## Reviewer adapter

A Reviewer should be independent from the Builder and receive the exact candidate identity being reviewed. Treat reviewer text as an opinion until the controller converts verified facts into evidence.

The Reviewer should not share Builder credentials or writable access to the Builder workspace in a protected deployment.

## Claude, Codex and OpenCode

The simplest integration pattern is to replace `runtime/adapters/demo-builder.mjs` and/or `runtime/adapters/demo-reviewer.mjs` with a small launcher for your chosen coding agent.

Keep the launcher boring:

1. receive bounded input from the controller
2. start the chosen agent with a reduced environment
3. operate only in the assigned workspace
4. return a structured result
5. let the controller verify Git identity, evidence and policy

Do not move authorization decisions into the prompt. A prompt saying "do not deploy" is not equivalent to a controller refusing the deploy capability.

## MCP

MCP is a useful tool interface, but tool discovery is not authority.

A safe pattern is:

```text
Agent -> bounded adapter -> selected MCP client/tools
                      -> controller policy remains authoritative
```

The adapter should expose only the MCP servers/tools required for the task. A higher-risk fallback tool must not become available merely because the preferred tool failed.

## Local models

Ollama or another local model can be used in exactly the same role. Local inference may reduce external data exposure, but it does not remove the need for filesystem, Git, credential, network and Human Gate boundaries.

## Before enabling real side effects

The reference runtime intentionally does not ship a real merge, deploy or release adapter. Before adding one:

- keep source-control/deployment credentials controller-only
- make the mutation adapter idempotent or reconcilable
- re-check the exact candidate immediately before mutation
- require a protected action that is present in both `allowed_actions` and `protected_actions`
- bind authorization to the authenticated Human Gate decision
- add crash/replay and stale-controller tests
- re-run the release checklist on the exact resulting commit

## Recommended integration sequence

Start with a read/write-local Builder adapter and a read-only Reviewer adapter. Prove path limits, candidate binding and worker isolation before connecting any remote mutation.

A good first milestone is:

```text
Task -> Builder -> local commit -> Reviewer -> Human Gate -> STOP
```

Only after that flow is trustworthy should you add a real protected-action adapter.
