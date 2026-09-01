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
| Codex | yes | yes | `workspace-write` Builder + ignored rules; `read-only` Reviewer + ignored user config/rules; ephemeral session |
| Claude Code | yes | yes | Safe Mode, no session persistence, edit-only Builder tools, plan/read Reviewer tools, strict MCP config |
| OpenCode | yes | yes | `--pure`, explicit directory, never `--auto` |
| Ollama | no | yes | explicit model required |
| Generic | yes | yes | executable + argv supplied out-of-band by controller environment |
| Container | yes | yes | see container isolation guide |

BAR does not add Codex approval automation, Codex sandbox bypass, Claude permission bypass or OpenCode auto-approval flags.

External agent authentication remains the responsibility of the installed CLI. For Codex, Claude Code and OpenCode, `bar agents` also performs a bounded login/readiness probe when supported; this is a readiness signal, not a credential import. BAR deliberately does not copy provider credentials into task files. Authentication failures are reported as `*_AUTH_REQUIRED`.

On Windows, BAR resolves native executables and standard npm `.cmd` shims to their underlying JS/EXE target without enabling shell execution. This is required for globally installed CLIs such as Codex and OpenCode.

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

## Automatic adapter selection

Use `--builder auto` or `--reviewer auto` when you want BAR to choose from ready adapters. Selection happens once during task creation, the concrete adapter is written into the task and therefore bound into task authority and evidence. BAR never switches adapters silently during `bar run`.

Priority is deterministic: Builder `codex -> claude -> opencode -> container -> generic`; Reviewer `codex -> claude -> opencode -> ollama -> container -> generic`. Selection filters out known unauthenticated adapters, role-unsafe adapters and containers missing task-specific image/command configuration. Codex Builder selection also fails closed when local MCP/plugin/hook extensions are active. Use `--builder-allow-user-config` only as an explicit task-bound acceptance of that risk; Reviewer remains isolated with ignored user config.
