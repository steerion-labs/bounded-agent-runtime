# 12 Threat Model

## Protected assets
Controller state, policy, secrets, journal integrity, Human Gate identity and the exact reviewed candidate.

## Untrusted inputs
Model output, repository text, handoffs, memory, issue text, tool output and worker-produced files are data, never authority.

## Primary attacker paths
- prompt injection attempting capability expansion
- stale controller replay after lease takeover
- candidate mutation after tests or review
- reviewer using builder credentials or writable candidate
- worker access to controller secrets/state
- forged Human Gate approval
- budget exhaustion or retry loops
- tool fallback that silently adds network/filesystem authority

## Journal integrity boundary
The journal HMAC detects worker-side tampering only while the HMAC key and anchor remain protected from that attacker. The reference Windows layout keeps the journal and its integrity material in separate controller-only directories, but a compromise with controller-level access to both can rewrite and re-authenticate history. Do not treat the HMAC chain as protection from a fully compromised Controller.

## Required response
Fail closed. Do not silently downgrade evidence quality or increase capability.

## Additional v0.3 surfaces

### Local agent adapters
Codex, Claude, OpenCode and Generic adapters are child processes. Their tool-level sandbox/permission modes reduce risk but do not create a new OS identity. Protected mode therefore refuses these adapters as an isolation claim.

### Container adapter
The Docker adapter assumes the Docker daemon is trusted. It removes network access, Linux capabilities and host Git metadata, pins the image digest in the task and limits Builder return data to allowlisted paths. Reviewer container mutations are never copied back.

### Verification commands
Commands are task-bound argv arrays, never shell strings. They execute on an exact disposable candidate copy and become controller-observed Evidence. Local verification is denied in protected mode because project code must not run with controller credentials.

### MCP/dashboard
These surfaces are read-only. Adding approval, mutation, secrets or arbitrary execution to either surface would create a new authority boundary and requires a separate threat model.

### Network broker
The broker mitigates SSRF-style target abuse through HTTPS/host/port/method policy, DNS/private-address checks and pinned resolution. It cannot prevent a worker with unrestricted direct sockets from bypassing the broker.

## Required response
Fail closed. Do not silently downgrade Evidence, switch to a higher-risk adapter, broaden path/network scope or infer authority from tool availability.
