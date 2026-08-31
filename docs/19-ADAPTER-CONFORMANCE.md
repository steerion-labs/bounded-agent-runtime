# Adapter Conformance Contract

BAR treats every model and agent CLI as untrusted execution machinery. An adapter may propose or edit code, but it never gains protected-action authority.

## Required contract

A conforming Builder adapter must work only in the controller-provided workspace, respect task-bound allowed paths, return control within the task budget, and never receive merge, deploy, release, controller, Human Gate or cloud credentials.

A conforming Reviewer adapter must receive the exact controller-bound candidate, operate read-only from BAR's perspective, return `APPROVE` or `BLOCK` in the structured review contract, and must not mutate the candidate or protected state.

The controller independently derives Git commit/tree identity, detects workspace mutation, runs declared verification, owns evidence, enforces budgets and performs protected-action authorization.

## First-party matrix

| Adapter | Builder | Reviewer | BAR default boundary | Unsafe defaults BAR does not use |
| --- | ---: | ---: | --- | --- |
| Codex | yes | yes | Builder: `workspace-write`, ignored rules; Reviewer: `read-only`, ignored user config/rules; ephemeral | `danger-full-access`, bypass flags |
| Claude Code | yes | yes | Safe Mode, no persistence, edit-only / plan+read tool sets, strict MCP config | `--dangerously-skip-permissions` |
| OpenCode | yes | yes | non-interactive `run`, `--pure`, controller verification | auto-approve modes |
| Ollama | no | yes | local reviewer only | builder authority |
| Docker | yes | yes | disposable container, `--network none`, no host `.git` | host credential inheritance |
| Generic | yes | yes | operator-supplied command plus full controller checks | any claim of sandboxing by BAR |

## Failure semantics

Missing executables, unsupported roles, invalid Reviewer JSON, timeouts, candidate drift, Reviewer mutation and verification failure all fail closed. BAR does not silently downgrade to a more permissive adapter.

## Reproducible task patterns

### Codex Builder + Claude Reviewer

```powershell
bar task --repo C:\code\project --intent "Fix the parser test" --allow src --allow test --builder codex --reviewer claude --verify npm --verify-arg test --out bounded-task.json
bar run --task bounded-task.json
```

### Claude Builder + Codex Reviewer

```powershell
bar task --repo C:\code\project --intent "Fix the parser test" --allow src --allow test --builder claude --reviewer codex --verify npm --verify-arg test --out bounded-task.json
bar run --task bounded-task.json
```

### OpenCode Builder + Claude Reviewer

```powershell
bar task --repo C:\code\project --intent "Fix the parser test" --allow src --allow test --builder opencode --reviewer claude --verify npm --verify-arg test --out bounded-task.json
bar run --task bounded-task.json
```

Run `bar agents` first to see which optional CLIs BAR detects. Credentials used by those CLIs remain the operator's responsibility and must never grant the worker protected BAR authority.

## Compatibility snapshot

The v0.5 adapter contract was checked on Windows on 2026-08-31 against locally installed CLIs:

- Codex CLI `0.150.1`
- Claude Code `2.1.247`
- OpenCode `1.18.23`
- Docker `29.7.2`

BAR tests the invocation contract and safe defaults, but external CLIs evolve independently. Run `bar doctor` and `bar agents` after upgrades, and treat an incompatible invocation as a fail-closed adapter issue rather than weakening the authority boundary.

## Windows real-agent proof

v0.5 adds shell-free resolution for npm Windows launchers. A real clean-repository smoke test reached `HUMAN_GATE_REQUIRED` with Codex as both Builder and Reviewer after controller-observed verification. Claude invocation was also exercised through its real CLI; provider authentication must be valid independently of BAR.

## Automatic adapter selection

Use `--builder auto` or `--reviewer auto` when you want BAR to choose from installed adapters. Selection happens once during task creation, the concrete adapter is written into the task and therefore bound into task authority and evidence. BAR never switches adapters silently during `bar run`.

Priority is deterministic: Builder `codex -> claude -> opencode -> container -> generic`; Reviewer `codex -> claude -> opencode -> ollama -> container -> generic`. Installation detection does not prove provider authentication; an expired or missing login fails closed with an actionable auth error.
