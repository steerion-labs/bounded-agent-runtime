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

## Remote execution foundation

- versioned transport-neutral remote task/result envelopes
- exact source-HEAD, authority, worker, lease/fence, candidate and evidence binding
- fail-closed replay, stale-fence, candidate/evidence drift and authority-widening checks
- GitHub-hosted ephemeral reference provider with read-only checkout and machine-readable proof
- no private project state or protected remote mutation in public BAR

## Next candidates

- adapter compatibility probes that record detected CLI versions
- signed machine-readable verification bundles
- additional provider transports implementing the same remote contract
- improved local read-only evidence UI
- reviewed reference integrations that consume authorization receipts without weakening the Human Gate
- short terminal demo / GIF for a real bounded task

## Non-goals

BAR will not become a hosted company control plane, store private portfolio/project state, move policy or protected authority into an LLM, silently auto-approve protected actions, or claim a child process is an OS sandbox.

Security-sensitive roadmap items require exact-head evidence, independent review and an explicit Human Gate before protected promotion.
