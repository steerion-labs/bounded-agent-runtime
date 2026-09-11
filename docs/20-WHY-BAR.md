# Why put BAR around a coding agent?

Coding agents are good at producing changes. BAR handles a different problem: **what is allowed to become trusted authority**.

The whole product can be understood with five concepts:

```text
Task -> Builder -> Verified Candidate -> Reviewer -> Human Gate
```

1. **Task**: explicit goal, allowed paths, actions and budgets.
2. **Builder**: Claude Code, Codex, OpenCode, Docker or another adapter does the work.
3. **Verified Candidate**: BAR derives the exact commit/tree and observes deterministic checks itself.
4. **Reviewer**: a separate reviewer sees the exact candidate and may not mutate it.
5. **Human Gate**: protected actions require a signed approval bound to that exact candidate.

BAR is useful when you want agent speed without letting model output become its own permission, verification or release boundary.

## Five-minute proof

```powershell
bar quickstart
```

The synthetic task must finish at `HUMAN_GATE_REQUIRED`. No real merge, deploy or release occurs.

## When BAR adds value

- autonomous or long-running coding loops
- separate Builder/Reviewer workflows
- exact-candidate approval and replay-resistant Human Gates
- one authority layer across Claude Code, Codex, OpenCode or custom agents
- environments where controller-observed evidence matters more than "the agent says tests passed"

## When normal GitHub controls may be enough

If your workflow is simply "agent opens a PR, a human reviews it, branch protection merges it", GitHub's native controls may already be sufficient. BAR becomes more useful as agent autonomy, multiple workers, unattended execution or protected side effects increase.

## What BAR is not

BAR is not an IDE, coding model, CI platform, firewall or universal OS sandbox. It is the deterministic authority and evidence boundary around those components.
