# Roadmap

BAR follows an evidence-first roadmap. Items are direction, not promises or delivery dates.

## Shipped foundation

- guided first-run quickstart and safer error guidance
- clear Human Gate and protected-action handoff
- adapter conformance contract and reproducible examples
- exact candidate and evidence binding
- container-isolated Builder/Reviewer path
- controller-signed authorization receipts
- recovery, fencing, replay protection and fail-closed security checks
- Codex, Claude Code and OpenCode adapter support

## Next candidates

- adapter compatibility probes that record detected CLI versions
- signed machine-readable verification bundles
- remote/ephemeral execution providers behind the same controller contract (GitHub-hosted reference proof in progress)
- improved local read-only evidence UI
- reviewed reference integrations that consume authorization receipts without weakening the Human Gate
- short terminal demo / GIF for a real bounded task

## Non-goals

BAR will not move policy or protected authority into an LLM, silently auto-approve protected actions, or claim a child process is an OS sandbox.

Security-sensitive roadmap items require exact-head evidence, independent review and an explicit Human Gate before protected promotion.