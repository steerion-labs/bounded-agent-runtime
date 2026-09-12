# BAR Copilot Agent Execution Standard

GitHub Copilot custom agents in `.github/agents/*.agent.md` are executable profiles. They are intentionally separated into orchestration, implementation and independent review roles.

The profiles must not replace or override `AGENTS.md`, `SECURITY.md`, or the canonical architecture/security documents. Human acceptance remains required for merge, release and deployment decisions.