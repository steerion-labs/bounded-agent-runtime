# AI Working Model

Effective: 2026-09-08
Status: ACTIVE

## Purpose
This project follows the shared AI-assisted delivery model used across Steerion Labs' active projects.

## Roles
- Human owner: final decision authority and Human Gate.
- ChatGPT / Codex: architecture, orchestration, planning, review, QA and gatekeeping.
- Claude Code: bounded repo worker and implementation interface.
- CCR: local gateway between Claude Code and the model provider.
- NVIDIA Nemotron 3 Super 120B: current inference model behind Claude Code.
- BAR: bounded execution and authority boundary.
- GitHub: Source of Truth for repository state and accepted evidence.
- PowerShell / CLI / tests: deterministic execution and verification.

## Runtime path
Claude Code -> local CCR at 127.0.0.1:3458 -> NVIDIA -> nvidia/nemotron-3-super-120b-a12b

Start from the project root with:
`C:\Users\vebiv\Start-Claude-NVIDIA.ps1`

Claude Code is the client and agent interface. The inference model is NVIDIA Nemotron, not an Anthropic Claude model.

## Standard workflow
1. Human goal and constraints.
2. ChatGPT / Codex defines scope, boundaries and checks.
3. Claude Code performs bounded repo work.
4. Deterministic tests, builds, smoke checks and diffs produce evidence.
5. ChatGPT / Codex reviews findings and evidence.
6. Project state is written back to GitHub.
7. Human Gate controls material actions.

## Human Gate
Never perform without explicit current authorization: merge, auto-merge, deploy, production activation, release, tag, GitHub Actions, workflow dispatch, Codespaces, paid cloud resources, new permissions, new credentials, live trading, exchange writes, destructive external actions.

Secrets must not be written to repositories, prompts, reports or logs.

## Operating rules
- Work only inside the named project scope.
- GitHub and verified project files override chat memory.
- Do not silently change provider or model if NVIDIA routing fails.
- Prefer local deterministic verification before cloud execution.
- Worker output is evidence, not authority.
- Stop on material scope, architecture, security or cost divergence and return to the Human Gate.

## Current verified model
`nvidia/nemotron-3-super-120b-a12b`

The previous `deepseek-ai/deepseek-v4-pro-0813` route was not retained as default because live NVIDIA requests timed out during verification on 2026-09-08.
