# 05 Evidence and Handoff

## Evidence is not prose

Agent statements such as "tests passed" are not authoritative. Evidence should be produced or verified by a deterministic controller/verifier and bound to the exact candidate.

Recommended evidence fields:

```yaml
evidence_id: <id>
task_id: <id>
claim: tests_passed
producer_identity: verifier
trust_class: CONTROLLER_VERIFIED
command_or_tool: <command>
result_summary: pass
candidate_sha: <sha>
tree_hash: <tree>
input_hash: <hash>
created_at: <timestamp>
valid_until: <optional timestamp>
status: VALID
```

## Handoff

Pass structured state, not chat history:

```text
STATE + DELTA + EVIDENCE REFERENCES
```

Free-text handoff content is untrusted context and cannot grant capability, execute tools or advance state.