# BAR disposable-repository reference demo

Status: IMPLEMENTED AS A SYNTHETIC WORKFLOW; **independent security review is NOT COMPLETE**.

## Run

From a clean BAR checkout with Node.js 20+ and Git:

```bash
npm run demo:reference
node --test test/demo-reference.test.mjs
```

The script creates a temporary local Git source repository, runs the real BAR controller with **synthetic** Builder and Reviewer adapters, and removes its own temporary files. No model credentials, remote provider or GitHub mutation are needed.

## Verified properties

1. A clean Git base commit exists in the temporary source repository.
2. The demo Builder writes only `demo-output/artifact.txt` under an explicitly allowed path.
3. Controller verification runs `node test/verify-artifact.mjs` against the candidate copy.
4. The controller-owned candidate commit/tree match Git; the source HEAD and worktree remain unchanged.
5. The synthetic Reviewer uses a separate workspace; candidate-bound evidence is observed, and execution stops at `HUMAN_GATE`.
6. A publication request tied to the observed candidate SHA/tree refuses default-branch writes and protected merge requests.
7. The regression test asserts this complete workflow and both denials.

Expected ending:

```text
PASS     source unchanged, controller-owned candidate/tree verified
PASS     separate reviewer workspace and bound evidence observed
BLOCKED  default-branch write
BLOCKED  protected merge request
RESULT   1/1 BOUNDED WORKFLOW VERIFIED; 2/2 ESCALATIONS BLOCKED
HUMAN_GATE_REQUIRED; no network publication, merge, deployment or release
```

## Limits

- **Real Git and controller; synthetic workers only**. This is not a live Codex, Claude or OpenCode run, and the demo Reviewer is not an independent security auditor.
- This does not prove OS isolation, production credential protection, egress restrictions, Docker daemon integrity or remote side-effect adapter safety.
- The verifier checks one deliberately small artifact, not arbitrary application quality.
- The standalone `npm run demo:attack` tests four additional synthetic authority denials.

## Acceptance and remaining gates

- [x] Disposable, no-credential script with cleanup implemented
- [x] Local source candidate, verification and Reviewer binding exercised on Windows
- [x] Two protected-action denials and targeted regression test
- [x] Windows targeted test PASS (Node 24.19.0, 2026-10-20)
- [ ] Native Linux proof at exact final PR head
- [ ] Full regression suite at exact final PR head
- [ ] Independent security review
- [ ] Explicit Human Gate before merge or release

No new repository, framework, paid agent provider, automatic merge, deployment or release.
