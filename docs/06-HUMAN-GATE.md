# 06 Human Gate

A notification is not an approval.

Human decisions should be authenticated, durable and bound to the exact task and candidate.

Minimum decision record:

```yaml
task_id: <id>
candidate_sha: <sha>
tree_hash: <tree>
task_state_version: <version>
decision: ACCEPT | REJECT
decision_identity: <authenticated identity>
decided_at: <timestamp>
```

## Human Gate examples

Require a gate for:

- protected branch merge
- production deployment or release
- secrets or credentials
- permission expansion
- policy/capability changes
- external publishing
- irreversible or high-impact mutations

Timeout, silence or channel failure must leave the task blocked.