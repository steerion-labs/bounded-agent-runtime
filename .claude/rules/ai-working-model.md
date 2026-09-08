# Shared AI Working Model

Apply `docs/AI_WORKING_MODEL.md` together with all existing BAR authority, security and Human Gate rules.

Claude Code is the bounded repo worker. ChatGPT / Codex is the architect, orchestrator, reviewer and gatekeeper. GitHub remains Source of Truth.

Current verified inference path:
`Claude Code -> local CCR 127.0.0.1:3458 -> NVIDIA -> nvidia/nemotron-3-super-120b-a12b`

This rule never weakens BAR boundaries. Missing information never creates permission. No silent provider/model switching.
