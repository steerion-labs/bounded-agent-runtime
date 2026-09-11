# Roadmap

BAR follows an evidence-first roadmap. Items are direction, not promises or delivery dates.

## v0.4 Usability and adoption

- guided first-run quickstart and safer error guidance
- clearer status and Human Gate next steps
- adapter conformance contract and reproducible examples
- clone and ZIP installation paths
- contribution templates and starter issues

## Next candidates

- adapter compatibility probes that record detected CLI versions
- signed machine-readable verification bundles
- additional isolated execution providers behind the same controller contract
- improved local read-only evidence UI
- side-effect adapter specification with idempotency and reconciliation requirements, without shipping automatic mutation by default

## Non-goals

BAR will not move policy or protected authority into an LLM, silently auto-approve protected actions, or claim a child process is an OS sandbox.

## Adoption / integration

- [x] Quickstart regression coverage for missing or unusable TEMP/TMP/TMPDIR
- [x] Controller-signed, journaled protected-action authorization receipt plus read-only verification path
- [ ] Publish short terminal demo / GIF for a real bounded task
- [ ] Add reviewed reference integrations that consume authorization receipts without weakening the Human Gate
