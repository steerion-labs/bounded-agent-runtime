# CLI and Agent Adapters

`bar` is the supported operator entry point for local development. It calls the existing controller; it is not a second controller.

## Inspect the host

```powershell
bar doctor
bar agents
```

`doctor` reports Node/Git, runtime mode, installed adapters and whether protected worker-egress enforcement has been declared. Missing optional agents are warnings, not authority fallbacks.

## Start with a bounded work request

For normal use, `bar work` composes task creation and the existing controller run into one command while preserving the same authority model:

```powershell
bar work --repo C:\repo --goal "Fix parser" `
  --allow src --allow test `
  --builder auto --reviewer auto `
  --verify npm --verify-arg test
```

`bar work` requires explicit write scope and explicit controller-observed verification. It retains the resolved task artifact, binds concrete adapters before execution, and stops at the existing Human Gate. `--dry-run` resolves and prints the task contract without creating controller state. It never merges, deploys or releases. Verification evidence proves that the exact operator-declared command ran against the exact candidate and records its exit status/output; BAR does not claim that an arbitrary test command is semantically sufficient for the user goal.

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
| Codex | explicit opt-in | yes | Builder uses reviewed user config with `workspace-write`; Reviewer uses `read-only` + ignored user config/rules; ephemeral session |
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

Priority is deterministic after safety filtering: Builder `codex -> claude -> opencode -> container -> generic`; Reviewer `codex -> claude -> opencode -> ollama -> container -> generic`. Codex Builder is marked unsafe for automatic selection in v0.5 and becomes eligible only when the operator supplies `--builder-allow-user-config`, which is a task-bound acceptance of the reviewed local Codex configuration. Reviewer remains isolated with ignored user config. Containers are eligible only with task-specific image and command configuration.
