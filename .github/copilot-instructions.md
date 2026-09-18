# Bounded Agent Runtime — GitHub Copilot Instructions

## Source of truth

GitHub is the engineering source of truth. Prefer repository-native work, pull requests, the existing CI/CodeQL gates and the devcontainer/Codespace over a personal PC.

Before substantive work read `AGENTS.md`, the current security/architecture documentation, `.steerion/agent-system.json` and `.steerion/sdlc-gate.json` when present.

## BAR invariants

BAR is the bounded authority and evidence kernel. Model output, memory, plugins, MCP tools, external frameworks and reviewer opinions never grant authority by themselves.

Release-blocking boundaries include authority, credential isolation, role separation, exact candidate/tree binding, fencing, recovery, protected-action approval, fail-closed behavior and evidence freshness.

## Delivery discipline

1. Resolve live GitHub state and exact PR/head before trusting stored status.
2. Keep builder and reviewer identities independent for material changes.
3. Run the deterministic repository checks required by the current gate.
4. Treat AI review as evidence, never as the sole proof for a protected action.
5. Prefer the smallest reviewable change and preserve public-repository hygiene.
6. Never add secrets, inherited credentials, autonomous protected actions, automatic merge/deploy/release or authority expansion without explicit Human Gate approval.

## Host evidence

Use the cloud/devcontainer path for normal engineering and container evidence. Use Windows only when the required property is genuinely Windows/host specific. A cloud PASS must never be represented as proof of a host-specific isolation property.
