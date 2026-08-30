# 00 Prerequisites

## Required

- Node.js 20+
- Git
- a local development repository when using real-agent tasks

Run:

```powershell
bar doctor
bar agents
```

## Optional execution providers

BAR is model/provider-neutral. Install only the agents you intend to use:

- OpenAI Codex CLI
- Claude Code
- OpenCode
- Ollama (Reviewer)
- Docker Desktop / Docker Engine for the disposable container adapter
- your own executable through the Generic adapter

External agent authentication remains outside task files and outside BAR Evidence.

## Windows protected-mode host

Windows 11 Pro/Enterprise is recommended for the included role-account/ACL hardening scripts. PowerShell is required for those scripts.

The Windows scripts prepare/test access boundaries; same-token local CLI child processes are still not treated as isolated workers. Protected runtime execution currently requires the Docker container adapter for Builder/Reviewer.

Start on a dedicated development machine or isolated environment. Do not begin with production credentials, customer data or automatic mutation authority.
