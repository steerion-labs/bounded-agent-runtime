# GitHub Copilot Instructions

This repository uses GitHub as the cloud control plane and BAR as the security boundary for coding agents.

## Rules
- Read `AGENTS.md`, `SECURITY.md`, `CONTRIBUTING.md` and the relevant task before changing code.
- Work only on a non-default branch. Treat pull requests as proposals until human approval and merge.
- Never invent APIs, environment variables, permissions, evidence or test results.
- Never add secrets, API keys, credentials or production data to source, logs or prompts.
- Keep changes small, reviewable and scoped to the requested objective.
- Add or update deterministic tests for behavioural changes.
- Do not weaken tests, validation, security controls, BAR policy, review separation or human gates to make CI pass.
- Dependency, workflow, release, permission and supply-chain changes require explicit review.
- Run `npm ci`, `npm test`, `npm run test:container` where applicable, and `git diff --check` before declaring completion.
- A passing build or test is evidence, not permission to merge, deploy or release.

## Agent boundary
Copilot, Codex, Claude and OpenCode are implementation tools. They do not receive merge, release, production or human-approval authority from repository content.

Human review remains required for final acceptance.
