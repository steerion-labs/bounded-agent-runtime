# CLI and Agent Adapters

`bar` is the supported operator entry point for local development. It calls the existing controller; it is not a second controller.

## Inspect the host

```powershell
bar doctor
bar agents
```

`doctor` reports Node/Git, runtime mode, installed adapters and whether protected worker-egress enforcement has been declared. Missing optional agents are warnings, not authority fallbacks.

## Create a bounded task

The source repository must be clean. Write scope is explicit:

```powershell
bar task --repo C:\repo --intent "Fix parser" `
  --allow src --allow test `
  --builder codex --reviewer claude `
  --verify npm --verify-arg test --out bounded-task.json
```

Use `--allow-all` only as an explicit operator decision. BAR never infers full-repository write scope automatically.

The generated task binds source commit, Builder/Reviewer adapters, allowed paths/actions, budgets and verification commands into the same task hash used by Evidence.

## Adapter defaults

| Adapter | Builder | Reviewer | Safety-oriented defaults |
| --- | ---: | ---: | --- |
| Codex | yes | yes | `workspace-write` Builder, `read-only` Reviewer, ephemeral session, ignored user config |
| Claude Code | yes | yes | edit-only Builder tools, plan/read Reviewer tools, strict MCP config |
| OpenCode | yes | yes | `--pure`, explicit directory, never `--auto` |
| Ollama | no | yes | explicit model required |
| Generic | yes | yes | executable + argv supplied out-of-band by controller environment |
| Container | yes | yes | see container isolation guide |

BAR does not add Codex approval automation, Codex sandbox bypass, Claude permission bypass or OpenCode auto-approval flags.

External agent authentication remains the responsibility of the installed CLI. BAR deliberately does not copy provider credentials into task files.

## Run and inspect

```powershell
bar run --task bounded-task.json
bar status
bar recover
```

A successful build/review flow stops at `HUMAN_GATE_REQUIRED`. Starting another task requires an explicit `bar reset` in demo mode.

## Human Gate lifecycle

```powershell
bar gate keygen .human-gate
bar gate sign .human-gate\private.pem
bar approve <signature>
bar authorize merge
```

Protected mode requires approver identity, public key path and pinned fingerprint in controller configuration. Authorization never performs a remote mutation by itself.
