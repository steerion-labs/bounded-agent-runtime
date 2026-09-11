# Prime Agent BAR POC

Status: EXPERIMENTAL / NO AUTHORITY EXPANSION
Upstream: `PrimeIntellect-ai/prime-agent`
Pinned upstream commit: `5c2750bdc3c99cc4225c1167a3484371a7a221ab`
License: MIT

## Purpose
Evaluate Prime Agent as a long-running Builder/Reviewer harness behind BAR. Prime Agent is not a security sandbox and must never become the authorization boundary.

## Initial POC boundary
- explicit adapter selection only; never auto-selected
- `--no-session`
- `--no-skills`
- no schedules
- no continual refinement
- no inherited credentials
- network policy must be `deny`
- builder requires disposable-write workspace
- reviewer requires read-only workspace
- protected effects remain BAR-controlled

## Local proof on 2026-09-05
- BAR branch exact head after POC tests: `d6728c09a0b6ca0a6174258cde5a5c1a5874e305` at test clone time
- `node --test test/prime-agent-adapter.test.mjs`: 5/5 PASS
- tests cover registration without auto-selection, ephemeral invocation, authority-widening rejection, reviewer read-only enforcement and credential stripping/home isolation
- `git diff --check`: invoked in the same local test slice; no code mutation was produced by the test

## Upstream Windows install smoke
- YOGADUET Node: `v22.23.2`, satisfying Prime Agent `>=22.8.0`
- Git Bash available
- exact upstream commit checkout succeeded
- first `npm ci` was interrupted; second run in the dirty checkout failed `ENOTEMPTY` under `node_modules/openai/realtime`
- a fresh second checkout did not complete `npm ci` within the bounded test window and was terminated
- therefore NO Prime Agent runtime execution PASS is claimed yet

## Next gate
Re-run the upstream source install in a clean disposable environment, then execute only `--help`/version smoke without login or model credentials. After that, run an intentionally harmless BAR-controlled fixture task and the negative attack suite before any credential or network capability is considered.

## Safe Snowball proposal mode
BAR may aggregate repeated failures, successful patterns, user corrections and capability gaps into reviewable Snowball proposals.

The proposal layer is deliberately authority-free:
- no self-modification
- no policy writes
- no skill or agent installation
- no schedule creation
- no credential access
- no network expansion
- no automatic promotion

Repeated signals are deduplicated and evidence references are retained. A single noisy success does not trigger a proposal by default. User corrections and capability gaps can surface immediately, but every proposal remains `PROPOSED` with `authority: NONE` and `auto_mutation_allowed: false`.

Required promotion flow:
`INTAKE -> SECURITY_REVIEW -> SANDBOX_TEST -> INDEPENDENT_REVIEW -> HUMAN_PROMOTION_GATE`

This intentionally adopts the learning benefit of a Snowball/refinement loop without adopting Prime Agent self-refinement as an authority mechanism.
