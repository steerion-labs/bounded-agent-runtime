# 00 Prerequisites

## Goal

Prepare a host for a bounded autonomous engineering runtime.

## Recommended host

- Windows 11 Pro or Enterprise for native account and ACL isolation
- 16 GB RAM minimum, 32 GB+ recommended
- Git
- PowerShell 7 or Windows PowerShell
- Node.js LTS or Python 3.11+
- GitHub CLI or equivalent source-control CLI
- Optional local model runtime such as Ollama
- Optional Docker or WSL2 for stronger sandboxing

## Model/tool layer

The architecture is provider-neutral. You may use one or more coding agents or LLM CLIs, but none of them becomes an authority source.

Examples:

- local coding agent CLI
- hosted coding model CLI
- local inference runtime
- deterministic test runners

## Before continuing

Use a dedicated non-production machine or isolated development environment first. Do not start with customer data, production credentials or automatic deployment authority.