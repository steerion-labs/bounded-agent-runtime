# 02 Security Boundaries

## Separate identities

Create dedicated identities for:

- Controller
- Builder
- Reviewer

Builder and Reviewer must not be local administrators. They must not inherit controller-owned credentials.

## Filesystem zones

```text
/runtime-core      controller only
/runtime-state     controller only
/secrets           controller only
/evidence          controller write, workers no authority
/worktrees/<task>  builder write
/review/<task>     reviewer read-only
```

## Network and credentials

Workers should have no source-control write credentials. Remote mutation is performed only through a narrow controller-owned interface after policy revalidation.

## Fail closed

Unknown identity, stale lease, mismatched candidate, missing evidence, ambiguous capability or failed Human Gate must stop execution instead of silently falling back.
