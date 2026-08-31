# Why put BAR around a coding agent?

A capable coding agent can edit files and run commands. BAR addresses a different problem: deciding what output is allowed to become trusted authority.

```mermaid
flowchart TB
  subgraph Alone["Coding agent alone"]
    A1[Prompt] --> A2[Agent edits and tests]
    A2 --> A3[Agent says done]
  end
  subgraph WithBAR["Coding agent + BAR"]
    B1[Task + explicit authority] --> B2[Builder]
    B2 --> B3[Controller derives exact commit + tree]
    B3 --> B4[Deterministic verification]
    B4 --> B5[Separate Reviewer]
    B5 --> B6[Evidence integrity re-check]
    B6 --> B7{Authenticated Human Gate}
  end
```

BAR is useful when a team wants agent speed without allowing model output to become its own permission, verification or release boundary.

## Five-minute proof

```powershell
bar quickstart
```

The command runs an isolated synthetic task and must finish at `HUMAN_GATE_REQUIRED`. It performs no real merge, deploy or release.

## Good fits

- coding-agent automation in security-conscious teams
- Builder/Reviewer workflows that need exact candidate identity
- local or containerized agent experiments where side effects must stay bounded
- organizations evaluating Codex, Claude Code, OpenCode or custom agents behind one deterministic authority layer

## Not the goal

BAR is not trying to replace the coding agent, IDE, CI platform, container runtime or firewall. It is the authority and evidence boundary around those components.
