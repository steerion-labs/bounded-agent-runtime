# Compatibility

BAR is model-agnostic, but adapter safety depends on the concrete CLI version and host boundary.

The authoritative host check is:

```bash
bar agents --json
bar doctor --json
```

Do not infer compatibility from this table alone. Record the detected adapter version in release or deployment evidence.

| Adapter | Builder | Reviewer | Normal boundary | Important limitation |
| --- | ---: | ---: | --- | --- |
| Claude Code | yes | yes | Safe Mode; Builder edit tools / Reviewer plan + read | local process boundary, not an OS sandbox |
| OpenCode | yes | yes | pure mode; no automatic approval | local process boundary, not an OS sandbox |
| Codex | explicit opt-in | yes | workspace-write Builder with reviewed user config / isolated read-only Reviewer | Builder safety depends on the installed Codex CLI behavior |
| Docker | yes | yes | disposable container with `network none` | Docker daemon remains part of the trust boundary |
| Generic CLI | configurable | configurable | operator-defined | must satisfy the adapter conformance contract |

## Runtime support

- Node.js: 20+
- Git: required
- Docker: optional; recommended when a stronger disposable worker boundary is required
- Windows and Linux: supported by the reference tooling, with platform-specific hardening guidance

## Evidence levels

BAR uses three different ideas that should not be conflated:

**Supported** means an adapter contract exists in the repository.

**Detected** means `bar agents --json` found a usable local installation on the current host.

**Verified for a release/deployment** means the exact adapter version, host boundary and relevant tests were captured as evidence for that exact BAR revision.

A successful model invocation is not proof that the surrounding authority boundary is correct.

## Adding an adapter

Read [Adapter Conformance](19-ADAPTER-CONFORMANCE.md). New adapters must document:

- non-interactive CLI contract
- least-privilege execution mode
- credential assumptions
- timeout and cancellation behavior
- Reviewer output contract
- protected-action restrictions
- negative tests for authority widening

An adapter must never gain merge, deploy or release authority merely because the underlying tool is capable of those actions.
