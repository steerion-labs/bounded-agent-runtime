# Review-only resume

`bar review-resume` finishes the independent review of a candidate that BAR has already built and controller-verified, after the Reviewer was unavailable. The Builder is **not** run again. The command does not create a second orchestrator and does not bypass the Human Gate.

```text
bar review-resume --candidate <sha> --tree <sha> --source-head <sha|none> --state-version <n> [--json]
```

## When it applies

A normal `bar work` / `bar run` executes Builder → controller verification → Reviewer. If the Reviewer fails (timeout, provider error, invalid output), the controller stops in `REVIEWING`. At that point:

- `candidate_sha` and `tree_hash` are committed in the builder workspace;
- `builder_candidate` and `controller_verification` evidence are HMAC-bound to the task, candidate and tree;
- no review evidence, gate challenge or approval exists yet.

Before this change, the only way forward was a full rebuild. `bar status` in `REVIEWING` now points to `review-resume`.

## Required binding (all mandatory)

| Flag | Must equal |
|---|---|
| `--candidate` | `state.candidate_sha` |
| `--tree` | `state.tree_hash` |
| `--source-head` | `state.base_sha`, or `none` when the task has no source |
| `--state-version` | the current `state.state_version` |

Unknown flags are rejected with `REVIEW_RESUME_ARGUMENT_FORBIDDEN`. That covers any attempt to pick a worker, path, action or effect. Duplicate or malformed values are also rejected.

## Checks before the Reviewer runs

1. Controller lock, state envelope and journal chain are verified (`recoverState`), and the task is re-validated.
2. The state must be `REVIEWING`. There must be no review evidence, gate challenge or approval; otherwise the request is a replay (`REVIEW_RESUME_STATE_INVALID` / `REVIEW_RESUME_REPLAY`).
3. Every requested binding must match exactly (`REVIEW_RESUME_BINDING_MISMATCH:<field>`). The state version makes a request single-use: after a successful resume the version has moved on.
4. All evidence HMACs verify. Exactly one `builder_candidate` and exactly one `controller_verification` are present, both produced by `controller` as `CONTROLLER_VERIFIED`. Any edit to the task (for example swapping the reviewer) breaks the task binding (`TASK_BINDING_INVALID`).
5. The canonical builder workspace `<runtime-root>/builder-work/<task_id>` exists. Its HEAD and tree equal the candidate, it is clean, its parent equals the source HEAD, its tree is link-safe, and every changed path is still inside `allowed_paths`.
6. At most 3 resume attempts per candidate (`REVIEW_RESUME_ATTEMPTS_EXHAUSTED`).
7. A **new controller lease generation** is claimed, so any older controller of this task is fenced out.

## Review

The Reviewer then runs through the same code path as a normal run (`reviewCandidate`):

- a fresh, separate reviewer workspace cloned at the exact candidate;
- a Git control-state snapshot, mutation detection and identity re-check;
- the lease is re-checked after the Reviewer returns;
- `APPROVE` must name the exact candidate and tree.

The resulting `review_observation` evidence is identical to a normal run, plus `review_resume_attempt`. The state advances only to `HUMAN_GATE` with a fresh gate challenge. Approval, protected-action authorization and receipts are unchanged.

## Budget

After a long outage, the task's original wall-clock budget has usually expired. Each resume attempt therefore runs in its own window (`state.review_resume`), using the task's **unchanged** limits for wall clock, model calls and retries. The original budget counters are not reset. Attempts are capped at 3, so the total review budget remains bounded. A failed attempt closes its window. After a successful attempt the window stays in force, so approval timing matches the normal path: it is measured from the resume, just as a normal run measures it from `run`.

## Outcomes (`--json`, schema `bar.review-resume-result.v1`)

| Exit | status | retryable | Meaning |
|---|---|---|---|
| 0 | `HUMAN_GATE_REQUIRED` | – | reviewed and approved by the Reviewer; Human Gate required |
| 3 | `REVIEWER_UNAVAILABLE` | yes | Reviewer outage again; state unchanged (`REVIEWING`); retry with the same request |
| 3 | `UNAVAILABLE` | yes | another controller holds the lock |
| 4 | `REVIEW_BLOCKED` | no | the Reviewer rejected the candidate |
| 2 | `DENIED` | no | any binding, replay, evidence, workspace or argument failure |

Every result reports `builder_invoked: false` and `protected_effects_attempted: false`.

## Durability and artifact assumptions

- The **whole runtime root** must survive until the resume: `runtime-state`, `journal`, `secrets` (the evidence HMAC key and journal anchor), `runtime-core` and `builder-work/<task_id>`. Losing the HMAC key or the journal makes the candidate unprovable, and the resume fails closed.
- The runtime root may be **relocated as a whole**, for example into an orchestrator's review queue. Point `BOUNDED_AGENT_RUNTIME_ROOT` at the new location. Only the canonical `builder-work/<task_id>` below the current root is accepted, and the relocation is journaled (`REVIEW_RESUME_RUNTIME_RELOCATED`). Identity always comes from Git plus HMAC evidence, never from the stored path.
- `reviewer-work` and `verification-work` are disposable. The resume re-clones the reviewer workspace.
- Cleaning the runtime root (for example stale-run reclamation) destroys the ability to resume. Orchestrators that want to park candidates must keep the runtime root outside that cleanup.

## Non-goals

No automatic retries, scheduling, rebuild fallback, publication, merge, deploy or release. Deciding when to retry is the caller's job.
