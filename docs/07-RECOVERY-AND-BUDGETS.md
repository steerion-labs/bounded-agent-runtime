# 07 Recovery and Budgets

Autonomy must remain bounded when something fails.

## Recovery outcomes

Use explicit outcomes only:

- SAFE_RESUME
- BLOCKED
- HUMAN_REQUIRED
- SECURITY_STOP

Recovery may restore a known controller or worker process, but must never create new authority.

## Lease and fencing

Every active task should carry:

```yaml
task_id: <id>
owner: <controller instance>
generation: 1
expires_at: <timestamp>
fencing_token: <token>
```

A stale generation must not mutate state or remote systems.

## Budgets

Bound every run by attempts, wall-clock time, model/token budget and tool calls. Agents cannot increase their own budget. Exhaustion stops safely or enters Human Gate.