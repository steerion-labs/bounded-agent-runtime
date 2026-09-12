# BAR Copilot Agents

These files are GitHub Copilot custom agent profiles, not descriptive placeholders. GitHub loads `.agent.md` profiles from `.github/agents/` and exposes them to Copilot agent workflows for the selected repository/branch.

Available agents:

- `BAR Orchestrator`: read-only task routing and bounded delegation.
- `BAR Builder`: bounded implementation with test execution.
- `BAR Security Reviewer`: independent read-only security review.
- `BAR Review Orchestrator`: exact-head review coordination.

Canonical product/security documentation remains under the repository root and `docs/`. Agent profiles do not replace the architecture or security contracts.