# MCP and Dashboard

BAR exposes observation without delegating protected authority.

## MCP bridge

Start the stdio server:

```powershell
bar mcp
```

The modern wire advertises MCP protocol `2026-07-28` and keeps a compatibility `initialize` path for session-era clients.

Exposed tools:

- `bounded_status`
- `bounded_evidence`
- `bounded_doctor`

There is intentionally no MCP tool for approval, protected authorization, merge, deploy, release, secret reads or arbitrary command execution.

MCP tool output remains untrusted context. A client discovering a tool does not gain controller authority.

## Local dashboard

```powershell
bar dashboard --port 4780
```

The server only accepts loopback bind addresses and exposes read-only status, sanitized Evidence and Doctor data. It does not expose Human Gate signatures or controller secrets.

The dashboard is designed for operator visibility:

- current state and state version
- candidate commit/tree
- selected Builder/Reviewer adapters
- Human Gate waiting state
- Evidence timeline
- Doctor status

It is deliberately **not** an approval UI. Adding approval to this surface would create a second Human Gate and would require a separate authenticated threat model.

## Security invariants

1. MCP and dashboard may observe controller-derived state.
2. They may not mutate runtime state.
3. They may not consume approval nonces.
4. They may not authorize protected actions.
5. Their text output never replaces verified Evidence.

The regression suite asserts that the MCP tool list contains no names matching approval/merge/deploy/authorize authority and that non-loopback dashboard binding fails closed.
