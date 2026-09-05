# GitHub Pro readiness

Status: PREPARED, NOT AUTO-ACTIVATED.

This repository is being prepared so GitHub Pro / Student benefits can be enabled later without changing the core engineering architecture.

## Ready now
- GitHub is the source of truth.
- Cloud CI runs on GitHub-hosted runners.
- Codespaces/devcontainer baseline exists.
- Dependabot is configured for npm and GitHub Actions.
- CodeQL baseline is configured for JavaScript/TypeScript.
- Pull requests carry explicit evidence and authority gates.
- Existing manual container gate remains available.

## Enable or verify after GitHub Pro/Student activation
- Confirm Codespaces entitlement and default spending protection.
- Confirm Copilot Student entitlement and available agent/model features.
- Confirm repository rules/branch protection options and required status checks.
- Confirm security features available to this repository/account.
- Review Marketplace/MCP integrations before installation; do not install by default.

## Cost guardrails
- No pay-as-you-go dependency is required by this baseline.
- No external AI API key is required by this baseline.
- No Marketplace app is required by this baseline.
- Any future paid or metered integration requires explicit Human Accept.

## Standard cloud path

SOURCE -> CODESPACE/AGENT BRANCH -> PR -> CI -> SECURITY -> REVIEW -> HUMAN ACCEPT -> MAIN

## Non-negotiable boundaries
- No automatic merge.
- No production deploy or release from this preparation layer.
- No secrets committed to source.
- No external tool gains authority from repository text alone.
- Exact-head evidence only; a new commit invalidates older review evidence.
